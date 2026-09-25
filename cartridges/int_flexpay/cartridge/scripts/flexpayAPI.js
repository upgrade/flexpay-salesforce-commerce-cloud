'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger'); 
var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
var StringUtils = require('dw/util/StringUtils');

/**
 * Converts locale format from dash to underscore (e.g., en-US to en_US)
 * @param {string} locale - The locale string
 * @returns {string} Converted locale string
 */
function convertLocaleFormat(locale) {
    return locale.replace(/_/, '-');
}

/**
     * Converts a SFCC basket to Flexpay order request payload
     * @param {dw.order.Basket} currentBasket - The current shopping basket
     * @returns {Object} The Flexpay order request payload
     */
function createOrderRequest(currentBasket) {
    var billingAddress = currentBasket.billingAddress;
    var products = currentBasket.allProductLineItems;
    var collections = require('*/cartridge/scripts/util/collections');
    var Site = require('dw/system/Site');
    var Locale = require('dw/util/Locale');
    var URLUtils = require('dw/web/URLUtils');

    var locale = Site.getCurrent().getDefaultLocale();
    var countryCode = Locale.getLocale(locale).getCountry();

    var lineItems = [];
    collections.forEach(products, function (product) {
        lineItems.push({
            orderLine: {
                name: product.productName,
                quantity: product.quantityValue,
                sku: product.productID,
                type: 'DIGITAL',
                unitPrice: product.adjustedGrossPrice.value,
                reference: product.productID
            }
        });
    });
    
    var requestPayload = {
        merchantConfig: {
            cancelUrl: URLUtils.https('FlexpayOrder-Cancel').toString(),
            confirmationUrl: URLUtils.https('FlexpayOrder-Confirm').toString()
        },
        integrationId: flexpayConfig.getSdkKey(), 
        price: currentBasket.totalGrossPrice.value,
        orderItems: lineItems,
        localization: {
            country: countryCode,
            currency: currentBasket.getCurrencyCode(),
            locale: convertLocaleFormat(locale.toString())
        },
        billingContact: {
            firstName: billingAddress.firstName,
            lastName: billingAddress.lastName,
            postalCode: billingAddress.postalCode,
            region: billingAddress.stateCode,
            city: billingAddress.city,
            streetAddress: billingAddress.address1,
            phone: billingAddress.phone,
            email: currentBasket.customerEmail,
            country: billingAddress.countryCode.value
        }
    };
    return requestPayload;
}

/**
 * Gets the access token for the Flexpay service
 * @returns {string} The access token
 */
function getAccessToken() {
    var service = LocalServiceRegistry.createService('FlexpayAuthService', {
        createRequest: function (svc, args) {
            svc.setURL(flexpayConfig.getAuthURLPath());
            svc.addHeader('Content-Type', 'application/json');
            var authString = flexpayConfig.getClientId() + ':' + flexpayConfig.getClientSecret();
            svc.addHeader('Authorization', 'Basic ' + require('dw/util/StringUtils').encodeBase64(authString));
            return JSON.stringify(args);
        },
        parseResponse: function (svc, httpClient) {
            if (httpClient.statusCode === 200 || httpClient.statusCode === 201 || httpClient.statusCode === 202) {
                var parseResponse = httpClient.text;
                Logger.info('Auth response received with status: ' + httpClient.statusCode);
                return parseResponse;
            }
            Logger.error('Error on request processing : ' + httpClient.statusCode);
            return httpClient;
        },
        getRequestLogMessage: function (request) {
            return filterLogString(request);
        },

        getResponseLogMessage: function (response) {
            return filterLogString(response.text);
        }
    });
    var response = service.call();
    var jsonResponse = JSON.parse(response.object);
    return jsonResponse.access_token;
}

/**
 * Common request creator for Flexpay services
 * @param {dw.svc.Service} svc - The service object
 * @param {Object} requestLoad - The request payload
 * @returns {string} JSON stringified request
 */
function createRequest(svc, requestLoad) {
    svc.addHeader('Content-Type', 'application/json');
    svc.addHeader('Authorization', 'Bearer ' + getAccessToken());
    svc.addHeader('Idempotency-Key', dw.util.UUIDUtils.createUUID());
  
    if (!empty(requestLoad)) {
        return JSON.stringify(requestLoad);
    }
    return '';
}

/**
 * Filters log data to mask sensitive PII and payment information
 * @param {string} data - The log data
 * @returns {string} The filtered log data
 */
function filterLogString(data) {
    if (empty(data)) {
        return data;
    }
    
    try {
        // Parse JSON if possible to handle object data
        var parsed = JSON.parse(data);
        
        if (parsed.email) {
            parsed.email = '***';
        }
     
        if (parsed.phone) {
            parsed.phone = '***';
        }

        if (parsed.access_token) {
            parsed.access_token = '***';
        }

        if(parsed.initiator_token)
            parsed.initiator_token = '***';

        if (parsed.billingContact) {
            if (Object.keys(parsed.billingContact).length > 1) {
                Object.keys(parsed.billingContact).forEach(function (billingIndex) {
                    parsed.billingContact[billingIndex] = '***';
                });
            }
        }
        
        if (parsed.customer) {
            if (Object.keys(parsed.customer).length >= 1) {
                Object.keys(parsed.customer).forEach(function (customerIndex) {
                    parsed.customer[customerIndex] = '***';
                });
            }
        }
        
        if (parsed.card) {
            if (Object.keys(parsed.card).length >= 1) {
                Object.keys(parsed.card).forEach(function (cardIndex) {
                    parsed.card[cardIndex] = '***';
                });
            }
        }
        
        return JSON.stringify(parsed);
    } catch (e) {
        return data;
    }
}


/**
* Logs HTTP call details (sensitive data masked)
* @param {string} urlPath - url Path
* @param {string} httpVerb - httpVerb
* @param {string} requestBody - request Body
* @param {Object} result - result of the response
*/
function logHttpCall(urlPath, httpVerb, requestBody, result) {
    try {
        var message = '';
        var filteredRequest = filterLogString(JSON.stringify(requestBody));

        if (!empty(result.object)) {
            // Mask sensitive data in response body
            var filteredResponse = filterLogString(result.object);
            message = StringUtils.format('Request {1} {0} with requestBody=[{2}]; Response [{3}]',
                urlPath,
                httpVerb,
                filteredRequest,
                filteredResponse);
        } else {
            message = StringUtils.format('Request {1} {0} with requestBody=[{2}]; Response status={3}',
                urlPath,
                httpVerb,
                filteredRequest,
                result.status);
        }
        Logger.info(message);
    } catch (e) {
        Logger.error(e);
    }
}

/**
 * Logs failed HTTP call details for the Flexpay service (sensitive data masked)
 * @param {Object} result - The result of the response
 * @param {string} requestUrl - The URL of the request
 * @param {Object} requestBody - The request payload
 */
function logErrorHttpCall(result, requestUrl, requestBody) {
    var content = 'Flexpay http call failed: result.error=[' + result.error;
    content += '], result.status=[' + result.status;
    content += '], result.errorMessage=[' + result.errorMessage + ']';

    if (!empty(result.object) && !empty(result.object.text)) {
        content += '], result.object.text=[' + result.object.text + ']';
    }

    if (!empty(requestUrl)) {
        content += ', requestUrl=[' + requestUrl + ']';
    }

    if (!empty(requestBody)) {
        // Mask sensitive data in error logs
        content += ', requestBody=[' + filterLogString(JSON.stringify(requestBody)) + ']';
    }

    Logger.error(content);
}

/**
 * Handles Flexpay service responses and error conditions
 * @param {string} urlPath - The URL path of the request
 * @param {string} httpVerb - The HTTP method used
 * @param {Object} result - The service call result
 * @param {Object} requestBody - The request payload
 * @param {boolean} ifLogCall - Whether to log the response
 * @returns {Object} Parsed JSON response
 */
function handleFlexpayResponses(urlPath, httpVerb, result, requestBody) {

    if (empty(result) || result.status !== 'OK' || result.error !== 0) {
        logErrorHttpCall(result, urlPath, requestBody);
        throw new Error(result);
    }
    var resultClone = result;

    logHttpCall(urlPath, httpVerb, requestBody, resultClone);
  
    var jsonResponse = !empty(result.object) ? JSON.parse(result.object) : result;

    return jsonResponse;
}

/**
     *
     * @param {string} serviceName service name
     * @returns {Object} service
     */
function createHttpService(serviceName) {
    return require('dw/svc/LocalServiceRegistry').createService(serviceName, {
        createRequest: createRequest,
        parseResponse: function (service, httpClient) {
            if (httpClient.statusCode < 400) {
                var response = httpClient.text;
                return response;
            }
            return httpClient;
        },

        getRequestLogMessage: function (request) {
            return filterLogString(request);
        },

        getResponseLogMessage: function (response) {
            return filterLogString(response.text);
        }
    });
}

var api = {
    createOrder: function (basket) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/orders';
        httpService.setRequestMethod('POST');
        var requestPayload = createOrderRequest(basket);
        var response = httpService.call(requestPayload);
        var result = handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload); 
        if (result.errorCodes) {
            var err = new Error(result.errorCodes);
            err.errorCodes = result.errorCodes;
            throw err;
        }
        return result;
    },

    confirmOrder: function (flexpayOrderId, orderId) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/orders/' + flexpayOrderId + '/confirmation';
        httpService.setRequestMethod('PUT');
        var response = httpService.call({
            confirmationId: orderId
        });
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response);  
    },

    getVcc: function (orderId) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/orders/' + orderId + '/card';
        httpService.setRequestMethod('GET');
        var response = httpService.call();
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response);  
    },

    // direct settle transaction auth
    auth: function (flexPayOrderID, amount, referenceId, currencyCode) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/transactions';
        httpService.setRequestMethod('POST');
        var requestPayload = {
            order_id: flexPayOrderID,
            amount: amount,
            currency: currencyCode || 'USD',
            merchant_reference_id: referenceId
        };
        var response = httpService.call(requestPayload);
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload);  
    },
    // direct settle transaction capture
    capture: function (flexpayTransactionID, amount, currencyCode, referenceId) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/transactions/' + flexpayTransactionID + '/capture';
        httpService.setRequestMethod('POST');
        var requestPayload = {
            amount: amount,
            currency: currencyCode,
            merchant_reference_id: referenceId
        };
        var response = httpService.call(requestPayload);
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload);  
    },
    refund: function (flexpayTransactionID, amount, currencyCode, referenceId) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/transactions/' + flexpayTransactionID + '/refund';
        httpService.setRequestMethod('POST');
        var requestPayload = {
            amount: amount,
            currency: currencyCode,
            merchant_reference_id: referenceId
        };
        var response = httpService.call(requestPayload);
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload);  
    },
    void: function (flexpayTransactionID, referenceId) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/transactions/' + flexpayTransactionID + '/void';
        httpService.setRequestMethod('POST');
        var requestPayload = {
            merchant_reference_id: referenceId
        };
        var response = httpService.call(requestPayload);
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload);  
    },
    getTransaction: function (flexpayTransactionID) {
        var httpService = createHttpService('FlexpayService');
        httpService.URL = flexpayConfig.getURLPath() + '/transactions/' + flexpayTransactionID;
        httpService.setRequestMethod('GET');
        var response = httpService.call();
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response);
    },

    /**
     * Get available marketing offers for a purchase amount
     * Uses the FlexPay marketing offers endpoint to get offers without creating an order
     * API Docs: https://docs.uplift.com/apidocs/generates-marketing-offers-for-orders-4
     * @param {number} amount - Purchase amount
     * @param {string} currency - Currency code (default: USD)
     * @param {string} locale - Locale string (default: en-US)
     * @param {string} country - Country code (default: US)
     * @returns {Object} Offer data from FlexPay API
     */
    getOffers: function (amount, currency, locale, country) {
        var httpService = createHttpService('FlexpayService');
        var Site = require('dw/system/Site');
        var Locale = require('dw/util/Locale');

        // Use defaults if not provided
        var currentLocale = locale || Site.getCurrent().getDefaultLocale();
        var currentCurrency = currency || 'USD';
        var currentCountry = country || Locale.getLocale(currentLocale).getCountry();

        // Build request body according to FlexPay API specification
        var requestPayload = {
            integrationId: flexpayConfig.getSdkKey(),
            orders: [{
                localization: {
                    country: currentCountry,
                    currency: currentCurrency,
                    locale: convertLocaleFormat(currentLocale.toString())
                },
                orderCategory: 'TOTAL',
                price: amount,
                channel: 'WEB',
                externalId: dw.util.UUIDUtils.createUUID(),
                orderItems: [{
                    orderLine: {
                        name: 'Order Total',
                        quantity: 1,
                        sku: 'OFFER_REQUEST',
                        type: 'DIGITAL',
                        unitPrice: amount
                    }
                }]
            }]
        };

        // Use FlexPay marketing offers endpoint
        httpService.URL = flexpayConfig.getURLPath() + '/marketing/offers';
        httpService.setRequestMethod('POST');
        var response = httpService.call(requestPayload);
        return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload);
    }
};

/**
 * Translates an array of FlexPay API error codes into a single localized message.
 * Falls back to a generic message for unrecognized codes.
 * @param {string[]|string} errorCodes - Array of error codes or comma-separated string
 * @returns {string} Localized, user-facing error message
 */
function getLocalizedErrorMessage(errorCodes) {
    var Resource = require('dw/web/Resource');
    var codes = Array.isArray(errorCodes)
        ? errorCodes
        : String(errorCodes).split(',');

    var fallback = Resource.msg('error.flexpay.UNKNOWN', 'flexpay', null);

    var firstCode = codes.length > 0 ? codes[0].trim() : '';
    var key = 'error.flexpay.' + firstCode;
    var message = Resource.msg(key, 'flexpay', null);

    return (message && message !== key) ? message : fallback;
}

module.exports = {
    api: api,
    getLocalizedErrorMessage: getLocalizedErrorMessage
};
