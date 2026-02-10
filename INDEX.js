let map;
let currentGeoJsonLayer = null;
const schemeBounds = {};
const zoneLayerGroup = L.layerGroup();

/* ===============================
   ZONE 4 JSON FILES
================================ */
const zone4JsonFiles = [
  'A1.json','AL.json','AHT.json','ALT.json','ARC.json','AA.json','AW.json',
  'BOR.json','EB.json','UET.json','ET.json','FG.json','GCP.json','GD.json',
  'GM.json','IA.json','JA.json','LA.json','JT1.json','JT2.json','MA.json',
  'MT.json','NI1.json','NI2.json','NWT.json','NT.json','NESPAK1.json',
  'NFC.json','OPF.json','PCSIR1.json','PGECHS1.json','PGECHS2.json','PIA.json',
  'PU.json','REV.json','SF.json','SP.json','VAL.json','WT1.json','WT2.json'
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

    // Add event listener for dropdown
    document.getElementById('scheme-dropdown').addEventListener('change', e => {
        const schemeId = e.target.value;
        if (schemeId) {
            loadSchemeData(schemeId);
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
   OPTIONAL SCHEME BOUNDS
================================ */
function initializeSchemeBounds() {
    schemeBounds.OPF = L.latLngBounds([[31.4173,74.2300],[31.4293,74.2474]]);
    schemeBounds.NWT = L.latLngBounds([[31.4484,74.2447],[31.4590,74.2544]]);
}

/* ===============================
   EXTRACT AD NAME FROM SCHEME DATA
================================ */
function extractADName(geoJsonData) {
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
        return 'Not Available';
    }
    
    // Try to find AD name from properties - using AD_Z4 from your JSON
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
        
        // Sum total dues (Total_Z4 field from your JSON)
        const total = parseFloat(p.Total_Z4) || 0;
        totalDues += total;
        
        // Sum total paid in 2025 only (2025_PAID_ field from your JSON)
        const paid25 = parseFloat(p["2025_PAID_"]) || 0;
        totalPaid2025 += paid25;
        
        // Count plots with Category_Z = "ILLEGAL" (from your JSON)
        const category = String(p.Category_Z || '').trim().toUpperCase();
        if (category === "ILLEGAL") {
            illegalPlots++;
        }
    });
    
    // Extract AD name
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

function calculateTotalsForMultipleSchemes(allDataArray) {
    let totalDues = 0;
    let totalPaid2025 = 0;
    let illegalPlots = 0;
    let adNames = new Set();
    
    allDataArray.forEach(geoJsonData => {
        if (!geoJsonData || !geoJsonData.features) return;
        
        geoJsonData.features.forEach(feature => {
            const p = feature.properties || {};
            
            // Sum total dues
            const total = parseFloat(p.Total_Z4) || 0;
            totalDues += total;
            
            // Sum total paid in 2025 only
            const paid25 = parseFloat(p["2025_PAID_"]) || 0;
            totalPaid2025 += paid25;
            
            // Count plots with Category_Z = "ILLEGAL"
            const category = String(p.Category_Z || '').trim().toUpperCase();
            if (category === "ILLEGAL") {
                illegalPlots++;
            }
            
            // Collect AD names from AD_Z4 field
            if (p.AD_Z4 && String(p.AD_Z4).trim() !== '') {
                adNames.add(String(p.AD_Z4).trim());
            }
        });
    });
    
    // Format AD names for display
    let adNameDisplay = 'Multiple ADs';
    if (adNames.size === 1) {
        adNameDisplay = Array.from(adNames)[0];
    } else if (adNames.size > 1) {
        adNameDisplay = `${adNames.size} ADs`;
    }
    
    currentSchemeData = {
        totalDues: totalDues,
        totalPaid2025: totalPaid2025,
        pendingDues: totalDues - totalPaid2025,
        illegalPlots: illegalPlots,
        adName: adNameDisplay
    };
}

/* ===============================
   UPDATED DISPLAY FUNCTIONS
================================ */
function updateSummaryDisplay() {
    // Format numbers with commas (REMOVED RUPPEE SIGN)
    const formatNumber = (num) => {
        return num.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
    };
    
    // Update all summary boxes (REMOVED RUPPEE SIGN)
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
   LOAD SCHEME DATA (FIXED)
================================ */
function loadSchemeData(schemeId) {
    
    // Clear previous layers
    zoneLayerGroup.clearLayers();
    
    /* ---- COMPLETE ZONE 4 ---- */
    if (schemeId === 'ALL_Z4') {
        let loadedData = [];
        let loaded = 0;
        let totalFiles = zone4JsonFiles.length;

        zone4JsonFiles.forEach(file => {
            fetch(file)
                .then(res => res.json())
                .then(data => {
                    // Add to map
                    L.geoJSON(data, {
                        style: styleFeature,
                        onEachFeature
                    }).addTo(zoneLayerGroup);
                    
                    // Store data for calculations
                    loadedData.push(data);
                    
                    loaded++;
                    if (loaded === totalFiles) {
                        // Calculate totals for all schemes
                        calculateTotalsForMultipleSchemes(loadedData);
                        updateSummaryDisplay();
                        
                        // Fit bounds
                        map.fitBounds(zoneLayerGroup.getBounds(), { padding: [20,20] });
                        document.getElementById('loading').style.display = 'none';
                    }
                })
                .catch(err => {
                    console.error('Error loading', file, err);
                    loaded++;
                    if (loaded === totalFiles) {
                        // Still calculate with what we have
                        calculateTotalsForMultipleSchemes(loadedData);
                        updateSummaryDisplay();
                        document.getElementById('loading').style.display = 'none';
                    }
                });
        });
        return;
    }

    /* ---- SINGLE SCHEME ---- */
    const jsonFile = `${schemeId}.json`;

    fetch(jsonFile)
        .then(res => res.json())
        .then(data => {
            // Calculate totals BEFORE adding to map
            calculateTotals(data);
            
            // Add to map
            currentGeoJsonLayer = L.geoJSON(data, {
                style: styleFeature,
                onEachFeature
            }).addTo(zoneLayerGroup);

            // Update summary display
            updateSummaryDisplay();

            // Fit bounds
            map.fitBounds(
                schemeBounds[schemeId] || currentGeoJsonLayer.getBounds(),
                { padding: [20,20] }
            );

            document.getElementById('loading').style.display = 'none';
        })
        .catch(err => {
            console.error(err);
            alert('Error loading scheme data');
            document.getElementById('loading').style.display = 'none';
            resetSummary();
        });
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
        // Full detailed popup
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