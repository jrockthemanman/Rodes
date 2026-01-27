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
let visibleLights = [];

// ===================== TRAFFIC LIGHT STORAGE (HIDDEN) =====================
const allTrafficLights = [];

// ===================== TRAFFIC LIGHT CLASS =====================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.state = Math.random() > 0.5 ? "red" : "green";
    this.timer = this.state === "red" ? rand(20, 40) : rand(15, 30);

    // Marker is CREATED but NOT added yet
    this.marker = L.circleMarker([lat, lng], {
      radius: 6,
      color: this.state,
      fillColor: this.state,
      fillOpacity: 1
    });
  }

  show() {
    if (!map.hasLayer(this.marker)) {
      this.marker.addTo(map);
    }
  }

  hide() {
    if (map.hasLayer(this.marker)) {
      map.removeLayer(this.marker);
    }
  }

  tick() {
    this.timer--;
    if (this.timer <= 0) {
      if (this.state === "red") {
        this.state = "green";
        this.timer = rand(15, 30);
      } else {
        this.state = "red";
        this.timer = rand(20, 40);
      }

      this.marker.setStyle({
        color: this.state,
        fillColor: this.state
      });
    }
  }
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===================== LOAD RALEIGH LIGHTS =====================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (_, latlng) => {
        allTrafficLights.push(new TrafficLight(latlng.lat, latlng.lng));
      }
    });
    console.log("Loaded traffic lights:", allTrafficLights.length);
  });

// ===================== SIGNAL ENGINE =====================
setInterval(() => {
  visibleLights.forEach(l => l.tick());
}, 1000);

// ===================== CLICK HANDLING =====================
map.on("click", e => {
  clickStage++;

  if (clickStage === 1) {
    resetAll();
    startPoint = e.latlng;
    startMarker = L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
  }

  else if (clickStage === 2) {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint).addTo(map).bindPopup("Destination").openPopup();
    buildRoute();
  }

  else {
    clickStage = 0;
    resetAll();
  }
});

// ===================== ROUTING =====================
function buildRoute() {
  if (routingControl) map.removeControl(routingControl);

  routingControl = L.Routing.control({
    waypoints: [startPoint, endPoint],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      alternatives: true
    }),

    // 🔴 VERY VISIBLE ROUTE STYLE
    lineOptions: {
      styles: [
        { color: "red", weight: 10, opacity: 0.9 },     // primary
        { color: "#777", weight: 4, opacity: 0.6 }      // alternates
      ]
    },

    showAlternatives: true,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true
  }).addTo(map);

  routingControl.on("routesfound", e => {
    routes = e.routes;
    showLightsForRoute(routes[0]);
  });

  routingControl.on("routeselected", e => {
    showLightsForRoute(routes[e.routeIndex]);
  });
}

// ===================== ROUTE-BASED LIGHT VISIBILITY =====================
function showLightsForRoute(route) {
  // Hide previous lights
  visibleLights.forEach(l => l.hide());
  visibleLights = [];

  const threshold = 0.0004; // ~40 meters

  allTrafficLights.forEach(light => {
    const near = route.coordinates.some(pt => {
      const dLat = pt.lat - light.lat;
      const dLng = pt.lng - light.lng;
      return Math.sqrt(dLat * dLat + dLng * dLng) < threshold;
    });

    if (near) {
      light.show();
      visibleLights.push(light);
    } else {
      light.hide();
    }
  });

  console.log("Visible route lights:", visibleLights.length);
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
