'use strict';

/**
 * FlexPay Transaction Status Constants
 * These values map to the custom.FlexpayTransactionStatus attribute on Order objects
 */
var TRANSACTION_STATUS = {
    /** Transaction has been authorized (funds reserved) */
    AUTHORIZED: 'AUTHORIZED',

    /** Transaction authorization failed */
    AUTHORIZED_FAILED: 'AUTHORIZED_FAILED',
    
    /** Transaction has been captured (funds settled) */
    CAPTURED: 'CAPTURED',
    
    /** Transaction has been partially captured */
    PARTIALLY_CAPTURED: 'PARTIALLY_CAPTURED',
        
    /** Transaction has been refunded */
    REFUNDED: 'REFUNDED',
    
    /** Transaction has been partially refunded */
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',

    /** Transaction has been voided (authorization cancelled) */
    VOIDED: 'VOIDED'
};

/**
 * FlexPay Order Status Constants
 */
var ORDER_STATUS = {

};

/**
 * FlexPay Payment Method Constants
 */
var PAYMENT_METHOD = {
    /** FlexPay payment method ID */
    ID: 'FLEXPAY',
    
    /** FlexPay payment method name */
    NAME: 'FlexPay'
};

/**
 * FlexPay Integration Type Constants
 */
var INTEGRATION_TYPE = {
    /** Virtual Credit Number integration */
    VCN: 'VCN',
    
    /** Direct Settle integration */
    DIRECT_SETTLE: 'DIRECT_SETTLE'
};

/**
 * FlexPay API Error Codes
 * From https://docs.uplift.com/apidocs/creates-an-order
 * Keys map to resource bundle entries in flexpay.properties: error.flexpay.<CODE>
 */
var ERROR_CODES = {
    INVALID_AIR_RESERVATION: 'INVALID_AIR_RESERVATION',
    INVALID_BILLING_CONTACT: 'INVALID_BILLING_CONTACT',
    INVALID_COUNTRY: 'INVALID_COUNTRY',
    INVALID_CURRENCY: 'INVALID_CURRENCY',
    INVALID_LOCALE: 'INVALID_LOCALE',
    MAX_BOOKING_WINDOW: 'MAX_BOOKING_WINDOW',
    MAX_PRICE: 'MAX_PRICE',
    MIN_BOOKING_WINDOW: 'MIN_BOOKING_WINDOW',
    MIN_PRICE: 'MIN_PRICE',
    MISSING_PRODUCT: 'MISSING_PRODUCT',
    MISSING_TRAVEL_RESERVATION: 'MISSING_TRAVEL_RESERVATION',
    NO_OFFERS: 'NO_OFFERS',
    LOAN_NOT_ACCEPTED: 'LOAN_NOT_ACCEPTED'
};

/**
 * FlexPay Job Result Constants
 */
var JOB_RESULT_CODES = {
    CAPTURE_COMPLETED_SUCCESSFULLY: 'Job-FlexPayCapture-Completed-Successfully',
    CAPTURE_COMPLETED_WITH_ERRORS: 'Job-FlexPayCapture-Completed-With-Errors',
    CAPTURE_ERROR: 'Job-FlexPayCapture-Error',
    REFUND_COMPLETED_SUCCESSFULLY: 'Job-FlexPayRefund-Completed-Successfully',
    REFUND_COMPLETED_WITH_ERRORS: 'Job-FlexPayRefund-Completed-With-Errors',
    REFUND_ERROR: 'Job-FlexPayRefund-Error',
    VOID_COMPLETED_SUCCESSFULLY: 'Job-FlexPayVoid-Completed-Successfully',
    VOID_COMPLETED_WITH_ERRORS: 'Job-FlexPayVoid-Completed-With-Errors',
    VOID_ERROR: 'Job-FlexPayVoid-Error'
};
module.exports = {
    TRANSACTION_STATUS: TRANSACTION_STATUS,
    ORDER_STATUS: ORDER_STATUS,
    PAYMENT_METHOD: PAYMENT_METHOD,
    INTEGRATION_TYPE: INTEGRATION_TYPE,
    ERROR_CODES: ERROR_CODES,
    JOB_RESULT_CODES: JOB_RESULT_CODES
};
