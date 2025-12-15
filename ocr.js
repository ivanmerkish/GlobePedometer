import { storage, functions } from './dbapi.js';

export async function handleScreenshotUpload(event, currentUser) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input so change event fires again if same file selected
    event.target.value = '';

    if (!currentUser) {
        alert("Пожалуйста, войдите в систему.");
        return;
    }

    const btnLabel = event.target.parentElement;
    const originalText = btnLabel.innerHTML; // Contains the input, tricky to restore exactly if we overwrite.
    // Better strategy: change style or overlay.
    // Let's just change opacity to indicate work.
    btnLabel.style.opacity = '0.5';
    btnLabel.style.pointerEvents = 'none';

    try {
        console.log("Uploading screenshot...", file.name);

        // 1. Upload
        const path = await storage.uploadScreenshot(file, currentUser.id);
        console.log("Upload success:", path);

        // 2. Process (OCR)
        const result = await functions.invoke('ocr-process', { imagePath: path });
        
        const steps = result.steps;
        if (steps) {
            alert(`✅ Распознано: ${steps} шагов. Добавлено!`);
        } else {
            alert("⚠️ Не удалось найти количество шагов на изображении.");
        }

        return steps;

    } catch (err) {
        console.error("OCR Error:", err);
        alert("❌ Ошибка обработки: " + err.message);
        return null;
    } finally {
        btnLabel.style.opacity = '1';
        btnLabel.style.pointerEvents = 'auto';
    }
}