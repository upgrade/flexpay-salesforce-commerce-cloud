# FlexPay SFRA File Changes Review

This document provides a detailed comparison between FlexPay cartridge files and the base SFRA cartridge (`app_storefront_base`).

---

## Table of Contents

- [Overview](#overview)
- [SFRA 6.x/7.x File Changes](#sfra-6x7x-file-changes)
- [Detailed File Comparisons](#detailed-file-comparisons)
  - [Templates](#templates)
  - [Controllers](#controllers)
  - [Client-Side JavaScript](#client-side-javascript)
  - [Server-Side Scripts](#server-side-scripts)
- [SFRA 5.x Specific Differences](#sfra-5x-specific-differences)
- [New Files (Not in Base SFRA)](#new-files-not-in-base-sfra)

---

## Overview

The FlexPay cartridge extends SFRA by:
- **Modifying** existing templates and JavaScript to add FlexPay payment option
- **Extending** controllers using SFCC's `server.prepend()` pattern
- **Adding** new FlexPay-specific files for the payment flow and marketing offers

**Version:** 0.9.2

---

## SFRA 6.x/7.x File Changes

### Templates Summary

| FlexPay File | Base File | Change Type |
|-------------|-----------|-------------|
| `int_flexpay/.../paymentOptions.isml` | `app_storefront_base/.../paymentOptions.isml` | **Modified** |
| `int_flexpay/.../paymentOptionsTabs.isml` | `app_storefront_base/.../paymentOptionsTabs.isml` | **Modified** |
| `int_flexpay/.../paymentOptionsContent.isml` | `app_storefront_base/.../paymentOptionsContent.isml` | **Modified** |
| `int_flexpay/.../paymentOptionsSummary.isml` | `app_storefront_base/.../paymentOptionsSummary.isml` | **Modified** |
| `int_flexpay/.../creditCardTab.isml` | `app_storefront_base/.../creditCardTab.isml` | **Modified** |
| `int_flexpay/.../product/productDetails.isml` | `app_storefront_base/.../product/productDetails.isml` | **Modified** |
| `int_flexpay/.../checkout/orderTotalSummary.isml` | `app_storefront_base/.../checkout/orderTotalSummary.isml` | **Modified** |
| `int_flexpay/.../common/scripts.isml` | `app_storefront_base/.../common/scripts.isml` | **Modified** |
| `int_flexpay/.../flexpay/flexPayMethodTab.isml` | N/A | **New** |
| `int_flexpay/.../flexpay/flexPaymentContent.isml` | N/A | **New** |
| `int_flexpay/.../flexpay/flexPaySummary.isml` | N/A | **New** |
| `int_flexpay/.../flexpay/flexpayOfferWidget.isml` | N/A | **New** |
| `int_flexpay/.../flexpay/flexpayInfoModal.isml` | N/A | **New** |

### Controllers Summary

| FlexPay File | Base File | Change Type |
|-------------|-----------|-------------|
| `int_flexpay/controllers/CheckoutServices.js` | `app_storefront_base/controllers/CheckoutServices.js` | **Extended (prepend)** |
| `int_flexpay/controllers/FlexpayOrder.js` | N/A | **New** |

### Client-Side JavaScript Summary

| FlexPay File | Base File | Change Type |
|-------------|-----------|-------------|
| `int_flexpay_sfra/.../js/checkout/checkout.js` | `app_storefront_base/.../js/checkout/checkout.js` | **Modified** |
| `int_flexpay_sfra/.../js/checkout/billing.js` | `app_storefront_base/.../js/checkout/billing.js` | **Requires base** |
| `int_flexpay_sfra/.../js/flexpaycheckout.js` | N/A | **New** |
| `int_flexpay_sfra/.../js/flexpayOfferWidgets.js` | N/A | **New** (marketing offers) |
| `int_flexpay_sfra5/.../js/flexpayOfferWidgets.js` | N/A | **New** (SFRA 5.x version) |

### Server-Side Scripts Summary

| FlexPay File | Base File | Change Type |
|-------------|-----------|-------------|
| `int_flexpay/.../scripts/flexpayAPI.js` | N/A | **New** (added `getOffers()` method) |
| `int_flexpay/.../scripts/flexpayConfig.js` | N/A | **New** (added offer preference methods) |
| `int_flexpay/.../scripts/flexpayOffers.js` | N/A | **New** (marketing offer business logic) |

### Test Files Summary

| Test File | Purpose |
|-----------|---------|
| `test/unit/int_flexpay/scripts/flexpayOffersTest.js` | Unit tests for `flexpayOffers.js` |
| `test/unit/int_flexpay_sfra/js/flexpayOfferWidgetsTest.js` | Unit tests for `flexpayOfferWidgets.js` |

---

## Detailed File Comparisons

### Templates

#### 1. `paymentOptions.isml`

**Path:** `templates/default/checkout/billing/paymentOptions.isml`

##### Base SFRA 6.x
```isml
<div class="form-nav billing-nav payment-information"
     data-payment-method-id="CREDIT_CARD"
     data-is-new-payment="${pdict.customer.registeredUser && pdict.customer.customerPaymentInstruments.length ? false : true}"
>
    <ul class="nav nav-tabs nav-fill payment-options" role="tablist">
        <isinclude template="checkout/billing/paymentOptions/paymentOptionsTabs" />
    </ul>
</div>
<div class="credit-card-selection-new" >
    <div class="tab-content">
        <isinclude template="checkout/billing/paymentOptions/paymentOptionsContent" />
    </div>
</div>
```

##### FlexPay
```isml
<div class="form-nav billing-nav payment-information"
     data-payment-method-id="${pdict.selectedPaymentMethod}"
     data-is-new-payment="${pdict.customer.registeredUser && pdict.customer.customerPaymentInstruments.length ? false : true}"
>
    <ul class="nav nav-tabs nav-fill payment-options" role="tablist">
        <isinclude template="checkout/billing/paymentOptions/paymentOptionsTabs" />
    </ul>
</div>
<div class="credit-card-selection-new" >
    <div class="tab-content">
        <isinclude template="checkout/billing/paymentOptions/paymentOptionsContent" />
    </div>
</div>
```

##### Diff
```diff
 <div class="form-nav billing-nav payment-information"
-     data-payment-method-id="CREDIT_CARD"
+     data-payment-method-id="${pdict.selectedPaymentMethod}"
      data-is-new-payment="${pdict.customer.registeredUser && pdict.customer.customerPaymentInstruments.length ? false : true}"
 >
```

**Change Summary:** Dynamic payment method ID instead of hardcoded "CREDIT_CARD"

---

#### 2. `paymentOptionsTabs.isml`

**Path:** `templates/default/checkout/billing/paymentOptions/paymentOptionsTabs.isml`

##### Base SFRA 6.x
```isml
<isloop items="${pdict.order.billing.payment.applicablePaymentMethods}" var="paymentOption">
    <isif condition="${paymentOption.ID === 'CREDIT_CARD'}">
        <isinclude template="checkout/billing/paymentOptions/creditCardTab" />
    </isif>
</isloop>
```

##### FlexPay
```isml
<isloop items="${pdict.order.billing.payment.applicablePaymentMethods}" var="paymentOption">
     <isif condition="${paymentOption.ID === 'FLEXPAY' && dw.system.Site.getCurrent().getCustomPreferenceValue('flexPayEnabled')}">
       <isinclude template="flexpay/flexPayMethodTab" />
    </isif>
    <isif condition="${paymentOption.ID === 'CREDIT_CARD'}">
        <isinclude template="checkout/billing/paymentOptions/creditCardTab" />
    </isif>
</isloop>
```

##### Diff
```diff
 <isloop items="${pdict.order.billing.payment.applicablePaymentMethods}" var="paymentOption">
+     <isif condition="${paymentOption.ID === 'FLEXPAY' && dw.system.Site.getCurrent().getCustomPreferenceValue('flexPayEnabled')}">
+       <isinclude template="flexpay/flexPayMethodTab" />
+    </isif>
     <isif condition="${paymentOption.ID === 'CREDIT_CARD'}">
         <isinclude template="checkout/billing/paymentOptions/creditCardTab" />
     </isif>
 </isloop>
```

**Change Summary:** Added FlexPay tab with site preference check before credit card tab

---

#### 3. `paymentOptionsContent.isml`

**Path:** `templates/default/checkout/billing/paymentOptions/paymentOptionsContent.isml`

##### Base SFRA 6.x
```isml
<isloop items="${pdict.order.billing.payment.applicablePaymentMethods}" var="paymentOption">
    <isif condition="${paymentOption.ID === 'CREDIT_CARD'}">
        <isinclude template="checkout/billing/paymentOptions/creditCardContent" />
    </isif>
</isloop>
```

##### FlexPay
```isml
<isloop items="${pdict.order.billing.payment.applicablePaymentMethods}" var="paymentOption">
  <isif condition="${paymentOption.ID === 'FLEXPAY' }">
   		<isinclude template="flexpay/flexPaymentContent" />
    </isif>    
  <isif condition="${paymentOption.ID === 'CREDIT_CARD'}">
        <isinclude template="checkout/billing/paymentOptions/creditCardContent" />
    </isif>
</isloop>
```

##### Diff
```diff
 <isloop items="${pdict.order.billing.payment.applicablePaymentMethods}" var="paymentOption">
+  <isif condition="${paymentOption.ID === 'FLEXPAY' }">
+   		<isinclude template="flexpay/flexPaymentContent" />
+    </isif>    
   <isif condition="${paymentOption.ID === 'CREDIT_CARD'}">
         <isinclude template="checkout/billing/paymentOptions/creditCardContent" />
     </isif>
 </isloop>
```

**Change Summary:** Added FlexPay content panel inclusion

---

#### 4. `paymentOptionsSummary.isml`

**Path:** `templates/default/checkout/billing/paymentOptions/paymentOptionsSummary.isml`

##### Base SFRA 6.x
```isml
<div class="payment-details">
    <isloop items="${pdict.order.billing.payment.selectedPaymentInstruments}" var="payment">
        <isif condition="${payment.paymentMethod === 'CREDIT_CARD'}">
            <isinclude template="checkout/billing/paymentOptions/creditCardSummary" />
        </isif>
    </isloop>
</div>
```

##### FlexPay
```isml
<div class="payment-details">
    <isloop items="${pdict.order.billing.payment.selectedPaymentInstruments}" var="payment">
        <isif condition="${payment.paymentMethod === 'CREDIT_CARD'}">
            <isinclude template="checkout/billing/paymentOptions/creditCardSummary" />
        </isif>
         <isif condition="${payment.paymentMethod === 'FLEXPAY'}">
            <isinclude template="flexpay/flexPaySummary" />
        </isif>
    </isloop>
</div>
```

##### Diff
```diff
 <div class="payment-details">
     <isloop items="${pdict.order.billing.payment.selectedPaymentInstruments}" var="payment">
         <isif condition="${payment.paymentMethod === 'CREDIT_CARD'}">
             <isinclude template="checkout/billing/paymentOptions/creditCardSummary" />
         </isif>
+         <isif condition="${payment.paymentMethod === 'FLEXPAY'}">
+            <isinclude template="flexpay/flexPaySummary" />
+        </isif>
     </isloop>
 </div>
```

**Change Summary:** Added FlexPay summary display for order confirmation

---

#### 5. `productDetails.isml`

**Path:** `templates/default/product/productDetails.isml`

##### Base SFRA 6.x (Header Section)
```isml
<isscript>
    var assets = require('*/cartridge/scripts/assets');
    assets.addJs('/js/productDetail.js');
    assets.addCss('/css/product/detail.css');
</isscript>
```

##### FlexPay (Header Section)
```isml
<isscript>
    var assets = require('*/cartridge/scripts/assets');
    assets.addJs('/js/productDetail.js');
    assets.addJs('/js/flexpayOfferWidgets.js');
    assets.addCss('/css/product/detail.css');
    assets.addCss('/css/flexpay.css');
</isscript>
```

##### Diff (Header)
```diff
 <isscript>
     var assets = require('*/cartridge/scripts/assets');
     assets.addJs('/js/productDetail.js');
+    assets.addJs('/js/flexpayOfferWidgets.js');
     assets.addCss('/css/product/detail.css');
+    assets.addCss('/css/flexpay.css');
 </isscript>
```

##### Base SFRA 6.x (Pricing Section)
```isml
<div class="prices-add-to-cart-actions">
    <div class="row">
        <div class="col-12">
            <!-- Prices -->
            <div class="prices">
                <isset name="price" value="${product.price}" scope="page" />
                <isinclude template="product/components/pricing/main" />
            </div>
        </div>
    </div>

    <!-- Cart and [Optionally] Apple Pay -->
    <isinclude template="product/components/addToCartProduct" />
</div>
```

##### FlexPay (Pricing Section)
```isml
<div class="prices-add-to-cart-actions">
    <div class="row">
        <div class="col-12">
            <!-- Prices -->
            <div class="prices">
                <isset name="price" value="${product.price}" scope="page" />
                <isinclude template="product/components/pricing/main" />
            </div>
        </div>
    </div>

    <!-- FlexPay Offer Widget -->
    <isscript>
        var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
        var offerEnabled = flexpayConfig.isMarketingOfferEnabled();
        var showPdpPromo = flexpayConfig.showPdpMarketingOffer();
    </isscript>

    <isif condition="${offerEnabled && showPdpPromo && product.price && product.price.sales && product.price.sales.value}">
        <div class="row flexpay-pdp-offer-container">
            <div class="col-12">
                <isset name="offerAmount" value="${product.price.sales.value}" scope="page" />
                <isset name="offerCurrency" value="${product.price.sales.currency || 'USD'}" scope="page" />
                <isset name="offerContext" value="pdp" scope="page" />
                <isset name="offerCssClass" value="flexpay-offer-pdp" scope="page" />

                <isinclude template="flexpay/flexpayOfferWidget" />
            </div>
        </div>
    </isif>

    <!-- Cart and [Optionally] Apple Pay -->
    <isinclude template="product/components/addToCartProduct" />
</div>
```

##### Diff (Pricing Section)
```diff
 <div class="prices-add-to-cart-actions">
     <div class="row">
         <div class="col-12">
             <!-- Prices -->
             <div class="prices">
                 <isset name="price" value="${product.price}" scope="page" />
                 <isinclude template="product/components/pricing/main" />
             </div>
         </div>
     </div>

+    <!-- FlexPay Offer Widget -->
+    <isscript>
+        var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
+        var offerEnabled = flexpayConfig.isMarketingOfferEnabled();
+        var showPdpPromo = flexpayConfig.showPdpMarketingOffer();
+    </isscript>
+
+    <isif condition="${offerEnabled && showPdpPromo && product.price && product.price.sales && product.price.sales.value}">
+        <div class="row flexpay-pdp-offer-container">
+            <div class="col-12">
+                <isset name="offerAmount" value="${product.price.sales.value}" scope="page" />
+                <isset name="offerCurrency" value="${product.price.sales.currency || 'USD'}" scope="page" />
+                <isset name="offerContext" value="pdp" scope="page" />
+                <isset name="offerCssClass" value="flexpay-offer-pdp" scope="page" />
+
+                <isinclude template="flexpay/flexpayOfferWidget" />
+            </div>
+        </div>
+    </isif>
+
     <!-- Cart and [Optionally] Apple Pay -->
     <isinclude template="product/components/addToCartProduct" />
 </div>
```

**Change Summary:**
- Added FlexPay offer JavaScript (`flexpayOfferWidgets.js`) and CSS (`flexpay.css`) to page assets
- Inserted FlexPay promotional offer widget between product pricing and "Add to Cart" button
- Widget displays conditionally based on three requirements:
  1. `flexPayMarketingOfferEnabled` site preference is `true`
  2. `flexPayShowPdpMarketingOffer` site preference is `true`
  3. Product has a valid sale price (`product.price.sales.value`)
- Passes product sale price, currency, context ('pdp'), and CSS class to `flexpayOfferWidget.isml` template

---

#### 6. `orderTotalSummary.isml`

**Path:** `templates/default/checkout/orderTotalSummary.isml`

##### Base SFRA 6.x (lines 51-60)
```isml
<!--- Grand Total --->
<div class="row grand-total leading-lines">
    <div class="col-6 start-lines">
        <p class="order-receipt-label"><span>${Resource.msg('label.order.grand.total','confirmation', null)}</span></p>
    </div>
    <div class="col-6 end-lines">
        <p class="text-right"><span class="grand-total-sum">${pdict.order.totals.grandTotal}</span></p>
    </div>
</div>
```

##### FlexPay (lines 51-75)
```isml
<!--- Grand Total --->
<div class="row grand-total leading-lines">
    <div class="col-6 start-lines">
        <p class="order-receipt-label"><span>${Resource.msg('label.order.grand.total','confirmation', null)}</span></p>
    </div>
    <div class="col-6 end-lines">
        <p class="text-right"><span class="grand-total-sum">${pdict.order.totals.grandTotal}</span></p>
    </div>
</div>

<!--- FlexPay Offer Widget --->
<isscript>
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
</isscript>

<isif condition="${currentBasket && currentBasket.totalGrossPrice && currentBasket.totalGrossPrice.available}">
    <isset name="offerAmount" value="${currentBasket.totalGrossPrice.value}" scope="page" />
    <isset name="offerCurrency" value="${currentBasket.currencyCode}" scope="page" />
    <isset name="offerContext" value="checkout-summary" scope="page" />
    <isset name="offerCssClass" value="flexpay-offer-checkout-summary" scope="page" />

    <isinclude template="flexpay/flexpayOfferWidget" />
</isif>
```

##### Diff
```diff
 <!--- Grand Total --->
 <div class="row grand-total leading-lines">
     <div class="col-6 start-lines">
         <p class="order-receipt-label"><span>${Resource.msg('label.order.grand.total','confirmation', null)}</span></p>
     </div>
     <div class="col-6 end-lines">
         <p class="text-right"><span class="grand-total-sum">${pdict.order.totals.grandTotal}</span></p>
     </div>
 </div>
+
+<!--- FlexPay Offer Widget --->
+<isscript>
+    var BasketMgr = require('dw/order/BasketMgr');
+    var currentBasket = BasketMgr.getCurrentBasket();
+</isscript>
+
+<isif condition="${currentBasket && currentBasket.totalGrossPrice && currentBasket.totalGrossPrice.available}">
+    <isset name="offerAmount" value="${currentBasket.totalGrossPrice.value}" scope="page" />
+    <isset name="offerCurrency" value="${currentBasket.currencyCode}" scope="page" />
+    <isset name="offerContext" value="checkout-summary" scope="page" />
+    <isset name="offerCssClass" value="flexpay-offer-checkout-summary" scope="page" />
+
+    <isinclude template="flexpay/flexpayOfferWidget" />
+</isif>
```

**Change Summary:**
- Inserted FlexPay promotional offer widget below Grand Total in checkout order summary
- Uses `BasketMgr.getCurrentBasket()` to get the current basket's gross price directly (more reliable than string parsing)
- Widget displays conditionally based on:
  1. Current basket exists with available gross price
  2. `flexPayMarketingOfferEnabled` site preference is `true` (checked by widget)
- Passes basket total amount, currency, context ('checkout-summary'), and CSS class to `flexpayOfferWidget.isml` template

---

#### 7. `common/scripts.isml`

**Path:** `templates/default/common/scripts.isml`

##### Base SFRA 6.x
```isml
<!-- No FlexPay JavaScript loading -->
```

##### FlexPay
```isml
<iscomment>Conditionally load FlexPay JavaScript when offers are enabled</iscomment>
<isscript>
    var Site = require('dw/system/Site');
    var currentSite = Site.getCurrent();
    var flexPayEnabled = currentSite.getCustomPreferenceValue('flexPayEnabled');
    var flexPayOfferEnabled = currentSite.getCustomPreferenceValue('flexPayMarketingOfferEnabled');
</isscript>

<isif condition="${flexPayEnabled && flexPayOfferEnabled}">
    <isscript>
        var assets = require('*/cartridge/scripts/assets.js');
        assets.addJs('/js/flexpayOfferWidgets.js');
    </isscript>
</isif>
```

##### Diff
```diff
+<iscomment>Conditionally load FlexPay JavaScript when offers are enabled</iscomment>
+<isscript>
+    var Site = require('dw/system/Site');
+    var currentSite = Site.getCurrent();
+    var flexPayEnabled = currentSite.getCustomPreferenceValue('flexPayEnabled');
+    var flexPayOfferEnabled = currentSite.getCustomPreferenceValue('flexPayMarketingOfferEnabled');
+</isscript>
+
+<isif condition="${flexPayEnabled && flexPayOfferEnabled}">
+    <isscript>
+        var assets = require('*/cartridge/scripts/assets.js');
+        assets.addJs('/js/flexpayOfferWidgets.js');
+    </isscript>
+</isif>
```

**Change Summary:**
- Conditionally loads `flexpayOfferWidgets.js` bundle when both FlexPay and marketing offers are enabled
- Prevents unnecessary JavaScript from loading when offers are disabled
- Uses site preferences for runtime control without code changes

---

#### 8. `flexPayMethodTab.isml`

**Path:** `templates/default/flexpay/flexPayMethodTab.isml`

**Purpose:** Renders the FlexPay payment method tab with conditional offer widget or static logo.

```isml
<isscript>
    var assets = require('*/cartridge/scripts/assets.js');
    assets.addCss('/css/flexpay.css');

    var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();

    var offerEnabled = flexpayConfig.isMarketingOfferEnabled();
    var hasBasket = currentBasket && currentBasket.totalGrossPrice;
    var offerAmount = hasBasket ? currentBasket.totalGrossPrice.value : 0;
    var minAmount = flexpayConfig.getMarketingOfferMinAmount();
    var showOfferInTab = offerEnabled && hasBasket && offerAmount >= minAmount;
</isscript>

<li class="nav-item" data-method-id="${paymentOption.ID}">
    <a class="nav-link flexpay-tab <isif condition="${paymentOption.ID === pdict.selectedPaymentMethod}">active</isif>"
       data-toggle="tab"
       href="#flexpay-content"
       role="tab">
        <isif condition="${showOfferInTab}">
            <iscomment>Show offer widget when offers are enabled and eligible</iscomment>
            <isset name="offerAmount" value="${currentBasket.totalGrossPrice.value}" scope="page" />
            <isset name="offerCurrency" value="${currentBasket.getCurrencyCode()}" scope="page" />
            <isset name="offerContext" value="payment-selector" scope="page" />
            <isset name="offerCssClass" value="flexpay-offer-inline" scope="page" />
            <isinclude template="flexpay/flexpayOfferWidget" />
        <iselse/>
            <iscomment>Show standard logo when offers are disabled</iscomment>
            <img class="flexpay-payment-option"
                 src="https://www.upgrade.com/img/flex-pay-logo-horizontal.svg"
                 height="32"
                 alt="${paymentOption.name}"
                 title="${paymentOption.name}" />
        </isif>
    </a>
</li>

<iscomment>Include FlexPay Info Modal outside li element - will be moved to body by JS</iscomment>
<isif condition="${showOfferInTab && !request.custom.flexpayModalIncluded}">
    <isset name="flexpayModalIncluded" value="${true}" scope="request" />
    <isinclude template="flexpay/flexpayInfoModal" />
</isif>
```

**Key Features:**
- Conditionally shows offer widget OR static logo based on configuration
- Calculates offer eligibility from current basket total
- Includes info modal once per page (prevents duplicate modals)

---

### Controllers

#### 9. `CheckoutServices.js`

**Path:** `controllers/CheckoutServices.js`

##### Base SFRA 6.x (SubmitPayment excerpt)
```javascript
server.post(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var PaymentManager = require('dw/order/PaymentMgr');
        var HookManager = require('dw/system/HookMgr');
        var Resource = require('dw/web/Resource');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

        var viewData = {};
        var paymentForm = server.forms.getForm('billing');

        // verify billing form data
        var billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);
        // ... continues with standard payment processing
    }
);
```

##### FlexPay (prepend to SubmitPayment)
```javascript
'use strict';

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var flexpayConfig = require('*/cartridge/scripts/flexpayConfig');

server.prepend(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var data = res.getViewData();
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentOrNewBasket();
        var paymentForm = server.forms.getForm('billing');
        var paymentMethodID = paymentForm.paymentMethod.value;
        var Transaction = require('dw/system/Transaction');

        // If not FlexPay, remove any existing FlexPay payment instruments and continue
        if (paymentMethodID !== flexpayConfig.getFlexpayPaymentMethodID()) {
            var paymentMethod = flexpayConfig.getFlexpayPaymentMethodID();
            Transaction.wrap(function () {
                var payInstr = currentBasket.getPaymentInstruments(paymentMethod);
                var iter = payInstr.iterator();
                while (iter.hasNext()) {
                    var pi = iter.next();
                    currentBasket.removePaymentInstrument(pi);
                }
            });
            next();
            return;
        }

        // FlexPay-specific validation and processing
        // ... validates billing form
        // ... sets billing address
        // ... calls payment processor hook

        if (paymentMethodID === flexpayConfig.getFlexpayPaymentMethodID()) {
            this.emit('route:Complete', req, res);
        }
    }
);

module.exports = server.exports();
```

**Change Summary:** 
- Uses `server.extend()` and `server.prepend()` pattern
- Removes FlexPay payment instruments when switching to other payment methods
- Custom billing validation for FlexPay
- SFRA version-aware email handling
- Terminates request processing after FlexPay payment submission

---

#### 10. `FlexpayOrder.js`

**Path:** `controllers/FlexpayOrder.js`

**Purpose:** Handles FlexPay order creation, confirmation, cancellation, and marketing offers.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `FlexpayOrder-Create` | POST | Creates FlexPay order, returns redirect URL |
| `FlexpayOrder-Confirm` | GET | Handles return from FlexPay, creates SFCC order |
| `FlexpayOrder-Cancel` | GET | Handles cancellation, redirects to checkout |
| `FlexpayOrder-GetOffer` | GET | Retrieves marketing offers for a given amount |

**GetOffer Implementation:**
```javascript
server.get('GetOffer', function (req, res, next) {
    var flexpayOffers = require('*/cartridge/scripts/flexpayOffers');

    try {
        // Parse and validate input
        var amount = parseFloat(req.querystring.amount);
        var currency = req.querystring.currency || 'USD';

        if (!amount || isNaN(amount) || amount <= 0) {
            res.json({
                success: false,
                error: 'Invalid amount parameter'
            });
            return next();
        }

        // Get offers from business logic module
        var offersData = flexpayOffers.getAvailableOffers(amount, currency);

        if (offersData.success) {
            // Format offers for display
            var formattedOffers = offersData.offers.map(function(offer) {
                return flexpayOffers.formatOfferForDisplay(offer);
            });

            res.json({
                success: true,
                offers: formattedOffers,
                disclaimer: offersData.disclaimer
            });
        } else {
            res.json({
                success: false,
                error: offersData.error
            });
        }
    } catch (e) {
        Logger.error('Exception in FlexpayOrder-GetOffer: ' + e.message);
        res.json({
            success: false,
            error: 'Internal server error'
        });
    }

    return next();
});
```

---

### Client-Side JavaScript

#### 11. `checkout.js`

**Path:** `client/default/js/checkout/checkout.js`

##### Base SFRA 6.x (placeOrder stage)
```javascript
} else if (stage === 'placeOrder') {
    // disable the placeOrder button here
    $('body').trigger('checkout:disableButton', '.next-step-button button');
    $.ajax({
        url: $('.place-order').data('action'),
        method: 'POST',
        success: function (data) {
            // ... handles order placement
        },
        error: function () {
            $('body').trigger('checkout:enableButton', $('.next-step-button button'));
        }
    });

    return defer;
}
```

##### FlexPay (placeOrder stage)
```javascript
} else if (stage === 'placeOrder') {             
    if ($('.payment-information').data('payment-method-id') === 'FLEXPAY') {
        return defer;  // Skip - let flexpaycheckout.js handle
    } 
    // disable the placeOrder button here
    $('body').trigger('checkout:disableButton', '.next-step-button button');
    $.ajax({
        url: $('.place-order').data('action'),
        method: 'POST',
        success: function (data) {
            // ... same as base SFRA
        },
        error: function () {
            $('body').trigger('checkout:enableButton', $('.next-step-button button'));
        }
    });

    return defer;
}
```

##### Diff
```diff
 } else if (stage === 'placeOrder') {
+    if ($('.payment-information').data('payment-method-id') === 'FLEXPAY') {
+        return defer;  // Skip - let flexpaycheckout.js handle
+    } 
     // disable the placeOrder button here
     $('body').trigger('checkout:disableButton', '.next-step-button button');
```

**Change Summary:** Added early return for FlexPay to allow `flexpaycheckout.js` to handle the custom redirect flow

---

#### 12. `flexpayOfferWidgets.js`

**Path:** `client/default/js/flexpayOfferWidgets.js`

**Purpose:** Manages marketing offers display, AJAX calls, and modal population.

**Key Functions:**

| Function | Description |
|----------|-------------|
| `initializeOfferWidgets()` | Finds all `[data-flexpay-offer]` elements, fetches offer data |
| `fetchOfferData(amount, currency, $widget)` | AJAX call to `FlexpayOrder-GetOffer` |
| `handleOfferSuccess(response, $widget)` | Stores offers data, renders widget content |
| `renderOffer(offer, disclaimer, $widget)` | Builds inline offer display HTML |
| `handleOfferError($widget)` | Graceful degradation - keeps widget hidden |
| `populateInfoModal(offers, selectedOffer, amount)` | Populates modal from API `marketingContent` |
| `populateSteps($modal, steps)` | Updates step text from API |
| `populateFaqs($modal, faqs)` | Builds FAQ tabs and accordion from API |
| `markdownToHtml(text, preserveNewlines)` | Converts markdown to HTML |
| `generateDisclosureText(offers, selectedOffer, amount)` | Creates disclosure with dynamic values |

**Event Handlers:**
```javascript
// Product variant selection (PDP)
$('body').on('product:afterAttributeSelect', function(e, data) {
    // Updates offer when color/size changes
});

// Payment method selection
$('body').on('payment:methodSelected', function(e, data) {
    // Re-initializes widgets when FlexPay tab shown
});

// Modal shown event
$('#flexpayInfoModal').on('show.bs.modal', function(e) {
    // Populates modal with dynamic content
});

// FAQ button click
$('#flexpayInfoModal').on('click', '.flexpay-modal-faq-btn', function() {
    // Shows FAQ view, hides info view
});

// Back button click
$('#flexpayInfoModal').on('click', '.flexpay-modal-back-btn', function() {
    // Returns to info view
});

// FAQ accordion toggle
$('#flexpayInfoModal').on('click', '.flexpay-faq-question', function() {
    // Expands/collapses FAQ items
});

// FAQ category tabs
$('#flexpayInfoModal').on('click', '.flexpay-faq-tab', function() {
    // Switches between FAQ categories
});
```

---

### Server-Side Scripts

#### 13. `flexpayConfig.js`

**Path:** `scripts/flexpayConfig.js`

**New methods added for marketing offers:**

```javascript
/**
 * Check if marketing offer messaging is enabled
 * @returns {boolean} True if enabled
 */
this.isMarketingOfferEnabled = function () {
    return currentSite.getCustomPreferenceValue('flexPayMarketingOfferEnabled');
};

/**
 * Get minimum amount for marketing offer eligibility
 * @returns {Number} Minimum amount
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
    return showPdp === true;
};
```

---

#### 14. `flexpayAPI.js`

**Path:** `scripts/flexpayAPI.js`

**New method added for marketing offers:**

```javascript
/**
 * Get available marketing offers for a purchase amount
 * Uses the FlexPay bulk orders endpoint with dryRun=true to get offers
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

    var currentLocale = locale || Site.getCurrent().getDefaultLocale();
    var currentCurrency = currency || 'USD';
    var currentCountry = country || Locale.getLocale(currentLocale).getCountry();

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

    httpService.URL = flexpayConfig.getURLPath() + '/marketing/offers';
    httpService.setRequestMethod('POST');
    var response = httpService.call(requestPayload);
    return handleFlexpayResponses(httpService.URL, httpService.requestMethod, response, requestPayload);
}
```

---

#### 15. `flexpayOffers.js` (NEW)

**Path:** `scripts/flexpayOffers.js`

**Purpose:** Business logic for marketing offer eligibility, calculation, and formatting.

**Exported Functions:**

| Function | Description |
|----------|-------------|
| `isEligibleForOffers(amount)` | Validates amount against minimum threshold from site preferences |
| `getAvailableOffers(amount, currency)` | Fetches offers from FlexPay API and transforms to internal format |
| `formatOfferForDisplay(offer)` | Formats offer object for frontend display with formatted prices |

**Key Features:**
- Checks `flexPayMarketingOfferEnabled` site preference before API calls
- Validates amount meets `flexPayMarketingOfferMinAmount` threshold
- Transforms FlexPay API response format to simplified display format
- Converts monthly payment to cents (integer) for precision
- Extracts `marketingContent` object for modal display
- Handles API error codes (e.g., order ineligibility)

**Data Flow:**

```
1. Controller calls getAvailableOffers(amount, currency)
2. Validates: offer feature enabled && amount >= minimum
3. Calls flexpayAPI.api.getOffers(amount, currency)
4. FlexPay API returns: { orders: [{ offers: [...], errorCodes: [...] }] }
5. Transforms API response to internal format:
   {
     term: 12,
     apr: 0.15,
     minApr: 0,
     maxApr: 0.36,
     monthlyPayment: { value: 5221, currency: 'USD' }, // cents
     grandTotal: 626.52,
     marketingContent: { header, subheader, steps, disclaimer, faqs }
   }
6. formatOfferForDisplay() converts to display format:
   {
     term: 12,
     monthlyPayment: { formatted: '$52.21' },
     apr: 0.15,
     displayText: 'Pay $52.21/mo for 12 months',
     marketingContent: { ... } // passed through
   }
```

**Error Handling:**
- Returns `{ success: false, error: 'message' }` for all failures
- Logs errors to SFCC Logger
- Graceful degradation (widget stays hidden on error)

---

## SFRA 5.x Specific Differences

### Files with Version-Specific Implementations

The following files have separate implementations for SFRA 5.x vs 6.x/7.x:

| File | SFRA 5.x Location | SFRA 6.x/7.x Location |
|------|-------------------|----------------------|
| `flexpayOfferWidgets.js` | `int_flexpay_sfra5/cartridge/client/default/js/` | `int_flexpay_sfra/cartridge/client/default/js/` |
| `flexpay.scss` | `int_flexpay_sfra5/cartridge/client/default/scss/` | `int_flexpay_sfra/cartridge/client/default/scss/` |
| `checkout.js` | `int_flexpay_sfra5/cartridge/client/default/js/checkout/` | `int_flexpay_sfra/cartridge/client/default/js/checkout/` |

### Checkout Stages Comparison

| SFRA 5.x | SFRA 6.x/7.x |
|----------|--------------|
| `['shipping', 'payment', 'placeOrder', 'submitted']` | `['customer', 'shipping', 'payment', 'placeOrder', 'submitted']` |

### `checkout.js` Key Differences

| Feature | SFRA 5.x | SFRA 6.x |
|---------|----------|----------|
| Customer stage | Not included | Includes customer login/registration |
| formData object | No `customer` property | Has `customer` property |
| Imports | No `customerHelpers` | Includes `customerHelpers` |
| Order confirmation | URL params redirect | Form POST redirect |

### `CheckoutServices.js` SFRA Version Handling

The FlexPay cartridge detects SFRA version and handles email differently:

```javascript
// Check SFRA version for email handling
if (flexpayConfig.getSfraMajorVersion() <= 5) {
    // SFRA 5.x - email is in contactInfoFields on billing form
    viewData.email = {
        value: paymentForm.contactInfoFields.email.value
    };
}

// Later, when setting customer email
if (flexpayConfig.getSfraMajorVersion() <= 5) {
    currentBasket.setCustomerEmail(billingData.email.value);
}
// SFRA 6.x - email already set in customer stage
```

---

## New Files (Not in Base SFRA)

### FlexPay-Specific Templates

| Template | Purpose |
|----------|---------|
| `flexpay/flexPayMethodTab.isml` | Payment tab with conditional offer widget or logo |
| `flexpay/flexPaymentContent.isml` | Hidden form fields and data attributes |
| `flexpay/flexPaySummary.isml` | Order confirmation summary ("FLEXPAY LOAN") |
| `flexpay/flexpayOfferWidget.isml` | Reusable offer widget for all 3 locations (PDP, checkout summary, payment tab) |
| `flexpay/flexpayInfoModal.isml` | Educational modal with 3-step process and FAQs |

#### `flexpayOfferWidget.isml`

**Path:** `templates/default/flexpay/flexpayOfferWidget.isml`

**Purpose:** Reusable widget template for displaying marketing offers in 3 different contexts.

**Required Variables (passed via `<isset>`):**
- `offerAmount` (Number) - Purchase amount for offer calculation
- `offerCurrency` (String) - Currency code (e.g., 'USD')
- `offerContext` (String) - Context identifier: `'pdp'`, `'checkout-summary'`, or `'payment-selector'`
- `offerCssClass` (String) - Context-specific CSS class: `'flexpay-offer-pdp'`, `'flexpay-offer-checkout-summary'`, or `'flexpay-offer-inline'`

**Rendering Strategy:**
1. Checks `flexPayMarketingOfferEnabled` site preference
2. Validates amount meets minimum threshold (`flexPayMarketingOfferMinAmount`)
3. Renders empty container with data attributes (amount, currency, offer-url)
4. JavaScript (`flexpayOfferWidgets.js`) initializes widget, fetches offers, populates content

**HTML Structure:**
```isml
<div class="flexpay-offer-widget {offerCssClass}"
     data-flexpay-offer
     data-amount="{amount}"
     data-currency="{currency}"
     data-context="{context}"
     data-offer-url="{FlexpayOrder-GetOffer URL}">

    <div class="flexpay-offer-loading" style="display: none;">
        <!-- Loading spinner and text -->
    </div>

    <div class="flexpay-offer-content" style="display: none;">
        <!-- Populated by JavaScript after AJAX call -->
    </div>

    <div class="flexpay-offer-error" style="display: none;">
        <!-- Error state: widget stays hidden -->
    </div>
</div>
```

**Context Usage:**
- **PDP** (`pdp`): Displayed below product price, above "Add to Cart" button
- **Checkout Summary** (`checkout-summary`): Displayed below Grand Total in order summary sidebar
- **Payment Selector** (`payment-selector`): Displayed inside FlexPay payment tab (replaces static logo when offers enabled)

**Modal Inclusion:**
- Template includes `flexpayInfoModal.isml` once per page (controlled by `request.custom.flexpayModalIncluded` flag)
- Modal NOT included for `payment-selector` context (modal already included by PDP/checkout summary)

---

#### `flexpayInfoModal.isml`

**Path:** `templates/default/flexpay/flexpayInfoModal.isml`

**Purpose:** Educational modal explaining FlexPay payment process with dynamic content from API.

**Content Sources:**
- **Static content:** Modal structure, navigation buttons, FlexPay logo URL
- **Dynamic content:** All text populated by JavaScript from API `marketingContent` object

**Modal Sections:**

| Section | Dynamic Content Source | Description |
|---------|----------------------|-------------|
| **Title** | `marketingContent.header` | Main promotional headline with monthly payment |
| **Subtitle** | `marketingContent.subheader` | Brief value proposition |
| **3-Step Process** | `marketingContent.steps` | Visual guide (choose, enter info, enjoy) |
| **Disclosure** | `marketingContent.disclaimer` | Legal text with APR ranges and lending partner links |
| **FAQ** | `marketingContent.faqs` | Categorized questions/answers with accordion UI |

**Navigation:**
- **Info View** (default): Shows title, subtitle, steps, disclosure, FAQ button
- **FAQ View**: Shows FAQ categories and accordion
- **Back Button**: Returns from FAQ view to info view

**JavaScript Integration:**
- Modal HTML is static skeleton
- Content populated by `flexpayOfferWidgets.js` on modal show event
- Markdown formatting (`**bold**`, `[link](url)`) converted to HTML client-side

**FAQ Structure:**
```javascript
faqs: {
  header: "Frequently Asked Questions",
  items: [
    {
      category: "GENERAL",
      questions: [
        { question: "How does FlexPay work?", answer: "..." }
      ]
    },
    {
      category: "PAYMENTS & INSTALLMENTS",
      questions: [...]
    }
  ]
}
```

**Features:**
- **Category Tabs**: Switch between FAQ categories (GENERAL, PAYMENTS & INSTALLMENTS, etc.)
- **Accordion**: Expand/collapse individual FAQ items
- **Markdown Support**: API text with `**bold**` and `[link](url)` converted to HTML
- **Responsive**: Adapts to mobile and desktop layouts

### FlexPay Core Scripts

| File | Purpose |
|------|---------|
| `flexpay.js` | Main module exports (config, api, constants) |
| `flexpayAPI.js` | API client for OAuth, orders, transactions, offers |
| `flexpayConfig.js` | Site preference configuration reader |
| `flexpayConstants.js` | Transaction status and job result constants |
| `flexpayJobs.js` | Scheduled job implementations (capture, refund, void) |
| `flexpayOffers.js` | Marketing offers business logic |
| `processor/flexpayPayment.js` | Payment processor hooks (Handle, Authorize) |

### FlexPay Client-Side JavaScript

| File | Purpose |
|------|---------|
| `flexpaycheckout.js` | FlexPay checkout flow handler |
| `flexpayOfferWidgets.js` | Offer widget initialization, AJAX, modal population |

---

## Metadata Changes

### Site Preferences (`system-objecttype-extensions.xml`)

New preferences added for marketing offers:

| Attribute ID | Type | Default | Description |
|--------------|------|---------|-------------|
| `flexPayMarketingOfferEnabled` | Boolean | `false` | Enable marketing offer messages |
| `flexPayMarketingOfferMinAmount` | Double | `50.0` | Minimum amount for offers |
| `flexPayShowPdpMarketingOffer` | Boolean | `true` | Show offers on PDP |

---

**Document Version:** 1.1  
**Last Updated:** February 2026  
**Cartridge Version:** 0.9.2
