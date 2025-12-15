import { defaultAvatar, START_LAT, START_LNG } from './config.js';
import { auth, db } from './dbapi.js';
import { initGlobe, updateGlobeData, centerGlobe } from './globe.js';
import { calculateDistanceKm, calculateLongitude, generatePathPoints } from './utils.js';
import { 
    toggleLoginScreen, updateUserName, updateStats, setStepInput, showPendingMessage, 
    buildAvatarGrid, updateAvatarSelectionUI, openProfileSettings, closeProfileModal 
} from './ui.js';

let currentUser = null;
let currentAvatarUrl = defaultAvatar;
let dataLoopInterval = null;
let lastDataString = "";

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

    // 3. Check existing session
    checkInitialSession();
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
        toggleLoginScreen(false);
        updateUserName(user.user_metadata.full_name || user.email);

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
                nickname: user.user_metadata.full_name || user.email.split('@')[0],
                avatar_url: user.user_metadata.avatar_url || defaultAvatar,
                is_approved: false
            };
            const { error: insertError } = await db.createProfile(newProfile);
            if (insertError) throw insertError;
            
            // Re-fetch
            const { data: refetched } = await db.getProfile(user.id);
            profile = refetched;
        }

        // Rebuild Avatar Grid with User Context
        // Define callback to handle selection
        const onAvatarSelect = (url) => {
            currentAvatarUrl = url;
            updateAvatarSelectionUI(currentAvatarUrl);
        };
        buildAvatarGrid(currentUser, currentAvatarUrl, onAvatarSelect);

        // Handle Profile State
        if (profile && profile.is_approved) {
            setStepInput(profile.total_steps, false);
            
            currentAvatarUrl = profile.avatar_url || defaultAvatar; 
            // Also need to refresh UI selection based on loaded profile
            updateAvatarSelectionUI(currentAvatarUrl);

            if (profile.nickname) {
                updateUserName(profile.nickname);
            }

            if (isNewUser) {
                openProfileSettings(currentUser, true);
            }
        } else {
            setStepInput(0, true);
            showPendingMessage();
        }

        // Refresh data immediately
        fetchAndDrawEveryone(true);
        if (dataLoopInterval) clearInterval(dataLoopInterval);
        dataLoopInterval = setInterval(() => fetchAndDrawEveryone(false), 30000);

    } catch (err) {
        console.error("Login Handling Error:", err);
        
        if (err.code === '23503' || err.message?.includes('foreign key constraint')) {
            console.warn("Session invalid. Signing out...");
            await auth.signOut();
            window.location.reload();
            return;
        }

        alert("Ошибка входа: Не удалось загрузить профиль. Попробуйте войти снова.");
        toggleLoginScreen(true);
    }
}

async function fetchAndDrawEveryone(centerView = false) {
    const { data: profiles, error } = await db.getAllProfiles();
    if (error) return console.error(error);

    const currentDataString = JSON.stringify(profiles.map(p => ({ s: p.total_steps, a: p.avatar_url, n: p.nickname })));
    if (currentDataString === lastDataString && !centerView) return;
    lastDataString = currentDataString;

    const markersData = [];
    const pathsData = [];
    const ringsData = [];
    let userCurrentLng = START_LNG;

    profiles.forEach(p => {
        const distanceKm = calculateDistanceKm(p.total_steps);
        const currentLng = calculateLongitude(p.total_steps);

        markersData.push({
            id: p.id, 
            lat: START_LAT, 
            lng: currentLng,
            avatar_url: p.avatar_url || defaultAvatar,
            nickname: p.nickname, 
            km: distanceKm,
            isCurrentUser: (currentUser && p.id === currentUser.id)
        });

        if (p.total_steps > 0) {
            const pathPoints = generatePathPoints(currentLng);
            pathsData.push({ points: pathPoints });
        }

        if (currentUser && p.id === currentUser.id) {
            updateStats(distanceKm);
            userCurrentLng = currentLng;
            ringsData.push({ lat: START_LAT, lng: currentLng });
        }
    });

    updateGlobeData(markersData, pathsData, ringsData);
    
    if (centerView && currentUser) {
        centerGlobe(START_LAT, userCurrentLng);
    }
}

// --- GLOBAL ACTIONS ---

window.signIn = async function() {
    try {
        await auth.signInWithGoogle();
    } catch (err) {
        alert(err.message);
    }
};

window.onTelegramAuth = async function(user) {
    try {
        console.log("Telegram auth received:", user);
        const result = await auth.verifyTelegramLogin(user);
        
        if (result.session) {
            await auth.setSession(result.session);
        } else {
            throw new Error("No session returned from server");
        }
        
    } catch (err) {
        alert("Telegram Error: " + err.message);
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

    updateUserName(newName);

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

// Expose UI helpers needed for HTML onClick events
window.openProfileSettings = () => openProfileSettings(currentUser, false);
window.closeProfileModal = closeProfileModal;