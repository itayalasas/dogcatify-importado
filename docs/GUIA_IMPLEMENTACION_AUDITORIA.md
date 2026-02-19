# Guía de Implementación de Auditoría en Módulos

## ✅ Ya Implementado

### 1. Autenticación (AuthContext.tsx)
- ✅ LOGIN
- ✅ LOGIN_FAILED
- ✅ LOGOUT

### 2. Bookings (utils/mercadoPago.ts)
- ✅ BOOKING_CREATE (con detalles del servicio, mascota, fecha)
- ✅ Error logging en caso de fallo

### 3. Pagos
- ✅ PAYMENT_SUCCESS (app/payment/success.tsx)
- ✅ PAYMENT_FAILED (app/payment/failure.tsx)

## 📋 Pendiente de Implementar

### 4. Mascotas (Pets)

#### Crear Mascota
**Archivo:** Donde se cree la mascota (buscar `from('pets').insert()`)

```typescript
import { logResourceAction } from '../services/auditService';

// Después de crear exitosamente
await logResourceAction('PET_CREATE', 'pet', petId, {
  status: 'success',
  details: {
    name: petData.name,
    species: petData.species,
    breed: petData.breed
  }
}).catch(err => console.error('Error logging pet audit:', err));
```

#### Actualizar Mascota
**Archivo:** Donde se actualice la mascota

```typescript
await logResourceAction('PET_UPDATE', 'pet', petId, {
  status: 'success',
  details: {
    name: petData.name,
    changes: changedFields // opcional
  }
}).catch(err => console.error('Error logging pet audit:', err));
```

#### Eliminar Mascota
**Archivo:** Donde se elimine la mascota

```typescript
await logResourceAction('PET_DELETE', 'pet', petId, {
  status: 'success',
  details: {
    name: petData.name,
    reason: 'User deleted'
  }
}).catch(err => console.error('Error logging pet audit:', err));
```

### 5. Perfil de Usuario

#### Actualizar Perfil
**Archivo:** Donde se actualice el perfil (`contexts/AuthContext.tsx` o componente de perfil)

```typescript
import { logResourceAction } from '../services/auditService';

// Después de actualizar exitosamente
await logResourceAction('PROFILE_UPDATE', 'profile', userId, {
  status: 'success',
  details: {
    fields_updated: Object.keys(updatedFields),
    // NO incluir valores sensibles como passwords
  }
}).catch(err => console.error('Error logging profile audit:', err));
```

### 6. Órdenes

#### Cancelar Orden
**Archivo:** Donde se cancelen órdenes

```typescript
await logResourceAction('ORDER_CANCEL', 'order', orderId, {
  status: 'success',
  details: {
    order_number: orderData.order_number,
    reason: cancelReason,
    refunded: wasRefunded
  }
}).catch(err => console.error('Error logging order audit:', err));
```

### 7. Bookings Adicionales

#### Cancelar Booking
**Archivo:** Donde se cancelen bookings

```typescript
await logResourceAction('BOOKING_CANCEL', 'booking', bookingId, {
  status: 'success',
  details: {
    service_name: booking.service_name,
    date: booking.date,
    reason: cancelReason
  }
}).catch(err => console.error('Error logging booking audit:', err));
```

#### Actualizar Booking
**Archivo:** Donde se actualicen bookings (cambio de fecha/hora)

```typescript
await logResourceAction('BOOKING_UPDATE', 'booking', bookingId, {
  status: 'success',
  details: {
    service_name: booking.service_name,
    old_date: oldDate,
    new_date: newDate,
    old_time: oldTime,
    new_time: newTime
  }
}).catch(err => console.error('Error logging booking audit:', err));
```

### 8. Historial Médico

#### Agregar Registro Médico
**Archivo:** `app/pets/health/**/*.tsx`

```typescript
await logResourceAction('MEDICAL_RECORD_CREATE', 'medical_record', recordId, {
  status: 'success',
  details: {
    pet_id: petId,
    pet_name: petName,
    record_type: recordType, // 'vaccine', 'deworming', 'checkup', etc
    date: recordDate
  }
}).catch(err => console.error('Error logging medical audit:', err));
```

### 9. Chat/Mensajes

#### Enviar Mensaje
**Archivo:** Donde se envíen mensajes

```typescript
// Solo si quieres auditar mensajes importantes
await logAction('MESSAGE_SENT', {
  status: 'success',
  resource_type: 'chat',
  resource_id: chatId,
  details: {
    recipient_id: recipientId,
    message_length: message.length
    // NO incluir el contenido del mensaje por privacidad
  }
}).catch(err => console.error('Error logging message audit:', err));
```

### 10. Admin Actions

#### Aprobar Partner
**Archivo:** Panel de admin donde se aprueben partners

```typescript
await logResourceAction('PARTNER_APPROVED', 'partner', partnerId, {
  status: 'success',
  details: {
    partner_name: partnerData.business_name,
    approved_by_admin: currentUser.email
  }
}).catch(err => console.error('Error logging partner audit:', err));
```

#### Bloquear Usuario
**Archivo:** Panel de admin

```typescript
await logResourceAction('USER_BLOCKED', 'user', userId, {
  status: 'success',
  details: {
    user_email: userData.email,
    reason: blockReason,
    blocked_by_admin: currentUser.email
  }
}).catch(err => console.error('Error logging user block audit:', err));
```

## 🎯 Patrón General de Implementación

### 1. Importar el servicio

```typescript
import { logResourceAction, logError } from '../services/auditService';
```

### 2. En operaciones exitosas

```typescript
try {
  // Tu código de negocio aquí
  const result = await supabaseClient.from('table').insert(data);
  
  // Registrar en auditoría
  await logResourceAction('ACTION_NAME', 'resource_type', resourceId, {
    status: 'success',
    details: {
      // Info relevante
    }
  }).catch(err => console.error('Error logging audit:', err));
  
  return result;
} catch (error) {
  // Manejar error...
}
```

### 3. En operaciones con error

```typescript
try {
  // Tu código de negocio aquí
} catch (error) {
  // Registrar error en auditoría
  await logError(error, {
    action: 'ACTION_NAME',
    resource_type: 'resource_type',
    resource_id: resourceId,
    details: {
      // Contexto del error
    }
  }).catch(err => console.error('Error logging audit:', err));
  
  throw error; // Re-lanzar para que se maneje normalmente
}
```

## ⚠️ Buenas Prácticas

### ✅ Qué SÍ hacer

```typescript
// ✅ Incluir contexto relevante
details: {
  pet_name: 'Luna',
  service: 'Paseo',
  date: '2026-02-10',
  amount: 500
}

// ✅ Usar .catch() para no interrumpir el flujo
.catch(err => console.error('Error logging audit:', err));

// ✅ Incluir platform si está disponible
import { Platform } from 'react-native';
details: {
  platform: Platform.OS // 'ios' o 'android'
}
```

### ❌ Qué NO hacer

```typescript
// ❌ NUNCA incluir contraseñas
details: {
  password: userPassword // ¡MAL!
}

// ❌ NUNCA incluir tokens
details: {
  auth_token: token // ¡MAL!
}

// ❌ NUNCA incluir datos de tarjetas
details: {
  card_number: cardNumber // ¡MAL!
}

// ❌ No bloquear el flujo esperando la auditoría
await logResourceAction(...); // Si falla, bloqueará todo
// Mejor:
logResourceAction(...).catch(...); // Fire and forget
```

## 🔍 Buscar Archivos para Implementar

### Comando para buscar inserts/updates:

```bash
# Buscar todas las inserciones
grep -r "\.insert\(" app/

# Buscar todas las actualizaciones
grep -r "\.update\(" app/

# Buscar todas las eliminaciones
grep -r "\.delete\(" app/
```

### Archivos principales a revisar:

1. **Mascotas:** `app/pets/**/*.tsx`
2. **Perfil:** `app/(tabs)/profile.tsx` o similar
3. **Bookings:** Ya implementado en `utils/mercadoPago.ts`
4. **Pagos:** Ya implementado en `app/payment/*.tsx`
5. **Órdenes:** `app/orders/*.tsx`
6. **Historial médico:** `app/pets/health/**/*.tsx`
7. **Chat:** `app/chat/**/*.tsx`

## 📊 Verificar Implementación

Después de implementar en un módulo, verifica que funciona:

```sql
-- Ver últimos logs registrados
SELECT 
  created_at,
  action,
  resource_type,
  status,
  details
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- Ver logs por tipo de acción
SELECT 
  action,
  COUNT(*) as total
FROM audit_logs
GROUP BY action
ORDER BY total DESC;
```

## 🚀 Próximos Pasos

1. [ ] Buscar archivos con `from('pets').insert()` y agregar `PET_CREATE`
2. [ ] Buscar archivos con `from('pets').update()` y agregar `PET_UPDATE`
3. [ ] Buscar archivos con `from('pets').delete()` y agregar `PET_DELETE`
4. [ ] Buscar archivos con `from('profiles').update()` y agregar `PROFILE_UPDATE`
5. [ ] Buscar archivos de cancelación de bookings y agregar `BOOKING_CANCEL`
6. [ ] Buscar archivos de historial médico y agregar `MEDICAL_RECORD_CREATE`
7. [ ] Probar cada implementación creando/actualizando/eliminando recursos
8. [ ] Verificar en la interfaz web que los logs aparecen correctamente

---

**Nota:** El sistema de auditoría ya está completamente configurado. Solo necesitas agregar las llamadas a `logResourceAction()` o `logError()` en los lugares indicados.
