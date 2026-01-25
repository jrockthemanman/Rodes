// ---- MAP SETUP ----
const map = L.map("map").setView([35.9705, -77.9625], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ---- ICONS ----
const carIcon = L.icon({
  iconUrl: "car.png",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// ---- STATE ----
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let carMarker = null;
let routingControl = null;
let trafficLights = [];
let currentRoute = null;

// ---- ETA BOX ----
const etaBox = L.control({ position: "topright" });
etaBox.onAdd = () => {
  const div = L.DomUtil.create("div", "eta-box");
  div.innerHTML = "<b>ETA:</b> —";
  return div;
};
etaBox.addTo(map);

// ---- LOAD TRAFFIC LIGHTS ----
fetch("data/traffic_lights.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (_, latlng) => {
        const light = L.circleMarker(latlng, {
          radius: 6,
          color: "red",
          fillColor: "red",
          fillOpacity: 1
        }).addTo(map);

        trafficLights.push(light);
        return light;
      }
    });
  });

// ---- SIMULATE LIGHT CYCLES ----
setInterval(() => {
  trafficLights.forEach(light => {
    const next = light.options.color === "red" ? "green" : "red";
    light.setStyle({ color: next, fillColor: next });
  });
  updateETA();
}, 30000);

// ---- CLICK TO SET ROUTE ----
map.on("click", e => {
  if (!startPoint) {
    startPoint = e.latlng;
    startMarker = L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
  } else if (!endPoint) {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint).addTo(map).bindPopup("Destination").openPopup();
    buildRoutes();
  }
});

// ---- BUILD ROUTES ----
function buildRoutes() {
  if (routingControl) map.removeControl(routingControl);

  routingControl = L.Routing.control({
    waypoints: [startPoint, endPoint],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      alternatives: true
    }),
    lineOptions: {
      styles: [
        { color: "green", weight: 6 },
        { color: "gray", weight: 4, dashArray: "5,5" }
      ]
    },
    showAlternatives: true,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true
  }).addTo(map);

  routingControl.on("routesfound", e => {
    currentRoute = e.routes[0];
    placeCar(currentRoute);
    updateETA();
  });
}

// ---- CAR ANIMATION ----
function placeCar(route) {
  if (carMarker) map.removeLayer(carMarker);

  carMarker = L.marker(route.coordinates[0], { icon: carIcon }).addTo(map);

  let i = 0;
  const move = setInterval(() => {
    if (i >= route.coordinates.length) {
      clearInterval(move);
      return;
    }
    carMarker.setLatLng(route.coordinates[i]);
    i++;
  }, 120);
}

// ---- ETA CALCULATION ----
function updateETA() {
  if (!currentRoute) return;

  let baseSeconds = currentRoute.summary.totalTime;
  let redLights = trafficLights.filter(l => l.options.color === "red").length;
  let delay = redLights * 20;

  let total = baseSeconds + delay;
  let min = Math.floor(total / 60);
  let sec = Math.floor(total % 60);

  document.querySelector(".eta-box").innerHTML =
    `<b>ETA:</b><br>
     Base: ${Math.round(baseSeconds / 60)} min<br>
     Red lights: +${delay}s<br>
     <b>Total: ${min}m ${sec}s</b>`;
}
