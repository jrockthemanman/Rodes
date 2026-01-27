// ================= MAP =================
const map = L.map("map").setView([35.7796, -78.6382], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ================= STATE =================
let startPoint = null;
let endPoint = null;
let clickCount = 0;
let routingControl = null;
let carMarker = null;
let trafficLights = [];

// ================= ICON =================
const carIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// ================= LIGHT MODEL =================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.cycle = 70 + Math.random() * 30;
    this.green = this.cycle * 0.5;
    this.offset = Math.random() * this.cycle;

    this.marker = L.circleMarker([lat, lng], {
      radius: 6,
      fillOpacity: 1
    });
  }

  stateAt(time) {
    return ((time + this.offset) % this.cycle) < this.green
      ? "green"
      : "red";
  }

  delayAt(time) {
    const t = (time + this.offset) % this.cycle;
    return t < this.green ? 0 : this.cycle - t;
  }

  show(state) {
    this.marker.setStyle({
      color: state,
      fillColor: state
    }).addTo(map);
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
  });

// ================= CLICK HANDLER =================
map.on("click", e => {
  clickCount++;

  if (clickCount === 1) {
    reset();
    startPoint = e.latlng;
    L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
  }

  if (clickCount === 2) {
    endPoint = e.latlng;
    L.marker(endPoint).addTo(map).bindPopup("End").openPopup();
    buildRoute();
    clickCount = 0;
  }
});

// ================= ROUTING =================
function buildRoute() {
  routingControl = L.Routing.control({
    waypoints: [startPoint, endPoint],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      alternatives: true
    }),
    showAlternatives: true,
    lineOptions: {
      styles: [
        { color: "blue", weight: 10, opacity: 0.9 },
        { color: "#999", weight: 4, opacity: 0.5 }
      ]
    },
    addWaypoints: false
  }).addTo(map);

  routingControl.on("routesfound", e => {
    const fastest = pickFastestRoute(e.routes);
    routingControl._selectRoute(fastest.index);
    displayRouteEffects(fastest.route);
  });
}

// ================= FASTEST ROUTE LOGIC =================
function pickFastestRoute(routes) {
  let best = { time: Infinity, route: null, index: 0 };

  routes.forEach((route, i) => {
    let time = route.summary.totalTime;
    let now = Date.now() / 1000;

    route.coordinates.forEach(pt => {
      trafficLights.forEach(light => {
        const d =
          Math.hypot(pt.lat - light.lat, pt.lng - light.lng);
        if (d < 0.0004) time += light.delayAt(now);
      });
    });

    if (time < best.time) {
      best = { time, route, index: i };
    }
  });

  return best;
}

// ================= DISPLAY =================
function displayRouteEffects(route) {
  trafficLights.forEach(l => l.hide());

  const now = Date.now() / 1000;
  let totalDelay = 0;

  route.coordinates.forEach(pt => {
    trafficLights.forEach(light => {
      if (Math.hypot(pt.lat - light.lat, pt.lng - light.lng) < 0.0004) {
        const state = light.stateAt(now);
        light.show(state);
        totalDelay += light.delayAt(now);
      }
    });
  });

  const eta = route.summary.totalTime + totalDelay;
  document.getElementById("etaText").innerText =
    `ETA: ${(eta / 60).toFixed(1)} min`;

  if (carMarker) map.removeLayer(carMarker);
  carMarker = L.marker(route.coordinates[0], { icon: carIcon }).addTo(map);
}

// ================= RESET =================
function reset() {
  if (routingControl) map.removeControl(routingControl);
  trafficLights.forEach(l => l.hide());
  if (carMarker) map.removeLayer(carMarker);
}
