# FlexPay SFRA Installation Guide

This guide describes how to install and configure the FlexPay cartridge for Salesforce Commerce Cloud (SFCC) using the Storefront Reference Architecture (SFRA).

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Cartridge Architecture](#cartridge-architecture)
- [Installation](#installation)
  - [Step 1: Download the Cartridge](#step-1-download-the-cartridge)
  - [Step 2: Build Client-Side Resources](#step-2-build-client-side-resources)
  - [Step 3: Upload Cartridges](#step-3-upload-cartridges)
  - [Step 4: Import Metadata](#step-4-import-metadata)
  - [Step 5: Configure Cartridge Path](#step-5-configure-cartridge-path)
- [Configuration](#configuration)
  - [Site Preferences](#site-preferences)
  - [Service Configuration](#service-configuration)
- [Marketing Offers Feature](#marketing-offers-feature)
- [Template Integration](#template-integration)
- [Controllers](#controllers)
- [Client-Side JavaScript](#client-side-javascript)
- [Transaction Management with Jobs](#transaction-management-with-jobs)
  - [Processing Transactions](#processing-transactions)
  - [Status Mapping](#status-mapping)
  - [Job Details](#job-details)
- [Payment Flow](#payment-flow)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Go-Live Checklist](#go-live-checklist)
- [Best Practices](#best-practices)
- [FAQ](#faq)

---

## Overview

The FlexPay cartridge enables SFCC storefronts to accept FlexPay as a Buy Now Pay Later (BNPL) payment method. It supports two integration modes:

| Integration Type | Description |
|-----------------|-------------|
| **VCN (Virtual Card Number)** | FlexPay provides a virtual card number that is processed through your existing credit card processor |
| **Direct Settle** | Payments are processed directly through FlexPay's API with authorization, capture, refund, and void support |

**Version:** 0.9.2  
**Compatible with:** SFRA 5.x, 6.x, and 7.x

---

## Prerequisites

Before installing the FlexPay cartridge, ensure you have:

- [ ] Node.js 12.21.0 for SFRA 5.x, 6.x or Node.js 18 for SFRA 7.x
- [ ] SFCC instance with SFRA 5.x, 6.x, or 7.x installed
- [ ] FlexPay merchant account with:
  - Client ID
  - Client Secret
  - SDK Key (provided by FlexPay for your integration type)

---

## Cartridge Architecture

The FlexPay integration consists of three cartridges:

| Cartridge | Purpose |
|-----------|---------|
| `int_flexpay` | Core integration logic - API client, payment processor, controllers, templates |
| `int_flexpay_sfra` | SFRA 6.x/7.x frontend assets (compiled JS/CSS) |
| `int_flexpay_sfra5` | SFRA 5.x frontend assets (compiled JS/CSS) |

### Key Components

```
int_flexpay/
├── controllers/
│   ├── CheckoutServices.js    # Handles payment submission
│   └── FlexpayOrder.js        # Order creation, confirmation, cancellation
│                              # GetOffer endpoint for marketing offers
├── scripts/
│   ├── flexpay.js             # Main module exports
│   ├── flexpayAPI.js          # API integration layer (OAuth, orders, transactions)
│   │                          # getOffers() method for marketing offers
│   ├── flexpayConfig.js       # Site preference configuration
│   │                          # Marketing offer preference methods
│   ├── flexpayConstants.js    # Transaction statuses and constants
│   ├── flexpayJobs.js         # Scheduled jobs (capture/refund/void)
│   ├── flexpayOffers.js       # Marketing offer business logic
│   │                          # Eligibility, fetching, formatting
│   └── processor/
│       └── flexpayPayment.js  # Payment processor hooks
└── templates/
    └── default/
        ├── checkout/          # Checkout templates
        │   ├── orderTotalSummary.isml    # Checkout summary with offer
        │   └── billing/paymentOptions/   # Payment method templates
        ├── product/
        │   └── productDetails.isml       # PDP with offer widget
        ├── common/
        │   └── scripts.isml              # Conditional JS loading
        └── flexpay/           # FlexPay-specific templates
            ├── flexPayMethodTab.isml     # Payment tab with offer/logo
            ├── flexPaymentContent.isml   # Hidden form fields
            ├── flexPaySummary.isml       # Order confirmation
            ├── flexpayOfferWidget.isml   # Reusable offer widget
            └── flexpayInfoModal.isml     # Educational modal with FAQ
```

---

## Installation

### Step 1: Download the Cartridge

Clone or download the FlexPay cartridge repository:

```bash
git clone <repository-url>
cd flexpay-salesforce-commerce-cloud
```

### Step 2: Build Client-Side Resources

The FlexPay cartridge requires compiled JavaScript and CSS files. Follow these steps based on your SFRA version:

#### 2a. Configure the Base Cartridge Path

Edit `package.json` and set the path to your SFRA base cartridge:

```json
{
  "paths": {
    "base": "../storefront-reference-architecture-7.0.1/cartridges/app_storefront_base/"
  }
}
```

> **Note:** Adjust the path based on your SFRA version (5.x, 6.x, or 7.x).

#### 2b. Install Dependencies

```bash
npm install
```

#### 2c. Build Assets

**For SFRA 7.x:**
```bash
npm run build:v7
# or
npm run build
```

**For SFRA 6.x:**
```bash
npm run build:v6
```

**For SFRA 5.x:**
```bash
npm run build:v5
```

This compiles:
- JavaScript: `cartridges/int_flexpay_sfra/cartridge/static/default/js/`
- CSS: `cartridges/int_flexpay_sfra/cartridge/static/default/css/`

### Step 3: Upload Cartridges

#### 3a. Configure SFCC Connection

Edit `dw.json` with your instance details:

```json
{
  "hostname": "your-instance.dx.commercecloud.salesforce.com",
  "username": "your-username",
  "password": "your-password:your-webdav-client-id",
  "code-version": "version1"
}
```

#### 3b. Upload Cartridges

**For SFRA 6.x/7.x:**
```bash
npm run upload:v6
# or
npm run upload:v7
```

**For SFRA 5.x:**
```bash
npm run upload:v5
```

Alternatively, use UX Studio or the VSCode Prophet plugin to upload the cartridges.

### Step 4: Import Metadata

The FlexPay integration requires custom attributes and service configurations to be imported into Business Manager.

#### 4a. Import System Object Extensions

1. In Business Manager, navigate to: **Administration → Site Development → Import & Export**
2. Click **Upload** and select: `metadata/flexpay/meta/system-objecttype-extensions.xml`
3. After upload, click **Import** and select the uploaded file
4. Choose **MERGE** mode and click **Import**

This creates:
- **Site Preferences**: `flexPayEnabled`, `flexPayIntegrationType`, `flexPaySdkKey`, `flexPayClientId`, `flexPayClientSecret`, `flexPayMode`, `flexPayMarketingOfferEnabled`, `flexPayMarketingOfferMinAmount`, `flexPayShowPdpMarketingOffer`
- **Order Attributes**: `isFlexPay`, `flexPayTransactionId`, `flexPayOrderID`, `flexPayTransactionStatus`

#### 4b. Import Services Configuration

1. Upload and import: `metadata/flexpay/services.xml`
2. Choose **MERGE** mode

This creates:
- `FlexpayService` - Main API service
- `FlexpayAuthService` - OAuth authentication service
- `flexpay.profile` - Service profile with timeout settings

#### 4c. Import Site-Specific Configuration

1. Navigate to: `metadata/flexpay/sites/`
2. **Rename** the `RefArch` folder to match your site ID (found in **Administration → Sites → Manage Sites**)
3. Compress the `flexpay` folder to create `flexpay-meta-import.zip`
4. Upload and import the zip file in **MERGE** mode

This imports:
- Payment method: `FLEXPAY`
- Payment processor: `FLEXPAY_PAYMENT`
- Default site preferences

#### 4d. Import Jobs (Optional - for Direct Settle)

1. Upload and import: `metadata/flexpay/jobs.xml`
2. Choose **MERGE** mode

This creates three scheduled jobs:
- `FlexPayCapture` - Captures authorized transactions
- `FlexPayRefund` - Refunds cancelled orders
- `FlexPayVoid` - Voids cancelled authorizations

### Step 5: Configure Cartridge Path

1. In Business Manager, navigate to: **Administration → Sites → Manage Sites → [Your Site] → Settings**
2. Add cartridges to the beginning of the cartridge path:

**For SFRA 6.x/7.x:**
```
int_flexpay_sfra:int_flexpay:app_storefront_base
```

**For SFRA 5.x:**
```
int_flexpay_sfra5:int_flexpay:app_storefront_base
```

> **Important:** The FlexPay cartridges must appear before `app_storefront_base` in the path.

---

## Configuration

### Site Preferences

Navigate to: **Merchant Tools → Site Preferences → Custom Preferences → FlexPay**

#### Core Configuration

| Preference | Type | Description | Required |
|-----------|------|-------------|----------|
| `flexPayEnabled` | Boolean | Master toggle to enable/disable FlexPay | Yes |
| `flexPayIntegrationType` | Enum | `VCN` for Virtual Card Number mode, `DIRECT_SETTLE` for Direct Settle mode | Yes |
| `flexPaySdkKey` | Password | Your FlexPay SDK Key (provided by FlexPay) | Yes |
| `flexPayClientId` | Password | Your FlexPay API client ID | Yes |
| `flexPayClientSecret` | Password | Your FlexPay API client secret | Yes |
| `flexPayMode` | Enum | `sandbox` or `production` | Yes |

#### Marketing Offers Configuration

| Preference | Type | Default | Description |
|-----------|------|---------|-------------|
| `flexPayMarketingOfferEnabled` | Boolean | `false` | Master toggle for marketing offer messaging |
| `flexPayMarketingOfferMinAmount` | Double | `50.0` | Minimum purchase amount (in dollars) to display offers |
| `flexPayShowPdpMarketingOffer` | Boolean | `true` | Show/hide promotional messages on Product Detail Pages |

### Service Configuration

The services are pre-configured with these endpoints:

| Mode | Auth URL | API URL |
|------|----------|---------|
| Sandbox | `https://partner.credify.tech/api/auth/v1/oauth/token` | `https://partner.credify.tech/api/flexpay/v1` |
| Production | `https://partner.upgrade.com/api/auth/v1/oauth/token` | `https://partner.upgrade.com/api/flexpay/v1` |

To view/modify services: **Administration → Operations → Services**

---

## Marketing Offers Feature

> **New in v0.9.2:** FlexPay supports promotional "from pricing" messaging with an educational info modal.

### Overview

Marketing offers display estimated monthly payment amounts to customers throughout their shopping journey. This feature helps customers understand payment options and can increase conversion rates.

**Display Locations (3 Placements):**

| Location | Context ID | CSS Class | Description |
|----------|------------|-----------|-------------|
| **Product Detail Page (PDP)** | `pdp` | `flexpay-offer-pdp` | Below product price, above "Add to Cart" button |
| **Checkout Order Summary** | `checkout-summary` | `flexpay-offer-checkout-summary` | Below Grand Total in the order summary sidebar |
| **Payment Method Selector Tab** | `payment-selector` | `flexpay-offer-inline` | Inside the FlexPay payment tab (replaces static logo) |

### Info Modal

When customers click the info icon (ⓘ), an educational modal opens with:
- **Header**: Promotional headline with monthly payment amount
- **Subtitle**: Brief value proposition
- **3-Step Process**: Visual guide explaining how FlexPay works
- **Disclosure**: Legal text with APR ranges and lending partner links
- **FAQ Section**: Categorized frequently asked questions with accordion UI

**Key Feature:** All modal content (header, subtitle, steps, disclosure, FAQs) is dynamically populated from the FlexPay API `marketingContent` object. Markdown formatting (`**bold**`, `[link](url)`) in API text is converted to HTML client-side.

### Enabling Marketing Offers

1. Navigate to: **Merchant Tools → Site Preferences → Custom Preferences → FlexPay**
2. Set `flexPayMarketingOfferEnabled` to `true`
3. Configure threshold:
   - `flexPayMarketingOfferMinAmount` - Products below this amount won't show offers (default: $50)
4. Toggle PDP messaging with `flexPayShowPdpMarketingOffer` (default: `true`)

### How It Works

When enabled, the cartridge:
1. Checks if the product/cart total meets the minimum amount threshold
2. Calls the FlexPay `/marketing/offers` API endpoint with the purchase amount
3. Receives available payment plans (terms, APR, monthly payment, marketing content)
4. Displays the lowest monthly payment as "or from $XX/mo with FlexPay"

### API Details

| Aspect | Details |
|--------|---------|
| **Endpoint** | `POST /marketing/offers` |
| **Controller** | `FlexpayOrder-GetOffer` |
| **Business Logic** | `flexpayOffers.js` |
| **API Integration** | `flexpayAPI.js` → `getOffers()` |

**Response Structure:**
```javascript
{
  orders: [{
    offers: [{
      numberOfPayments: 12,
      apr: 0.15,
      minApr: 0,
      maxApr: 0.36,
      monthlyPayment: 52.21,
      grandTotal: 626.52,
      marketingContent: [{
        header: "Just select Flex Pay...",
        subheader: "Buy now. Pay over time...",
        steps: [...],
        disclaimer: "*Payment plans...",
        faqs: { header: "FAQ", items: [...] }
      }]
    }]
  }]
}
```

### Templates

| Template | Purpose |
|----------|---------|
| `flexpay/flexpayOfferWidget.isml` | Reusable offer widget (used in all 3 locations) |
| `flexpay/flexpayInfoModal.isml` | Educational modal with 3-step process and FAQs |
| `product/productDetails.isml` | PDP template override with offer widget |
| `checkout/orderTotalSummary.isml` | Order summary override with offer widget |

### Client-Side JavaScript

| File | Purpose |
|------|---------|
| `flexpayOfferWidgets.js` | Widget initialization, AJAX calls, modal population |

**Key Functions:**
- `initializeOfferWidgets()` - Finds and initializes all offer widgets on page
- `fetchOfferData()` - AJAX call to `FlexpayOrder-GetOffer`
- `handleOfferSuccess()` - Renders offer and stores data for modal
- `populateInfoModal()` - Dynamically populates modal from API content
- `markdownToHtml()` - Converts markdown formatting to HTML

### Customization

To customize the appearance:
1. Edit SCSS: `cartridges/int_flexpay_sfra/cartridge/client/default/scss/flexpay.scss`
2. Modify templates in `cartridges/int_flexpay/cartridge/templates/default/flexpay/`
3. Update client-side logic in `cartridges/int_flexpay_sfra/cartridge/client/default/js/flexpayOfferWidgets.js`

---

## Template Integration

The FlexPay cartridge overrides the following SFRA templates:

### Payment Options Tab

**File:** `templates/default/checkout/billing/paymentOptions/paymentOptionsTabs.isml`

Adds the FlexPay payment tab:
```isml
<isif condition="${paymentOption.ID === 'FLEXPAY' && dw.system.Site.getCurrent().getCustomPreferenceValue('flexPayEnabled')}">
    <isinclude template="flexpay/flexPayMethodTab" />
</isif>
```

### Payment Options Content

**File:** `templates/default/checkout/billing/paymentOptions/paymentOptionsContent.isml`

Adds the FlexPay payment content panel:
```isml
<isif condition="${paymentOption.ID === 'FLEXPAY'}">
    <isinclude template="flexpay/flexPaymentContent" />
</isif>
```

### Payment Summary

**File:** `templates/default/checkout/billing/paymentOptions/paymentOptionsSummary.isml`

Shows FlexPay in the order summary:
```isml
<isif condition="${payment.paymentMethod === 'FLEXPAY'}">
    <isinclude template="flexpay/flexPaySummary" />
</isif>
```

### Product Detail Page

**File:** `templates/default/product/productDetails.isml`

Adds offer widget and FlexPay assets:
```isml
<isscript>
    assets.addJs('/js/flexpayOfferWidgets.js');
    assets.addCss('/css/flexpay.css');
</isscript>

<isif condition="${offerEnabled && showPdpPromo && product.price.sales.value}">
    <isinclude template="flexpay/flexpayOfferWidget" />
</isif>
```

### Order Total Summary

**File:** `templates/default/checkout/orderTotalSummary.isml`

Adds offer widget below Grand Total:
```isml
<isif condition="${pdict.order && pdict.order.totals && pdict.order.totals.grandTotal}">
    <isinclude template="flexpay/flexpayOfferWidget" />
</isif>
```

### FlexPay-Specific Templates

| Template | Purpose |
|----------|---------|
| `flexpay/flexPayMethodTab.isml` | Payment method tab with offer widget or logo |
| `flexpay/flexPaymentContent.isml` | Hidden form fields and data attributes |
| `flexpay/flexPaySummary.isml` | Order confirmation summary display |
| `flexpay/flexpayOfferWidget.isml` | Marketing offers widget (reusable) |
| `flexpay/flexpayInfoModal.isml` | Educational modal with FAQ support |

---

## Controllers

### CheckoutServices.js

**Location:** `int_flexpay/cartridge/controllers/CheckoutServices.js`

Prepends the base `SubmitPayment` action to:
- Validate billing form for FlexPay payments
- Create FlexPay payment instrument in basket
- Handle SFRA version differences (5.x vs 6.x/7.x)

### FlexpayOrder.js

**Location:** `int_flexpay/cartridge/controllers/FlexpayOrder.js`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `FlexpayOrder-Create` | POST | Creates FlexPay order and returns redirect URL |
| `FlexpayOrder-Confirm` | GET | Handles return from FlexPay, creates SFCC order |
| `FlexpayOrder-Cancel` | GET | Handles cancellation, redirects to checkout |
| `FlexpayOrder-GetOffer` | GET | Retrieves marketing offers (used by offer widget) |

**GetOffer Endpoint Details:**

**URL:** `FlexpayOrder-GetOffer` (HTTPS required)

**Parameters:**
- `amount` (required, float) - Purchase amount in dollars
- `currency` (optional, string) - Currency code, defaults to `USD`

**Response Format:**
```json
{
  "success": true,
  "offers": [{
    "term": 12,
    "monthlyPayment": { "formatted": "$52.21" },
    "apr": 0.15,
    "minApr": 0,
    "maxApr": 0.36,
    "displayText": "Pay $52.21/mo for 12 months",
    "marketingContent": {
      "header": "Just select Flex Pay...",
      "subheader": "Buy now. Pay over time...",
      "steps": [...],
      "disclaimer": "*Payment plans...",
      "faqs": {
        "header": "FAQ",
        "items": [
          {
            "category": "GENERAL",
            "questions": [
              {
                "question": "How does FlexPay work?",
                "answer": "FlexPay offers..."
              }
            ]
          }
        ]
      }
    }
  }]
}
```

**Implementation Chain:**
1. Client-side: `flexpayOfferWidgets.js` → AJAX call to `FlexpayOrder-GetOffer`
2. Controller: `FlexpayOrder.js` → Calls `flexpayOffers.getAvailableOffers()`
3. Business Logic: `flexpayOffers.js` → Calls `flexpayAPI.getOffers()`
4. API Client: `flexpayAPI.js` → POST to `/marketing/offers` endpoint

---

## Client-Side JavaScript

### checkout.js

**Location:** `int_flexpay_sfra/cartridge/client/default/js/checkout/checkout.js`

Modifies the checkout flow to:
- Skip the default `placeOrder` AJAX call when FlexPay is selected
- Allow FlexPay's custom place order flow to take over

Key modification in `placeOrder` stage:
```javascript
if ($('.payment-information').data('payment-method-id') === 'FLEXPAY') {
    return defer;  // Let flexpaycheckout.js handle the flow
}
```

### flexpaycheckout.js

**Location:** `int_flexpay_sfra/cartridge/client/default/js/flexpaycheckout.js`

Handles the FlexPay-specific checkout flow:
1. Intercepts the "Place Order" button click
2. Calls `FlexpayOrder-Create` to create the FlexPay order
3. Redirects customer to FlexPay's hosted checkout page
4. Customer is redirected back to `FlexpayOrder-Confirm` after approval

### flexpayOfferWidgets.js

**Location:**
- `int_flexpay_sfra/cartridge/client/default/js/flexpayOfferWidgets.js` (SFRA 6.x/7.x)
- `int_flexpay_sfra5/cartridge/client/default/js/flexpayOfferWidgets.js` (SFRA 5.x)

Manages marketing offers display:

| Feature | Description |
|---------|-------------|
| Widget Initialization | Finds all `[data-flexpay-offer]` elements and fetches offer data |
| AJAX Handling | Calls `FlexpayOrder-GetOffer` with amount/currency |
| Modal Population | Dynamically populates info modal from API `marketingContent` |
| Markdown Conversion | Converts `**bold**` and `[link](url)` to HTML |
| FAQ Accordion | Handles category tabs and accordion expand/collapse |
| PDP Updates | Refreshes offers when product variant changes |
| Error Handling | Graceful degradation - widget stays hidden on error |

**Event Handlers:**
- `product:afterAttributeSelect` - Updates PDP offer when variant changes
- `payment:methodSelected` - Initializes widgets when FlexPay tab shown
- `show.bs.modal` - Populates modal content when opened

---

## Transaction Management with Jobs

> **Note:** This section applies to **Direct Settle** integration only. VCN integration uses your existing credit card processor for transaction management.

### Overview

Processing orders (capture, void, refund) in Commerce Cloud updates the transaction status with FlexPay. **We strongly recommend using Commerce Cloud jobs** to keep your order statuses synchronized.

When a customer completes checkout with FlexPay:
1. FlexPay **authorizes** a charge for the order amount
2. The charge enters a **pending state** on the customer's account
3. **Authorized charges expire** if not captured within the agreed timeframe (check your FlexPay Merchant Config)

---

### Set Up Order Management Jobs

#### 1. Import Jobs

Ensure you've imported `metadata/flexpay/jobs.xml` (see [Step 4d](#step-4-import-metadata)).

#### 2. Verify Jobs in Business Manager

1. Go to **Administration → Operations → Jobs**
2. Verify these jobs were created:
   - `FlexPayCapture`
   - `FlexPayRefund`
   - `FlexPayVoid`

#### 3. Enable and Schedule Each Job

For each job:
1. Click on the job name
2. Go to the **Schedule and History** tab
3. Check the **Enabled** box
4. Set the **Recurring Interval** (recommended: every hour or at least daily)
5. Click **Apply**

#### 4. Verify Site Scope

1. Go to the **Job Steps** tab
2. Ensure your site is included in the **Scope**
3. Click **Apply** if changes were made

---

### Processing Transactions

#### Capture

Capturing a charge does the following:
- Charges the authorized amount to the customer's FlexPay account
- Begins the customer's billing cycle
- Triggers the fund transfer from FlexPay to the merchant

**How to Trigger Capture:**

1. Go to **Business Manager → Merchant Tools → Ordering → Orders**
2. Click on the FlexPay order
3. Change **Order Status** to **OPEN** (if not already)
4. The `FlexPayCapture` job will capture all orders matching:
   - Order Status: `NEW` or `OPEN`
   - FlexPay Transaction Status: `AUTHORIZED`


---

#### Void

If you have **not yet captured** a charge, you can cancel its authorization by voiding it.

**How to Trigger Void:**

1. Go to **Business Manager → Merchant Tools → Ordering → Orders**
2. Click on the FlexPay order
3. Change **Order Status** to **CANCELLED**
4. The `FlexPayVoid` job will void all orders matching:
   - Order Status: `CANCELLED`
   - FlexPay Transaction Status: `AUTHORIZED`

> ⚠️ **Warning:** Voiding is irreversible. FlexPay cannot reinstate voided funds.

---

#### Refund

If you have **already captured** a charge, you can reverse it by refunding the amount.

**How to Trigger Refund:**

1. Go to **Business Manager → Merchant Tools → Ordering → Orders**
2. Click on the FlexPay order
3. Change **Order Status** to **CANCELLED**
4. The `FlexPayRefund` job will refund all orders matching:
   - Order Status: `CANCELLED`
   - FlexPay Transaction Status: `CAPTURED`

> ⚠️ **Warning:** Refunding is irreversible. FlexPay cannot reinstate refunded funds.

---

### Status Mapping

| Payment State | FlexPay Transaction Status | SFCC Order Status | SFCC Payment Status | Available Action(s) |
|--------------|---------------------------|-------------------|---------------------|---------------------|
| Authorized | `AUTHORIZED` | NEW / OPEN | Not Paid | Capture, Void |
| Voided | `VOIDED` | CANCELLED | Not Paid | None |
| Captured | `CAPTURED` | OPEN / COMPLETED | Paid | Refund |
| Refunded | `REFUNDED` | CANCELLED | Not Paid | None |

---

### Job Details

#### FlexPayCapture

| Property | Value |
|----------|-------|
| **Job ID** | `FlexPayCapture` |
| **Script** | `int_flexpay/cartridge/scripts/flexpayJobs.js` |
| **Function** | `paymentCapture` |
| **Query** | `(status = NEW OR status = OPEN) AND custom.flexPayTransactionStatus = AUTHORIZED` |
| **Actions** | Calls FlexPay capture API, sets `flexPayTransactionStatus = CAPTURED`, sets Payment Status to `PAID`, sets Order Status to `COMPLETED` |

#### FlexPayRefund

| Property | Value |
|----------|-------|
| **Job ID** | `FlexPayRefund` |
| **Script** | `int_flexpay/cartridge/scripts/flexpayJobs.js` |
| **Function** | `paymentRefund` |
| **Query** | `status = CANCELLED AND custom.flexPayTransactionStatus = CAPTURED` |
| **Actions** | Calls FlexPay refund API, sets `flexPayTransactionStatus = REFUNDED` |

#### FlexPayVoid

| Property | Value |
|----------|-------|
| **Job ID** | `FlexPayVoid` |
| **Script** | `int_flexpay/cartridge/scripts/flexpayJobs.js` |
| **Function** | `paymentVoid` |
| **Query** | `status = CANCELLED AND custom.flexPayTransactionStatus = AUTHORIZED` |
| **Actions** | Calls FlexPay void API, sets `flexPayTransactionStatus = VOIDED` |

---

### View Processed Transactions

Go to **Business Manager → Merchant Tools → Ordering → Orders** to view all processed orders.

For FlexPay orders, check:

#### Attributes Tab
Contains FlexPay payment details:
- `isFlexPay` - Boolean indicating FlexPay order
- `flexPayOrderID` - FlexPay order identifier
- `flexPayTransactionId` - FlexPay transaction identifier
- `flexPayTransactionStatus` - Current transaction status

#### Payment Tab
- **Pre-capture:** Order Payment shows as "Not Paid"
- **Post-capture:** Payment shows as "Paid"

---

### Recommended Job Schedule

| Job | Recommended Frequency | Notes |
|-----|----------------------|-------|
| `FlexPayCapture` | Every hour or at least daily | Capture before authorization expires |
| `FlexPayRefund` | Daily | Process cancelled orders |
| `FlexPayVoid` | Daily | Process cancelled authorizations |

> **Tip:** Run `FlexPayVoid` before `FlexPayRefund` if both run at the same time, as voiding is preferred over refunding for uncaptured transactions (avoids unnecessary fees).

---

### Job Result Codes

The jobs return status codes you can use for monitoring:

| Code | Meaning |
|------|---------|
| `Job-FlexPayCapture-Completed-Successfully` | All captures succeeded |
| `Job-FlexPayCapture-Completed-With-Errors` | Some captures failed (check logs) |
| `Job-FlexPayCapture-Error` | Job failed to run |
| `Job-FlexPayRefund-Completed-Successfully` | All refunds succeeded |
| `Job-FlexPayRefund-Completed-With-Errors` | Some refunds failed (check logs) |
| `Job-FlexPayRefund-Error` | Job failed to run |
| `Job-FlexPayVoid-Completed-Successfully` | All voids succeeded |
| `Job-FlexPayVoid-Completed-With-Errors` | Some voids failed (check logs) |
| `Job-FlexPayVoid-Error` | Job failed to run |

---

## Payment Flow

### Direct Settle Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Customer      │     │      SFCC       │     │    FlexPay      │
│   (Browser)     │     │   (Storefront)  │     │      API        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. Select FlexPay    │                       │
         │─────────────────────>│                       │
         │                       │                       │
         │  2. Click Place Order │                       │
         │─────────────────────>│                       │
         │                       │                       │
         │                       │  3. POST /orders      │
         │                       │─────────────────────>│
         │                       │                       │
         │                       │  4. Return redirectUrl│
         │                       │<─────────────────────│
         │                       │                       │
         │  5. Redirect to FlexPay                      │
         │<─────────────────────│                       │
         │                       │                       │
         │  6. Customer completes checkout on FlexPay   │
         │─────────────────────────────────────────────>│
         │                       │                       │
         │  7. Redirect back with order_id              │
         │<─────────────────────────────────────────────│
         │                       │                       │
         │  8. FlexpayOrder-Confirm                     │
         │─────────────────────>│                       │
         │                       │                       │
         │                       │  9. POST /transactions (auth)
         │                       │─────────────────────>│
         │                       │                       │
         │                       │ 10. Auth response     │
         │                       │<─────────────────────│
         │                       │                       │
         │                       │ 11. Create SFCC order │
         │                       │                       │
         │                       │ 12. PUT /orders/{id}/confirmation
         │                       │─────────────────────>│
         │                       │                       │
         │ 13. Order Confirmation│                       │
         │<─────────────────────│                       │
         │                       │                       │
```

### VCN Flow

The VCN (Virtual Card Number) flow is similar, but instead of authorization:
1. After FlexPay approval, the cartridge calls `GET /orders/{id}/card`
2. FlexPay returns virtual card details
3. The cartridge creates a credit card payment instrument
4. Standard credit card processing takes over

---

## Testing

### Unit Tests

Run unit tests with:
```bash
npm test
```

Test files are located in `test/unit/int_flexpay/scripts/`:
- `flexpayAPITest.js` - API integration tests
- `flexpayConfigTest.js` - Configuration tests
- `flexpayJobsTest.js` - Job tests
- `processor/flexpayPaymentTest.js` - Payment processor tests

### Code Coverage

Generate coverage report:
```bash
npm run cover
```

View report at `coverage/lcov-report/index.html`

### Integration Tests

Run integration tests (requires SFCC connection):
```bash
npm run test:integration
```

Configure `test/integration/it.config.js` with your instance details.

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| FlexPay tab not showing | Verify `flexPayEnabled` is `true` and cartridge path is correct |
| API authentication errors | Check `flexPayClientId` and `flexPayClientSecret` |
| "Place Order" does nothing | Ensure client-side JS is compiled and uploaded |
| Orders not capturing | Verify `FlexPayCapture` job is scheduled and enabled |
| Wrong environment | Check `flexPayMode` preference (sandbox vs production) |
| Offers not showing on PDP | Verify `flexPayMarketingOfferEnabled` and `flexPayShowPdpMarketingOffer` are both `true`, product price meets minimum threshold |
| Offers show error message | Check FlexPay API credentials, verify `/marketing/offers` endpoint is accessible |
| Info modal doesn't open | Ensure Bootstrap modal JavaScript is loaded, check browser console for errors |
| Modal content not updating | Verify offer widget stores data correctly, check `marketingContent` in API response |

### Logging

FlexPay operations are logged to the standard SFCC log. Filter logs by:
- Log prefix: `Flexpay`
- Custom log category: Check service communication logs

### Support

For technical support:
- Review the API documentation at FlexPay developer portal
- Check SFCC documentation for cartridge development
- Contact FlexPay merchant support

---

## Appendix

### Order Custom Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `isFlexPay` | Boolean | Indicates FlexPay order |
| `flexPayOrderID` | String | FlexPay order identifier |
| `flexPayTransactionId` | String | FlexPay transaction identifier |
| `flexPayTransactionStatus` | Enum | AUTHORIZED, CAPTURED, VOIDED, REFUNDED |

### Site Preference Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `flexPayEnabled` | Boolean | `true` | Master toggle for FlexPay |
| `flexPayIntegrationType` | Enum | `VCN` | Integration type |
| `flexPaySdkKey` | Password | - | SDK Key from FlexPay |
| `flexPayClientId` | Password | - | API client ID |
| `flexPayClientSecret` | Password | - | API client secret |
| `flexPayMode` | Enum | `sandbox` | Environment mode |
| `flexPayMarketingOfferEnabled` | Boolean | `false` | Enable marketing offers |
| `flexPayMarketingOfferMinAmount` | Double | `50.0` | Minimum amount for offers |
| `flexPayShowPdpMarketingOffer` | Boolean | `true` | Show offers on PDP |

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/oauth/token` | POST | Get access token |
| `/orders` | POST | Create FlexPay order |
| `/orders/{id}/confirmation` | PUT | Confirm order placement |
| `/orders/{id}/card` | GET | Get VCN details |
| `/transactions` | POST | Authorize payment |
| `/transactions/{id}/capture` | POST | Capture payment |
| `/transactions/{id}/refund` | POST | Refund payment |
| `/transactions/{id}/void` | POST | Void authorization |
| `/marketing/offers` | POST | Get marketing offers with content |

---

## File Changes Review

For a detailed comparison of all files that the FlexPay cartridge overrides from the base SFRA cartridge (`app_storefront_base`), see:

📄 **[FlexPay_SFRA_File_Changes.md](./FlexPay_SFRA_File_Changes.md)**

This document includes:
- Complete file-by-file comparison with diffs
- SFRA 5.x vs 6.x differences
- All new FlexPay-specific files

### Quick Summary

| Category | Modified | New | Total |
|----------|----------|-----|-------|
| Templates | 6 | 5 | 11 |
| Controllers | 1 (extended) | 1 | 2 |
| Client-Side JS | 1 | 2 | 3 |
| Scripts | 2 | 1 | 3 |

---

## Go-Live Checklist

Before going live with FlexPay, verify the following:

### Configuration
- [ ] `flexPayEnabled` is set to `true`
- [ ] `flexPayMode` is set to `production`
- [ ] `flexPayIntegrationType` is set to `VCN` or `DIRECT_SETTLE` as appropriate
- [ ] Production `flexPayClientId` and `flexPayClientSecret` are configured
- [ ] Production `flexPaySdkKey` is configured
- [ ] Cartridge path is correctly configured for your site
- [ ] Marketing offers configured (if using):
  - [ ] `flexPayMarketingOfferEnabled` set as desired
  - [ ] `flexPayMarketingOfferMinAmount` set appropriately
  - [ ] `flexPayShowPdpMarketingOffer` set as desired

### Metadata
- [ ] All metadata files have been imported (system objects, services, payment methods, jobs)
- [ ] `FLEXPAY` payment method is enabled and active
- [ ] `FLEXPAY_PAYMENT` processor is configured

### Jobs (Direct Settle Only)
- [ ] `FlexPayCapture` job is enabled and scheduled
- [ ] `FlexPayRefund` job is enabled and scheduled
- [ ] `FlexPayVoid` job is enabled and scheduled
- [ ] Job site scope includes your production site

### Testing
- [ ] Complete a test transaction in sandbox mode
- [ ] Verify order creation in SFCC
- [ ] Verify transaction appears in FlexPay dashboard
- [ ] Test capture job execution
- [ ] Test void/refund job execution
- [ ] Verify email confirmations are sent

### Frontend
- [ ] FlexPay logo appears in payment options
- [ ] FlexPay tab is selectable during checkout
- [ ] "Place Order" redirects to FlexPay successfully
- [ ] Return from FlexPay creates order correctly
- [ ] Order confirmation page displays correctly
- [ ] Marketing offers display correctly on PDP (if enabled)
- [ ] Marketing offers display in checkout summary (if enabled)
- [ ] Offers update when product variant changes
- [ ] Info modal opens and displays correct content
- [ ] FAQ accordion works correctly in modal

---

## Best Practices

### Authorization Expiration

> ⚠️ **Important:** Authorized FlexPay charges **expire** if not captured within the capture deadline specified in your partnership agreement with FlexPay.

**Recommendations:**
- Configure the `FlexPayCapture` job to run frequently (every hour)
- Monitor job execution logs for failures
- Set up alerts for orders stuck in `AUTHORIZED` status

### Order Status Synchronization

Keep SFCC order statuses synchronized with FlexPay:
- Use SFCC jobs for transaction management
- Avoid manual status changes that bypass the FlexPay API
- Monitor the `flexPayTransactionStatus` custom attribute

### Error Handling

The FlexPay cartridge logs all API calls and errors. To troubleshoot:
1. Check **Administration → Operations → Jobs** for job execution history
2. Review custom logs filtered by `Flexpay` prefix
3. Check service communication logs at **Administration → Operations → Services → FlexpayService**

### Security

- Store `flexPayClientSecret` and `flexPaySdkKey` securely (they are stored as password type in site preferences)
- Use HTTPS for all API communications (enforced by the cartridge)
- PII data is filtered from logs (see `filterLogString` in `flexpayAPI.js`)

### Multi-Site Considerations

If you have multiple sites:
1. Configure site preferences separately for each site
2. Ensure job scope includes all relevant sites
3. Consider different SDK Keys for different sites/brands

---

## FAQ

### General

**Q: What's the difference between VCN and Direct Settle?**

| Feature | VCN | Direct Settle |
|---------|-----|---------------|
| Integration | Uses your existing credit card processor | Direct FlexPay API |
| Capture | Handled by credit card processor | FlexPay jobs/API |
| Refund | Handled by credit card processor | FlexPay jobs/API |
| Setup complexity | Lower (reuses existing CC flow) | Higher (requires job setup) |

**Q: Which integration type should I use?**
- **VCN:** If you already have a credit card processor and want minimal changes
- **Direct Settle:** If you want full control over the payment lifecycle or don't have a CC processor

### Checkout

**Q: Why doesn't FlexPay appear as a payment option?**
- Verify `flexPayEnabled` is `true`
- Check that `FLEXPAY` payment method is active
- Confirm cartridge path includes `int_flexpay` and `int_flexpay_sfra`
- Check for JavaScript errors in browser console

**Q: Customer gets an error after returning from FlexPay**
- Check `FlexpayOrder-Confirm` controller logs
- Verify the FlexPay order ID is being passed correctly
- Ensure billing address was saved before redirect

### Marketing Offers

**Q: Why don't offers appear on product pages?**
- Verify `flexPayMarketingOfferEnabled` is `true`
- Verify `flexPayShowPdpMarketingOffer` is `true`
- Check that product price meets minimum threshold (`flexPayMarketingOfferMinAmount`)
- Check browser console for AJAX errors

**Q: Why is the info modal content not updating?**
- Verify the FlexPay API returns `marketingContent` in the offers response
- Check browser console for JavaScript errors
- Ensure Bootstrap modal library is loaded

### Jobs

**Q: Orders are not being captured automatically**
- Verify `FlexPayCapture` job is enabled
- Check job is scheduled to run
- Verify site is included in job scope
- Review job execution history for errors

**Q: Can I capture/refund/void manually?**
- Currently, manual transaction management is not supported
- For programmatic access, use the `flexpayAPI.js` methods directly or use the jobs provided

**Q: What happens if a job fails?**
- Failed orders remain in their current state
- Job logs show error details for each failed order
- The job continues processing remaining orders
- Re-run the job after fixing the issue

---

**Document Version:** 1.1  
**Last Updated:** February 2026  
**Cartridge Version:** 0.9.2
