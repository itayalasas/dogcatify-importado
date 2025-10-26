# Mercado Pago - Ejemplos de Uso

Esta guía muestra cómo usar las funciones de Mercado Pago en DogCatiFy.

## 1. Tipos e Interfaces Disponibles

```typescript
import {
  MercadoPagoConfig,
  PaymentData,
  PaymentResponse,
  PartnerMercadoPagoConfig,
  isTestEnvironment,
  getPaymentUrl,
  validateCredentialsFormat,
  createSimplePaymentPreference,
  getPartnerMercadoPagoSimpleConfig
} from '@/utils/mercadoPago';
```

## 2. Validar Credenciales

```typescript
import { validateCredentialsFormat } from '@/utils/mercadoPago';

const accessToken = 'TEST-1234567890-102600-abcdef123456-1876395148';
const publicKey = 'TEST-6f0383f8-0e30-4991-bace-c2bb1c5c24c6';

const validation = validateCredentialsFormat(accessToken, publicKey);

if (!validation.isValid) {
  console.error('Error:', validation.error);
  // Mostrar error al usuario
} else {
  console.log('Credenciales válidas');
  // Continuar con el proceso
}
```

## 3. Detectar Ambiente (Test/Producción)

```typescript
import { isTestEnvironment } from '@/utils/mercadoPago';

const accessToken = 'TEST-1234567890...';

if (isTestEnvironment(accessToken)) {
  console.log('Estás en modo TEST/Sandbox');
} else {
  console.log('Estás en modo PRODUCCIÓN');
}
```

## 4. Crear Preferencia de Pago Simple

### Ejemplo básico:

```typescript
import { createSimplePaymentPreference } from '@/utils/mercadoPago';

const paymentData = {
  amount: 1500,
  description: 'Consulta Veterinaria para Tinto',
  payerEmail: 'cliente@ejemplo.com',
  payerName: 'Juan Pérez',
  externalReference: 'ORDER-12345',
  payerPhone: '099123456' // Opcional
};

try {
  const result = await createSimplePaymentPreference(
    partnerConfig.access_token,
    paymentData
  );

  console.log('Preference ID:', result.id);

  // Obtener URL de pago correcta según ambiente
  const paymentUrl = isTestEnvironment(partnerConfig.access_token)
    ? result.sandbox_init_point
    : result.init_point;

  // Abrir URL de pago
  Linking.openURL(paymentUrl);
} catch (error) {
  console.error('Error creando preferencia:', error);
  Alert.alert('Error', 'No se pudo crear la preferencia de pago');
}
```

### Ejemplo con manejo de URLs:

```typescript
import { createSimplePaymentPreference, getPaymentUrl } from '@/utils/mercadoPago';
import { Linking } from 'react-native';

const handlePayment = async () => {
  try {
    const preference = await createSimplePaymentPreference(
      accessToken,
      {
        amount: 2500,
        description: 'Servicio de peluquería',
        payerEmail: user.email,
        payerName: user.displayName,
        externalReference: `SERVICE-${Date.now()}`
      }
    );

    // Usar helper para obtener URL correcta
    const url = getPaymentUrl(preference, accessToken);

    if (url) {
      await Linking.openURL(url);
    } else {
      throw new Error('No se pudo obtener URL de pago');
    }
  } catch (error) {
    Alert.alert('Error', 'No se pudo iniciar el pago');
  }
};
```

## 5. Obtener Configuración Simplificada del Partner

```typescript
import { getPartnerMercadoPagoSimpleConfig } from '@/utils/mercadoPago';

try {
  const config = await getPartnerMercadoPagoSimpleConfig(partnerId);

  console.log('Public Key:', config.publicKey);
  console.log('Es Test?', config.isTestMode);
  console.log('Es OAuth?', config.isOAuth);
  console.log('Conectado desde:', config.connectedAt);

  // Usar el access token para crear pagos
  const preference = await createSimplePaymentPreference(
    config.accessToken,
    paymentData
  );
} catch (error) {
  console.error('Partner no tiene MP configurado:', error);
}
```

## 6. Ejemplo Completo: Pagar un Servicio

```typescript
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Linking } from 'react-native';
import { Button } from '@/components/ui/Button';
import {
  createSimplePaymentPreference,
  getPaymentUrl,
  getPartnerMercadoPagoSimpleConfig
} from '@/utils/mercadoPago';

export default function PayServiceScreen({ service, partner, user }) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      // 1. Obtener configuración del partner
      const mpConfig = await getPartnerMercadoPagoSimpleConfig(partner.id);

      // 2. Crear preferencia de pago
      const preference = await createSimplePaymentPreference(
        mpConfig.accessToken,
        {
          amount: service.price,
          description: `${service.name} - ${partner.business_name}`,
          payerEmail: user.email,
          payerName: user.displayName || 'Usuario',
          externalReference: `SERVICE-${service.id}-${Date.now()}`,
          payerPhone: user.phone
        }
      );

      // 3. Obtener URL de pago correcta
      const paymentUrl = getPaymentUrl(preference, mpConfig.accessToken);

      // 4. Abrir checkout de Mercado Pago
      if (paymentUrl) {
        await Linking.openURL(paymentUrl);
      } else {
        throw new Error('No se pudo obtener URL de pago');
      }
    } catch (error) {
      console.error('Error en pago:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo procesar el pago'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button
        title={`Pagar $${service.price}`}
        onPress={handlePay}
        loading={loading}
      />
    </View>
  );
}
```

## 7. Comparación con el Código Web Original

### Antes (Web):
```javascript
const preference = await createPaymentPreference(accessToken, {
  amount: 1500,
  description: 'Servicio',
  payerEmail: 'test@test.com',
  payerName: 'Test User',
  externalReference: 'REF-123'
});

// En web se usaba window.location
const checkoutUrl = preference.sandbox_init_point || preference.init_point;
```

### Ahora (React Native):
```typescript
import { createSimplePaymentPreference, getPaymentUrl } from '@/utils/mercadoPago';
import { Linking } from 'react-native';

const preference = await createSimplePaymentPreference(accessToken, {
  amount: 1500,
  description: 'Servicio',
  payerEmail: 'test@test.com',
  payerName: 'Test User',
  externalReference: 'REF-123'
});

// En React Native usamos Linking
const paymentUrl = getPaymentUrl(preference, accessToken);
await Linking.openURL(paymentUrl);
```

## 8. URLs de Retorno

Las URLs de retorno están configuradas con el esquema de deep linking de la app:

- **Success**: `dogcatify://payment/success?external_reference=ORDER-123`
- **Failure**: `dogcatify://payment/failure?external_reference=ORDER-123`
- **Pending**: `dogcatify://payment/pending?external_reference=ORDER-123`

Estas URLs abren automáticamente la app cuando el usuario completa el pago en Mercado Pago.

## 9. Ventajas de las Nuevas Funciones

1. **Validación mejorada**: Detecta si las credenciales son TEST o PRODUCCIÓN y valida que coincidan
2. **Detección automática de ambiente**: Usa automáticamente sandbox o producción según las credenciales
3. **Type-safe**: Interfaces TypeScript para todos los datos
4. **Simplificado**: Funciones helper para tareas comunes
5. **Compatible con OAuth y Manual**: Funciona con ambos métodos de configuración
6. **Multi-negocio**: Actualiza todos los negocios del partner automáticamente

## 10. Funciones Avanzadas Existentes

Para casos más complejos, también están disponibles:

- `createMultiPartnerOrder`: Para órdenes con productos de múltiples partners
- `createServiceBookingOrder`: Para reservas de servicios con cita
- `createUnifiedPaymentPreference`: Para preferencias con IVA y comisiones
- `refreshPartnerToken`: Para refrescar tokens OAuth expirados
- `getPartnerOAuthStatus`: Para verificar estado de autorización OAuth
