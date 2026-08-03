# Referencia segura de configuración

La configuración de producción se administra mediante Azure DevOps y Supabase Secrets. El repositorio no contiene comandos con valores reales.

- Use `secrets.env.template` para consultar los nombres esperados.
- Use `azure-pipelines-supabase-deploy.yml` para desplegar las Edge Functions.
- Use `scripts/test-mobile-config.js` para comprobar que el endpoint móvil no entrega secretos.
- Rote inmediatamente cualquier credencial que haya aparecido en un commit, log, captura o bundle.

Las aplicaciones móviles solo reciben `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y la lista pública devuelta por `mobile-config`.
