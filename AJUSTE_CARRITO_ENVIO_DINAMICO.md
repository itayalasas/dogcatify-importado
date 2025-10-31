# Ajuste del Carrito: Envío Dinámico por Configuración de Tienda

## Cambios Implementados

Se ha ajustado el carrito de compras para que el costo de envío y la dirección se muestren dinámicamente según la configuración del negocio (`has_shipping` y `shipping_cost`).

## Comportamiento

### Caso 1: Tienda CON Envío (`has_shipping = TRUE`)

**Resumen del Pedido:**
```
Subtotal:     $ 184,00
Envío:        $ 180,00  ← Valor de shipping_cost
─────────────────────────
Total:        $ 364,00
```

**Dirección:**
- Título: "Dirección de Envío"
- Muestra: Dirección del usuario
- Validación: Campos obligatorios (calle, número, localidad, departamento)

### Caso 2: Tienda SIN Envío (`has_shipping = FALSE`)

**Resumen del Pedido:**
```
Subtotal:     $ 184,00
🏪 Retiro en tienda
─────────────────────────
Total:        $ 184,00
```

**Dirección:**
- Título: "Dirección de la Tienda"
- Muestra: Dirección de la tienda (calle, barrio, ciudad)
- NO muestra campos de dirección del usuario
- NO requiere validación de dirección
- Mensaje: "📦 Podrás retirar tu pedido una vez confirmado el pago"

## Archivos Modificados

### `/app/cart/index.tsx`

#### 1. Estado para información del partner
```typescript
const [partnerInfo, setPartnerInfo] = useState<{
  has_shipping: boolean;
  shipping_cost: number;
  calle: string;
  barrio: string;
  city: string;
} | null>(null);
```

#### 2. Función para cargar configuración de envío
```typescript
const loadPartnerShippingInfo = async () => {
  // Obtiene partner_id del primer producto
  // Carga has_shipping, shipping_cost, calle, barrio, city
  // Actualiza el estado partnerInfo
};
```

#### 3. Resumen dinámico de pedido
```typescript
{partnerInfo?.has_shipping ? (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>Envío</Text>
    <Text style={styles.summaryValue}>
      {formatCurrency(partnerInfo.shipping_cost)}
    </Text>
  </View>
) : (
  <View style={styles.pickupNotice}>
    <Text style={styles.pickupNoticeText}>
      🏪 Retiro en tienda
    </Text>
  </View>
)}
```

#### 4. Total dinámico
```typescript
const totalShippingCost = partnerInfo?.has_shipping 
  ? (partnerInfo.shipping_cost || 0) 
  : 0;

// Total mostrado
formatCurrency(getCartTotal() + totalShippingCost)
```

#### 5. Título de dirección dinámico
```typescript
<Text style={styles.addressHeaderTitle}>
  {partnerInfo?.has_shipping 
    ? 'Dirección de Envío' 
    : 'Dirección de la Tienda'}
</Text>
```

#### 6. Contenido de dirección condicional
```typescript
{!partnerInfo?.has_shipping && partnerInfo ? (
  // Mostrar dirección de la tienda
  <View style={styles.storeAddressContainer}>
    <Text style={styles.storeAddressTitle}>
      Dirección de retiro:
    </Text>
    <Text style={styles.storeAddressText}>
      {partnerInfo.calle}
      {partnerInfo.barrio ? `, ${partnerInfo.barrio}` : ''}
      {partnerInfo.city ? `, ${partnerInfo.city}` : ''}
    </Text>
    <Text style={styles.storeAddressNote}>
      📦 Podrás retirar tu pedido una vez confirmado el pago
    </Text>
  </View>
) : (
  // Mostrar formulario de dirección del usuario
  // ... campos de input
)}
```

#### 7. Validación condicional
```typescript
// Solo validar dirección si tiene envío
if (partnerInfo?.has_shipping) {
  if (!addressToUse.street.trim() || !addressToUse.number.trim() || 
      !addressToUse.locality.trim() || !addressToUse.department.trim()) {
    Alert.alert('Error', 'Por favor completa los campos obligatorios');
    return;
  }
}
```

#### 8. Dirección enviada al backend
```typescript
if (partnerInfo?.has_shipping) {
  // Dirección del usuario
  fullAddress = `${addressToUse.street} ${addressToUse.number}...`;
} else {
  // Dirección de la tienda
  fullAddress = 'Retiro en tienda: ';
  if (partnerInfo?.calle) fullAddress += partnerInfo.calle;
  if (partnerInfo?.barrio) fullAddress += `, ${partnerInfo.barrio}`;
  if (partnerInfo?.city) fullAddress += `, ${partnerInfo.city}`;
}
```

## Nuevos Estilos Agregados

```typescript
pickupNotice: {
  backgroundColor: '#DBEAFE',
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 8,
  marginVertical: 4,
},
pickupNoticeText: {
  fontSize: 14,
  fontFamily: 'Inter-SemiBold',
  color: '#1E40AF',
  textAlign: 'center',
},
storeAddressContainer: {
  backgroundColor: '#F0FDF4',
  padding: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#BBF7D0',
},
storeAddressTitle: {
  fontSize: 14,
  fontFamily: 'Inter-SemiBold',
  color: '#166534',
  marginBottom: 8,
},
storeAddressText: {
  fontSize: 15,
  fontFamily: 'Inter-Medium',
  color: '#15803D',
  marginBottom: 12,
  lineHeight: 22,
},
storeAddressNote: {
  fontSize: 13,
  fontFamily: 'Inter-Regular',
  color: '#16A34A',
  fontStyle: 'italic',
},
```

## Columnas de Base de Datos Utilizadas

### Tabla `partners`
- `has_shipping` (boolean): Indica si el negocio ofrece envío
- `shipping_cost` (numeric): Costo del envío (si aplica)
- `calle` (text): Calle de la tienda
- `barrio` (text): Barrio de la tienda
- `city` (text): Ciudad de la tienda

## Flujo de Datos

```
1. Usuario agrega productos al carrito
   ↓
2. Cart screen carga `loadPartnerShippingInfo()`
   ↓
3. Obtiene partner_id del primer producto
   ↓
4. Query a tabla partners:
   SELECT has_shipping, shipping_cost, calle, barrio, city
   ↓
5. Actualiza estado `partnerInfo`
   ↓
6. UI renderiza condicionalmente:
   - Si has_shipping = TRUE: Muestra envío y dirección usuario
   - Si has_shipping = FALSE: Muestra retiro y dirección tienda
   ↓
7. Al pagar, valida solo si has_shipping = TRUE
   ↓
8. Envía al backend:
   - shipping_cost correcto
   - Dirección correcta (usuario o tienda)
```

## Pruebas

### Caso de Prueba 1: Tienda con envío
```sql
UPDATE partners 
SET has_shipping = TRUE, 
    shipping_cost = 180
WHERE id = '...';
```

**Resultado esperado:**
- ✅ Muestra "Envío: $ 180,00"
- ✅ Total incluye costo de envío
- ✅ Muestra "Dirección de Envío"
- ✅ Muestra campos de dirección del usuario
- ✅ Valida campos obligatorios

### Caso de Prueba 2: Tienda sin envío (retiro)
```sql
UPDATE partners 
SET has_shipping = FALSE, 
    shipping_cost = 0,
    calle = 'Avenida 8 de octubre',
    barrio = 'Unión',
    city = 'Montevideo'
WHERE id = '...';
```

**Resultado esperado:**
- ✅ Muestra "🏪 Retiro en tienda"
- ✅ Total NO incluye envío
- ✅ Muestra "Dirección de la Tienda"
- ✅ Muestra dirección de la tienda
- ✅ NO valida dirección de usuario
- ✅ Mensaje de retiro visible

## Notas Importantes

1. **Valor hardcodeado eliminado**: Ya NO se usa el valor fijo de `$500`
2. **Múltiples partners**: Si el carrito tiene productos de diferentes partners, se usa la configuración del primer producto
3. **Fallback**: Si no se puede cargar la configuración, `partnerInfo` será `null` y el comportamiento será neutral
4. **Performance**: La configuración se carga solo una vez al montar el componente y al cambiar el carrito

## Mejoras Futuras

1. **Multi-partner cart**: Manejar diferentes configuraciones de envío por partner
2. **Cálculo de envío por distancia**: Integrar API de cálculo de distancia
3. **Horarios de retiro**: Mostrar horarios disponibles para retiro en tienda
4. **Mapa de ubicación**: Mostrar mapa con ubicación de la tienda

---

**Fecha de implementación**: 31 de Octubre 2025  
**Estado**: ✅ Completado y funcional
