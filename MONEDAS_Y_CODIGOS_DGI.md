# Monedas y Códigos DGI - Guía de Integración

Esta guía explica cómo se manejan las monedas en el sistema y cómo integrarlas con la DGI de Uruguay.

## Introducción

Todos los productos y servicios en el sistema tienen asociada una moneda. Por defecto, se utiliza el **Peso Uruguayo (UYU)**, pero el sistema soporta múltiples monedas para facilitar el comercio internacional.

## Códigos de Moneda

### Tabla de Monedas Soportadas

| Moneda | Código ISO 4217 | Código Numérico DGI | Descripción | Símbolo |
|--------|----------------|---------------------|-------------|---------|
| Peso Uruguayo | UYU | 858 | Moneda oficial de Uruguay | $ |
| Dólar Estadounidense | USD | 840 | Moneda internacional | US$ |
| Euro | EUR | 978 | Moneda europea | € |

### Estándar ISO 4217

Los códigos de moneda siguen el estándar internacional ISO 4217:
- **Código alfabético**: 3 letras (ejemplo: UYU, USD, EUR)
- **Código numérico**: 3 dígitos (ejemplo: 858, 840, 978)

La DGI de Uruguay utiliza el **código numérico** para la facturación electrónica.

## Estructura en la Base de Datos

### Tablas Afectadas

```sql
-- Tabla: partner_products
ALTER TABLE partner_products ADD COLUMN currency text DEFAULT 'UYU' NOT NULL;
ALTER TABLE partner_products ADD COLUMN currency_code_dgi text DEFAULT '858' NOT NULL;

-- Tabla: partner_services
ALTER TABLE partner_services ADD COLUMN currency text DEFAULT 'UYU' NOT NULL;
ALTER TABLE partner_services ADD COLUMN currency_code_dgi text DEFAULT '858' NOT NULL;
```

### Valores por Defecto

Si no se especifica una moneda al crear un producto o servicio:
- `currency` = `'UYU'` (Peso Uruguayo)
- `currency_code_dgi` = `'858'`

Esto garantiza compatibilidad con todos los productos y servicios existentes.

## Interfaz de Usuario (UI)

### Selector de Moneda en Formularios

Cuando un partner crea o edita un producto o servicio, encontrará un selector visual de moneda en el formulario.

**Ubicación en la UI:**
- **Productos**: En el formulario "Agregar Producto" y "Editar Producto"
- **Servicios**: En el formulario "Agregar Servicio" y "Editar Servicio"
- Aparece después del campo "Precio" y antes de los campos específicos

**Cómo funciona:**
1. El partner ve tres opciones de moneda presentadas como botones:
   - **$ UYU** - Peso Uruguayo (seleccionado por defecto)
   - **US$ USD** - Dólar Estadounidense
   - **€ EUR** - Euro

2. Al tocar una moneda:
   - El botón se resalta en verde
   - Se actualiza automáticamente el código DGI correspondiente
   - El producto/servicio se guardará en esa moneda

3. La moneda seleccionada se muestra en:
   - El listado de productos/servicios del partner
   - El detalle del producto/servicio para los clientes
   - Las órdenes y facturas generadas

**Ejemplo visual del selector:**
```
Moneda 💰
Selecciona la moneda en la que se vende este producto

[✓ $ UYU          ]  [ US$ USD        ]  [ € EUR          ]
  Peso Uruguayo       Dólar Estadounidense    Euro
```

La moneda por defecto es **UYU (Peso Uruguayo)** si no se selecciona ninguna.

## Uso en el Sistema

### 1. Crear/Editar Productos con Moneda

```typescript
// Ejemplo: Crear producto en dólares
const productData = {
  name: "Producto importado",
  price: 100,
  currency: "USD",
  currency_code_dgi: "840",
  // ... otros campos
};

await supabaseClient
  .from('partner_products')
  .insert(productData);
```

### 2. Crear/Editar Servicios con Moneda

```typescript
// Ejemplo: Crear servicio en pesos uruguayos (por defecto)
const serviceData = {
  name: "Baño y corte",
  price: 1500,
  // currency y currency_code_dgi se asignan automáticamente
  // ... otros campos
};

await supabaseClient
  .from('partner_services')
  .insert(serviceData);
```

### 3. Consultar Productos/Servicios

```typescript
const { data: products } = await supabaseClient
  .from('partner_products')
  .select('*, currency, currency_code_dgi')
  .eq('partner_id', partnerId);

// Cada producto incluye su moneda
products.forEach(product => {
  console.log(`${product.name}: ${product.price} ${product.currency}`);
});
```

## Integración con el Webhook

### Estructura JSON del Item

Todos los items en el webhook incluyen información de moneda:

```json
{
  "id": "producto-123",
  "name": "Collar antipulgas",
  "price": 200,
  "quantity": 1,
  "subtotal": 200,
  "currency": "UYU",
  "currency_code_dgi": "858",
  "iva_rate": 22,
  "iva_amount": 44
}
```

### Procesamiento en el CRM

```javascript
// Recibir webhook
app.post('/webhook/orders', (req, res) => {
  const { data } = req.body;

  data.items.forEach(item => {
    // Obtener código DGI para facturación
    const codigoMoneda = item.currency_code_dgi; // "858"

    // Obtener código alfabético para display
    const moneda = item.currency; // "UYU"

    // Procesar según la moneda
    procesarItem(item, codigoMoneda);
  });

  res.status(200).send('OK');
});
```

## Facturación Electrónica DGI

### Uso del Código DGI en Comprobantes

Al generar un comprobante electrónico para la DGI, use el campo `currency_code_dgi`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CFE>
  <Encabezado>
    <IdDoc>
      <TipoCFE>111</TipoCFE>
      <!-- Otros campos -->
    </IdDoc>
    <Emisor>
      <!-- Datos del emisor -->
    </Emisor>
    <Receptor>
      <!-- Datos del receptor -->
    </Receptor>
    <Totales>
      <TpoMoneda>858</TpoMoneda> <!-- Código DGI de la moneda -->
      <TpoCambio>1.000</TpoCambio> <!-- Tipo de cambio si aplica -->
      <!-- Otros totales -->
    </Totales>
  </Encabezado>
  <Detalle>
    <Item>
      <!-- Item 1 -->
      <MontoItem>200.00</MontoItem>
    </Item>
  </Detalle>
</CFE>
```

### Importante

1. **Siempre use `currency_code_dgi`** en XML de facturación electrónica
2. **El código debe ser numérico** de 3 dígitos (858, 840, 978)
3. **Tipo de cambio**: Si la moneda no es UYU, debe incluir el tipo de cambio del día

## Conversión de Moneda

### Consideración Importante

El sistema **NO realiza conversiones automáticas de moneda**. Cada producto/servicio mantiene su moneda original.

Si necesitas convertir monedas:

```javascript
// Ejemplo: Convertir USD a UYU
const tipoCambio = 40.5; // Obtener de API del BCU

function convertirMoneda(item, monedaDestino, tipoCambio) {
  if (item.currency === monedaDestino) {
    return item.price;
  }

  if (item.currency === 'USD' && monedaDestino === 'UYU') {
    return item.price * tipoCambio;
  }

  // Implementar otras conversiones según necesidad
}
```

### API del Banco Central del Uruguay (BCU)

Para obtener tipos de cambio actualizados:
- **Cotizaciones**: https://www.bcu.gub.uy/Servicios-Financieros-SSF/Paginas/Cotizaciones.aspx
- **API**: https://www.bcu.gub.uy/Servicios-Financieros-SSF/Paginas/Servicios.aspx

## Mejores Prácticas

### 1. Validación de Moneda

```typescript
const MONEDAS_VALIDAS = ['UYU', 'USD', 'EUR'];
const CODIGOS_DGI_VALIDOS = {
  'UYU': '858',
  'USD': '840',
  'EUR': '978'
};

function validarMoneda(currency: string, currencyCodeDgi: string): boolean {
  return MONEDAS_VALIDAS.includes(currency) &&
         CODIGOS_DGI_VALIDOS[currency] === currencyCodeDgi;
}
```

### 2. Mostrar Moneda al Usuario

```typescript
function formatearPrecio(precio: number, moneda: string): string {
  const simbolos = {
    'UYU': '$',
    'USD': 'US$',
    'EUR': '€'
  };

  return `${simbolos[moneda] || '$'} ${precio.toFixed(2)}`;
}

// Uso
console.log(formatearPrecio(200, 'UYU')); // "$ 200.00"
console.log(formatearPrecio(50, 'USD'));  // "US$ 50.00"
```

### 3. Agrupar por Moneda en Órdenes

Si una orden tiene items en diferentes monedas:

```javascript
function agruparPorMoneda(items) {
  return items.reduce((grupos, item) => {
    const moneda = item.currency;
    if (!grupos[moneda]) {
      grupos[moneda] = {
        currency: moneda,
        currency_code_dgi: item.currency_code_dgi,
        items: [],
        total: 0
      };
    }
    grupos[moneda].items.push(item);
    grupos[moneda].total += item.price * item.quantity;
    return grupos;
  }, {});
}
```

## Preguntas Frecuentes

### ¿Puedo mezclar monedas en una misma orden?

Sí, técnicamente es posible. Cada item mantiene su moneda original. Sin embargo, para la facturación DGI, se recomienda:
- Emitir facturas separadas por moneda, o
- Convertir todo a la moneda principal antes de facturar

### ¿Cómo se calculan los impuestos en diferentes monedas?

El IVA se calcula sobre el precio en la moneda original del item. El porcentaje de IVA es el mismo independientemente de la moneda.

### ¿Qué pasa con los productos existentes?

Todos los productos y servicios existentes tienen automáticamente:
- `currency = 'UYU'`
- `currency_code_dgi = '858'`

Esto garantiza retrocompatibilidad total.

### ¿Debo actualizar mi CRM?

Si tu CRM ya procesa el webhook, los campos de moneda se añaden automáticamente. No es obligatorio procesarlos inmediatamente, pero se recomienda para una integración completa con la DGI.

## Recursos Adicionales

- **DGI Uruguay**: https://www.dgi.gub.uy/
- **Facturación Electrónica**: https://cfe.dgi.gub.uy/
- **ISO 4217**: https://www.iso.org/iso-4217-currency-codes.html
- **Banco Central del Uruguay**: https://www.bcu.gub.uy/

## Soporte

Para consultas sobre la implementación de monedas, contactar al equipo de desarrollo.
