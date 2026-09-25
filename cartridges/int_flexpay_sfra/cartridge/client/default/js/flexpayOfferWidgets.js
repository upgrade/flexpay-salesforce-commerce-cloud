'use strict';

/**
 * FlexPay Offer Widget Handler
 * Handles AJAX calls to fetch and display offer information
 */

/**
 * Initialize offer widgets on the page
 */
function initializeOfferWidgets() {
    var $offerWidgets = $('[data-flexpay-offer]');

    if ($offerWidgets.length === 0) {
        return;
    }

    $offerWidgets.each(function() {
        var $widget = $(this);

        // Skip if already initialized
        if ($widget.data('flexpay-initialized') === true) {
            return;
        }

        var amount = parseFloat($widget.data('amount'));
        var currency = $widget.data('currency') || 'USD';

        // Start hidden - only show on success
        $widget.find('.flexpay-offer-loading').hide();
        $widget.find('.flexpay-offer-content').hide();
        $widget.find('.flexpay-offer-error').hide();

        // Mark as initialized BEFORE fetching to prevent race conditions
        $widget.data('flexpay-initialized', true);

        // Fetch offer data
        fetchOfferData(amount, currency, $widget);
    });

    // Move modal to body level to ensure it can be displayed from any context
    // This is necessary because the modal may be nested inside hidden containers
    // (e.g., payment tab when on checkout summary step)
    var $modal = $('#flexpayInfoModal');
    if ($modal.length > 0 && !$modal.data('moved-to-body')) {
        $modal.appendTo('body');
        $modal.data('moved-to-body', true);
    }
}

// Request deduplication: prevents duplicate API calls when multiple
// widgets on the same page request offers for the same amount
// (e.g., payment tab widget + order summary widget on checkout).
var pendingRequests = {};
var offerCache = {};
var OFFER_CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch offer data from backend with request deduplication.
 * Multiple widgets requesting the same amount/currency share a single API call.
 * Cached responses expire after OFFER_CACHE_TTL milliseconds.
 * @param {number} amount - Purchase amount in dollars
 * @param {string} currency - Currency code
 * @param {jQuery} $widget - Widget element
 */
function fetchOfferData(amount, currency, $widget) {
    var offerUrl = $widget.data('offer-url');

    if (!offerUrl) {
        console.error('FlexPay: offer URL not found');
        handleOfferError($widget);
        return;
    }

    var cacheKey = amount + '_' + currency;

    // Use cached response if available and not expired
    var cached = offerCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < OFFER_CACHE_TTL) {
        handleOfferSuccess(cached.response, $widget);
        return;
    }
    // Expired entry — remove it
    delete offerCache[cacheKey];

    // Piggyback on in-flight request for same amount
    if (pendingRequests[cacheKey]) {
        pendingRequests[cacheKey]
            .done(function (response) {
                handleOfferSuccess(response, $widget);
            })
            .fail(function () {
                handleOfferError($widget);
            });
        return;
    }

    pendingRequests[cacheKey] = $.ajax({
        url: offerUrl,
        method: 'GET',
        data: {
            amount: amount,
            currency: currency
        },
        dataType: 'json',
        timeout: 5000
    }).done(function (response) {
        if (response.success) {
            offerCache[cacheKey] = { response: response, timestamp: Date.now() };
        }
        handleOfferSuccess(response, $widget);
    }).fail(function (xhr, status, error) {
        if (status === 'timeout') {
            console.warn('FlexPay: offer request timed out');
        } else {
            console.warn('FlexPay: offer request failed', error);
        }
        handleOfferError($widget);
    }).always(function () {
        delete pendingRequests[cacheKey];
    });
}

/**
 * Handle successful offer response
 * @param {Object} response - API response
 * @param {jQuery} $widget - Widget element
 */
function handleOfferSuccess(response, $widget) {
    $widget.find('.flexpay-offer-loading').hide();

    if (response.success && response.offers && response.offers.length > 0) {
        // Store ALL offers and disclaimer for modal use
        $widget.data('flexpay-offers', response.offers);
        $widget.data('flexpay-selected-offer', response.offers[0]);
        $widget.data('flexpay-disclaimer', response.disclaimer);
        $widget.data('flexpay-amount', $widget.data('amount'));

        var offer = response.offers[0]; // Use first offer for MVP
        renderOffer(offer, response.disclaimer, $widget);
    } else {
        handleOfferError($widget);
    }
}

/**
 * Render offer information in widget - FlexPay inline style
 * @param {Object} offer - Offer data
 * @param {string} disclaimer - Disclaimer text
 * @param {jQuery} $widget - Widget element
 */
function renderOffer(offer, disclaimer, $widget) {
    var $content = $widget.find('.flexpay-offer-content');

    // Build the inline FlexPay selector UI (matching FlexPay's design)
    var html = '<div class="flexpay-offer-selector">';

    // Main offer display - inline format
    html += '<div class="flexpay-selector-main">';
    html += '<span class="flexpay-text-prefix">or from </span>';
    html += '<span class="flexpay-amount-highlight">' + offer.monthlyPayment.formatted + '/mo</span>';

    // Info icon with modal trigger - filled green circle matching Kingston Brass style
    // Note: Click handler added separately to prevent event bubbling in payment tab context
    html += '<button type="button" class="flexpay-info-icon" aria-label="Learn more about FlexPay">';
    html += '<svg width="18" height="18" viewBox="0 0 16 16">';
    html += '<circle cx="8" cy="8" r="8" fill="#00A86B"/>';
    html += '<text x="8" y="12" text-anchor="middle" font-size="12" font-weight="bold" fill="#ffffff">i</text>';
    html += '</svg>';
    html += '</button>';

    html += '<span class="flexpay-text-with"> with </span>';

    // FlexPay logo/brand
    html += '<span class="flexpay-brand">';
    html += '<img class="flexpay-logo" src="https://www.upgrade.com/img/flex-pay-logo-horizontal.svg" alt="FlexPay" width="80" height="20">';
    html += '</span>';

    html += '</div>';

    html += '</div>';

    $content.html(html).show();

    // Hide the fallback logo now that rich offer content is visible
    $widget.siblings('.flexpay-tab-fallback').hide();
}

/**
 * Handle offer fetch error - fail silently, fallback logo stays visible
 * @param {jQuery} $widget - Widget element
 */
function handleOfferError($widget) {
    $widget.find('.flexpay-offer-loading').hide();
    $widget.find('.flexpay-offer-content').hide();
    $widget.find('.flexpay-offer-error').hide();
    // Hide the widget root to prevent empty space in layout
    // Fallback logo (if present, as sibling) remains visible - graceful degradation
    $widget.hide();
}

// ============================================================================
// Markdown to HTML Conversion Utilities
// ============================================================================

/**
 * Escape HTML entities to prevent XSS when injecting API content via .html()
 * @param {string} text - Raw text that may contain HTML
 * @returns {string} Text with HTML entities escaped
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Convert markdown bold (**text**) to HTML strong tags
 * @param {string} text - Text with markdown bold
 * @returns {string} Text with HTML strong tags
 */
function convertMarkdownBold(text) {
    if (!text) return '';
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Convert markdown links ([text](url)) to HTML anchor tags
 * @param {string} text - Text with markdown links
 * @returns {string} Text with HTML anchor tags
 */
function convertMarkdownLinks(text) {
    if (!text) return '';
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="flexpay-disclosure-link">$1</a>');
}

/**
 * Convert newlines to HTML breaks and paragraphs
 * @param {string} text - Text with newlines
 * @returns {string} Text with HTML breaks
 */
function convertNewlines(text) {
    if (!text) return '';
    // Convert double newlines to paragraph breaks
    var result = text.replace(/\n\n/g, '</p><p>');
    // Convert single newlines to line breaks
    result = result.replace(/\n/g, '<br>');
    return '<p>' + result + '</p>';
}

/**
 * Full markdown to HTML conversion
 * @param {string} text - Text with markdown
 * @param {boolean} preserveNewlines - Whether to convert newlines to HTML
 * @returns {string} HTML string
 */
function markdownToHtml(text, preserveNewlines) {
    if (!text) return '';
    // Escape HTML first to prevent XSS, then apply markdown transforms
    var html = escapeHtml(text);
    html = convertMarkdownBold(html);
    html = convertMarkdownLinks(html);
    if (preserveNewlines) {
        html = convertNewlines(html);
    }
    return html;
}

/**
 * Populate the info modal with dynamic content from offer data
 * Uses marketingContent from API for header, subtitle, steps, disclosure, and FAQs
 * @param {Array} offers - All available offers
 * @param {Object} selectedOffer - The currently displayed offer
 * @param {number} amount - Purchase amount in dollars
 */
function populateInfoModal(offers, selectedOffer, amount) {
    var $modal = $('#flexpayInfoModal');

    if (!offers || offers.length === 0 || !selectedOffer) {
        return;
    }

    var content = selectedOffer.marketingContent;

    // Populate from API marketingContent if available
    if (content) {
        // Header - convert markdown to HTML
        if (content.header) {
            $modal.find('.flexpay-modal-title').html(markdownToHtml(content.header, false));
        }

        // Subtitle - convert markdown to HTML
        if (content.subheader) {
            $modal.find('.flexpay-modal-subtitle').html(markdownToHtml(content.subheader, false));
        }

        // Steps - populate dynamically from API
        if (content.steps && content.steps.length) {
            populateSteps($modal, content.steps);
        }

        // FAQs - populate dynamically from API
        if (content.faqs) {
            populateFaqs($modal, content.faqs);
        }
    } else {
        // Fallback: Update monthly payment in title
        var monthlyPayment = selectedOffer.monthlyPayment.formatted + '/mo*';
        $modal.find('.flexpay-modal-monthly-payment').text(monthlyPayment);
    }

    // Disclosure - uses API disclaimer or fallback
    var disclosureHtml = generateDisclosureText(offers, selectedOffer, amount);
    var $disclosureP = $modal.find('.flexpay-modal-disclosure-text');
    $disclosureP.html(disclosureHtml);
}

/**
 * Populate steps from API marketingContent.steps
 * @param {jQuery} $modal - Modal jQuery element
 * @param {Array} steps - Steps array from API
 */
function populateSteps($modal, steps) {
    var $stepsContainer = $modal.find('.flexpay-modal-steps');

    // Sort steps by index
    steps.sort(function(a, b) {
        return parseInt(a.index, 10) - parseInt(b.index, 10);
    });

    // Update each step's text (keep existing icons/structure)
    steps.forEach(function(step, idx) {
        var $step = $stepsContainer.find('.flexpay-modal-step').eq(idx);
        if ($step.length) {
            $step.find('.flexpay-modal-step-text span').html(markdownToHtml(step.body, false));
        }
    });
}

/**
 * Populate FAQs from API marketingContent.faqs
 * @param {jQuery} $modal - Modal jQuery element
 * @param {Object} faqs - FAQs object from API
 */
function populateFaqs($modal, faqs) {
    // Update FAQ title
    if (faqs.header) {
        $modal.find('.flexpay-faq-title').text(faqs.header);
    }

    // Update FAQ button text
    if (faqs.open) {
        $modal.find('.flexpay-modal-faq-btn').text(faqs.open);
    }

    // Update back button - just arrow, no text
    $modal.find('.flexpay-modal-back-btn').html('←');

    // Build tabs and questions from API data
    if (!faqs.items || faqs.items.length === 0) {
        return;
    }

    var $tabsContainer = $modal.find('.flexpay-faq-tabs');
    var $accordion = $modal.find('.flexpay-faq-accordion');

    // Clear existing content
    $tabsContainer.empty();
    $accordion.empty();

    // Create tabs and questions for each category
    faqs.items.forEach(function(category, idx) {
        var categoryKey = escapeHtml(category.type.toLowerCase());
        var activeClass = idx === 0 ? ' active' : '';

        // Create tab button
        var $tab = $('<button class="flexpay-faq-tab' + activeClass + '" data-category="' + categoryKey + '">' +
            escapeHtml(category.title.toUpperCase()) + '</button>');
        $tabsContainer.append($tab);

        // Create questions for this category
        if (category.questions && category.questions.length) {
            category.questions.forEach(function(q) {
                var displayStyle = idx === 0 ? '' : ' style="display: none;"';
                var $item = $('<div class="flexpay-faq-item" data-category="' + categoryKey + '"' + displayStyle + '>' +
                    '<button class="flexpay-faq-question">' +
                        '<span>' + escapeHtml(q.title) + '</span>' +
                        '<svg class="flexpay-faq-icon" width="16" height="16" viewBox="0 0 16 16">' +
                            '<path d="M8 12l-4-4h8l-4 4z" fill="currentColor"/>' +
                        '</svg>' +
                    '</button>' +
                    '<div class="flexpay-faq-answer">' + markdownToHtml(q.body, true) + '</div>' +
                '</div>');
                $accordion.append($item);
            });
        }
    });
}

/**
 * Generate disclosure text with dynamic values from offers
 * Uses API-provided disclaimer which includes correct term/APR ranges
 * @param {Array} offers - All available offers
 * @param {Object} selectedOffer - The currently displayed offer
 * @param {number} amount - Purchase amount in dollars
 * @returns {string} HTML string for disclosure
 */
function generateDisclosureText(offers, selectedOffer, amount) {
    // Use pre-formatted disclaimer from API if available
    // This contains correct term range (3-24 months) and APR range (0%-36%)
    if (selectedOffer.marketingContent && selectedOffer.marketingContent.disclaimer) {
        return markdownToHtml(selectedOffer.marketingContent.disclaimer, false);
    }

    // Fallback: Generate disclosure manually using minApr/maxApr from offer
    // This fallback is rarely used since API typically provides marketingContent.disclaimer
    var minApr = parseFloat(selectedOffer.minApr) || 0;
    var maxApr = parseFloat(selectedOffer.maxApr) || parseFloat(selectedOffer.apr) || 0;
    var aprRange = minApr === maxApr
        ? (maxApr * 100).toFixed(0) + '%'
        : (minApr * 100).toFixed(0) + '%-' + (maxApr * 100).toFixed(0) + '%';

    // Format purchase amount (amount is already in dollars)
    var purchaseAmount = parseFloat(amount).toFixed(2);

    // Build disclosure text with inline links
    var text = '*Payment plans through Flex Pay feature repayment terms of 3-24 months ';
    text += 'and annual percentage rates (APRs) of ' + aprRange + '. ';
    text += 'Well qualified applicants may be eligible for 0% APR. No down payment required. ';
    text += 'Based on a purchase price of $' + purchaseAmount + ', you could pay ';
    text += selectedOffer.monthlyPayment.formatted + '/mo for ' + selectedOffer.term + ' months ';
    text += 'at ' + (parseFloat(selectedOffer.apr) * 100).toFixed(0) + '% APR. ';
    text += 'Minimum purchase required. Actual terms are based on your credit score and other factors and may vary. ';
    text += 'Not everyone is eligible. Loans made through Flex Pay by Upgrade are offered by these ';
    text += '<a href="https://www.upgrade.com/flexpay/lenders" target="_blank" rel="noopener noreferrer" class="flexpay-disclosure-link">lending partners</a>.';

    return text;
}

// Initialize on page load
$(document).ready(function() {
    initializeOfferWidgets();

    // Handle modal shown event - populate with dynamic data
    $('#flexpayInfoModal').on('show.bs.modal', function(e) {
        // Find the widget that triggered the modal
        var $trigger = $(e.relatedTarget);
        var $widget = $trigger.closest('[data-flexpay-offer]');

        if ($widget.length > 0) {
            var offers = $widget.data('flexpay-offers');
            var selectedOffer = $widget.data('flexpay-selected-offer');
            var amount = $widget.data('flexpay-amount');

            populateInfoModal(offers, selectedOffer, amount);
        }

        // Reset to info view when modal opens
        var $modal = $('#flexpayInfoModal');
        $modal.find('.flexpay-modal-faq-view').hide();
        // Show all info view elements (title, subtitle, steps, divider, disclosure, FAQ button)
        $modal.find('.flexpay-modal-title').show();
        $modal.find('.flexpay-modal-subtitle').show();
        $modal.find('.flexpay-modal-steps').show();
        $modal.find('.flexpay-modal-divider').show();
        $modal.find('.flexpay-modal-disclosure').show();
        $modal.find('.flexpay-modal-faq-button-container').show();
        $modal.find('.flexpay-modal-header-spacer').show();
        $modal.find('.flexpay-modal-back-btn').hide();
    });

    // FAQ Toggle Functionality - clicking FAQ button at bottom of modal
    $('#flexpayInfoModal').on('click', '.flexpay-modal-faq-btn', function() {
        var $modal = $('#flexpayInfoModal');
        // Hide all info view elements (title, subtitle, steps, divider, disclosure, FAQ button)
        $modal.find('.flexpay-modal-title').hide();
        $modal.find('.flexpay-modal-subtitle').hide();
        $modal.find('.flexpay-modal-steps').hide();
        $modal.find('.flexpay-modal-divider').hide();
        $modal.find('.flexpay-modal-disclosure').hide();
        $modal.find('.flexpay-modal-faq-button-container').hide();
        // Show FAQ view
        $modal.find('.flexpay-modal-faq-view').show();
        $modal.find('.flexpay-modal-header-spacer').hide();
        $modal.find('.flexpay-modal-back-btn').show();
    });

    $('#flexpayInfoModal').on('click', '.flexpay-modal-back-btn', function() {
        var $modal = $('#flexpayInfoModal');
        $modal.find('.flexpay-modal-faq-view').hide();
        // Show all info view elements
        $modal.find('.flexpay-modal-title').show();
        $modal.find('.flexpay-modal-subtitle').show();
        $modal.find('.flexpay-modal-steps').show();
        $modal.find('.flexpay-modal-divider').show();
        $modal.find('.flexpay-modal-disclosure').show();
        $modal.find('.flexpay-modal-faq-button-container').show();
        $modal.find('.flexpay-modal-header-spacer').show();
        $modal.find('.flexpay-modal-back-btn').hide();
    });

    // FAQ Accordion Toggle - close others when opening one
    $('#flexpayInfoModal').on('click', '.flexpay-faq-question', function() {
        var $item = $(this).closest('.flexpay-faq-item');
        var wasActive = $item.hasClass('active');

        // Close all other items in the same category
        var category = $item.data('category');
        $('.flexpay-faq-item[data-category="' + category + '"]').removeClass('active');

        // Toggle the clicked item
        if (!wasActive) {
            $item.addClass('active');
        }
    });

    // FAQ Category Tabs
    $('#flexpayInfoModal').on('click', '.flexpay-faq-tab', function() {
        var category = $(this).data('category');
        $('.flexpay-faq-tab').removeClass('active');
        $(this).addClass('active');

        $('.flexpay-faq-item').hide();
        $('.flexpay-faq-item[data-category="' + category + '"]').show();
    });

    // Info icon click handler - stops propagation to prevent triggering parent elements
    // (e.g., payment tab selection when info icon is inside the tab anchor)
    $('body').on('click', '.flexpay-info-icon', function(e) {
        e.stopPropagation();
        e.preventDefault();

        // Find the widget containing this icon to get offer data
        var $widget = $(this).closest('[data-flexpay-offer]');
        if ($widget.length > 0) {
            var offers = $widget.data('flexpay-offers');
            var selectedOffer = $widget.data('flexpay-selected-offer');
            var amount = $widget.data('flexpay-amount');

            populateInfoModal(offers, selectedOffer, amount);
        }

        // Manually trigger modal
        $('#flexpayInfoModal').modal('show');
    });
});

// Also initialize when payment method is selected (for in-tab widgets)
$('body').on('payment:methodSelected', function(e, data) {
    if (data.paymentMethod === 'FLEXPAY') {
        // Re-initialize offer widgets in case they weren't visible before
        initializeOfferWidgets();
    }
});

/**
 * Handle product variant/option selection on PDP
 * Updates offer widget when color/size/options (e.g. warranty) change.
 * Note: SFRA's price.sales.value already includes selected option surcharges.
 */
$('body').on('product:afterAttributeSelect', function(e, response) {
    var $pdpOfferWidget = $('.product-detail [data-flexpay-offer]');

    if ($pdpOfferWidget.length === 0) {
        return;
    }

    // SFRA wraps the AJAX response: { data: { product: {...} }, container: $el }
    var productData = response && response.data && response.data.product;
    if (!productData || !productData.price || !productData.price.sales) {
        return;
    }

    var newPrice = productData.price.sales.value;
    var newCurrency = productData.price.sales.currency || 'USD';

    // Skip re-fetch if the amount hasn't changed (prevents redundant API calls
    // when events fire without actual price changes, e.g. quantity updates)
    var currentAmount = $pdpOfferWidget.data('amount');
    if (currentAmount === newPrice) {
        return;
    }

    $pdpOfferWidget.data('amount', newPrice);
    $pdpOfferWidget.data('currency', newCurrency);

    $pdpOfferWidget.find('.flexpay-offer-content').hide();
    $pdpOfferWidget.find('.flexpay-offer-error').hide();
    $pdpOfferWidget.find('.flexpay-offer-loading').hide();

    fetchOfferData(newPrice, newCurrency, $pdpOfferWidget);
});

/**
 * Handle checkout view updates (e.g. shipping method change)
 * Re-fetches FlexPay offer when the order total changes during checkout
 */
$('body').on('checkout:updateCheckoutView', function (e, data) {
    var $checkoutOfferWidgets = $('[data-flexpay-offer]').not('.product-detail [data-flexpay-offer]');

    if ($checkoutOfferWidgets.length === 0) {
        return;
    }

    if (!data || !data.order || !data.order.totals || !data.order.totals.grandTotal) {
        return;
    }

    var newAmount = parseFloat(data.order.totals.grandTotal.replace(/[^0-9.]/g, ''));

    if (isNaN(newAmount) || newAmount <= 0) {
        return;
    }

    $checkoutOfferWidgets.each(function () {
        var $widget = $(this);
        var currency = $widget.data('currency') || 'USD';

        // Skip re-fetch if the amount hasn't changed
        var currentAmount = $widget.data('amount');
        if (currentAmount === newAmount) {
            return;
        }

        $widget.data('amount', newAmount);
        $widget.data('flexpay-initialized', false);

        $widget.find('.flexpay-offer-content').hide();
        $widget.find('.flexpay-offer-error').hide();
        $widget.find('.flexpay-offer-loading').hide();

        fetchOfferData(newAmount, currency, $widget);
    });
});

// Export for potential external use
module.exports = {
    initializeOfferWidgets: initializeOfferWidgets
};
