// main.ts - Live location tracker with continuous polling
// Deploy on Deno Deploy (or run locally with `deno run --allow-net --allow-env main.ts`).

import { serve } from "https://deno.land/std@0.199.0/http/server.ts";

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Live Location Tracker - Deno Deploy</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { -webkit-font-smoothing:antialiased; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.7; }
      100% { transform: scale(0.95); opacity: 1; }
    }
    .tracking-active { animation: pulse-ring 2s ease-in-out infinite; }
    .modal-overlay { background-color: rgba(0, 0, 0, 0.5); }
  </style>
</head>
<body class="bg-slate-50 min-h-screen p-6">
  <!-- Name Modal -->
  <div id="nameModal" class="fixed inset-0 modal-overlay flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Welcome to Live Tracker</h2>
      <p class="text-gray-600 mb-6">Please enter your name to start tracking your location.</p>
      <input type="text" id="userName" class="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your name" />
      <button id="submitName" class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Continue</button>
    </div>
  </div>

  <div class="max-w-6xl mx-auto">
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-2">
        <svg class="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none"><path d="M12 21s8-4.5 8-11A8 8 0 0 0 4 10c0 6.5 8 11 8 11z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1 class="text-2xl font-bold">Live Location Tracker</h1>
        <div id="trackingIndicator" class="hidden ml-auto flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          <span class="w-2 h-2 bg-green-500 rounded-full tracking-active"></span>
          <span>Tracking Active</span>
        </div>
      </div>
      <p class="text-slate-600">Continuous location tracking with 2-second updates sent to server.</p>
    </div>

    <div class="bg-white rounded-lg shadow p-6 mb-6 border">
      <div class="flex gap-3 items-center mb-4 flex-wrap">
        <button id="startBtn" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium">Start Tracking</button>
        <button id="stopBtn" class="hidden px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium">Stop Tracking</button>
        <div class="flex-1"></div>
        <div class="flex items-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-slate-600">Updates:</span>
            <span id="updateCount" class="font-mono font-bold text-blue-600">0</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-600">Status:</span>
            <span id="status" class="font-medium text-slate-800">Idle</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <label class="flex items-center gap-2">
          <input id="highAccuracy" type="checkbox" checked /> 
          <span class="text-sm">High Accuracy GPS</span>
        </label>
        <label class="flex items-center gap-2">
          <input id="showHistory" type="checkbox" checked /> 
          <span class="text-sm">Show History</span>
        </label>
        <input id="customEndpoint" class="px-3 py-1 border rounded text-sm flex-1 min-w-[200px]" placeholder="Custom endpoint (default: /report)" />
      </div>

      <div id="error" class="hidden bg-red-50 text-red-700 p-3 rounded mb-4 flex items-start gap-2">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        <span id="errorMsg"></span>
      </div>

      <div id="currentLocation" class="hidden mb-4">
        <h3 class="text-sm font-semibold mb-2 text-slate-700">Current Location</h3>
        <div class="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-3">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-blue-700 font-medium mb-1">Latitude</div>
              <div id="lat" class="font-mono text-lg font-bold text-slate-800"></div>
            </div>
            <div>
              <div class="text-blue-700 font-medium mb-1">Longitude</div>
              <div id="lng" class="font-mono text-lg font-bold text-slate-800"></div>
            </div>
            <div>
              <div class="text-blue-700 font-medium mb-1">Accuracy</div>
              <div id="acc" class="font-mono text-lg font-bold text-slate-800"></div>
            </div>
            <div>
              <div class="text-blue-700 font-medium mb-1">Last Update</div>
              <div id="lastUpdate" class="font-mono text-sm text-slate-600"></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 class="text-sm font-semibold mb-2">Live Map (OpenStreetMap)</h3>
            <div id="osm" class="w-full h-64 bg-slate-100 rounded border"></div>
          </div>
          <div>
            <h3 class="text-sm font-semibold mb-2">Live Map (Google Maps)</h3>
            <div id="google" class="w-full h-64 bg-slate-100 rounded border"></div>
          </div>
        </div>
      </div>

      <div id="historySection" class="hidden">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-semibold text-slate-700">Location History (Last 10)</h3>
          <button id="clearHistory" class="text-xs px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded">Clear</button>
        </div>
        <div class="bg-slate-900 text-slate-100 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div id="historyList" class="space-y-2 font-mono text-xs"></div>
        </div>
      </div>

      <div class="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 mt-4">
        <strong>⚡ Battery Warning:</strong> Continuous location tracking with high accuracy can drain battery quickly. Use responsibly.
      </div>
    </div>

    <footer class="text-xs text-slate-500 text-center">
      All location data is sent to <code>/report</code> endpoint. Server logs are visible in Deno Deploy console.
    </footer>
  </div>

<script>
(() => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusEl = document.getElementById('status');
  const updateCountEl = document.getElementById('updateCount');
  const errorEl = document.getElementById('error');
  const errorMsg = document.getElementById('errorMsg');
  const currentLocation = document.getElementById('currentLocation');
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const trackingIndicator = document.getElementById('trackingIndicator');
  const latEl = document.getElementById('lat');
  const lngEl = document.getElementById('lng');
  const accEl = document.getElementById('acc');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const highAccuracy = document.getElementById('highAccuracy');
  const showHistory = document.getElementById('showHistory');
  const customEndpoint = document.getElementById('customEndpoint');
  const clearHistory = document.getElementById('clearHistory');
  const nameModal = document.getElementById('nameModal');
  const userNameInput = document.getElementById('userName');
  const submitNameBtn = document.getElementById('submitName');

  let watchId = null;
  let updateCount = 0;
  let isTracking = false;
  let locationHistory = [];
  let lastLocation = null;
  let sendInterval = null;
  let userId = null;
  let userName = null;

  // Generate unique user ID
  function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Handle name submission
  submitNameBtn.addEventListener('click', () => {
    const name = userNameInput.value.trim();
    if (!name) {
      alert('Please enter your name');
      return;
    }
    userName = name;
    userId = generateUserId();
    nameModal.classList.add('hidden');
    console.log('User registered:', userName, 'ID:', userId);
  });

  // Allow enter key to submit name
  userNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitNameBtn.click();
    }
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    errorEl.classList.add('hidden');
    errorMsg.textContent = '';
  }

  function updateStatus(status) {
    statusEl.textContent = status;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }

  function addToHistory(location) {
    locationHistory.unshift(location);
    if (locationHistory.length > 10) locationHistory = locationHistory.slice(0, 10);
    
    if (showHistory.checked) {
      historySection.classList.remove('hidden');
      renderHistory();
    }
  }

  function renderHistory() {
    historyList.innerHTML = locationHistory.map((loc, idx) => {
      const time = new Date(loc.timestamp).toLocaleTimeString();
      return '<div class="flex justify-between items-center p-2 bg-slate-800 rounded">' +
        '<span class="text-slate-400">#' + (updateCount - idx) + '</span>' +
        '<span>' + loc.latitude.toFixed(6) + ', ' + loc.longitude.toFixed(6) + '</span>' +
        '<span class="text-slate-400">' + Math.round(loc.accuracy) + 'm</span>' +
        '<span class="text-slate-500">' + time + '</span>' +
      '</div>';
    }).join('');
  }

  function renderLocation(location) {
    lastLocation = location;
    currentLocation.classList.remove('hidden');
    
    latEl.textContent = location.latitude.toFixed(6);
    lngEl.textContent = location.longitude.toFixed(6);
    accEl.textContent = Math.round(location.accuracy) + 'm';
    lastUpdateEl.textContent = formatTime(new Date(location.timestamp));

    // Update Google Maps
    const g = document.getElementById('google');
    const q = encodeURIComponent(location.latitude + ',' + location.longitude);
    g.innerHTML = '<iframe width="100%" height="100%" style="border:0;border-radius:8px" loading="lazy" src="https://maps.google.com/maps?q=' + q + '&z=15&output=embed"></iframe>';

    // Update OpenStreetMap
    const osm = document.getElementById('osm');
    const delta = 0.01;
    const minLon = (location.longitude - delta).toFixed(6);
    const minLat = (location.latitude - delta).toFixed(6);
    const maxLon = (location.longitude + delta).toFixed(6);
    const maxLat = (location.latitude + delta).toFixed(6);
    const bbox = encodeURIComponent(minLon + ',' + minLat + ',' + maxLon + ',' + maxLat);
    const marker = encodeURIComponent(location.latitude + ',' + location.longitude);
    osm.innerHTML = '<iframe width="100%" height="100%" style="border:0;border-radius:8px" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + marker + '"></iframe>';
  }

  async function sendLocation(location) {
    const endpoint = customEndpoint.value.trim() || '/report';
    try {
      // Add user ID and name to location data
      const payload = {
        ...location,
        userId: userId,
        userName: userName
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        console.error('Failed to send location:', text);
      } else {
        updateCount++;
        updateCountEl.textContent = updateCount;
        console.log('Location sent successfully:', location);
      }
    } catch (e) {
      console.error('Network error:', e.message);
    }
  }

  function startTracking() {
    if (isTracking) return;
    hideError();

    if (!('geolocation' in navigator)) {
      showError('Geolocation not supported in this browser');
      return;
    }

    isTracking = true;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    trackingIndicator.classList.remove('hidden');
    updateStatus('Starting...');

    const options = {
      enableHighAccuracy: highAccuracy.checked,
      timeout: 10000,
      maximumAge: 0
    };

    // Use watchPosition for continuous monitoring (more efficient than polling)
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateStatus('Tracking');
        const location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: new Date().toISOString()
        };
        
        renderLocation(location);
        addToHistory(location);
      },
      (err) => {
        const errorMap = {
          1: 'Permission denied - Please allow location access',
          2: 'Position unavailable - Cannot determine location',
          3: 'Timeout - Location request took too long'
        };
        showError(errorMap[err.code] || err.message || 'Unknown geolocation error');
        stopTracking();
      },
      options
    );

    // Send location data every 2 seconds
    sendInterval = setInterval(() => {
      if (lastLocation) {
        sendLocation(lastLocation);
      }
    }, 2000);

    console.log('Tracking started - sending updates every 2 seconds');
  }

  function stopTracking() {
    if (!isTracking) return;

    isTracking = false;
    
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (sendInterval !== null) {
      clearInterval(sendInterval);
      sendInterval = null;
    }

    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    trackingIndicator.classList.add('hidden');
    updateStatus('Stopped');
    
    console.log('Tracking stopped - total updates sent:', updateCount);
  }

  // Event listeners
  startBtn.addEventListener('click', startTracking);
  stopBtn.addEventListener('click', stopTracking);
  
  clearHistory.addEventListener('click', () => {
    locationHistory = [];
    historyList.innerHTML = '<div class="text-slate-500 text-center py-4">History cleared</div>';
  });

  showHistory.addEventListener('change', (e) => {
    if (e.target.checked) {
      historySection.classList.remove('hidden');
      renderHistory();
    } else {
      historySection.classList.add('hidden');
    }
  });

  // Stop tracking when page is hidden (battery saving)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isTracking) {
      console.log('Page hidden - tracking continues in background');
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (isTracking) {
      stopTracking();
    }
  });

})();
</script>
</body>
</html>
`;

// Initialize Deno KV for persistent storage
const kv = await Deno.openKv();

// Read viewer.html file
const VIEWER_HTML = await Deno.readTextFile("./viewer.html").catch(() => null);

// Helper function to get all user locations from KV
async function getAllUserLocations() {
  const users = [];
  const entries = kv.list({ prefix: ["users"] });

  for await (const entry of entries) {
    if (entry.value) {
      users.push(entry.value);
    }
  }

  return users;
}

serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // POST endpoint for location reports
  if (req.method === "POST" && pathname === "/report") {
    try {
      const body = await req.json().catch(() => null);
      
      if (!body || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
        return new Response(JSON.stringify({ ok: false, reason: "invalid payload" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      // Log with timestamp for tracking
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Location update from ${body.userName || 'Unknown'} (${body.userId}):`, {
        lat: body.latitude.toFixed(6),
        lng: body.longitude.toFixed(6),
        accuracy: Math.round(body.accuracy) + 'm',
        speed: body.speed ? Math.round(body.speed) + 'm/s' : 'N/A'
      });

      // Store location for this user in Deno KV
      if (body.userId) {
        await kv.set(["users", body.userId], {
          ...body,
          lastUpdate: timestamp
        });
      }

      return new Response(JSON.stringify({ 
        ok: true, 
        received: body,
        timestamp 
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (e) {
      console.error("Report error:", e);
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // GET endpoint for all users' locations
  if (req.method === "GET" && pathname === "/api/latest-location") {
    const users = await getAllUserLocations();

    if (users.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: "No location data available yet" }), {
        status: 404,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*"
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, users }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      },
    });
  }

  // Serve viewer HTML
  if (req.method === "GET" && pathname === "/viewer") {
    if (!VIEWER_HTML) {
      return new Response("Viewer not found", { status: 404 });
    }
    return new Response(VIEWER_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Serve tracker HTML UI
  if (req.method === "GET" && (pathname === "/" || pathname === "")) {
    return new Response(HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Health check
  if (req.method === "GET" && pathname === "/health") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404 });
});