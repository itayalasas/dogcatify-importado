// Test simple de firma HMAC para verificar compatibilidad

const crypto = require('crypto');

const SECRET_KEY = "Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx";

// Payload con orden garantizado de claves
const orderedPayload = {
  event: "order.created",
  order_id: "test-order-123",
  timestamp: "2025-10-22T01:38:33.520Z",
  data: {
    id: "test-order-123",
    status: "pending",
    total_amount: 230
  }
};

const payloadString = JSON.stringify(orderedPayload);

console.log("=== TEST DE FIRMA HMAC ===\n");
console.log("Secret Key:", SECRET_KEY);
console.log("\nPayload String:");
console.log(payloadString);
console.log("\nPayload Length:", payloadString.length);

// Generar firma HMAC SHA-256
const signature = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(payloadString)
  .digest('hex');

console.log("\n=== FIRMA GENERADA ===");
console.log(signature);

console.log("\n=== PARA USAR EN HEADERS ===");
console.log("X-DogCatiFy-Signature:", signature);
console.log("X-DogCatiFy-Event: order.created");
console.log("\nBody:");
console.log(payloadString);
