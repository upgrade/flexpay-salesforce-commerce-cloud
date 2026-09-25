'use strict';

var flexpayAPI = require('*/cartridge/scripts/flexpayAPI');
var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
var Logger = require('dw/system/Logger');

/**
 * Check if an amount is eligible for offers
 * @param {number} amount - Purchase amount
 * @returns {boolean} True if eligible
 */
function isEligibleForOffers(amount) {
    if (!amount || isNaN(amount) || amount <= 0) {
        return false;
    }

    var minAmount = flexpayConfig.getMarketingOfferMinAmount();

    return amount >= minAmount;
}

/**
 * Get available offers for a purchase amount
 * @param {number} amount - Purchase amount
 * @param {string} currency - Currency code
 * @returns {Object} Offers data structure
 */
function getAvailableOffers(amount, currency) {
    if (!flexpayConfig.isMarketingOfferEnabled()) {
        Logger.debug('FlexPay marketing offers are disabled');
        return {
            success: false,
            error: 'Marketing offers are not enabled'
        };
    }

    if (!isEligibleForOffers(amount)) {
        Logger.debug('Amount ' + amount + ' is not eligible for FlexPay offers');
        return {
            success: false,
            error: 'Amount not eligible for offers'
        };
    }

    try {
        // Call FlexPay API to get offers
        var apiResult = flexpayAPI.api.getOffers(amount, currency);

        // FlexPay bulk orders API returns: { orders: [{ offers: [...], errorCodes: [...] }] }
        if (apiResult && apiResult.orders && apiResult.orders.length > 0) {
            var orderResult = apiResult.orders[0]; // We only send one order in the request

            // Check for error codes (order may be ineligible)
            if (orderResult.errorCodes && orderResult.errorCodes.length > 0) {
                Logger.debug('FlexPay order ineligible: ' + orderResult.errorCodes.join(', '));
                return {
                    success: false,
                    error: 'Order not eligible for offers: ' + orderResult.errorCodes[0]
                };
            }

            // Extract offers from the order result
            var offers = orderResult.offers || [];

            if (offers.length === 0) {
                Logger.debug('FlexPay returned no offers for amount: ' + amount);
                return {
                    success: false,
                    error: 'No offers available for this amount'
                };
            }

            // Transform FlexPay API response to our internal format
            // FlexPay returns: { apr, monthlyPayment, numberOfPayments, grandTotal, marketingContent, etc. }
            offers = offers.map(function(offer) {
                // Extract marketing content for modal display
                var content = offer.marketingContent && offer.marketingContent[0] ? offer.marketingContent[0] : null;
                
                return {
                    term: offer.numberOfPayments || 0,
                    apr: parseFloat(offer.apr) || 0,
                    minApr: parseFloat(offer.minApr) || 0,
                    maxApr: parseFloat(offer.maxApr) || 0,
                    monthlyPayment: {
                        value: Math.round(parseFloat(offer.monthlyPayment) * 100), // Convert to cents
                        currency: currency
                    },
                    grandTotal: offer.grandTotal || amount,
                    downPayment: offer.downPayment || 0,
                    financeCharges: offer.financeCharges || 0,
                    promos: offer.promos || [],
                    // Full marketing content for modal (header, subtitle, steps, disclaimer, faqs)
                    marketingContent: content
                };
            });

            return {
                success: true,
                offers: offers
            };
        } else {
            Logger.error('FlexPay API error: Invalid response format or no orders returned');
            return {
                success: false,
                error: 'Failed to retrieve offers'
            };
        }
    } catch (e) {
        Logger.error('Exception in getAvailableOffers: ' + e.message);
        return {
            success: false,
            error: 'Internal error retrieving offers'
        };
    }
}

/**
 * Format offer data for display
 * @param {Object} offer - Offer object
 * @returns {Object} Formatted offer
 */
function formatOfferForDisplay(offer) {
    return {
        term: offer.term,
        monthlyPayment: {
            formatted: '$' + (offer.monthlyPayment.value / 100).toFixed(2)
        },
        apr: offer.apr || 0,
        minApr: offer.minApr || 0,
        maxApr: offer.maxApr || 0,
        displayText: 'Pay ' + '$' + (offer.monthlyPayment.value / 100).toFixed(2) + '/mo for ' + offer.term + ' months',
        // Pass through marketing content for modal display
        marketingContent: offer.marketingContent || null
    };
}

module.exports = {
    isEligibleForOffers: isEligibleForOffers,
    getAvailableOffers: getAvailableOffers,
    formatOfferForDisplay: formatOfferForDisplay
};
