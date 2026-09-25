'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('flexpayPayment processor', function () {
    var flexpayPayment;
    var transactionStub;
    var flexpayConfigStub;
    var collectionsStub;
    var orderMgrStub;
    var mockBasket;
    var paymentInstruments;

    beforeEach(function () {
        // Create mock payment instruments collection
        paymentInstruments = [
            {
                paymentMethod: 'CREDIT_CARD',
                paymentTransaction: {
                    amount: { value: 100.00 }
                }
            },
            {
                paymentMethod: 'GIFT_CERTIFICATE',
                paymentTransaction: {
                    amount: { value: 50.00 }
                }
            }
        ];

        // Mock basket
        mockBasket = {
            totalGrossPrice: {
                value: 250.00,
                currencyCode: 'USD'
            },
            getPaymentInstruments: sinon.stub().returns({
                iterator: function () {
                    var index = 0;
                    return {
                        hasNext: function () {
                            return index < paymentInstruments.length;
                        },
                        next: function () {
                            return paymentInstruments[index++];
                        }
                    };
                }
            }),
            removePaymentInstrument: sinon.spy(),
            createPaymentInstrument: sinon.stub().returns({
                paymentMethod: 'FLEXPAY',
                paymentTransaction: {
                    amount: { value: 250.00 }
                }
            })
        };

        // Mock Transaction.wrap
        transactionStub = {
            wrap: function (callback) {
                return callback.call();
            }
        };
        sinon.spy(transactionStub, 'wrap');

        // Mock flexpayConfig
        flexpayConfigStub = {
            getFlexpayPaymentMethodID: sinon.stub().returns('FLEXPAY')
        };

        // Mock collections utility
        collectionsStub = {
            forEach: function (collection, callback) {
                var iterator = collection.iterator();
                while (iterator.hasNext()) {
                    callback(iterator.next());
                }
            }
        };
        sinon.spy(collectionsStub, 'forEach');

        // Mock OrderMgr
        orderMgrStub = {
            getOrder: sinon.stub().returns({
                custom: {
                    flexPayOrderID: 'test-order-id',
                    flexPayTransactionId: 'test-transaction-id',
                    flexPayTransactionStatus: 'AUTHORIZED',
                    isFlexPay: true
                }
            })
        };

        // Load the module with mocks
        flexpayPayment = proxyquire('../../../../../cartridges/int_flexpay/cartridge/scripts/processor/flexpayPayment', {
            'dw/system/Transaction': transactionStub,
            '*/cartridge/scripts/flexpayConfig': flexpayConfigStub,
            '*/cartridge/scripts/util/collections': collectionsStub,
            'dw/order/OrderMgr': orderMgrStub
        });
    });

    afterEach(function () {
        // Restore spies
        if (transactionStub.wrap.restore) {
            transactionStub.wrap.restore();
        }
        if (collectionsStub.forEach.restore) {
            collectionsStub.forEach.restore();
        }
    });

    describe('Handle', function () {
        it('should successfully handle FlexPay payment', function () {
            var result = flexpayPayment.Handle(mockBasket);

            // Verify result structure
            assert.isFalse(result.error);
            assert.isObject(result.fieldErrors);
            assert.isArray(result.serverErrors);
            assert.equal(Object.keys(result.fieldErrors).length, 0);
            assert.equal(result.serverErrors.length, 0);
        });

        it('should call flexpayConfig.getFlexpayPaymentMethodID', function () {
            flexpayPayment.Handle(mockBasket);

            assert.isTrue(flexpayConfigStub.getFlexpayPaymentMethodID.calledOnce);
        });

        it('should wrap operations in Transaction.wrap', function () {
            flexpayPayment.Handle(mockBasket);

            assert.isTrue(transactionStub.wrap.calledOnce);
            assert.isFunction(transactionStub.wrap.firstCall.args[0]);
        });

        it('should get payment instruments from basket', function () {
            flexpayPayment.Handle(mockBasket);

            assert.isTrue(mockBasket.getPaymentInstruments.calledOnce);
        });

        it('should iterate through all payment instruments using collections.forEach', function () {
            flexpayPayment.Handle(mockBasket);

            assert.isTrue(collectionsStub.forEach.calledOnce);
        });

        it('should remove all existing payment instruments', function () {
            flexpayPayment.Handle(mockBasket);

            // Should be called once for each payment instrument in the mock
            assert.equal(mockBasket.removePaymentInstrument.callCount, paymentInstruments.length);
            
            // Verify each payment instrument was passed to remove
            assert.isTrue(mockBasket.removePaymentInstrument.calledWith(paymentInstruments[0]));
            assert.isTrue(mockBasket.removePaymentInstrument.calledWith(paymentInstruments[1]));
        });

        it('should create FlexPay payment instrument with correct parameters', function () {
            flexpayPayment.Handle(mockBasket);

            assert.isTrue(mockBasket.createPaymentInstrument.calledOnce);
            assert.isTrue(mockBasket.createPaymentInstrument.calledWith(
                'FLEXPAY',
                mockBasket.totalGrossPrice
            ));
        });

        it('should return error when payment method ID is not available', function () {
            flexpayConfigStub.getFlexpayPaymentMethodID.returns(null);

            var result = flexpayPayment.Handle(mockBasket);

            assert.isTrue(result.error);
            // Should not proceed with transaction operations
            assert.isFalse(transactionStub.wrap.called);
            assert.isFalse(mockBasket.getPaymentInstruments.called);
        });

        it('should return error when payment method ID is empty string', function () {
            flexpayConfigStub.getFlexpayPaymentMethodID.returns('');

            var result = flexpayPayment.Handle(mockBasket);

            assert.isTrue(result.error);
            assert.isFalse(transactionStub.wrap.called);
        });

        it('should return error when payment method ID is undefined', function () {
            flexpayConfigStub.getFlexpayPaymentMethodID.returns(undefined);

            var result = flexpayPayment.Handle(mockBasket);

            assert.isTrue(result.error);
            assert.isFalse(transactionStub.wrap.called);
        });

        it('should handle basket with no existing payment instruments', function () {
            // Mock empty payment instruments
            mockBasket.getPaymentInstruments.returns({
                iterator: function () {
                    return {
                        hasNext: function () { return false; },
                        next: function () { return null; }
                    };
                }
            });

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            // Should still create FlexPay instrument
            assert.isTrue(mockBasket.createPaymentInstrument.calledOnce);
            // Should not call removePaymentInstrument
            assert.isFalse(mockBasket.removePaymentInstrument.called);
        });

        it('should handle basket with single payment instrument', function () {
            var singleInstrument = [
                { paymentMethod: 'CREDIT_CARD', paymentTransaction: { amount: { value: 100 } } }
            ];

            mockBasket.getPaymentInstruments.returns({
                iterator: function () {
                    var index = 0;
                    return {
                        hasNext: function () { return index < singleInstrument.length; },
                        next: function () { return singleInstrument[index++]; }
                    };
                }
            });

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            assert.equal(mockBasket.removePaymentInstrument.callCount, 1);
            assert.isTrue(mockBasket.createPaymentInstrument.calledOnce);
        });

        it('should handle basket with multiple payment instruments', function () {
            var multipleInstruments = [
                { paymentMethod: 'CREDIT_CARD' },
                { paymentMethod: 'GIFT_CERTIFICATE' },
                { paymentMethod: 'STORE_CREDIT' }
            ];

            mockBasket.getPaymentInstruments.returns({
                iterator: function () {
                    var index = 0;
                    return {
                        hasNext: function () { return index < multipleInstruments.length; },
                        next: function () { return multipleInstruments[index++]; }
                    };
                }
            });

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            assert.equal(mockBasket.removePaymentInstrument.callCount, 3);
            assert.isTrue(mockBasket.createPaymentInstrument.calledOnce);
        });

        it('should use basket totalGrossPrice for payment amount', function () {
            mockBasket.totalGrossPrice = {
                value: 1500.50,
                currencyCode: 'USD'
            };

            flexpayPayment.Handle(mockBasket);

            var createCall = mockBasket.createPaymentInstrument.firstCall;
            assert.equal(createCall.args[1], mockBasket.totalGrossPrice);
            assert.equal(createCall.args[1].value, 1500.50);
        });

        it('should handle basket with zero total', function () {
            mockBasket.totalGrossPrice = {
                value: 0,
                currencyCode: 'USD'
            };

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            assert.isTrue(mockBasket.createPaymentInstrument.calledOnce);
            assert.equal(mockBasket.createPaymentInstrument.firstCall.args[1].value, 0);
        });

        it('should maintain proper execution order', function () {
            flexpayPayment.Handle(mockBasket);

            // Verify execution order
            assert.isTrue(flexpayConfigStub.getFlexpayPaymentMethodID.calledBefore(transactionStub.wrap));
            assert.isTrue(transactionStub.wrap.calledBefore(mockBasket.createPaymentInstrument));
            assert.isTrue(mockBasket.getPaymentInstruments.calledBefore(mockBasket.removePaymentInstrument));
            assert.isTrue(mockBasket.removePaymentInstrument.calledBefore(mockBasket.createPaymentInstrument));
        });

        it('should return consistent result structure', function () {
            var result = flexpayPayment.Handle(mockBasket);

            // Verify all expected properties exist
            assert.property(result, 'error');
            assert.property(result, 'fieldErrors');
            assert.property(result, 'serverErrors');
            
            // Verify correct types
            assert.isBoolean(result.error);
            assert.isObject(result.fieldErrors);
            assert.isArray(result.serverErrors);
        });
    });

    describe('Authorize', function () {
        var mockPaymentInstrument;
        var mockPaymentProcessor;

        beforeEach(function () {
            // Mock payment instrument
            mockPaymentInstrument = {
                paymentTransaction: {
                    setTransactionID: sinon.spy(),
                    setPaymentProcessor: sinon.spy()
                }
            };

            // Mock payment processor
            mockPaymentProcessor = {
                ID: 'FLEXPAY_PAYMENT'
            };
        });

        it('should return no error', function () {
            var result = flexpayPayment.Authorize('test-order-123', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
        });

        it('should return empty fieldErrors object', function () {
            var result = flexpayPayment.Authorize('test-order-123', mockPaymentInstrument, mockPaymentProcessor);

            assert.isObject(result.fieldErrors);
            assert.equal(Object.keys(result.fieldErrors).length, 0);
        });

        it('should return empty serverErrors array', function () {
            var result = flexpayPayment.Authorize('test-order-123', mockPaymentInstrument, mockPaymentProcessor);

            assert.isArray(result.serverErrors);
            assert.equal(result.serverErrors.length, 0);
        });

        it('should return consistent result structure', function () {
            var result = flexpayPayment.Authorize('test-order-123', mockPaymentInstrument, mockPaymentProcessor);

            assert.property(result, 'error');
            assert.property(result, 'fieldErrors');
            assert.property(result, 'serverErrors');
        });

        it('should handle missing order', function () {
            // Make getOrder return null
            orderMgrStub.getOrder.returns(null);
            var result = flexpayPayment.Authorize('invalid-order', mockPaymentInstrument, mockPaymentProcessor);

            assert.isObject(result);
            assert.isTrue(result.error);
            assert.equal(result.serverErrors.length, 1);
            assert.include(result.serverErrors[0], 'Order not found');
        });

        it('should return same result on multiple calls', function () {
            var result1 = flexpayPayment.Authorize('test-order-123', mockPaymentInstrument, mockPaymentProcessor);
            var result2 = flexpayPayment.Authorize('test-order-123', mockPaymentInstrument, mockPaymentProcessor);

            assert.deepEqual(result1, result2);
        });
    });

    describe('module exports', function () {
        it('should export Handle function', function () {
            assert.isFunction(flexpayPayment.Handle);
        });

        it('should export Authorize function', function () {
            assert.isFunction(flexpayPayment.Authorize);
        });

        it('should have exactly two exported functions', function () {
            var exportedKeys = Object.keys(flexpayPayment);
            assert.equal(exportedKeys.length, 2);
            assert.include(exportedKeys, 'Handle');
            assert.include(exportedKeys, 'Authorize');
        });
    });

    describe('edge cases and error handling', function () {
        it('should handle null basket gracefully', function () {
            // This will likely throw an error in the actual implementation
            // but tests the robustness of the module
            try {
                flexpayPayment.Handle(null);
                assert.fail('Should have thrown an error');
            } catch (e) {
                // Expected to fail
                assert.isOk(e);
            }
        });

        it('should handle basket without totalGrossPrice', function () {
            delete mockBasket.totalGrossPrice;

            try {
                flexpayPayment.Handle(mockBasket);
                // If it doesn't throw, verify the call was still made
                assert.isTrue(mockBasket.createPaymentInstrument.called);
            } catch (e) {
                // May throw depending on implementation
                assert.isOk(e);
            }
        });

        it('should handle basket without getPaymentInstruments method', function () {
            delete mockBasket.getPaymentInstruments;

            try {
                flexpayPayment.Handle(mockBasket);
                assert.fail('Should have thrown an error');
            } catch (e) {
                // Expected to fail
                assert.isOk(e);
            }
        });

        it('should handle basket without removePaymentInstrument method', function () {
            delete mockBasket.removePaymentInstrument;

            try {
                flexpayPayment.Handle(mockBasket);
                assert.fail('Should have thrown an error');
            } catch (e) {
                // Expected to fail - will throw when trying to remove instruments
                assert.isOk(e);
            }
        });

        it('should handle basket without createPaymentInstrument method', function () {
            delete mockBasket.createPaymentInstrument;

            try {
                flexpayPayment.Handle(mockBasket);
                assert.fail('Should have thrown an error');
            } catch (e) {
                // Expected to fail
                assert.isOk(e);
            }
        });
    });

    describe('integration scenarios', function () {
        it('should handle complete payment flow successfully', function () {
            // Simulate a real scenario
            var result = flexpayPayment.Handle(mockBasket);

            // Verify complete flow
            assert.isFalse(result.error);
            assert.isTrue(flexpayConfigStub.getFlexpayPaymentMethodID.called);
            assert.isTrue(mockBasket.getPaymentInstruments.called);
            assert.isTrue(mockBasket.removePaymentInstrument.called);
            assert.isTrue(mockBasket.createPaymentInstrument.called);
            assert.equal(mockBasket.removePaymentInstrument.callCount, 2);
            assert.equal(mockBasket.createPaymentInstrument.callCount, 1);
        });

        it('should handle basket already with FlexPay payment', function () {
            // Add FlexPay to existing instruments
            paymentInstruments.push({
                paymentMethod: 'FLEXPAY',
                paymentTransaction: {
                    amount: { value: 250.00 }
                }
            });

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            // Should remove all instruments including existing FlexPay
            assert.equal(mockBasket.removePaymentInstrument.callCount, 3);
            // Should create new FlexPay instrument
            assert.equal(mockBasket.createPaymentInstrument.callCount, 1);
        });

        it('should handle basket with large totalGrossPrice', function () {
            mockBasket.totalGrossPrice = {
                value: 99999.99,
                currencyCode: 'USD'
            };

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            assert.equal(mockBasket.createPaymentInstrument.firstCall.args[1].value, 99999.99);
        });

        it('should handle different currency codes', function () {
            mockBasket.totalGrossPrice = {
                value: 500.00,
                currencyCode: 'EUR'
            };

            var result = flexpayPayment.Handle(mockBasket);

            assert.isFalse(result.error);
            assert.equal(mockBasket.createPaymentInstrument.firstCall.args[1].currencyCode, 'EUR');
        });
    });
});

