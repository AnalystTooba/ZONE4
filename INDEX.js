let map;
let currentGeoJsonLayer = null;
let zone4Data = null; // Store the merged GeoJSON data
const schemeBounds = {};
const zoneLayerGroup = L.layerGroup();

/* ===============================
   SCHEME ABBREVIATIONS (for dropdown)
================================ */
const schemeAbbreviations = [
  'A1','AL','AHT','ALT','ARC','AA','AW',
  'BOR','EB','UET','ET','FG','GCP','GD',
  'GM','IA','JA','LA','JT1','JT2','MA',
  'MT','NI1','NI2','NWT','NT','NESPAK1',
  'NFC','OPF','PCSIR1','PGECHS1','PGECHS2','PIA',
  'PU','REV','SF','SP','VAL','WT1','WT2'
];

/* ===============================
   GLOBAL VARIABLES FOR SUMMARY
================================ */
let currentSchemeData = {
    totalDues: 0,
    totalPaid2025: 0,
    pendingDues: 0,
    illegalPlots: 0,
    adName: 'Not Selected'
};

/* ===============================
   MAP INITIALIZATION
================================ */
document.addEventListener('DOMContentLoaded', initMap);

function initMap() {
    map = L.map('map').setView([31.5204, 74.3587], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 20
    }).addTo(map);

    zoneLayerGroup.addTo(map);
    initializeSchemeBounds();

    // Load the merged ZONE4.json file
    loadZone4Data();

    // event listener for dropdown
    document.getElementById('scheme-dropdown').addEventListener('change', e => {
        const schemeAbv = e.target.value;
        if (schemeAbv) {
            filterSchemeByAbbreviation(schemeAbv);
        } else {
            // If "SELECT" is chosen, reset
            zoneLayerGroup.clearLayers();
            resetSummary();
        }
    });
    
    // Initialize with empty summary
    resetSummary();
}

/* ===============================
   LOAD MERGED ZONE4.JSON
================================ */
function loadZone4Data() {
    document.getElementById('loading').style.display = 'block';
    
    fetch('ZONE4.json')
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            zone4Data = data;
            console.log('Zone 4 data loaded successfully');
            console.log('Total features:', zone4Data.features.length);
            document.getElementById('loading').style.display = 'none';
        })
        .catch(err => {
            console.error('Error loading ZONE4.json:', err);
            alert('Error loading zone data. Please check if ZONE4.json exists.');
            document.getElementById('loading').style.display = 'none';
        });
}

/* ===============================
   FILTER SCHEME BY ABBREVIATION
================================ */
function filterSchemeByAbbreviation(schemeAbv) {
    // Clear previous layers
    zoneLayerGroup.clearLayers();
    
    if (!zone4Data || !zone4Data.features) {
        console.error('Zone 4 data not loaded yet');
        alert('Data is still loading. Please try again.');
        return;
    }
    
    // Handle "ALL ZONE 4" option
    if (schemeAbv === 'ALL_Z4') {
        displayAllSchemes();
        return;
    }
    
    // Filter features by SCH_ABV_Z4 field
    const filteredFeatures = zone4Data.features.filter(feature => {
        const properties = feature.properties || {};
        return properties.SCH_ABV_Z4 === schemeAbv;
    });
    
    if (filteredFeatures.length === 0) {
        console.log(`No features found for scheme: ${schemeAbv}`);
        alert(`No data found for scheme: ${schemeAbv}`);
        resetSummary();
        return;
    }
    
    console.log(`Found ${filteredFeatures.length} features for scheme: ${schemeAbv}`);
    
    // Create filtered GeoJSON object
    const filteredGeoJson = {
        type: 'FeatureCollection',
        features: filteredFeatures
    };
    
    // Calculate totals for this scheme
    calculateTotals(filteredGeoJson);
    
    // Add to map
    currentGeoJsonLayer = L.geoJSON(filteredGeoJson, {
        style: styleFeature,
        onEachFeature: onEachFeature
    }).addTo(zoneLayerGroup);
    
    // Update summary display
    updateSummaryDisplay();
    
    // Fit bounds
    if (filteredFeatures.length > 0) {
        map.fitBounds(currentGeoJsonLayer.getBounds(), { padding: [20, 20] });
    }
}

/* ===============================
   DISPLAY ALL SCHEMES
================================ */
function displayAllSchemes() {
    if (!zone4Data || !zone4Data.features) return;
    
    console.log('Displaying all schemes, total features:', zone4Data.features.length);
    
    // Add all features to map
    currentGeoJsonLayer = L.geoJSON(zone4Data, {
        style: styleFeature,
        onEachFeature: onEachFeature
    }).addTo(zoneLayerGroup);
    
    // Calculate totals for all schemes
    calculateTotals(zone4Data);
    updateSummaryDisplay();
    
    // Fit bounds
    map.fitBounds(currentGeoJsonLayer.getBounds(), { padding: [20, 20] });
}

/* ===============================
   OPTIONAL SCHEME BOUNDS
================================ */
function initializeSchemeBounds() {
    schemeBounds.OPF = L.latLngBounds([[31.4173,74.2300],[31.4293,74.2474]]);
    schemeBounds.NWT = L.latLngBounds([[31.4484,74.2447],[31.4590,74.2544]]);
}

/* ===============================
   AD NAME FROM SCHEME DATA
================================ */
function extractADName(geoJsonData) {
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
        return 'Not Available';
    }
    
    // Try to find AD name from properties - using AD_Z4
    const firstFeature = geoJsonData.features[0];
    const properties = firstFeature.properties || {};
    
    // Check different possible field names for AD name
    const possibleADFields = [
        'AD_Z4',  // Your JSON shows this field
    ];
    
    for (const field of possibleADFields) {
        if (properties[field] && String(properties[field]).trim() !== '') {
            return String(properties[field]).trim();
        }
    }
    
    // If no AD field found, return scheme abbreviation or "Not Available"
    return properties.SCH_ABV_Z4 || 'Not Available';
}

/* ===============================
   UPDATED CALCULATION FUNCTIONS
================================ */
function calculateTotals(geoJsonData) {
    let totalDues = 0;
    let totalPaid2025 = 0;
    let illegalPlots = 0;
    
    if (!geoJsonData || !geoJsonData.features) {
        console.log('No features found in GeoJSON data');
        return;
    }
    
    console.log('Calculating totals for', geoJsonData.features.length, 'features');
    
    geoJsonData.features.forEach(feature => {
        const p = feature.properties || {};
        
        // Sum total dues (Total_Z4 field)
        const total = parseFloat(p.Total_Z4) || 0;
        totalDues += total;
        
        // Sum total paid in 2025 only (2025_PAID_ field)
        const paid25 = parseFloat(p["2025_PAID_"]) || 0;
        totalPaid2025 += paid25;
        
        // Count plots with Category_Z = "ILLEGAL"
        const category = String(p.Category_Z || '').trim().toUpperCase();
        if (category === "ILLEGAL") {
            illegalPlots++;
        }
    });
    
    // Extract AD
    const adName = extractADName(geoJsonData);
    
    console.log('Calculated totals:', {
        totalDues,
        totalPaid2025,
        pendingDues: totalDues - totalPaid2025,
        illegalPlots,
        adName
    });
    
    currentSchemeData = {
        totalDues: totalDues,
        totalPaid2025: totalPaid2025,
        pendingDues: totalDues - totalPaid2025,
        illegalPlots: illegalPlots,
        adName: adName
    };
}

/* ===============================
   UPDATED DISPLAY FUNCTIONS
================================ */
function updateSummaryDisplay() {
    // Format numbers with commas (REMOVED RUPEE SIGN)
    const formatNumber = (num) => {
        return num.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
    };
    
    // Update all summary boxes (REMOVED RUPEE SIGN)
    document.getElementById('ad-name').textContent = currentSchemeData.adName;
    document.getElementById('total-dues').textContent = formatNumber(currentSchemeData.totalDues);
    document.getElementById('total-paid').textContent = formatNumber(currentSchemeData.totalPaid2025);
    document.getElementById('pending-dues').textContent = formatNumber(currentSchemeData.pendingDues);
    document.getElementById('illegal-plots').textContent = currentSchemeData.illegalPlots.toLocaleString('en-IN');
    
    console.log('Summary updated:', currentSchemeData);
}

function resetSummary() {
    currentSchemeData = {
        totalDues: 0,
        totalPaid2025: 0,
        pendingDues: 0,
        illegalPlots: 0,
        adName: 'Not Selected'
    };
    updateSummaryDisplay();
}

/* ===============================
   FEATURE STYLING
================================ */
function styleFeature(feature) {
    const p = feature.properties || {};
    const status = (p.PT_STATUS_ || '').trim();
    let fillColor = '#cccccc';

    switch (status) {
        case 'FULL PAYMENT': fillColor = '#33ff00'; break;
        case 'PARTIAL PAYMENT': fillColor = '#ffa500'; break;
        case 'NOT PAID/ NOTICE ISSUED': fillColor = '#ff0000'; break;
        case 'ABANDONED':
        case 'RESIDENTIAL/USE RESTORED':
        case 'IT ISSUE':
        case 'UNDER CONSTRUCTION':
        case 'OTHER':
        case 'LITIGATION':
        case 'WITHDRAWAL REQUEST':
        case 'REVISION REQUEST':
        case 'TO BE DISCUSSED':
        case 'YET TO VISIT':
        case 'VACANT':
            fillColor = '#ffff00'; break;
        case 'FALLS ON LIST A':
        case 'PERM COMMERCIAL':
            fillColor = '#375ed2'; break;
    }

    return {
        fillColor,
        color: '#333',
        weight: 0.5,
        fillOpacity: 0.9
    };
}

function onEachFeature(feature, layer) {
    const p = feature.properties || {};

    // Core identifiers
    const plotNo   = p.Plot_Z4 ?? 'N/A';
    const block    = p.Block_Z4 ?? 'N/A';
    const scheme   = p.Scheme_Z4 ?? 'N/A';
    const schemeAbv = p.SCH_ABV_Z4 ?? 'N/A';

    // Status fields
    const paymentStatus = p.PT_STATUS_ ?? null;

    /* -------- Tooltip -------- */
    layer.bindTooltip(
        `<strong>Plot ${plotNo}</strong><br>
         Scheme: ${schemeAbv}<br>
         Status: ${paymentStatus || 'No Status'}`,
        { sticky: true }
    );

    /* -------- Popup -------- */
    // Check if paymentStatus is null, empty, or undefined
    if (!paymentStatus || paymentStatus.trim() === '' || paymentStatus === 'null' || paymentStatus === 'NULL') {
        // Simple popup with only scheme name in bold
        layer.bindPopup(`
            <div class="plot-popup">
                <p><strong>${scheme}</strong></p>
            </div>
        `);
    } else {
        // Detailed popup
        const plotArea = p.Plot_Area_ ?? 'N/A';
        const total    = p.Total_Z4 ?? 0;
        const paid24   = p["2024_PAID_"] ?? 0;
        const paid25   = p["2025_PAID_"] ?? 0;
        const pending  = p.Pending_Z4 ?? (total - (paid24 + paid25));
        const groundStatus = p.GD_ST_Z4 ?? 'N/A';

        layer.bindPopup(`
            <div class="plot-popup">
                <h4>Plot ${plotNo}</h4>
                <p><strong>Scheme:</strong> ${scheme} (${schemeAbv})</p>
                <p><strong>Block:</strong> ${block}</p>
                <p><strong>Plot Area:</strong> ${plotArea}</p>
                <p><strong>Total Amount:</strong> ${formatCurrency(total)}</p>
                <p><strong>Paid (2024):</strong> ${formatCurrency(paid24)}</p>
                <p><strong>Paid (2025):</strong> ${formatCurrency(paid25)}</p>
                <p><strong>Pending Dues:</strong> ${formatCurrency(pending)}</p>
                <p><strong>Payment Status:</strong> ${paymentStatus}</p>
                <p><strong>Ground Status:</strong> ${groundStatus}</p>
                <p><strong>Category:</strong> ${p.Category_Z || 'N/A'}</p>
                <p><strong>AD:</strong> ${p.AD_Z4 || 'N/A'}</p>
            </div>
        `);
    }
}

// Helper function to format currency (for popup only)
function formatCurrency(amount) {
    return amount.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
}