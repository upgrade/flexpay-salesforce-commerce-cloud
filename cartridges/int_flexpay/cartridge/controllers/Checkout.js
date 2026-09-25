'use strict';

/**
 * @namespace Checkout
 */

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
/**
 * get the payment method id from the orderModel
 * @param {OrderModel} orderModel - the order model
 * @returns {string} - the payment method id
 */
function getPaymentMethodId(orderModel) {
    var paymentInstruments = orderModel.billing.payment.selectedPaymentInstruments;
    var hasFlexpay = paymentInstruments.some(function (paymentInstrument) {
        return paymentInstrument.paymentMethod === flexpayConfig.getFlexpayPaymentMethodID();
    });
    
    // if hasFlexpay is true, return it, otherwise return CREDIT_CARD as base code always uses CREDIT_CARD 
    return hasFlexpay ? flexpayConfig.getFlexpayPaymentMethodID() : 'CREDIT_CARD';
}

/**
 * Main entry point for Checkout
 */

/**
 *  The Checkout-Begin append(invoked after) endpoint will add flexpay payment method id to the view data
 * @function
 * @memberof Checkout
 * @param {middleware} - server.middleware.https
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - csrfProtection.generateToken
 * @param {querystringparameter} - stage - a flag indicates the checkout stage
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.append(
    'Begin',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        // Get existing view data and add flexpay selected payment method
        var viewData = res.getViewData();
        viewData.selectedPaymentMethod = getPaymentMethodId(viewData.order);
        res.setViewData(viewData);

        return next();
    }
);

module.exports = server.exports();
