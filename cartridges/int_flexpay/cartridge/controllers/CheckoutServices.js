'use strict';

/**
 * @namespace CheckoutServices
 */

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');

/**
 *  Handle Ajax payment (and billing) form submit
 */
server.prepend(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var data = res.getViewData();
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentOrNewBasket();
        var paymentForm = server.forms.getForm('billing');
        var paymentMethodID = paymentForm.paymentMethod.value;
        var Transaction = require('dw/system/Transaction');
        var Resource = require('dw/web/Resource');

        // if there is no selected payment option and balance is greater than zero
        if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
            var missingPaymentMethod = {};
            missingPaymentMethod[paymentForm.paymentMethod.htmlName] = Resource.msg('error.no.selected.payment.method', 'creditCard', null);
            res.json({
                form: paymentForm,
                fieldErrors: [missingPaymentMethod],
                serverErrors: [],
                error: true
            });
            return;
        }

        if (paymentMethodID !== flexpayConfig.getFlexpayPaymentMethodID()) {
            var paymentMethod = flexpayConfig.getFlexpayPaymentMethodID();
            Transaction.wrap(function () {
                var payInstr = currentBasket.getPaymentInstruments(paymentMethod);
                var iter = payInstr.iterator();
                while (iter.hasNext()) {
                    var pi = iter.next();
                    currentBasket.removePaymentInstrument(pi);
                }
            });
            // let base code to take over
            next();
            return;
        }

        if (data && data.csrfError) {
            res.json();
            this.emit('route:Complete', req, res);
            return;
        }

        var billingFormErrors = {};
        var viewData = {};
        var formFieldErrors = [];
        // verify billing form data
        billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

        if (Object.keys(contactInfoFormErrors).length) {
            formFieldErrors.push(contactInfoFormErrors);
        } else {
            if (flexpayConfig.getSfraMajorVersion() <= 5) {
                viewData.email = {
                    value: paymentForm.contactInfoFields.email.value
                };
            }
            viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
        }
        if (Object.keys(billingFormErrors).length) {
            // respond with form data and errors
            formFieldErrors.push(billingFormErrors);
        }
        if (formFieldErrors.length) {
            // respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: formFieldErrors,
                serverErrors: [],
                error: true
            });
            this.emit('route:Complete', req, res);
            return;
        }

        viewData.address = {
            firstName: { value: paymentForm.addressFields.firstName.value },
            lastName: { value: paymentForm.addressFields.lastName.value },
            address1: { value: paymentForm.addressFields.address1.value },
            address2: { value: paymentForm.addressFields.address2.value },
            city: { value: paymentForm.addressFields.city.value },
            postalCode: { value: paymentForm.addressFields.postalCode.value },
            countryCode: { value: paymentForm.addressFields.country.value }
        };
        if (Object.prototype.hasOwnProperty
            .call(paymentForm.addressFields, 'states')) {
            viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
        }
        viewData.paymentMethod = {
            value: paymentForm.paymentMethod.value,
            htmlName: paymentForm.paymentMethod.value
        };

        res.setViewData(viewData);

        var HookMgr = require('dw/system/HookMgr');
        var PaymentMgr = require('dw/order/PaymentMgr');
        var AccountModel = require('*/cartridge/models/account');
        var OrderModel = require('*/cartridge/models/order');
        var URLUtils = require('dw/web/URLUtils');
        var Locale = require('dw/util/Locale');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var billingData = res.getViewData();
        if (!currentBasket) {
            delete billingData.paymentInformation;
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            this.emit('route:Complete', req, res);
            return;
        }
        var billingAddress = currentBasket.billingAddress;
        var billingForm = server.forms.getForm('billing');
        paymentMethodID = billingData.paymentMethod.value;
        Transaction.wrap(function () {
            if (!billingAddress) {
                billingAddress = currentBasket.createBillingAddress();
            }
            billingAddress.setFirstName(billingData.address.firstName.value);
            billingAddress.setLastName(billingData.address.lastName.value);
            billingAddress.setAddress1(billingData.address.address1.value);
            billingAddress.setAddress2(billingData.address.address2.value);
            billingAddress.setCity(billingData.address.city.value);
            billingAddress.setPostalCode(billingData.address.postalCode.value);
            if (Object.prototype.hasOwnProperty.call(billingData.address, 'stateCode')) {
                billingAddress.setStateCode(billingData.address.stateCode.value);
            }
            billingAddress.setCountryCode(billingData.address.countryCode.value);
            billingAddress.setPhone(billingData.phone.value);
            if (flexpayConfig.getSfraMajorVersion() <= 5) {
                currentBasket.setCustomerEmail(billingData.email.value);
            }
        });

        // if there is no selected payment option and balance is greater than zero
        if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
            var noPaymentMethod = {};
            noPaymentMethod[billingData.paymentMethod.htmlName] = Resource.msg('error.no.selected.payment.method', 'creditCard', null);
            delete billingData.paymentInformation;
            res.json({
                form: billingForm,
                fieldErrors: [noPaymentMethod],
                serverErrors: [],
                error: true
            });
            return;
        }

        var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

        // check to make sure there is a payment processor
        if (!processor) {
            throw new Error(Resource.msg(
                'error.payment.processor.missing',
                'checkout',
                null
            ));
        }

        var processorResult = null;
        if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
            processorResult = HookMgr.callHook(
                'app.payment.processor.' + processor.ID.toLowerCase(),
                'Handle',
                currentBasket,
                billingData.paymentInformation,
                paymentMethodID,
                req
            );
        } else {
            processorResult = HookMgr.callHook('app.payment.processor.default', 'Handle');
        }
        if (processorResult.error) {
            delete billingData.paymentInformation;
            res.json({
                form: billingForm,
                fieldErrors: processorResult.fieldErrors,
                serverErrors: processorResult.serverErrors,
                error: true
            });
            this.emit('route:Complete', req, res);
            return;
        }
        // Calculate the basket
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });
        // Re-calculate the payments.
        var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
            currentBasket
        );
        if (calculatedPaymentTransaction.error) {
            res.json({
                form: paymentForm,
                fieldErrors: [],
                serverErrors: [Resource.msg('error.technical', 'checkout', null)],
                error: true
            });
            return;
        }
        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
        if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
            req.session.privacyCache.set('usingMultiShipping', false);
            usingMultiShipping = false;
        }
     
        var currentLocale = Locale.getLocale(req.locale.id);
        var basketModel = new OrderModel(
            currentBasket,
            { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
        );
        var accountModel = new AccountModel(req.currentCustomer);
        var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
            req,
            accountModel
        );
        delete billingData.paymentInformation;
        res.json({
            renderedPaymentInstruments: renderedStoredPaymentInstrument,
            customer: accountModel,
            order: basketModel,
            form: billingForm,
            error: false
        });

        if (paymentMethodID === flexpayConfig.getFlexpayPaymentMethodID()) {
            // terminate the request process here
            this.emit('route:Complete', req, res);
        }
    }
);

module.exports = server.exports();
