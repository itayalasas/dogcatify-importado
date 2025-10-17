# Cambios Realizados - IVA y Dirección en Carrito

## Resumen
Se han implementado las siguientes mejoras en la aplicación:

1. **Información de IVA en Productos y Servicios**
2. **Carga Automática de Dirección del Perfil en Carrito**
3. **Opción para Usar Dirección Diferente (Sin Actualizar el Perfil)**

---

## 1. Información de IVA

### Detalle de Productos (`app/products/[id].tsx`)
- Se agregó el texto "IVA incluido" debajo del precio del producto
- Aparece tanto en productos con descuento como sin descuento
- Estilo: texto gris pequeño para indicar que el IVA está incluido en el precio mostrado

### Detalle de Servicios (`app/services/[id].tsx`)
- Se agregó el texto "IVA incluido" en los servicios regulares
- Se agregó "IVA incluido" en cada categoría de hospedaje (Diario, Nocturno, Fin de semana, Semanal)
- Formato consistente con los productos

---

## 2. Carrito de Compras - Sistema de Dirección (`app/cart/index.tsx`)

### Cambios Principales:

#### a) Carga Automática desde el Perfil del Usuario
El carrito carga automáticamente los siguientes campos del perfil del usuario (`profiles`):

| Campo en Perfil | Campo en Carrito | Obligatorio |
|-----------------|------------------|-------------|
| `calle` | Calle | ✅ Sí |
| `numero` | Número | ✅ Sí |
| `barrio` | Barrio | ❌ No |
| `address_locality` | Localidad/Ciudad | ✅ Sí |
| `address_department` | Departamento | ✅ Sí |
| `codigo_postal` | Código Postal | ❌ No |
| `address_phone` o `phone` | Teléfono | ⚠️ Recomendado |

#### b) Dos Modos de Operación

**Modo 1: Usar Dirección Guardada (Por defecto)**
- Los campos se muestran con la información del perfil
- Los campos están deshabilitados (solo lectura)
- Se muestra una vista previa de la dirección completa formateada
- Al hacer checkout, se usa esta dirección
- **NO se modifica el perfil del usuario**

**Modo 2: Usar Dirección Diferente**
- Al marcar el checkbox "Usar dirección diferente"
- Los campos se habilitan para edición
- El usuario puede ingresar una dirección temporal completamente nueva
- Esta dirección **NO se guarda en el perfil**
- Solo se envía en el campo `shipping_address` de la orden

#### c) Formato de Dirección en la Orden
La dirección se concatena en el siguiente formato:

```
{calle} {numero}, {barrio}, {localidad}, {departamento} - CP: {codigo_postal} - Tel: {telefono}
```

**Ejemplo:**
```
Av. 18 de Julio 1234, Centro, Montevideo, Montevideo - CP: 11200 - Tel: 099123456
```

Los campos opcionales (barrio, código postal, teléfono) solo se incluyen si tienen valor.

#### d) Validación
- **Campos obligatorios**: calle, número, localidad, departamento
- **Campos opcionales**: barrio, código postal, teléfono
- Se muestra error si faltan campos obligatorios
- La validación ocurre antes del checkout

#### e) Manejo de Casos Especiales

**Usuario sin dirección guardada:**
- Se muestra un mensaje: "No tienes una dirección guardada. Marca 'Usar dirección diferente' para ingresar una."
- El usuario debe marcar el checkbox y completar todos los campos

**Usuario con dirección incompleta:**
- Los campos guardados se muestran
- Los campos faltantes aparecen vacíos
- El usuario puede usar el checkbox para completar la información

---

## 3. Campos de la Tabla Profiles

Los campos de dirección que ya existen en la tabla `profiles` son:

```sql
-- Campos relacionados con dirección
calle                   text
numero                  text
barrio                  text
codigo_postal          text
address_street         text  -- Alternativa a 'calle'
address_number         text  -- Alternativa a 'numero'
address_locality       text
address_department     text
address_phone          text
latitud                text  -- Para geolocalización
longitud              text  -- Para geolocalización
country_id            uuid  -- Referencia al país
department_id         uuid  -- Referencia al departamento
```

**Nota:** El sistema usa principalmente `calle`, `numero`, `barrio`, `address_locality`, `address_department`, `codigo_postal` y `address_phone`.

---

## 4. Flujo de Usuario

### Escenario 1: Usuario con Dirección Completa Guardada
1. Usuario agrega productos al carrito
2. Va al carrito de compras
3. Ve su dirección precargada automáticamente en campos deshabilitados
4. Ve una vista previa de la dirección completa
5. Procede directamente al pago sin modificar nada
6. La dirección del perfil se envía en la orden

### Escenario 2: Usuario Quiere Usar Dirección Diferente (Ej: Regalo, Oficina)
1. Usuario agrega productos al carrito
2. Va al carrito de compras
3. Ve su dirección guardada
4. Marca el checkbox "Usar dirección diferente"
5. Los campos se habilitan
6. Modifica o ingresa una dirección completamente nueva
7. Procede al pago
8. **La nueva dirección se envía en la orden PERO NO se guarda en el perfil**
9. La próxima vez que compre, verá nuevamente su dirección original

### Escenario 3: Usuario sin Dirección Guardada
1. Usuario nuevo sin dirección
2. Va al carrito
3. Ve mensaje indicando que no tiene dirección guardada
4. Marca el checkbox "Usar dirección diferente"
5. Completa todos los campos obligatorios
6. Procede al pago
7. La dirección se envía en la orden pero no se guarda en el perfil

---

## 5. Consideraciones Técnicas

### Separación de Responsabilidades
- **Perfil del usuario**: Administrado en la sección de perfil/configuración
- **Dirección de envío temporal**: Administrada solo en el carrito, no persiste

### Seguridad
- Los campos de dirección solo son accesibles por el usuario propietario (RLS)
- La dirección se envía de forma segura a Mercado Pago
- No se modifica el perfil sin consentimiento explícito del usuario

### UX/UI
- Estados de carga claros ("Cargando dirección...")
- Validación en tiempo real con mensajes descriptivos
- Indicadores visuales de campos obligatorios (*)
- Vista previa formateada de la dirección
- Checkbox claro para cambiar de modo
- Diseño responsive y accesible

### Ventajas de Este Enfoque
1. **No sobrescribe datos**: La dirección del perfil permanece intacta
2. **Flexibilidad**: Permite envíos a direcciones diferentes sin cambiar configuración
3. **Privacidad**: El usuario controla cuándo se modifica su perfil
4. **Simplicidad**: Un solo checkbox para cambiar el comportamiento

---

## 6. Próximos Pasos Recomendados

1. **Página de edición de perfil**: Agregar formulario para que el usuario actualice su dirección guardada
2. **Geolocalización**: Integrar API de Google Maps para autocompletar direcciones
3. **Historial de direcciones**: Permitir guardar múltiples direcciones favoritas (ej: casa, trabajo, casa de familiares)
4. **Validación de código postal**: Validar según el departamento seleccionado
5. **Selector de departamento**: Usar un dropdown con los departamentos del país

---

## 7. Archivos Modificados

### Archivos con Cambios de IVA:
- `app/products/[id].tsx` - Agregado "IVA incluido" en precios de productos
- `app/services/[id].tsx` - Agregado "IVA incluido" en servicios y categorías de hospedaje

### Archivos con Sistema de Dirección:
- `app/cart/index.tsx` - Sistema completo de carga y manejo de direcciones
  - Carga automática desde perfil usando campos existentes
  - Modo de dirección temporal que NO modifica el perfil
  - Validación y formato de dirección
  - UI mejorada con campos organizados

---

## 8. Testing

### Test 1: IVA
1. Navegar a cualquier producto
2. Verificar que se muestra "IVA incluido" debajo del precio
3. Navegar a cualquier servicio
4. Verificar que se muestra "IVA incluido"
5. Para servicios de hospedaje, verificar en cada categoría

### Test 2: Dirección - Usuario con Dirección Guardada
1. Asegurarse de tener una dirección en el perfil (con valores en `calle`, `numero`, `address_locality`, `address_department`)
2. Agregar productos al carrito
3. Ir al carrito
4. Verificar que los campos muestran la dirección guardada
5. Verificar que los campos están deshabilitados
6. Verificar que se muestra la vista previa formateada
7. Proceder al checkout y verificar que la dirección llegue a la orden

### Test 3: Dirección - Modo Dirección Diferente
1. Ir al carrito con productos
2. Marcar el checkbox "Usar dirección diferente"
3. Verificar que los campos se habilitan
4. Modificar algún campo (ej: cambiar número de calle)
5. Proceder al checkout
6. Verificar que la nueva dirección se envía en la orden
7. Recargar el carrito
8. Verificar que la dirección original del perfil sigue intacta

### Test 4: Dirección - Usuario sin Dirección
1. Crear un usuario nuevo o limpiar los campos de dirección del perfil
2. Agregar productos al carrito
3. Ir al carrito
4. Verificar mensaje: "No tienes una dirección guardada..."
5. Marcar el checkbox
6. Completar todos los campos
7. Intentar checkout sin completar campos obligatorios (debe mostrar error)
8. Completar campos obligatorios y proceder al pago
9. Verificar que la dirección NO se guardó en el perfil

---

## 9. Conclusión

El sistema ahora proporciona:
- ✅ Información clara de IVA en todos los precios
- ✅ Carga automática de dirección desde el perfil del usuario
- ✅ Flexibilidad para usar direcciones temporales sin modificar el perfil
- ✅ Validación completa y mensajes claros
- ✅ UX mejorada con vista previa y campos organizados
- ✅ Separación clara entre dirección del perfil y dirección de envío temporal

Este enfoque respeta la privacidad del usuario y proporciona la flexibilidad necesaria para diferentes escenarios de compra (envío a domicilio, regalo, oficina, etc.) sin complicar la experiencia.
