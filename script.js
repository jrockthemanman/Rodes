const map = L.map('map').setView([35.970, -77.9625], 15);

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
        const light = L.circleMarker(latlng, {
          radius: 6,
          color: 'red',
          fillColor: 'red',
          fillOpacity: 1
        }).addTo(map);

        trafficLights.push(light);
        light.bindPopup(`${feature.properties.name}`);
        return light;
      }
    });
  });

// Simulate light changes
setInterval(() => {
  trafficLights.forEach(light => {
    const next = light.options.color === 'red' ? 'green' : 'red';
    light.setStyle({ color: next, fillColor: next });
  });
}, 30000);

// Route from Loyd Park Dr → Galatia St through all lights
const start = L.marker([35.9698, -77.9704])
  .addTo(map)
  .bindPopup("Start: 153 Loyd Park Dr");

const end = L.marker([35.9784, -77.9649])
  .addTo(map)
  .bindPopup("End: 324 Galatia St");

const route = L.polyline(
  [
    [35.9698, -77.9704], // Start
    [35.968008, -77.963040], // Light 1
    [35.969124, -77.962632], // Light 2
    [35.969836, -77.962372], // Light 3
    [35.973404, -77.961114], // Light 4
    [35.9784, -77.9649]      // End
  ],
  { color: 'green', weight: 5 }
).addTo(map);

route.bindPopup("Fastest route (light-aware)").openPopup();
// Create an info box
const etaBox = L.control({ position: "topright" });

etaBox.onAdd = function(map) {
  const div = L.DomUtil.create("div", "eta-box");
  div.innerHTML = "<b>Estimated Travel Time:</b><br>3 min 14 sec";
  div.style.background = "white";
  div.style.padding = "8px";
  div.style.borderRadius = "6px";
  div.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";
  return div;
};

etaBox.addTo(map);
