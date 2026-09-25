'use strict';

var Transaction = require('dw/system/Transaction');
var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
var collections = require('*/cartridge/scripts/util/collections');
var OrderMgr = require('dw/order/OrderMgr');

/**
* removes other payment instruments from basket and saves flexpay, used in SubmitPayment
* @param {Object} basket - basket
* @returns {Object} - errors
*/
function Handle(basket) {
    var currentBasket = basket;
   
    var paymentMethodID = flexpayConfig.getFlexpayPaymentMethodID();
    if (!paymentMethodID) {
        return {
            error: true
        };
    }

    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();
        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        currentBasket.createPaymentInstrument(
            paymentMethodID, currentBasket.totalGrossPrice
        );
    });

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * authorizes the payment processor, used in checkoutHelpers.handlePayment
 * @param {string} orderNumber - Order number
 * @param {dw.order.PaymentInstrument} paymentInstrument - Payment instrument
 * @param {dw.order.PaymentProcessor} paymentProcessor - Payment processor
 * @returns {Object} - errors
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    try {
        // Get the order by order number
        var order = OrderMgr.getOrder(orderNumber);
        
        if (!order) {
            return { 
                fieldErrors: {}, 
                serverErrors: ['Order not found: ' + orderNumber], 
                error: true 
            };
        }
        
        // Access Flex Pay custom attributes from the order
        var flexPayOrderID = order.custom.flexPayOrderID;
        var flexPayTransactionId = order.custom.flexPayTransactionId;
        var flexPayTransactionStatus = order.custom.flexPayTransactionStatus;
        var isFlexPay = order.custom.isFlexPay;
        
        if (!flexPayOrderID || !flexPayTransactionId || !flexPayTransactionStatus || !isFlexPay) {
            return { 
                error: true,
                serverErrors: ['Place order with Flexpay did not complete successfully'],
                fieldErrors: {}
            };
        }
        
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
    } catch (e) {
        return { fieldErrors: {}, serverErrors: [e.message], error: true };
    }
    return { fieldErrors: {}, serverErrors: [], error: false };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
