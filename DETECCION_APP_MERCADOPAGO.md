# Detección de App de Mercado Pago

## Resumen de Cambios

Se implementó un sistema inteligente para detectar si el usuario tiene instalada la app de Mercado Pago en su dispositivo antes de abrir el pago desde el carrito de compras.

## ¿Qué se hizo?

### 1. Nueva función: `isMercadoPagoAppInstalled()`

**Ubicación:** `utils/mercadoPago.ts`

Esta función verifica si la app de Mercado Pago está instalada en el dispositivo del usuario.

**Cómo funciona:**
- Intenta verificar deep links específicos de Mercado Pago:
  - `mercadopago://`
  - `com.mercadopago.wallet://`
- Si alguno de estos esquemas responde, significa que la app está instalada
- Retorna `true` si la app está instalada, `false` en caso contrario

**Ejemplo de uso:**
```typescript
const hasApp = await isMercadoPagoAppInstalled();
console.log('App instalada:', hasApp); // true o false
```

### 2. Función mejorada: `openMercadoPagoPayment()`

**Ubicación:** `utils/mercadoPago.ts`

Se mejoró esta función para detectar la app antes de abrir el pago.

**Antes:**
- Simplemente abría la URL de pago sin verificar la app
- No informaba al usuario dónde se iba a abrir el pago
- No había feedback sobre si se abriría en app o navegador

**Ahora:**
- Verifica si la app está instalada antes de abrir
- Registra en los logs si se abre en app o navegador
- Retorna información detallada sobre dónde se abrió el pago

**Retorna:**
```typescript
{
  success: boolean;      // Si se abrió correctamente
  openedInApp: boolean;  // true = se abrió en la app, false = navegador
  error?: string;        // Mensaje de error si falló
}
```

### 3. Carrito mejorado: `app/cart/index.tsx`

Se actualizó el flujo de pago en el carrito para dar feedback visual al usuario.

**Cambios:**
- Muestra mensaje "Verificando app de Mercado Pago..." mientras detecta
- Después de abrir, muestra si se abrió en "app de Mercado Pago" o "navegador web"
- Los logs en consola muestran información detallada para debugging

**Flujo visual para el usuario:**
1. Usuario presiona "Pagar"
2. Ve modal de carga: "Preparando tu pago con Mercado Pago"
3. Cambia a: "Verificando app de Mercado Pago..."
4. Cambia a: "Abriendo app de Mercado Pago..." o "Abriendo navegador web..."
5. Se abre el pago en el lugar correspondiente

## Beneficios

### Para el Usuario:
✅ **Mejor experiencia:** Si tiene la app, se abre más rápido y con mejor interfaz
✅ **Claridad:** Sabe si se abrirá en la app o en el navegador
✅ **Confianza:** La app oficial de Mercado Pago genera más confianza
✅ **Comodidad:** Puede usar datos guardados en la app (tarjetas, direcciones)

### Para el Negocio:
✅ **Mayor conversión:** Mejor experiencia = más ventas completadas
✅ **Menos abandonos:** La app nativa es más rápida y confiable
✅ **Mejores reviews:** Usuarios satisfechos = mejores calificaciones
✅ **Debugging mejorado:** Logs detallados ayudan a resolver problemas

## Logs de Ejemplo

### Dispositivo CON app instalada:
```
Opening Mercado Pago payment: {
  isTestMode: false,
  urlLength: 185,
  urlDomain: 'www.mercadopago.com.uy',
  platform: 'android'
}
✅ Mercado Pago app detected with scheme: mercadopago://
Mercado Pago app status: {
  installed: true,
  willOpenIn: 'app'
}
Opening Mercado Pago URL...
✅ Mercado Pago URL opened successfully
Result: { success: true, openedInApp: true }
✅ Opened Mercado Pago successfully in app de Mercado Pago
```

### Dispositivo SIN app instalada:
```
Opening Mercado Pago payment: {
  isTestMode: false,
  urlLength: 185,
  urlDomain: 'www.mercadopago.com.uy',
  platform: 'ios'
}
❌ Mercado Pago app not installed
Mercado Pago app status: {
  installed: false,
  willOpenIn: 'browser'
}
Opening Mercado Pago URL...
✅ Mercado Pago URL opened successfully
Result: { success: true, openedInApp: false }
✅ Opened Mercado Pago successfully in navegador web
```

## Compatibilidad

### ✅ Plataformas Soportadas:
- Android (API 21+)
- iOS (13+)
- El sistema funciona en ambas plataformas de manera transparente

### ⚠️ Limitaciones:
- En web (navegador desktop) siempre se abre en navegador web
- La detección de deep links puede ser bloqueada por algunas ROMs personalizadas
- En iOS, la primera vez puede pedir permiso para abrir la app

## Archivos Modificados

1. **utils/mercadoPago.ts**
   - Nueva función `isMercadoPagoAppInstalled()`
   - Función mejorada `openMercadoPagoPayment()`
   - Mejores logs y manejo de errores

2. **app/cart/index.tsx**
   - Mensajes de feedback mejorados
   - Logs más informativos sobre dónde se abrió el pago

3. **scripts/test-mp-app-detection.js** (nuevo)
   - Script de prueba y documentación del flujo completo

## Testing

### Para probar la funcionalidad:

1. **Con la app instalada:**
   - Instala la app de Mercado Pago desde Play Store o App Store
   - Abre la app de DogCatiFy
   - Agrega productos al carrito
   - Presiona "Pagar"
   - Observa que se abre en la app de Mercado Pago

2. **Sin la app instalada:**
   - Desinstala la app de Mercado Pago
   - Abre la app de DogCatiFy
   - Agrega productos al carrito
   - Presiona "Pagar"
   - Observa que se abre en el navegador web

3. **Revisar logs:**
   - Abre la consola de desarrollo (React Native Debugger o metro bundler)
   - Observa los mensajes detallados sobre la detección de la app
   - Verifica que los logs muestren correctamente si se detectó la app

## Próximos Pasos (Opcional)

### Posibles mejoras futuras:
1. **Diálogo de sugerencia:** Si no tiene la app, sugerir instalarla
2. **Analytics:** Medir cuántos usuarios tienen la app vs navegador
3. **Preferencia del usuario:** Permitir elegir entre app y navegador
4. **Deep link directo:** Intentar abrir directamente en la app con parámetros específicos

## Soporte

Si encuentras algún problema:
1. Revisa los logs en la consola
2. Verifica que la app de Mercado Pago esté actualizada
3. Comprueba los permisos de la aplicación
4. Prueba en diferentes dispositivos para descartar problemas de hardware

## Documentación Adicional

- [Documentación de Mercado Pago](https://www.mercadopago.com.uy/developers)
- [React Native Linking API](https://reactnative.dev/docs/linking)
- [Deep Links en Android](https://developer.android.com/training/app-links)
- [Universal Links en iOS](https://developer.apple.com/ios/universal-links/)
