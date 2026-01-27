// ================= MAP =================
const map = L.map("map").setView([35.7796, -78.6382], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ================= STATE =================
let startMarker = null;
let endMarker = null;
let routingControl = null;
let carMarker = null;
let clickStep = 0;

const trafficLights = [];
let visibleLights = [];

// ================= ICON =================
const carIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097144.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// ================= TRAFFIC LIGHT =================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.cycle = 70 + Math.random() * 20;
    this.green = this.cycle * 0.55;
    this.offset = Math.random() * this.cycle;

    this.marker = L.circleMarker([lat, lng], {
      radius: 6,
      fillOpacity: 1
    });
  }

  stateAt(t) {
    return ((t + this.offset) % this.cycle) < this.green
      ? "green"
      : "red";
  }

  delayAt(t) {
    const p = (t + this.offset) % this.cycle;
    return p < this.green ? 0 : this.cycle - p;
  }

  show(state) {
    this.marker.setStyle({ color: state, fillColor: state });
    if (!map.hasLayer(this.marker)) this.marker.addTo(map);
  }

  hide() {
    if (map.hasLayer(this.marker)) map.removeLayer(this.marker);
  }
}

// ================= LOAD LIGHTS =================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (_, latlng) => {
        trafficLights.push(new TrafficLight(latlng.lat, latlng.lng));
      }
    });
    console.log("Loaded lights:", trafficLights.length);
  })
  .catch(err => console.error("GeoJSON error:", err));

// ================= RESET =================
function resetAll() {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }

  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (carMarker) map.removeLayer(carMarker);

  visibleLights.forEach(l => l.hide());
  visibleLights = [];

  startMarker = null;
  endMarker = null;
  clickStep = 0;

  document.getElementById("etaValue").innerText =
    "Click start, then destination";
}

// ================= MAP CLICK =================
map.on("click", e => {
  if (clickStep === 0) {
    resetAll();
    startMarker = L.marker(e.latlng).addTo(map).bindPopup("Start").openPopup();
    clickStep = 1;
    return;
  }

  if (clickStep === 1) {
    endMarker = L.marker(e.latlng).addTo(map).bindPopup("End").openPopup();
    clickStep = 2;
    buildRoute(startMarker.getLatLng(), endMarker.getLatLng());
  }
});

// ================= ROUTING =================
function buildRoute(start, end) {
  routingControl = L.Routing.control({
    waypoints: [start, end],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1"
    }),
    addWaypoints: false,
    draggableWaypoints: false,
    show: false,
    lineOptions: {
      styles: [{ color: "blue", weight: 10, opacity: 0.9 }]
    }
  }).addTo(map);

  routingControl.on("routesfound", e => {
    const route = e.routes[0];
    renderRoute(route);
  });

  routingControl.on("routingerror", err => {
    console.error("Routing error:", err);
  });
}

// ================= RENDER =================
function renderRoute(route) {
  visibleLights.forEach(l => l.hide());
  visibleLights = [];

  const now = Date.now() / 1000;
  let delay = 0;

  route.coordinates.forEach(pt => {
    trafficLights.forEach(light => {
      if (distance(pt, light) < 0.0004) {
        const state = light.stateAt(now);
        light.show(state);
        visibleLights.push(light);
        delay += light.delayAt(now);
      }
    });
  });

  const eta = route.summary.totalTime + delay;
  document.getElementById("etaValue").innerText =
    `${(eta / 60).toFixed(1)} minutes`;

  carMarker = L.marker(route.coordinates[0], { icon: carIcon }).addTo(map);
}

// ================= UTIL =================
function distance(pt, light) {
  return Math.hypot(pt.lat - light.lat, pt.lng - light.lng);
}
