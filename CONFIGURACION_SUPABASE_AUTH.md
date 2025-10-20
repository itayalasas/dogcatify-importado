# Configuración de Supabase Auth para Sistema de Emails Personalizado

## Problema
Supabase Auth está enviando emails de confirmación automáticamente con el formato viejo (HTML directo), interfiriendo con nuestro sistema personalizado de emails con templates.

## Solución: Desactivar Emails Automáticos de Supabase Auth

### Opción 1: Desactivar Confirmación de Email (Recomendada)

1. Ir al **Dashboard de Supabase**
2. Seleccionar tu proyecto
3. Ir a **Authentication** → **Settings** → **Email Auth**
4. **Desactivar** la opción "Enable email confirmations"
5. Guardar cambios

Con esto, Supabase Auth NO enviará emails automáticamente y usará SOLO nuestro sistema personalizado.

### Opción 2: Modificar el Template de Email (Alternativa)

Si necesitas mantener activa la confirmación de email en Supabase Auth:

1. Ir al **Dashboard de Supabase**
2. Ir a **Authentication** → **Email Templates** → **Confirm signup**
3. Modificar el template para que use nuestro sistema:

```html
<!-- Dejar el template vacío o redirigir a nuestro sistema -->
<html>
  <body>
    <!-- No enviar nada, usar solo nuestro sistema personalizado -->
  </body>
</html>
```

### Opción 3: Usar Email Hook (Avanzada)

Configurar un Database Webhook que intercepte los emails de Supabase Auth:

1. Crear un trigger en la base de datos que detecte cuando `auth.users` recibe un nuevo registro
2. El trigger puede cancelar el email automático de Supabase
3. Y llamar a nuestro sistema personalizado

## Verificación

Después de aplicar cualquiera de estas opciones:

1. **Registrar un nuevo usuario**
2. **Revisar los logs** de la edge function `send-email`
3. Deberías ver:
   ```
   Received email request: {
     template_name: 'confirmation',
     recipient_email: 'usuario@ejemplo.com',
     has_data: true
   }
   ```
4. **NO deberías ver**:
   ```
   Legacy email request to: usuario@ejemplo.com
   ```

## Configuración Actual del Código

El código ya está preparado para trabajar sin los emails automáticos de Supabase Auth:

```typescript
// contexts/AuthContext.tsx - línea 659
const { data, error } = await supabaseClient.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: undefined,  // No redirigir
    data: {
      skip_confirmation_email: true  // Intentar saltar email automático
    }
  }
});
```

**NOTA:** La opción `skip_confirmation_email` puede no funcionar en todas las versiones de Supabase Auth. La forma más confiable es desactivar "Enable email confirmations" en el Dashboard.

## Email Testing (Admin Settings)

La función de test de email en `app/(admin-tabs)/settings.tsx` también necesita actualizarse para usar templates:

```typescript
// ANTES (formato legacy):
const emailData = {
  to: email,
  subject: 'Test',
  html: '<p>Test</p>'
};

// DESPUÉS (formato con template):
const emailData = {
  template_name: 'test',  // Necesita crear template en API externa
  recipient_email: email,
  data: {
    test_date: new Date().toLocaleString()
  }
};
```

## Resumen

✅ **Acción Requerida:** Desactivar "Enable email confirmations" en Dashboard de Supabase
✅ **Código Actualizado:** Ya configurado para no enviar emails automáticos
⚠️ **Pendiente:** Crear template "test" en la API externa para el admin

## Referencias

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-email)
- [Custom Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
