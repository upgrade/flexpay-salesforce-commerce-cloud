'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('flexpayConfig', function () {
    var flexpayConfig;
    var siteStub;
    var webResourceStub;
    var resourceStub;
    var customPreferences;

    beforeEach(function () {
        // Default custom preferences
        customPreferences = {
            flexPayMode: 'production',
            flexPayClientId: 'test-client-id-123',
            flexPayClientSecret: 'test-client-secret-456',
            flexPayIntegrationType: { getValue: function() { return 'VCN'; } },
            flexPaySdkKey: 'SDK-KEY-123'
        };

        // Mock Site.getCurrent()
        siteStub = {
            getCustomPreferenceValue: function (key) {
                return customPreferences[key];
            }
        };
        sinon.spy(siteStub, 'getCustomPreferenceValue');

        // Mock web.Resource.msg
        webResourceStub = {
            msg: function (key, bundle, defaultValue) {
                var resourceMap = {
                    'flexpay.production.url': 'https://api.flexpay.io/v1',
                    'flexpay.sandbox.url': 'https://sandbox-api.flexpay.io/v1',
                    'flexpay.test.url': 'https://test-api.flexpay.io/v1',
                    'flexpay.auth.production.url': 'https://auth.flexpay.io/oauth/token',
                    'flexpay.auth.sandbox.url': 'https://sandbox-auth.flexpay.io/oauth/token',
                    'flexpay.auth.test.url': 'https://test-auth.flexpay.io/oauth/token'
                };
                return resourceMap[key] || defaultValue;
            }
        };
        sinon.spy(webResourceStub, 'msg');

        // Mock dw/web/Resource.msg
        resourceStub = {
            msg: function (key, bundle, defaultValue) {
                if (key === 'global.version.number') {
                    return '6.3.0';
                }
                return defaultValue;
            }
        };
        sinon.spy(resourceStub, 'msg');
    });

    afterEach(function () {
        // Restore spies if they exist
        if (siteStub && siteStub.getCustomPreferenceValue && siteStub.getCustomPreferenceValue.restore) {
            siteStub.getCustomPreferenceValue.restore();
        }
        if (webResourceStub && webResourceStub.msg && webResourceStub.msg.restore) {
            webResourceStub.msg.restore();
        }
        if (resourceStub && resourceStub.msg && resourceStub.msg.restore) {
            resourceStub.msg.restore();
        }
    });

    describe('production mode configuration', function () {
        beforeEach(function () {
            customPreferences.flexPayMode = 'production';

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should return production URL path', function () {
            var result = flexpayConfig.getURLPath();
            assert.equal(result, 'https://api.flexpay.io/v1');
            assert.isTrue(webResourceStub.msg.calledWith('flexpay.production.url', 'flexpay', null));
        });

        it('should return production auth URL path', function () {
            var result = flexpayConfig.getAuthURLPath();
            assert.equal(result, 'https://auth.flexpay.io/oauth/token');
            assert.isTrue(webResourceStub.msg.calledWith('flexpay.auth.production.url', 'flexpay', null));
        });

        it('should return client ID from site preferences', function () {
            var result = flexpayConfig.getClientId();
            assert.equal(result, 'test-client-id-123');
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPayClientId'));
        });

        it('should return client secret from site preferences', function () {
            var result = flexpayConfig.getClientSecret();
            assert.equal(result, 'test-client-secret-456');
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPayClientSecret'));
        });

        it('should return integration type', function () {
            var result = flexpayConfig.getIntegrationType();
            assert.equal(result, 'VCN');
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPayIntegrationType'));
        });

        it('should return true for VCN integration', function () {
            var result = flexpayConfig.isVCNIntegration();
            assert.isTrue(result);
        });

        it('should return SDK key', function () {
            var result = flexpayConfig.getSdkKey();
            assert.equal(result, 'SDK-KEY-123');
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPaySdkKey'));
        });

        it('should return SFRA version', function () {
            var result = flexpayConfig.getSfraVersion();
            assert.equal(result, '6.3.0');
            assert.isTrue(resourceStub.msg.calledWith('global.version.number', 'version', null));
        });

        it('should return SFRA major version', function () {
            var result = flexpayConfig.getSfraMajorVersion();
            assert.equal(result, 6);
            assert.isNumber(result);
        });

        it('should return FlexPay payment method ID', function () {
            var result = flexpayConfig.getFlexpayPaymentMethodID();
            assert.equal(result, 'FLEXPAY');
        });
    });

    describe('sandbox mode configuration', function () {
        beforeEach(function () {
            customPreferences.flexPayMode = 'sandbox';

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should return sandbox URL path', function () {
            var result = flexpayConfig.getURLPath();
            assert.equal(result, 'https://sandbox-api.flexpay.io/v1');
            assert.isTrue(webResourceStub.msg.calledWith('flexpay.sandbox.url', 'flexpay', null));
        });

        it('should return sandbox auth URL path', function () {
            var result = flexpayConfig.getAuthURLPath();
            assert.equal(result, 'https://sandbox-auth.flexpay.io/oauth/token');
            assert.isTrue(webResourceStub.msg.calledWith('flexpay.auth.sandbox.url', 'flexpay', null));
        });
    });

    describe('test mode configuration', function () {
        beforeEach(function () {
            customPreferences.flexPayMode = 'test';

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should return test URL path', function () {
            var result = flexpayConfig.getURLPath();
            assert.equal(result, 'https://test-api.flexpay.io/v1');
            assert.isTrue(webResourceStub.msg.calledWith('flexpay.test.url', 'flexpay', null));
        });

        it('should return test auth URL path', function () {
            var result = flexpayConfig.getAuthURLPath();
            assert.equal(result, 'https://test-auth.flexpay.io/oauth/token');
            assert.isTrue(webResourceStub.msg.calledWith('flexpay.auth.test.url', 'flexpay', null));
        });
    });

    describe('Direct Settle integration', function () {
        beforeEach(function () {
            customPreferences.flexPayIntegrationType = { getValue: function() { return 'DIRECT_SETTLE'; } };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should return false for VCN integration when DIRECT_SETTLE', function () {
            var result = flexpayConfig.isVCNIntegration();
            assert.isFalse(result);
        });

        it('should return DIRECT_SETTLE for integration type', function () {
            var result = flexpayConfig.getIntegrationType();
            assert.equal(result, 'DIRECT_SETTLE');
        });
    });

    describe('empty or null preferences', function () {
        beforeEach(function () {
            customPreferences = {
                flexPayMode: 'production',
                flexPayClientId: '',
                flexPayClientSecret: null,
                flexPayIntegrationType: null,
                flexPaySdkKey: undefined
            };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should return empty string for client ID', function () {
            var result = flexpayConfig.getClientId();
            assert.equal(result, '');
        });

        it('should return null for client secret', function () {
            var result = flexpayConfig.getClientSecret();
            assert.isNull(result);
        });

        it('should return null for integration type when not set', function () {
            var result = flexpayConfig.getIntegrationType();
            assert.isNull(result);
        });

        it('should return false for VCN integration when type is null', function () {
            var result = flexpayConfig.isVCNIntegration();
            assert.isFalse(result);
        });

        it('should return undefined for SDK key', function () {
            var result = flexpayConfig.getSdkKey();
            assert.isUndefined(result);
        });
    });

    describe('SFRA version parsing', function () {
        it('should parse version 6.3.0 correctly', function () {
            var versionResourceStub = {
                msg: function (key) {
                    if (key === 'global.version.number') return '6.3.0';
                    return null;
                }
            };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': versionResourceStub
            });

            assert.equal(flexpayConfig.getSfraMajorVersion(), 6);
        });

        it('should parse version 5.2.1 correctly', function () {
            var versionResourceStub = {
                msg: function (key) {
                    if (key === 'global.version.number') return '5.2.1';
                    return null;
                }
            };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': versionResourceStub
            });

            assert.equal(flexpayConfig.getSfraMajorVersion(), 5);
        });

        it('should parse version 10.0.0 correctly', function () {
            var versionResourceStub = {
                msg: function (key) {
                    if (key === 'global.version.number') return '10.0.0';
                    return null;
                }
            };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': versionResourceStub
            });

            assert.equal(flexpayConfig.getSfraMajorVersion(), 10);
        });
    });

    describe('singleton behavior', function () {
        it('should return the same instance', function () {
            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var firstCall = flexpayConfig.getClientId();
            var secondCall = flexpayConfig.getClientId();

            assert.equal(firstCall, secondCall);
            // Site preferences should be read during initialization, not on each call
            // This tests the singleton pattern
        });
    });

    describe('method availability', function () {
        beforeEach(function () {
            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should have all required methods', function () {
            assert.isFunction(flexpayConfig.getURLPath);
            assert.isFunction(flexpayConfig.getAuthURLPath);
            assert.isFunction(flexpayConfig.getClientId);
            assert.isFunction(flexpayConfig.getClientSecret);
            assert.isFunction(flexpayConfig.getIntegrationType);
            assert.isFunction(flexpayConfig.isVCNIntegration);
            assert.isFunction(flexpayConfig.getSdkKey);
            assert.isFunction(flexpayConfig.getSfraVersion);
            assert.isFunction(flexpayConfig.getSfraMajorVersion);
            assert.isFunction(flexpayConfig.getFlexpayPaymentMethodID);
            assert.isFunction(flexpayConfig.isMarketingOfferEnabled);
            assert.isFunction(flexpayConfig.getMarketingOfferMinAmount);
            assert.isFunction(flexpayConfig.showPdpMarketingOffer);
        });
    });

    describe('marketing offer configuration', function () {
        beforeEach(function () {
            customPreferences.flexPayMarketingOfferEnabled = true;
            customPreferences.flexPayMarketingOfferMinAmount = 100.0;
            customPreferences.flexPayShowPdpMarketingOffer = true;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });
        });

        it('should return true when marketing offer is enabled', function () {
            var result = flexpayConfig.isMarketingOfferEnabled();
            assert.isTrue(result);
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPayMarketingOfferEnabled'));
        });

        it('should return false when marketing offer is disabled', function () {
            customPreferences.flexPayMarketingOfferEnabled = false;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.isMarketingOfferEnabled();
            assert.isFalse(result);
        });

        it('should return marketing offer min amount from site preferences', function () {
            var result = flexpayConfig.getMarketingOfferMinAmount();
            assert.equal(result, 100.0);
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPayMarketingOfferMinAmount'));
        });

        it('should return default min amount (50) when preference not set', function () {
            customPreferences.flexPayMarketingOfferMinAmount = null;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.getMarketingOfferMinAmount();
            assert.equal(result, 50.0);
        });

        it('should return default min amount (50) when preference is undefined', function () {
            customPreferences.flexPayMarketingOfferMinAmount = undefined;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.getMarketingOfferMinAmount();
            assert.equal(result, 50.0);
        });

        it('should return default min amount (50) when preference is 0', function () {
            customPreferences.flexPayMarketingOfferMinAmount = 0;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.getMarketingOfferMinAmount();
            assert.equal(result, 50.0);
        });

        it('should return true when PDP marketing offer is enabled', function () {
            var result = flexpayConfig.showPdpMarketingOffer();
            assert.isTrue(result);
            assert.isTrue(siteStub.getCustomPreferenceValue.calledWith('flexPayShowPdpMarketingOffer'));
        });

        it('should return false when PDP marketing offer is disabled', function () {
            customPreferences.flexPayShowPdpMarketingOffer = false;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.showPdpMarketingOffer();
            assert.isFalse(result);
        });

        it('should return false when PDP marketing offer is null (safety default)', function () {
            customPreferences.flexPayShowPdpMarketingOffer = null;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.showPdpMarketingOffer();
            assert.isFalse(result);
        });

        it('should return false when PDP marketing offer is undefined (safety default)', function () {
            customPreferences.flexPayShowPdpMarketingOffer = undefined;

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            var result = flexpayConfig.showPdpMarketingOffer();
            assert.isFalse(result);
        });
    });

    describe('integration scenarios', function () {
        it('should work with all production settings', function () {
            customPreferences = {
                flexPayMode: 'production',
                flexPayClientId: 'prod-client-123',
                flexPayClientSecret: 'prod-secret-456',
                flexPayIntegrationType: { getValue: function() { return 'VCN'; } },
                flexPaySdkKey: 'PROD-SDK-KEY-789'
            };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            assert.equal(flexpayConfig.getURLPath(), 'https://api.flexpay.io/v1');
            assert.equal(flexpayConfig.getAuthURLPath(), 'https://auth.flexpay.io/oauth/token');
            assert.equal(flexpayConfig.getClientId(), 'prod-client-123');
            assert.equal(flexpayConfig.getClientSecret(), 'prod-secret-456');
            assert.isTrue(flexpayConfig.isVCNIntegration());
            assert.equal(flexpayConfig.getSdkKey(), 'PROD-SDK-KEY-789');
            assert.equal(flexpayConfig.getFlexpayPaymentMethodID(), 'FLEXPAY');
        });

        it('should work with sandbox settings for testing', function () {
            customPreferences = {
                flexPayMode: 'sandbox',
                flexPayClientId: 'sandbox-client-123',
                flexPayClientSecret: 'sandbox-secret-456',
                flexPayIntegrationType: { getValue: function() { return 'DIRECT_SETTLE'; } },
                flexPaySdkKey: 'SANDBOX-SDK-KEY-012'
            };

            flexpayConfig = proxyquire('../../../../cartridges/int_flexpay/cartridge/scripts/flexpayConfig', {
                'dw/web': {
                    Resource: webResourceStub
                },
                'dw/system/Site': {
                    getCurrent: sinon.stub().returns(siteStub)
                },
                'dw/web/Resource': resourceStub
            });

            assert.equal(flexpayConfig.getURLPath(), 'https://sandbox-api.flexpay.io/v1');
            assert.equal(flexpayConfig.getAuthURLPath(), 'https://sandbox-auth.flexpay.io/oauth/token');
            assert.equal(flexpayConfig.getClientId(), 'sandbox-client-123');
            assert.isFalse(flexpayConfig.isVCNIntegration());
        });
    });
});

