// ===================== MAP =====================
const map = L.map("map").setView([35.7796, -78.6382], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

console.log("Map initialized");

// ===================== TRAFFIC LIGHT STORAGE =====================
const trafficLights = [];

// ===================== LOAD GEOJSON (ROBUST) =====================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (!data || !data.features) {
      throw new Error("Invalid GeoJSON structure");
    }

    console.log("GeoJSON loaded");
    console.log("Feature count:", data.features.length);

    const layer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const marker = L.circleMarker(latlng, {
          radius: 5,
          color: "red",
          fillColor: "red",
          fillOpacity: 1
        });

        trafficLights.push({
          lat: latlng.lat,
          lng: latlng.lng,
          state: "red",
          timer: randomRedTime(),
          marker
        });

        return marker;
      },

      filter: feature => {
        return (
          feature.geometry &&
          (feature.geometry.type === "Point" ||
           feature.geometry.type === "MultiPoint")
        );
      }
    }).addTo(map);

    map.fitBounds(layer.getBounds());
    console.log("Rendered lights:", trafficLights.length);
  })
  .catch(err => {
    console.error("❌ Traffic light load failed:", err);
  });

// ===================== SIGNAL TIMING =====================
function randomRedTime() {
  return 20 + Math.floor(Math.random() * 25); // 20–45s
}

function randomGreenTime() {
  return 15 + Math.floor(Math.random() * 20); // 15–35s
}

// ===================== SIGNAL ENGINE =====================
setInterval(() => {
  trafficLights.forEach(light => {
    light.timer--;

    if (light.timer <= 0) {
      if (light.state === "red") {
        light.state = "green";
        light.timer = randomGreenTime();
      } else {
        light.state = "red";
        light.timer = randomRedTime();
      }

      light.marker.setStyle({
        color: light.state,
        fillColor: light.state
      });
    }
  });
}, 1000);
