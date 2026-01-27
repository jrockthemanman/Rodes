// ===================== MAP =====================
const map = L.map("map").setView([35.7796, -78.6382], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ===================== GLOBAL STATE =====================
let clickCount = 0;
let startLatLng = null;
let endLatLng = null;
let routingControl = null;
let carMarker = null;
let trafficLights = [];
let visibleLights = [];

// ===================== ICON =====================
const carIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097144.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// ===================== TRAFFIC LIGHT MODEL =====================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;

    // Fictitious but realistic signal
    this.cycle = 60 + Math.random() * 30; // 60–90s
    this.green = this.cycle * 0.55;
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
    if (map.hasLayer(this.marker)) {
      map.removeLayer(this.marker);
    }
  }
}

// ===================== LOAD LIGHTS =====================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (_, latlng) => {
        trafficLights.push(new TrafficLight(latlng.lat, latlng.lng));
      }
    });
    console.log("Traffic lights loaded:", trafficLights.length);
  })
  .catch(err => console.error("Light load error", err));

// ===================== MAP CLICK =====================
map.on("click", e => {
  clickCount++;

  if (clickCount === 1) {
    reset();
    startLatLng = e.latlng;
    L.marker(startLatLng).addTo(map).bindPopup("Start").openPopup();
  }

  if (clickCount === 2) {
    endLatLng = e.latlng;
    L.marker(endLatLng).addTo(map).bindPopup("End").openPopup();
    buildRoute();
    clickCount = 0;
  }
});

// ===================== ROUTING =====================
function buildRoute() {
  routingControl = L.Routing.control({
    waypoints: [startLatLng, endLatLng],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1",
      alternatives: true
    }),
    showAlternatives: true,
    addWaypoints: false,
    lineOptions: {
      styles: [
        { color: "blue", weight: 10, opacity: 0.9 },
        { color: "#999", weight: 4, opacity: 0.6 }
      ]
    }
  }).addTo(map);

  routingControl.on("routesfound", e => {
    const best = chooseFastestRoute(e.routes);
    routingControl._selectRoute(best.index);
    renderRoute(best.route);
  });
}

// ===================== ROUTE SCORING =====================
function chooseFastestRoute(routes) {
  let best = { index: 0, route: routes[0], time: Infinity };

  routes.forEach((route, i) => {
    let time = route.summary.totalTime;
    let now = Date.now() / 1000;

    route.coordinates.forEach(pt => {
      trafficLights.forEach(light => {
        if (distance(pt, light) < 0.0004) {
          time += light.delayAt(now);
        }
      });
    });

    if (time < best.time) {
      best = { index: i, route, time };
    }
  });

  return best;
}

// ===================== RENDER =====================
function renderRoute(route) {
  visibleLights.forEach(l => l.hide());
  visibleLights = [];

  let delay = 0;
  const now = Date.now() / 1000;

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

  if (carMarker) map.removeLayer(carMarker);
  carMarker = L.marker(route.coordinates[0], { icon: carIcon }).addTo(map);
}

// ===================== HELPERS =====================
function distance(pt, light) {
  return Math.hypot(pt.lat - light.lat, pt.lng - light.lng);
}

// ===================== RESET =====================
function reset() {
  if (routingControl) map.removeControl(routingControl);
  visibleLights.forEach(l => l.hide());
  visibleLights = [];
  if (carMarker) map.removeLayer(carMarker);
}
