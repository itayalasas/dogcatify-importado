# DogCatiFy - Migración a Producción

## Inicio Rápido

### 1. Exportar Schema de Testing
```bash
cd /ruta/a/tu/proyecto
supabase db dump --file production_complete_schema.sql
```

### 2. Aplicar en Producción
```bash
# Opción A: Automático con script
chmod +x DEPLOY_TO_PRODUCTION.sh
./DEPLOY_TO_PRODUCTION.sh <tu-project-ref-produccion>

# Opción B: Manual
supabase link --project-ref <tu-project-ref-produccion>
supabase db push
supabase functions deploy
```

### 3. Configurar Secrets
```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='<json>' --project-ref <ref>
supabase secrets set OPENAI_API_KEY='<key>' --project-ref <ref>
supabase secrets set RESEND_API_KEY='<key>' --project-ref <ref>
supabase secrets set MERCADOPAGO_ACCESS_TOKEN='<token>' --project-ref <ref>
```

### 4. Verificar
Usa el checklist en `POST_MIGRATION_CHECKLIST.md`

---

## Archivos Importantes

### Documentación
- **`PRODUCTION_MIGRATION_GUIDE.md`** - Guía completa de migración
- **`EDGE_FUNCTIONS_DEPLOYMENT.md`** - Detalle de las 31 Edge Functions
- **`POST_MIGRATION_CHECKLIST.md`** - Verificación post-migración
- **`README_PRODUCCION.md`** - Este archivo (inicio rápido)

### Scripts
- **`DEPLOY_TO_PRODUCTION.sh`** - Script automatizado de despliegue
- **`PRODUCTION_SCHEMA_EXPORT.sql`** - Template para schema export

---

## Estructura de Base de Datos

### Tablas (51 total)
- **Usuarios**: profiles, email_confirmations
- **Mascotas**: pets, pet_health, pet_albums, pet_behavior, pet_shares
- **Partners**: partners, partner_services, partner_products, business_schedule
- **Órdenes**: orders, bookings, user_carts, webhook_subscriptions
- **Médico**: medical_alerts, vaccines_catalog, dewormers_catalog, etc.
- **IA Cache**: vaccine_recommendations_cache, illnesses_ai_cache, etc.
- **Social**: posts, comments, places, chat_conversations
- **Adopciones**: adoption_pets, adoption_chats, adoption_messages
- **Admin**: admin_settings, app_config, subscription_plans

### Edge Functions (31 total)
Ver `EDGE_FUNCTIONS_DEPLOYMENT.md` para lista completa

---

## Comandos Útiles

### Ver tablas en producción
```bash
supabase db dump --data-only --table=profiles
```

### Ver Edge Functions
```bash
supabase functions list --project-ref <ref>
```

### Ver logs de función
```bash
supabase functions logs <function-name> --project-ref <ref>
```

### Configurar Cron Job
Dashboard → Settings → API → Webhooks

---

## Secrets Requeridos

### Obligatorios
- `FIREBASE_SERVICE_ACCOUNT` - Para notificaciones push
- `FIREBASE_PROJECT_ID` - Para FCM
- `OPENAI_API_KEY` - Para IA y OCR
- `RESEND_API_KEY` - Para emails
- `MERCADOPAGO_ACCESS_TOKEN` - Para pagos (producción)

### Opcionales
- `DATADOG_API_KEY` - Para monitoreo
- `SENTRY_DSN` - Para tracking de errores

---

## Webhooks a Configurar

### MercadoPago
URL: `https://<ref>.supabase.co/functions/v1/mercadopago-webhook`
Eventos: `payment`, `merchant_order`

### Cron Jobs
- `cancel-expired-orders` - cada hora
- `send-scheduled-notifications` - cada 15 min
- `send-booking-confirmations` - cada hora

---

## Verificación Rápida

```sql
-- Tablas
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Debe ser: 51

-- RLS
SELECT count(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Debe ser: 0

-- Funciones
SELECT count(*) FROM information_schema.routines
WHERE routine_schema = 'public';
-- Debe ser: 20+
```

---

## Soporte

- **Documentación Supabase**: https://supabase.com/docs
- **Dashboard**: https://dashboard.supabase.com
- **Support**: support@supabase.io

---

## Notas Importantes

1. **NO migres datos de testing** - Solo estructura
2. **Usa credenciales de producción** para MercadoPago
3. **Configura backups automáticos** antes de go-live
4. **Monitorea logs** las primeras 24 horas
5. **Ten plan de rollback** listo

---

## Flujo Recomendado

```
1. Testing → Exportar schema
2. Producción → Aplicar schema
3. Producción → Desplegar Edge Functions
4. Producción → Configurar secrets
5. Producción → Configurar webhooks/crons
6. Verificar → Usar checklist
7. Monitorear → Primeras 24h
```

---

## Resumen de Archivos Generados

Después de la migración tendrás:

```
/tu-proyecto/
├── PRODUCTION_MIGRATION_GUIDE.md      # Guía completa
├── EDGE_FUNCTIONS_DEPLOYMENT.md       # Edge Functions detalladas
├── POST_MIGRATION_CHECKLIST.md        # Checklist de verificación
├── DEPLOY_TO_PRODUCTION.sh            # Script de despliegue
├── PRODUCTION_SCHEMA_EXPORT.sql       # Template de export
├── README_PRODUCCION.md               # Este archivo
└── production_complete_schema.sql     # Schema exportado (después de dump)
```

---

## ¿Listo para producción?

1. ✅ Lee `PRODUCTION_MIGRATION_GUIDE.md`
2. ✅ Ejecuta `DEPLOY_TO_PRODUCTION.sh`
3. ✅ Configura secrets y webhooks
4. ✅ Verifica con `POST_MIGRATION_CHECKLIST.md`
5. ✅ Monitorea y celebra! 🎉

