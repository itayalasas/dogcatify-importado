# Sistema de Facturación de Promociones - DogCatify

## Descripción General

Sistema automático para facturar a los aliados por las promociones publicadas en la plataforma. La facturación se basa en:

- **Vistas**: Número de veces que los usuarios ven la promoción
- **Likes**: Número de usuarios que dieron "me gusta" a la promoción

## Características Principales

### 1. Cálculo Automático
- Precio configurable por vista (default: $0.10)
- Precio configurable por like (default: $0.50)
- Modos de facturación: solo vistas, solo likes, o ambos
- Cargo mínimo configurable (default: $10.00)
- IVA del 22% aplicado automáticamente

### 2. Generación de Facturas
- Número de factura único y secuencial (formato: INV-YYYYMM-####)
- PDF profesional con diseño corporativo
- Desglose detallado de vistas y likes
- Cálculo automático de subtotales, impuestos y total

### 3. Envío Automático
- Email automático al aliado con la factura adjunta
- PDF descargable localmente
- Template HTML profesional
- Confirmación de envío

## Archivos Creados

### 1. `/utils/promotionInvoicing.ts`
Utilidad principal con todas las funciones de facturación:

```typescript
// Funciones principales:
- getActivePricingConfig(): Obtener configuración de precios
- calculateInvoiceTotals(): Calcular montos de factura
- generateInvoiceNumber(): Generar número único
- generateInvoicePDF(): Crear PDF de factura
- createPromotionInvoice(): Crear factura completa
- saveInvoice(): Guardar factura
- getAllInvoices(): Obtener todas las facturas
```

### 2. `/supabase/functions/send-invoice-email/index.ts`
Edge Function para enviar facturas por email:

```typescript
// Endpoint: /functions/v1/send-invoice-email
// Método: POST
// Auth: Required (JWT)
```

### 3. Actualización en `/app/(admin-tabs)/promotions.tsx`
- Nuevo botón "Facturar" en cada promoción
- Modal de confirmación con resumen
- Generación y descarga automática de PDF
- Envío automático por email

## Uso del Sistema

### Para el Administrador

1. **Ver Promociones**
   - Acceder a la pestaña "Promociones" en el panel de administrador
   - Ver lista de promociones activas con estadísticas de vistas y likes

2. **Generar Factura**
   - Click en el botón verde "Facturar" en cualquier promoción
   - Aparece un resumen con vistas y likes actuales
   - Confirmar para generar y enviar automáticamente

3. **Resultado**
   - Factura generada con número único
   - PDF descargado automáticamente
   - Email enviado al aliado con factura adjunta
   - Confirmación de éxito con monto total

### Contenido del Email

El aliado recibirá un email profesional que incluye:

- Saludo personalizado
- Número de factura
- Nombre de la promoción
- Período facturado
- Monto total destacado
- PDF adjunto con desglose completo
- Información de contacto

### Contenido del PDF

La factura en PDF incluye:

- **Header**: Logo y título de DogCatify
- **Info de Factura**: Número, fecha, estado
- **Datos del Aliado**: Nombre y email
- **Detalles de Promoción**: Título y período
- **Tabla de Conceptos**:
  - Vistas (cantidad × precio)
  - Likes (cantidad × precio)
- **Totales**:
  - Subtotal
  - IVA (22%)
  - **Total final**
- **Notas**: Información adicional si aplica
- **Footer**: Información de contacto

## Configuración de Precios

### Valores por Defecto

```typescript
{
  pricePerView: 0.10,     // $0.10 por vista
  pricePerLike: 0.50,     // $0.50 por like
  billingMode: 'both',    // Facturar ambos
  minimumCharge: 10.00,   // Cargo mínimo $10
  taxPercentage: 22.0     // IVA 22%
}
```

### Modificar Configuración

Para cambiar los precios, editar en `/utils/promotionInvoicing.ts`:

```typescript
export const getActivePricingConfig = async (): Promise<PromotionPricingConfig> => {
  return {
    pricePerView: 0.15,      // Nuevo precio por vista
    pricePerLike: 0.75,      // Nuevo precio por like
    billingMode: 'both',     // 'views', 'likes', o 'both'
    minimumCharge: 15.00,    // Nuevo mínimo
    taxPercentage: 22.0      // IVA
  };
};
```

## Ejemplo de Cálculo

**Promoción:** "Descuento 50% en consultas"
- **Vistas:** 1,250
- **Likes:** 85
- **Precio por vista:** $0.10
- **Precio por like:** $0.50

### Cálculo:
```
Vistas:    1,250 × $0.10 = $125.00
Likes:        85 × $0.50 = $42.50
                Subtotal = $167.50
           IVA (22%)     = $36.85
                   TOTAL = $204.35
```

## Almacenamiento

Actualmente las facturas se guardan en `localStorage` del navegador:

```typescript
localStorage.setItem('promotion_invoices', JSON.stringify(invoices));
```

**Nota**: Para producción, se recomienda guardar en Supabase con las migraciones incluidas en los comentarios del código.

## Variables de Entorno Requeridas

### Edge Function (Supabase)

```env
RESEND_API_KEY=re_xxxxx  # API key de Resend para envío de emails
```

### Aplicación Cliente

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

## Migraciones de Base de Datos (Opcional)

Para persistir las facturas en Supabase, ejecutar las migraciones SQL comentadas en el código que crean:

1. **Tabla `promotions`**: Promociones con contadores de vistas/likes
2. **Tabla `promotion_pricing_config`**: Configuración de precios
3. **Tabla `promotion_invoices`**: Registro de facturas
4. **Políticas RLS**: Seguridad de acceso
5. **Triggers**: Auto-generación de números de factura

## Seguridad

- ✅ Solo administradores pueden generar facturas
- ✅ Edge Function con autenticación JWT requerida
- ✅ PDFs generados en el cliente (no almacenados en servidor)
- ✅ Emails enviados a través de servicio seguro (Resend)
- ✅ Datos sensibles no expuestos en logs

## Mejoras Futuras

1. **Historial de Facturas**: Panel para ver todas las facturas generadas
2. **Estados de Pago**: Marcar facturas como pagadas
3. **Reportes**: Dashboard con estadísticas de facturación
4. **Exportación**: Exportar facturas a Excel/CSV
5. **Recordatorios**: Emails automáticos de pago pendiente
6. **Multi-moneda**: Soporte para diferentes monedas
7. **Descuentos**: Sistema de descuentos para aliados

## Soporte

Para preguntas o problemas:
- Email: admin@dogcatify.com
- Revisar logs del navegador para debugging
- Verificar que las promociones tengan aliado asociado
- Confirmar configuración de variables de entorno

---

**Versión:** 1.0.0
**Última actualización:** 2025-10-14
**Autor:** Sistema DogCatify
