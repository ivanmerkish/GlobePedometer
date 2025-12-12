import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

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
  const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET'); // Service role secret usually

  if (!BOT_TOKEN || !JWT_SECRET) {
    throw new Error('Server configuration error: Missing secrets');
  }

  // 1. Validate Telegram Hash
  const { hash, ...userData } = data;
  const dataCheckArr = Object.keys(userData)
    .map((key) => `${key}=${userData[key]}`)
    .sort()
    .join('\n');

  const secretKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(BOT_TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const secretKeyHash = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    new TextEncoder().encode(dataCheckArr)
  );

  const hexHash = Array.from(new Uint8Array(secretKeyHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (hexHash !== hash) {
    throw new Error('Data is NOT from Telegram (Hash mismatch)');
  }

  // 2. Check outdated
  if (Date.now() / 1000 - userData.auth_date > 86400) {
    throw new Error('Data is outdated');
  }

  // 3. Generate Supabase JWT
  // We mint a token that Supabase Auth will accept as a valid user
  // This usually requires creating a user in auth.users first via Admin API
  // OR simply returning a signed token if you use "Third-party auth" logic.
  
  // For simplicity in this bridge, we often need to interact with Supabase Admin API to get a UID for this telegram ID.
  // But to keep this function self-contained for now, let's assume we return the validated data + a custom token.
  
  // Better approach: Use the verified telegram ID to Find-Or-Create a user in Supabase via Admin Client
  // Then issue a token for that User ID.
  
  // Simplified response for now (Client needs to handle the rest or we extend this):
  return new Response(
    JSON.stringify({
        message: 'Verified',
        user: {
            id: `tg_${userData.id}`,
            email: `tg_${userData.id}@telegram.placeholder.com`, // Fake email
            full_name: `${userData.first_name} ${userData.last_name || ''}`.trim(),
            avatar_url: userData.photo_url
        }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
