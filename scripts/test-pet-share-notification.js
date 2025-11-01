/**
 * Script para probar notificaciones de compartir mascotas
 *
 * Verifica:
 * 1. Que los triggers funcionen correctamente
 * 2. Que las notificaciones se registren en la tabla
 * 3. Que el sistema de envío funcione
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Error: Variables de entorno no configuradas');
  console.log('Necesitas:');
  console.log('  - EXPO_PUBLIC_SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY (o EXPO_PUBLIC_SUPABASE_ANON_KEY)\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPetShareNotifications() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  🧪 TEST: Notificaciones de Compartir Mascotas ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar que existan pet_shares recientes
    console.log('📋 Paso 1: Verificando pet_shares recientes...\n');

    const { data: recentShares, error: sharesError } = await supabase
      .from('pet_shares')
      .select(`
        id,
        pet_id,
        owner_id,
        shared_with_user_id,
        status,
        created_at,
        pets:pet_id (name),
        owner:owner_id (display_name),
        shared_user:shared_with_user_id (display_name, fcm_token)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (sharesError) {
      console.error('❌ Error obteniendo pet_shares:', sharesError);
      return;
    }

    if (!recentShares || recentShares.length === 0) {
      console.log('⚠️  No hay pet_shares en la base de datos');
      console.log('   Comparte una mascota desde la app para probar\n');
      return;
    }

    console.log(`✅ Encontrados ${recentShares.length} pet_shares:\n`);

    recentShares.forEach((share, index) => {
      console.log(`   ${index + 1}. ${share.owner?.display_name || 'Usuario'} → ${share.shared_user?.display_name || 'Usuario'}`);
      console.log(`      Mascota: ${share.pets?.name || 'N/A'}`);
      console.log(`      Estado: ${share.status}`);
      console.log(`      FCM Token: ${share.shared_user?.fcm_token ? '✓ Presente' : '✗ NO disponible'}`);
      console.log(`      Creado: ${new Date(share.created_at).toLocaleString()}`);
      console.log('');
    });

    // 2. Verificar notificaciones creadas para estos shares
    console.log('📬 Paso 2: Verificando notificaciones generadas...\n');

    const shareIds = recentShares.map(s => s.id);

    const { data: notifications, error: notifError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .in('reference_id', shareIds)
      .order('created_at', { ascending: false });

    if (notifError) {
      console.error('❌ Error obteniendo notificaciones:', notifError);
      return;
    }

    if (!notifications || notifications.length === 0) {
      console.log('⚠️  NO se encontraron notificaciones para estos shares');
      console.log('   Esto indica que el trigger no está funcionando\n');

      console.log('🔍 Diagnóstico:');
      console.log('   1. Verifica que el trigger existe:');
      console.log('      SELECT * FROM pg_trigger WHERE tgname LIKE \'%pet_share%\';');
      console.log('   2. Verifica que la función existe:');
      console.log('      SELECT * FROM pg_proc WHERE proname LIKE \'%pet_share%\';\n');
      return;
    }

    console.log(`✅ Encontradas ${notifications.length} notificaciones:\n`);

    const stats = {
      sent: 0,
      pending: 0,
      failed: 0,
      total: notifications.length
    };

    notifications.forEach((notif, index) => {
      const share = recentShares.find(s => s.id === notif.reference_id);
      const statusIcon = {
        sent: '✅',
        pending: '⏳',
        failed: '❌'
      }[notif.status] || '❓';

      stats[notif.status] = (stats[notif.status] || 0) + 1;

      console.log(`   ${index + 1}. ${statusIcon} ${notif.title}`);
      console.log(`      Para: ${share?.shared_user?.display_name || 'Usuario'}`);
      console.log(`      Estado: ${notif.status}`);
      console.log(`      Tipo: ${notif.data?.type || 'N/A'}`);

      if (notif.status === 'failed') {
        console.log(`      Error: ${notif.error_message || 'N/A'}`);
        console.log(`      Reintentos: ${notif.retry_count || 0}`);
      }

      if (notif.sent_at) {
        console.log(`      Enviado: ${new Date(notif.sent_at).toLocaleString()}`);
      }

      console.log(`      Creado: ${new Date(notif.created_at).toLocaleString()}`);
      console.log('');
    });

    // 3. Resumen y diagnóstico
    console.log('📊 Resumen:\n');
    console.log(`   Total de notificaciones: ${stats.total}`);
    console.log(`   ✅ Enviadas:    ${stats.sent}`);
    console.log(`   ⏳ Pendientes:  ${stats.pending}`);
    console.log(`   ❌ Fallidas:    ${stats.failed}\n`);

    // 4. Diagnóstico de problemas
    if (stats.failed > 0) {
      console.log('🔍 Diagnóstico de Fallos:\n');

      const failedNotifs = notifications.filter(n => n.status === 'failed');
      const errorMessages = {};

      failedNotifs.forEach(notif => {
        const error = notif.error_message || 'Unknown error';
        errorMessages[error] = (errorMessages[error] || 0) + 1;
      });

      console.log('   Errores encontrados:');
      Object.entries(errorMessages).forEach(([error, count]) => {
        console.log(`   - ${error}: ${count} veces`);
      });
      console.log('');

      // Verificar tokens FCM
      const failedUserIds = failedNotifs.map(n => n.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, fcm_token')
        .in('id', failedUserIds);

      if (profiles) {
        console.log('   Usuarios con notificaciones fallidas:');
        profiles.forEach(p => {
          console.log(`   - ${p.display_name}: ${p.fcm_token ? '✓ Tiene token FCM' : '✗ NO tiene token FCM'}`);
        });
        console.log('');
      }
    }

    // 5. Recomendaciones
    console.log('💡 Recomendaciones:\n');

    if (stats.failed > 0) {
      console.log('   ⚠️  Hay notificaciones fallidas:');
      console.log('      1. Verifica que los usuarios tengan tokens FCM válidos');
      console.log('      2. Revisa los logs de la función send-scheduled-notifications');
      console.log('      3. Ejecuta manualmente: supabase functions invoke send-scheduled-notifications');
      console.log('');
    }

    if (stats.pending > 0) {
      console.log('   ⏳ Hay notificaciones pendientes:');
      console.log('      1. Se enviarán en la próxima ejecución del cron job');
      console.log('      2. O ejecuta manualmente: supabase functions invoke send-scheduled-notifications');
      console.log('');
    }

    if (stats.sent === stats.total) {
      console.log('   ✅ Todo está funcionando correctamente!');
      console.log('      Las notificaciones se están enviando sin problemas');
      console.log('');
    }

    // 6. Test manual (opcional)
    console.log('🧪 Para probar manualmente:\n');
    console.log('   1. Comparte una mascota desde la app');
    console.log('   2. Ejecuta este script nuevamente');
    console.log('   3. Verifica que aparezca una nueva notificación\n');

  } catch (error) {
    console.error('\n❌ Error en el test:', error.message);
    console.error(error);
  }
}

// Ejecutar test
testPetShareNotifications()
  .then(() => {
    console.log('✅ Test completado\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
