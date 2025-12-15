import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { imagePath } = await req.json();
    if (!imagePath) throw new Error('No imagePath provided');

    // Use specific secrets if available, else fallback to system envs
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Server config error: Missing Supabase secrets');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Download Image
    console.log("Downloading image:", imagePath);
    const { data: fileBlob, error: downloadError } = await supabaseAdmin
      .storage
      .from('screenshots')
      .download(imagePath);

    if (downloadError) throw downloadError;

    // 2. Process with AI
    const steps = await analyzeImageWithGemini(fileBlob);
    console.log("AI Result:", steps);

    if (steps > 0) {
        // 3. Update Database
        const userId = imagePath.split('/')[0];
        
        // Fetch current steps
        const { data: profile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('total_steps')
            .eq('id', userId)
            .single();
            
        if (fetchError) throw fetchError;

        // Update
        const newTotal = (profile.total_steps || 0) + steps;
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ 
                total_steps: newTotal,
                updated_at: new Date()
            })
            .eq('id', userId);

        if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, steps }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("OCR Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeImageWithGemini(fileBlob: Blob): Promise<number> {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    // Convert Blob to Base64
    const buffer = await fileBlob.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    if (!GEMINI_API_KEY) {
        console.warn("No GEMINI_API_KEY provided. Returning mock data.");
        return 1337; // Mock
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{
            parts: [
                { text: "Analyze this image. Find the main 'total steps' count (daily steps) displayed on the screen. It is usually a large number. Return ONLY the number as an integer. If unsure or no steps found, return 0." },
                {
                    inline_data: {
                        mime_type: "image/jpeg", // Assuming jpeg/png, Gemini handles most
                        data: base64Data
                    }
                }
            ]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${errText}`);
    }

    const result = await response.json();
    // Parse result
    try {
        const text = result.candidates[0].content.parts[0].text;
        // Extract number (remove commas, spaces)
        const numberMatch = text.replace(/,/g, '').match(/\d+/);
        if (numberMatch) {
            return parseInt(numberMatch[0], 10);
        }
    } catch (e) {
        console.error("Failed to parse Gemini response:", e);
    }

    return 0;
}
