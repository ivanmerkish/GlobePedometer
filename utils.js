import { START_LAT, START_LNG, STEP_LENGTH, EARTH_CIRCUMFERENCE } from './config.js';

/**
 * Calculates the total distance in kilometers from steps.
 * @param {number} steps 
 * @returns {string} Distance in km formatted to 1 decimal place.
 */
export function calculateDistanceKm(steps) {
    const meters = (steps || 0) * STEP_LENGTH;
    return (meters / 1000).toFixed(1);
}

/**
 * Calculates the current longitude based on total steps.
 * @param {number} steps 
 * @returns {number} The current longitude.
 */
export function calculateLongitude(steps) {
    const meters = (steps || 0) * STEP_LENGTH;
    const degreesTraveled = (meters / EARTH_CIRCUMFERENCE) * 360;
    return START_LNG + degreesTraveled;
}

/**
 * Generates an array of [lat, lng] points for the path.
 * @param {number} currentLng - The calculated end longitude.
 * @returns {Array<Array<number>>} Array of coordinate pairs.
 */
export function generatePathPoints(currentLng) {
    const pathPoints = [[START_LAT, START_LNG]]; 
    
    // Add intermediate points every 5 degrees for smooth globe curvature
    for (let i = START_LNG + 5; i < currentLng; i += 5) {
        pathPoints.push([START_LAT, i]);
    }
    
    // Always add the final user position
    pathPoints.push([START_LAT, currentLng]);
    
    return pathPoints;
}
