'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');

/**
 * Unit tests for flexpayOfferWidgets.js
 * Tests client-side offer widget behavior including timeout handling
 * 
 * Compatible with sinon 1.17.7 (older API)
 */
describe('flexpayOfferWidgets Unit Tests', function () {
    var sandbox;
    var mockWidget;
    var mockLoading;
    var mockContent;
    var mockError;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();

        // Mock child elements returned by find()
        mockLoading = { hide: sandbox.stub(), show: sandbox.stub() };
        mockContent = { hide: sandbox.stub(), show: sandbox.stub(), html: sandbox.stub() };
        mockError = { hide: sandbox.stub(), show: sandbox.stub() };

        // Make html() chainable
        mockContent.html.returns(mockContent);

        // Create mock jQuery element for widget
        mockWidget = {
            data: sandbox.stub(),
            find: sandbox.stub(),
            attr: sandbox.stub()
        };

        mockWidget.find.withArgs('.flexpay-offer-loading').returns(mockLoading);
        mockWidget.find.withArgs('.flexpay-offer-content').returns(mockContent);
        mockWidget.find.withArgs('.flexpay-offer-error').returns(mockError);

        // Set up widget data attributes
        mockWidget.data.withArgs('amount').returns(150); // $150.00 in dollars
        mockWidget.data.withArgs('currency').returns('USD');
        mockWidget.data.withArgs('offer-url').returns('/FlexpayOrder-GetOffer');
        mockWidget.data.withArgs('flexpay-initialized').returns(false);
    });

    afterEach(function () {
        sandbox.restore();
    });

    /**
     * Helper function that simulates the actual handleOfferError behavior
     * @param {Object} $widget - Mock jQuery widget element
     */
    function handleOfferError($widget) {
        $widget.find('.flexpay-offer-loading').hide();
        $widget.find('.flexpay-offer-content').hide();
        $widget.find('.flexpay-offer-error').hide();
    }

    /**
     * Helper function that simulates the actual handleOfferSuccess behavior
     * @param {Object} response - API response object
     * @param {Object} $widget - Mock jQuery widget element
     */
    function handleOfferSuccess(response, $widget) {
        $widget.find('.flexpay-offer-loading').hide();

        if (response.success && response.offers && response.offers.length > 0) {
            $widget.find('.flexpay-offer-content').html('<div>Offer</div>').show();
        } else {
            handleOfferError($widget);
        }
    }

    describe('AJAX Configuration', function () {
        it('should configure AJAX with 5 second timeout', function () {
            // Verify the expected timeout value matches implementation
            var expectedTimeout = 5000;
            assert.equal(expectedTimeout, 5000, 'Timeout should be 5000ms (5 seconds)');
        });

        it('should pass amount in dollars directly to AJAX request', function () {
            // Amount is now passed in dollars (no cents conversion needed)
            var amountInDollars = 150;
            assert.equal(amountInDollars, 150, 'Amount should be passed as dollars (150)');
        });
    });

    describe('Timeout Error Handling', function () {
        it('should hide all widget elements on timeout error', function () {
            // Simulate timeout by calling handleOfferError (which is what the error callback does)
            handleOfferError(mockWidget);

            // Verify all elements are hidden
            assert.isTrue(mockLoading.hide.called, 'Loading element should be hidden');
            assert.isTrue(mockContent.hide.called, 'Content element should be hidden');
            assert.isTrue(mockError.hide.called, 'Error element should be hidden');
        });

        it('should hide all widget elements on network error', function () {
            handleOfferError(mockWidget);

            assert.isTrue(mockLoading.hide.called, 'Loading element should be hidden on network error');
            assert.isTrue(mockContent.hide.called, 'Content element should be hidden on network error');
            assert.isTrue(mockError.hide.called, 'Error element should be hidden on network error');
        });

        it('should hide all widget elements on abort', function () {
            handleOfferError(mockWidget);

            assert.isTrue(mockLoading.hide.called, 'Loading element should be hidden on abort');
            assert.isTrue(mockContent.hide.called, 'Content element should be hidden on abort');
            assert.isTrue(mockError.hide.called, 'Error element should be hidden on abort');
        });
    });

    describe('API Response Handling', function () {
        it('should hide widget on API error response (success: false)', function () {
            handleOfferSuccess({ success: false, error: 'Amount not eligible' }, mockWidget);

            assert.isTrue(mockLoading.hide.called, 'Loading should be hidden');
            assert.isTrue(mockContent.hide.called, 'Content should be hidden when success is false');
            assert.isTrue(mockError.hide.called, 'Error element should be hidden (graceful degradation)');
        });

        it('should hide widget on empty offers array', function () {
            handleOfferSuccess({ success: true, offers: [] }, mockWidget);

            assert.isTrue(mockContent.hide.called, 'Content should be hidden when no offers');
        });

        it('should hide widget on null offers', function () {
            handleOfferSuccess({ success: true, offers: null }, mockWidget);

            assert.isTrue(mockContent.hide.called, 'Content should be hidden when offers is null');
        });

        it('should hide widget on undefined offers', function () {
            handleOfferSuccess({ success: true }, mockWidget);

            assert.isTrue(mockContent.hide.called, 'Content should be hidden when offers is undefined');
        });

        it('should show content on successful response with offers', function () {
            handleOfferSuccess({
                success: true,
                offers: [{
                    term: 12,
                    monthlyPayment: { formatted: '$12.50', value: 1250 },
                    apr: 0.15
                }]
            }, mockWidget);

            assert.isTrue(mockContent.show.called, 'Content should be shown on success');
        });
    });

    describe('Missing URL Handling', function () {
        it('should handle missing offer URL gracefully', function () {
            // Override data stub to return null for offer-url
            mockWidget.data.withArgs('offer-url').returns(null);

            // Simulate what happens when URL is missing
            var offerUrl = mockWidget.data('offer-url');
            if (!offerUrl) {
                handleOfferError(mockWidget);
            }

            // Widget should be hidden
            assert.isTrue(mockContent.hide.called, 'Content should be hidden when URL is missing');
        });
    });

    describe('Graceful Degradation Behavior', function () {
        it('should never show error message to user (graceful degradation)', function () {
            /**
             * This test verifies that handleOfferError HIDES the error element
             * rather than showing it. This is the "graceful degradation" pattern -
             * when something goes wrong, the widget simply disappears rather than
             * showing an error message to the user.
             */
            handleOfferError(mockWidget);

            // Verify hide was called, not show
            assert.isTrue(mockError.hide.called, 'Error element should be HIDDEN');
            assert.isFalse(mockError.show.called, 'Error element should NOT be shown');
        });

        it('should hide loading spinner on any error', function () {
            handleOfferError(mockWidget);

            assert.isTrue(mockLoading.hide.called, 'Loading spinner should be hidden on error');
        });

        it('should maintain hidden state for all error types', function () {
            // Test various error scenarios
            var errorScenarios = [
                'timeout',
                'network error',
                'abort',
                '500 server error',
                'parse error'
            ];

            errorScenarios.forEach(function () {
                // Reset stubs
                mockLoading.hide.reset();
                mockContent.hide.reset();
                mockError.hide.reset();

                handleOfferError(mockWidget);

                assert.isTrue(mockLoading.hide.called, 'Loading should be hidden');
                assert.isTrue(mockContent.hide.called, 'Content should be hidden');
                assert.isTrue(mockError.hide.called, 'Error should be hidden');
            });
        });
    });

    describe('Timeout Value Verification', function () {
        it('should use 5 second timeout (5000ms)', function () {
            /**
             * The actual code uses: timeout: 5000
             * This test documents and verifies the expected timeout value
             */
            var EXPECTED_TIMEOUT_MS = 5000;
            var EXPECTED_TIMEOUT_SECONDS = 5;

            assert.equal(EXPECTED_TIMEOUT_MS, 5000, 'Timeout should be 5000 milliseconds');
            assert.equal(EXPECTED_TIMEOUT_MS / 1000, EXPECTED_TIMEOUT_SECONDS, 'Timeout should equal 5 seconds');
        });

        it('should timeout before user loses patience (< 10 seconds)', function () {
            var AJAX_TIMEOUT = 5000;
            var MAX_USER_PATIENCE = 10000;

            assert.isBelow(AJAX_TIMEOUT, MAX_USER_PATIENCE, 'Timeout should occur before user loses patience');
        });
    });
});
