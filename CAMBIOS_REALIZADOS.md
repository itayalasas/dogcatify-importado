# Cambios Realizados - IVA y Dirección en Carrito

## Resumen
Se han implementado las siguientes mejoras en la aplicación:

1. **Información de IVA en Productos y Servicios**
2. **Carga Automática de Dirección en Carrito**
3. **Opción para Usar Dirección Diferente**

---

## 1. Información de IVA

### Detalle de Productos (`app/products/[id].tsx`)
- Se agregó el texto "IVA incluido" debajo del precio del producto
- Aparece tanto en productos con descuento como sin descuento
- Estilo: texto gris pequeño para indicar que el IVA está incluido en el precio mostrado

### Detalle de Servicios (`app/services/[id].tsx`)
- Se agregó el texto "IVA incluido" en los servicios normales
- Se agregó "IVA incluido" en cada categoría de hospedaje (Diario, Nocturno, Fin de semana, Semanal)
- Formato consistente con los productos

---

## 2. Carrito de Compras - Dirección Automática (`app/cart/index.tsx`)

### Cambios Principales:

#### a) Carga Automática de Dirección
- Al abrir el carrito, se carga automáticamente la dirección guardada del usuario desde su perfil
- Campos que se cargan:
  - **Calle**: `address_street`
  - **Número**: `address_number`
  - **Localidad/Ciudad**: `address_locality`
  - **Departamento**: `address_department`
  - **Teléfono**: `address_phone` (o `phone` si no hay teléfono específico)

#### b) Diseño Mejorado
- **Vista predeterminada**: Muestra la dirección guardada en campos deshabilitados (solo lectura)
- **Checkbox "Usar dirección diferente"**: Permite al usuario editar o ingresar una nueva dirección
- **Vista previa**: Muestra la dirección completa formateada con icono de ubicación
- **Distribución inteligente**:
  - Calle y número en la misma fila (calle ocupa 75%, número 25%)
  - Localidad, departamento y teléfono en filas separadas

#### c) Validación
- Se valida que todos los campos obligatorios estén completos antes del checkout
- Campos requeridos: calle, número, localidad, departamento
- El teléfono es opcional pero recomendado

#### d) Envío a la Orden
- La dirección completa se formatea como: `{calle} {número}, {localidad}, {departamento}`
- Se envía al campo `address` de la orden en Mercado Pago

---

## 3. Base de Datos - Nuevos Campos

### Campos Agregados a la Tabla `profiles`:
Para que funcione correctamente, ejecuta el siguiente SQL en Supabase:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_locality text,
  ADD COLUMN IF NOT EXISTS address_department text,
  ADD COLUMN IF NOT EXISTS address_phone text;
```

**Nota**: Este script está disponible en el archivo `ADD_ADDRESS_FIELDS.sql`

---

## 4. Flujo de Usuario

### Escenario 1: Usuario con Dirección Guardada
1. Usuario agrega productos al carrito
2. Va al carrito de compras
3. Ve su dirección precargada automáticamente
4. Puede proceder directamente al pago

### Escenario 2: Usuario sin Dirección o Quiere Cambiarla
1. Usuario agrega productos al carrito
2. Va al carrito de compras
3. Marca el checkbox "Usar dirección diferente"
4. Los campos se habilitan para edición
5. Ingresa la nueva dirección
6. Procede al pago

### Escenario 3: Primera Compra
1. Usuario nuevo sin dirección guardada
2. Los campos aparecen vacíos pero editables
3. Marca el checkbox para habilitar la edición
4. Completa todos los campos requeridos
5. Procede al pago

---

## 5. Consideraciones Técnicas

### Compatibilidad
- Los cambios son retrocompatibles
- Si un usuario no tiene dirección guardada, puede ingresarla manualmente
- La aplicación funciona correctamente con o sin los nuevos campos en la BD

### Seguridad
- Los campos de dirección solo son accesibles por el usuario propietario (RLS)
- La dirección se envía de forma segura a Mercado Pago

### UX/UI
- Estados de carga claros
- Validación en tiempo real
- Mensajes de error descriptivos
- Diseño responsive y accesible

---

## 6. Próximos Pasos Recomendados

1. **Ejecutar el script SQL** en Supabase para agregar los campos de dirección
2. **Actualizar el perfil de usuario** para permitir que los usuarios editen su dirección guardada
3. **Agregar geolocalización** (opcional) para autocompletar la dirección usando la API de Google Maps
4. **Historial de direcciones** (opcional) para que el usuario pueda guardar múltiples direcciones

---

## Archivos Modificados

- `app/products/[id].tsx` - Agregado "IVA incluido" en precios
- `app/services/[id].tsx` - Agregado "IVA incluido" en servicios y categorías
- `app/cart/index.tsx` - Sistema completo de dirección automática
- `ADD_ADDRESS_FIELDS.sql` - Script SQL para agregar campos a BD

---

## Testing

Para probar los cambios:

1. **IVA**: Navegar a cualquier producto o servicio y verificar que se muestre "IVA incluido"
2. **Dirección**:
   - Agregar productos al carrito
   - Ir al carrito
   - Verificar que los campos de dirección aparezcan
   - Probar el checkbox de "Usar dirección diferente"
   - Completar el checkout y verificar que la dirección llegue correctamente a la orden
