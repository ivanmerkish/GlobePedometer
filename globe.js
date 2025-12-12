import { START_LAT, START_LNG } from './config.js';

let world;
let is3DSupported = false;

// Initialize the Globe
export function initGlobe(containerElement) {
    try {
        world = Globe()
            .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
            .showAtmosphere(true)
            .atmosphereColor('lightskyblue')
            (containerElement);

        world.ringsData([{ lat: START_LAT, lng: START_LNG }])
            .ringColor(() => 'white').ringMaxRadius(2).ringPropagationSpeed(2).ringRepeatPeriod(1000);

        // Setup HTML markers rendering logic
        world.htmlElementsData([])
            .htmlLat(d => d.lat)
            .htmlLng(d => d.lng)
            .htmlAltitude(0)
            .htmlElement(d => {
                const el = document.createElement('div');
                el.className = 'globe-marker';
                el.style.backgroundImage = `url('${d.avatar_url}')`;
                
                // Highlight current user
                if (d.isCurrentUser) {
                    el.style.borderColor = '#fbbf24'; 
                    el.style.boxShadow = '0 0 10px #fbbf24'; 
                    el.style.zIndex = 1000;
                }
                
                const tooltip = document.createElement('div');
                tooltip.className = 'marker-tooltip';
                tooltip.innerText = `${d.nickname || 'Anon'} (${d.km} км)`;
                el.appendChild(tooltip);
                return el;
            });

        // Setup Path Settings
        world.pathsData([])
            .pathColor(() => 'rgba(255, 50, 50, 0.8)')
            .pathDashLength(0.05)
            .pathDashGap(0.01)
            .pathDashAnimateTime(12000)
            .pathStroke(2);

        // Disable auto-rotation per request
        world.controls().autoRotate = false;
        world.controls().autoRotateSpeed = 0.5;
        // window.addEventListener('mousedown', () => { world.controls().autoRotate = false; }); // Removed since default is false

        is3DSupported = true;
        console.log("Globe initialized successfully.");

    } catch (err) {
        console.error("WebGL/3D Error:", err);
        is3DSupported = false;
        
        const errDiv = document.createElement('div');
        errDiv.style.position = 'absolute'; 
        errDiv.style.bottom = '10px'; 
        errDiv.style.left = '10px'; 
        errDiv.style.color = 'red';
        errDiv.innerText = "3D режим недоступен (WebGL ошибка). Основной функционал работает.";
        document.body.appendChild(errDiv);
    }
}

// Update markers and paths on the globe
export function updateGlobeData(markersData, pathsData) {
    if (!is3DSupported || !world) return;
    
    world.htmlElementsData(markersData);
    world.pathsData(pathsData);
}

// Center view on specific coordinates
export function centerGlobe(lat, lng, altitude = 1.8) {
    if (!is3DSupported || !world) return;
    
    world.pointOfView({ lat, lng, altitude }, 2000);
}
