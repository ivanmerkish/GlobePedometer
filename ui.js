import { avatarGroups } from './config.js';

// --- Screen Management ---

export function toggleLoginScreen(show) {
    document.getElementById('login-screen').style.display = show ? 'flex' : 'none';
    document.getElementById('ui-layer').style.display = show ? 'none' : 'block';
}

export function updateUserName(name) {
    document.getElementById('my-name').innerText = name;
}

export function updateStats(km) {
    document.getElementById('kmDisplay').innerText = km;
}

export function setStepInput(totalSteps, isDisabled = false) {
    const input = document.getElementById('stepInput');
    input.value = totalSteps;
    input.disabled = isDisabled;
    if (isDisabled) {
        input.placeholder = "Доступ ограничен";
        document.querySelector('.action-btn').style.display = 'none';
    } else {
        document.querySelector('.action-btn').style.display = 'block';
    }
}

export function showPendingMessage() {
    const existingMsg = document.querySelector('.pending-msg');
    if (!existingMsg) {
        const msg = document.createElement('div');
        msg.className = 'pending-msg';
        msg.innerText = '🔒 Ваш аккаунт на проверке. Напишите админу.';
        document.getElementById('ui-layer').appendChild(msg);
    }
}

// --- Avatar Grid ---

export function buildAvatarGrid(currentUser, currentAvatarUrl, onSelect) {
    const modalAvContainer = document.getElementById('modal-avatar-selection');
    modalAvContainer.innerHTML = ''; 

    // 1. User's SSO Avatar (if available)
    if (currentUser && currentUser.user_metadata && currentUser.user_metadata.avatar_url) {
        const ssoUrl = currentUser.user_metadata.avatar_url;
        
        createAvatarGroupHeader(modalAvContainer, "Ваше фото");
        const grid = createGridContainer(modalAvContainer);
        createAvatarItem(grid, ssoUrl, currentAvatarUrl, onSelect);
    }

    // 2. Standard Groups
    avatarGroups.forEach(group => {
        createAvatarGroupHeader(modalAvContainer, group.name);
        const grid = createGridContainer(modalAvContainer);
        
        group.icons.forEach(url => {
           createAvatarItem(grid, url, currentAvatarUrl, onSelect);
        });
    });
}

function createAvatarGroupHeader(container, text) {
    const title = document.createElement('div');
    title.style.width = '100%';
    title.style.fontSize = '0.9rem';
    title.style.color = '#94a3b8';
    title.style.marginTop = '10px';
    title.style.marginBottom = '5px';
    title.style.textAlign = 'left';
    title.innerText = text;
    container.appendChild(title);
}

function createGridContainer(container) {
    const grid = document.createElement('div');
    grid.style.display = 'flex';
    grid.style.gap = '10px';
    grid.style.flexWrap = 'wrap';
    grid.style.justifyContent = 'flex-start';
    container.appendChild(grid);
    return grid;
}

function createAvatarItem(container, url, currentAvatarUrl, onSelect) {
    const d = document.createElement('div');
    d.className = 'avatar-opt';
    d.style.backgroundImage = `url('${url}')`;
    if (currentAvatarUrl && currentAvatarUrl.includes(url)) {
        d.classList.add('selected');
    }
    d.onclick = () => onSelect(url);
    container.appendChild(d);
}

export function updateAvatarSelectionUI(currentUrl) {
    document.querySelectorAll('.avatar-opt').forEach(el => {
       el.classList.toggle('selected', el.style.backgroundImage.includes(currentUrl));
    });
    const preview = document.getElementById('my-avatar-preview');
    if(preview) preview.style.backgroundImage = `url('${currentUrl}')`;
}

// --- Modals ---

export function openProfileSettings(currentUser, isFirstTime = false) {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'flex';
    
    // Pre-fill existing name from UI
    if (currentUser) {
        const currentName = document.getElementById('my-name').innerText;
        document.getElementById('modal-nickname').value = currentName;
    }

    const closeBtn = document.getElementById('modal-close-btn');
    if (isFirstTime) {
        document.getElementById('modal-title').innerText = "👋 Добро пожаловать!";
        closeBtn.style.display = 'none'; 
    } else {
        document.getElementById('modal-title').innerText = "Настройка профиля";
        closeBtn.style.display = 'block';
    }
}

export function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}