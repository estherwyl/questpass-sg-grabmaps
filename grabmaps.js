// js/grabmaps.js
// GrabMaps API Adapter — stub implementations.
// Replace each function body with real GrabMaps SDK calls when integrating.
// All functions return Promises so call-sites can stay async/await unchanged.

window.GrabMaps = {

  // ─── Config (inject real values at integration time) ────────────────────────
  config: {
    apiKey: null,              // process.env.GRAB_MAPS_API_KEY
    countryCode: 'SG',
    airportLat: 1.3644,        // Changi Airport Terminal 1
    airportLng: 103.9915,
    unlockRadiusDefault: 80,   // metres
  },

  // ─── 1. Place Search ─────────────────────────────────────────────────────────
  // Returns: { placeId, name, lat, lng, address, confidence } | null
  async searchPlace(placeQuery) {
    // TODO: POST https://grab.com/grabmaps/places/search
    // Body: { keyword: placeQuery, countryCode: config.countryCode }
    console.log('[GrabMaps] searchPlace stub →', placeQuery);
    // Simulate network delay
    await _delay(600);
    return { placeId: null, name: placeQuery, lat: null, lng: null, address: null, confidence: null };
  },

  // ─── 2. Route between two coords ─────────────────────────────────────────────
  // origin/destination: { lat, lng }
  // Returns: { durationSeconds, distanceMeters, polyline } | null
  async getRoute(origin, destination) {
    // TODO: POST https://grab.com/grabmaps/directions
    // Body: { origin, destination, mode: 'TRANSIT' }
    console.log('[GrabMaps] getRoute stub →', origin, '→', destination);
    await _delay(800);
    return {
      durationSeconds: null,
      distanceMeters: null,
      polyline: null,
    };
  },

  // ─── 3. Route to Changi Airport ───────────────────────────────────────────────
  // origin: { lat, lng }
  // Returns: { durationSeconds, distanceMeters, arrivalEpoch } | null
  async getRouteToAirport(origin) {
    console.log('[GrabMaps] getRouteToAirport stub →', origin);
    await _delay(700);
    const destination = {
      lat: window.GrabMaps.config.airportLat,
      lng: window.GrabMaps.config.airportLng,
    };
    const result = await window.GrabMaps.getRoute(origin, destination);
    return result
      ? { ...result, arrivalEpoch: Date.now() + (result.durationSeconds || 0) * 1000 }
      : null;
  },

  // ─── 4. Device geolocation (wraps browser API) ───────────────────────────────
  // Returns: { lat, lng, accuracyMeters } | null
  getCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  },

  // ─── 5. Haversine distance (no API call needed) ───────────────────────────────
  // userLocation / stopLocation: { lat, lng }
  // Returns: number (metres)
  calculateDistance(userLocation, stopLocation) {
    if (!userLocation || !stopLocation) return null;
    const R = 6371000;
    const φ1 = (userLocation.lat * Math.PI) / 180;
    const φ2 = (stopLocation.lat * Math.PI) / 180;
    const Δφ = ((stopLocation.lat - userLocation.lat) * Math.PI) / 180;
    const Δλ = ((stopLocation.lng - userLocation.lng) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // ─── 6. Unlock radius check ───────────────────────────────────────────────────
  // Returns: boolean
  isWithinUnlockRadius(distanceMeters, radiusMeters) {
    if (distanceMeters === null) return false;
    return distanceMeters <= radiusMeters;
  },

};

// Internal helper
function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
