'use strict';

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');
var api = require('*/cartridge/scripts/flexpay').api;
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var FlexpayConstants = require('*/cartridge/scripts/flexpayConstants');
/**
 * @returns {dw.system.Status} result status 
 */
function paymentCapture() {
    var errorRecords = 0;
    var errorOrders = [];
    var successRecords = 0;
    try {
        OrderMgr.processOrders(function (order) {   
            try {
                api.capture(order.custom.flexPayTransactionId, order.totalGrossPrice.value, order.currencyCode, order.orderNo);
                // eslint-disable-next-line no-param-reassign
                order.custom.flexPayTransactionStatus = FlexpayConstants.TRANSACTION_STATUS.CAPTURED;
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                order.setStatus(Order.ORDER_STATUS_COMPLETED);
                successRecords += 1;
                Logger.info('Flex Pay payment capture successfully completed for order number:{0} and transaction id:{1}', order.orderNo, order.custom.flexPayTransactionId);
            } catch (e) {
                errorRecords += 1;
                errorOrders.push(order.orderNo);
                Logger.error('Flex Pay payment capture error - {0} for order number:{1} and transaction id:{2}', e, order.orderNo, order.custom.flexPayTransactionId);
            }
        }, '(status = {0} OR status = {1}) AND custom.flexPayTransactionStatus = {2}', Order.ORDER_STATUS_NEW, Order.ORDER_STATUS_OPEN, FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED);
        Logger.info('Flex Pay payment capture job completed with {0} success records and {1} error records', successRecords, errorRecords);
        if (errorOrders.length > 0) {
            Logger.error('Error orders: [{0}]', errorOrders.join(', '));
        }
    } catch (e) {
        Logger.error('Flex Pay payment capture job error - {0}', e);
        return new Status(Status.ERROR, FlexpayConstants.JOB_RESULT_CODES.CAPTURE_ERROR);
    }
    if (errorRecords > 0) {
        return new Status(Status.OK, FlexpayConstants.JOB_RESULT_CODES.CAPTURE_COMPLETED_WITH_ERRORS);
    } else {
        return new Status(Status.OK, FlexpayConstants.JOB_RESULT_CODES.CAPTURE_COMPLETED_SUCCESSFULLY);
    }
}

/**
 * @returns {dw.system.Status} result status 
 */
function paymentRefund() {
    var errorRecords = 0;
    var errorOrders = [];
    var successRecords = 0;
    try {
        OrderMgr.processOrders(function (order) {
            try {
                api.refund(order.custom.flexPayTransactionId, order.totalGrossPrice.value, order.currencyCode, order.orderNo);
                // eslint-disable-next-line no-param-reassign
                order.custom.flexPayTransactionStatus = FlexpayConstants.TRANSACTION_STATUS.REFUNDED;
                successRecords += 1;
                Logger.info('Flex Pay payment refund successfully completed for order number:{0} and transaction id:{1}', order.orderNo, order.custom.flexPayTransactionId);
            } catch (e) {
                errorRecords += 1;
                errorOrders.push(order.orderNo);
                Logger.error('Flex Pay payment refund error - {0} for order {1}', e, order.orderNo);
            }
        }, 'status = {0} AND custom.flexPayTransactionStatus = {1}', Order.ORDER_STATUS_CANCELLED, FlexpayConstants.TRANSACTION_STATUS.CAPTURED);
        Logger.info('Flex Pay payment refund job completed with {0} success records and {1} error records', successRecords, errorRecords);
        if (errorOrders.length > 0) {
            Logger.error('Error orders: [{0}]', errorOrders.join(', '));
        }
    } catch (e) {
        Logger.error('Flex Pay payment refund job error - {0}', e);
        return new Status(Status.ERROR, FlexpayConstants.JOB_RESULT_CODES.REFUND_ERROR);
    }
    if (errorRecords > 0) {
        return new Status(Status.OK, FlexpayConstants.JOB_RESULT_CODES.REFUND_COMPLETED_WITH_ERRORS);
    } else {
        return new Status(Status.OK, FlexpayConstants.JOB_RESULT_CODES.REFUND_COMPLETED_SUCCESSFULLY);
    }
}

/**
 * @returns {dw.system.Status} result status 
 */
function paymentVoid() {
    var errorRecords = 0;
    var errorOrders = [];
    var successRecords = 0;
    try {
        OrderMgr.processOrders(function (order) {
            try {
                api.void(order.custom.flexPayTransactionId, order.orderNo);
                // eslint-disable-next-line no-param-reassign
                order.custom.flexPayTransactionStatus = FlexpayConstants.TRANSACTION_STATUS.VOIDED;
                successRecords += 1;
                Logger.info('Flex Pay payment void successfully completed for order number:{0} and transaction id:{1}', order.orderNo, order.custom.flexPayTransactionId);
            } catch (e) {
                errorRecords += 1;
                errorOrders.push(order.orderNo);
                Logger.error('Flex Pay payment void error - {0} for order {1}', e, order.orderNo);
            }
        }, 'status = {0} AND custom.flexPayTransactionStatus = {1}', Order.ORDER_STATUS_CANCELLED, FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED);
        Logger.info('Flex Pay payment void job completed with {0} success records and {1} error records', successRecords, errorRecords);
        if (errorOrders.length > 0) {
            Logger.error('Error orders: [{0}]', errorOrders.join(', '));
        }
    } catch (e) {
        Logger.error('Flex Pay payment void job error - {0}', e);
        return new Status(Status.ERROR, FlexpayConstants.JOB_RESULT_CODES.VOID_ERROR);
    }
    if (errorRecords > 0) {
        return new Status(Status.OK, FlexpayConstants.JOB_RESULT_CODES.VOID_COMPLETED_WITH_ERRORS);
    } else {
        return new Status(Status.OK, FlexpayConstants.JOB_RESULT_CODES.VOID_COMPLETED_SUCCESSFULLY);
    }
}

exports.paymentCapture = paymentCapture;
exports.paymentRefund = paymentRefund;
exports.paymentVoid = paymentVoid;
