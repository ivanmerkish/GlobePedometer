import { avatarGroups } from './config.js';
import { t } from './lang.js';

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

export function updateTotalSteps(total) {
    document.getElementById('totalStepsDisplay').innerText = total;
}

export function setInputState(isDisabled = false) {
    const input = document.getElementById('addStepsInput');
    const btn = document.querySelector('.action-btn'); // Note: This might target the first one (upload), be careful.
    // Better to target the specific add button.
    // The structure in HTML is specific.
    // But since I'm rewriting this, let's fix the selector too if needed.
    // HTML has <button ... onclick="addSteps()"> which is what we want.
    // But multiple .action-btn classes exist.
    // Let's assume the add steps input disabling logic.
    
    input.disabled = isDisabled;
    
    if (isDisabled) {
        input.placeholder = t('msg_access_denied');
        // We probably shouldn't hide the button, just disable interaction?
        // Current logic hides it.
        // Let's stick to hiding if that's the desired behavior for unapproved users.
    } else {
        input.placeholder = t('add_steps_placeholder');
    }
}

export function showPendingMessage() {
    const existingMsg = document.querySelector('.pending-msg');
    if (!existingMsg) {
        const msg = document.createElement('div');
        msg.className = 'pending-msg';
        msg.innerText = t('msg_pending');
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
        
        createAvatarGroupHeader(modalAvContainer, t('section_your_photo'));
        const grid = createGridContainer(modalAvContainer);
        createAvatarItem(grid, ssoUrl, currentAvatarUrl, onSelect);
    }

    // 2. Standard Groups
    avatarGroups.forEach(group => {
        let groupName = group.name;
        if (group.name === 'Люди') groupName = t('group_people');
        if (group.name === 'Роботы') groupName = t('group_robots');
        if (group.name === 'Животные') groupName = t('group_animals');

        createAvatarGroupHeader(modalAvContainer, groupName);
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
    
    if (currentUser) {
        const currentName = document.getElementById('my-name').innerText;
        document.getElementById('modal-nickname').value = currentName;
    }

    const closeBtn = document.getElementById('modal-close-btn');
    if (isFirstTime) {
        document.getElementById('modal-title').innerText = t('modal_welcome_title');
        closeBtn.style.display = 'none'; 
    } else {
        document.getElementById('modal-title').innerText = t('modal_profile_title');
        closeBtn.style.display = 'block';
    }
}

export function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

// --- Admin Panel ---

export function toggleAdminButton(isAdmin) {
    const btn = document.getElementById('admin-btn');
    if (btn) btn.style.display = isAdmin ? 'flex' : 'none';
}

export function openAdminPanelUI(users, onAction) {
    document.getElementById('admin-modal').style.display = 'flex';
    const list = document.getElementById('admin-user-list');
    list.innerHTML = '';

    if (!users || users.length === 0) {
        list.innerHTML = t('admin_no_users');
        return;
    }

    users.forEach(u => {
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #334155;";
        
        const info = document.createElement('div');
        const statusIcon = u.is_approved ? '✅' : '🔒';
        const roleLabel = u.role === 'admin' ? '👑 ' : '';
        info.innerHTML = `${statusIcon} ${roleLabel}<b>${u.nickname || 'Anon'}</b> <br><small>${u.email || 'No Email'}</small>`;
        
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '5px';

        // Approve/Block
        if (!u.is_approved) {
            const btnApprove = document.createElement('button');
            btnApprove.className = 'icon-btn';
            btnApprove.innerText = '✅';
            btnApprove.title = t('btn_approve');
            btnApprove.onclick = () => onAction('approve', u.id);
            actions.appendChild(btnApprove);
        } else {
            const btnBlock = document.createElement('button');
            btnBlock.className = 'icon-btn';
            btnBlock.innerText = '🔒';
            btnBlock.title = t('btn_block');
            btnBlock.onclick = () => onAction('block', u.id);
            actions.appendChild(btnBlock);
        }

        // Delete
        const btnDelete = document.createElement('button');
        btnDelete.className = 'icon-btn';
        btnDelete.innerText = '🗑️';
        btnDelete.style.borderColor = '#ef4444';
        btnDelete.style.color = '#ef4444';
        btnDelete.title = t('btn_delete');
        btnDelete.onclick = () => {
            if (confirm(t('msg_confirm_delete', { name: u.nickname }))) onAction('delete', u.id);
        };
        actions.appendChild(btnDelete);

        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);
    });
}

export function closeAdminPanelUI() {
    document.getElementById('admin-modal').style.display = 'none';
}