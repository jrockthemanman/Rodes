// ================= MAP SETUP =================
const map = L.map("map", { tap: true }).setView([35.9705, -77.9625], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ================= ICONS =================
const carIcon = L.icon({
  iconUrl: "car.png",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// ================= STATE =================
let clickStage = 0;
let startPoint, endPoint;
let startMarker, endMarker, carMarker;
let routingControl = null;
let routes = [];
let selectedRouteIndex = 0;
let trafficLights = [];

// ================= ETA BOX =================
const etaBox = L.control({ position: "topright" });
etaBox.onAdd = () => {
  const div = L.DomUtil.create("div", "eta-box");
  div.innerHTML = "<b>ETA</b><br>Tap start point";
  return div;
};
etaBox.addTo(map);

// ================= TRAFFIC LIGHT CLASS =================
class TrafficLight {
  constructor(latlng) {
    this.latlng = latlng;
    this.state = "red";
    this.timer = 30;

    this.marker = L.circleMarker(latlng, {
      radius: 6,
      color: "red",
      fillColor: "red",
      fillOpacity: 1
    }).addTo(map);
  }

  tick() {
    this.timer--;
    if (this.timer <= 0) {
      this.state = this.state === "red" ? "green" : "red";
      this.timer = this.state === "red" ? 30 : 25;
      this.marker.setStyle({
        color: this.state,
        fillColor: this.state
      });
    }
  }
}

// ================= LOAD LIGHTS =================
fetch("data/traffic_lights.geojson")
  .then(r => r.json())
  .then(data => {
    data.features.forEach(f => {
      trafficLights.push(new TrafficLight([
        f.geometry.coordinates[1],
        f.geometry.coordinates[0]
      ]));
    });
  });

// ================= LIGHT TIMER =================
setInterval(() => {
  trafficLights.forEach(l => l.tick());
  evaluateRoutes();
}, 1000);

// ================= CLICK HANDLING =================
map.on("click", e => {
  clickStage++;

  if (clickStage === 1) {
    reset();
    startPoint = e.latlng;
    startMarker = L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
    etaBox.getContainer().innerHTML = "<b>ETA</b><br>Tap destination";
  }

  else if (clickStage === 2) {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint).addTo(map).bindPopup("Destination").openPopup();
    buildRoutes();
  }

  else {
    clickStage = 0;
    reset();
    etaBox.getContainer().innerHTML = "<b>ETA</b><br>Tap start point";
  }
});

// ================= ROUTING =================
function buildRoutes() {
  if (routingControl) map.removeControl(routingControl);

  routingControl = L.Routing.control({
    waypoints: [startPoint, endPoint],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      alternatives: true
    }),
    showAlternatives: true,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true
  }).addTo(map);

  routingControl.on("routesfound", e => {
    routes = e.routes;
    selectRoute(0);
    evaluateRoutes();
  });

  routingControl.on("routeselected", e => {
    selectRoute(e.routeIndex);
  });
}

// ================= ROUTE SELECTION =================
function selectRoute(index) {
  selectedRouteIndex = index;
  animateCar(routes[index]);
}

// ================= CAR ANIMATION =================
function animateCar(route) {
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

// ================= ETA + REROUTING =================
function evaluateRoutes() {
  if (!routes.length) return;

  let fastestIndex = 0;
  let fastestTime = Infinity;
  let html = "<b>Routes</b><br>";

  routes.forEach((route, i) => {
    const base = route.summary.totalTime;
    const delay = signalDelay(route);
    const total = base + delay;

    if (total < fastestTime) {
      fastestTime = total;
      fastestIndex = i;
    }

    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);

    html += `${i === selectedRouteIndex ? "🟢" : "⚪"} Route ${i + 1}: ${m}m ${s}s<br>`;
  });

  if (fastestIndex !== selectedRouteIndex) {
    html += "<i>Rerouting…</i><br>";
    selectRoute(fastestIndex);
  }

  etaBox.getContainer().innerHTML = html;
}

// ================= SIGNAL DELAY =================
function signalDelay(route) {
  let delay = 0;

  trafficLights.forEach(light => {
    if (light.state !== "red") return;

    route.coordinates.some((pt, i) => {
      const dLat = pt.lat - light.latlng[0];
      const dLng = pt.lng - light.latlng[1];
      if (Math.sqrt(dLat * dLat + dLng * dLng) < 0.00025) {
        delay += light.timer;
        if (isLeftTurn(route, i)) delay += 10;
        return true;
      }
    });
  });

  return delay;
}

// ================= LEFT TURN CHECK =================
function isLeftTurn(route, i) {
  if (i < 2 || i > route.coordinates.length - 2) return false;

  const a = route.coordinates[i - 1];
  const b = route.coordinates[i];
  const c = route.coordinates[i + 1];

  const cross =
    (b.lat - a.lat) * (c.lng - b.lng) -
    (b.lng - a.lng) * (c.lat - b.lat);

  return cross > 0;
}

// ================= RESET =================
function reset() {
  if (routingControl) map.removeControl(routingControl);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (carMarker) map.removeLayer(carMarker);

  routes = [];
}
