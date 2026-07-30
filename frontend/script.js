let map;
let countriesLayer;
let guessMarkersLayer;
let attempts = 0;
let currentLevel = "global";
let countryNames = [];
let activeSuggestionIndex = -1;
let timerInterval = null;
let elapsedSeconds = 0;

const mapNameAliases = {
  Congo: ["Republic of the Congo"],
  "Czech Republic": ["Czechia"],
  Swaziland: ["Eswatini"],
  Tanzania: ["United Republic of Tanzania"],
  UAE: ["United Arab Emirates"],
  "United Arab Emirates": ["UAE"],
  "United States": ["United States of America"]
};

const microCountries = new Set([
  "Andorra",
  "Bahrain",
  "Liechtenstein",
  "Maldives",
  "Malta",
  "Monaco",
  "Nauru",
  "San Marino",
  "Singapore",
  "Vatican City"
]);

const levelLabels = {
  global: "المستوى: عالمي",
  africa: "Level: Africa",
  asia: "Level: Asia",
  europe: "Level: Europe",
  americas: "Level: Americas",
};

const mapViews = {
  global: { center: [20, 0], zoom: 2 },
  africa: { center: [1, 20], zoom: 3 },
  asia: { center: [34, 82], zoom: 3 },
  europe: { center: [53, 15], zoom: 4 },
  americas: { center: [8, -80], zoom: 2 },
};

const regionPreviewBounds = {
  global: { west: -180, south: -58, east: 180, north: 84 },
  africa: { west: -20, south: -36, east: 55, north: 38 },
  asia: { west: 25, south: -12, east: 180, north: 82 },
  europe: { west: -25, south: 34, east: 45, north: 72 },
  americas: { west: -170, south: -58, east: -32, north: 75 },
};

const regionPreviewContinents = {
  africa: new Set(["Africa"]),
  asia: new Set(["Asia"]),
  europe: new Set(["Europe"]),
  americas: new Set(["North America", "South America"]),
};

const input = () => document.getElementById("countryInput");
const suggestions = () => document.getElementById("suggestions");

function startGame() {
  fetch("/set_level", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level: currentLevel })
  })
    .then(response => response.json())
    .then(data => {
      countryNames = data.countries || [];
      attempts = 0;

      document.getElementById("welcome").hidden = true;
      document.getElementById("game").hidden = false;
      document.getElementById("level").innerText = levelLabels[currentLevel] || levelLabels.global;

      initMap();
      updateAttempts();
      startTimer();
      input().focus();
    })
    .catch(() => {
      document.querySelector(".intro-text").innerText = "تعذر بدء اللعبة. تأكد من تشغيل الخادم ثم حاول مرة أخرى.";
    });
}

function selectLevel(level) {
  currentLevel = level;
  startGame();
}

function resetGame() {
  document.getElementById("retryBtn").hidden = true;
  document.getElementById("result").innerText = "";
  input().value = "";
  closeSuggestions();

  resetCountryStyles();

  if (guessMarkersLayer) {
    guessMarkersLayer.clearLayers();
  }

  fetch("/reset", { method: "POST" })
    .then(response => response.json())
    .then(data => {
      attempts = 0;
      countryNames = data.countries || countryNames;
      updateAttempts();
      startTimer();
      input().focus();
    });
}

function initMap() {
  if (map) {
    map.remove();
  }

  const mapView = mapViews[currentLevel] || mapViews.global;
  const mapCenter = mapView.center;
  const mapZoom = mapView.zoom;

  map = L.map("map", {
    worldCopyJump: true,
    zoomControl: false,
    preferCanvas: false
  }).setView(mapCenter, mapZoom);

  map.createPane("countryPane");
  map.getPane("countryPane").style.zIndex = 420;
  map.createPane("markerPane");
  map.getPane("markerPane").style.zIndex = 650;

  guessMarkersLayer = L.layerGroup().addTo(map);

  L.control.zoom({ position: "bottomleft" }).addTo(map);

  fetch("/data/world.geojson")
    .then(response => response.json())
    .then(data => {
      countriesLayer = L.geoJSON(data, {
        pane: "countryPane",
        smoothFactor: 0,
        style: countryStyle
      }).addTo(map);

      if (currentLevel !== "global") {
        fitPlayableCountries();
      }
    });
}

function countryStyle(feature) {
  const playable = isPlayableCountry(feature);

  return {
    fillColor: playable ? "#d8dedb" : "#eef2f0",
    fillOpacity: playable ? 0.72 : 0.35,
    color: "#101615",
    opacity: 0.9,
    weight: 0.9,
    lineCap: "butt",
    lineJoin: "miter",
    smoothFactor: 0,
    noClip: true
  };
}

function resetCountryStyles() {
  if (!countriesLayer) return;

  countriesLayer.eachLayer(layer => {
    layer.setStyle(countryStyle(layer.feature));
    layer.unbindPopup();
  });
}

function updateAttempts() {
  document.getElementById("attempts").innerText = `المحاولات: ${attempts}`;
}

function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  updateTimer();
  timerInterval = setInterval(() => {
    elapsedSeconds += 1;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimer() {
  const timer = document.getElementById("timer");
  if (!timer) return;

  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
  timer.innerText = `Time: ${minutes}:${seconds}`;
}

function getColor(distance, isBorder = false, isCorrect = false) {
  if (isCorrect) return "#00c853";
  if (isBorder) return "#000000";

  const heatStops = [
    { distance: 0, color: "#6a040f" },
    { distance: 3, color: "#9d0208" },
    { distance: 6, color: "#d00000" },
    { distance: 10, color: "#dc2f02" },
    { distance: 16, color: "#e85d04" },
    { distance: 24, color: "#f35b04" },
    { distance: 36, color: "#f77f00" },
    { distance: 52, color: "#fb8500" },
    { distance: 72, color: "#ffb703" },
    { distance: 96, color: "#ffd166" },
    { distance: 130, color: "#ffe066" },
    { distance: 170, color: "#fff176" }
  ];

  if (distance >= heatStops[heatStops.length - 1].distance) {
    return heatStops[heatStops.length - 1].color;
  }

  for (let i = 0; i < heatStops.length - 1; i += 1) {
    const start = heatStops[i];
    const end = heatStops[i + 1];

    if (distance >= start.distance && distance <= end.distance) {
      const amount = (distance - start.distance) / (end.distance - start.distance);
      return mixColors(start.color, end.color, amount);
    }
  }

  return heatStops[0].color;
}

function sendGuess(event) {
  if (event) {
    event.preventDefault();
  }

  const country = input().value.trim();
  const result = document.getElementById("result");
  closeSuggestions();

  if (!country) {
    result.innerText = "اكتب اسم دولة أولا";
    return;
  }

  fetch("/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country })
  })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || data.error) {
        result.innerText = "الدولة غير موجودة. اختر اسما من القائمة المقترحة.";
        return;
      }

      attempts = data.attempts;
      updateAttempts();

      if (data.correct) {
        result.innerText = "إجابة صحيحة 🎉";
        document.getElementById("retryBtn").hidden = false;
        stopTimer();
      } else {
        result.innerText = `خطأ - المسافة: ${data.distance}`;
      }

      colorCountry(country, getColor(data.distance, data.is_border, data.correct), {
        isBorder: data.is_border,
        isCorrect: data.correct,
        distance: data.distance,
        location: data.guessed_country
      });
      input().select();
    });
}

function setupAutocomplete() {
  renderMapKey();
  renderAttemptNote();
  setupRegionCards();

  const countryInput = input();

  countryInput.addEventListener("input", showSuggestions);
  countryInput.addEventListener("focus", showSuggestions);
  countryInput.addEventListener("keydown", handleSuggestionKeys);

  document.addEventListener("click", event => {
    if (!event.target.closest(".autocomplete")) {
      closeSuggestions();
    }
  });
}

function setupRegionCards() {
  document.querySelectorAll(".region-card").forEach(card => {
    card.addEventListener("click", () => {
      selectLevel(card.dataset.level);
    });
    card.addEventListener("mouseenter", () => setActiveRegionPreview(card.dataset.level));
    card.addEventListener("focus", () => setActiveRegionPreview(card.dataset.level));
  });

  renderRegionMap();
}

function renderRegionMap() {
  fetch("/data/world.geojson")
    .then(response => response.json())
    .then(data => {
      const stage = document.getElementById("regionMapStage");
      if (!stage) return;

      stage.innerHTML = createRegionMapSvg(data);
      setActiveRegionPreview("global");
    });
}

function createRegionMapSvg(data) {
  const bounds = regionPreviewBounds.global;
  const width = 760;
  const height = 430;
  const landPaths = data.features
    .filter(feature => featureTouchesBounds(feature, bounds))
    .map(feature => featureToPreviewPath(feature, bounds, width, height))
    .join("");

  const areaPaths = Object.keys(regionPreviewBounds)
    .map(level => {
      const selectedFeatures = data.features
        .filter(feature => featureTouchesBounds(feature, bounds))
        .filter(feature => isFeatureInPreviewLevel(feature, level));
      const path = selectedFeatures
        .map(feature => featureToPreviewPath(feature, bounds, width, height))
        .join("");

      return `<path class="region-map-area" data-level="${level}" d="${path}"></path>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" focusable="false">
      <path class="region-map-land" d="${landPaths}"></path>
      ${areaPaths}
    </svg>
  `;
}

function setActiveRegionPreview(level) {
  const activeCard = document.querySelector(`.region-card[data-level="${level}"]`);
  const activeColor = activeCard
    ? getComputedStyle(activeCard).getPropertyValue("--region-accent").trim()
    : "#0f766e";

  document.querySelectorAll(".region-card").forEach(card => {
    card.classList.toggle("is-active", card.dataset.level === level);
  });

  document.querySelectorAll(".region-map-area").forEach(path => {
    const isActive = path.dataset.level === level;
    path.classList.toggle("is-active", isActive);
    if (isActive) {
      path.style.fill = activeColor;
    }
  });
}

function isFeatureInPreviewLevel(feature, level) {
  if (level === "global") return true;

  const continents = regionPreviewContinents[level];
  return Boolean(continents && continents.has(feature.properties.CONTINENT));
}

function featureTouchesBounds(feature, bounds) {
  const featureBounds = getFeatureBounds(feature);
  return !(
    featureBounds.east < bounds.west ||
    featureBounds.west > bounds.east ||
    featureBounds.north < bounds.south ||
    featureBounds.south > bounds.north
  );
}

function getFeatureBounds(feature) {
  const bounds = { west: 180, south: 90, east: -180, north: -90 };
  forEachCoordinate(feature.geometry, ([lng, lat]) => {
    bounds.west = Math.min(bounds.west, lng);
    bounds.east = Math.max(bounds.east, lng);
    bounds.south = Math.min(bounds.south, lat);
    bounds.north = Math.max(bounds.north, lat);
  });
  return bounds;
}

function featureToPreviewPath(feature, bounds, width, height) {
  const geometry = feature.geometry;
  if (!geometry) return "";

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  return polygons.map(polygon => {
    return polygon.map(ring => {
      return ring.map(([lng, lat], index) => {
        const [x, y] = projectPreviewPoint(lng, lat, bounds, width, height);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ") + " Z";
    }).join(" ");
  }).join(" ");
}

function projectPreviewPoint(lng, lat, bounds, width, height) {
  const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
  return [x, y];
}

function forEachCoordinate(geometry, callback) {
  if (!geometry) return;

  if (geometry.type === "Point") {
    callback(geometry.coordinates);
    return;
  }

  const walk = coordinates => {
    if (typeof coordinates[0] === "number") {
      callback(coordinates);
      return;
    }

    coordinates.forEach(walk);
  };

  walk(geometry.coordinates);
}

function renderAttemptNote() {
  const note = document.querySelector(".attempt-note");
  if (note) {
    note.textContent = "Unlimited tries";
  }
}

function renderMapKey() {
  const mapKey = document.querySelector(".map-key");
  if (!mapKey) return;

  mapKey.innerHTML = `
    <h2>Map key</h2>
    <div class="gradient-key" aria-hidden="true"></div>
    <div class="gradient-labels">
      <span>Far</span>
      <span>Close</span>
    </div>
    <div class="key-item"><span class="key-swatch key-correct"></span>Correct answer</div>
    <div class="key-item"><span class="key-swatch key-border"></span>Border country</div>
  `;
}

function showSuggestions() {
  const value = input().value.trim().toLowerCase();
  const list = suggestions();
  list.innerHTML = "";
  activeSuggestionIndex = -1;

  if (!value) {
    closeSuggestions();
    return;
  }

  const matches = countryNames
    .filter(name => name.toLowerCase().startsWith(value))
    .slice(0, 5);

  if (matches.length === 0) {
    closeSuggestions();
    return;
  }

  matches.forEach(name => {
    const item = document.createElement("li");
    item.textContent = name;
    item.setAttribute("role", "option");
    item.addEventListener("mousedown", event => {
      event.preventDefault();
      chooseSuggestion(name);
    });
    list.appendChild(item);
  });

  list.classList.add("is-open");
}

function handleSuggestionKeys(event) {
  const items = Array.from(suggestions().querySelectorAll("li"));
  if (items.length === 0) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
    markActiveSuggestion(items);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
    markActiveSuggestion(items);
  }

  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    chooseSuggestion(items[activeSuggestionIndex].textContent);
  }

  if (event.key === "Escape") {
    closeSuggestions();
  }
}

function markActiveSuggestion(items) {
  items.forEach((item, index) => {
    item.classList.toggle("is-active", index === activeSuggestionIndex);
  });
}

function chooseSuggestion(name) {
  input().value = name;
  closeSuggestions();
  input().focus();
}

function closeSuggestions() {
  suggestions().classList.remove("is-open");
  suggestions().innerHTML = "";
  activeSuggestionIndex = -1;
}

function colorCountry(country, color, options = {}) {
  if (!countriesLayer && !options.location) return;
  let matchedBounds = null;
  let needsMarker = isMicroCountry(country);

  if (countriesLayer) {
    countriesLayer.eachLayer(layer => {
      if (namesMatch(featureNames(layer.feature), expandedCountryNames(country))) {
        layer.setStyle({
          fillColor: color,
          fillOpacity: 0.94,
          color: options.isBorder ? "#000000" : "#101615",
          opacity: 1,
          weight: options.isCorrect || options.isBorder ? 3 : 1.8,
          lineCap: "butt",
          lineJoin: "miter",
          smoothFactor: 0,
          noClip: true
        });
        layer.bindPopup(createGuessPopup(country, options));
        matchedBounds = layer.getBounds();
        needsMarker = needsMarker || isTinyBounds(matchedBounds);
      }
    });
  }

  if (options.location && (!matchedBounds || needsMarker)) {
    addCountryMarker(country, color, { ...options, isMicro: needsMarker });
    focusCountryLocation(country, options.location, needsMarker);
    return;
  }

  if (matchedBounds) {
    map.fitBounds(matchedBounds, { padding: [30, 30], maxZoom: needsMarker ? 10 : 6 });
  }
}

function addCountryMarker(country, color, options) {
  if (!guessMarkersLayer || !options.location) return;

  const marker = L.circleMarker([options.location.lat, options.location.lon], {
    pane: "markerPane",
    radius: options.isMicro ? 12 : options.isCorrect ? 9 : 8,
    color: options.isBorder ? "#000000" : "#111111",
    weight: options.isBorder ? 3.5 : options.isMicro ? 3.5 : 2.5,
    fillColor: color,
    fillOpacity: 0.96,
    opacity: 1,
    className: options.isMicro ? "tiny-country-marker" : "guess-marker"
  }).bindPopup(createGuessPopup(country, options));

  marker.addTo(guessMarkersLayer);
  marker.bringToFront();
}

function createGuessPopup(country, options = {}) {
  const status = options.isCorrect
    ? "Correct answer"
    : options.isBorder
      ? "Border country"
      : "Not border country";
  const distance = options.distance === undefined ? "" : `<div>Distance: ${options.distance}</div>`;

  return `
    <div class="guess-popup">
      <strong>${escapeHtml(country)}</strong>
      <div>${status}</div>
      ${distance}
    </div>
  `;
}

function focusCountryLocation(country, location, isTiny) {
  const zoom = isTiny || isMicroCountry(country) ? 11 : currentLevel === "global" ? 5 : 7;
  map.setView([location.lat, location.lon], Math.max(map.getZoom(), zoom), {
    animate: true
  });
}

function isTinyBounds(bounds) {
  if (!bounds || !bounds.isValid()) return true;

  const latSize = Math.abs(bounds.getNorth() - bounds.getSouth());
  const lngSize = Math.abs(bounds.getEast() - bounds.getWest());
  return latSize < 4.5 && lngSize < 4.5;
}

function isMicroCountry(country) {
  return expandedCountryNames(country).some(name => microCountries.has(name));
}

function fitPlayableCountries() {
  const group = L.featureGroup();

  countriesLayer.eachLayer(layer => {
    if (isPlayableCountry(layer.feature)) {
      group.addLayer(layer);
    }
  });

  if (group.getLayers().length > 0) {
    map.fitBounds(group.getBounds(), { padding: [24, 24] });
  }
}

function isPlayableCountry(feature) {
  const playableNames = countryNames.flatMap(expandedCountryNames);
  return namesMatch(featureNames(feature), playableNames);
}

function featureNames(feature) {
  if (!feature || !feature.properties) return [];

  return [
    feature.properties.ADMIN,
    feature.properties.NAME,
    feature.properties.NAME_LONG,
    feature.properties.NAME_EN,
    feature.properties.GEOUNIT
  ].filter(Boolean);
}

function sameCountryName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function expandedCountryNames(country) {
  return [country, ...(mapNameAliases[country] || [])];
}

function namesMatch(sourceNames, targetNames) {
  return sourceNames.some(source => targetNames.some(target => sameCountryName(source, target)));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function mixColors(colorA, colorB, amount) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  const mixed = a.map((channel, index) => {
    return Math.round(channel + (b[index] - channel) * amount);
  });

  return rgbToHex(mixed);
}

function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  return [
    parseInt(cleanHex.slice(0, 2), 16),
    parseInt(cleanHex.slice(2, 4), 16),
    parseInt(cleanHex.slice(4, 6), 16)
  ];
}

function rgbToHex(rgb) {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
}

document.addEventListener("DOMContentLoaded", setupAutocomplete);
