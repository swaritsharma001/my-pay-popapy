# PopPay step 2 endpoint checks

Start the API with `npm run start:poppay` after `server/.env` has valid `MONGO_URI` and `JWT_SECRET` values. The secret key and webhook secret are returned only by signup or key regeneration; save them when returned.

```sh
export API=http://localhost:3001/api/v1
```

1. **Sign up** — expect `201`, a JWT, merchant profile, and one-time credentials:
   ```sh
   curl -i "$API/auth/signup" -H 'Content-Type: application/json' \
     -d '{"name":"Example Shop","email":"owner@example.com","password":"correct-horse-battery"}'
   ```
   Save the returned JWT as `TOKEN`. Repeat the same email to check the `409` duplicate response.
2. **Log in** — expect `200` with a JWT; a wrong password should return `401`:
   ```sh
   curl -i "$API/auth/login" -H 'Content-Type: application/json' \
     -d '{"email":"owner@example.com","password":"correct-horse-battery"}'
   ```
3. **Get merchant profile** — expect `200`; no authorization header should return `401`:
   ```sh
   curl -i "$API/me" -H "Authorization: Bearer $TOKEN"
   ```
4. **Set UPI ID** — expect `200`; try an invalid value such as `not-an-upi-id` to check validation:
   ```sh
   curl -i -X PUT "$API/merchant/upi" -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' -d '{"upiId":"shop.name@okaxis"}'
   ```
5. **Set webhook URL** — expect `200`; an `http://` URL should return `400`:
   ```sh
   curl -i -X PUT "$API/merchant/webhook" -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' -d '{"webhookUrl":"https://merchant.example/poppay"}'
   ```
6. **Regenerate credentials** — expect new one-time credentials. The previous public/secret key pair and webhook secret are replaced:
   ```sh
   curl -i -X POST "$API/merchant/keys/regenerate" \
     -H "Authorization: Bearer $TOKEN"
   ```

Run the validation and credential unit tests with `npm run test:poppay`.
