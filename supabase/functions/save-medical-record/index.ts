import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey"
};
serve(async (req)=>{
  console.log('=== SAVE MEDICAL RECORD FUNCTION START ===');
  console.log('Request method:', req.method);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({
        success: false,
        error: "Server configuration error"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { recordData, token } = await req.json();
    console.log('Save request received:', {
      type: recordData.type,
      petId: recordData.pet_id,
      hasToken: !!token,
      name: recordData.name || recordData.product_name
    });
    if (!recordData.pet_id || !recordData.user_id || !recordData.type) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    if (token) {
      console.log('Verifying token for save operation...');
      const { data: tokenData, error: tokenError } = await supabase.from('medical_history_tokens').select('*').eq('token', token).eq('pet_id', recordData.pet_id).single();
      if (tokenError || !tokenData) {
        console.error('Invalid token for save operation');
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid access token"
        }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      if (now > expiresAt) {
        console.log('Token expired for save operation');
        return new Response(JSON.stringify({
          success: false,
          error: "Token has expired"
        }), {
          status: 410,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      console.log('Token verified for save operation');
    }
    const { data: petData, error: petError } = await supabase.from('pets').select('id, name, owner_id').eq('id', recordData.pet_id).single();
    if (petError || !petData) {
      console.error('Pet not found:', petError);
      return new Response(JSON.stringify({
        success: false,
        error: "Pet not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    const finalRecordData = {
      ...recordData,
      user_id: petData.owner_id
    };
    console.log('Inserting medical record:', {
      type: finalRecordData.type,
      petName: petData.name,
      ownerId: petData.owner_id
    });
    const { data: insertedRecord, error: insertError } = await supabase.from('pet_health').insert([
      finalRecordData
    ]).select().single();
    if (insertError) {
      console.error('Error inserting medical record:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${insertError.message}`
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log('Medical record saved successfully:', insertedRecord.id);

    return new Response(JSON.stringify({
      success: true,
      recordId: insertedRecord.id,
      message: "Medical record saved successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Error in save-medical-record function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});
