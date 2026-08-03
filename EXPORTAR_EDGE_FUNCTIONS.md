# Despliegue de Edge Functions

El despliegue automatizado está definido en `azure-pipelines-supabase-deploy.yml`.

1. Configure los valores reales únicamente en el grupo seguro `supabase-prod` de Azure DevOps.
2. Mantenga en Git solo nombres de variables y marcadores, como los de `secrets.env.template`.
3. Ejecute el pipeline para desplegar migraciones, funciones y secretos.
4. Verifique `mobile-config`: solo debe devolver valores públicos permitidos.

Nunca copie claves privadas, `SUPABASE_SERVICE_ROLE_KEY` ni credenciales de proveedores en comandos versionados, documentación o variables `EXPO_PUBLIC_*`.
