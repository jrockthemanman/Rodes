// Create map with fake coordinates
const map = L.map('map', {
  crs: L.CRS.Simple
});

// Define map bounds
const bounds = [[0,0], [100,100]];
map.fitBounds(bounds);

// Draw fictional roads
const roads = [
  [[10, 10], [90, 10]],
  [[10, 50], [90, 50]],
  [[10, 90], [90, 90]],
  [[50, 10], [50, 90]]
];

roads.forEach(road => {
  L.polyline(road, { color: 'gray', weight: 5 }).addTo(map);
});
const trafficLights = [
  { coords: [50, 10], state: 'green' },
  { coords: [50, 50], state: 'red' },
  { coords: [50, 90], state: 'green' }
];

trafficLights.forEach(light => {
  const color = light.state === 'green' ? 'green' : 'red';

  L.circleMarker(light.coords, {
    radius: 8,
    color: color,
    fillColor: color,
    fillOpacity: 1
  })
  .bindPopup(`Traffic Light: ${light.state.toUpperCase()}`)
  .addTo(map);
});
setInterval(() => {
  map.eachLayer(layer => {
    if (layer instanceof L.CircleMarker) {
      const current = layer.options.color;
      const next = current === 'red' ? 'green' : 'red';

      layer.setStyle({
        color: next,
        fillColor: next
      });
    }
  });
}, 3000);
const fastRoute = L.polyline([[10,10],[50,10],[50,90],[90,90]], {
  color: 'green',
  weight: 4
}).addTo(map);

const slowRoute = L.polyline([[10,10],[10,90],[90,90]], {
  color: 'red',
  weight: 4,
  dashArray: '5,5'
}).addTo(map);
fastRoute.bindPopup("Fastest route (fewer red lights)");
slowRoute.bindPopup("Slower route (more red lights)");
