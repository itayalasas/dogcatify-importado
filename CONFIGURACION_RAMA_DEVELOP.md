# Configuración segura para desarrollo

La aplicación móvil necesita únicamente dos valores públicos para arrancar:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Estos valores identifican el proyecto y permiten usar las políticas RLS; no deben otorgar privilegios administrativos. Expo los incorpora al bundle de la app, por lo que deben considerarse públicos.

La app consulta luego `mobile-config`, que devuelve una lista estricta de configuración pública. Nunca debe devolver `SUPABASE_SERVICE_ROLE_KEY`, claves privadas de Firebase, credenciales del proveedor de correo ni secretos de integraciones.

Los secretos del servidor se configuran en el grupo seguro `supabase-prod` de Azure DevOps y se despliegan a Supabase Edge Functions. Use `secrets.env.template` como referencia de nombres, sin guardar valores reales en el repositorio.

Después de exponer accidentalmente una credencial:

1. Revóquela o rótela en el proveedor.
2. Actualice el grupo seguro de Azure DevOps/Supabase.
3. Vuelva a desplegar las Edge Functions.
4. Genere una nueva compilación móvil si cambió una clave pública.
