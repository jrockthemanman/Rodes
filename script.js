// Initialize map
const map = L.map("map").setView([35.9705, -77.9625], 15);

// Real map tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ---- CAR ICON ----
const carIcon = L.icon({
  iconUrl: "car.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

// Start & end points (your addresses)
const startLatLng = L.latLng(35.9698, -77.9704); // 153 Loyd Park Dr
const endLatLng   = L.latLng(35.9784, -77.9649); // 324 Galatia St

// ---- ROUTING (REAL ROADS) ----
const routingControl = L.Routing.control({
  waypoints: [
    startLatLng,
    endLatLng
  ],
  router: L.Routing.osrmv1({
    serviceUrl: "https://router.project-osrm.org/route/v1"
  }),
  lineOptions: {
    styles: [{ color: "green", weight: 6 }]
  },
  addWaypoints: false,
  draggableWaypoints: false,
  fitSelectedRoutes: true,
  show: false
}).addTo(map);

// ---- LOAD TRAFFIC LIGHTS ----
let trafficLights = [];

fetch("data/traffic_lights.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const light = L.circleMarker(latlng, {
          radius: 6,
          color: "red",
          fillColor: "red",
          fillOpacity: 1
        }).addTo(map);

        light.bindPopup(feature.properties.name);
        trafficLights.push(light);
        return light;
      }
    });
  });

// ---- SIMULATE LIGHT CHANGES ----
setInterval(() => {
  trafficLights.forEach(light => {
    const next = light.options.color === "red" ? "green" : "red";
    light.setStyle({ color: next, fillColor: next });
  });
}, 30000);

// ---- ANIMATE CAR ----
let carMarker = L.marker(startLatLng, { icon: carIcon }).addTo(map);

routingControl.on("routesfound", function(e) {
  const route = e.routes[0];
  const coords = route.coordinates;
  let i = 0;

  const moveCar = setInterval(() => {
    if (i >= coords.length) {
      clearInterval(moveCar);
      return;
    }
    carMarker.setLatLng(coords[i]);
    i++;
  }, 150);
});
