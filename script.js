// ================= MAP =================
const map = L.map("map").setView([35.7796, -78.6382], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ================= ICON =================
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
let selectedRoute = 0;
let trafficLights = [];

// ================= ETA BOX =================
const etaBox = L.control({ position: "topright" });
etaBox.onAdd = () => {
  const div = L.DomUtil.create("div", "eta-box");
  div.innerHTML = "<b>ETA</b><br>Click start point";
  return div;
};
etaBox.addTo(map);

// ================= TRAFFIC LIGHT CLASS =================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.state = "red";
    this.timer = 30;

    this.marker = L.circleMarker([lat, lng], {
      radius: 4,
      color: "red",
      fillColor: "red",
      fillOpacity: 1
    }).addTo(map);
  }

  tick() {
    this.timer--;
    if (this.timer <= 0) {
      this.state = this.state === "red" ? "green" : "red";
      this.timer = this.state === "red" ? 35 : 25;
      this.marker.setStyle({
        color: this.state,
        fillColor: this.state
      });
    }
  }
}

// ================= LOAD RALEIGH LIGHTS =================
fetch("data/raleigh_traffic_lights.geojson")
  .then(res => res.json())
  .then(data => {
    data.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      trafficLights.push(new TrafficLight(lat, lng));
    });
  });

// ================= SIGNAL TIMER =================
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
    etaBox.getContainer().innerHTML = "<b>ETA</b><br>Click destination";
  }

  else if (clickStage === 2) {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint).addTo(map).bindPopup("Destination").openPopup();
    buildRoutes();
  }

  else {
    clickStage = 0;
    reset();
    etaBox.getContainer().innerHTML = "<b>ETA</b><br>Click start point";
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
  selectedRoute = index;
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

// ================= ETA EVALUATION =================
function evaluateRoutes() {
  if (!routes.length) return;

  let html = "<b>Routes</b><br>";
  let bestIndex = 0;
  let bestTime = Infinity;

  routes.forEach((route, i) => {
    const base = route.summary.totalTime;
    const delay = signalDelay(route);
    const total = base + delay;

    if (total < bestTime) {
      bestTime = total;
      bestIndex = i;
    }

    const min = Math.floor(total / 60);
    const sec = Math.floor(total % 60);

    html += `${i === selectedRoute ? "🟢" : "⚪"} Route ${i + 1}: ${min}m ${sec}s<br>`;
  });

  if (bestIndex !== selectedRoute) {
    html += "<i>Rerouting…</i>";
    selectRoute(bestIndex);
  }

  etaBox.getContainer().innerHTML = html;
}

// ================= SIGNAL DELAY =================
function signalDelay(route) {
  let delay = 0;
  const threshold = 0.00025;

  trafficLights.forEach(light => {
    if (light.state !== "red") return;

    route.coordinates.some(pt => {
      const dLat = pt.lat - light.lat;
      const dLng = pt.lng - light.lng;
      if (Math.sqrt(dLat*dLat + dLng*dLng) < threshold) {
        delay += light.timer;
        return true;
      }
    });
  });

  return delay;
}

// ================= RESET =================
function reset() {
  if (routingControl) map.removeControl(routingControl);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (carMarker) map.removeLayer(carMarker);
  routes = [];
}
