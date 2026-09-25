# FlexPay Salesforce Commerce Cloud Integration

Integrate FlexPay Buy Now Pay Later (BNPL) payment solution with Salesforce Commerce Cloud (SFCC) using the Storefront Reference Architecture (SFRA).

## Features

- **Virtual Credit Card (VCC)** - FlexPay provides a virtual card processed through your existing credit card processor
- **Direct Settle** - Payments processed directly through FlexPay API with full lifecycle management
- **Marketing Offers** - Display "from $X/month" promotional messages on product pages, checkout order summary, and checkout payment tab
- Automated payment capture, refund, and void via scheduled jobs
- Multi-language support (English, French Canadian)

**Version:** 0.9.2  
**Compatible with:** SFRA 5.x, 6.x, and 7.x

## Documentation

| Document | Description |
|----------|-------------|
| 📖 [FlexPay SFRA Guide](./documentation/FlexPay_SFRA_Guide.md) | Complete installation, configuration, and usage guide |
| 📄 [File Changes Reference](./documentation/FlexPay_SFRA_File_Changes.md) | Detailed comparison of modified files from base SFRA |

## Quick Start

### 1. Install Dependencies

```bash
# Use Node.js 12.21.0 for SFRA 5.x/6.x, Node.js 18 for SFRA 7.x
npm install
```

### 2. Configure SFCC Connection

Edit `dw.json` with your instance details:

```json
{
  "hostname": "your-instance.dx.commercecloud.salesforce.com",
  "username": "your-username",
  "password": "your-password:your-webdav-client-id",
  "code-version": "version1"
}
```

### 3. Build & Upload

```bash
# Build for your SFRA version
npm run build:v7    # SFRA 7.x
npm run build:v6    # SFRA 6.x
npm run build:v5    # SFRA 5.x

# Upload cartridges
npm run upload:v7   # SFRA 7.x
npm run upload:v6   # SFRA 6.x
npm run upload:v5   # SFRA 5.x
```

### 4. Import Metadata & Configure

See the [FlexPay SFRA Guide](./documentation/FlexPay_SFRA_Guide.md#installation) for detailed steps on:
- Importing metadata (system objects, services, payment methods, jobs)
- Configuring cartridge path
- Setting up site preferences
- Scheduling transaction management jobs

## NPM Scripts

### Build

| Command | Description |
|---------|-------------|
| `npm run build` | Build JS and CSS (default: SFRA 7.x) |
| `npm run build:v7` | Build for SFRA 7.x |
| `npm run build:v6` | Build for SFRA 6.x |
| `npm run build:v5` | Build for SFRA 5.x |
| `npm run compile:js` | Compile JavaScript only |
| `npm run compile:scss` | Compile SCSS only |

### Upload

| Command | Description |
|---------|-------------|
| `npm run upload:v7` | Upload SFRA 7.x cartridges |
| `npm run upload:v6` | Upload SFRA 6.x cartridges |
| `npm run upload:v5` | Upload SFRA 5.x cartridges |
| `npm run uploadCartridge` | Upload cartridges (legacy) |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests |
| `npm run cover` | Run tests with coverage report |
| `npm run test:integration` | Run integration tests |

### Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint and Stylelint |

## Cartridge Structure

```
cartridges/
├── int_flexpay/           # Core integration (controllers, scripts, templates)
├── int_flexpay_sfra/      # SFRA 6.x/7.x frontend assets
└── int_flexpay_sfra5/     # SFRA 5.x frontend assets
```

## Order Custom Attributes

Orders placed with FlexPay include these custom attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `isFlexPay` | Boolean | Indicates a FlexPay order |
| `flexPayOrderID` | String | FlexPay order identifier |
| `flexPayTransactionId` | String | FlexPay transaction identifier |
| `flexPayTransactionStatus` | Enum | `AUTHORIZED`, `CAPTURED`, `VOIDED`, `REFUNDED` |

## Marketing Offers

FlexPay supports promotional "from pricing" messaging to increase conversion:

**Display Locations:**
- **Product Detail Pages** - Show "from $X/month" based on product price below pricing section
- **Checkout Order Summary** - Display offer message below Grand Total in checkout sidebar
- **Checkout Payment Tab** - Display available payment plans in FlexPay payment method section (replaces static logo)

**Features:**
- **Info Modal** - Educational modal with 3-step process explanation and FAQ section
- **API-Driven Content** - Modal content (header, steps, FAQs) dynamically populated from FlexPay API
- **Configurable Threshold** - Set minimum amount for offer display via site preferences
- **Markdown Support** - API text supports `**bold**` and `[link](url)` formatting
- **Graceful Degradation** - Widget stays hidden if API call fails

**Configuration:**
Configure offers in Business Manager under **Site Preferences → FlexPay**:
- `flexPayMarketingOfferEnabled` - Master toggle (default: `false`)
- `flexPayMarketingOfferMinAmount` - Minimum purchase amount (default: `50.0`)
- `flexPayShowPdpMarketingOffer` - Show/hide PDP offers (default: `true`)

See the [FlexPay SFRA Guide](./documentation/FlexPay_SFRA_Guide.md#marketing-offers-feature) for complete details.

## Support

- Review the [FlexPay SFRA Guide](./documentation/FlexPay_SFRA_Guide.md) for troubleshooting
- Check the FlexPay developer portal for API documentation
- Contact FlexPay merchant support for account issues
