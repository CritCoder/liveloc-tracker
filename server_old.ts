import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// In-memory storage for location data
const locations = new Map<string, any>();
const lastUpdate = new Map<string, number>();

// HTML content for the viewer
const viewerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Location Viewer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    #map { height: 600px; width: 100%; border-radius: 0.5rem; }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
    
    .notification-audio {
      display: none;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="bg-blue-600 p-3 rounded-full">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-800">Live Location Viewer</h1>
            <p class="text-gray-600">Real-time tracking dashboard</p>
          </div>
        </div>
        <div id="statusBadge" class="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-full">
          <span class="w-3 h-3 bg-gray-500 rounded-full"></span>
          <span class="font-medium">Waiting...</span>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-600 mb-1">Latitude</div>
        <div id="latValue" class="text-2xl font-bold text-gray-800">--</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-600 mb-1">Longitude</div>
        <div id="lngValue" class="text-2xl font-bold text-gray-800">--</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-600 mb-1">Accuracy</div>
        <div id="accValue" class="text-2xl font-bold text-gray-800">--</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-600 mb-1">Last Update</div>
        <div id="timeValue" class="text-2xl font-bold text-gray-800">--</div>
      </div>
    </div>

    <!-- Main Map -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gray-800">Live Map</h2>
        <button id="centerBtn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
          Center on Location
        </button>
      </div>
      <div id="map"></div>
    </div>

    <!-- Additional Info -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Location Details -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Location Details</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-gray-600">Speed</span>
            <span id="speedValue" class="font-semibold text-gray-800">--</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-gray-600">Altitude</span>
            <span id="altValue" class="font-semibold text-gray-800">--</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-gray-600">Heading</span>
            <span id="headingValue" class="font-semibold text-gray-800">--</span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="text-gray-600">Updates Received</span>
            <span id="updateCount" class="font-semibold text-gray-800">0</span>
          </div>
        </div>
      </div>

      <!-- Activity Log -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Activity Log</h3>
        <div id="activityLog" class="space-y-2 max-h-64 overflow-y-auto">
          <div class="text-gray-500 text-sm">Waiting for location updates...</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-6 text-center text-sm text-gray-600">
      <p>Location data updates automatically every 2 seconds</p>
    </div>
  </div>

  <!-- Notification Sounds -->
  <audio id="newUserSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" type="audio/mpeg">
  </audio>
  
  <audio id="locationUpdateSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-07a.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/beep-07a.mp3" type="audio/mpeg">
  </audio>
  
  <audio id="testLocationSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-09a.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/beep-09a.mp3" type="audio/mpeg">
  </audio>
  
  <audio id="errorSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-08a.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/beep-08a.mp3" type="audio/mpeg">
  </audio>

  <script>
    // Initialize map
    let map = L.map('map').setView([0, 0], 2);
    let updateCount = 0;
    let userMarkers = {}; // userId -> {marker, circle}
    let userColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    let colorIndex = 0;
    let hasSetInitialView = false;

    // Notification sounds
    function playNotificationSound(soundId) {
      try {
        const audio = document.getElementById(soundId);
        if (audio) {
          audio.currentTime = 0; // Reset to beginning
          audio.play().catch(e => {
            console.log('Could not play notification sound:', e);
          });
        }
      } catch (error) {
        console.log('Notification sound error:', error);
      }
    }

    function playNewUserSound() {
      playNotificationSound('newUserSound');
    }

    function playLocationUpdateSound() {
      playNotificationSound('locationUpdateSound');
    }

    function playTestLocationSound() {
      playNotificationSound('testLocationSound');
    }

    function playErrorSound() {
      playNotificationSound('errorSound');
    }

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Get color for user
    function getUserColor(userId) {
      if (!userMarkers[userId]) {
        return userColors[colorIndex++ % userColors.length];
      }
      return userMarkers[userId].color;
    }

    // Create custom marker icon with color and name
    function createMarkerIcon(color, name) {
      return L.divIcon({
        className: 'custom-marker',
        html: '<div class="relative"><div class="absolute w-6 h-6 rounded-full border-4 border-white shadow-lg pulse-dot" style="background-color:' + color + '"></div></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    }

    // Update status badge
    function updateStatus(status, isActive) {
      const badge = document.getElementById('statusBadge');
      if (isActive) {
        badge.className = 'flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full';
        badge.innerHTML = '<span class="w-3 h-3 bg-green-500 rounded-full pulse-dot"></span><span class="font-medium">' + status + '</span>';
      } else {
        badge.className = 'flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-full';
        badge.innerHTML = '<span class="w-3 h-3 bg-gray-500 rounded-full"></span><span class="font-medium">' + status + '</span>';
      }
    }

    // Format time
    function formatTime(date) {
      return date.toLocaleTimeString('en-US', { hour12: false });
    }

    // Add activity log entry
    function addActivity(message) {
      const log = document.getElementById('activityLog');
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = 'text-sm p-2 bg-gray-50 rounded border-l-4 border-blue-500';
      entry.innerHTML = '<span class="text-gray-500">' + time + '</span> - <span class="text-gray-800">' + message + '</span>';

      if (log.firstChild && log.firstChild.classList.contains('text-gray-500')) {
        log.innerHTML = '';
      }

      log.insertBefore(entry, log.firstChild);

      // Keep only last 10 entries
      while (log.children.length > 10) {
        log.removeChild(log.lastChild);
      }
    }

    // Update map with new locations for all users
    function updateLocations(users) {
      if (!users || users.length === 0) return;

      users.forEach(user => {
        const userId = user.userId;
        const latLng = [user.latitude, user.longitude];
        const color = getUserColor(userId);

        // Remove old markers for this user
        if (userMarkers[userId]) {
          if (userMarkers[userId].marker) {
            map.removeLayer(userMarkers[userId].marker);
          }
          if (userMarkers[userId].circle) {
            map.removeLayer(userMarkers[userId].circle);
          }
        }

        // Create marker
        const marker = L.marker(latLng, { icon: createMarkerIcon(color, user.userName) }).addTo(map);
        marker.bindPopup('<b>' + user.userName + '</b><br>Accuracy: ' + Math.round(user.accuracy) + 'm<br>Speed: ' + (user.speed ? (user.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'));

        // Create accuracy circle
        const circle = L.circle(latLng, {
          radius: user.accuracy,
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2
        }).addTo(map);

        // Store markers
        userMarkers[userId] = { marker, circle, color, data: user };

        // Set initial view on first user
        if (!hasSetInitialView) {
          map.setView(latLng, 13);
          hasSetInitialView = true;
        }
      });

      // Update stats for first user (or could show summary)
      if (users.length > 0) {
        const firstUser = users[0];
        document.getElementById('latValue').textContent = firstUser.latitude.toFixed(6);
        document.getElementById('lngValue').textContent = firstUser.longitude.toFixed(6);
        document.getElementById('accValue').textContent = Math.round(firstUser.accuracy) + 'm';
        document.getElementById('timeValue').textContent = formatTime(new Date(firstUser.timestamp));
        document.getElementById('updateCount').textContent = users.length;

        document.getElementById('speedValue').textContent = firstUser.speed ? (firstUser.speed * 3.6).toFixed(1) + ' km/h' : 'N/A';
        document.getElementById('altValue').textContent = firstUser.altitude ? firstUser.altitude.toFixed(1) + 'm' : 'N/A';
        document.getElementById('headingValue').textContent = firstUser.heading ? firstUser.heading.toFixed(0) + '°' : 'N/A';
      }

      // Update status
      updateStatus('Tracking ' + users.length + ' user(s)', true);
      updateCount++;
    }

    // Fetch location from server
    async function fetchLocation() {
      try {
        const response = await fetch('/api/latest-location');

        if (response.ok) {
          const data = await response.json();
          if (data && data.ok && data.users) {
            updateLocations(data.users);

            // Log activity for each new user
            data.users.forEach(user => {
              if (!userMarkers[user.userId] || JSON.stringify(userMarkers[user.userId].data) !== JSON.stringify(user)) {
                addActivity(user.userName + ' location updated - ' + Math.round(user.accuracy) + 'm accuracy');
                
                // Play notification sound for new user or location update
                if (!userMarkers[user.userId]) {
                  playNewUserSound(); // New user joined
                } else {
                  playLocationUpdateSound(); // Existing user location updated
                }
              }
            });
          }
        }
      } catch (error) {
        console.error('Error fetching location:', error);
        updateStatus('Connection Error', false);
        playErrorSound();
      }
    }

    // Center map to show all users
    document.getElementById('centerBtn').addEventListener('click', () => {
      const markers = Object.values(userMarkers).map(u => u.marker);
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
        addActivity('Map centered on all tracked users');
      }
    });

    // Poll for updates every 2 seconds
    setInterval(fetchLocation, 2000);

    // Initial fetch
    fetchLocation();

    // Add initial activity
    addActivity('Viewer started - waiting for location data');
  </script>
</body>
</html>`;

// HTML content for the client (location sharing page)
const clientHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Location</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
    
    .notification-audio {
      display: none;
    }
    
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal-content {
      background: white;
      border-radius: 1rem;
      padding: 2rem;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .hidden {
      display: none !important;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-green-50 to-blue-100 min-h-screen p-6">
  <!-- Permission Modal - Non-skippable -->
  <div id="permissionModal" class="modal-overlay">
    <div class="modal-content">
      <div class="mb-6">
        <div class="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Location Permission Required</h2>
        <p class="text-gray-600 mb-4">This application requires your location to function properly. Please grant location permission to continue.</p>
        <p class="text-sm text-gray-500 mb-4">Your location data is used only for real-time tracking and is not stored permanently.</p>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p class="text-sm text-yellow-800">
            <strong>Note:</strong> If you don't see a browser permission dialog, check your browser's address bar for a location icon, or look for a permission popup that might be blocked.
          </p>
        </div>
      </div>
      
      <div class="space-y-3">
        <button id="requestPermissionBtn" class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
          Grant Location Permission
        </button>
        <div id="permissionStatus" class="text-sm text-gray-500 hidden">
          <div class="flex items-center justify-center gap-2">
            <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Requesting permission...</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content - Hidden until permission granted -->
  <div id="mainContent" class="hidden">
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div class="flex items-center gap-4">
        <div class="bg-green-600 p-3 rounded-full">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-3xl font-bold text-gray-800">Share Your Location</h1>
          <p class="text-gray-600">Real-time location sharing</p>
        </div>
      </div>
    </div>

    <!-- Status Card -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-800">Sharing Status</h2>
        <div id="statusBadge" class="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-full">
          <span class="w-3 h-3 bg-gray-500 rounded-full"></span>
          <span class="font-medium">Not Started</span>
        </div>
      </div>
      
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <input type="text" id="userName" placeholder="Enter your name" 
                 class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
          <button id="startBtn" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition">
            Start Sharing
          </button>
        </div>
        
        <div class="text-sm text-gray-600">
          <p>• Your location will be shared every 2 seconds</p>
          <p>• You can stop sharing anytime</p>
          <p>• Location data is stored temporarily and automatically cleaned up</p>
        </div>
      </div>
    </div>

    <!-- Location Info -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4">Current Location</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-gray-600 mb-1">Latitude</div>
          <div id="latValue" class="text-xl font-bold text-gray-800">--</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 mb-1">Longitude</div>
          <div id="lngValue" class="text-xl font-bold text-gray-800">--</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 mb-1">Accuracy</div>
          <div id="accValue" class="text-xl font-bold text-gray-800">--</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 mb-1">Updates Sent</div>
          <div id="updateCount" class="text-xl font-bold text-gray-800">0</div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <div class="flex gap-4 mb-4">
        <button id="viewerBtn" class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
          Open Viewer
        </button>
        <button id="stopBtn" class="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition" disabled>
          Stop Sharing
        </button>
      </div>
      <div class="flex gap-4">
        <button id="testBtn" class="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition">
          Send Test Location
        </button>
        <button id="checkBtn" class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition">
          Check API
        </button>
      </div>
    </div>
  </div>
  </div> <!-- End mainContent -->

  <!-- Notification Sounds -->
  <audio id="newUserSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" type="audio/mpeg">
  </audio>
  
  <audio id="locationUpdateSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-07a.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/beep-07a.mp3" type="audio/mpeg">
  </audio>
  
  <audio id="testLocationSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-09a.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/beep-09a.mp3" type="audio/mpeg">
  </audio>
  
  <audio id="errorSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-08a.wav" type="audio/wav">
    <source src="https://www.soundjay.com/misc/sounds/beep-08a.mp3" type="audio/mpeg">
  </audio>

  <script>
    let isSharing = false;
    let hasPermission = false;
    let watchId = null;
    let updateCount = 0;
    let userId = null;

    // Notification sounds
    function playNotificationSound(soundId) {
      try {
        const audio = document.getElementById(soundId);
        if (audio) {
          audio.currentTime = 0; // Reset to beginning
          audio.play().catch(e => {
            console.log('Could not play notification sound:', e);
          });
        }
      } catch (error) {
        console.log('Notification sound error:', error);
      }
    }

    function playNewUserSound() {
      playNotificationSound('newUserSound');
    }

    function playLocationUpdateSound() {
      playNotificationSound('locationUpdateSound');
    }

    function playTestLocationSound() {
      playNotificationSound('testLocationSound');
    }

    function playErrorSound() {
      playNotificationSound('errorSound');
    }

    // Permission handling
    function showPermissionModal() {
      document.getElementById('permissionModal').classList.remove('hidden');
      document.getElementById('mainContent').classList.add('hidden');
    }

    function hidePermissionModal() {
      document.getElementById('permissionModal').classList.add('hidden');
      document.getElementById('mainContent').classList.remove('hidden');
    }

    function requestLocationPermission() {
      const statusDiv = document.getElementById('permissionStatus');
      const btn = document.getElementById('requestPermissionBtn');
      
      statusDiv.classList.remove('hidden');
      btn.disabled = true;
      btn.textContent = 'Requesting...';

      console.log('Requesting location permission...');
      console.log('Navigator geolocation available:', !!navigator.geolocation);
      console.log('User agent:', navigator.userAgent);

      if (navigator.geolocation) {
        // Check if we already have permission
        navigator.permissions && navigator.permissions.query({name: 'geolocation'}).then(result => {
          console.log('Current permission state:', result.state);
          if (result.state === 'granted') {
            console.log('Permission already granted!');
            hasPermission = true;
            hidePermissionModal();
            setTimeout(() => {
              startSharing();
            }, 500);
            return;
          }
        }).catch(err => {
          console.log('Permissions API not supported:', err);
        });

        // Try multiple approaches to force the permission dialog
        const requestPermission = () => {
          console.log('Attempting geolocation request...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('Permission granted!', position);
              console.log('Coordinates:', position.coords.latitude, position.coords.longitude);
              hasPermission = true;
              hidePermissionModal();
              // Auto-start sharing
              setTimeout(() => {
                startSharing();
              }, 500);
            },
            (error) => {
              console.error('Permission denied:', error);
              console.error('Error code:', error.code);
              console.error('Error message:', error.message);
              
              statusDiv.classList.add('hidden');
              btn.disabled = false;
              btn.textContent = 'Grant Location Permission';
              
              let errorMessage = 'Permission denied. Please try again.';
              switch(error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Location permission denied. Please click "Allow" when the browser asks for permission, or check your browser settings.';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location information unavailable. Please check your device settings.';
                  break;
                case error.TIMEOUT:
                  errorMessage = 'Location request timed out. Please try again.';
                  break;
              }
              
            alert(errorMessage);
            playErrorSound();
            // Keep showing modal until permission is granted
            showPermissionModal();
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0
            }
          );
        };

        // Try immediate request
        requestPermission();
        
        // Also try with a small delay in case browser needs time
        setTimeout(requestPermission, 100);
        
      } else {
        alert('Geolocation is not supported by this browser');
        statusDiv.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = 'Grant Location Permission';
      }
    }

    // Update status badge
    function updateStatus(status, isActive) {
      const badge = document.getElementById('statusBadge');
      if (isActive) {
        badge.className = 'flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full';
        badge.innerHTML = '<span class="w-3 h-3 bg-green-500 rounded-full pulse-dot"></span><span class="font-medium">' + status + '</span>';
      } else {
        badge.className = 'flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-full';
        badge.innerHTML = '<span class="w-3 h-3 bg-gray-500 rounded-full"></span><span class="font-medium">' + status + '</span>';
      }
    }

    // Send location to server
    async function sendLocation(position) {
      const locationData = {
        userId: userId,
        userName: document.getElementById('userName').value,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        timestamp: new Date().toISOString()
      };

      console.log('Sending location data:', locationData);

      try {
        const response = await fetch('/api/share-location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(locationData)
        });

        console.log('Response status:', response.status);
        const responseData = await response.json();
        console.log('Response data:', responseData);

        if (response.ok) {
          updateCount++;
          document.getElementById('updateCount').textContent = updateCount;
          updateStatus('Sharing location...', true);
          
          // Play notification sound for location update
          if (updateCount === 1) {
            playNewUserSound(); // First location share
          } else {
            playLocationUpdateSound(); // Subsequent updates
          }
        } else {
          console.error('Server error:', responseData);
          updateStatus('Error sharing', false);
          playErrorSound();
        }
      } catch (error) {
        console.error('Error sending location:', error);
        updateStatus('Error sharing', false);
        playErrorSound();
      }
    }

    // Start sharing location
    function startSharing() {
      if (!hasPermission) {
        showPermissionModal();
        return;
      }

      const userName = document.getElementById('userName').value.trim();
      if (!userName) {
        alert('Please enter your name');
        return;
      }

      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      console.log('Starting location sharing for user:', userName, 'ID:', userId);
      
      if (navigator.geolocation) {
        updateStatus('Requesting location permission...', false);
        
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log('Got position:', position);
            console.log('Coordinates:', position.coords.latitude, position.coords.longitude);
            sendLocation(position);
            
            // Update display
            document.getElementById('latValue').textContent = position.coords.latitude.toFixed(6);
            document.getElementById('lngValue').textContent = position.coords.longitude.toFixed(6);
            document.getElementById('accValue').textContent = Math.round(position.coords.accuracy) + 'm';
          },
          (error) => {
            console.error('Geolocation error:', error);
            let errorMessage = 'Location access denied';
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied by user';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable';
                break;
              case error.TIMEOUT:
                errorMessage = 'Location request timed out';
                break;
            }
            updateStatus(errorMessage, false);
            alert(errorMessage);
            stopSharing();
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
        
        isSharing = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('userName').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        updateStatus('Sharing location...', true);
      } else {
        alert('Geolocation is not supported by this browser');
      }
    }

    // Stop sharing location
    function stopSharing() {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      
      isSharing = false;
      document.getElementById('startBtn').disabled = false;
      document.getElementById('userName').disabled = false;
      document.getElementById('stopBtn').disabled = true;
      updateStatus('Stopped sharing', false);
      
      // Clear display
      document.getElementById('latValue').textContent = '--';
      document.getElementById('lngValue').textContent = '--';
      document.getElementById('accValue').textContent = '--';
    }

    // Test functions
    async function sendTestLocation() {
      const testData = {
        userId: 'test_' + Date.now(),
        userName: document.getElementById('userName').value || 'Test User',
        latitude: 12.9716 + (Math.random() - 0.5) * 0.01, // Bangalore coordinates
        longitude: 77.5946 + (Math.random() - 0.5) * 0.01,
        accuracy: 10,
        speed: Math.random() * 5,
        altitude: 100,
        heading: Math.random() * 360,
        timestamp: new Date().toISOString()
      };

      console.log('Sending test location:', testData);

      try {
        const response = await fetch('/api/share-location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData)
        });

        const result = await response.json();
        console.log('Test location response:', result);
        playTestLocationSound();
        alert('Test location sent! Check the viewer.');
      } catch (error) {
        console.error('Error sending test location:', error);
        playErrorSound();
        alert('Error sending test location');
      }
    }

    async function checkAPI() {
      try {
        const response = await fetch('/api/latest-location');
        const data = await response.json();
        console.log('API response:', data);
        alert('API has ' + data.count + ' users. Check console for details.');
      } catch (error) {
        console.error('Error checking API:', error);
        alert('Error checking API');
      }
    }

    // Event listeners
    document.getElementById('requestPermissionBtn').addEventListener('click', requestLocationPermission);
    document.getElementById('startBtn').addEventListener('click', startSharing);
    document.getElementById('stopBtn').addEventListener('click', stopSharing);
    document.getElementById('viewerBtn').addEventListener('click', () => {
      window.open('/', '_blank');
    });
    document.getElementById('testBtn').addEventListener('click', sendTestLocation);
    document.getElementById('checkBtn').addEventListener('click', checkAPI);

    // Allow Enter key to start sharing
    document.getElementById('userName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !isSharing) {
        startSharing();
      }
    });

    // Initialize - Show permission modal on page load
    document.addEventListener('DOMContentLoaded', () => {
      showPermissionModal();
    });
  </script>
</body>
</html>`;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Clean up old location data (older than 5 minutes)
function cleanupOldLocations() {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  for (const [userId, timestamp] of lastUpdate.entries()) {
    if (timestamp < fiveMinutesAgo) {
      locations.delete(userId);
      lastUpdate.delete(userId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupOldLocations, 60000);

// Main server handler
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Serve viewer (main page)
    if (url.pathname === '/' || url.pathname === '/viewer') {
      return new Response(viewerHTML, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Serve client (location sharing page)
    if (url.pathname === '/client' || url.pathname === '/share') {
      return new Response(clientHTML, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // API endpoint to get latest locations
    if (url.pathname === '/api/latest-location') {
      const users = Array.from(locations.values());
      return new Response(JSON.stringify({
        ok: true,
        users: users,
        count: users.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // API endpoint to share location
    if (url.pathname === '/api/share-location' && request.method === 'POST') {
      try {
        const locationData = await request.json();
        
        // Validate required fields
        if (!locationData.userId || !locationData.userName || 
            !locationData.latitude || !locationData.longitude) {
          return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Store location data
        locations.set(locationData.userId, locationData);
        lastUpdate.set(locationData.userId, Date.now());

        return new Response(JSON.stringify({ ok: true, message: 'Location updated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 404 for unknown routes
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Server error:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders
    });
  }
}

// Start the server
console.log('🚀 Live Location Server starting...');
console.log('📍 Viewer: http://localhost:8000/');
console.log('📱 Client: http://localhost:8000/client');
console.log('🔗 API: http://localhost:8000/api/latest-location');

serve(handler, { port: 8000 });
