import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { provider, data } = await req.json();

    if (provider === 'telegram') {
      return await handleTelegram(data);
    }

    throw new Error('Unsupported provider');

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

async function handleTelegram(data: any) {
  const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  if (!BOT_TOKEN || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
    throw new Error('Server configuration error: Missing secrets (BOT_TOKEN, SERVICE_ROLE_KEY, or SUPABASE_URL)');
  }

  // 1. Validate Telegram Hash
  const { hash, ...userData } = data;
  
  const dataCheckArr = Object.keys(userData)
    .sort()
    .map((key) => `${key}=${userData[key]}`)
    .join('\n');

  const encoder = new TextEncoder();
  const secretKeyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(BOT_TOKEN));
  const secretKey = await crypto.subtle.importKey("raw", secretKeyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(dataCheckArr));
  const hexHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');

  if (hexHash !== hash) {
    throw new Error('Data is NOT from Telegram (Hash mismatch)');
  }

  // 2. Check outdated
  if (Date.now() / 1000 - userData.auth_date > 86400) {
    throw new Error('Data is outdated');
  }

  // 3. Find or Create User in Supabase Auth
  // We need both Admin client (to create) and regular client (to sign in if exists)
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
  
  const email = `${userData.id}@telegram.bot`; 
  const password = hexHash; // Deterministic password based on TG hash

  let user;
  let session;

  // Try to create new user
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
          full_name: `${userData.first_name} ${userData.last_name || ''}`.trim(),
          avatar_url: userData.photo_url,
          provider: 'telegram'
      }
  });

  if (!createError && createData.user) {
      user = createData.user;
      console.log("User created:", user.id);
  } else {
      console.log("Create failed (likely exists), proceeding to login...", createError?.message);
  }

  // Always sign in to get the session tokens (needed for RLS on frontend)
  const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
  });

  if (loginError) {
      console.log("Login failed (wrong password?), resetting password via Admin...", loginError.message);
      
      // Find the user to get ID
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users.find(u => u.email === email);
      
      if (existingUser) {
          // Force update password to the current deterministic hash
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: password });
          if (updateError) throw updateError;
          
          // Retry login
          const { data: retryData, error: retryError } = await supabaseClient.auth.signInWithPassword({
              email: email,
              password: password
          });
          
          if (retryError || !retryData.session) throw retryError || new Error("Retry login failed");
          
          session = retryData.session;
          user = retryData.user;
      } else {
          // User doesn't exist but create failed earlier? Weird state.
          throw new Error(`User creation failed and login failed: ${loginError.message}`);
      }
  } else {
      session = loginData.session;
      user = loginData.user;
  }

  // 4. Return User Data & Session
  return new Response(
    JSON.stringify({ 
        message: 'Verified', 
        session: session,
        user: user
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
