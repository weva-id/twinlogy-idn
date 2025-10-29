let currentOffset = 0;
const PAGE_LIMIT = 10;

// Human-friendly weather descriptors
function describeTemp(v) {
  const t = Number(v);
  if (isNaN(t)) return 'N/A';
  if (t <= 0) return 'Freezing';
  if (t <= 10) return 'Very cold';
  if (t <= 16) return 'Cold';
  if (t <= 22) return 'Cool';
  if (t <= 26) return 'Comfortable';
  if (t <= 32) return 'Warm';
  return 'Hot';
}

function describeHum(v) {
  const h = Number(v);
  if (isNaN(h)) return 'N/A';
  if (h < 30) return 'Dry';
  if (h <= 60) return 'Comfortable';
  if (h <= 80) return 'Humid';
  return 'Very humid';
}

// map categories to short keys (used for badge classes and colors)
function getTempCategoryKey(v){
  const t = Number(v);
  if (isNaN(t)) return 'unknown';
  if (t <= 0) return 'freezing';
  if (t <= 10) return 'very-cold';
  if (t <= 16) return 'cold';
  if (t <= 22) return 'cool';
  if (t <= 26) return 'comfortable';
  if (t <= 32) return 'warm';
  return 'hot';
}

function getHumCategoryKey(v){
  const h = Number(v);
  if (isNaN(h)) return 'unknown';
  if (h < 30) return 'dry';
  if (h <= 60) return 'comfortable';
  if (h <= 80) return 'humid';
  return 'very-humid';
}

function badgeHtmlTemp(v){
  const key = getTempCategoryKey(v);
  const label = describeTemp(v);
  // emoji added in legend; also include small emoji in badge
  const emojiMap = { 'freezing':'❄️','very-cold':'🥶','cold':'🧊','cool':'🧥','comfortable':'🙂','warm':'☀️','hot':'🔥' };
  const em = emojiMap[key] || '';
  return `<span class="badge badge-temp-${key}">${em} ${label}</span>`;
}

function badgeHtmlHum(v){
  const key = getHumCategoryKey(v);
  const label = describeHum(v);
  const emojiMap = { 'dry':'🏜️','comfortable':'🙂','humid':'💧','very-humid':'🌧️' };
  const em = emojiMap[key] || '';
  return `<span class="badge badge-hum-${key}">${em} ${label}</span>`;
}

// category filters (temp) - read from checkboxes
let activeTempCategoryFilters = [];
function readTempFilters(){
  const checked = Array.from(document.querySelectorAll('.temp-filter:checked')).map(i=>i.value);
  activeTempCategoryFilters = checked; // array of keys
}

// apply temp filters to rows (client-side). If no filters selected, show all.
function applyTempFilters(rows){
  readTempFilters();
  if (!activeTempCategoryFilters || activeTempCategoryFilters.length === 0) return rows;
  return rows.filter(r => activeTempCategoryFilters.includes(getTempCategoryKey(r.temperature)));
}
function buildQuery() {
  const params = new URLSearchParams();
  params.set('limit', PAGE_LIMIT);
  params.set('offset', String(currentOffset));
  const from = document.getElementById('filter-from')?.value;
  const to = document.getElementById('filter-to')?.value;
  const minTemp = document.getElementById('filter-minTemp')?.value;
  const maxTemp = document.getElementById('filter-maxTemp')?.value;
  const centerLat = document.getElementById('filter-centerLat')?.value;
  const centerLon = document.getElementById('filter-centerLon')?.value;
  const radius = document.getElementById('filter-radius')?.value;
  if (from) params.set('from', new Date(from).toISOString());
  if (to) params.set('to', new Date(to).toISOString());
  if (minTemp) params.set('minTemp', minTemp);
  if (maxTemp) params.set('maxTemp', maxTemp);
  if (centerLat) params.set('centerLat', centerLat);
  if (centerLon) params.set('centerLon', centerLon);
  if (radius) params.set('radius', radius);
  return params.toString();
}

async function fetchData() {
  try {
    const q = buildQuery();
    const res = await fetch('/data?' + q);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    // data: { total, limit, offset, results }
    render(data.results || []);
  // update stats charts if present
  try { updateStatsFromRows(data.results || []); } catch(e) { /* ignore if charts not ready */ }
    document.getElementById('page-info').textContent = `Page ${Math.floor((data.offset || 0)/ (data.limit||PAGE_LIMIT)) + 1} — total ${data.total}`;
  } catch (err) {
    console.error('Fetch error', err);
    document.getElementById('data-body').innerHTML = `<tr><td colspan="5">Error fetching data</td></tr>`;
  }
}

function render(rows) {
  const tbody = document.getElementById('data-body');
  // keep last results for map/stats pages
  try { window.lastResults = (rows || []).slice(); } catch(e) { /* ignore */ }
  // apply client-side temp category filters
  const visible = applyTempFilters(rows || []);

  tbody.innerHTML = visible.map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${r.sensorId || 'N/A'}</td>
      <td>${r.locationName || 'Unknown'}</td>
      <td>${badgeHtmlTemp(r.temperature)} ${r.temperature}°C</td>
      <td>${badgeHtmlHum(r.humidity)} ${r.humidity}%</td>
      <td>${r.location?.lat || ''}, ${r.location?.lon || ''}</td>
    </tr>
  `).join('');
}

// Wait for DOM to be ready before attaching event listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM Ready - Initializing TWINLOGY IDN...');
  
  // Initial fetch and interval (wrapped in try-catch to prevent breaking event listeners)
  try { fetchData(); } catch(e) { console.warn('Initial fetch failed:', e); }

  // wire up filter/pagination controls
  document.getElementById('apply-filters')?.addEventListener('click', () => {
    currentOffset = 0; fetchData();
  });
  document.getElementById('prev-page')?.addEventListener('click', () => {
    currentOffset = Math.max(0, currentOffset - PAGE_LIMIT); fetchData();
  });
  document.getElementById('next-page')?.addEventListener('click', () => {
    currentOffset = currentOffset + PAGE_LIMIT; fetchData();
  });
  document.getElementById('export-csv')?.addEventListener('click', () => {
    const q = buildQuery();
    window.location = '/export.csv?' + q;
  });
  
  // Polling interval (wrapped to prevent errors)
  try { setInterval(fetchData, 5000); } catch(e) { console.warn('Interval setup failed:', e); }

  // Setup Server-Sent Events (SSE) for realtime updates. Falls back to polling if SSE not supported.
  if (window.EventSource) {
    try {
      const es = new EventSource('/events');
      es.onmessage = (e) => {
      try {
        const record = JSON.parse(e.data);
          // Prepend the new record to the table
          const tbody = document.getElementById('data-body');
                  const newRow = document.createElement('tr');
                  newRow.innerHTML = `
                    <td>1</td>
                    <td>${record.sensorId || 'N/A'}</td>
                    <td>${record.locationName || 'Unknown'}</td>
                    <td>${badgeHtmlTemp(record.temperature)} ${record.temperature}°C</td>
                    <td>${badgeHtmlHum(record.humidity)} ${record.humidity}%</td>
                    <td>${record.location?.lat || ''}, ${record.location?.lon || ''}</td>
                  `;
          // Update existing index numbers
          const rows = tbody.querySelectorAll('tr');
          rows.forEach((r, idx) => {
            const firstCell = r.querySelector('td');
            if (firstCell) firstCell.textContent = idx + 2; // shift by 1
          });
          // let stats handle the incoming record (keeps full dataset)
          try { processIncomingRecord(record); } catch(err2) { /* ignore */ }
          // Insert new row at top only if it matches active temp filters
          readTempFilters();
          if (!activeTempCategoryFilters.length || activeTempCategoryFilters.includes(getTempCategoryKey(record.temperature))) {
            if (tbody.firstChild) tbody.insertBefore(newRow, tbody.firstChild);
          }
        } catch (err) {
          console.error('SSE parse error', err);
        }
      };
      es.onerror = (err) => { console.warn('SSE connection error', err); };
    } catch (err) {
      console.warn('SSE setup failed, falling back to polling', err);
    }
  }
  
  // init default page (wrapped in try-catch)
  try {
    if (!location.hash) location.hash = '#dashboard';
    showPage((location.hash||'#dashboard').replace('#',''));
  } catch(e) {
    console.warn('Page initialization failed:', e);
  }
  
  // Initialize location features
  try {
    initLocationFeatures();
  } catch(e) {
    console.warn('Location features initialization failed:', e);
  }
  
  // Attach temp filter checkboxes
  try {
    document.querySelectorAll('.temp-filter').forEach(cb => cb.addEventListener('change', ()=>{
      fetchData();
      if ((location.hash||'#dashboard').replace('#','') === 'map') {
        setTimeout(()=> renderMapFromLastResults(), 200);
      }
    }));
  } catch(e) {
    console.warn('Temp filter initialization failed:', e);
  }
  
  console.log('✅ TWINLOGY IDN initialized successfully!');
});

// ----- Simple client-side navigation & map -----
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const el = document.getElementById('page-' + id);
  if (el) el.style.display = '';
}

window.addEventListener('hashchange', () => {
  const name = (location.hash || '#dashboard').replace('#','') || 'dashboard';
  showPage(name);
  if (name === 'map') renderMapFromLastResults();
});

// Map variables
let map;
let markersLayer;

function initMap() {
  if (map) return;
  try {
    if (typeof L === 'undefined') {
      console.error('Leaflet library not loaded');
      document.getElementById('map').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f7fafc;color:#666;padding:20px;text-align:center;">❌ Map library failed to load. Please check your internet connection.</div>';
      return;
    }
    map = L.map('map').setView([-6.2, 106.816], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  } catch (err) {
    console.error('Map initialization failed:', err);
    document.getElementById('map').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f7fafc;color:#666;padding:20px;text-align:center;">❌ Map failed to initialize. Error: ' + err.message + '</div>';
  }
}

function renderMap(points) {
  initMap();
  markersLayer.clearLayers();
  if (!points || points.length === 0) return;
  const bounds = [];
  points.forEach((r) => {
    const lat = parseFloat(r.location?.lat);
    const lon = parseFloat(r.location?.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    // choose color based on temp category
    const tKey = getTempCategoryKey(r.temperature);
    const colorClass = `badge-temp-${tKey}`;
    // try to compute a hex color by reading CSS variable is not possible here, so approximate with mapping
    const colorMap = {
      'freezing':'#0066cc', 'very-cold':'#2b6cb0', 'cold':'#3182ce', 'cool':'#63b3ed',
      'comfortable':'#38a169', 'warm':'#f6ad55', 'hot':'#e53e3e'
    };
    const circleColor = colorMap[tKey] || '#888';
    const popupHtml = `<b>${r.timestamp}</b><br/>Temp: ${describeTemp(r.temperature)} (${r.temperature}°C)<br/>Hum: ${describeHum(r.humidity)} (${r.humidity}%)`;
    const m = L.circleMarker([lat, lon], { radius: 6, color: circleColor, fillColor: circleColor, fillOpacity: 0.8 }).bindPopup(popupHtml);
    m.addTo(markersLayer);
    bounds.push([lat, lon]);
  });
  if (bounds.length) map.fitBounds(bounds, { maxZoom: 15 });
}

function renderMapFromLastResults() {
  if (window.lastResults && window.lastResults.length) {
    const pts = applyTempFilters(window.lastResults.slice());
    renderMap(pts);
  } else {
    // fetch recent points and apply filters
    fetch('/data?limit=200').then(r=>r.json()).then(d=>{
      const pts = (d.results || []).map(x => x);
      const filtered = applyTempFilters(pts);
      renderMap(filtered);
    }).catch(e=>console.warn('map fetch err', e));
  }

}

// ===== ADVANCED LOCATION SEARCH FEATURES =====

// Global state for location features
let currentSearchLocation = null;
let compareLocations = [];
let searchRadiusCircle = null;

// Haversine distance calculator (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = (d) => d * Math.PI / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + 
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*
            Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Format distance for display
function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(2)}km`;
}

// === LOCATION FEATURES GLOBAL VARIABLES ===
let autocompleteTimer;
let locPlaceInput;
let locSuggestions;
let compareMode = false;

function initLocationSearch() {
  locPlaceInput = document.getElementById('loc-place');
  locSuggestions = document.getElementById('loc-suggestions');
  
  locPlaceInput?.addEventListener('input', (e) => {
    clearTimeout(autocompleteTimer);
    const query = e.target.value.trim();
    if (query.length < 3) {
      locSuggestions.style.display = 'none';
      return;
    }
    autocompleteTimer = setTimeout(() => searchAutocomplete(query), 300);
  });
}

async function searchAutocomplete(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const results = await res.json();
    
    if (!results || results.length === 0) {
      locSuggestions.style.display = 'none';
      return;
    }
    
    locSuggestions.innerHTML = results.map(r => 
      `<div style="padding:10px; cursor:pointer; border-bottom:1px solid #e2e8f0; hover:background:#f7fafc;" 
            data-lat="${r.lat}" data-lon="${r.lon}" data-name="${r.display_name}" class="suggestion-item">
        📍 ${r.display_name}
      </div>`
    ).join('');
    
    locSuggestions.style.display = 'block';
    
    // Add click handlers to suggestions
    document.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = item.dataset.lat;
        const lon = item.dataset.lon;
        const name = item.dataset.name;
        locPlaceInput.value = name;
        locSuggestions.style.display = 'none';
        selectLocation(parseFloat(lat), parseFloat(lon), name);
      });
      item.addEventListener('mouseenter', (e) => {
        e.target.style.background = '#f7fafc';
      });
      item.addEventListener('mouseleave', (e) => {
        e.target.style.background = 'white';
      });
    });
  } catch (err) {
    console.error('Autocomplete error:', err);
  }
}

// Hide suggestions when clicking outside (initialized in initLocationFeatures)
function initLocationFeatures() {
  // Initialize location search
  initLocationSearch();
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!locPlaceInput?.contains(e.target) && !locSuggestions?.contains(e.target)) {
      if (locSuggestions) locSuggestions.style.display = 'none';
    }
  });

  // === 2. DETECT MY LOCATION (Geolocation) ===
  document.getElementById('loc-detect')?.addEventListener('click', () => {
    const statusEl = document.getElementById('loc-status');
    if (!navigator.geolocation) {
      statusEl.textContent = '❌ Geolocation not supported';
      return;
    }
    
    statusEl.textContent = '📍 Detecting location...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        statusEl.textContent = '✅ Location detected!';
        setTimeout(() => statusEl.textContent = '', 3000);
        selectLocation(lat, lon, 'My Current Location');
      },
      (error) => {
        statusEl.textContent = `❌ Error: ${error.message}`;
        setTimeout(() => statusEl.textContent = '', 5000);
      }
    );
  });

// === 3. FAVORITES MANAGEMENT (Functions moved outside, listeners inside initLocationFeatures) ===
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('twinFavorites') || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem('twinFavorites', JSON.stringify(favorites));
}

function renderFavorites() {
  const favorites = loadFavorites();
  const listEl = document.getElementById('favorites-list');
  
  if (favorites.length === 0) {
    listEl.innerHTML = '<div style="color:#a0aec0; text-align:center; padding:12px;">No favorite locations yet. Save one using the button below!</div>';
    return;
  }
  
  listEl.innerHTML = favorites.map((fav, idx) => `
    <div style="background:white; padding:10px; border-radius:6px; display:flex; align-items:center; gap:8px;">
      <span style="flex:1;">
        <strong>${fav.name || 'Unnamed'}</strong><br>
        <small style="color:#666;">${fav.lat.toFixed(6)}, ${fav.lon.toFixed(6)} • Radius: ${fav.radius}km</small>
      </span>
      <button onclick="useFavorite(${idx})" style="background:#3182ce; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.9em;">Use</button>
      <button onclick="deleteFavorite(${idx})" style="background:#e53e3e; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.9em;">Delete</button>
    </div>
  `).join('');
}

window.useFavorite = (idx) => {
  const favorites = loadFavorites();
  const fav = favorites[idx];
  if (!fav) return;
  selectLocation(fav.lat, fav.lon, fav.name, fav.radius);
};

window.deleteFavorite = (idx) => {
  const favorites = loadFavorites();
  favorites.splice(idx, 1);
  saveFavorites(favorites);
  renderFavorites();
};

  document.getElementById('loc-show-favorites')?.addEventListener('click', () => {
    const panel = document.getElementById('favorites-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') renderFavorites();
  });

  document.getElementById('loc-save-favorite')?.addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('loc-centerLat')?.value);
    const lon = parseFloat(document.getElementById('loc-centerLon')?.value);
    const radius = parseFloat(document.getElementById('loc-radius')?.value);
    
    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      alert('Please enter valid coordinates and radius first');
      return;
    }
    
    const name = prompt('Enter a name for this favorite location:', 'Favorite Location');
    if (!name) return;
    
    const favorites = loadFavorites();
    favorites.push({ name, lat, lon, radius, savedAt: new Date().toISOString() });
    saveFavorites(favorites);
    alert('✅ Location saved to favorites!');
    renderFavorites();
  });

  // === 4. MULTI-LOCATION COMPARE ===
  document.getElementById('loc-compare-mode')?.addEventListener('click', () => {
  compareMode = !compareMode;
  const panel = document.getElementById('compare-panel');
  const btn = document.getElementById('loc-compare-mode');
  
  if (compareMode) {
    panel.style.display = 'block';
    btn.style.background = '#2f855a';
    btn.textContent = '✅ Compare Mode Active';
    compareLocations = [];
    renderCompareLocations();
  } else {
    panel.style.display = 'none';
    btn.style.background = '#38a169';
    btn.textContent = '🔄 Compare Locations';
  }
});

function renderCompareLocations() {
  const container = document.getElementById('compare-locations');
  if (compareLocations.length === 0) {
    container.innerHTML = '<div style="color:#a0aec0; padding:8px;">Search locations to add them to comparison. Click "Compare All" when ready.</div>';
    return;
  }
  
  container.innerHTML = compareLocations.map((loc, idx) => `
    <div style="background:white; padding:8px; border-radius:4px; display:flex; align-items:center; gap:8px; margin-bottom:4px;">
      <span style="flex:1;"><strong>${loc.name}</strong> (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})</span>
      <button onclick="removeCompareLocation(${idx})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.85em;">Remove</button>
    </div>
  `).join('');
}

window.removeCompareLocation = (idx) => {
  compareLocations.splice(idx, 1);
  renderCompareLocations();
};

  document.getElementById('compare-execute')?.addEventListener('click', async () => {
  if (compareLocations.length < 2) {
    alert('Add at least 2 locations to compare');
    return;
  }
  
  try {
    const allResults = [];
    for (const loc of compareLocations) {
      const q = new URLSearchParams({ 
        centerLat: loc.lat, 
        centerLon: loc.lon, 
        radius: loc.radius || 5, 
        limit: '1000' 
      }).toString();
      const res = await fetch('/data?' + q);
      const data = await res.json();
      data.results.forEach(r => {
        r.searchLocation = loc.name;
        r.distanceFromSearch = calculateDistance(loc.lat, loc.lon, parseFloat(r.location?.lat), parseFloat(r.location?.lon));
      });
      allResults.push(...data.results);
    }
    
    // Remove duplicates based on hash
    const unique = [];
    const seen = new Set();
    allResults.forEach(r => {
      if (!seen.has(r.hash)) {
        seen.add(r.hash);
        unique.push(r);
      }
    });
    
    window.lastResults = unique;
    renderLocationResults(unique, null, true);
    document.getElementById('loc-results-count').textContent = `${unique.length} sensors found across ${compareLocations.length} locations`;
  } catch (err) {
    console.error('Compare error:', err);
    alert('Failed to compare locations');
  }
});

// === 5. ENHANCED LOCATION SELECTION ===
function selectLocation(lat, lon, name, radius) {
  currentSearchLocation = { lat, lon, name, radius: radius || 5 };
  
  document.getElementById('loc-centerLat').value = lat.toFixed(6);
  document.getElementById('loc-centerLon').value = lon.toFixed(6);
  if (radius) document.getElementById('loc-radius').value = radius;
  
  // Show active location info
  const infoEl = document.getElementById('loc-active-info');
  const detailsEl = document.getElementById('loc-active-details');
  infoEl.style.display = 'block';
  detailsEl.innerHTML = `
    <strong>${name}</strong><br>
    Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>
    Search radius: ${currentSearchLocation.radius}km
  `;
  
  // If in compare mode, add to compare list
  if (compareMode) {
    if (!compareLocations.find(l => l.lat === lat && l.lon === lon)) {
      compareLocations.push({ lat, lon, name, radius: currentSearchLocation.radius });
      renderCompareLocations();
    }
  } else {
    // Trigger search immediately
    document.getElementById('loc-check')?.click();
  }
  
  // Show on map with radius circle
  if (map) {
    map.setView([lat, lon], 12);
    if (searchRadiusCircle) map.removeLayer(searchRadiusCircle);
    searchRadiusCircle = L.circle([lat, lon], {
      radius: currentSearchLocation.radius * 1000, // convert to meters
      color: '#3182ce',
      fillColor: '#63b3ed',
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map);
  }
}

// === 6. ENHANCED MAP INTEGRATION ===
// Add click-to-search on map
function enhanceMap() {
  if (!map) return;
  
  map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    selectLocation(lat, lon, 'Map Location');
  });
  
  // Add marker clustering support
  if (typeof L.markerClusterGroup === 'function') {
    markersLayer = L.markerClusterGroup();
    map.addLayer(markersLayer);
  }
}

// Call enhance when map is initialized
const originalInitMap = initMap;
window.initMap = function() {
  originalInitMap();
  enhanceMap();
};

// === 7. UPDATE LOCATION RESULTS RENDERING ===
function renderLocationResults(rows, searchLoc, showSearchLocation) {
  const tbody = document.getElementById('loc-results');
  const sortByDistance = document.getElementById('loc-sort-distance')?.checked;
  
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#a0aec0;">No sensors found in this area 🔍</td></tr>';
    document.getElementById('loc-results-count').textContent = '';
    return;
  }
  
  // Calculate distances if we have a search location
  const loc = searchLoc || currentSearchLocation;
  if (loc) {
    rows.forEach(r => {
      if (r.location && r.location.lat && r.location.lon) {
        r.distance = calculateDistance(loc.lat, loc.lon, parseFloat(r.location.lat), parseFloat(r.location.lon));
      }
    });
  }
  
  // Sort by distance if enabled
  if (sortByDistance && loc) {
    rows.sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }
  
  tbody.innerHTML = rows.map((r, i) => {
    const distanceText = r.distance !== undefined ? formatDistance(r.distance) : '-';
    const searchLocText = showSearchLocation && r.searchLocation ? `<br><small style="color:#805ad5;">From: ${r.searchLocation}</small>` : '';
    
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${distanceText}</strong></td>
      <td><code style="font-size:0.85em; background:#f7fafc; padding:2px 6px; border-radius:3px;">${r.sensorId || '-'}</code></td>
      <td><strong>${r.locationName || '-'}</strong></td>
      <td>${badgeHtmlTemp(r.temperature)} ${r.temperature}°C</td>
      <td>${badgeHtmlHum(r.humidity)} ${r.humidity}%</td>
      <td style="font-size:0.9em; color:#666;">${r.location?.lat||''}, ${r.location?.lon||''}${searchLocText}</td>
      <td>
        <button onclick="showSensorOnMap(${r.location?.lat}, ${r.location?.lon})" 
                style="background:#4299e1; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.85em;">
          📍 Map
        </button>
      </td>
    </tr>`;
  }).join('');
  
  document.getElementById('loc-results-count').textContent = `${rows.length} sensor${rows.length > 1 ? 's' : ''} found`;
}

window.showSensorOnMap = (lat, lon) => {
  if (!lat || !lon) return;
  location.hash = '#map';
  setTimeout(() => {
    if (map) {
      map.setView([lat, lon], 15);
      L.popup()
        .setLatLng([lat, lon])
        .setContent('📍 Selected Sensor')
        .openOn(map);
    }
  }, 300);
};

  // Sort by distance checkbox handler
  document.getElementById('loc-sort-distance')?.addEventListener('change', () => {
  if (window.lastResults && window.lastResults.length > 0) {
    renderLocationResults(window.lastResults, currentSearchLocation, compareMode);
  }
});

  // Location Check handlers (UPDATED)
  document.getElementById('loc-check')?.addEventListener('click', async () => {
  const lat = document.getElementById('loc-centerLat')?.value;
  const lon = document.getElementById('loc-centerLon')?.value;
  const radius = document.getElementById('loc-radius')?.value;
  if (!lat || !lon || !radius) return alert('Isi center lat, lon, dan radius');
  const q = new URLSearchParams({ centerLat: lat, centerLon: lon, radius, limit: '1000' }).toString();
  try {
    const res = await fetch('/data?' + q);
    const data = await res.json();
    const rows = data.results || [];
    window.lastResults = rows;
    renderLocationResults(rows, { lat: parseFloat(lat), lon: parseFloat(lon), radius: parseFloat(radius) }, false);
  } catch (err) {
    console.error('loc check err', err); alert('Gagal mengambil data');
  }
});

  document.getElementById('loc-show-map')?.addEventListener('click', () => {
  if (!window.lastResults || !window.lastResults.length) return alert('Lakukan check terlebih dahulu');
  location.hash = '#map';
  setTimeout(()=> renderMap(window.lastResults), 300);
});

// --- Geocode place (city/country) using Nominatim and trigger location check ---
async function geocodePlace(place) {
  const msgEl = document.getElementById('loc-geocode-msg');
  try {
    if (!place || !place.trim()) { msgEl.textContent = 'Masukkan nama kota/negara.'; return null; }
    msgEl.textContent = 'Mencari...';
    // public Nominatim endpoint — lightweight use only. In production, proxy via server with proper User-Agent.
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(place);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) { msgEl.textContent = 'Gagal mencari lokasi.'; return null; }
    const arr = await res.json();
    if (!arr || !arr.length) { msgEl.textContent = 'Lokasi tidak ditemukan.'; return null; }
    const first = arr[0];
    msgEl.textContent = `Ditemukan: ${first.display_name}`;
    return { lat: first.lat, lon: first.lon, display_name: first.display_name };
  } catch (err) {
    console.error('geocode error', err);
    msgEl.textContent = 'Kesalahan saat mencari.';
    return null;
  }
}

  document.getElementById('loc-geocode')?.addEventListener('click', async () => {
    const place = document.getElementById('loc-place')?.value;
    const info = await geocodePlace(place);
    if (!info) return;
    // Use selectLocation for unified handling
    selectLocation(parseFloat(info.lat), parseFloat(info.lon), info.display_name, 10);
  });
  
  console.log('✅ Location features initialized');
} // End of initLocationFeatures()

// ----- Stats (Chart.js) -----
let tempChart, humChart;

function formatNumber(v, digits=2){ return (Math.round((v||0)*Math.pow(10,digits))/Math.pow(10,digits)).toString(); }

function initStats(){
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    document.getElementById('stats-area').innerHTML = '<div style="background:#fff3cd;border:1px solid #ffc107;padding:20px;border-radius:8px;text-align:center;color:#856404;">⚠️ Chart.js library failed to load. Please check your internet connection.</div>';
    return;
  }
  if (tempChart && humChart) return;
  const tCtx = document.getElementById('tempChart')?.getContext('2d');
  const hCtx = document.getElementById('humChart')?.getContext('2d');
  if (!tCtx || !hCtx) return;
  try {
    tempChart = new Chart(tCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Temperature (°C)', data: [], borderColor: 'rgb(220,53,69)', backgroundColor: 'rgba(220,53,69,0.12)', tension: 0.2 }] },
      options: { responsive: true, plugins: { legend: { display: true } }, scales: { x: { display: true }, y: { beginAtZero: false } } }
    });
    humChart = new Chart(hCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Humidity (%)', data: [], borderColor: 'rgb(33,150,243)', backgroundColor: 'rgba(33,150,243,0.12)', tension: 0.2 }] },
      options: { responsive: true, plugins: { legend: { display: true } }, scales: { x: { display: true }, y: { beginAtZero: true } } }
    });
  } catch (err) {
    console.error('Chart initialization failed:', err);
    document.getElementById('stats-area').innerHTML = '<div style="background:#f8d7da;border:1px solid #dc3545;padding:20px;border-radius:8px;text-align:center;color:#721c24;">❌ Failed to initialize charts. Error: ' + err.message + '</div>';
  }
}

function updateStatsFromRows(rows){
  if (!rows || !rows.length) {
    // clear charts if empty
    if (tempChart) { tempChart.data.labels = []; tempChart.data.datasets[0].data = []; tempChart.update(); }
    if (humChart) { humChart.data.labels = []; humChart.data.datasets[0].data = []; humChart.update(); }
    document.getElementById('stats-temp').textContent = 'Avg: - | Min: - | Max: -';
    document.getElementById('stats-hum').textContent = 'Avg: - | Min: - | Max: -';
    return;
  }
  // ensure stats UI exists
  initStats();
  // take latest up to 200 points
  const pts = rows.slice(-200);
  const labels = pts.map(r => new Date(r.timestamp).toLocaleString());
  const temps = pts.map(r => Number(r.temperature || 0));
  const hums = pts.map(r => Number(r.humidity || 0));
  if (tempChart) { tempChart.data.labels = labels; tempChart.data.datasets[0].data = temps; tempChart.update(); }
  if (humChart) { humChart.data.labels = labels; humChart.data.datasets[0].data = hums; humChart.update(); }

  // compute avg/min/max
  const tAvg = temps.reduce((a,b)=>a+b,0)/temps.length;
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const hAvg = hums.reduce((a,b)=>a+b,0)/hums.length;
  const hMin = Math.min(...hums);
  const hMax = Math.max(...hums);
  document.getElementById('stats-temp').textContent = `Avg: ${formatNumber(tAvg)} | Min: ${formatNumber(tMin)} | Max: ${formatNumber(tMax)}`;
  document.getElementById('stats-hum').textContent = `Avg: ${formatNumber(hAvg)} | Min: ${formatNumber(hMin)} | Max: ${formatNumber(hMax)}`;
}

function processIncomingRecord(record){
  if (!record) return;
  // maintain lastResults for map/stats
  window.lastResults = window.lastResults || [];
  // add to front
  window.lastResults.unshift(record);
  // cap at 2000 entries
  if (window.lastResults.length > 2000) window.lastResults.length = 2000;

  // if stats page present, update charts incrementally
  try {
    initStats();
    if (tempChart && humChart) {
      const label = new Date(record.timestamp).toLocaleString();
      // prepend keep order consistent with updateStatsFromRows (older -> newer)
      // we'll add to end to represent increasing time
      tempChart.data.labels.push(label);
      tempChart.data.datasets[0].data.push(Number(record.temperature||0));
      humChart.data.labels.push(label);
      humChart.data.datasets[0].data.push(Number(record.humidity||0));
      // trim to 200 points
      const limit = 200;
      while (tempChart.data.labels.length > limit) { tempChart.data.labels.shift(); tempChart.data.datasets[0].data.shift(); }
      while (humChart.data.labels.length > limit) { humChart.data.labels.shift(); humChart.data.datasets[0].data.shift(); }
      tempChart.update(); humChart.update();
    }
    // update summary using lastResults snapshot (fast)
    updateStatsFromRows(window.lastResults.slice(0,200).reverse()); // reverse to chronological
  } catch (err) { console.warn('processIncomingRecord error', err); }
}

// initialize stats when user navigates to stats
window.addEventListener('hashchange', () => {
  const name = (location.hash || '#dashboard').replace('#','') || 'dashboard';
  if (name === 'stats') {
    initStats();
    // try to fetch visible data for chart
    fetch('/data?limit=200').then(r=>r.json()).then(d=> updateStatsFromRows(d.results || [])).catch(()=>{});
  }
});
