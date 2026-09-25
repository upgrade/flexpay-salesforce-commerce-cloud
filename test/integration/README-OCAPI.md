# Flexpay Integration Tests

This directory contains integration tests that test the checkout flow with Flexpay, including both VCC and Direct Settle integration modes.

## Setup

### 1. OCAPI Configuration

The tests use **OCAPI (Open Commerce API)** to dynamically change site preferences during test execution. This allows testing both VCC and Direct Settle modes without manual configuration changes among other things.

#### Enable OCAPI Data API

1. **Log in to Business Manager**
2. **Navigate to**: Administration > Site Development > Open Commerce API Settings
3. **Select Type**: Data API
4. **Add this configuration**:

```json
{
  "_v": "18.1",
  "clients": [
    {
      "client_id": "your client id",
      "resources": [
        {
          "methods": [
            "get"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/code_versions"
        },
        {
          "methods": [
            "patch",
            "delete"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/code_versions/*"
        },
        {
          "methods": [
            "post"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/jobs/*/executions"
        },
        {
          "methods": [
            "get"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/jobs/*/executions/*"
        },
        {
          "methods": [
            "post"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/sites/*/cartridges"
        },
        {
          "methods": [
            "get",
            "patch"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/sites/**"
        },
        {
          "methods": [
            "post"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/site_preferences/preference_groups/*/preferences/*"
        }
      ]
    }
  ]
}
```
5. **Select Type**: Shop API
6. **Add this configuration**:
```json
{
  "_v": "18.1",
  "clients": [
    {
      "client_id": "your client id",
      "resources": [
        {
          "methods": [
            "get",
            "patch"
          ],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "resource_id": "/orders/*"
        }
      ]
    }
  ]
}
```
#### Create OCAPI Client Credentials

1. **Navigate to**: Administration > Organization > WebDAV Client Permissions
2. **Add a new client** with:
   - **Client ID**: A unique identifier (e.g., `flexpay-integration-test`)
   - **Client Password**: A secure password

3. **Grant permissions**:
   - Business Manager User
   - OCAPI Data API access

### 2. Configuration File

Create a `config.json` file in the `/test/integration` directory:

```bash
cd test/integration
cp config.json.example config.json
```

Edit `config.json` with your OCAPI credentials:

```json
{
  "ocapi": {
    "hostname": "your-sandbox.demandware.net",
    "siteId": "RefArch",
    "clientId": "your-ocapi-client-id",
    "clientSecret": "your-ocapi-client-secret"
    "bmUser": "your bm user name",
    "bmPassword": "your bm password"
  }
}
```



## Test Structure

### Test Flow

The integration tests follow this structure:

1. **Before Hook**: Authenticates with OCAPI and obtains an access token
2. **Setup Checkout Flow**: 
   - Sets the `flexPayIntegrationType` site preference via OCAPI
   - Creates a new basket
   - Adds a product to cart
   - Completes shipping information
   - Completes billing and payment information
3. **Test Case**: Calls the `FlexpayOrder-Create` endpoint and verifies the response

### Test Suites

#### Direct Settle Integration
Tests the checkout flow when `flexPayIntegrationType = 'DIRECT_SETTLE'`:
- Uses Flexpay Direct Settle payment method
- Authorizes payment with Flexpay
- Stores transaction ID for later capture

#### VCN Integration
Tests the checkout flow when `flexPayIntegrationType = 'VCN'`:
- Uses Flexpay VCN (Virtual Credit Number) 
- Retrieves virtual card details from Flexpay
- Creates a credit card payment instrument

## Helper Modules

### OCAPI Helper (`helpers/ocapi.js`)

Provides methods for interacting with SFCC OCAPI:

#### URL Builders
- `getDataApiBaseUrl(hostname, siteId)` - Returns Data API base URL for site-specific endpoints
- `getDataApiNoSiteBaseUrl(hostname)` - Returns Data API base URL for non-site-specific endpoints
- `getShopApiBaseUrl(hostname, siteId)` - Returns Shop API base URL for storefront operations

#### Authentication
- `getAccessToken(hostname, clientId, clientSecret)` - Authenticates using client credentials and returns an OAuth token for Data API access
- `getBMUserAccessToken(hostname, bmUser, bmPassword, clientId, clientSecret)` - Authenticates as a Business Manager user and returns an OAuth token with elevated privileges

#### Site Preferences
- `updateSitePreference(hostname, siteId, accessToken, preferences)` - Updates one or more site preferences in the FlexPay preference group. Accepts an object with preference IDs as keys (e.g., `{ c_flexPayIntegrationType: 'VCN' }`)
- `getSitePreference(hostname, siteId, accessToken)` - Retrieves all site preferences from the FlexPay preference group

#### Data & Shop API Operations
- `getCodeVersions(hostname, accessToken)` - Retrieves list of code versions deployed on the instance
- `getOrder(hostname, siteId, orderId, accessToken)` - Retrieves order details via Shop API
- `createJobExecution(hostname, accessToken, jobId)` - Triggers a job execution (e.g., for batch processing)

