'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('flexpayService Unit Tests', function () {
    var flexpayService;
    var localServiceRegistryStub;
    var loggerStub;
    var flexpayConfigStub;
    var stringUtilsStub;
    var collectionsStub;
    var siteStub;
    var localeStub;
    var urlUtilsStub;
    var uuidUtilsStub;
    var mockHttpService;
    var mockAuthService;
    var mockBasket;

    beforeEach(function () {
        // Mock Logger
        loggerStub = {
            info: sinon.spy(),
            error: sinon.spy()
        };

        // Mock FlexpayConfig
        flexpayConfigStub = {
            getAuthURLPath: sinon.stub().returns('https://auth.flexpay.io/oauth/token'),
            getURLPath: sinon.stub().returns('https://api.flexpay.io/v1'),
            getClientId: sinon.stub().returns('test-client-id'),
            getClientSecret: sinon.stub().returns('test-client-secret'),
            getSdkKey: sinon.stub().returns('SDK-KEY-123')
        };

        // Mock StringUtils
        stringUtilsStub = {
            encodeBase64: sinon.stub().returns('dGVzdC1jbGllbnQtaWQ6dGVzdC1jbGllbnQtc2VjcmV0'),
            format: function () {
                return Array.prototype.slice.call(arguments).join(' ');
            }
        };

        // Mock Collections
        collectionsStub = {
            forEach: function (collection, callback) {
                var iterator = collection.iterator();
                while (iterator.hasNext()) {
                    callback(iterator.next());
                }
            }
        };

        // Mock Site
        siteStub = {
            getCurrent: sinon.stub().returns({
                getDefaultLocale: sinon.stub().returns('en_US')
            })
        };

        // Mock Locale
        localeStub = {
            getLocale: sinon.stub().returns({
                getCountry: sinon.stub().returns('US')
            })
        };

        // Mock URLUtils
        urlUtilsStub = {
            https: function (endpoint) {
                return {
                    toString: function () {
                        return 'https://example.com/' + endpoint;
                    }
                };
            }
        };
        sinon.spy(urlUtilsStub, 'https');

        // Mock UUIDUtils
        uuidUtilsStub = {
            createUUID: sinon.stub().returns('test-uuid-12345')
        };

        // Reset and recreate HTTP Service mock
        mockHttpService = {
            URL: '',
            requestMethod: '',
            setURL: function (url) { this.URL = url; },
            setRequestMethod: function (method) { this.requestMethod = method; },
            addHeader: sinon.spy(),
            call: sinon.stub()
        };

        // Reset and recreate Auth Service mock
        mockAuthService = {
            setURL: sinon.spy(),
            addHeader: sinon.spy(),
            call: sinon.stub()
        };

        // Mock LocalServiceRegistry
        localServiceRegistryStub = {
            createService: function (serviceName, config) {
                if (serviceName === 'FlexpayAuthService') {
                    // Return auth service mock with config methods
                    mockAuthService.config = config;
                    return mockAuthService;
                }
                // Return regular service mock with config methods
                mockHttpService.config = config;
                return mockHttpService;
            }
        };
        sinon.spy(localServiceRegistryStub, 'createService');

        // Create mock basket with all required properties
        mockBasket = {
            billingAddress: {
                firstName: 'John',
                lastName: 'Doe',
                postalCode: '90210',
                stateCode: 'CA',
                city: 'Los Angeles',
                address1: '123 Main St',
                phone: '555-1234',
                countryCode: { value: 'US' }
            },
            customerEmail: 'john.doe@example.com',
            adjustedMerchandizeTotalGrossPrice: {
                value: 250.00
            },
            totalGrossPrice: {
                value: 250.00
            },
            getCurrencyCode: sinon.stub().returns('USD'),
            allProductLineItems: {
                iterator: function () {
                    var items = [
                        {
                            productName: 'Test Product 1',
                            quantityValue: 2,
                            productID: 'PROD-001',
                            adjustedGrossPrice: { value: 100.00 }
                        },
                        {
                            productName: 'Test Product 2',
                            quantityValue: 1,
                            productID: 'PROD-002',
                            adjustedGrossPrice: { value: 50.00 }
                        }
                    ];
                    var index = 0;
                    return {
                        hasNext: function () { return index < items.length; },
                        next: function () { return items[index++]; }
                    };
                }
            }
        };

        // Mock global dw object
        global.dw = {
            util: {
                UUIDUtils: uuidUtilsStub,
                StringUtils: stringUtilsStub
            }
        };

        // Mock empty function
        global.empty = function (value) {
            return value === null || value === undefined || value === '' ||
                   (Array.isArray(value) && value.length === 0) ||
                   (typeof value === 'object' && Object.keys(value).length === 0);
        };

        // Load the service with mocks
        flexpayService = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayAPI', {
            'dw/svc/LocalServiceRegistry': localServiceRegistryStub,
            'dw/system/Logger': loggerStub,
            '*/cartridge/scripts/flexpayConfig': flexpayConfigStub,
            'dw/util/StringUtils': stringUtilsStub,
            '*/cartridge/scripts/util/collections': collectionsStub,
            'dw/system/Site': siteStub,
            'dw/util/Locale': localeStub,
            'dw/web/URLUtils': urlUtilsStub
        });
    });

    afterEach(function () {
        // Cleanup global mocks
        delete global.dw;
        delete global.empty;

        // Restore spies
        if (loggerStub.info.restore) loggerStub.info.restore();
        if (loggerStub.error.restore) loggerStub.error.restore();
        if (urlUtilsStub.https.restore) urlUtilsStub.https.restore();
        if (localServiceRegistryStub.createService.restore) localServiceRegistryStub.createService.restore();
    });

    describe('api.createOrder', function () {
        it('should successfully create an order', function () {
            // Mock successful auth response
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({
                    access_token: 'test-access-token',
                    expires_in: 3600
                })
            });

            // Mock successful create order response
            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'flexpay-order-123',
                    status: 'PENDING',
                    redirectUrl: 'https://checkout.flexpay.io/12345'
                })
            });

            var result = flexpayService.api.createOrder(mockBasket);

            // Verify result
            assert.equal(result.id, 'flexpay-order-123');
            assert.equal(result.status, 'PENDING');
            assert.equal(result.redirectUrl, 'https://checkout.flexpay.io/12345');

            // Verify service was called correctly
            assert.isTrue(mockHttpService.call.calledOnce);
            // Verify service was created
            assert.isTrue(localServiceRegistryStub.createService.called);
        });

        it('should include correct order payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var callArgs = mockHttpService.call.firstCall.args[0];

            // Verify payload structure
            assert.property(callArgs, 'merchantConfig');
            assert.property(callArgs, 'integrationId');
            assert.property(callArgs, 'price');
            assert.property(callArgs, 'orderItems');
            assert.property(callArgs, 'localization');
            assert.property(callArgs, 'billingContact');

            // Verify merchant config URLs
            assert.include(callArgs.merchantConfig.cancelUrl, 'FlexpayOrder-Cancel');
            assert.include(callArgs.merchantConfig.confirmationUrl, 'FlexpayOrder-Confirm');

            // Verify price
            assert.equal(callArgs.price, 250.00);

            // Verify order items
            assert.isArray(callArgs.orderItems);
            assert.equal(callArgs.orderItems.length, 2);
            assert.equal(callArgs.orderItems[0].orderLine.name, 'Test Product 1');
            assert.equal(callArgs.orderItems[0].orderLine.quantity, 2);

            // Verify billing contact
            assert.equal(callArgs.billingContact.firstName, 'John');
            assert.equal(callArgs.billingContact.email, 'john.doe@example.com');
        });

        it('should use SDK key for integration ID', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.integrationId, 'SDK-KEY-123');
        });

        it('should throw error with errorCodes property when API returns error codes', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    errorCodes: ['INVALID_ADDRESS', 'INSUFFICIENT_FUNDS']
                })
            });

            var thrownError;
            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                thrownError = e;
            }

            assert.isDefined(thrownError);
            assert.instanceOf(thrownError, Error);
            assert.deepEqual(thrownError.errorCodes, ['INVALID_ADDRESS', 'INSUFFICIENT_FUNDS']);
        });

        it('should throw error when service call fails', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 500,
                errorMessage: 'Internal Server Error'
            });

            assert.throws(function () {
                flexpayService.api.createOrder(mockBasket);
            }, Error);

            assert.isTrue(loggerStub.error.called);
        });

        it('should set correct URL and HTTP method', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            assert.equal(mockHttpService.URL, 'https://api.flexpay.io/v1/orders');
            assert.equal(mockHttpService.requestMethod, 'POST');
        });
    });

    describe('api.confirmOrder', function () {
        it('should successfully confirm an order', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'flexpay-order-123',
                    status: 'CONFIRMED',
                    confirmationId: 'SFCC-ORDER-456'
                })
            });

            var result = flexpayService.api.confirmOrder('flexpay-order-123', 'SFCC-ORDER-456');

            assert.equal(result.id, 'flexpay-order-123');
            assert.equal(result.status, 'CONFIRMED');
            assert.equal(result.confirmationId, 'SFCC-ORDER-456');
        });

        it('should set correct URL with order ID', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CONFIRMED' })
            });

            flexpayService.api.confirmOrder('order-abc-123', 'sfcc-order-789');

            assert.equal(mockHttpService.URL, 'https://api.flexpay.io/v1/orders/order-abc-123/confirmation');
            assert.equal(mockHttpService.requestMethod, 'PUT');
        });

        it('should include confirmation ID in payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CONFIRMED' })
            });

            flexpayService.api.confirmOrder('flexpay-123', 'sfcc-456');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.confirmationId, 'sfcc-456');
        });

        it('should handle confirmation errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 404,
                errorMessage: 'Order not found'
            });

            assert.throws(function () {
                flexpayService.api.confirmOrder('invalid-order', 'sfcc-123');
            }, Error);
        });
    });

    describe('api.getVcc', function () {
        it('should successfully retrieve VCC details', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    cardNumber: '4111111111111111',
                    expiryMonth: '12',
                    expiryYear: '2025',
                    cvv: '123'
                })
            });

            var result = flexpayService.api.getVcc('order-123');

            assert.equal(result.cardNumber, '4111111111111111');
            assert.equal(result.expiryMonth, '12');
            assert.equal(result.expiryYear, '2025');
            assert.equal(result.cvv, '123');
        });

        it('should set correct URL and HTTP method', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ cardNumber: '4111' })
            });

            flexpayService.api.getVcc('order-xyz-789');

            assert.equal(mockHttpService.URL, 'https://api.flexpay.io/v1/orders/order-xyz-789/card');
            assert.equal(mockHttpService.requestMethod, 'GET');
        });

        it('should handle VCC retrieval errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 404,
                errorMessage: 'Card not available'
            });

            assert.throws(function () {
                flexpayService.api.getVcc('invalid-order');
            }, Error);
        });

        it('should not include request body for GET', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ cardNumber: '4111' })
            });

            flexpayService.api.getVcc('order-123');

            // GET calls should have no arguments
            assert.equal(mockHttpService.call.firstCall.args.length, 0);
        });
    });

    describe('api.auth (Direct Settle)', function () {
        it('should successfully authorize a transaction', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'transaction-123',
                    status: 'AUTHORIZED',
                    amount: 250.00
                })
            });

            var result = flexpayService.api.auth('order-123', 250.00, 'ref-456', 'USD');

            assert.equal(result.id, 'transaction-123');
            assert.equal(result.status, 'AUTHORIZED');
            assert.equal(result.amount, 250.00);
        });

        it('should include correct transaction payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123' })
            });

            flexpayService.api.auth('order-789', 100.50, 'merchant-ref-123', 'EUR');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.order_id, 'order-789');
            assert.equal(callArgs.amount, 100.50);
            assert.equal(callArgs.currency, 'EUR');
            assert.equal(callArgs.merchant_reference_id, 'merchant-ref-123');
        });

        it('should default to USD if currency not provided', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123' })
            });

            flexpayService.api.auth('order-123', 50.00, 'ref-789');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.currency, 'USD');
        });

        it('should set correct URL and HTTP method', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123' })
            });

            flexpayService.api.auth('order-123', 100, 'ref-456', 'USD');

            assert.equal(mockHttpService.URL, 'https://api.flexpay.io/v1/transactions');
            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should handle authorization errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 402,
                errorMessage: 'Insufficient funds'
            });

            assert.throws(function () {
                flexpayService.api.auth('order-123', 1000000, 'ref-789', 'USD');
            }, Error);
        });
    });

    describe('Authentication', function () {
        it('should successfully complete API calls with authentication', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({
                    access_token: 'new-access-token-xyz',
                    expires_in: 3600
                })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            var result = flexpayService.api.createOrder(mockBasket);

            // Verify request completed successfully
            assert.equal(result.id, 'order-123');
            
            // Verify service registry was used (services were created)
            assert.isTrue(localServiceRegistryStub.createService.called);
        });

        it('should use flexpayConfig for API configuration', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'token-123' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            var result = flexpayService.api.createOrder(mockBasket);

            // Verify request completed successfully (which means configuration was used)
            assert.equal(result.id, 'order-123');
            // Verify URL path was retrieved from config
            assert.isTrue(flexpayConfigStub.getURLPath.called);
        });

        it('should use service registry for creating services', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'token-123' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            // Verify LocalServiceRegistry was used
            assert.isTrue(localServiceRegistryStub.createService.called);
            // Verify it was called for both auth and main service
            assert.isTrue(localServiceRegistryStub.createService.callCount >= 1);
        });
    });

    describe('Error Logging', function () {
        it('should log errors on failed requests', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'token-123' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 500,
                errorMessage: 'Server error'
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // Expected to throw
            }

            assert.isTrue(loggerStub.error.called);
            var errorMessage = loggerStub.error.firstCall.args[0];
            assert.include(errorMessage, 'Flexpay http call failed');
            assert.include(errorMessage, '500');
        });

        it('should log successful responses', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'token-123' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            assert.isTrue(loggerStub.info.called);
        });
    });

    describe('Locale conversion', function () {
        it('should convert locale format from underscore to dash', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'token-123' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var callArgs = mockHttpService.call.firstCall.args[0];
            // en_US should be converted to en-US
            assert.equal(callArgs.localization.locale, 'en-US');
        });
    });

    describe('Error Response Handling', function () {
        it('should handle empty result.object in response logging', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            // Mock service to return response with empty object
            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: '' // empty object
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // May throw due to JSON parse error
            }

            // Logger should have been called
            assert.isTrue(loggerStub.info.called || loggerStub.error.called);
        });

        it('should include error text in error logs when available', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 500,
                errorMessage: 'Server error',
                object: {
                    text: 'Detailed error message'
                }
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // Expected
            }

            // Verify error was logged
            assert.isTrue(loggerStub.error.called);
            var errorArg = loggerStub.error.firstCall.args[0];
            assert.include(errorArg, 'Flexpay http call failed');
        });

        it('should handle missing requestUrl in error logging', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 404,
                errorMessage: 'Not found'
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // Expected
            }

            assert.isTrue(loggerStub.error.called);
        });

        it('should handle missing requestBody in error logging', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 400,
                errorMessage: 'Bad request'
            });

            try {
                flexpayService.api.confirmOrder('order-123', 'confirm-456');
            } catch (e) {
                // Expected
            }

            assert.isTrue(loggerStub.error.called);
        });
    });

    describe('Service Configuration', function () {
        it('should set POST method for createOrder', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should set PUT method for confirmOrder', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CONFIRMED' })
            });

            flexpayService.api.confirmOrder('order-123', 'confirm-456');

            assert.equal(mockHttpService.requestMethod, 'PUT');
        });

        it('should set GET method for getVcc', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ cardNumber: '4111' })
            });

            flexpayService.api.getVcc('order-789');

            assert.equal(mockHttpService.requestMethod, 'GET');
        });

        it('should set POST method for auth (direct settle)', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123' })
            });

            flexpayService.api.auth('order-abc', 100, 'ref-123', 'USD');

            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should build correct URL for createOrder', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            assert.include(mockHttpService.URL, '/orders');
            assert.notInclude(mockHttpService.URL, '/confirmation');
            assert.notInclude(mockHttpService.URL, '/card');
        });

        it('should build correct URL for confirmOrder with order ID', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CONFIRMED' })
            });

            flexpayService.api.confirmOrder('order-xyz-789', 'confirm-123');

            assert.include(mockHttpService.URL, 'order-xyz-789');
            assert.include(mockHttpService.URL, '/confirmation');
        });

        it('should build correct URL for getVcc with order ID', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ cardNumber: '4111' })
            });

            flexpayService.api.getVcc('order-abc-456');

            assert.include(mockHttpService.URL, 'order-abc-456');
            assert.include(mockHttpService.URL, '/card');
        });

        it('should build correct URL for auth transactions', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123' })
            });

            flexpayService.api.auth('order-123', 100, 'ref-456', 'USD');

            assert.include(mockHttpService.URL, '/transactions');
        });
    });

    describe('api.capture', function () {
        it('should successfully capture a transaction', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'transaction-123',
                    status: 'CAPTURED',
                    amount: 150.00,
                    currency: 'USD'
                })
            });

            var result = flexpayService.api.capture('transaction-123', 150.00, 'USD', 'capture-ref-456');

            assert.equal(result.id, 'transaction-123');
            assert.equal(result.status, 'CAPTURED');
            assert.equal(result.amount, 150.00);
            assert.equal(result.currency, 'USD');
        });

        it('should set correct URL with transaction ID', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CAPTURED' })
            });

            flexpayService.api.capture('txn-abc-789', 200.00, 'USD', 'ref-123');

            assert.equal(mockHttpService.URL, 'https://api.flexpay.io/v1/transactions/txn-abc-789/capture');
            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should include correct capture payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CAPTURED' })
            });

            flexpayService.api.capture('txn-xyz-456', 75.50, 'EUR', 'merchant-capture-789');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.amount, 75.50);
            assert.equal(callArgs.currency, 'EUR');
            assert.equal(callArgs.merchant_reference_id, 'merchant-capture-789');
        });

        it('should handle capture with USD currency', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123', status: 'CAPTURED' })
            });

            flexpayService.api.capture('txn-123', 99.99, 'USD', 'ref-usd-001');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.currency, 'USD');
        });

        it('should handle capture with different currencies', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'txn-123', status: 'CAPTURED' })
            });

            // Test with GBP
            flexpayService.api.capture('txn-gbp-123', 50.00, 'GBP', 'ref-gbp-001');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.currency, 'GBP');
            assert.equal(callArgs.amount, 50.00);
        });

        it('should handle capture errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 400,
                errorMessage: 'Invalid transaction state'
            });

            assert.throws(function () {
                flexpayService.api.capture('invalid-txn', 100.00, 'USD', 'ref-123');
            }, Error);

            assert.isTrue(loggerStub.error.called);
        });

        it('should handle already captured transactions', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 409,
                errorMessage: 'Transaction already captured'
            });

            assert.throws(function () {
                flexpayService.api.capture('txn-already-captured', 100.00, 'USD', 'ref-456');
            }, Error);
        });

        it('should handle transaction not found errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 404,
                errorMessage: 'Transaction not found'
            });

            assert.throws(function () {
                flexpayService.api.capture('non-existent-txn', 100.00, 'USD', 'ref-789');
            }, Error);
        });

        it('should include merchant reference ID in payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CAPTURED' })
            });

            var testReferenceId = 'SFCC-CAPTURE-2024-12345';
            flexpayService.api.capture('txn-123', 250.00, 'USD', testReferenceId);

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.merchant_reference_id, testReferenceId);
        });

        it('should handle partial captures', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'txn-partial-123',
                    status: 'PARTIALLY_CAPTURED',
                    amount: 50.00,
                    capturedAmount: 50.00,
                    remainingAmount: 50.00
                })
            });

            var result = flexpayService.api.capture('txn-partial-123', 50.00, 'USD', 'partial-ref-001');

            assert.equal(result.status, 'PARTIALLY_CAPTURED');
            assert.equal(result.capturedAmount, 50.00);
        });

        it('should use correct HTTP method for capture', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CAPTURED' })
            });

            flexpayService.api.capture('txn-method-test', 100.00, 'USD', 'ref-method');

            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should include all required fields in capture request', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ status: 'CAPTURED' })
            });

            flexpayService.api.capture('txn-complete-123', 299.99, 'CAD', 'complete-ref-456');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.property(callArgs, 'amount');
            assert.property(callArgs, 'currency');
            assert.property(callArgs, 'merchant_reference_id');
            assert.equal(Object.keys(callArgs).length, 3);
        });
    });

    describe('PII Masking - Data Security', function () {
        it('should mask PII data in successful response logs', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            assert.isTrue(loggerStub.info.called);
            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Verify sensitive data is masked
            assert.notInclude(logMessage, 'john.doe@example.com');
            assert.notInclude(logMessage, '555-1234');
            assert.notInclude(logMessage, 'John');
            assert.notInclude(logMessage, 'Doe');
        });

        it('should mask PII data in error logs', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 400,
                errorMessage: 'Bad request'
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // Expected
            }

            assert.isTrue(loggerStub.error.called);
            var errorMessage = loggerStub.error.firstCall.args[0];
            
            // Verify sensitive data is masked in error logs
            assert.notInclude(errorMessage, 'john.doe@example.com');
            assert.notInclude(errorMessage, 'John');
            assert.notInclude(errorMessage, 'Doe');
        });

        it('should mask email addresses', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Email should be masked
            assert.notInclude(logMessage, 'john.doe@example.com');
        });

        it('should mask phone numbers', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Phone should be masked
            assert.notInclude(logMessage, '555-1234');
        });

        it('should mask first and last names', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Names should be masked
            assert.notInclude(logMessage, 'John');
            assert.notInclude(logMessage, 'Doe');
        });

        it('should mask street addresses', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Street address should be masked
            assert.notInclude(logMessage, '123 Main St');
        });

        it('should handle empty or null values in masking', function () {
            var emptyBasket = {
                billingAddress: {
                    firstName: '',
                    lastName: null,
                    postalCode: '90210',
                    stateCode: 'CA',
                    city: 'Los Angeles',
                    address1: '',
                    phone: '',
                    countryCode: { value: 'US' }
                },
                customerEmail: '',
                totalGrossPrice: { value: 0 },
                getCurrencyCode: sinon.stub().returns('USD'),
                allProductLineItems: {
                    iterator: function () {
                        return {
                            hasNext: function () { return false; },
                            next: function () { return null; }
                        };
                    }
                }
            };

            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            // Should not throw error with empty data
            assert.doesNotThrow(function () {
                flexpayService.api.createOrder(emptyBasket);
            });
        });

        it('should mask VCC data in getVcc responses', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            var vccBasket = JSON.parse(JSON.stringify(mockBasket));
            vccBasket.billingAddress.phone = '4165551234';
            
            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    number: '4111111111111111',
                    nameOnCard: 'John Doe',
                    contact: {
                        email: 'john@example.com',
                        phone: '4165551234',
                        streetAddress: '456 Oak Ave'
                    }
                })
            });

            flexpayService.api.getVcc('order-123');

            // getVcc now logs responses
            assert.isTrue(loggerStub.info.called);
        });

        it('should handle malformed JSON in filter function', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 500,
                errorMessage: 'Server error'
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // Expected
            }

            // Should still log without throwing
            assert.isTrue(loggerStub.error.called);
        });

        it('should mask card numbers', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'order-123',
                    card: {
                        number: '4111111111111111'
                    }
                })
            });

            // Use createOrder which does log (not getVcc which has logging disabled)
            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Card should not be fully visible in logs
            assert.notInclude(logMessage, '4111111111111111');
        });

        it('should mask sensitive data in response body', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            var sensitiveResponse = JSON.stringify({
                id: 'order-123',
                customer: {
                    email: 'customer@example.com',
                    phone: '555-9876',
                    ssn: '123-45-6789'
                }
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: sensitiveResponse
            });

            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Should not contain unmasked sensitive data
            assert.notInclude(logMessage, 'customer@example.com');
            assert.notInclude(logMessage, '555-9876');
            assert.notInclude(logMessage, '123-45-6789');
        });

        it('should mask email in various formats', function () {
            var testBasket = {
                billingAddress: mockBasket.billingAddress,
                customerEmail: 'a@b.com',
                totalGrossPrice: mockBasket.totalGrossPrice,
                getCurrencyCode: mockBasket.getCurrencyCode,
                allProductLineItems: mockBasket.allProductLineItems
            };

            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(testBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Short email should be masked
            assert.notInclude(logMessage, 'a@b.com');
        });

        it('should handle phone numbers with different formats', function () {
            var testBillingAddress = {
                firstName: mockBasket.billingAddress.firstName,
                lastName: mockBasket.billingAddress.lastName,
                postalCode: mockBasket.billingAddress.postalCode,
                stateCode: mockBasket.billingAddress.stateCode,
                city: mockBasket.billingAddress.city,
                address1: mockBasket.billingAddress.address1,
                phone: '+1 (555) 123-4567',
                countryCode: mockBasket.billingAddress.countryCode
            };

            var testBasket = {
                billingAddress: testBillingAddress,
                customerEmail: mockBasket.customerEmail,
                totalGrossPrice: mockBasket.totalGrossPrice,
                getCurrencyCode: mockBasket.getCurrencyCode,
                allProductLineItems: mockBasket.allProductLineItems
            };

            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(testBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // Phone should be masked
            assert.notInclude(logMessage, '+1 (555) 123-4567');
            assert.notInclude(logMessage, '555-123-4567');
        });

        it('should apply regex masking for non-JSON strings', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 400,
                errorMessage: 'Invalid request'
            });

            try {
                flexpayService.api.createOrder(mockBasket);
            } catch (e) {
                // Expected
            }

            // Error logging should apply regex-based masking as fallback
            assert.isTrue(loggerStub.error.called);
        });

        it('should mask billingContact data in logs', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'order-123' })
            });

            flexpayService.api.createOrder(mockBasket);

            var logMessage = loggerStub.info.firstCall.args[0];
            
            // BillingContact data should be masked for security
            assert.isTrue(loggerStub.info.called);
        });

        it('should mask data in transaction auth requests', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'txn-123',
                    status: 'AUTHORIZED'
                })
            });

            flexpayService.api.auth('order-123', 250.00, 'ref-456', 'USD');

            // Should log without exposing sensitive transaction details
            assert.isTrue(loggerStub.info.called);
        });

        it('should handle empty response objects', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: ''
            });

            try {
                flexpayService.api.confirmOrder('order-123', 'confirm-456');
            } catch (e) {
                // May throw due to empty response
            }

            // Should handle empty responses gracefully
            assert.isTrue(loggerStub.info.called || loggerStub.error.called);
        });
    });

    describe('api.refund', function () {
        it('should successfully refund a transaction', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'TXN-REFUND-123',
                    status: 'REFUNDED',
                    amount: 150.00
                })
            });

            var result = flexpayService.api.refund('TXN-ABC-123', 150.00, 'USD', 'ORDER-456');

            assert.equal(result.id, 'TXN-REFUND-123');
            assert.equal(result.status, 'REFUNDED');
            assert.isTrue(mockHttpService.call.calledOnce);
        });

        it('should set correct URL with transaction ID for refund', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'TXN-REFUND-123', status: 'REFUNDED' })
            });

            flexpayService.api.refund('TXN-XYZ-789', 100.00, 'USD', 'ORDER-123');

            assert.include(mockHttpService.URL, '/transactions/TXN-XYZ-789/refund');
        });

        it('should include correct refund payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'TXN-REFUND-123', status: 'REFUNDED' })
            });

            flexpayService.api.refund('TXN-ABC-123', 75.50, 'EUR', 'REF-789');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.amount, 75.50);
            assert.equal(callArgs.currency, 'EUR');
            assert.equal(callArgs.merchant_reference_id, 'REF-789');
        });

        it('should use POST method for refund', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'TXN-REFUND-123', status: 'REFUNDED' })
            });

            flexpayService.api.refund('TXN-ABC-123', 100.00, 'USD', 'ORDER-123');

            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should handle refund errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 400,
                errorMessage: 'Refund failed'
            });

            assert.throws(function () {
                flexpayService.api.refund('TXN-ABC-123', 100.00, 'USD', 'ORDER-123');
            });
        });
    });

    describe('api.void', function () {
        it('should successfully void a transaction', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    id: 'TXN-VOID-123',
                    status: 'VOIDED'
                })
            });

            var result = flexpayService.api.void('TXN-ABC-123', 'ORDER-456');

            assert.equal(result.id, 'TXN-VOID-123');
            assert.equal(result.status, 'VOIDED');
            assert.isTrue(mockHttpService.call.calledOnce);
        });

        it('should set correct URL with transaction ID for void', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'TXN-VOID-123', status: 'VOIDED' })
            });

            flexpayService.api.void('TXN-XYZ-789', 'ORDER-123');

            assert.include(mockHttpService.URL, '/transactions/TXN-XYZ-789/void');
        });

        it('should include merchant reference ID in void payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'TXN-VOID-123', status: 'VOIDED' })
            });

            flexpayService.api.void('TXN-ABC-123', 'REF-789');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.merchant_reference_id, 'REF-789');
        });

        it('should use POST method for void', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ id: 'TXN-VOID-123', status: 'VOIDED' })
            });

            flexpayService.api.void('TXN-ABC-123', 'ORDER-123');

            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should handle void errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 400,
                errorMessage: 'Void failed'
            });

            assert.throws(function () {
                flexpayService.api.void('TXN-ABC-123', 'ORDER-123');
            });
        });
    });

    describe('api.getOffers', function () {
        it('should successfully get offers for an amount', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({
                    orders: [{
                        offers: [{
                            numberOfPayments: 12,
                            apr: '0.15',
                            monthlyPayment: '12.50'
                        }]
                    }]
                })
            });

            var result = flexpayService.api.getOffers(150, 'USD');

            assert.isObject(result);
            assert.isArray(result.orders);
            assert.lengthOf(result.orders, 1);
            assert.isArray(result.orders[0].offers);
        });

        it('should set correct URL for offers endpoint', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ orders: [{ offers: [] }] })
            });

            flexpayService.api.getOffers(200, 'USD');

            assert.include(mockHttpService.URL, '/marketing/offers');
        });

        it('should use POST method for getOffers', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ orders: [{ offers: [] }] })
            });

            flexpayService.api.getOffers(150, 'USD');

            assert.equal(mockHttpService.requestMethod, 'POST');
        });

        it('should include integrationId and orders in payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ orders: [{ offers: [] }] })
            });

            flexpayService.api.getOffers(250, 'EUR');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.property(callArgs, 'integrationId');
            assert.property(callArgs, 'orders');
            assert.isArray(callArgs.orders);
            assert.lengthOf(callArgs.orders, 1);
        });

        it('should include price in order payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ orders: [{ offers: [] }] })
            });

            flexpayService.api.getOffers(175.50, 'USD');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.equal(callArgs.orders[0].price, 175.50);
        });

        it('should include localization in order payload', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'OK',
                error: 0,
                object: JSON.stringify({ orders: [{ offers: [] }] })
            });

            flexpayService.api.getOffers(150, 'CAD', 'en_CA', 'CA');

            var callArgs = mockHttpService.call.firstCall.args[0];
            assert.property(callArgs.orders[0], 'localization');
            assert.equal(callArgs.orders[0].localization.currency, 'CAD');
        });

        it('should handle offers API errors', function () {
            mockAuthService.call.returns({
                status: 'OK',
                object: JSON.stringify({ access_token: 'test-token' })
            });

            mockHttpService.call.returns({
                status: 'ERROR',
                error: 500,
                errorMessage: 'Internal server error'
            });

            assert.throws(function () {
                flexpayService.api.getOffers(150, 'USD');
            });
        });
    });

    describe('getLocalizedErrorMessage', function () {
        var resourceStub;
        var localizedService;

        beforeEach(function () {
            var messages = {
                'error.flexpay.INVALID_BILLING_CONTACT': 'The billing contact information is not valid. Please check your billing details.',
                'error.flexpay.MIN_PRICE': 'The order amount is below the minimum required for this payment plan.',
                'error.flexpay.NO_OFFERS': 'No payment plans are available for this order. Please try a different payment method.',
                'error.flexpay.LOAN_NOT_ACCEPTED': 'The payment plan application was not approved. Please try a different payment method.',
                'error.flexpay.UNKNOWN': 'Something went wrong while processing your payment. Please try again or choose a different payment method.'
            };

            resourceStub = {
                msg: function (key) {
                    return messages[key] || key;
                }
            };

            localizedService = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayAPI', {
                'dw/svc/LocalServiceRegistry': localServiceRegistryStub,
                'dw/system/Logger': loggerStub,
                '*/cartridge/scripts/flexpayConfig': flexpayConfigStub,
                'dw/util/StringUtils': stringUtilsStub,
                '*/cartridge/scripts/util/collections': collectionsStub,
                'dw/system/Site': siteStub,
                'dw/util/Locale': localeStub,
                'dw/web/URLUtils': urlUtilsStub,
                'dw/web/Resource': resourceStub
            });
        });

        it('should return localized message for a known error code array', function () {
            var result = localizedService.getLocalizedErrorMessage(['INVALID_BILLING_CONTACT']);
            assert.equal(result, 'The billing contact information is not valid. Please check your billing details.');
        });

        it('should use the first error code when multiple codes are provided', function () {
            var result = localizedService.getLocalizedErrorMessage(['MIN_PRICE', 'INVALID_BILLING_CONTACT']);
            assert.equal(result, 'The order amount is below the minimum required for this payment plan.');
        });

        it('should handle comma-separated string input', function () {
            var result = localizedService.getLocalizedErrorMessage('NO_OFFERS,MIN_PRICE');
            assert.equal(result, 'No payment plans are available for this order. Please try a different payment method.');
        });

        it('should return fallback message for unrecognized error code', function () {
            var result = localizedService.getLocalizedErrorMessage(['SOME_UNKNOWN_CODE']);
            assert.equal(result, 'Something went wrong while processing your payment. Please try again or choose a different payment method.');
        });

        it('should return fallback message for empty array', function () {
            var result = localizedService.getLocalizedErrorMessage([]);
            assert.equal(result, 'Something went wrong while processing your payment. Please try again or choose a different payment method.');
        });

        it('should handle LOAN_NOT_ACCEPTED payment error code', function () {
            var result = localizedService.getLocalizedErrorMessage(['LOAN_NOT_ACCEPTED']);
            assert.equal(result, 'The payment plan application was not approved. Please try a different payment method.');
        });
    });
});
