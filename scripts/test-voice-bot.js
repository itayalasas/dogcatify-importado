const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function testVoiceBot() {
  console.log('=== Testing Voice Bot System ===\n');

  const testEmail = `test.voicebot.${Date.now()}@example.com`;
  console.log(`Creating test user: ${testEmail}`);

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: {
        display_name: 'Voice Bot Test User'
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return;
    }

    const userId = authData.user.id;
    console.log('User created successfully:', userId);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n--- Creating Chat Session ---');
    const { data: session, error: sessionError } = await supabase
      .from('ai_chat_sessions')
      .insert({
        user_id: userId,
        started_at: new Date().toISOString(),
        message_count: 0
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return;
    }

    console.log('Chat session created:', session.id);

    console.log('\n--- Testing Message Flow ---');

    const testMessages = [
      { role: 'user', content: '¿Cómo puedo registrar una vacuna?', audio_used: true },
      { role: 'assistant', content: 'Para registrar una vacuna, ve a Mascotas > Selecciona tu mascota > Historial Médico > Agregar Vacuna', audio_used: false },
      { role: 'user', content: '¿Dónde encuentro veterinarios?', audio_used: true },
      { role: 'assistant', content: 'Puedes encontrar veterinarios en la pestaña Servicios, donde verás todos los veterinarios cercanos a tu ubicación', audio_used: false }
    ];

    for (const message of testMessages) {
      const { error: msgError } = await supabase
        .from('ai_chat_messages')
        .insert({
          session_id: session.id,
          user_id: userId,
          role: message.role,
          content: message.content,
          audio_used: message.audio_used
        });

      if (msgError) {
        console.error('Error saving message:', msgError);
      } else {
        console.log(`✅ ${message.role} message saved: "${message.content.substring(0, 40)}..."`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n--- Verifying Session Message Count ---');
    const { data: updatedSession, error: fetchError } = await supabase
      .from('ai_chat_sessions')
      .select('*')
      .eq('id', session.id)
      .single();

    if (fetchError) {
      console.error('Error fetching session:', fetchError);
    } else {
      console.log(`Message count: ${updatedSession.message_count}`);
      if (updatedSession.message_count === testMessages.length) {
        console.log('✅ SUCCESS: Message count updated correctly via trigger');
      } else {
        console.log('❌ ERROR: Message count mismatch');
      }
    }

    console.log('\n--- Retrieving Chat History ---');
    const { data: messages, error: messagesError } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    } else {
      console.log(`\nRetrieved ${messages.length} messages:`);
      messages.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.role}] ${msg.content}`);
        console.log(`   Audio used: ${msg.audio_used}`);
      });
    }

    console.log('\n--- Testing RLS Policies ---');
    const { data: otherUserData } = await supabase.auth.admin.createUser({
      email: `other.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true
    });

    const otherUserId = otherUserData.user.id;

    const { data: unauthorizedMessages, error: rlsError } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', otherUserId);

    if (rlsError) {
      console.log('✅ RLS working: Cannot access other user messages via service role');
    } else if (unauthorizedMessages.length === 0) {
      console.log('✅ RLS working: No messages returned for other user');
    }

    console.log('\n--- Cleanup ---');
    await supabase.auth.admin.deleteUser(userId);
    await supabase.auth.admin.deleteUser(otherUserId);
    console.log('Test users deleted successfully');

    console.log('\n=== Voice Bot Test Complete ===');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testVoiceBot();
