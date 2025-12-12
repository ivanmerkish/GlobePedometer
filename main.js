import { avatarGroups, defaultAvatar, EARTH_CIRCUMFERENCE, STEP_LENGTH, START_LAT, START_LNG } from './config.js';
import { auth, db } from './dbapi.js';
import { initGlobe, updateGlobeData, centerGlobe } from './globe.js';

let currentUser = null;
let currentAvatarUrl = defaultAvatar;
let dataLoopInterval = null;

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Globe
    initGlobe(document.getElementById('globeViz'));

    // 2. Setup Auth Listener
    auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleLoginSuccess(session.user);
        } else if (event === 'SIGNED_OUT') {
            window.location.reload();
        }
    });

    // 3. Check existing session (fallback if listener doesn't fire immediately)
    checkInitialSession();

    // 4. Build UI (Modal avatars)
    buildAvatarGrid();
});

async function checkInitialSession() {
    const { data: { session } } = await auth.getSession();
    if (session) handleLoginSuccess(session.user);
}

// --- CORE LOGIC ---

async function handleLoginSuccess(user) {
    try {
        currentUser = user;
        
        // UI Updates
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('ui-layer').style.display = 'block';
        document.getElementById('my-name').innerText = user.user_metadata.full_name || user.email;

        let isNewUser = false;
        let profile = null;

        // Fetch Profile
        const { data, error } = await db.getProfile(user.id);
        profile = data;

        // Create Profile if not exists
        if (!profile) {
            isNewUser = true;
            const newProfile = {
                id: user.id,
                email: user.email,
                nickname: user.user_metadata.full_name,
                avatar_url: defaultAvatar,
                is_approved: false
            };
            const { error: insertError } = await db.createProfile(newProfile);
            if (insertError) throw insertError;
            
            // Re-fetch to get any DB-generated fields
            const { data: refetched } = await db.getProfile(user.id);
            profile = refetched;
        }

        // Handle Profile State
        if (profile && profile.is_approved) {
            document.getElementById('stepInput').value = profile.total_steps;
            currentAvatarUrl = profile.avatar_url || defaultAvatar;

            if (profile.nickname) {
                document.getElementById('my-name').innerText = profile.nickname;
            }

            updateAvatarSelectionUI();

            if (isNewUser) {
                openProfileSettings(true);
            }
        } else {
            // Pending Approval State
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

        // Refresh data immediately to highlight user
        fetchAndDrawEveryone(true);
        if (dataLoopInterval) clearInterval(dataLoopInterval);
        dataLoopInterval = setInterval(() => fetchAndDrawEveryone(false), 10000);

    } catch (err) {
        console.error("Login Handling Error:", err);
        alert("Ошибка входа: " + err.message);
        document.getElementById('login-screen').style.display = 'flex';
    }
}

async function fetchAndDrawEveryone(centerView = false) {
    const { data: profiles, error } = await db.getAllProfiles();
    if (error) return console.error(error);

    const markersData = [];
    const pathsData = [];
    let userCurrentLng = START_LNG;

    profiles.forEach(p => {
        const distanceMeters = (p.total_steps || 0) * STEP_LENGTH;
        const degreesTraveled = (distanceMeters / EARTH_CIRCUMFERENCE) * 360;
        const currentLng = START_LNG + degreesTraveled;

        // Prepare Marker
        markersData.push({
            id: p.id, 
            lat: START_LAT, 
            lng: currentLng,
            avatar_url: p.avatar_url || defaultAvatar,
            nickname: p.nickname, 
            km: (distanceMeters / 1000).toFixed(0),
            isCurrentUser: (currentUser && p.id === currentUser.id)
        });

        // Prepare Path
        const pathPoints = [];
        for (let i = START_LNG; i <= currentLng; i += 5) {
            pathPoints.push([START_LAT, i]);
        }
        pathPoints.push([START_LAT, currentLng]);
        pathsData.push(pathPoints);

        // Update User UI
        if (currentUser && p.id === currentUser.id) {
            document.getElementById('kmDisplay').innerText = (distanceMeters / 1000).toFixed(1);
            userCurrentLng = currentLng;
        }
    });

    updateGlobeData(markersData, pathsData);
    
    if (centerView && currentUser) {
        centerGlobe(START_LAT, userCurrentLng);
    }
}

// --- GLOBAL ACTIONS (Attached to Window) ---

window.signIn = async function() {
    console.log("Initiating sign in...");
    try {
        await auth.signInWithGoogle();
    } catch (err) {
        alert(err.message);
    }
};

window.signOut = async function() {
    await auth.signOut();
    window.location.reload();
};

window.saveData = async function(silent = false) {
    if (!currentUser) return;
    const steps = parseInt(document.getElementById('stepInput').value) || 0;
    const currentName = document.getElementById('my-name').innerText;

    const updates = {
        id: currentUser.id,
        email: currentUser.email,
        nickname: currentName,
        avatar_url: currentAvatarUrl,
        total_steps: steps,
        updated_at: new Date()
    };

    const { error } = await db.upsertProfile(updates);
    if (error && !silent) alert('Ошибка! ' + error.message);
    if (!silent) fetchAndDrawEveryone();
};

window.saveProfileSettings = async function() {
    const newName = document.getElementById('modal-nickname').value;
    if (!newName) return alert("Введите имя!");

    document.getElementById('my-name').innerText = newName;

    if (currentUser) {
        const updates = {
            nickname: newName,
            avatar_url: currentAvatarUrl,
            updated_at: new Date()
        };
        const { error } = await db.updateProfile(currentUser.id, updates);
        if (error) {
            alert('Ошибка сохранения: ' + error.message);
        } else {
            closeProfileModal();
            fetchAndDrawEveryone();
        }
    }
};

window.recenterView = function() {
    if (currentUser) {
        fetchAndDrawEveryone(true);
    }
};

// --- UI HELPERS ---

function buildAvatarGrid() {
    const modalAvContainer = document.getElementById('modal-avatar-selection');
    modalAvContainer.innerHTML = ''; 

    avatarGroups.forEach(group => {
        const title = document.createElement('div');
        title.style.width = '100%';
        title.style.fontSize = '0.9rem';
        title.style.color = '#94a3b8';
        title.style.marginTop = '10px';
        title.style.marginBottom = '5px';
        title.style.textAlign = 'left';
        title.innerText = group.name;
        modalAvContainer.appendChild(title);
        
        const grid = document.createElement('div');
        grid.style.display = 'flex';
        grid.style.gap = '10px';
        grid.style.flexWrap = 'wrap';
        grid.style.justifyContent = 'flex-start';
        
        group.icons.forEach(url => {
           const d = document.createElement('div');
           d.className = 'avatar-opt';
           d.style.backgroundImage = `url('${url}')`;
           d.onclick = () => { 
               currentAvatarUrl = url; 
               updateAvatarSelectionUI(); 
           };
           grid.appendChild(d);
        });
        modalAvContainer.appendChild(grid);
    });
}

function updateAvatarSelectionUI() {
    document.querySelectorAll('.avatar-opt').forEach(el => {
       el.classList.toggle('selected', el.style.backgroundImage.includes(currentAvatarUrl));
    });
    const preview = document.getElementById('my-avatar-preview');
    if(preview) preview.style.backgroundImage = `url('${currentAvatarUrl}')`;
}

// UI Modal Exported Functions
window.openProfileSettings = function(isFirstTime = false) {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'flex';
    
    if (currentUser) {
        document.getElementById('modal-nickname').value = document.getElementById('my-name').innerText;
    }

    const closeBtn = document.getElementById('modal-close-btn');
    if (isFirstTime) {
        document.getElementById('modal-title').innerText = "👋 Добро пожаловать!";
        closeBtn.style.display = 'none'; 
    } else {
        document.getElementById('modal-title').innerText = "Настройка профиля";
        closeBtn.style.display = 'block';
    }
};

window.closeProfileModal = function() {
    document.getElementById('profile-modal').style.display = 'none';
};