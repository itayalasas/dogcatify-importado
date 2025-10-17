# 🌐 Ejemplos de Webhooks en Diferentes Lenguajes

Implementaciones listas para usar del receptor de webhooks de DogCatiFy en varios lenguajes de programación.

---

## 🟨 JavaScript / Node.js + Express

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function verifySignature(payload, signature) {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/dogcatify', (req, res) => {
  const signature = req.headers['x-dogcatify-signature'];

  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Responder rápido
  res.status(200).json({ received: true });

  // Procesar asíncrono
  const { event, order_id, data } = req.body;

  switch (event) {
    case 'order.created':
      console.log('Nueva orden:', order_id);
      // Guardar en tu base de datos
      break;
    case 'order.updated':
      console.log('Orden actualizada:', order_id);
      break;
  }
});

app.listen(3000);
```

---

## 🐍 Python + Flask

```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json
import os

app = Flask(__name__)
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET')

def verify_signature(payload, signature):
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)

@app.route('/webhooks/dogcatify', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Dogcatify-Signature')

    if not verify_signature(request.json, signature):
        return jsonify({'error': 'Invalid signature'}), 401

    # Responder rápido
    response = jsonify({'received': True})

    # Procesar
    data = request.json
    event = data.get('event')
    order_id = data.get('order_id')

    if event == 'order.created':
        print(f'Nueva orden: {order_id}')
        # Guardar en tu base de datos
    elif event == 'order.updated':
        print(f'Orden actualizada: {order_id}')

    return response

if __name__ == '__main__':
    app.run(port=3000)
```

---

## 🐍 Python + FastAPI

```python
from fastapi import FastAPI, Request, HTTPException, Header
import hmac
import hashlib
import json
import os
from typing import Optional

app = FastAPI()
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET')

def verify_signature(payload: dict, signature: str) -> bool:
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)

@app.post('/webhooks/dogcatify')
async def webhook(
    request: Request,
    x_dogcatify_signature: Optional[str] = Header(None)
):
    payload = await request.json()

    if not verify_signature(payload, x_dogcatify_signature):
        raise HTTPException(status_code=401, detail='Invalid signature')

    # Procesar
    event = payload.get('event')
    order_id = payload.get('order_id')
    data = payload.get('data')

    if event == 'order.created':
        print(f'Nueva orden: {order_id}')
        # Guardar en tu base de datos
        # await save_order_to_db(data)

    return {'received': True}
```

---

## 🟦 PHP + Laravel

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    public function dogcatify(Request $request)
    {
        $signature = $request->header('X-Dogcatify-Signature');

        // Verificar firma
        $payload = json_encode($request->all());
        $expected = hash_hmac('sha256', $payload, env('WEBHOOK_SECRET'));

        if (!hash_equals($signature, $expected)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        // Responder rápido
        $response = response()->json(['received' => true]);

        // Procesar webhook
        $event = $request->input('event');
        $orderId = $request->input('order_id');
        $data = $request->input('data');

        switch ($event) {
            case 'order.created':
                Log::info("Nueva orden: {$orderId}");
                // Guardar en base de datos
                // Order::create([...]);
                break;

            case 'order.updated':
                Log::info("Orden actualizada: {$orderId}");
                // Actualizar
                // Order::find($orderId)->update([...]);
                break;
        }

        return $response;
    }
}
```

---

## 🔴 Ruby + Sinatra

```ruby
require 'sinatra'
require 'json'
require 'openssl'

WEBHOOK_SECRET = ENV['WEBHOOK_SECRET']

post '/webhooks/dogcatify' do
  request.body.rewind
  payload_body = request.body.read
  signature = request.env['HTTP_X_DOGCATIFY_SIGNATURE']

  # Verificar firma
  expected = OpenSSL::HMAC.hexdigest(
    OpenSSL::Digest.new('sha256'),
    WEBHOOK_SECRET,
    payload_body
  )

  halt 401, { error: 'Invalid signature' }.to_json unless Rack::Utils.secure_compare(signature, expected)

  # Procesar
  payload = JSON.parse(payload_body)
  event = payload['event']
  order_id = payload['order_id']
  data = payload['data']

  case event
  when 'order.created'
    puts "Nueva orden: #{order_id}"
    # Guardar en base de datos
  when 'order.updated'
    puts "Orden actualizada: #{order_id}"
  end

  { received: true }.to_json
end
```

---

## 🟣 C# + ASP.NET Core

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("webhooks")]
public class WebhookController : ControllerBase
{
    private readonly string _webhookSecret;

    public WebhookController(IConfiguration configuration)
    {
        _webhookSecret = configuration["WEBHOOK_SECRET"];
    }

    [HttpPost("dogcatify")]
    public async Task<IActionResult> DogCatify()
    {
        var signature = Request.Headers["X-Dogcatify-Signature"].ToString();

        // Leer body
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        // Verificar firma
        var expectedSignature = ComputeHmacSha256(body, _webhookSecret);
        if (signature != expectedSignature)
        {
            return Unauthorized(new { error = "Invalid signature" });
        }

        // Parsear payload
        var payload = JsonSerializer.Deserialize<WebhookPayload>(body);

        // Procesar
        switch (payload.Event)
        {
            case "order.created":
                Console.WriteLine($"Nueva orden: {payload.OrderId}");
                // Guardar en base de datos
                break;
            case "order.updated":
                Console.WriteLine($"Orden actualizada: {payload.OrderId}");
                break;
        }

        return Ok(new { received = true });
    }

    private string ComputeHmacSha256(string message, string secret)
    {
        var encoding = new UTF8Encoding();
        var keyBytes = encoding.GetBytes(secret);
        var messageBytes = encoding.GetBytes(message);

        using var hmac = new HMACSHA256(keyBytes);
        var hashBytes = hmac.ComputeHash(messageBytes);

        return BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
    }
}

public class WebhookPayload
{
    public string Event { get; set; }
    public string OrderId { get; set; }
    public object Data { get; set; }
}
```

---

## 🟢 Go + Gin

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "io/ioutil"
    "log"
    "net/http"
    "os"

    "github.com/gin-gonic/gin"
)

type WebhookPayload struct {
    Event   string      `json:"event"`
    OrderID string      `json:"order_id"`
    Data    interface{} `json:"data"`
}

func verifySignature(payload []byte, signature string, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedSignature := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

func webhookHandler(c *gin.Context) {
    signature := c.GetHeader("X-Dogcatify-Signature")
    secret := os.Getenv("WEBHOOK_SECRET")

    // Leer body
    body, err := ioutil.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot read body"})
        return
    }

    // Verificar firma
    if !verifySignature(body, signature, secret) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
        return
    }

    // Parsear payload
    var payload WebhookPayload
    if err := json.Unmarshal(body, &payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
        return
    }

    // Procesar
    switch payload.Event {
    case "order.created":
        log.Printf("Nueva orden: %s", payload.OrderID)
        // Guardar en base de datos
    case "order.updated":
        log.Printf("Orden actualizada: %s", payload.OrderID)
    }

    c.JSON(http.StatusOK, gin.H{"received": true})
}

func main() {
    r := gin.Default()
    r.POST("/webhooks/dogcatify", webhookHandler)
    r.Run(":3000")
}
```

---

## ☕ Java + Spring Boot

```java
import org.springframework.web.bind.annotation.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Map;

@RestController
@RequestMapping("/webhooks")
public class WebhookController {

    private static final String WEBHOOK_SECRET = System.getenv("WEBHOOK_SECRET");

    @PostMapping("/dogcatify")
    public Map<String, Object> handleWebhook(
        @RequestBody Map<String, Object> payload,
        @RequestHeader("X-Dogcatify-Signature") String signature
    ) throws Exception {

        // Verificar firma
        String expectedSignature = computeHmacSha256(payload.toString(), WEBHOOK_SECRET);

        if (!signature.equals(expectedSignature)) {
            throw new RuntimeException("Invalid signature");
        }

        // Procesar
        String event = (String) payload.get("event");
        String orderId = (String) payload.get("order_id");

        switch (event) {
            case "order.created":
                System.out.println("Nueva orden: " + orderId);
                // Guardar en base de datos
                break;
            case "order.updated":
                System.out.println("Orden actualizada: " + orderId);
                break;
        }

        return Map.of("received", true);
    }

    private String computeHmacSha256(String message, String secret)
        throws NoSuchAlgorithmException, InvalidKeyException {

        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(
            secret.getBytes(StandardCharsets.UTF_8),
            "HmacSHA256"
        );
        mac.init(secretKeySpec);

        byte[] hashBytes = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        for (byte b : hashBytes) {
            sb.append(String.format("%02x", b));
        }

        return sb.toString();
    }
}
```

---

## 🔵 TypeScript + Express

```typescript
import express, { Request, Response } from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

interface WebhookPayload {
  event: string;
  order_id: string;
  data: any;
  timestamp: string;
}

function verifySignature(payload: any, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/dogcatify', (req: Request, res: Response) => {
  const signature = req.headers['x-dogcatify-signature'] as string;

  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.status(200).json({ received: true });

  const payload: WebhookPayload = req.body;

  switch (payload.event) {
    case 'order.created':
      console.log('Nueva orden:', payload.order_id);
      // await saveOrderToDatabase(payload.data);
      break;
    case 'order.updated':
      console.log('Orden actualizada:', payload.order_id);
      break;
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

---

## 📝 Notas Importantes

### Estructura del Payload

Todos los webhooks envían esta estructura:

```json
{
  "event": "order.created",
  "order_id": "uuid-de-la-orden",
  "data": {
    "id": "uuid",
    "partner_id": "uuid",
    "customer_id": "uuid",
    "status": "pending",
    "total_amount": 5000,
    "items": [...],
    "created_at": "2025-10-17T10:00:00Z"
  },
  "timestamp": "2025-10-17T10:00:00Z"
}
```

### Headers Enviados

- `X-DogCatiFy-Signature`: Firma HMAC SHA256 del payload
- `X-DogCatiFy-Event`: Tipo de evento
- `Content-Type`: application/json
- `User-Agent`: DogCatiFy-Webhook/1.0

### Eventos Disponibles

- `order.created` - Nueva orden creada
- `order.updated` - Orden actualizada
- `order.cancelled` - Orden cancelada
- `order.completed` - Orden completada

---

## 🔒 Seguridad

**Siempre verifica la firma HMAC** para asegurarte de que el webhook viene de DogCatiFy.

```
expected_signature = HMAC-SHA256(payload, secret_key)
if received_signature != expected_signature:
    reject()
```

---

## 🚀 Deployment

Todos estos ejemplos pueden desplegarse en:
- Heroku
- DigitalOcean
- AWS Lambda
- Google Cloud Functions
- Azure Functions
- Vercel (Node.js/Python)
- Railway

---

## 📞 Soporte

Si tienes problemas implementando en tu lenguaje preferido, consulta:
- **GUIA_WEBHOOKS_PASO_A_PASO.md** - Guía completa
- **INICIO_RAPIDO_WEBHOOKS.md** - Setup rápido
