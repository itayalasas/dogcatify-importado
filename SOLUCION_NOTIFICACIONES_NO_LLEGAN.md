# Solución: Notificaciones No Llegan

## Problema Identificado

Las notificaciones no llegan porque **los tokens de push están asociados al proyecto anterior** (`0618d9ae-6714-46bb-adce-f4ee57fff324`) pero ahora estamos usando un nuevo proyecto (`3fb652b1-d582-40c8-a074-a1aa9358d666`).

Cuando cambias el `projectId` en `app.json`, todos los tokens existentes quedan inválidos para el nuevo proyecto.

## Solución

### Opción 1: Regenerar Tokens en Cada Dispositivo (Recomendado)

Cada usuario que ya tiene notificaciones habilitadas debe:

1. Abrir la app
2. Ir a **Perfil**
3. **Desactivar** las notificaciones (toggle OFF)
4. Cerrar y volver a abrir la app (o esperar unos segundos)
5. **Activar** las notificaciones de nuevo (toggle ON)
6. Probar la notificación

Esto generará un nuevo token asociado al `projectId` correcto.

### Opción 2: Limpiar Tokens Existentes en la Base de Datos

Si quieres forzar a todos los usuarios a regenerar sus tokens, puedes limpiar los tokens existentes:

\`\`\`sql
-- Limpiar TODOS los tokens (los usuarios deberán volver a habilitarlos)
UPDATE profiles
SET push_token = NULL,
    notification_preferences = jsonb_set(
      COALESCE(notification_preferences, '{}'::jsonb),
      '{push}',
      'false'
    )
WHERE push_token IS NOT NULL;
\`\`\`

**ADVERTENCIA:** Esto deshabilitará las notificaciones para todos los usuarios. Deberán volver a habilitarlas manualmente.

### Opción 3: Mantener el Proyecto Anterior

Si prefieres mantener los tokens existentes funcionando, puedes volver a usar el `projectId` anterior:

\`\`\`json
// En app.json
"extra": {
  "eas": {
    "projectId": "0618d9ae-6714-46bb-adce-f4ee57fff324"
  }
}
\`\`\`

Y cambiar el slug de vuelta a:
\`\`\`json
"slug": "dogcatify"
\`\`\`

**Pero esto causará problemas con el build actual.**

## ¿Por Qué Sucede Esto?

Cada token de Expo Push está asociado a un `projectId` específico. Cuando cambias de proyecto:
- Los tokens antiguos ya no funcionan con el nuevo proyecto
- Debes generar nuevos tokens
- No hay forma de "migrar" los tokens entre proyectos

## Recomendación

**Opción 1** es la mejor si tienes pocos usuarios de prueba actualmente. Cada uno regenera su token.

**Opción 2** úsala si tienes muchos usuarios y quieres forzar la regeneración masivamente.

## Verificación

Para verificar que el token es correcto:

1. Ve a la base de datos y revisa la tabla `profiles`
2. Verifica que después de regenerar, el token sigue teniendo el formato: `ExponentPushToken[...]`
3. Prueba enviando una notificación desde el perfil

## Logs Importantes

Cuando pruebes la notificación, revisa los logs en la consola:
- Debería mostrar "✅ Push notification sent successfully"
- El resultado debería tener `status: 'ok'`
- Si ves `status: 'error'` con `DeviceNotRegistered`, el token es inválido

## Actualización del Script de Prueba

He creado un script en `scripts/test-push-manual.js` que puedes ejecutar para probar tokens manualmente:

\`\`\`bash
node scripts/test-push-manual.js
\`\`\`

Cambia el `PUSH_TOKEN` en el script por el token que quieres probar.
