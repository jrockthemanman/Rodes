// Initialize map centered on Nashville, NC
const map = L.map('map').setView([35.9746, -77.9656], 14);

// OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Load traffic lights
let trafficLights = [];

fetch('data/traffic_lights.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const marker = L.circleMarker(latlng, {
          radius: 6,
          color: 'red',
          fillColor: 'red',
          fillOpacity: 1
        });

        trafficLights.push(marker);
        return marker;
      }
    }).addTo(map);
  });

// Simulate traffic light changes
setInterval(() => {
  trafficLights.forEach(light => {
    const isRed = light.options.color === 'red';
    const next = isRed ? 'green' : 'red';

    light.setStyle({
      color: next,
      fillColor: next
    });
  });
}, 30000);
