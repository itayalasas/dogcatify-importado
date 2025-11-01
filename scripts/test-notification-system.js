#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotificationSystem() {
  console.log('🧪 Testing Scheduled Notifications System\n');

  try {
    // 1. Verificar tabla de notificaciones
    console.log('1️⃣ Checking scheduled_notifications table...');
    const { data: notifications, error: notifError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .limit(5);

    if (notifError) {
      console.error('❌ Error accessing notifications table:', notifError);
      return;
    }

    console.log(`✅ Table accessible. Found ${notifications?.length || 0} notifications\n`);

    // 2. Buscar una reserva de prueba
    console.log('2️⃣ Looking for test booking...');
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('payment_status', 'approved')
      .limit(1);

    if (bookingError) {
      console.error('❌ Error fetching bookings:', bookingError);
      return;
    }

    if (!bookings || bookings.length === 0) {
      console.log('⚠️  No approved bookings found. System ready but no test data.\n');
      console.log('ℹ️  To test: Create a booking and confirm payment.');
      return;
    }

    const booking = bookings[0];
    console.log(`✅ Found booking: ${booking.service_name} for ${booking.customer_name}`);
    console.log(`   Date: ${new Date(booking.date).toLocaleString()}\n`);

    // 3. Buscar notificaciones para esta reserva
    console.log('3️⃣ Checking notifications for this booking...');
    const { data: bookingNotifs, error: bookingNotifsError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('reference_id', booking.id)
      .eq('reference_type', 'booking');

    if (bookingNotifsError) {
      console.error('❌ Error fetching booking notifications:', bookingNotifsError);
      return;
    }

    if (bookingNotifs && bookingNotifs.length > 0) {
      console.log(`✅ Found ${bookingNotifs.length} notification(s):`);
      bookingNotifs.forEach(notif => {
        console.log(`   - Type: ${notif.notification_type}`);
        console.log(`     Status: ${notif.status}`);
        console.log(`     Scheduled: ${new Date(notif.scheduled_for).toLocaleString()}`);
        console.log(`     Title: ${notif.title}`);
        console.log(`     Body: ${notif.body}\n`);
      });
    } else {
      console.log('⚠️  No notifications found for this booking');
      console.log('   This could mean:');
      console.log('   - Booking date is less than 24h away');
      console.log('   - Trigger is not working properly\n');
    }

    // 4. Verificar notificaciones pendientes
    console.log('4️⃣ Checking pending notifications...');
    const { data: pending, error: pendingError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (pendingError) {
      console.error('❌ Error fetching pending notifications:', pendingError);
      return;
    }

    if (pending && pending.length > 0) {
      console.log(`✅ Found ${pending.length} pending notification(s):`);
      pending.forEach(notif => {
        const scheduledDate = new Date(notif.scheduled_for);
        const isReady = scheduledDate <= new Date();
        console.log(`   - ${notif.notification_type} (${isReady ? '🟢 Ready' : '🕐 Scheduled'})`);
        console.log(`     For: ${scheduledDate.toLocaleString()}`);
        console.log(`     Title: ${notif.title}\n`);
      });
    } else {
      console.log('ℹ️  No pending notifications found\n');
    }

    // 5. Buscar órdenes de prueba
    console.log('5️⃣ Checking orders for status change notifications...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return;
    }

    if (orders && orders.length > 0) {
      const order = orders[0];
      console.log(`✅ Found order: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: $${order.total_amount}\n`);

      // Buscar notificaciones de esta orden
      const { data: orderNotifs } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .eq('reference_id', order.id)
        .eq('reference_type', 'order');

      if (orderNotifs && orderNotifs.length > 0) {
        console.log(`   📨 Order has ${orderNotifs.length} notification(s):`);
        orderNotifs.forEach(notif => {
          console.log(`      - ${notif.title} (${notif.status})`);
        });
      } else {
        console.log('   ℹ️  No status change notifications yet');
      }
    }

    console.log('\n✅ System test completed!\n');
    console.log('📋 Summary:');
    console.log(`   - Notifications table: ✅ Working`);
    console.log(`   - Triggers: ${bookingNotifs && bookingNotifs.length > 0 ? '✅' : '⚠️'} ${bookingNotifs && bookingNotifs.length > 0 ? 'Working' : 'Check if bookings are >24h away'}`);
    console.log(`   - Pending notifications: ${pending?.length || 0}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testNotificationSystem();
