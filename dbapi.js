import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_FUNCTION_URL } from './config.js';

// Initialize Supabase client
// Note: 'supabase' global comes from the CDN script tag in index.html
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const auth = {
    // Listen to auth changes
    onAuthStateChange: (callback) => {
        return supabaseClient.auth.onAuthStateChange(callback);
    },

    // Sign in with Google
    signInWithGoogle: async () => {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href }
        });
        if (error) throw error;
    },

    // Verify Telegram Login via Edge Function
    verifyTelegramLogin: async (telegramData) => {
        const response = await fetch(SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                provider: 'telegram',
                data: telegramData
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Telegram verification failed');
        }

        return await response.json();
    },

    // Set session manually (for custom auth)
    setSession: async (session) => {
        const { error } = await supabaseClient.auth.setSession(session);
        if (error) throw error;
    },

    // Sign out
    signOut: async () => {
        await supabaseClient.auth.signOut();
    },

    // Get current session manually
    getSession: async () => {
        return await supabaseClient.auth.getSession();
    }
};

export const db = {
    // Fetch a user profile by ID
    getProfile: async (userId) => {
        return await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    },

    // Create a new profile
    createProfile: async (profileData) => {
        return await supabaseClient.from('profiles').insert([profileData]);
    },

    // Update specific fields of a profile
    updateProfile: async (userId, updates) => {
        return await supabaseClient.from('profiles').update(updates).eq('id', userId);
    },

    // Upsert (Insert or Update) profile
    upsertProfile: async (profileData) => {
        return await supabaseClient.from('profiles').upsert(profileData);
    },

    // Increment steps safely via RPC
    incrementSteps: async (amount) => {
        return await supabaseClient.rpc('increment_steps', { x: amount });
    },

    // Get all profiles for the leaderboard/globe
    getAllProfiles: async () => {
        return await supabaseClient.from('profiles').select('*');
    }
};

export const storage = {
    // Upload image to 'screenshots' bucket
    uploadScreenshot: async (file, userId) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabaseClient.storage
            .from('screenshots')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
            
        if (error) throw error;
        return data.path; // Returns path inside bucket
    }
};

export const functions = {
    // Generic invocation
    invoke: async (functionName, body) => {
        const { SUPABASE_PROJECT_REF, SUPABASE_ANON_KEY } = await import('./config.js');
        const url = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${functionName}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Function ${functionName} failed`);
        }

        return await response.json();
    }
};
