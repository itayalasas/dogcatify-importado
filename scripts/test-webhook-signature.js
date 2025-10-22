const crypto = require('crypto');

// Secret key from database
const SECRET_KEY = "Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx";

// Example payload (this should match what notify-order-webhook sends)
const payload = {
  "event": "order.created",
  "order_id": "cefa3fab-6c99-4e7f-9346-bb79af016d34",
  "data": {
    "id": "cefa3fab-6c99-4e7f-9346-bb79af016d34",
    "status": "pending",
    "total_amount": 1000,
    "customer_name": "Test Customer",
    "customer_email": "test@example.com"
  },
  "timestamp": "2025-10-21T04:21:27.465Z"
};

// Convert payload to JSON string (THIS IS CRITICAL - must be exactly as sent)
const payloadString = JSON.stringify(payload);

console.log("=== TESTING WEBHOOK SIGNATURE ===\n");
console.log("Secret Key:", SECRET_KEY);
console.log("Secret Key Length:", SECRET_KEY.length);
console.log("\nPayload String:");
console.log(payloadString);
console.log("\nPayload Length:", payloadString.length);

// Generate HMAC signature
const signature = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(payloadString)
  .digest('hex');

console.log("\nGenerated Signature:");
console.log(signature);

console.log("\n=== TEST REQUEST ===\n");
console.log("Headers:");
console.log({
  "Content-Type": "application/json",
  "X-DogCatiFy-Signature": signature,
  "X-DogCatiFy-Event": "order.created"
});

console.log("\nBody:");
console.log(payloadString);

console.log("\n=== VERIFICATION TEST ===\n");

// Verify signature
const verifySignature = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(payloadString)
  .digest('hex');

console.log("Signature matches:", signature === verifySignature);
