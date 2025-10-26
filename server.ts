import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// In-memory storage for location data
const locations = new Map<string, any>();
const lastUpdate = new Map<string, number>();

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyCB6N-qTKl-7sAByqi4_EnukJ8zBKHN4zQ";

// HTML content for the viewer (full-screen Google Maps)
const viewerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Location Viewer - Google Maps</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places"></script>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
    
    #map {
      height: 100vh;
      width: 100vw;
    }
    
    .floating-panel {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      min-width: 300px;
      max-width: 400px;
    }
    
    .user-list {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 300px;
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .status-online { background-color: #10b981; }
    .status-offline { background-color: #ef4444; }
    
    .notification-audio {
      display: none;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .pulse-animation {
      animation: pulse 2s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <!-- Full-screen Google Map -->
  <div id="map"></div>
  
  <!-- Floating Control Panel -->
  <div class="floating-panel">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-800">Live Tracking</h2>
      <div class="flex items-center gap-2">
        <span class="status-indicator status-online"></span>
        <span class="text-sm text-gray-600" id="userCount">0 users</span>
      </div>
    </div>
    
    <div class="space-y-3">
      <div class="flex gap-2">
        <button id="satelliteBtn" class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          Satellite
        </button>
        <button id="trafficBtn" class="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition">
          Traffic
        </button>
        <button id="centerBtn" class="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
          Center
        </button>
      </div>
      
      <div class="text-sm text-gray-600">
        <div>Last Update: <span id="lastUpdate">--</span></div>
        <div>Total Updates: <span id="totalUpdates">0</span></div>
      </div>
    </div>
  </div>
  
  <!-- User List Panel -->
  <div class="user-list">
    <h3 class="text-lg font-bold text-gray-800 mb-3">Active Users</h3>
    <div id="userList" class="space-y-2">
      <div class="text-gray-500 text-sm">No users currently sharing location</div>
    </div>
  </div>
  
  <!-- Notification Sounds -->
  <audio id="newUserSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" type="audio/wav">
  </audio>
  
  <audio id="locationUpdateSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-07a.wav" type="audio/wav">
  </audio>
  
  <audio id="errorSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-08a.wav" type="audio/wav">
  </audio>

  <script>
    let map;
    let userMarkers = {};
    let userColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    let colorIndex = 0;
    let totalUpdates = 0;
    let trafficLayer;
    let isSatelliteView = false;
    let isTrafficEnabled = false;

    // Initialize Google Map
    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 12.9716, lng: 77.5946 }, // Bangalore coordinates
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'all',
            elementType: 'geometry.fill',
            stylers: [{ weight: '2.00' }]
          },
          {
            featureType: 'all',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#9c9c9c' }]
          },
          {
            featureType: 'all',
            elementType: 'labels.text',
            stylers: [{ visibility: 'on' }]
          }
        ]
      });

      // Initialize traffic layer
      trafficLayer = new google.maps.TrafficLayer();
      
      // Set up event listeners
      setupEventListeners();
      
      // Start polling for location updates
      setInterval(fetchLocations, 2000);
      fetchLocations();
    }

    // Setup event listeners
    function setupEventListeners() {
      document.getElementById('satelliteBtn').addEventListener('click', toggleSatellite);
      document.getElementById('trafficBtn').addEventListener('click', toggleTraffic);
      document.getElementById('centerBtn').addEventListener('click', centerOnUsers);
    }

    // Toggle satellite view
    function toggleSatellite() {
      isSatelliteView = !isSatelliteView;
      const btn = document.getElementById('satelliteBtn');
      
      if (isSatelliteView) {
        map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
        btn.textContent = 'Map';
        btn.className = 'flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition';
      } else {
        map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
        btn.textContent = 'Satellite';
        btn.className = 'flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition';
      }
    }

    // Toggle traffic layer
    function toggleTraffic() {
      isTrafficEnabled = !isTrafficEnabled;
      const btn = document.getElementById('trafficBtn');
      
      if (isTrafficEnabled) {
        trafficLayer.setMap(map);
        btn.textContent = 'Hide Traffic';
        btn.className = 'flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition';
      } else {
        trafficLayer.setMap(null);
        btn.textContent = 'Traffic';
        btn.className = 'flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition';
      }
    }

    // Center map on all users
    function centerOnUsers() {
      const markers = Object.values(userMarkers).map(u => u.marker);
      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
      }
    }

    // Play notification sounds
    function playNotificationSound(soundId) {
      try {
        const audio = document.getElementById(soundId);
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log('Could not play sound:', e));
        }
      } catch (error) {
        console.log('Sound error:', error);
      }
    }

    // Create custom marker icon
    function createMarkerIcon(color, isOnline = true) {
      const icon = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 12
      };
      
      if (isOnline) {
        icon.scale = 15;
        icon.fillOpacity = 0.8;
      }
      
      return icon;
    }

    // Update user list
    function updateUserList(users) {
      const userList = document.getElementById('userList');
      const userCount = document.getElementById('userCount');
      
      if (users.length === 0) {
        userList.innerHTML = '<div class="text-gray-500 text-sm">No users currently sharing location</div>';
        userCount.textContent = '0 users';
        return;
      }
      
      userCount.textContent = users.length + ' user' + (users.length > 1 ? 's' : '');
      
      userList.innerHTML = users.map(user => {
        const isOnline = userMarkers[user.userId] ? true : false;
        return \`
          <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <span class="status-indicator \${isOnline ? 'status-online' : 'status-offline'}"></span>
              <div>
                <div class="font-medium text-gray-800">\${user.userName}</div>
                <div class="text-xs text-gray-500">Accuracy: \${Math.round(user.accuracy)}m</div>
              </div>
            </div>
            <div class="text-xs text-gray-500">
              \${new Date(user.timestamp).toLocaleTimeString()}
            </div>
          </div>
        \`;
      }).join('');
    }

    // Update locations on map
    function updateLocations(users) {
      if (!users || users.length === 0) return;

      users.forEach(user => {
        const userId = user.userId;
        const position = { lat: user.latitude, lng: user.longitude };
        const color = getUserColor(userId);
        const isNewUser = !userMarkers[userId];

        // Remove old marker
        if (userMarkers[userId] && userMarkers[userId].marker) {
          userMarkers[userId].marker.setMap(null);
        }

        // Create new marker
        const marker = new google.maps.Marker({
          position: position,
          map: map,
          icon: createMarkerIcon(color, true),
          title: user.userName,
          animation: isNewUser ? google.maps.Animation.BOUNCE : null
        });

        // Create info window
        const infoWindow = new google.maps.InfoWindow({
          content: \`
            <div class="p-2">
              <h3 class="font-bold text-gray-800">\${user.userName}</h3>
              <p class="text-sm text-gray-600">Accuracy: \${Math.round(user.accuracy)}m</p>
              <p class="text-sm text-gray-600">Speed: \${user.speed ? (user.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}</p>
              <p class="text-sm text-gray-600">Last Update: \${new Date(user.timestamp).toLocaleTimeString()}</p>
            </div>
          \`
        });

        // Add click listener
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        // Store marker
        userMarkers[userId] = { marker, infoWindow, data: user };

        // Play notification sound
        if (isNewUser) {
          playNotificationSound('newUserSound');
        } else {
          playNotificationSound('locationUpdateSound');
        }
      });

      // Update user list
      updateUserList(users);
      
      // Update stats
      totalUpdates += users.length;
      document.getElementById('totalUpdates').textContent = totalUpdates;
      document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
    }

    // Get color for user
    function getUserColor(userId) {
      if (!userMarkers[userId]) {
        return userColors[colorIndex++ % userColors.length];
      }
      return userMarkers[userId].color || userColors[0];
    }

    // Fetch locations from server
    async function fetchLocations() {
      try {
        const response = await fetch('/api/latest-location');
        if (response.ok) {
          const data = await response.json();
          if (data && data.ok && data.users) {
            updateLocations(data.users);
          }
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
        playNotificationSound('errorSound');
      }
    }

    // Initialize map when page loads
    window.addEventListener('load', initMap);
  </script>
</body>
</html>`;

// HTML content for the client (full-screen Google Maps with sharing)
const clientHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Location - Google Maps</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places"></script>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
    
    #map {
      height: 100vh;
      width: 100vw;
    }
    
    .floating-panel {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      margin: 0 auto;
    }
    
    .status-panel {
      position: absolute;
      bottom: 20px;
      left: 20px;
      right: 20px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      margin: 0 auto;
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
    
    .notification-audio {
      display: none;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .pulse-animation {
      animation: pulse 2s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <!-- Permission Modal -->
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
            <strong>Note:</strong> If you don't see a browser permission dialog, check your browser's address bar for a location icon.
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

  <!-- Main Content -->
  <div id="mainContent" class="hidden">
    <!-- Full-screen Google Map -->
    <div id="map"></div>
    
    <!-- Floating Control Panel -->
    <div class="floating-panel">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-800">Share Location</h2>
        <div class="flex items-center gap-2">
          <span id="statusIndicator" class="w-3 h-3 bg-gray-500 rounded-full"></span>
          <span id="statusText" class="text-sm text-gray-600">Not Started</span>
        </div>
      </div>
      
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <input type="text" id="userName" placeholder="Enter your name" 
                 class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <button id="startBtn" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition">
            Start Sharing
          </button>
        </div>
        
        <div class="text-sm text-gray-600">
          <p>• Your location will be shared every 2 seconds</p>
          <p>• You can stop sharing anytime</p>
          <p>• Location data is stored temporarily</p>
        </div>
      </div>
    </div>
    
    <!-- Status Panel -->
    <div class="status-panel">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-gray-600 mb-1">Latitude</div>
          <div id="latValue" class="text-lg font-bold text-gray-800">--</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 mb-1">Longitude</div>
          <div id="lngValue" class="text-lg font-bold text-gray-800">--</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 mb-1">Accuracy</div>
          <div id="accValue" class="text-lg font-bold text-gray-800">--</div>
        </div>
        <div>
          <div class="text-sm text-gray-600 mb-1">Updates Sent</div>
          <div id="updateCount" class="text-lg font-bold text-gray-800">0</div>
        </div>
      </div>
      
      <div class="flex gap-4 mt-4">
        <button id="viewerBtn" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
          Open Viewer
        </button>
        <button id="stopBtn" class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition" disabled>
          Stop Sharing
        </button>
      </div>
    </div>
  </div>
  
  <!-- Notification Sounds -->
  <audio id="newUserSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" type="audio/wav">
  </audio>
  
  <audio id="locationUpdateSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-07a.wav" type="audio/wav">
  </audio>
  
  <audio id="testLocationSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-09a.wav" type="audio/wav">
  </audio>
  
  <audio id="errorSound" class="notification-audio" preload="auto">
    <source src="https://www.soundjay.com/misc/sounds/beep-08a.wav" type="audio/wav">
  </audio>

  <script>
    let map;
    let userMarker;
    let isSharing = false;
    let hasPermission = false;
    let watchId = null;
    let updateCount = 0;
    let userId = null;

    // Initialize Google Map
    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 12.9716, lng: 77.5946 }, // Bangalore coordinates
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });
    }

    // Notification sounds
    function playNotificationSound(soundId) {
      try {
        const audio = document.getElementById(soundId);
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log('Could not play sound:', e));
        }
      } catch (error) {
        console.log('Sound error:', error);
      }
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

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Permission granted!', position);
            hasPermission = true;
            hidePermissionModal();
            initMap();
            setTimeout(() => {
              startSharing();
            }, 500);
          },
          (error) => {
            console.error('Permission denied:', error);
            statusDiv.classList.add('hidden');
            btn.disabled = false;
            btn.textContent = 'Grant Location Permission';
            
            let errorMessage = 'Location permission denied. Please allow location access and try again.';
            alert(errorMessage);
            playErrorSound();
            showPermissionModal();
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      } else {
        alert('Geolocation is not supported by this browser');
        statusDiv.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = 'Grant Location Permission';
      }
    }

    // Update status
    function updateStatus(status, isActive) {
      const indicator = document.getElementById('statusIndicator');
      const text = document.getElementById('statusText');
      
      if (isActive) {
        indicator.className = 'w-3 h-3 bg-green-500 rounded-full pulse-animation';
        text.textContent = status;
        text.className = 'text-sm text-green-600';
      } else {
        indicator.className = 'w-3 h-3 bg-gray-500 rounded-full';
        text.textContent = status;
        text.className = 'text-sm text-gray-600';
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

      try {
        const response = await fetch('/api/share-location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(locationData)
        });

        if (response.ok) {
          updateCount++;
          document.getElementById('updateCount').textContent = updateCount;
          updateStatus('Sharing location...', true);
          
          if (updateCount === 1) {
            playNotificationSound('newUserSound');
          } else {
            playNotificationSound('locationUpdateSound');
          }
        } else {
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
      
      if (navigator.geolocation) {
        updateStatus('Requesting location permission...', false);
        
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            sendLocation(position);
            
            // Update marker on map
            updateUserMarker(position);
            
            // Update display
            document.getElementById('latValue').textContent = position.coords.latitude.toFixed(6);
            document.getElementById('lngValue').textContent = position.coords.longitude.toFixed(6);
            document.getElementById('accValue').textContent = Math.round(position.coords.accuracy) + 'm';
          },
          (error) => {
            console.error('Geolocation error:', error);
            updateStatus('Location access denied', false);
            playErrorSound();
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

    // Update user marker on map
    function updateUserMarker(position) {
      const latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      
      if (userMarker) {
        userMarker.setPosition(latLng);
      } else {
        userMarker = new google.maps.Marker({
          position: latLng,
          map: map,
          title: document.getElementById('userName').value,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#3b82f6',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 15
          },
          animation: google.maps.Animation.BOUNCE
        });
        
        // Center map on user location
        map.setCenter(latLng);
      }
    }

    // Stop sharing location
    function stopSharing() {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      
      if (userMarker) {
        userMarker.setMap(null);
        userMarker = null;
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

    // Event listeners
    document.getElementById('requestPermissionBtn').addEventListener('click', requestLocationPermission);
    document.getElementById('startBtn').addEventListener('click', startSharing);
    document.getElementById('stopBtn').addEventListener('click', stopSharing);
    document.getElementById('viewerBtn').addEventListener('click', () => {
      window.open('/', '_blank');
    });

    // Initialize on page load
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
console.log('🚀 Live Location Server with Google Maps starting...');
console.log('📍 Viewer: http://localhost:8000/');
console.log('📱 Client: http://localhost:8000/client');
console.log('🔗 API: http://localhost:8000/api/latest-location');

serve(handler, { port: 8000 });
