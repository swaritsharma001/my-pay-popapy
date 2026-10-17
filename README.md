# PopPay

PopPay is a lightweight UPI payment gateway for merchants. UPI funds move directly to the merchant's own UPI ID; PopPay does not collect or hold customer funds. Payment confirmation is based on permitted Gmail credit alerts.

## Project layout

- `server/` — Express API, MongoDB models, OAuth, payment matching and the single background worker loop.
- `client/` — React + Vite merchant dashboard and hosted checkout.
- `sdk/checkout.js` — dependency-free browser checkout SDK, served at `/checkout.js`.
- `examples/merchant-node/` — sample merchant Express backend and Buy page.

## Local setup

Requirements: Node.js 20+, npm, and a MongoDB replica set (MongoDB Atlas is suitable). Payment matching and unmatched-payment claims use MongoDB transactions, which are not available on a standalone MongoDB server.

```sh
npm install
cp server/.env.example server/.env
```

Fill in `server/.env` locally. Do not commit it:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB replica-set connection string |
| `GMAIL_CLIENT_ID` | Google OAuth web application client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_REDIRECT_URI` | Exact callback URL configured in Google Cloud |
| `GMAIL_POLL_INTERVAL_MS` | Worker interval in milliseconds; defaults to 10000 if empty or below 1000 |
| `JWT_SECRET` | Long random key used to sign PopPay dashboard and OAuth-state tokens |
| `ENCRYPTION_KEY` | Exactly 32 random bytes encoded as 64 hex characters or base64; used for AES-256-GCM token encryption |

Generate values for `JWT_SECRET` and `ENCRYPTION_KEY` with a cryptographically secure random generator, for example `openssl rand -hex 32`. Keep them private and back them up securely; changing `ENCRYPTION_KEY` makes existing Gmail and signing secrets unreadable.

Start the API and Vite preview together:

```sh
npm run dev:poppay
```

The dashboard/checkout runs on port 5000 and proxies `/api` and `/checkout.js` to the API on port 3001. Build the client with `npm run build:client`; run the API alone with `npm run start:poppay`. Run automated tests with:

```sh
npm run test:poppay
```

The server starts the Gmail poller, order expiry job, and webhook retry worker from one `setInterval` loop. It polls only merchants with active pending orders.

## Google Cloud Gmail OAuth

1. Create or select a Google Cloud project and enable the **Gmail API**.
2. Configure the OAuth consent screen. While the app is in **Testing** mode, add each Gmail account used for testing under **Test users**.
3. Create an OAuth client with application type **Web application**.
4. Add the exact callback URI from `GMAIL_REDIRECT_URI` to **Authorized redirect URIs**. For the local API, use:
   `http://localhost:3001/api/v1/merchant/gmail/callback`
5. Put the OAuth client ID and secret in `server/.env`. The callback URI must match the Google Cloud value exactly.
6. Sign in to PopPay, enter the merchant UPI ID, and select **Connect Gmail**. Approve only the requested `gmail.readonly` scope.
7. The current FamApp parser is mapped to `no-reply@famapp.in` by default. Allowed sender addresses can be edited in Settings. Disconnecting attempts to revoke the Google token and deletes the locally stored encrypted refresh token.

PopPay requests only `https://www.googleapis.com/auth/gmail.readonly`. For new Gmail history entries, it searches message IDs for allowed sender addresses before fetching headers or bodies. A full email body is fetched only after the From address is allowed and the Authentication-Results header confirms `dkim=pass` for `famapp.in`.

## API

All API routes are under `/api/v1`. JSON request bodies use `Content-Type: application/json`. Dashboard and merchant settings routes require `Authorization: Bearer <JWT>`. Order creation and merchant order reads require `Authorization: Bearer <pp_secret_...>`. A merchant secret key is high-entropy and stored as an indexed SHA-256 digest; it is not retrievable after creation.

### Authentication and merchant setup

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | none | Create merchant and return JWT plus one-time public, secret, signing, and webhook credentials |
| `POST` | `/auth/login` | none | Sign in and return JWT |
| `GET` | `/me` | JWT | Current merchant profile and connection state; never returns secrets |
| `PUT` | `/merchant/upi` | JWT | Set UPI ID, for example `shop@okaxis` |
| `GET` | `/merchant/gmail/connect` | JWT | Return the signed Google OAuth URL |
| `GET` | `/merchant/gmail/callback` | OAuth state | Exchange the callback code and store the encrypted refresh token |
| `POST` | `/merchant/gmail/disconnect` | JWT | Revoke when possible and delete Gmail token data |
| `PUT` | `/merchant/gmail/allowed-senders` | JWT | Set one or more allowed sender email addresses |
| `POST` | `/merchant/keys/regenerate` | JWT | Replace public/secret/signing/webhook credentials; returns new secrets once |
| `PUT` | `/merchant/webhook` | JWT | Set an HTTPS merchant webhook URL |

Signup example:

```sh
curl -X POST "$API/auth/signup" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example Shop","email":"owner@example.com","password":"a-long-password"}'
```

Save the `secretKey`, `signingSecret`, and `webhookSecret` from signup or key regeneration securely. The API does not return them again. The client shows them only during the one-time onboarding/rotation flow.

### Orders and checkout

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/orders` | Secret key | Create a ten-minute pending order |
| `GET` | `/orders/:id` | Secret key | Read one merchant-owned order |
| `GET` | `/orders?status=&page=&limit=` | Secret key | List the merchant's own orders |
| `GET` | `/checkout/:orderId` | public | Return merchant name, exact payable amount, status, expiry, and UPI intent |
| `GET` | `/checkout/:orderId/status` | public | Poll status; paid responses include payment ID, UTR, signing signature, and optional redirect URL |
| `POST` | `/dev/simulate-payment` | JWT, non-production only | Feed a fake credit alert through the matching engine |

Create-order body:

```json
{
  "amount": "499.00",
  "receipt": "receipt-123",
  "redirectUrl": "https://shop.example/order-complete"
}
```

`amount` is in rupees, at least ₹1.00, with no more than two decimal places. `redirectUrl` is optional and must use HTTPS. Successful responses include `order_id`, `baseAmount`, the unique `payableAmount`, `status`, `expiresAt`, and `checkoutUrl`. Amount arithmetic and comparison use integer paise. A unique partial MongoDB index prevents two pending orders for one merchant from sharing a payable amount. If all 99 paise suffixes are occupied, the API returns `429`.

The UPI intent is generated from the merchant UPI ID and contains the exact payable amount and order ID. Public checkout endpoints never return merchant email, key hashes, or secrets.

### Gmail matching, unmatched payments, and dashboard data

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/dashboard/stats` | JWT | Today's collection, payment count, success rate, and recent payments |
| `GET` | `/dashboard/orders?status=&page=&limit=` | JWT | Dashboard order list |
| `GET` | `/payments?page=&limit=` | JWT | Payment history |
| `GET` | `/unmatched?page=&limit=` | JWT | Unmatched payments and claimable orders |
| `POST` | `/unmatched/:id/claim` | JWT | Claim a payment for a matching merchant order |

The worker ignores recognized FamApp debit alerts. For credit alerts, it matches merchant, integer-paise amount, transaction time within the order window, unused UTR, and unused Gmail message ID. A match inserts the payment, marks the order paid, and queues the webhook in one MongoDB transaction. Emails that match no order are available for manual review.

### Webhooks

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/webhooks/logs` | JWT | Read delivery history |
| `POST` | `/webhooks/:id/retry` | JWT | Queue another delivery attempt |

The webhook body is JSON with `event: "payment.success"`, `order_id`, `payment_id`, `utr`, `amount`, and `paid_at`. `X-PopPay-Signature` is a lowercase hex HMAC-SHA256 over the exact raw JSON request body using the merchant webhook secret. Non-2xx responses and network timeouts retry with exponential backoff, at most six attempts, and a ten-second request timeout.

### SDK

Load the SDK from `https://<your-poppay-origin>/checkout.js`:

```html
<script src="https://<your-poppay-origin>/checkout.js"></script>
<button id="pay-btn" type="button">Pay</button>
<script>
  const pp = new PopPay({
    key: "pp_live_your_public_key",
    order_id: "order_your_order_id",
    name: "Example Shop",
    handler: (payment) => {
      // Send payment to your backend and verify it there.
    },
    onDismiss: () => {}
  });
  document.getElementById("pay-btn").onclick = () => pp.open();
</script>
```

The SDK only uses the public key. It opens a centered desktop modal or mobile bottom sheet, listens only to messages from the checkout origin and its own iframe, and emits `payment.success`, `payment.failed`, and `modal.closed`.

The sample merchant backend in `examples/merchant-node/` demonstrates server-side order creation with the secret key, signature verification with `POPPAY_SIGNING_SECRET`, and raw-body webhook verification with `POPPAY_WEBHOOK_SECRET`.

## Testing

### Automated tests

```sh
npm run test:poppay
```

The FamApp parser tests include the supplied debit example (which must never mark an order paid) and a credit-format fixture using the same labels. The prompt did not contain a raw FamApp credit email, so validate the credit pattern against a real masked credit sample before relying on it in a live merchant account.

### Simulate a payment

1. Sign up, set a UPI ID, and create an order using the secret key.
2. Copy the order ID and dashboard JWT.
3. In non-production, call:

   ```sh
   curl -X POST "$API/dev/simulate-payment" \
     -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"order_id":"order_abcdefghijkl","utr":"123456789012"}'
   ```

   The simulator uses the order's exact payable amount and current time, then calls the same matching transaction used by the Gmail worker. Confirm the order becomes `PAID`, the checkout status changes, a payment appears in the dashboard, and a webhook is queued when a webhook URL is configured. The endpoint is disabled when `NODE_ENV=production`.

### Test with a real small payment

1. Connect a Gmail account that can receive FamApp payment alerts, and configure the allowed sender.
2. Use a small amount in a controlled test order; note the exact payable amount including paise.
3. Pay that exact amount to the merchant's UPI ID with a UPI app.
4. Confirm Gmail delivers a FamApp **credit** alert with `dkim=pass` for `famapp.in`; debit alerts are intentionally ignored.
5. Keep the checkout open and verify that it becomes paid, then check the dashboard, UTR, webhook delivery status, and return URL.

Use the curl checks in `server/STEP2-TESTS.md` to test signup/login, profile, UPI, webhook configuration, and key regeneration.

## Privacy

PopPay reads Gmail metadata for new messages to identify allowed senders and verify authentication results. It retrieves email bodies only for allowed senders after FamApp DKIM passes. It does not store email bodies. Payment records retain the amount, UTR, transaction time, and Gmail message ID for deduplication; the parser's transaction ID and counterparty name are not retained.
