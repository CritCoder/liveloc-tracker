# Live Location Tracker

A real-time location sharing application built with Deno.

## Features

- **Real-time location tracking** with automatic updates every 2 seconds
- **Interactive map** with Leaflet showing multiple users
- **Non-skippable permission modal** that requires location access
- **Live stats dashboard** with coordinates, accuracy, speed, and more
- **Activity log** showing location updates
- **Multiple user support** with different colored markers
- **Responsive design** with Tailwind CSS

## Deployment

This application is designed to be deployed on Deno Deploy.

### Deploy to Deno Deploy

1. **Fork this repository** or create a new one with these files
2. **Go to [Deno Deploy](https://dash.deno.com/)**
3. **Click "New Project"**
4. **Connect your GitHub repository**
5. **Set the entry point to**: `server.ts`
6. **Deploy!**

### Local Development

```bash
deno run --allow-net server.ts
```

Then visit:
- **Viewer**: http://localhost:8000/
- **Client**: http://localhost:8000/client

## Usage

1. **Open the Client page** to share your location
2. **Grant location permission** when prompted
3. **Enter your name** and start sharing
4. **Open the Viewer page** to see the live map
5. **Watch your location** appear in real-time!

## API Endpoints

- `GET /` - Viewer dashboard
- `GET /client` - Location sharing page
- `GET /api/latest-location` - Get all current locations
- `POST /api/share-location` - Share location data

## Security

- Location data is stored temporarily in memory
- Automatic cleanup of old locations (5+ minutes)
- CORS enabled for cross-origin requests
- No permanent data storage
