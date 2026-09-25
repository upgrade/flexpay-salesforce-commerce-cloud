'use strict';

(function () {
    /**
     * 
     *
     * @constructor
     * @this {Config}
     */
    var Config = function () {
        var web = require('dw/web');
        var currentSite = require('dw/system/Site').getCurrent();
        var mode = currentSite.getCustomPreferenceValue('flexPayMode');
        var Resource = require('dw/web/Resource');

        this.getURLPath = function () {
            return web.Resource.msg('flexpay.' + mode + '.url', 'flexpay', null);
        };

        this.getAuthURLPath = function () {
            return web.Resource.msg('flexpay.auth.' + mode + '.url', 'flexpay', null);
        };
       
        this.getClientId = function () {
            return currentSite.getCustomPreferenceValue('flexPayClientId');
        };
      
        this.getClientSecret = function () {
            return currentSite.getCustomPreferenceValue('flexPayClientSecret');
        };
        
        this.getIntegrationType = function () {
            var integrationType = currentSite.getCustomPreferenceValue('flexPayIntegrationType');
            return integrationType ? integrationType.getValue() : null;
        };

        this.isVCNIntegration = function () {
            return this.getIntegrationType() === 'VCN';
        };

        this.getSdkKey = function () {
            return currentSite.getCustomPreferenceValue('flexPaySdkKey');
        };

        this.getSfraVersion = function () {
            return Resource.msg('global.version.number', 'version', null);
        };
        this.getSfraMajorVersion = function () {
            return parseInt(this.getSfraVersion().split('.')[0], 10);
        };
        this.getFlexpayPaymentMethodID = function () {
            return 'FLEXPAY';
        };

        /**
         * Check if marketing offer messaging is enabled
         * @returns {boolean} True if enabled
         */
        this.isMarketingOfferEnabled = function () {
            return currentSite.getCustomPreferenceValue('flexPayMarketingOfferEnabled');
        };

        /**
         * Get minimum amount for marketing offer eligibility
         * @returns {number} Minimum amount
         */
        this.getMarketingOfferMinAmount = function () {
            return currentSite.getCustomPreferenceValue('flexPayMarketingOfferMinAmount') || 50.0;
        };

        /**
         * Check if PDP marketing offer is enabled
         * @returns {boolean} true if PDP marketing offer should be displayed
         */
        this.showPdpMarketingOffer = function () {
            var showPdp = currentSite.getCustomPreferenceValue('flexPayShowPdpMarketingOffer');
            // If preference not set or is null, default to false for safety
            return showPdp === true;
        };
    };
    module.exports = new Config();
}());
