const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Haversine formula — great-circle distance in km
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
export function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// Cardinal direction label + arrow from a bearing
export function getDirectionLabel(bearing) {
  const directions = [
    { label: '↑ N',   arrow: '↑', min: 337.5, max: 360 },
    { label: '↑ N',   arrow: '↑', min: 0,     max: 22.5 },
    { label: '↗ NE',  arrow: '↗', min: 22.5,  max: 67.5 },
    { label: '→ E',   arrow: '→', min: 67.5,  max: 112.5 },
    { label: '↘ SE',  arrow: '↘', min: 112.5, max: 157.5 },
    { label: '↓ S',   arrow: '↓', min: 157.5, max: 202.5 },
    { label: '↙ SW',  arrow: '↙', min: 202.5, max: 247.5 },
    { label: '← W',   arrow: '←', min: 247.5, max: 292.5 },
    { label: '↖ NW',  arrow: '↖', min: 292.5, max: 337.5 },
  ];
  for (const d of directions) {
    if (bearing >= d.min && bearing < d.max) return d.label;
  }
  return '↑ N';
}

// 0–100 proximity score (100 = exact match, 0 = antipode ~20,000 km away)
export function getProximityPercent(distanceKm) {
  const MAX_DIST = 20_000;
  return Math.max(0, Math.round(100 - (distanceKm / MAX_DIST) * 100));
}

// Emoji square for share text
export function getProximityEmoji(distanceKm, correct) {
  if (correct) return '🟩';
  if (distanceKm < 500)   return '🟨';
  if (distanceKm < 2000)  return '🟧';
  return '🟥';
}

// Simple string hash → positive integer
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Deterministic daily country based on today's UTC date
export function getDailyCountry(countries) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return countries[hashString(today) % countries.length];
}

// Days since 2022-01-01 — used as the puzzle number
export function getPuzzleNumber() {
  const epoch = new Date('2022-01-01T00:00:00Z');
  const now = new Date();
  return Math.floor((now - epoch) / 86_400_000) + 1;
}
