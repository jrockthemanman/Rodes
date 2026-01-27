// ===================== MAP =====================
const map = L.map("map").setView([35.7796, -78.6382], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ===================== STATE =====================
let clickStage = 0;
let startPoint, endPoint;
let startMarker, endMarker;
let routingControl = null;
let routes = [];
let allTrafficLights = [];
let visibleLights = [];
let routeLayers = [];

// ===================== TIME BASE =====================
const SIM_START = Date.now() / 1000;

// ===================== TRAFFIC LIGHT =====================
class TrafficLight {
  constructor(lat, lng, corridorOffset) {
    this.lat = lat;
    this.lng = lng;

    // realistic fictitious signal
    this.cycle = rand(65, 90);        // total cycle
    this.green = this.cycle * rand(40, 55) / 100;
    this.red = this.cycle - this.green;
    this.offset = corridorOffset;    // green wave

    this.marker = L.circleMarker([lat, lng], {
      radius: 6,
      color: "red",
      fillColor: "red",
      fillOpacity: 1
    });
  }

  stateAt(time) {
    const t = (time + this.offset) % this.cycle;
    return t < this.green ? "green" : "red";
  }

  delayAt(time) {
    const t = (time + this.offset) % this.cycle;
    if (t < this.green) return 0;
    return this.cycle - t; // remaining red
  }

  show(state) {
    this.marker.setStyle({
      color: state,
      fillColor: state
    });
    if (!map.hasLayer(this.marker)) {
      this.marker.addTo(map);
    }
  }

  hide() {
    if (map.hasLayer(this.marker)) {
      map.removeLayer(this.marker);
    }
  }
}

// ===================== HELPERS =====================
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===================== LOAD LIGHTS =====================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (_, latlng) => {
        // offset creates corridor green waves
        const offset = rand(0, 30);
        allTrafficLights.push(new TrafficLight(latlng.lat, latlng.lng, offset));
      }
    });
    console.log("Loaded lights:", allTrafficLights.length);
  });

// ===================== CLICK HANDLING =====================
map.on("click", e => {
  clickStage++;

  if (clickStage === 1) {
    resetAll();
    startPoint = e.latlng;
    startMarker = L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
  } else if (clickStage === 2) {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint).addTo(map).bindPopup("Destination").openPopup();
    buildRoutes();
  } else {
    clickStage = 0;
    resetAll();
  }
});

// ===================== ROUTING =====================
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
    fitSelectedRoutes: true,
    lineOptions: {
      styles: [
        { color: "#1e90ff", weight: 10, opacity: 0.9 }, // BLUE primary
        { color: "#888", weight: 4, opacity: 0.6 }
      ]
    }
  }).addTo(map);

  routingControl.on("routesfound", e => {
    routes = e.routes;
    selectFastestRoute();
  });
}

// ===================== ROUTE SCORING =====================
function selectFastestRoute() {
  let bestIndex = 0;
  let bestTime = Infinity;

  routes.forEach((route, i) => {
    const score = scoreRoute(route);
    if (score < bestTime) {
      bestTime = score;
      bestIndex = i;
    }
  });

  routingControl._selectRoute(bestIndex);
  updateVisibleLights(routes[bestIndex]);
}

// ===================== ROUTE SCORE =====================
function scoreRoute(route) {
  let time = route.summary.totalTime;
  let currentTime = SIM_START;

  const threshold = 0.0004;

  route.coordinates.forEach(pt => {
    allTrafficLights.forEach(light => {
      const dLat = pt.lat - light.lat;
      const dLng = pt.lng - light.lng;
      if (Math.sqrt(dLat * dLat + dLng * dLng) < threshold) {
        time += light.delayAt(currentTime);
        currentTime += light.delayAt(currentTime);
      }
    });
  });

  return time;
}

// ===================== LIGHT VISIBILITY =====================
function updateVisibleLights(route) {
  visibleLights.forEach(l => l.hide());
  visibleLights = [];

  const threshold = 0.0004;
  const now = Date.now() / 1000;

  allTrafficLights.forEach(light => {
    const near = route.coordinates.some(pt => {
      const dLat = pt.lat - light.lat;
      const dLng = pt.lng - light.lng;
      return Math.sqrt(dLat * dLat + dLng * dLng) < threshold;
    });

    if (near) {
      const state = light.stateAt(now);
      light.show(state);
      visibleLights.push(light);
    }
  });
}

// ===================== RESET =====================
function resetAll() {
  if (routingControl) map.removeControl(routingControl);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);

  visibleLights.forEach(l => l.hide());
  visibleLights = [];
  routes = [];
}
