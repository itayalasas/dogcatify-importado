# Deep Links para Compartir Mascotas

## Descripción

Sistema completo de **Deep Links** y **notificaciones push** para invitaciones de compartir mascotas. Permite que los usuarios reciban notificaciones con links directos que abren la app en la pantalla correcta, incluso si no están autenticados.

---

## ¿Cómo Funciona?

### 📱 Flujo Completo

```
1. Usuario A comparte mascota con Usuario B
   ↓
2. Se crea registro en pet_shares (status: pending)
   ↓
3. Trigger automático crea notificación push con deep link
   ↓
4. Usuario B recibe notificación en su dispositivo
   ↓
5. Usuario B toca la notificación
   ↓
6. App se abre en pantalla de invitación
   ↓
7. Si NO está logueado → va a login → regresa a invitación
   ↓
8. Usuario B acepta o rechaza la invitación
```

---

## 🔗 Deep Links Configurados

### 1. Invitación de mascota compartida
```
dogcatify://pet-share/{shareId}
https://dogcatify.app/pet-share/{shareId}
```

**Qué hace:**
- Abre la app en la pantalla de invitación
- Si el usuario no está autenticado, lo lleva al login primero
- Después del login, regresa automáticamente a la invitación

**Ejemplo:**
```
dogcatify://pet-share/10a1ad2e-2bec-43ef-b302-a13a965026f1
```

### 2. Detalles de mascota
```
dogcatify://pets/{petId}
https://dogcatify.app/pets/{petId}
```

**Qué hace:**
- Abre la app directamente en los detalles de una mascota
- Se usa cuando el usuario acepta una invitación

**Ejemplo:**
```
dogcatify://pets/5dea4a52-79d3-4ee1-bd98-75ea8310761d
```

---

## 📦 Estructura de Notificación Push

Las notificaciones ahora incluyen toda la información necesaria para el deep linking:

```json
{
  "title": "¡Nueva mascota compartida!",
  "body": "Lemuel Hernandez ha compartido a Sam contigo",
  "data": {
    "type": "pet_share_invitation",
    "petId": "5dea4a52-79d3-4ee1-bd98-75ea8310761d",
    "shareId": "10a1ad2e-2bec-43ef-b302-a13a965026f1",
    "ownerId": "8b0ac28e-1095-4b66-bb4a-181128870e85",
    "relationshipType": "family",
    "screen": "PetShare",
    "url": "dogcatify://pet-share/10a1ad2e-2bec-43ef-b302-a13a965026f1",
    "link": "https://dogcatify.app/pet-share/10a1ad2e-2bec-43ef-b302-a13a965026f1",
    "deepLink": "dogcatify://pet-share/10a1ad2e-2bec-43ef-b302-a13a965026f1",
    "click_action": "OPEN_PET_SHARE_INVITATION"
  }
}
```

### Campos Importantes

| Campo | Descripción |
|-------|-------------|
| `url` | Deep link con scheme personalizado (dogcatify://) |
| `link` | Deep link con HTTPS para universal links |
| `deepLink` | Alias de `url` para compatibilidad |
| `click_action` | Action para Android (categorización) |
| `type` | Tipo de notificación para manejo interno |
| `shareId` | ID de la invitación (para cargar detalles) |

---

## 🏗️ Implementación Técnica

### 1. Configuración en app.json

```json
{
  "scheme": "dogcatify",
  "ios": {
    "associatedDomains": [
      "applinks:dogcatify.app",
      "applinks:www.dogcatify.app"
    ]
  },
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          { "scheme": "dogcatify", "host": "*" },
          { "scheme": "https", "host": "dogcatify.app", "pathPrefix": "/pet-share" }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

### 2. Manejo de Deep Links (_layout.tsx)

```typescript
// app/_layout.tsx
useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const { path } = Linking.parse(event.url);

    if (path?.startsWith('pet-share/')) {
      const shareId = path.replace('pet-share/', '');
      router.push(`/pet-share/${shareId}`);
    }
    else if (path?.startsWith('pets/')) {
      const petId = path.replace('pets/', '');
      router.push(`/pets/${petId}`);
    }
  };

  Linking.addEventListener('url', handleDeepLink);
}, []);
```

### 3. Pantalla de Invitación (pet-share/[id].tsx)

```typescript
export default function PetShareInvitationScreen() {
  const { id: shareId } = useLocalSearchParams();
  const { currentUser } = useAuth();

  useEffect(() => {
    // Si no está autenticado, redirigir a login con redirect
    if (!currentUser) {
      router.replace({
        pathname: '/auth/login',
        params: { redirect: `/pet-share/${shareId}` },
      });
      return;
    }

    loadInvitation();
  }, [currentUser, shareId]);

  // ... resto del código
}
```

### 4. Login con Redirect (auth/login.tsx)

```typescript
export default function Login() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const handleLogin = async () => {
    const result = await login(email, password);

    if (result) {
      if (redirect) {
        router.replace(redirect); // Volver a la pantalla original
      } else {
        router.replace('/(tabs)');
      }
    }
  };
}
```

### 5. Trigger de Base de Datos

```sql
CREATE OR REPLACE FUNCTION notify_pet_share_created()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  owner_name text;
  deep_link_url text;
  https_link_url text;
BEGIN
  SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;
  SELECT display_name INTO owner_name FROM profiles WHERE id = NEW.owner_id;

  -- Construir deep links
  deep_link_url := 'dogcatify://pet-share/' || NEW.id;
  https_link_url := 'https://dogcatify.app/pet-share/' || NEW.id;

  -- Crear notificación con deep links
  INSERT INTO scheduled_notifications (
    user_id,
    notification_type,
    reference_id,
    reference_type,
    title,
    body,
    data,
    scheduled_for,
    status
  ) VALUES (
    NEW.shared_with_user_id,
    'pet_share_invitation',
    NEW.id,
    'pet_share',
    '¡Nueva mascota compartida!',
    owner_name || ' ha compartido a ' || pet_name || ' contigo',
    jsonb_build_object(
      'type', 'pet_share_invitation',
      'shareId', NEW.id,
      'url', deep_link_url,
      'link', https_link_url,
      'click_action', 'OPEN_PET_SHARE_INVITATION'
    ),
    now(),
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🧪 Cómo Probar

### Prueba 1: Usuario autenticado

1. **Usuario A** comparte mascota con **Usuario B**
2. Espera 1-2 minutos (para que el cron job envíe la notificación)
3. **Usuario B** (ya logueado) recibe la notificación
4. Toca la notificación
5. ✅ La app abre directamente en la pantalla de invitación

### Prueba 2: Usuario NO autenticado

1. **Usuario A** comparte mascota con **Usuario B**
2. **Usuario B** cierra sesión o nunca se ha logueado
3. Espera 1-2 minutos (para que el cron job envíe la notificación)
4. **Usuario B** recibe la notificación
5. Toca la notificación
6. La app abre en la pantalla de LOGIN
7. Después de hacer login
8. ✅ La app redirige automáticamente a la pantalla de invitación

### Prueba 3: Deep link manual

Puedes probar los deep links manualmente:

```bash
# En Android (ADB)
adb shell am start -W -a android.intent.action.VIEW -d "dogcatify://pet-share/YOUR_SHARE_ID"

# En iOS (Simulator)
xcrun simctl openurl booted "dogcatify://pet-share/YOUR_SHARE_ID"

# Universal link (HTTPS)
adb shell am start -W -a android.intent.action.VIEW -d "https://dogcatify.app/pet-share/YOUR_SHARE_ID"
```

---

## 📊 Verificar Notificaciones

### Ver últimas notificaciones con deep links

```sql
SELECT
  id,
  user_id,
  title,
  body,
  data->>'url' as deep_link_url,
  data->>'link' as https_link_url,
  status,
  created_at
FROM scheduled_notifications
WHERE data->>'type' = 'pet_share_invitation'
ORDER BY created_at DESC
LIMIT 10;
```

### Ver invitaciones pendientes

```sql
SELECT
  ps.id as share_id,
  p.name as pet_name,
  owner.display_name as owner_name,
  shared.display_name as shared_with_name,
  shared.email as shared_with_email,
  ps.status,
  ps.created_at,
  'dogcatify://pet-share/' || ps.id as deep_link
FROM pet_shares ps
JOIN pets p ON p.id = ps.pet_id
JOIN profiles owner ON owner.id = ps.owner_id
JOIN profiles shared ON shared.id = ps.shared_with_user_id
WHERE ps.status = 'pending'
ORDER BY ps.created_at DESC;
```

---

## 🔧 Troubleshooting

### Problema: La notificación no incluye el deep link

**Causa:** Trigger viejo sin deep links

**Solución:**
```sql
-- Verificar que el trigger use la función correcta
SELECT tgname, tgrelid::regclass, proname
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_pet_share_created';

-- Debe mostrar: notify_pet_share_created
```

### Problema: El deep link no abre la app

**Causa 1:** App no instalada o scheme no configurado

**Solución:** Verifica `app.json` tenga `scheme: "dogcatify"`

**Causa 2:** Intent filter no configurado (Android)

**Solución:** Reconstruir la app con `eas build`

### Problema: Después de login no redirige

**Causa:** Parámetro `redirect` no se está pasando

**Solución:** Verifica que login.tsx use `useLocalSearchParams` y maneje el redirect

```typescript
const { redirect } = useLocalSearchParams<{ redirect?: string }>();
// ...
if (redirect) {
  router.replace(redirect);
}
```

---

## 📚 Referencias

- [Expo Linking](https://docs.expo.dev/guides/linking/)
- [Deep Linking](https://docs.expo.dev/guides/deep-linking/)
- [Universal Links iOS](https://developer.apple.com/ios/universal-links/)
- [App Links Android](https://developer.android.com/training/app-links)

---

## 🎯 Resumen

✅ **Implementado:**
- Deep links con scheme personalizado (dogcatify://)
- Universal links con HTTPS (https://dogcatify.app)
- Notificaciones push con deep links incluidos
- Manejo de autenticación con redirect
- Pantalla de invitación con aceptar/rechazar
- Triggers automáticos en base de datos

✅ **Flujos soportados:**
- Usuario autenticado → notificación → pantalla directa
- Usuario NO autenticado → notificación → login → pantalla
- Deep link manual → pantalla (con auth check)

✅ **Beneficios:**
- Experiencia de usuario fluida
- Menos pasos para aceptar invitaciones
- Funciona incluso si la app está cerrada
- Compatible con iOS y Android
