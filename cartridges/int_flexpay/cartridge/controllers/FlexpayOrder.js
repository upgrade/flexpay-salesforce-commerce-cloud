'use strict';

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var Logger = require('dw/system/Logger'); // ← Import Logger
var flexpay = require('*/cartridge/scripts/flexpay');
var flexpayAPI = require('*/cartridge/scripts/flexpayAPI');
var TRANSACTION_STATUS = require('*/cartridge/scripts/flexpay').constants.TRANSACTION_STATUS;

/**
 * Creates a payment instrument for Flexpay virtual card
 * @param {dw.order.Basket} basket - The shopping basket
 * @param {Object} vcc - The Flexpay card data containing card details and contact info
 * @returns {dw.order.PaymentInstrument} The created payment instrument
 */
function createVccPaymentInstrument(basket, vcc) {
    var Transaction = require('dw/system/Transaction');
    var PaymentInstrument = require('dw/order/PaymentInstrument');

    // Extract card details
    var cardNumber = vcc.number;        
    var cardHolder = vcc.nameOnCard; 
    var cardType = vcc.type;                
    var expirationMonth = vcc.expirationMonth; 
    var expirationYear = vcc.expirationYear; 
    
    // Extract billing address
    var billingAddress = basket.getBillingAddress();
    if (billingAddress) {
        Transaction.wrap(function () {
            billingAddress.setCity(vcc.contact.city);
            billingAddress.setAddress1(vcc.contact.streetAddress);
    
            billingAddress.setStateCode(vcc.contact.region);
            billingAddress.setPostalCode(vcc.contact.postalCode);
        });
    }

    var paymentInstrument;
    var paymentInstruments = basket.getPaymentInstruments();
    // Create payment instrument in basket
    Transaction.wrap(function () {
        // Remove existing payment instruments
        var paymentIterator = paymentInstruments.iterator();
        while (paymentIterator.hasNext()) {
            var pi = paymentIterator.next();
            basket.removePaymentInstrument(pi);
        }
        
        // Create new credit card payment instrument
        paymentInstrument = basket.createPaymentInstrument(PaymentInstrument.METHOD_CREDIT_CARD, basket.totalGrossPrice);
        
        // Store VCN data in payment instrument
        paymentInstrument.creditCardHolder = cardHolder;
        paymentInstrument.creditCardNumber = cardNumber;
        paymentInstrument.creditCardType = cardType;
        paymentInstrument.creditCardExpirationMonth = expirationMonth;
        paymentInstrument.creditCardExpirationYear = expirationYear;
    });
    
    return paymentInstrument;
}
/**
 * Creates a payment instrument for Flexpay direct settle
 * @param {dw.order.Basket} basket - The shopping basket
 * @param {Object} response - The Flexpay response containing the order ID
 * @param {string} flexPayOrderID - The Flex Pay order ID
 * @returns {dw.order.PaymentInstrument} The created payment instrument
 */
function createDirectSettlePaymentInstrument(basket) {
    var Transaction = require('dw/system/Transaction');
    var paymentInstrument;
    var paymentInstruments = basket.getPaymentInstruments();
    
    Transaction.wrap(function () {
        // Remove existing payment instruments
        var paymentIterator = paymentInstruments.iterator();
        while (paymentIterator.hasNext()) {
            var pi = paymentIterator.next();
            basket.removePaymentInstrument(pi);
        }
        
        paymentInstrument = basket.createPaymentInstrument(flexpay.config.getFlexpayPaymentMethodID(), basket.totalGrossPrice);
    });
    
    return paymentInstrument;
}

server.post('Create',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Resource = require('dw/web/Resource');
        var Transaction = require('dw/system/Transaction');
        var URLUtils = require('dw/web/URLUtils');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    
        var currentBasket = BasketMgr.getCurrentBasket();
        // validation
        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }
    
        var validatedProducts = validationHelpers.validateProducts(currentBasket);
        if (validatedProducts.error) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }
    
        if (req.session.privacyCache.get('fraudDetectionStatus')) {
            res.json({
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
    
            return next();
        }
    
        var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
        if (validationOrderStatus.error) {
            res.json({
                error: true,
                errorMessage: validationOrderStatus.message
            });
            return next();
        }
    
        // Check to make sure there is a shipping address
        if (currentBasket.defaultShipment.shippingAddress === null) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'shipping',
                    step: 'address'
                },
                errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
            });
            return next();
        }
    
        // Check to make sure billing address exists
        if (!currentBasket.billingAddress) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'billingAddress'
                },
                errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
            });
            return next();
        }
  
        // Calculate the basket
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });
    
        // Re-validates existing payment instruments
        var validPayment = COHelpers.validatePayment(req, currentBasket);
        if (validPayment.error) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'paymentInstrument'
                },
                errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
            });
            return next();
        }
    
        // Re-calculate the payments.
        var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
        if (calculatedPaymentTransactionTotal.error) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }
        try {
            var response = flexpay.api.createOrder(currentBasket);
            res.json({
                error: false,
                redirectUrl: response.redirectUrl
            });
            return next();
        } catch (e) {
            Logger.error('Flexpay create order error - {0}', e);
            var errorMessage = e.errorCodes
                ? flexpayAPI.getLocalizedErrorMessage(e.errorCodes)
                : e.message;
            res.json({
                error: true,
                errorMessage: errorMessage
            });
            return next();
        }
    });

server.get('Confirm', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');

    var flexPayOrderID = req.querystring.order_id;
    var currentBasket = BasketMgr.getCurrentBasket();
    var authResult = null;
    try {
        if (flexpay.config.isVCNIntegration()) {
            var result = flexpay.api.getVcc(flexPayOrderID);
            createVccPaymentInstrument(currentBasket, result.card);
        } else {
            authResult = flexpay.api.auth(flexPayOrderID, currentBasket.totalGrossPrice.value, currentBasket.UUID, currentBasket.getCurrencyCode());
            createDirectSettlePaymentInstrument(currentBasket, authResult);
        }
    } catch (e) {
        Logger.error('Flexpay confirm order error - {0}', e);
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    // create the sfcc order
    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    // update the order with the flexpay custom attributes
    Transaction.wrap(function () {
        order.custom.flexPayOrderID = flexPayOrderID;
        order.custom.isFlexPay = true;
        if (!flexpay.config.isVCNIntegration()) {
            order.custom.flexPayTransactionId = authResult.id;
            order.custom.flexPayTransactionStatus = TRANSACTION_STATUS.AUTHORIZED;
        }
    });
   
    // Handles payment authorization, this calls the auth hook
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);

    // Handle custom processing post authorization
    var options = {
        req: req,
        res: res
    };
    var postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', handlePaymentResult, order, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
    if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
        res.json(postAuthCustomizations);
        return next();
    }

    if (handlePaymentResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);

        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });

        return next();
    }

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        // cancel the flexpay order 
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    // call flexpay to confirm the order Put /v1/orders/{orderId}/confirmation
    try {
        flexpay.api.confirmOrder(flexPayOrderID, order.orderNo);
    } catch (e) {
        // log the error but continue the flow
        Logger.error('Flexpay confirm order error - {0}', e);
    }
    
    if (req.currentCustomer.addressBook) {
        // save all used shipping addresses to address book of the logged in customer
        var allAddresses = addressHelpers.gatherShippingAddresses(order);
        allAddresses.forEach(function (address) {
            if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
            }
        });
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, req.locale.id);
    }

    // Reset usingMultiShip after successful Order placement
    req.session.privacyCache.set('usingMultiShipping', false);

    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.
    // res.json({
    //     error: false,
    //     orderID: order.orderNo,
    //     orderToken: order.orderToken,
    //     continueUrl: URLUtils.url('Order-Confirm').toString()
    // });

    if (flexpay.config.getSfraMajorVersion() <= 5) {
        res.redirect(URLUtils.url('Order-Confirm', 'ID', order.orderNo, 'token', order.orderToken));
    } else {
        // for sfra version 6 and above
        res.render('checkout/confirmOrder', {
            orderID: order.orderNo,
            orderToken: order.orderToken,
            continueUrl: URLUtils.url('Order-Confirm').toString()
        });
    }

    return next();
});  

/**
 * Redirects to checkout page with payment stage in case of cancel
 */
server.use('Cancel', function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');
    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment').toString());
    return next();
});

/**
 * FlexpayOrder-GetOffer : Get available offers for a purchase amount
 * @name FlexpayOrder-GetOffer
 * @function
 * @memberof FlexpayOrder
 * @param {httpparameter} - amount - Purchase amount
 * @param {httpparameter} - currency - Currency code (optional, default: USD)
 * @param {renders} - json
 */
server.get('GetOffer', server.middleware.https, function (req, res, next) {
    var flexpayOffers = require('*/cartridge/scripts/flexpayOffers');

    try {
        // Parse and validate input
        var amount = parseFloat(req.querystring.amount);
        var currency = req.querystring.currency || 'USD';

        if (!amount || isNaN(amount) || amount <= 0) {
            res.json({
                success: false,
                error: 'Invalid amount parameter'
            });
            return next();
        }

        // Get offers from business logic module
        var offersData = flexpayOffers.getAvailableOffers(amount, currency);

        if (offersData.success) {
            // Format offers for display
            var formattedOffers = offersData.offers.map(function(offer) {
                return flexpayOffers.formatOfferForDisplay(offer);
            });

            res.json({
                success: true,
                offers: formattedOffers
            });
        } else {
            res.json({
                success: false,
                error: offersData.error
            });
        }
    } catch (e) {
        Logger.error('Exception in FlexpayOrder-GetOffer: ' + e.message);
        res.json({
            success: false,
            error: 'Internal server error'
        });
    }

    return next();
});

module.exports = server.exports();
