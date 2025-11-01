# 🔐 Sistema de Permisos para Mascotas Compartidas

## 📋 Descripción

Los permisos definen qué acciones puede realizar un usuario con una mascota compartida. Hay 3 niveles de permisos claramente diferenciados con iconos y colores.

## 🎨 Niveles de Permisos (Diseño)

### 1. Ver (View) - Verde
```
┌────────────────────────────────────────────┐
│  [👁️]  Ver                           [✓] │
│        Solo puede ver información          │
└────────────────────────────────────────────┘
Color: #10B981 (verde)
Icono: Eye (ojo)
```

**Permisos incluidos:**
- ✅ Ver información básica (nombre, raza, edad, peso)
- ✅ Ver historial médico completo
- ✅ Ver vacunas y tratamientos
- ✅ Ver álbumes de fotos/videos
- ✅ Ver registros de peso
- ✅ Ver citas veterinarias
- ❌ NO puede editar nada
- ❌ NO puede agregar registros
- ❌ NO puede eliminar
- ❌ NO puede compartir con otros

### 2. Editar (Edit) - Azul
```
┌────────────────────────────────────────────┐
│  [✏️]  Editar                        [✓] │
│        Puede ver y editar información      │
└────────────────────────────────────────────┘
Color: #3B82F6 (azul)
Icono: Edit3 (lápiz)
```

**Permisos incluidos:**
- ✅ Todo lo de "Ver"
- ✅ Editar información básica
- ✅ Agregar registros médicos (vacunas, tratamientos)
- ✅ Agregar fotos/videos a álbumes
- ✅ Registrar peso
- ✅ Crear/editar citas veterinarias
- ✅ Actualizar información de salud
- ❌ NO puede eliminar la mascota
- ❌ NO puede compartir con otros

### 3. Administrador (Admin) - Morado
```
┌────────────────────────────────────────────┐
│  [🛡️]  Administrador                [✓] │
│         Control total (compartir, eliminar)│
└────────────────────────────────────────────┘
Color: #8B5CF6 (morado)
Icono: Shield (escudo)
```

**Permisos incluidos:**
- ✅ Todo lo de "Editar"
- ✅ Compartir con otros usuarios
- ✅ Revocar accesos
- ✅ Cambiar permisos de otros
- ⚠️ Eliminar la mascota (con precaución)

## 🔍 Verificación de Permisos en el Código

### Función Helper

```typescript
// utils/permissions.ts
export const checkPetPermission = async (
  userId: string,
  petId: string,
  requiredPermission: 'view' | 'edit' | 'admin'
): Promise<boolean> => {
  // Si es el dueño, tiene todos los permisos
  const { data: pet } = await supabaseClient
    .from('pets')
    .select('owner_id')
    .eq('id', petId)
    .single();

  if (pet?.owner_id === userId) return true;

  // Si no es dueño, verificar en pet_shares
  const { data: share } = await supabaseClient
    .from('pet_shares')
    .select('permission_level')
    .eq('pet_id', petId)
    .eq('shared_with_user_id', userId)
    .eq('status', 'accepted')
    .single();

  if (!share) return false;

  // Jerarquía de permisos
  const permissionHierarchy = {
    'view': 1,
    'edit': 2,
    'admin': 3
  };

  return permissionHierarchy[share.permission_level] >=
         permissionHierarchy[requiredPermission];
};
```

### Uso en Pantallas

```typescript
// En cualquier pantalla de mascota
const [hasEditPermission, setHasEditPermission] = useState(false);
const [hasAdminPermission, setHasAdminPermission] = useState(false);

useEffect(() => {
  const checkPermissions = async () => {
    const canEdit = await checkPetPermission(
      currentUser.id,
      petId,
      'edit'
    );
    const canAdmin = await checkPetPermission(
      currentUser.id,
      petId,
      'admin'
    );

    setHasEditPermission(canEdit);
    setHasAdminPermission(canAdmin);
  };

  checkPermissions();
}, [petId, currentUser]);

// Mostrar/ocultar botones según permisos
{hasEditPermission && (
  <Button onPress={handleEdit}>Editar</Button>
)}

{hasAdminPermission && (
  <Button onPress={handleShare}>Compartir</Button>
)}
```

## 🎯 Implementación en Pantallas Clave

### 1. Pantalla de Detalle de Mascota

```typescript
// app/pets/[id].tsx
- SI es dueño O tiene permiso 'edit': Mostrar botón "Editar"
- SI es dueño O tiene permiso 'admin': Mostrar botón "Compartir"
- SI es dueño O tiene permiso 'admin': Mostrar botón "Eliminar"
- SI solo tiene 'view': Solo mostrar información
```

### 2. Pantalla de Historial Médico

```typescript
// app/medical-history/[id].tsx
- SI es dueño O tiene permiso 'edit': Permitir agregar registros
- SI es dueño O tiene permiso 'edit': Permitir editar registros
- SI solo tiene 'view': Solo mostrar información
```

### 3. Pantalla de Álbumes

```typescript
// app/pets/albums/[id].tsx
- SI es dueño O tiene permiso 'edit': Permitir agregar fotos/videos
- SI es dueño O tiene permiso 'edit': Permitir eliminar fotos/videos
- SI solo tiene 'view': Solo mostrar álbum
```

### 4. Pantalla de Compartir

```typescript
// app/pets/share-pet.tsx
- SOLO si es dueño O tiene permiso 'admin': Permitir acceso
- Si no: Mostrar mensaje "No tienes permisos"
```

## 🗄️ Políticas RLS en Supabase

### Lectura de Mascotas

```sql
-- Política existente actualizada
CREATE POLICY "Users can view own and shared pets"
  ON pets
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pet_shares
      WHERE pet_shares.pet_id = pets.id
      AND pet_shares.shared_with_user_id = auth.uid()
      AND pet_shares.status = 'accepted'
      -- Cualquier nivel de permiso puede VER
    )
  );
```

### Actualización de Mascotas

```sql
-- Solo dueño o usuarios con permiso 'edit' o 'admin'
CREATE POLICY "Users can update if they have edit permissions"
  ON pets
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pet_shares
      WHERE pet_shares.pet_id = pets.id
      AND pet_shares.shared_with_user_id = auth.uid()
      AND pet_shares.status = 'accepted'
      AND pet_shares.permission_level IN ('edit', 'admin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pet_shares
      WHERE pet_shares.pet_id = pets.id
      AND pet_shares.shared_with_user_id = auth.uid()
      AND pet_shares.status = 'accepted'
      AND pet_shares.permission_level IN ('edit', 'admin')
    )
  );
```

### Eliminación de Mascotas

```sql
-- Solo dueño (admin compartido NO puede eliminar por seguridad)
CREATE POLICY "Only owner can delete pets"
  ON pets
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
```

### Compartir Mascotas (pet_shares)

```sql
-- Solo dueño o admin puede crear shares
CREATE POLICY "Owner or admin can create shares"
  ON pet_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM pet_shares existing
      WHERE existing.pet_id = pet_id
      AND existing.shared_with_user_id = auth.uid()
      AND existing.status = 'accepted'
      AND existing.permission_level = 'admin'
    )
  );
```

## 📊 Casos de Uso por Nivel

### Nivel VIEW - Veterinario (Consulta)

**Escenario:** Vet que necesita consultar historial antes de cita

```
Usuario: Dr. López (Veterinario)
Mascota: Max (de María)
Permiso: VIEW
Relación: Veterinarian

Puede hacer:
✅ Ver historial médico completo
✅ Ver vacunas aplicadas
✅ Ver tratamientos actuales
✅ Ver alergias y condiciones
✅ Consultar peso histórico

No puede hacer:
❌ Agregar consulta nueva
❌ Modificar información
❌ Compartir con asistentes
```

### Nivel EDIT - Veterinario (Activo)

**Escenario:** Vet que atiende activamente la mascota

```
Usuario: Dr. López (Veterinario)
Mascota: Max (de María)
Permiso: EDIT
Relación: Veterinarian

Puede hacer:
✅ Todo lo de VIEW
✅ Registrar consultas
✅ Agregar vacunas aplicadas
✅ Recetar tratamientos
✅ Actualizar peso
✅ Programar citas de seguimiento

No puede hacer:
❌ Compartir con otros vets
❌ Eliminar la mascota
```

### Nivel EDIT - Familiar

**Escenario:** Hermana que cuida la mascota temporalmente

```
Usuario: Ana (Hermana)
Mascota: Luna (de Juan)
Permiso: EDIT
Relación: Family

Puede hacer:
✅ Ver toda la información
✅ Agregar fotos/videos diarios
✅ Registrar comidas
✅ Actualizar peso
✅ Registrar actividades

No puede hacer:
❌ Compartir con otros
❌ Eliminar mascota
```

### Nivel ADMIN - Pareja

**Escenario:** Pareja que co-gestiona la mascota

```
Usuario: Pedro (Pareja)
Mascota: Rocky (de María)
Permiso: ADMIN
Relación: Family

Puede hacer:
✅ Todo lo de EDIT
✅ Compartir con veterinarios
✅ Compartir con guarderías
✅ Revocar accesos
✅ Gestión completa

Precaución:
⚠️ Puede eliminar (pero mejor que no)
```

## 🔄 Jerarquía de Permisos

```
ADMIN (3)
  ├── Incluye todo de EDIT
  ├── Compartir con otros
  ├── Revocar accesos
  └── Cambiar permisos

EDIT (2)
  ├── Incluye todo de VIEW
  ├── Editar información
  ├── Agregar registros
  └── Actualizar datos

VIEW (1)
  ├── Ver información básica
  ├── Ver historial médico
  ├── Ver álbumes
  └── Consultar registros
```

## 🎨 Diseño Visual Mejorado

### Estado No Seleccionado
```
┌─────────────────────────────────────────┐
│  [👁️]  Ver                            │
│  gris  Solo puede ver información       │
└─────────────────────────────────────────┘
```

### Estado Seleccionado
```
┌─────────────────────────────────────────┐
│  [👁️]  Ver                        [✓] │
│  verde Solo puede ver información  verde│
│        (fondo verde claro)              │
└─────────────────────────────────────────┘
```

### Elementos Visuales
1. **Icono circular** a la izquierda
   - Gris si no seleccionado
   - Color del nivel si seleccionado

2. **Título en negrita**
   - Negro si no seleccionado
   - Color del nivel si seleccionado

3. **Descripción**
   - Gris si no seleccionado
   - Color del nivel (80% opacidad) si seleccionado

4. **Check circular** a la derecha
   - Solo visible si seleccionado
   - Color del nivel

5. **Borde y fondo**
   - Gris claro si no seleccionado
   - Color claro del nivel + borde del color si seleccionado

## 🧪 Testing de Permisos

### Test 1: Usuario con VIEW
```
Given: Usuario con permiso VIEW
When: Intenta editar información
Then: Botón "Editar" no visible
```

### Test 2: Usuario con EDIT
```
Given: Usuario con permiso EDIT
When: Intenta agregar vacuna
Then: Puede agregar sin problema
```

### Test 3: Usuario con EDIT intenta compartir
```
Given: Usuario con permiso EDIT
When: Busca botón "Compartir"
Then: Botón no visible
```

### Test 4: Usuario con ADMIN
```
Given: Usuario con permiso ADMIN
When: Ve la mascota
Then: Tiene acceso a todo (ver, editar, compartir)
```

### Test 5: Dueño siempre tiene ADMIN
```
Given: Usuario es dueño
When: Ve cualquier opción
Then: Tiene acceso total automáticamente
```

## 📱 Feedback Visual

### Botones Deshabilitados
```typescript
<Button
  disabled={!hasEditPermission}
  onPress={handleEdit}
  style={!hasEditPermission && styles.disabledButton}
>
  Editar
</Button>
```

### Mensajes Informativos
```typescript
{!hasEditPermission && (
  <View style={styles.permissionWarning}>
    <Text>Solo tienes permiso para ver información</Text>
  </View>
)}
```

### Tooltips
```typescript
<Tooltip text="Necesitas permiso de edición">
  <Button disabled={!hasEditPermission}>
    Agregar Vacuna
  </Button>
</Tooltip>
```

## 🚀 Próximos Pasos

### Fase 1: Implementar Verificación Básica
1. ✅ Crear función `checkPetPermission`
2. ⏳ Agregar verificación en pantalla de detalle
3. ⏳ Agregar verificación en historial médico
4. ⏳ Agregar verificación en álbumes

### Fase 2: RLS Policies
1. ⏳ Actualizar políticas de pets
2. ⏳ Crear políticas para historial médico
3. ⏳ Crear políticas para álbumes
4. ⏳ Testear todas las políticas

### Fase 3: UI/UX
1. ✅ Diseño visual de niveles de permisos
2. ⏳ Mensajes informativos
3. ⏳ Tooltips explicativos
4. ⏳ Feedback en tiempo real

## 📄 Archivos a Crear/Modificar

### Nuevos Archivos
- ✅ `utils/permissions.ts` - Helper de verificación
- ⏳ `utils/permissionConstants.ts` - Constantes
- ⏳ `components/PermissionGuard.tsx` - Componente guard

### Archivos a Modificar
- ⏳ `app/pets/[id].tsx` - Detalle de mascota
- ⏳ `app/medical-history/[id].tsx` - Historial médico
- ⏳ `app/pets/albums/[id].tsx` - Álbumes
- ⏳ `app/pets/health/*` - Pantallas de salud
- ⏳ Supabase migrations - Nuevas políticas RLS

---

**Sistema de permisos diseñado y documentado** ✅

Los permisos están listos para ser implementados en todas las pantallas con un diseño visual claro y distintivo.
