// --- CONFIGURATION ---
export const SUPABASE_URL = 'https://jwekcyygauegqbqpssis.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZWtjeXlnYXVlZ3FicXBzc2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTA4NTUsImV4cCI6MjA4MDg2Njg1NX0.hyJbOihRR7Fd5xEEmmduDk-4fR4VJEPtEHhhj0m2oKM';
// TODO: Replace with your actual project reference ID (from Supabase Dashboard URL)
export const SUPABASE_PROJECT_REF = 'jwekcyygauegqbqpssis'; 
export const SUPABASE_FUNCTION_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/auth-bridge`;

export const EARTH_CIRCUMFERENCE = 40075000; 
export const STEP_LENGTH = 0.75; 
export const START_LAT = 0; 
export const START_LNG = 37.6; 

export const avatarGroups = [
  {
    name: "Люди",
    icons: [
      'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', 
      'https://cdn-icons-png.flaticon.com/512/4140/4140037.png', 
      'https://cdn-icons-png.flaticon.com/512/4140/4140047.png', 
      'https://cdn-icons-png.flaticon.com/512/3408/3408455.png',
      'https://cdn-icons-png.flaticon.com/512/1999/1999625.png'
    ]
  },
  {
    name: "Роботы",
    icons: [
      'https://cdn-icons-png.flaticon.com/512/4712/4712109.png',
      'https://cdn-icons-png.flaticon.com/512/4712/4712027.png',
      'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
      'https://cdn-icons-png.flaticon.com/512/2040/2040946.png',
      'https://cdn-icons-png.flaticon.com/512/4233/4233830.png'
    ]
  },
  {
    name: "Животные",
    icons: [
      'https://cdn-icons-png.flaticon.com/512/616/616408.png',
      'https://cdn-icons-png.flaticon.com/512/1998/1998627.png',
      'https://cdn-icons-png.flaticon.com/512/616/616412.png',
      'https://cdn-icons-png.flaticon.com/512/616/616554.png',
      'https://cdn-icons-png.flaticon.com/512/235/235359.png'
    ]
  }
];

export const defaultAvatar = avatarGroups[0].icons[0];
