let currentLang = localStorage.getItem('lang') || (navigator.language.startsWith('ru') ? 'ru' : 'en');
let translations = {};

export async function setLanguage(lang) {
    try {
        // Dynamic import using template literal requires module support
        // Note: In some bundlers or strict environments, dynamic imports might need specific handling.
        // But native ES modules in browser support this.
        const module = await import(`./locales/${lang}.js`);
        translations = module.default;
        currentLang = lang;
        localStorage.setItem('lang', lang);
        
        applyTranslations();
    } catch (e) {
        console.error(`Failed to load language: ${lang}`, e);
        // Fallback to english if failed
        if (lang !== 'en') {
            await setLanguage('en');
        }
    }
}

export function t(key, params = {}) {
    let str = translations[key] || key;
    
    // Simple interpolation {n}
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
    }
    return str;
}

export function getLanguage() {
    return currentLang;
}

export async function initI18n() {
    await setLanguage(currentLang);
}

export function applyTranslations() {
    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT' && el.placeholder) {
            el.placeholder = t(key);
        } else {
            el.innerText = t(key);
        }
    });
    
    // Translate elements with data-i18n-title (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
}