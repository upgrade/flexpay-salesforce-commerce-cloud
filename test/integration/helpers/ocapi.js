'use strict';

var request = require('request-promise');

/**
 * OCAPI Helper for integration tests
 */
var OcapiHelper = {
    /**
     * Get OCAPI Data API base URL
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @returns {string} Base URL
     */
    getDataApiBaseUrl: function (hostname, siteId) {
        return 'https://' + hostname + '/s/-/dw/data/v25_6/sites/' + siteId;
    },

    /**
     * Get OCAPI Data API base URL - no site ID
     * @param {string} hostname - SFCC instance hostname
     * @returns {string} Base URL
     */
    getDataApiNoSiteBaseUrl: function (hostname) {
        return 'https://' + hostname + '/s/-/dw/data/v25_6/';
    },

    /**
     * Get Shop API base URL
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @returns {string} Shop API base URL
     */
    getShopApiBaseUrl: function (hostname, siteId) {
        return 'https://' + hostname + '/s/' + siteId + '/dw/shop/v25_6/';
    },

    /**
     * Get OAuth token for OCAPI
     * @param {string} hostname - SFCC instance hostname
     * @param {string} clientId - OCAPI client ID
     * @param {string} clientSecret - OCAPI client secret
     * @returns {Promise<string>} Promise that resolves with the access token
     */
    getAccessToken: function (hostname, clientId, clientSecret) {
        var authString = Buffer.from(clientId + ':' + clientSecret).toString('base64');
        
        return request({
            url: 'https://account.demandware.com/dwsso/oauth2/access_token',
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + authString,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                grant_type: 'client_credentials'
            },
            json: true,
            rejectUnauthorized: false
        }).then(function (response) {
            return response.access_token;
        }).catch(function (error) {
            console.log('error:', error);
            return null;
        });
    },

    /**
     * Get BM User OAuth token for OCAPI
     * @param {string} hostname - SFCC instance hostname
     * @param {string} bmUser - BM user
     * @param {string} bmPassword - BM password
     * @param {string} clientId - OCAPI client ID
     * @param {string} clientSecret - OCAPI client secret
     * @returns {Promise<string>} Promise that resolves with the access token
     */
    getBMUserAccessToken: function (hostname, bmUser, bmPassword, clientId, clientSecret) {
        console.log('Getting bm user access token for hostname:', hostname);
        // BMuser:BMpassword:clientSecret, base64 encoded
        var authString = Buffer.from(bmUser + ':' + bmPassword + ':' + clientSecret).toString('base64');
        return request({
            url: 'https://' + hostname + '/dw/oauth2/access_token?client_id=' + clientId,
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + authString,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                grant_type: 'urn:demandware:params:oauth:grant-type:client-id:dwsid:dwsecuretoken'
            },
            json: true,
            rejectUnauthorized: false
        }).then(function (response) {
            return response.access_token;
        }).catch(function (error) {
            console.log('error:', error);
            return null;
        }); 
    },

    /**
     * Update site preference(s)
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} accessToken - OAuth access token
     * @param {Object} preferences - Object with preference IDs as keys and values as values
     * @returns {Promise} Promise that resolves when the preferences are updated
     */
    updateSitePreference: function (hostname, siteId, accessToken, preferences) {
        var url = this.getDataApiBaseUrl(hostname, siteId) + '/site_preferences/preference_groups/FlexPay/sandbox';
        
        return request({
            url: url,
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: preferences,
            json: true,
            rejectUnauthorized: false
        });
    },

    /**
     * Get a site preference value
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} accessToken - OAuth access token
     * @returns {Promise} Promise
     */
    getSitePreference: function (hostname, siteId, accessToken) {
        var url = this.getDataApiBaseUrl(hostname, siteId) + '/site_preferences/preference_groups/FlexPay/sandbox';
        return request({
            url: url,
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            json: true,
            rejectUnauthorized: false
        });
    },

    /**
     * Get code versions
     * @param {string} hostname - SFCC instance hostname
     * @param {string} accessToken - OAuth access token
     * @returns {Promise} Promise
     */
    getCodeVersions: function (hostname, accessToken) {
        var url = this.getDataApiNoSiteBaseUrl(hostname) + 'code_versions';
        return request({
            url: url,
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            json: true,
            rejectUnauthorized: false
        });
    },

    /**
     * Create a job execution
     * @param {string} hostname - SFCC instance hostname
     * @param {string} accessToken - OAuth access token
     * @param {string} jobId - Job ID
     * @returns {Promise} Promise 
     */
    createJobExecution: function (hostname, accessToken, jobId) {
        var url = this.getDataApiNoSiteBaseUrl(hostname) + '/jobs/' + jobId + '/executions';
        return request({
            url: url,
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            json: true,
            rejectUnauthorized: false
        });
    },

    /**
     * Get a job execution
     * @param {string} hostname - SFCC instance hostname
     * @param {string} accessToken - OAuth access token
     * @param {string} jobId - Job ID
     * @param {string} executionId - Execution ID
     * @returns {Promise} Promise
     */
    getJobExecution: function (hostname, accessToken, jobId, executionId) {
        var url = this.getDataApiNoSiteBaseUrl(hostname) + '/jobs/' + jobId + '/executions/' + executionId;
        return request({
            url: url,
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            json: true,
            rejectUnauthorized: false
        });
    },
    /**
     * Get an order
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} orderId - Order ID
     * @param {string} accessToken - OAuth access token
     * @returns {Promise} Promise
     */
    getOrder: function (hostname, siteId, orderId, accessToken) {
        var url = this.getShopApiBaseUrl(hostname, siteId) + '/orders/' + orderId;
        return request({
            url: url,
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            json: true,
            rejectUnauthorized: false
        });
    },
    /**
     * Change an order
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} orderId - Order ID
     * @param {string} accessToken - OAuth access token
     * @param {Object} changes - Object with changes to the order
     * @returns {Promise} Promise
     */
    changeOrder: function (hostname, siteId, orderId, accessToken, changes) {
        var url = this.getShopApiBaseUrl(hostname, siteId) + '/orders/' + orderId;
        return request({
            url: url,
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: changes,
            json: true,
            rejectUnauthorized: false
        });
    },

    // Higher level function to update
    /**
     * Update integration type preference
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} accessToken - OAuth access token
     * @param {string} integrationType - Integration type: 'VCN' or 'DIRECT_SETTLE'
     * @returns {Promise} Promise that resolves when the preferences are updated
     */
    updateIntegrationType: function (hostname, siteId, accessToken, integrationType) {
        return this.updateSitePreference(hostname, siteId, accessToken, {
            c_flexPayIntegrationType: integrationType
        });
    },

    /**
     * Enable FlexPay integration
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} accessToken - OAuth access token
     * @returns {Promise} Promise that resolves when the preferences are updated
     */
    enableFlexPayIntegration: function (hostname, siteId, accessToken) {
        return this.updateSitePreference(hostname, siteId, accessToken, {
            c_flexPayEnabled: true
        });
    },

    /**
     * Disable FlexPay integration
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} accessToken - OAuth access token
     * @returns {Promise} Promise that resolves when the preferences are updated
     */
    disableFlexPayIntegration: function (hostname, siteId, accessToken) {
        return this.updateSitePreference(hostname, siteId, accessToken, {
            c_flexPayEnabled: false
        });
    },

    /**
     * Cancel an order
     * @param {string} hostname - SFCC instance hostname
     * @param {string} siteId - Site ID
     * @param {string} orderId - Order ID
     * @param {string} accessToken - OAuth access token
     * @returns {Promise} Promise that resolves when the order is cancelled
     */
    cancelOrder: function (hostname, siteId, orderId, accessToken) {
        return this.changeOrder(hostname, siteId, orderId, accessToken, {
            status: 'cancelled'
        });
    }
};

module.exports = OcapiHelper;

