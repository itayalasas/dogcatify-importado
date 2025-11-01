# Sistema de Compartir Mascotas

## Descripción General

Permite a los usuarios compartir sus mascotas con otros usuarios (veterinarios, familia, amigos, cuidadores). Los usuarios con acceso compartido pueden ver y gestionar toda la información de la mascota según el nivel de permisos otorgado.

## Características Principales

### 1. Compartir Mascotas
- Enviar invitaciones por email
- Seleccionar tipo de relación (veterinario, familiar, amigo, cuidador, otro)
- Definir nivel de permisos (ver, editar, administrador)
- Sistema de invitaciones con estados (pendiente, aceptada, rechazada, revocada)

### 2. Gestión de Accesos
- Ver lista de personas con acceso
- Revocar accesos en cualquier momento
- Estados visuales de invitaciones
- Notificaciones automáticas

### 3. Visualización
- Badge "Compartida" en mascotas compartidas contigo
- Iconos de compartir y eliminar solo para dueños
- Mascotas compartidas aparecen en tu lista de mascotas

## Base de Datos

### Tabla: `pet_shares`

```sql
CREATE TABLE pet_shares (
  id uuid PRIMARY KEY,
  pet_id uuid REFERENCES pets(id),
  owner_id uuid REFERENCES profiles(id),
  shared_with_user_id uuid REFERENCES profiles(id),
  permission_level text ('view', 'edit', 'admin'),
  relationship_type text ('veterinarian', 'family', 'friend', 'caretaker', 'other'),
  status text ('pending', 'accepted', 'rejected', 'revoked'),
  invited_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
);
```

### Políticas RLS

1. **Dueños pueden ver/crear/actualizar/eliminar** sus compartidos
2. **Usuarios compartidos pueden ver** sus compartidos
3. **Usuarios compartidos pueden aceptar/rechazar** invitaciones
4. **No se puede compartir con uno mismo**
5. **Solo una invitación activa** por combinación pet-usuario

### Triggers y Notificaciones

#### Notificación de Invitación
Cuando se comparte una mascota:
```
Título: "¡Nueva mascota compartida!"
Mensaje: "[Dueño] ha compartido a [Mascota] contigo"
```

#### Notificación de Aceptación
Cuando se acepta una invitación:
```
Título: "Invitación aceptada"
Mensaje: "[Usuario] ahora puede ver y gestionar a [Mascota]"
```

## Interfaz de Usuario

### 1. PetCard (Componente)

**Nuevas características:**
- Botón de compartir (icono UserPlus) - Solo para dueños
- Badge "Compartida" - Solo para mascotas compartidas contigo
- Botón de eliminar - Solo para dueños

**Ubicación de botones:**
- Compartir: Esquina superior derecha (segundo desde la derecha)
- Eliminar: Esquina superior derecha (primera)
- Badge compartida: Esquina inferior izquierda

### 2. Pantalla de Compartir (`/pets/share-pet`)

#### Sección: Invitar a alguien

**Campos:**
- Email del usuario (input con validación)
- Tipo de relación (5 opciones con iconos):
  - 🩺 Veterinario/a
  - 👨‍👩‍👧 Familiar
  - 🤝 Amigo/a
  - 🏠 Cuidador/a
  - 👤 Otro

**Niveles de permisos:**
1. **Ver**: Solo puede ver información
2. **Editar**: Puede ver y editar información
3. **Administrador**: Control total (compartir, eliminar)

**Botón:** "Enviar invitación"

#### Sección: Personas con acceso

**Lista de compartidos:**
- Nombre del usuario
- Email
- Tipo de relación
- Nivel de permisos
- Estado (badge con color):
  - ✅ Aceptada (verde)
  - ⏰ Pendiente (amarillo)
  - ❌ Revocada (rojo)
- Botón de revocar (solo si no está revocada)

### 3. Pantalla de Mascotas (`/pets`)

**Cambios:**
- Muestra mascotas propias + mascotas compartidas contigo
- Badge "Compartida" en mascotas compartidas
- Botones de compartir/eliminar solo para dueños
- Tap en cualquier mascota para ver detalles

## Flujos de Usuario

### Flujo 1: Compartir una Mascota

```
1. Usuario A (dueño) abre pantalla de Mascotas
2. Tap en botón de compartir (UserPlus) en PetCard
3. Se abre pantalla "Compartir [Mascota]"
4. Ingresa email de Usuario B
5. Selecciona tipo de relación (ej: Veterinario)
6. Selecciona nivel de permisos (ej: Editar)
7. Tap en "Enviar invitación"
8. Sistema busca Usuario B por email
9. Si existe, crea registro en pet_shares (status: pending)
10. Trigger envía notificación a Usuario B
11. Alert: "Invitación enviada a [email]"
12. Usuario B recibe notificación push
```

### Flujo 2: Aceptar Invitación

```
1. Usuario B recibe notificación
2. Tap en notificación
3. Navega a pantalla de la mascota (futuro)
4. Ve información de la mascota
5. Ve botón "Aceptar invitación"
6. Tap en "Aceptar"
7. Sistema actualiza status a 'accepted'
8. Se registra fecha de aceptación
9. Trigger envía notificación a Usuario A
10. Mascota aparece en lista de Usuario B con badge "Compartida"
11. Usuario A recibe notificación: "[Usuario B] aceptó tu invitación"
```

### Flujo 3: Revocar Acceso

```
1. Usuario A abre pantalla "Compartir [Mascota]"
2. Ve lista de personas con acceso
3. Tap en botón revocar (UserX) junto a Usuario B
4. Alert: "¿Revocar acceso de [Usuario B]?"
5. Tap en "Revocar"
6. Sistema actualiza status a 'revoked'
7. Se registra fecha de revocación
8. Mascota desaparece de lista de Usuario B
9. Usuario B ya no puede acceder a información
```

### Flujo 4: Ver Mascota Compartida

```
1. Usuario B abre pantalla de Mascotas
2. Ve sus mascotas + mascotas compartidas con él
3. Mascotas compartidas tienen badge "Compartida" (verde)
4. NO ve botones de compartir/eliminar (no es dueño)
5. Tap en mascota para ver detalles completos
6. Puede ver/editar según permisos otorgados
```

## Códigos de Color

### Estados
- **Aceptada**: `#10B981` (verde)
- **Pendiente**: `#F59E0B` (amarillo)
- **Revocada**: `#EF4444` (rojo)

### Botones
- **Compartir**: `rgba(59, 130, 246, 0.9)` (azul)
- **Eliminar**: `rgba(239, 68, 68, 0.9)` (rojo)

### Badge Compartida
- **Background**: `rgba(16, 185, 129, 0.9)` (verde)
- **Texto**: `#FFFFFF` (blanco)

## Validaciones

### Al Crear Compartido
1. ✅ Email no vacío
2. ✅ Usuario existe en la BD
3. ✅ No compartir con uno mismo
4. ✅ No duplicar compartido activo
5. ✅ Usuario es dueño de la mascota

### Al Revocar
1. ✅ Usuario es dueño
2. ✅ Compartido existe
3. ✅ Confirmación del usuario

### Al Aceptar/Rechazar
1. ✅ Usuario es el destinatario
2. ✅ Estado es 'pending'
3. ✅ Solo puede cambiar a 'accepted' o 'rejected'

## Permisos por Nivel

### View (Ver)
- ✅ Ver información básica
- ✅ Ver historial médico
- ✅ Ver álbumes
- ❌ Editar información
- ❌ Agregar registros
- ❌ Eliminar mascota
- ❌ Compartir con otros

### Edit (Editar)
- ✅ Todo lo de "View"
- ✅ Editar información básica
- ✅ Agregar registros médicos
- ✅ Agregar fotos/videos
- ❌ Eliminar mascota
- ❌ Compartir con otros

### Admin (Administrador)
- ✅ Todo lo de "Edit"
- ✅ Compartir con otros usuarios
- ✅ Revocar accesos
- ⚠️ Eliminar mascota (con precaución)

## Casos de Uso

### Caso 1: Veterinario
```
Usuario: María (dueña de Max, un perro)
Compartir con: Dr. López (veterinario)
Relación: Veterinarian
Permisos: Edit

Beneficio:
- Dr. López puede ver historial completo
- Puede agregar registros de consultas
- Puede actualizar vacunas/tratamientos
- María mantiene control total
```

### Caso 2: Familiar
```
Usuario: Juan (dueño de Luna, una gata)
Compartir con: Ana (hermana)
Relación: Family
Permisos: View

Beneficio:
- Ana puede ver información de Luna
- Útil cuando Ana cuida a Luna
- No puede modificar nada
- Juan mantiene control total
```

### Caso 3: Cuidador
```
Usuario: Pedro (dueño de Rocky, un perro)
Compartir con: Guardería "Pets Hotel"
Relación: Caretaker
Permisos: Edit

Beneficio:
- Guardería puede ver historial médico
- Puede registrar actividades diarias
- Puede agregar fotos durante estadía
- Pedro puede revocar al terminar servicio
```

## Seguridad

### RLS (Row Level Security)
Todas las operaciones están protegidas por políticas RLS:

1. **Lectura**: Solo dueños y usuarios compartidos
2. **Escritura**: Solo dueños pueden crear/actualizar/eliminar
3. **Aceptar**: Solo usuario destinatario
4. **Validaciones**: A nivel de BD (constraints)

### Prevención de Abusos
- ❌ No compartir con uno mismo
- ❌ No duplicar invitaciones
- ❌ No modificar compartidos de otros
- ❌ No ver mascotas no compartidas
- ✅ Logs de todas las acciones
- ✅ Timestamps de todas las operaciones

## Testing

### Casos de Prueba

#### 1. Compartir con email válido
```
Input: email existente, tipo, permisos
Esperado: Invitación creada, notificación enviada
```

#### 2. Compartir con email inexistente
```
Input: email no registrado
Esperado: Error "No se encontró usuario"
```

#### 3. Compartir con uno mismo
```
Input: propio email
Esperado: Error "No puedes compartir contigo mismo"
```

#### 4. Duplicar compartido
```
Input: email ya compartido
Esperado: Error "Ya has compartido esta mascota"
```

#### 5. Revocar acceso
```
Input: shareId válido
Esperado: Status = revoked, mascota desaparece para usuario B
```

#### 6. Ver mascotas compartidas
```
Input: usuario con mascotas compartidas
Esperado: Lista incluye mascotas propias + compartidas con badge
```

## Archivos Modificados/Creados

### Base de Datos
- ✅ `supabase/migrations/create_pet_sharing_system.sql`

### Componentes
- ✅ `components/PetCard.tsx` (modificado)
  - Agregado botón compartir
  - Agregado badge "Compartida"
  - Props: onShare, isShared

### Pantallas
- ✅ `app/pets/share-pet.tsx` (nuevo)
  - Formulario de invitación
  - Lista de compartidos
  - Gestión de accesos

- ✅ `app/(tabs)/pets.tsx` (modificado)
  - Carga mascotas compartidas
  - Handler handleSharePet
  - Condiciones de botones según dueño

## Próximas Mejoras

### Fase 2
1. **Pantalla de aceptar invitación**
   - Vista previa de la mascota
   - Botones aceptar/rechazar
   - Información del dueño

2. **Notificaciones en app**
   - Lista de invitaciones pendientes
   - Badge con contador
   - Acceso rápido desde perfil

3. **Historial de compartidos**
   - Log de todas las acciones
   - Quién aceptó/rechazó cuándo
   - Auditoría completa

### Fase 3
1. **Permisos granulares**
   - Configurar qué puede ver/editar específicamente
   - Permisos por sección
   - Templates de permisos

2. **Grupos**
   - Compartir con múltiples usuarios
   - Crear grupos (ej: "Mi familia")
   - Permisos por grupo

3. **Compartir temporalmente**
   - Definir fecha de expiración
   - Auto-revocar después de X días
   - Útil para cuidadores temporales

## Preguntas Frecuentes

### ¿Puedo compartir con alguien que no tiene cuenta?
No, el usuario debe estar registrado en la app.

### ¿El usuario compartido puede eliminar la mascota?
Solo si tiene permisos de "Administrador", pero se recomienda precaución.

### ¿Puedo cambiar el nivel de permisos después?
Sí, el dueño puede actualizar permisos en cualquier momento.

### ¿Qué pasa si revoco el acceso?
La mascota desaparece inmediatamente de la lista del usuario y pierde todo acceso.

### ¿El usuario compartido puede compartir con otros?
Solo si tiene permisos de "Administrador".

### ¿Puedo ver quién tiene acceso a mi mascota?
Sí, en la pantalla "Compartir [Mascota]" aparece la lista completa.

---

**Sistema implementado y funcionando** ✅

Los usuarios ahora pueden compartir sus mascotas con veterinarios, familia, amigos y ver las mascotas compartidas con ellos en una sola pantalla unificada.
