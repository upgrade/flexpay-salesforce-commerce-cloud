'use strict';

var assert = require('chai').assert;
var request = require('request-promise');
var config = require('./it.config');
var ocapi = require('./helpers/ocapi');

describe('FlexpayOrder Create', function () {
    this.timeout(60000);
    var cookieJar;
    var ocapiAccessToken;
    var bmUserAccessToken;
    var myRequest;

    /**
     * Get OCAPI access token for managing site preferences
     */
    before(function () {
        // Skip OCAPI token if credentials not provided
        if (!config.ocapi || !config.ocapi.clientId || !config.ocapi.clientSecret) {
            // eslint-disable-next-line no-console
            console.warn('OCAPI credentials not configured. Skipping preference management tests.');
            this.skip();
        }

        return Promise.all([
            ocapi.getAccessToken(
                config.ocapi.hostname,
                config.ocapi.clientId,
                config.ocapi.clientSecret
            ),
            ocapi.getBMUserAccessToken(
                config.ocapi.hostname,
                config.ocapi.bmUser,
                config.ocapi.bmPassword,
                config.ocapi.clientId,
                config.ocapi.clientSecret
            )
        ]).then(function (tokens) {
            ocapiAccessToken = tokens[0];
            bmUserAccessToken = tokens[1];
        });
    });

    /**
     * Helper function to setup checkout flow
     * @param {boolean} isVcnMode - Whether to use VCN mode (true) or Direct Settle mode (false)
     * @returns {Promise} Promise that resolves when checkout flow is complete
     */
    function setupCheckoutFlow(isVcnMode) {
        cookieJar = request.jar();
        myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: cookieJar,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            csrf: {
                tokenName: '',
                token: ''
            }
        };

        // Set flexPayIntegrationType preference using OCAPI
        return ocapi.updateSitePreference(
            config.ocapi.hostname,
            config.ocapi.siteId,
            ocapiAccessToken,
            {
                c_flexPayIntegrationType: isVcnMode ? 'VCN' : 'DIRECT_SETTLE'
            }
        ).then(function () {
            myRequest.url = config.baseUrl + '/CSRF-Generate';
            myRequest.form = {};
            return request(myRequest);
        }).then(function (csrfResponse) {
            var csrfJsonResponse = JSON.parse(csrfResponse.body);
            myRequest.csrf.tokenName = csrfJsonResponse.csrf.tokenName;
            myRequest.csrf.token = csrfJsonResponse.csrf.token;
            myRequest.url = config.baseUrl + '/Cart-AddProduct';
            myRequest.form = {
                pid: '750518699578M', // men Black Single Pleat Athletic Fit Wool Suit
                quantity: 1
            };
            return request(myRequest);
        })
            .then(function () {
                myRequest.url = config.baseUrl + '/CheckoutShippingServices-UpdateShippingMethodsList';
                myRequest.form = {
                    stateCode: 'KY',
                    postalCode: '99999'
                };
                return request(myRequest);
            })
            .then(function () {
                myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?'
                    + myRequest.csrf.tokenName + '='
                    + myRequest.csrf.token;
                myRequest.form = {
                    dwfrm_shipping_shippingAddress_addressFields_firstName: 'Arthur',
                    dwfrm_shipping_shippingAddress_addressFields_lastName: 'Davis',
                    dwfrm_shipping_shippingAddress_addressFields_address1: '10 main St',
                    dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                    dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'KY',
                    dwfrm_shipping_shippingAddress_addressFields_city: 'Mayfield',
                    dwfrm_shipping_shippingAddress_addressFields_postalCode: '99999',
                    dwfrm_shipping_shippingAddress_addressFields_phone: '+15555554206',
                    dwfrm_shipping_shippingAddress_shippingMethodID: '001'
                };
                return request(myRequest);
            })
            .then(function () {
                myRequest.url = config.baseUrl + '/CheckoutServices-SubmitPayment?'
                    + myRequest.csrf.tokenName + '='
                    + myRequest.csrf.token;
                myRequest.form = {
                    dwfrm_billing_addressFields_firstName: 'Arthur',
                    dwfrm_billing_addressFields_lastName: 'Davis',
                    dwfrm_billing_addressFields_address1: '1013 Weda Cir',
                    dwfrm_billing_addressFields_address2: '',
                    dwfrm_billing_addressFields_country: 'US',
                    dwfrm_billing_addressFields_states_stateCode: 'KY',
                    dwfrm_billing_addressFields_city: 'Mayfield',
                    dwfrm_billing_addressFields_postalCode: '99999',
                    dwfrm_billing_paymentMethod: 'FLEXPAY',
                    dwfrm_billing_contactInfoFields_email: 'test@example.com',
                    dwfrm_billing_addressFields_phone: '+15555554206',
                    dwfrm_billing_contactInfoFields_phone: '15555554206'
                };
                return request(myRequest);
            })
            .catch(function (error) {
                // eslint-disable-next-line no-console
                console.error('Setup failed:', error.message);
                throw error;
            });
    }

    describe('Direct Settle Integration', function () {
        before(function () {
            return setupCheckoutFlow(false); // false = Direct Settle mode
        });

        it('should create flexpay order and retrieve redirectUrl for Direct Settle', function () {
            myRequest.url = config.baseUrl + '/FlexpayOrder-Create?'
                + myRequest.csrf.tokenName + '='
                + myRequest.csrf.token;
            
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected request statusCode to be 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isFalse(bodyAsJson.error, 'Expected no error in response');
                    assert.isString(bodyAsJson.redirectUrl, 'Expected redirectUrl to be a string');
                });
        });
    });

    describe('VCC Integration', function () {
        before(function () {
            return setupCheckoutFlow(true); // true = VCC mode
        });

        it('should create flexpay order and retrieve redirectUrl for VCC', function () {
            myRequest.url = config.baseUrl + '/FlexpayOrder-Create?'
                + myRequest.csrf.tokenName + '='
                + myRequest.csrf.token;
            
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected request statusCode to be 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isFalse(bodyAsJson.error, 'Expected no error in response');
                    assert.isString(bodyAsJson.redirectUrl, 'Expected redirectUrl to be a string');
                });
        });
    });
});
