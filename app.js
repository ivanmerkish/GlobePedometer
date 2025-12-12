// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://jwekcyygauegqbqpssis.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZWtjeXlnYXVlZ3FicXBzc2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTA4NTUsImV4cCI6MjA4MDg2Njg1NX0.hyJbOihRR7Fd5xEEmmduDk-4fR4VJEPtEHhhj0m2oKM';

const EARTH_CIRCUMFERENCE = 40075000; 
const STEP_LENGTH = 0.75; 
const START_LAT = 0; 
const START_LNG = 37.6; 

const avatarGroups = [
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

const defaultAvatar = avatarGroups[0].icons[0];

// --- ИНИЦИАЛИЗАЦИЯ (ИСПРАВЛЕНО) ---
// Мы используем имя supabaseClient, чтобы не конфликтовать с библиотекой
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentAvatarUrl = defaultAvatar;
let currentUser = null;
let world;
let is3DSupported = false;

try {
  world = Globe()
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
    .htmlAltitude(0)
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

  // Path Settings (Red Line) - Restored
  world.pathsData([])
    .pathColor(() => 'rgba(255, 50, 50, 0.8)')
    .pathDashLength(0.05)
    .pathDashGap(0.01)
    .pathDashAnimateTime(12000)
    .pathStroke(2);

  world.controls().autoRotate = false;
  
  is3DSupported = true;

} catch (err) {
  console.error("WebGL/3D Error:", err);
  const errDiv = document.createElement('div');
  errDiv.style.position = 'absolute'; 
  errDiv.style.bottom = '10px'; 
  errDiv.style.left = '10px'; 
  errDiv.style.color = 'red';
  errDiv.innerText = "3D режим недоступен (WebGL ошибка). Основной функционал работает.";
  document.body.appendChild(errDiv);
}

// --- ЛОГИКА ---

// Use onAuthStateChange for robust auth handling (redirects, persistence)
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        handleLoginSuccess(session.user);
    } else if (event === 'SIGNED_OUT') {
        window.location.reload();
    }
});

async function signIn() {
  console.log("Initiating sign in...");
  // Используем supabaseClient
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) alert(error.message);
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function handleLoginSuccess(user) {
  try {
      currentUser = user;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('ui-layer').style.display = 'block';
      // Use saved nickname if available, else default to metadata
      // (This will be updated later if profile exists with nickname)
      document.getElementById('my-name').innerText = user.user_metadata.full_name || user.email;

      let isNewUser = false;

      let { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
      
      if (!profile) {
         isNewUser = true;
         // Create default profile
         const { error: insertError } = await supabaseClient.from('profiles').insert([{ 
             id: user.id, email: user.email, nickname: user.user_metadata.full_name,
             avatar_url: defaultAvatar, is_approved: false 
         }]);
         
         if (insertError) throw insertError;

         // Re-fetch
         const res = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
         profile = res.data;
      }

      if (profile && profile.is_approved) {
        document.getElementById('stepInput').value = profile.total_steps;
        currentAvatarUrl = profile.avatar_url || defaultAvatar;
        
        // Use saved nickname if available
        if (profile.nickname) {
            document.getElementById('my-name').innerText = profile.nickname;
        }
        
        updateAvatarSelectionUI();
        
        if (isNewUser) {
            openProfileSettings(true);
        }
      } else {
        document.getElementById('stepInput').disabled = true;
        document.getElementById('stepInput').placeholder = "Доступ ограничен";
        document.querySelector('.action-btn').style.display = 'none';
        
        const existingMsg = document.querySelector('.pending-msg');
        if (!existingMsg) {
            const msg = document.createElement('div');
            msg.className = 'pending-msg';
            msg.innerText = '🔒 Ваш аккаунт на проверке. Напишите админу.';
            document.getElementById('ui-layer').appendChild(msg);
        }
      }

      fetchAndDrawEveryone();
      setInterval(fetchAndDrawEveryone, 10000);
      
  } catch (err) {
      console.error("Login Error:", err);
      alert("Ошибка входа: " + err.message);
      document.getElementById('login-screen').style.display = 'flex';
  }
}

// --- MODAL & UI LOGIC ---

// Generate Avatar Grid in Modal
const modalAvContainer = document.getElementById('modal-avatar-selection');
modalAvContainer.innerHTML = ''; // Clear previous if any

avatarGroups.forEach(group => {
    // Header
    const title = document.createElement('div');
    title.style.width = '100%';
    title.style.fontSize = '0.9rem';
    title.style.color = '#94a3b8';
    title.style.marginTop = '10px';
    title.style.marginBottom = '5px';
    title.style.textAlign = 'left';
    title.innerText = group.name;
    modalAvContainer.appendChild(title);
    
    // Icons
    const grid = document.createElement('div');
    grid.style.display = 'flex';
    grid.style.gap = '10px';
    grid.style.flexWrap = 'wrap';
    grid.style.justifyContent = 'flex-start'; // Align left
    
    group.icons.forEach(url => {
       const d = document.createElement('div');
       d.className = 'avatar-opt';
       d.style.backgroundImage = `url('${url}')`;
       d.onclick = () => { currentAvatarUrl = url; updateAvatarSelectionUI(); };
       grid.appendChild(d);
    });
    modalAvContainer.appendChild(grid);
});

function updateAvatarSelectionUI() {
   // Update modal selection state
   document.querySelectorAll('.avatar-opt').forEach(el => {
      el.classList.toggle('selected', el.style.backgroundImage.includes(currentAvatarUrl));
   });
   // Update sidebar preview
   document.getElementById('my-avatar-preview').style.backgroundImage = `url('${currentAvatarUrl}')`;
}

function openProfileSettings(isFirstTime = false) {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'flex';
    
    // Pre-fill data
    if (currentUser) {
        document.getElementById('modal-nickname').value = document.getElementById('my-name').innerText;
    }

    // Configure for "First Time" vs "Settings"
    const closeBtn = document.getElementById('modal-close-btn');
    if (isFirstTime) {
        document.getElementById('modal-title').innerText = "👋 Добро пожаловать!";
        closeBtn.style.display = 'none'; // Force them to save
    } else {
        document.getElementById('modal-title').innerText = "Настройка профиля";
        closeBtn.style.display = 'block';
    }
}

function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

async function saveProfileSettings() {
    const newName = document.getElementById('modal-nickname').value;
    if (!newName) return alert("Введите имя!");
    
    // Update local UI immediately
    document.getElementById('my-name').innerText = newName;
    
    // Save to DB
    if (currentUser) {
        const updates = {
            id: currentUser.id,
            nickname: newName,
            avatar_url: currentAvatarUrl,
            updated_at: new Date()
        };
        
        const { error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);
        if (error) {
            alert('Ошибка сохранения: ' + error.message);
        } else {
            closeProfileModal();
            fetchAndDrawEveryone();
        }
    }
}

async function saveData(silent = false) {
   if (!currentUser) return;
   const steps = parseInt(document.getElementById('stepInput').value) || 0;
   const currentName = document.getElementById('my-name').innerText;

   const updates = {
     id: currentUser.id, email: currentUser.email, nickname: currentName,
     avatar_url: currentAvatarUrl, total_steps: steps, updated_at: new Date()
   };
   const { error } = await supabaseClient.from('profiles').upsert(updates);
   if (error && !silent) alert('Ошибка! ' + error.message);
   if (!silent) fetchAndDrawEveryone();
}

async function fetchAndDrawEveryone() {
  const { data: profiles, error } = await supabaseClient.from('profiles').select('*');
  if (error) return console.error(error);

  const markersData = [];
  const pathsData = [];

  profiles.forEach(p => {
     const distanceMeters = (p.total_steps || 0) * STEP_LENGTH;
     const degreesTraveled = (distanceMeters / EARTH_CIRCUMFERENCE) * 360;
     const currentLng = START_LNG + degreesTraveled;
     
     // Markers
     markersData.push({
        id: p.id, lat: START_LAT, lng: currentLng,
        avatar_url: p.avatar_url || defaultAvatar,
        nickname: p.nickname, km: (distanceMeters/1000).toFixed(0)
     });

     // Paths (Segments)
     const pathPoints = [];
     for(let i = START_LNG; i <= currentLng; i+=5) { 
         pathPoints.push([START_LAT, i]);
     }
     pathPoints.push([START_LAT, currentLng]); // Final precise point
     pathsData.push(pathPoints);
     
     if (currentUser && p.id === currentUser.id && is3DSupported) {
        document.getElementById('kmDisplay').innerText = (distanceMeters/1000).toFixed(1);
        world.pointOfView({ lat: START_LAT, lng: currentLng, altitude: 1.8 }, 2000);
     }
  });
  
  if (is3DSupported) {
      world.htmlElementsData(markersData);
      world.pathsData(pathsData);
  }
}
