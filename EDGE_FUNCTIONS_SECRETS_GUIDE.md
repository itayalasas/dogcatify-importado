# Secretos de Supabase Edge Functions

Los valores sensibles se guardan en Supabase Secrets y en el grupo seguro `supabase-prod` de Azure DevOps. No se copian en `app.json`, archivos `EXPO_PUBLIC_*`, documentación, scripts, migraciones ni bundles compilados.

## Variables públicas del cliente

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

La clave anónima/publicable no otorga permisos administrativos; la protección de datos depende de las políticas RLS.

## Secretos exclusivos del servidor

- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_API_KEY`
- `FIREBASE_PRIVATE_KEY`
- claves de contabilidad, CRM, webhooks y otros proveedores

La referencia completa de nombres está en `secrets.env.template`, que solo contiene marcadores.

## Despliegue

El pipeline `azure-pipelines-supabase-deploy.yml` transfiere los secretos del grupo seguro a las Edge Functions sin imprimir sus valores. Después de una exposición accidental, rote la credencial en el proveedor antes de volver a desplegar.
