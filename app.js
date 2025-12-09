// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://jwekcyygauegqbqpssis.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZWtjeXlnYXVlZ3FicXBzc2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTA4NTUsImV4cCI6MjA4MDg2Njg1NX0.hyJbOihRR7Fd5xEEmmduDk-4fR4VJEPtEHhhj0m2oKM';

const EARTH_CIRCUMFERENCE = 40075000; 
const STEP_LENGTH = 0.75; 
const START_LAT = 0; 
const START_LNG = 37.6; 

const avatarList = [
  'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', 
  'https://cdn-icons-png.flaticon.com/512/4140/4140037.png', 
  'https://cdn-icons-png.flaticon.com/512/4140/4140047.png', 
  'https://cdn-icons-png.flaticon.com/512/3408/3408455.png',
  'https://cdn-icons-png.flaticon.com/512/1999/1999625.png',
  'https://cdn-icons-png.flaticon.com/512/949/949635.png'
];

// --- ИНИЦИАЛИЗАЦИЯ (ИСПРАВЛЕНО) ---
// Мы используем имя supabaseClient, чтобы не конфликтовать с библиотекой
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentAvatarUrl = avatarList[0];
let currentUser = null;

const world = Globe()
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
  .showAtmosphere(true)
  .atmosphereColor('lightskyblue')
  (document.getElementById('globeViz'));

world.ringsData([{lat: START_LAT, lng: START_LNG}])
     .ringColor(() => 'white').ringMaxRadius(2).ringPropagationSpeed(2).ringRepeatPeriod(1000);

world.htmlElementsData([])
  .htmlLat(d => d.lat)
  .htmlLng(d => d.lng)
  .htmlElement(d => {
    const el = document.createElement('div');
    el.className = 'globe-marker';
    el.style.backgroundImage = `url('${d.avatar_url}')`;
    if (currentUser && d.id === currentUser.id) {
       el.style.borderColor = '#fbbf24'; el.style.boxShadow = '0 0 10px #fbbf24'; el.style.zIndex = 1000;
    }
    const tooltip = document.createElement('div');
    tooltip.className = 'marker-tooltip';
    tooltip.innerText = `${d.nickname || 'Anon'} (${d.km} км)`;
    el.appendChild(tooltip);
    return el;
  });

world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.5;
window.addEventListener('mousedown', () => { world.controls().autoRotate = false; });

// --- ЛОГИКА ---

async function checkSession() {
  // Используем supabaseClient вместо supabase
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) handleLoginSuccess(session.user);
}
checkSession();

async function signIn() {
  // Используем supabaseClient
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) alert(error.message);
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.reload();
}

async function handleLoginSuccess(user) {
  currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('ui-layer').style.display = 'block';
  document.getElementById('my-name').innerText = user.user_metadata.full_name || user.email;

  let { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
  
  if (!profile) {
     await supabaseClient.from('profiles').insert([{ 
         id: user.id, email: user.email, nickname: user.user_metadata.full_name,
         avatar_url: avatarList[0], is_approved: false 
     }]);
     const res = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
     profile = res.data;
  }

  if (profile && profile.is_approved) {
    document.getElementById('stepInput').value = profile.total_steps;
    currentAvatarUrl = profile.avatar_url || avatarList[0];
    updateAvatarSelectionUI();
  } else {
    document.getElementById('stepInput').disabled = true;
    document.getElementById('stepInput').placeholder = "Доступ ограничен";
    document.querySelector('.action-btn').style.display = 'none';
    const msg = document.createElement('div');
    msg.className = 'pending-msg';
    msg.innerText = '🔒 Ваш аккаунт на проверке. Напишите админу.';
    document.getElementById('ui-layer').appendChild(msg);
  }

  fetchAndDrawEveryone();
  setInterval(fetchAndDrawEveryone, 10000);
}

const avContainer = document.getElementById('avatar-selection');
avatarList.forEach(url => {
   const d = document.createElement('div');
   d.className = 'avatar-opt';
   d.style.backgroundImage = `url('${url}')`;
   d.onclick = () => { currentAvatarUrl = url; updateAvatarSelectionUI(); };
   avContainer.appendChild(d);
});

function updateAvatarSelectionUI() {
   document.querySelectorAll('.avatar-opt').forEach(el => {
      el.classList.toggle('selected', el.style.backgroundImage.includes(currentAvatarUrl));
   });
   document.getElementById('my-avatar-preview').style.backgroundImage = `url('${currentAvatarUrl}')`;
}

async function saveData(silent = false) {
   if (!currentUser) return;
   const steps = parseInt(document.getElementById('stepInput').value) || 0;
   const updates = {
     id: currentUser.id, email: currentUser.email, nickname: currentUser.user_metadata.full_name,
     avatar_url: currentAvatarUrl, total_steps: steps, updated_at: new Date()
   };
   const { error } = await supabaseClient.from('profiles').upsert(updates);
   if (error && !silent) alert('Ошибка! ' + error.message);
   if (!silent) fetchAndDrawEveryone();
}

async function fetchAndDrawEveryone() {
  const { data: profiles, error } = await supabaseClient.from('profiles').select('*');
  if (error) return console.error(error);

  const markersData = profiles.map(p => {
     const distanceMeters = (p.total_steps || 0) * STEP_LENGTH;
     const degreesTraveled = (distanceMeters / EARTH_CIRCUMFERENCE) * 360;
     const currentLng = START_LNG + degreesTraveled;
     
     if (currentUser && p.id === currentUser.id) {
        document.getElementById('kmDisplay').innerText = (distanceMeters/1000).toFixed(1);
        world.pointOfView({ lat: START_LAT, lng: currentLng, altitude: 1.8 }, 2000);
     }
     return {
        id: p.id, lat: START_LAT, lng: currentLng,
        avatar_url: p.avatar_url || avatarList[0],
        nickname: p.nickname, km: (distanceMeters/1000).toFixed(0)
     };
  });
  world.htmlElementsData(markersData);
}
