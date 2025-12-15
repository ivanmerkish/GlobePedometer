import { defaultAvatar, START_LAT, START_LNG } from './config.js';
import { auth, db, functions } from './dbapi.js';
import { initGlobe, updateGlobeData, centerGlobe } from './globe.js';
import { calculateDistanceKm, calculateLongitude, generatePathPoints } from './utils.js';
import { 
    toggleLoginScreen, updateUserName, updateStats, updateTotalSteps, setInputState, showPendingMessage, 
    buildAvatarGrid, updateAvatarSelectionUI, openProfileSettings, closeProfileModal,
    toggleAdminButton, openAdminPanelUI, closeAdminPanelUI
} from './ui.js';
import { handleScreenshotUpload } from './ocr.js';
import { setLanguage, initI18n } from './lang.js';

let currentUser = null;
let currentAvatarUrl = defaultAvatar;
let dataLoopInterval = null;
let lastDataString = "";

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
    await initI18n(); // Initialize I18n first
    initGlobe(document.getElementById('globeViz'));

    auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleLoginSuccess(session.user);
        } else if (event === 'SIGNED_OUT') {
            window.location.reload();
        }
    });

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
        
        toggleLoginScreen(false);
        updateUserName(user.user_metadata.full_name || user.email);

        let isNewUser = false;
        let profile = null;

        const { data, error } = await db.getProfile(user.id);
        profile = data;

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
            
            const { data: refetched } = await db.getProfile(user.id);
            profile = refetched;
        }

        const onAvatarSelect = (url) => {
            currentAvatarUrl = url;
            updateAvatarSelectionUI(currentAvatarUrl);
        };
        buildAvatarGrid(currentUser, currentAvatarUrl, onAvatarSelect);

        if (profile && profile.is_approved) {
            updateTotalSteps(profile.total_steps || 0);
            setInputState(false);
            
            // Admin Check
            if (profile.role === 'admin') {
                toggleAdminButton(true);
            } else {
                toggleAdminButton(false);
            }
            
            currentAvatarUrl = profile.avatar_url || defaultAvatar; 
            updateAvatarSelectionUI(currentAvatarUrl);

            if (profile.nickname) {
                updateUserName(profile.nickname);
            }

            if (isNewUser) {
                openProfileSettings(currentUser, true);
            }
        } else {
            updateTotalSteps(0);
            setInputState(true);
            showPendingMessage();
            toggleAdminButton(false);
        }

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

    const currentDataString = JSON.stringify(profiles.map(p => ({ s: p.total_steps, a: p.avatar_url, n: p.nickname, app: p.is_approved })));
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
            updateTotalSteps(p.total_steps);
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

window.changeLang = (lang) => setLanguage(lang);

window.signIn = async function() {
    try {
        await auth.signInWithGoogle();
    } catch (err) {
        alert(err.message);
    }
};

window.onTelegramAuth = async function(user) {
    try {
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

window.addSteps = async function() {
    if (!currentUser) return;
    const input = document.getElementById('addStepsInput');
    const amount = parseInt(input.value);

    if (!amount || amount <= 0) {
        alert("Введите положительное число шагов!");
        return;
    }

    const { error } = await db.incrementSteps(amount);
    
    if (error) {
        alert('Ошибка! ' + error.message);
    } else {
        input.value = ''; 
        fetchAndDrawEveryone(); 
    }
};

window.uploadScreenshot = async function(event) {
    const steps = await handleScreenshotUpload(event, currentUser);
    if (steps) {
        fetchAndDrawEveryone();
    }
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

// --- ADMIN ACTIONS ---

window.openAdminPanel = async function() {
    if (!currentUser) return;
    
    // Fetch all users
    const { data: users, error } = await db.getAllProfiles();
    if (error) {
        alert("Ошибка загрузки списка: " + error.message);
        return;
    }

    const onAction = async (action, targetId) => {
        try {
            // Optimistic UI or wait? Let's wait.
            const res = await functions.invoke('admin-actions', { action, targetId });
            if (res.success) {
                alert("Успешно!");
                window.openAdminPanel(); // Refresh list
                fetchAndDrawEveryone(); // Refresh globe status
            }
        } catch (err) {
            alert("Ошибка: " + err.message);
        }
    };

    openAdminPanelUI(users, onAction);
};

window.closeAdminPanel = closeAdminPanelUI;

// UI helpers
window.openProfileSettings = () => openProfileSettings(currentUser, false);
window.closeProfileModal = closeProfileModal;