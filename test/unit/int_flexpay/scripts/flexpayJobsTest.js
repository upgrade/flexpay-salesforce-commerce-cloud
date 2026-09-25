'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

// Use real FlexpayConstants (no need to mock static data)
var FlexpayConstants = require('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConstants');

describe('paymentJobs Unit Tests', function () {
    var paymentJobs;
    var StatusStub;
    var LoggerStub;
    var apiStub;
    var OrderMgrStub;
    var OrderStub;

    beforeEach(function () {
        // Mock Status
        StatusStub = function (code, message) {
            this.code = code;
            this.message = message;
        };
        StatusStub.OK = 'OK';
        StatusStub.ERROR = 'ERROR';

        // Mock Logger
        LoggerStub = {
            info: sinon.spy(),
            error: sinon.spy(),
            log: sinon.spy()
        };

        // Mock Flexpay API
        apiStub = {
            capture: sinon.stub(),
            refund: sinon.stub(),
            void: sinon.stub()
        };

        // Mock Order constants
        OrderStub = {
            PAYMENT_STATUS_PAID: 2,
            ORDER_STATUS_COMPLETED: 5,
            ORDER_STATUS_NEW: 3,
            ORDER_STATUS_OPEN: 4,
            ORDER_STATUS_CANCELLED: 6
        };

        // Mock OrderMgr
        OrderMgrStub = {
            processOrders: sinon.stub()
        };

        // Load the module with mocks (using real FlexpayConstants)
        paymentJobs = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayJobs', {
            'dw/system/Status': StatusStub,
            'dw/system/Logger': LoggerStub,
            '*/cartridge/scripts/flexpay': { api: apiStub },
            'dw/order/OrderMgr': OrderMgrStub,
            'dw/order/Order': OrderStub,
            '*/cartridge/scripts/flexpayConstants': FlexpayConstants // Use real constants
        });
    });

    afterEach(function () {
        // Reset all stubs and spies
        sinon.restore();
    });

    describe('paymentCapture', function () {
        it('should successfully capture payments for authorized orders', function () {
            // Create mock order
            var mockOrder = {
                orderNo: 'ORDER-12345',
                custom: {
                    flexPayTransactionId: 'TXN-ABC-123',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED
                },
                totalGrossPrice: {
                    value: 150.00
                },
                currencyCode: 'USD',
                setPaymentStatus: sinon.spy(),
                setStatus: sinon.spy()
            };

            // Mock successful API capture
            apiStub.capture.returns({
                id: 'TXN-ABC-123',
                status: 'CAPTURED'
            });

            // Mock processOrders to call callback with mock order
            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentCapture();

            // Verify API was called with correct parameters
            assert.isTrue(apiStub.capture.calledOnce);
            assert.isTrue(apiStub.capture.calledWith(
                'TXN-ABC-123',
                150.00,
                'USD',
                'ORDER-12345'
            ));

            // Verify order was updated
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.CAPTURED);
            assert.isTrue(mockOrder.setPaymentStatus.calledWith(OrderStub.PAYMENT_STATUS_PAID));
            assert.isTrue(mockOrder.setStatus.calledWith(OrderStub.ORDER_STATUS_COMPLETED));

            // Verify success logging
            assert.isTrue(LoggerStub.info.called);

            // Verify return status
            assert.equal(result.code, StatusStub.OK);
            assert.equal(result.message, 'Job-FlexPayCapture-Completed-Successfully');
        });

        it('should handle capture errors for individual orders', function () {
            var mockOrder = {
                orderNo: 'ORDER-ERROR-456',
                custom: {
                    flexPayTransactionId: 'TXN-ERROR-789',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED
                },
                totalGrossPrice: {
                    value: 200.00
                },
                currencyCode: 'USD',
                setPaymentStatus: sinon.spy(),
                setStatus: sinon.spy()
            };

            // Mock API capture to throw error
            apiStub.capture.throws(new Error('Insufficient funds'));

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentCapture();

            // Verify error was logged
            assert.isTrue(LoggerStub.error.called);
            var errorCall = LoggerStub.error.args.find(function (args) {
                return args[0].includes('Flex Pay payment capture error');
            });
            assert.isDefined(errorCall);

            // Verify order status was NOT updated due to error
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED);
            assert.isFalse(mockOrder.setPaymentStatus.called);
            assert.isFalse(mockOrder.setStatus.called);

            // Verify return status indicates errors occurred (but job completed)
            assert.equal(result.code, StatusStub.OK);
            assert.equal(result.message, 'Job-FlexPayCapture-Completed-With-Errors');
        });

        it('should handle EUR currency correctly', function () {
            var mockOrder = {
                orderNo: 'ORDER-EUR-001',
                custom: {
                    flexPayTransactionId: 'TXN-EUR-001',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED
                },
                totalGrossPrice: { value: 250.00 },
                currencyCode: 'EUR',
                setPaymentStatus: sinon.spy(),
                setStatus: sinon.spy()
            };

            apiStub.capture.returns({ status: 'CAPTURED' });

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentCapture();

            // Verify order was processed with EUR currency
            assert.isTrue(apiStub.capture.calledOnce);
            assert.isTrue(apiStub.capture.calledWith('TXN-EUR-001', 250.00, 'EUR', 'ORDER-EUR-001'));

            // Verify order was updated
            assert.isTrue(mockOrder.setPaymentStatus.called);
            assert.isTrue(mockOrder.setStatus.called);

            // Verify success status
            assert.equal(result.code, StatusStub.OK);
        });

        it('should return ERROR status when OrderMgr.processOrders throws exception', function () {
            // Mock processOrders to throw exception
            OrderMgrStub.processOrders.throws(new Error('Database connection failed'));

            // Execute
            var result = paymentJobs.paymentCapture();

            // Verify error was logged
            assert.isTrue(LoggerStub.error.called);
            var errorCall = LoggerStub.error.args.find(function (args) {
                return args[0].includes('Flex Pay payment capture job error');
            });
            assert.isDefined(errorCall);

            // Verify ERROR status returned
            assert.equal(result.code, StatusStub.ERROR);
            assert.equal(result.message, 'Job-FlexPayCapture-Error');
        });

        it('should use correct query filter for order selection', function () {
            OrderMgrStub.processOrders.returns();

            // Execute
            paymentJobs.paymentCapture();

            // Verify processOrders was called with correct query
            assert.isTrue(OrderMgrStub.processOrders.calledOnce);
            var queryArgs = OrderMgrStub.processOrders.firstCall.args;
            
            // Verify query string
            assert.equal(queryArgs[1], '(status = {0} OR status = {1}) AND custom.flexPayTransactionStatus = {2}');
            
            // Verify query parameters
            assert.equal(queryArgs[2], OrderStub.ORDER_STATUS_NEW);
            assert.equal(queryArgs[3], OrderStub.ORDER_STATUS_OPEN);
            assert.equal(queryArgs[4], FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED);
        });

        it('should handle GBP currency correctly', function () {
            var mockOrder = {
                orderNo: 'ORDER-GBP',
                custom: { flexPayTransactionId: 'TXN-GBP' },
                totalGrossPrice: { value: 85.50 },
                currencyCode: 'GBP',
                setPaymentStatus: sinon.spy(),
                setStatus: sinon.spy()
            };

            apiStub.capture.returns({ status: 'CAPTURED' });

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            paymentJobs.paymentCapture();

            // Verify correct currency passed to API
            assert.isTrue(apiStub.capture.calledWith('TXN-GBP', 85.50, 'GBP', 'ORDER-GBP'));
            assert.isTrue(mockOrder.setPaymentStatus.called);
        });
    });

    describe('paymentRefund', function () {
        it('should successfully refund payments for cancelled orders', function () {
            // Create mock order
            var mockOrder = {
                orderNo: 'ORDER-REFUND-123',
                custom: {
                    flexPayTransactionId: 'TXN-REFUND-456',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.CAPTURED
                },
                totalGrossPrice: {
                    value: 200.00
                },
                currencyCode: 'USD'
            };

            // Mock successful API refund
            apiStub.refund.returns({
                id: 'TXN-REFUND-456',
                status: 'REFUNDED'
            });

            // Mock processOrders to call callback with mock order
            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentRefund();

            // Verify API was called with correct parameters
            assert.isTrue(apiStub.refund.calledOnce);
            assert.isTrue(apiStub.refund.calledWith(
                'TXN-REFUND-456',
                200.00,
                'USD',
                'ORDER-REFUND-123'
            ));

            // Verify order was updated
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.REFUNDED);

            // Verify success logging
            assert.isTrue(LoggerStub.info.called);

            // Verify return status
            assert.equal(result.code, StatusStub.OK);
            assert.equal(result.message, 'Job-FlexPayRefund-Completed-Successfully');
        });

        it('should handle refund errors for individual orders', function () {
            var mockOrder = {
                orderNo: 'ORDER-REFUND-ERROR',
                custom: {
                    flexPayTransactionId: 'TXN-REFUND-ERROR',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.CAPTURED
                },
                totalGrossPrice: {
                    value: 150.00
                },
                currencyCode: 'USD'
            };

            // Mock API refund to throw error
            apiStub.refund.throws(new Error('Refund already processed'));

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentRefund();

            // Verify error was logged
            assert.isTrue(LoggerStub.error.called);
            var errorCall = LoggerStub.error.args.find(function (args) {
                return args[0].includes('Flex Pay payment refund error');
            });
            assert.isDefined(errorCall);

            // Verify order status was NOT updated due to error
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.CAPTURED);

            // Verify return status indicates errors occurred (but job completed)
            assert.equal(result.code, StatusStub.OK);
            assert.equal(result.message, 'Job-FlexPayRefund-Completed-With-Errors');
        });

        it('should handle EUR currency refunds', function () {
            var mockOrder = {
                orderNo: 'ORDER-REFUND-EUR',
                custom: {
                    flexPayTransactionId: 'TXN-REFUND-EUR',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.CAPTURED
                },
                totalGrossPrice: { value: 175.50 },
                currencyCode: 'EUR'
            };

            apiStub.refund.returns({ status: 'REFUNDED' });

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentRefund();

            // Verify correct currency passed to API
            assert.isTrue(apiStub.refund.calledWith('TXN-REFUND-EUR', 175.50, 'EUR', 'ORDER-REFUND-EUR'));
            assert.equal(result.code, StatusStub.OK);
        });

        it('should return ERROR status when OrderMgr.processOrders throws exception', function () {
            // Mock processOrders to throw exception
            OrderMgrStub.processOrders.throws(new Error('Database error'));

            // Execute
            var result = paymentJobs.paymentRefund();

            // Verify error was logged
            assert.isTrue(LoggerStub.error.called);
            var errorCall = LoggerStub.error.args.find(function (args) {
                return args[0].includes('Flex Pay payment refund job error');
            });
            assert.isDefined(errorCall);

            // Verify ERROR status returned
            assert.equal(result.code, StatusStub.ERROR);
            assert.equal(result.message, 'Job-FlexPayRefund-Error');
        });

        it('should use correct query filter for refund order selection', function () {
            OrderMgrStub.processOrders.returns();

            // Execute
            paymentJobs.paymentRefund();

            // Verify processOrders was called with correct query
            assert.isTrue(OrderMgrStub.processOrders.calledOnce);
            var queryArgs = OrderMgrStub.processOrders.firstCall.args;
            
            // Verify query string
            assert.equal(queryArgs[1], 'status = {0} AND custom.flexPayTransactionStatus = {1}');
            
            // Verify query parameters - refund processes CANCELLED orders with CAPTURED status
            assert.equal(queryArgs[2], OrderStub.ORDER_STATUS_CANCELLED);
            assert.equal(queryArgs[3], FlexpayConstants.TRANSACTION_STATUS.CAPTURED);
        });

        it('should log summary with success and error counts', function () {
            var mockOrder = {
                orderNo: 'ORDER-REFUND-SUMMARY',
                custom: { flexPayTransactionId: 'TXN-REFUND-SUMMARY' },
                totalGrossPrice: { value: 100.00 },
                currencyCode: 'USD'
            };

            apiStub.refund.returns({ status: 'REFUNDED' });
            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            paymentJobs.paymentRefund();

            // Verify summary log
            var summaryLog = LoggerStub.info.getCalls().find(function (call) {
                return call.args[0].includes('refund job completed with');
            });
            assert.isDefined(summaryLog);
        });
    });

    describe('paymentVoid', function () {
        it('should successfully void payments for cancelled authorized orders', function () {
            // Create mock order
            var mockOrder = {
                orderNo: 'ORDER-VOID-123',
                custom: {
                    flexPayTransactionId: 'TXN-VOID-456',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED,
                    isFlexPay: true
                }
            };

            // Mock successful API void
            apiStub.void.returns({
                id: 'TXN-VOID-456',
                status: 'VOIDED'
            });

            // Mock processOrders to call callback with mock order
            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentVoid();

            // Verify API was called with correct parameters
            assert.isTrue(apiStub.void.calledOnce);
            assert.isTrue(apiStub.void.calledWith(
                'TXN-VOID-456',
                'ORDER-VOID-123'
            ));

            // Verify order was updated
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.VOIDED);

            // Verify success logging
            assert.isTrue(LoggerStub.info.called);

            // Verify return status
            assert.equal(result.code, StatusStub.OK);
            assert.equal(result.message, 'Job-FlexPayVoid-Completed-Successfully');
        });

        it('should handle void errors for individual orders', function () {
            var mockOrder = {
                orderNo: 'ORDER-VOID-ERROR',
                custom: {
                    flexPayTransactionId: 'TXN-VOID-ERROR',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED,
                    isFlexPay: true
                }
            };

            // Mock API void to throw error
            apiStub.void.throws(new Error('Transaction already voided'));

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentVoid();

            // Verify error was logged
            assert.isTrue(LoggerStub.error.called);
            var errorCall = LoggerStub.error.args.find(function (args) {
                return args[0].includes('Flex Pay payment void error');
            });
            assert.isDefined(errorCall);

            // Verify order status was NOT updated due to error
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED);

            // Verify return status indicates errors occurred (but job completed)
            assert.equal(result.code, StatusStub.OK);
            assert.equal(result.message, 'Job-FlexPayVoid-Completed-With-Errors');
        });

        it('should only require transactionId and orderNo for void', function () {
            var mockOrder = {
                orderNo: 'ORDER-VOID-PARAMS',
                custom: {
                    flexPayTransactionId: 'TXN-VOID-PARAMS',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED,
                    isFlexPay: true
                }
            };

            apiStub.void.returns({ status: 'VOIDED' });

            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            paymentJobs.paymentVoid();

            // Verify API was called with ONLY 2 parameters (no amount/currency needed for void)
            assert.isTrue(apiStub.void.calledOnce);
            assert.equal(apiStub.void.firstCall.args.length, 2);
            assert.equal(apiStub.void.firstCall.args[0], 'TXN-VOID-PARAMS');
            assert.equal(apiStub.void.firstCall.args[1], 'ORDER-VOID-PARAMS');
        });

        it('should return ERROR status when OrderMgr.processOrders throws exception', function () {
            // Mock processOrders to throw exception
            OrderMgrStub.processOrders.throws(new Error('Database connection lost'));

            // Execute
            var result = paymentJobs.paymentVoid();

            // Verify error was logged
            assert.isTrue(LoggerStub.error.called);
            var errorCall = LoggerStub.error.args.find(function (args) {
                return args[0].includes('Flex Pay payment void job error');
            });
            assert.isDefined(errorCall);

            // Verify ERROR status returned
            assert.equal(result.code, StatusStub.ERROR);
            assert.equal(result.message, 'Job-FlexPayVoid-Error');
        });

        it('should use correct query filter for void order selection', function () {
            OrderMgrStub.processOrders.returns();

            // Execute
            paymentJobs.paymentVoid();

            // Verify processOrders was called with correct query
            assert.isTrue(OrderMgrStub.processOrders.calledOnce);
            var queryArgs = OrderMgrStub.processOrders.firstCall.args;
            
            // Verify query string
            assert.equal(queryArgs[1], 'status = {0} AND custom.flexPayTransactionStatus = {1}');
            
            // Verify query parameters - void processes CANCELLED orders with AUTHORIZED status
            assert.equal(queryArgs[2], OrderStub.ORDER_STATUS_CANCELLED);
            assert.equal(queryArgs[3], FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED);
        });

        it('should log summary with success and error counts', function () {
            var mockOrder = {
                orderNo: 'ORDER-VOID-SUMMARY',
                custom: {
                    flexPayTransactionId: 'TXN-VOID-SUMMARY',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED,
                    isFlexPay: true
                }
            };

            apiStub.void.returns({ status: 'VOIDED' });
            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            paymentJobs.paymentVoid();

            // Verify summary log
            var summaryLog = LoggerStub.info.getCalls().find(function (call) {
                return call.args[0].includes('void job completed with');
            });
            assert.isDefined(summaryLog);
        });

        it('should handle orders with isFlexPay flag correctly', function () {
            var mockOrder = {
                orderNo: 'ORDER-VOID-FLAG',
                custom: {
                    flexPayTransactionId: 'TXN-VOID-FLAG',
                    flexPayTransactionStatus: FlexpayConstants.TRANSACTION_STATUS.AUTHORIZED,
                    isFlexPay: true
                }
            };

            apiStub.void.returns({ status: 'VOIDED' });
            OrderMgrStub.processOrders.callsArgWith(0, mockOrder);

            // Execute
            var result = paymentJobs.paymentVoid();

            // Verify void was called
            assert.isTrue(apiStub.void.calledOnce);
            
            // Verify order status was updated
            assert.equal(mockOrder.custom.flexPayTransactionStatus, FlexpayConstants.TRANSACTION_STATUS.VOIDED);
            
            // Verify success
            assert.equal(result.code, StatusStub.OK);
        });
    });
});
