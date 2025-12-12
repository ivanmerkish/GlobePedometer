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
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const email = `${userData.id}@telegram.bot`; // Virtual email
  const password = hexHash; // Use the hash as a deterministic password (secure enough as it changes per session, but we mostly use admin access)

  // Try to get user by email (filtering is limited in admin api without fetching list, so let's try create and handle error or list)
  // Easiest is listUsers with filter.
  
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;
  
  let user = users.find(u => u.email === email);

  if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password, // Required
          email_confirm: true,
          user_metadata: {
              full_name: `${userData.first_name} ${userData.last_name || ''}`.trim(),
              avatar_url: userData.photo_url,
              provider: 'telegram'
          }
      });
      if (createError) throw createError;
      user = newUser.user;
  }

  // 4. Return User Data
  return new Response(
    JSON.stringify({ 
        message: 'Verified', 
        user: {
            id: user.id, // Real UUID from Auth
            email: user.email,
            full_name: user.user_metadata.full_name,
            avatar_url: user.user_metadata.avatar_url
        } 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
