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

## 2. Carrito de Compras - Sistema de Dirección Colapsable (`app/cart/index.tsx`)

### Cambios Principales:

#### a) Ubicación y Diseño Optimizado
- **Ubicación**: La sección de dirección está ahora **debajo del resumen del pedido** en lugar de arriba
- **Diseño colapsable**: Por defecto, la dirección se muestra de forma compacta y se puede expandir al hacer clic
- **Vista previa compacta**: Muestra "Benigno Paiva 1165, Buceo" sin ocupar mucho espacio
- **Indicador visual**:
  - ✅ Si la dirección está completa, muestra la dirección en formato corto
  - ⚠️ Si falta información, muestra "Completar dirección" en amarillo
- **Iconos**: Chevron hacia abajo cuando está colapsado, hacia arriba cuando está expandido

#### b) Carga Automática desde el Perfil del Usuario
El carrito carga automáticamente los siguientes campos del perfil del usuario (`profiles`):

| Campo en Perfil | Campo en Carrito | Obligatorio | Notas |
|-----------------|------------------|-------------|-------|
| `calle` | Calle | ✅ Sí | |
| `numero` | Número | ✅ Sí | |
| `barrio` o `address_locality` | Barrio/Localidad | ✅ Sí | Ej: "Buceo", "Centro", "Pocitos" |
| `department_id` → `departments.name` | Departamento | ✅ Sí | Se obtiene por JOIN. Ej: "Montevideo" |
| `codigo_postal` | Código Postal | ❌ No | |
| `address_phone` o `phone` | Teléfono | ⚠️ Recomendado | |

**Importante**:
- El sistema usa **un solo campo** para barrio/localidad (se eliminó la duplicación)
- Prioriza `barrio`, si está vacío usa `address_locality`
- El departamento se obtiene mediante JOIN con `departments` usando `department_id`

#### c) Tres Estados de la Interfaz

**Estado 1: Colapsado con Dirección Completa**
- Muestra solo: "Dirección de Envío" + "Calle Número, Barrio/Localidad" (ej: "Benigno Paiva 1165, Buceo")
- Icono de flecha hacia abajo para indicar que se puede expandir
- Usuario puede proceder al checkout sin expandir

**Estado 2: Colapsado Sin Dirección o Incompleta**
- Muestra: "Dirección de Envío" + "⚠️ Completar dirección" en amarillo
- Indica visualmente que falta información
- Usuario debe expandir para completar los datos

**Estado 3: Expandido**
- Muestra todos los campos de dirección
- Checkbox "Usar dirección diferente" visible
- Campos editables o no según el checkbox

#### d) Dos Modos de Operación

**Modo 1: Usar Dirección Guardada (Por defecto)**
- Los campos se muestran con la información del perfil
- Los campos están deshabilitados (solo lectura)
- Al hacer checkout, se usa esta dirección
- **NO se modifica el perfil del usuario**

**Modo 2: Usar Dirección Diferente**
- Al marcar el checkbox "Usar dirección diferente"
- Los campos se habilitan para edición
- El usuario puede ingresar una dirección temporal completamente nueva
- Esta dirección **NO se guarda en el perfil**
- Solo se envía en el campo `shipping_address` de la orden

#### e) Formato de Dirección en la Orden
La dirección se concatena en el siguiente formato:

```
{calle} {numero}, {barrio/localidad}, {departamento} - CP: {codigo_postal} - Tel: {telefono}
```

**Ejemplo:**
```
Av. 18 de Julio 1234, Centro, Montevideo - CP: 11200 - Tel: 099123456
```

**Formato**: `Calle Número, Barrio/Localidad, Departamento - CP: Código - Tel: Teléfono`

Los campos opcionales (código postal, teléfono) solo se incluyen si tienen valor.

#### f) Validación
- **Campos obligatorios**: calle, número, barrio/localidad, departamento
- **Campos opcionales**: código postal, teléfono
- Se muestra error si faltan campos obligatorios
- La validación ocurre antes del checkout

**Nota**: Ya no existe un campo separado de "barrio" opcional. El campo "Barrio/Localidad" es obligatorio y sirve para ambos propósitos.

#### g) Manejo de Casos Especiales

**Usuario sin dirección guardada:**
- Se muestra un mensaje: "No tienes una dirección guardada. Marca 'Usar dirección diferente' para ingresar una."
- El usuario debe marcar el checkbox y completar todos los campos

**Usuario con dirección incompleta:**
- Los campos guardados se muestran
- Los campos faltantes aparecen vacíos
- El usuario puede usar el checkbox para completar la información

---

## 3. Campos de la Tabla Profiles y Departments

### Campos de Dirección en `profiles`

```sql
-- Campos relacionados con dirección
calle                   text          -- Nombre de la calle
numero                  text          -- Número de puerta
barrio                  text          -- Barrio/zona (ej: "Buceo", "Centro")
codigo_postal          text          -- Código postal
address_locality       text          -- Localidad/Ciudad (ej: "Montevideo")
address_street         text          -- Alternativa a 'calle' (legacy)
address_number         text          -- Alternativa a 'numero' (legacy)
address_department     text          -- Departamento en texto (legacy)
address_phone          text          -- Teléfono de contacto para entregas
phone                  text          -- Teléfono general
latitud                text          -- Para geolocalización
longitud              text          -- Para geolocalización
country_id            uuid          -- Referencia al país
department_id         uuid          -- ⭐ Referencia a la tabla departments
```

### Relación con Tabla `departments`

El campo `department_id` es una **clave foránea** que referencia a la tabla `departments`:

```sql
-- Tabla departments
CREATE TABLE departments (
  id uuid PRIMARY KEY,
  name text NOT NULL,  -- Ej: "Montevideo", "Canelones", "Maldonado"
  ...
);
```

**Cómo funciona:**
- El carrito hace un **JOIN** entre `profiles` y `departments`
- Obtiene el nombre del departamento desde `departments.name` usando `department_id`
- Ejemplo: `department_id` → UUID → JOIN → `departments.name` = "Montevideo"

**Nota:** El sistema usa principalmente:
- `calle`, `numero` → Para dirección física
- `barrio` o `address_locality` → Para barrio/localidad (ej: "Buceo", "Centro")
- `department_id` → Para obtener el departamento (ej: "Montevideo")
- `codigo_postal`, `address_phone` → Información adicional

**Consolidación de campos**: Se eliminó la duplicación de `barrio` y `address_locality`. Ahora hay un solo campo "Barrio/Localidad" que prioriza `barrio` y usa `address_locality` como fallback.

---

## 4. Flujo de Usuario

### Escenario 1: Usuario con Dirección Completa Guardada (Flujo Rápido)
1. Usuario agrega productos al carrito
2. Va al carrito de compras
3. Ve el resumen del pedido con el total
4. Ve la sección "Dirección de Envío" colapsada mostrando "Benigno Paiva 1165, Buceo"
5. **NO necesita expandir** la dirección si está conforme
6. Procede directamente al pago
7. La dirección del perfil se envía en la orden

### Escenario 2: Usuario Quiere Verificar o Cambiar Dirección
1. Usuario agrega productos al carrito
2. Va al carrito de compras
3. Ve la dirección compacta "Benigno Paiva 1165, Buceo"
4. **Hace clic para expandir** y ver todos los detalles
5. Opción A: Verifica que está correcta y colapsa nuevamente
6. Opción B: Marca "Usar dirección diferente" y modifica los datos
7. Procede al pago
8. **La nueva dirección se envía en la orden PERO NO se guarda en el perfil**

### Escenario 3: Usuario sin Dirección Guardada
1. Usuario nuevo sin dirección
2. Va al carrito
3. Ve "⚠️ Completar dirección" en amarillo (colapsado)
4. **Hace clic para expandir** la sección
5. Ve mensaje: "No tienes dirección guardada..."
6. Marca el checkbox "Usar dirección diferente"
7. Completa todos los campos obligatorios
8. Puede colapsar la sección para ver el resumen
9. Procede al pago
10. La dirección se envía en la orden pero NO se guarda en el perfil

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
- **Diseño colapsable**: Reduce el espacio visual del formulario
- **Vista previa compacta**: "Benigno Paiva 1165, Buceo" fácil de leer
- **Indicadores visuales claros**: ✅ o ⚠️ según el estado
- **Estados de carga**: "Cargando dirección..." mientras se obtienen datos
- **Validación en tiempo real**: Mensajes descriptivos de errores
- **Campos obligatorios marcados**: Asterisco (*) en campos requeridos
- **Iconos intuitivos**: Chevron que indica expandir/colapsar
- **Diseño responsive**: Se adapta a diferentes tamaños de pantalla

### Ventajas de Este Enfoque
1. **No sobrescribe datos**: La dirección del perfil permanece intacta
2. **Flexibilidad**: Permite envíos a direcciones diferentes sin cambiar configuración
3. **Privacidad**: El usuario controla cuándo se modifica su perfil
4. **Simplicidad**: Un solo checkbox para cambiar el comportamiento
5. **Formulario más corto**: Al estar colapsado, el carrito es más fácil de escanear visualmente
6. **Flujo rápido**: Usuarios con dirección guardada completan el checkout más rápido
7. **Claridad visual**: Se ve de inmediato si hay problemas con la dirección

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
- `app/cart/index.tsx` - Sistema completo de dirección colapsable
  - **Ubicación**: Debajo del resumen del pedido
  - **Diseño colapsable**: Reduce espacio visual del formulario
  - **Vista previa compacta**: "Calle Número, Barrio" formato corto
  - **Indicadores visuales**: ✅ dirección completa / ⚠️ falta información
  - Carga automática desde perfil usando campos existentes
  - Modo de dirección temporal que NO modifica el perfil
  - Validación y formato de dirección

---

## 8. Testing

### Test 1: IVA
1. Navegar a cualquier producto
2. Verificar que se muestra "IVA incluido" debajo del precio
3. Navegar a cualquier servicio
4. Verificar que se muestra "IVA incluido"
5. Para servicios de hospedaje, verificar en cada categoría

### Test 2: Dirección Colapsable - Usuario con Dirección Guardada
1. Asegurarse de tener una dirección en el perfil (con valores en `calle`, `numero`, `address_locality`, `address_department`)
2. Agregar productos al carrito
3. Ir al carrito
4. **Verificar que la sección está debajo del resumen del pedido**
5. **Verificar que está colapsada por defecto** mostrando "Benigno Paiva 1165, Buceo" (o similar)
6. **Verificar que NO muestra el símbolo de advertencia** (⚠️)
7. Hacer clic para expandir
8. Verificar que los campos muestran la dirección guardada
9. Verificar que los campos están deshabilitados
10. Proceder al checkout sin expandir la dirección
11. Verificar que la dirección llegue a la orden

### Test 3: Dirección Colapsable - Expandir y Modificar
1. Ir al carrito con productos
2. Expandir la sección de dirección (hacer clic)
3. Marcar el checkbox "Usar dirección diferente"
4. Verificar que los campos se habilitan
5. Modificar algún campo (ej: cambiar número de calle)
6. **Colapsar la sección** haciendo clic en el header
7. **Verificar que muestra la dirección modificada** en formato compacto
8. Proceder al checkout
9. Verificar que la nueva dirección se envía en la orden
10. Recargar el carrito
11. Verificar que la dirección original del perfil sigue intacta

### Test 4: Dirección Colapsable - Usuario sin Dirección
1. Crear un usuario nuevo o limpiar los campos de dirección del perfil
2. Agregar productos al carrito
3. Ir al carrito
4. **Verificar que muestra "⚠️ Completar dirección"** en amarillo (colapsado)
5. Expandir la sección
6. Verificar mensaje: "No tienes una dirección guardada..."
7. Marcar el checkbox
8. Completar todos los campos
9. Intentar checkout sin completar campos obligatorios (debe mostrar error)
10. Completar campos obligatorios
11. **Verificar que se puede colapsar/expandir** la sección
12. Proceder al pago
13. Verificar que la dirección NO se guardó en el perfil

---

## 9. Conclusión

El sistema ahora proporciona:
- ✅ Información clara de IVA en todos los precios
- ✅ Carga automática de dirección desde el perfil del usuario
- ✅ **Formulario de carrito más compacto** con dirección colapsable
- ✅ **Vista previa de dirección** en formato corto (ej: "Benigno Paiva 1165, Buceo")
- ✅ **Indicadores visuales claros** (✅ completa / ⚠️ incompleta)
- ✅ **Flujo de checkout más rápido** para usuarios con dirección guardada
- ✅ Flexibilidad para usar direcciones temporales sin modificar el perfil
- ✅ Validación completa y mensajes claros
- ✅ Separación clara entre dirección del perfil y dirección de envío temporal

Este enfoque respeta la privacidad del usuario, reduce el scrolling necesario en el carrito, y proporciona la flexibilidad necesaria para diferentes escenarios de compra (envío a domicilio, regalo, oficina, etc.) sin complicar la experiencia.
