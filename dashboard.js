// ---------- DOM elements ----------
const kpiElements = {
  illegal: document.getElementById('kpiIllegal'),
  schemes: document.getElementById('kpiSchemes'),
  target: document.getElementById('kpiTarget'),
  '2024': document.getElementById('kpi2024'),
  '2025': document.getElementById('kpi2025'),
  payments: document.getElementById('kpiPayments'),
  withdrawals: document.getElementById('kpiWithdrawals')
};

const schemeSelect = document.getElementById('schemeSelect');
const adSelect = document.getElementById('adSelect');
const statusFilter = document.getElementById('statusFilter');
const globalSearch = document.getElementById('globalSearch');
const tableBody = document.getElementById('tableBody');
const loadingEl = document.getElementById('loadingIndicator');
const rowCountSpan = document.getElementById('rowCount');
const expandAllBtn = document.getElementById('expandAllBtn');
const resetFiltersBtn = document.getElementById('resetFilters');
const toggleBarBtn = document.getElementById('toggleBarChart');
const toggleLineBtn = document.getElementById('toggleLineChart');

// Column filter inputs
const filterInputs = document.querySelectorAll('#filterRowTable input');
const sortableHeaders = document.querySelectorAll('.sortable');
const kpiCards = document.querySelectorAll('.kpi-card');

// Chart instances
let barChartInstance = null;
let pieChartInstance = null;
let currentChartType = 'bar';

// Data store
let allData = [];
let filteredData = [];
let columnFilters = {};
let sortConfig = { column: null, direction: 'asc' };
let activeKpiFilter = null;
let expandedRows = new Set();
let allExpanded = false;

// Status colors mapping
const statusColors = {
  'FULL PAYMENT': { class: 'status-full', color: '#2E7D32' },
  'PARTIAL PAYMENT': { class: 'status-partial', color: '#F57C00' },
  'LITIGATION': { class: 'status-litigation', color: '#0B2B4A' },
  'NOT PAID/ NOTICE ISSUED': { class: 'status-notice', color: '#D32F2F' },
  'RESIDENTIAL/USE RESTORED': { class: 'status-restored', color: '#FBC02D' },
  'WITHDRAWAL REQUEST': { class: 'status-withdrawal', color: '#FFB300' }
};

// ---------- Helper functions ----------
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let values = [];
    let current = '', inQuotes = false;
    for (let char of lines[i]) {
      if (char === '"' && !inQuotes) inQuotes = true;
      else if (char === '"' && inQuotes) inQuotes = false;
      else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    values = values.map(v => {
      if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).trim();
      return v.trim();
    });
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] !== undefined ? values[idx] : ''; });
    rows.push(obj);
  }
  return rows;
}

function toNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function formatNumber(num) {
  return num.toLocaleString(undefined, { minimumFractionDigits: 0 });
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>"]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return m;
  });
}

// ---------- Update timestamp ----------
function updateTimestamp() {
  const now = new Date();
  document.getElementById('timestamp').innerHTML = `<i class="far fa-clock"></i> Last updated: ${now.toLocaleTimeString()}`;
}

// ---------- KPI calculations ----------
function calculateKPIs(data) {
  const illegalCount = data.filter(row => String(row.Category_Z4).trim().toUpperCase() === 'ILLEGAL').length;
  const distinctSchemes = new Set(data.map(r => r.Scheme_Z4).filter(v => v && v.trim() !== ''));
  const schemesCount = distinctSchemes.size;
  const targetSum = data.reduce((acc, r) => acc + toNumber(r.Total_Z4), 0);
  const sum2024 = data.reduce((acc, r) => acc + toNumber(r['2024_PAID_Z4']), 0);
  const sum2025 = data.reduce((acc, r) => acc + toNumber(r['2025_PAID_Z4']), 0);
  const paymentStatuses = data.map(r => String(r.PT_STATUS_Z4).trim());
  const paymentsCount = paymentStatuses.filter(s => s === 'FULL PAYMENT' || s === 'PARTIAL PAYMENT').length;
  const withdrawalStatuses = ['RESIDENTIAL/USE RESTORED', 'ABANDONED', 'WITHDRAWAL REQUEST'];
  const withdrawalCount = paymentStatuses.filter(s => withdrawalStatuses.includes(s)).length;

  kpiElements.illegal.textContent = formatNumber(illegalCount);
  kpiElements.schemes.textContent = formatNumber(schemesCount);
  kpiElements.target.textContent = formatNumber(targetSum);
  kpiElements['2024'].textContent = formatNumber(sum2024);
  kpiElements['2025'].textContent = formatNumber(sum2025);
  kpiElements.payments.textContent = formatNumber(paymentsCount);
  kpiElements.withdrawals.textContent = formatNumber(withdrawalCount);
}

// ---------- Update dashboard with filters ----------
function updateDashboard() {
  let data = allData;

  // Scheme filter
  if (schemeSelect.value !== 'ALL') {
    data = data.filter(row => row.Scheme_Z4 === schemeSelect.value);
  }

  // AD filter
  if (adSelect.value !== 'ALL') {
    data = data.filter(row => row.AD_Z4 === adSelect.value);
  }

  // Status filter
  if (statusFilter.value !== 'ALL') {
    data = data.filter(row => row.PT_STATUS_Z4 === statusFilter.value);
  }

  // KPI card click filter
  if (activeKpiFilter) {
    switch(activeKpiFilter) {
      case 'illegal':
        data = data.filter(row => String(row.Category_Z4).trim().toUpperCase() === 'ILLEGAL');
        break;
      case 'payments':
        data = data.filter(row => {
          const status = String(row.PT_STATUS_Z4).trim();
          return status === 'FULL PAYMENT' || status === 'PARTIAL PAYMENT';
        });
        break;
      case 'withdrawals':
        data = data.filter(row => {
          const status = String(row.PT_STATUS_Z4).trim();
          return ['RESIDENTIAL/USE RESTORED', 'ABANDONED', 'WITHDRAWAL REQUEST'].includes(status);
        });
        break;
    }
  }

  filteredData = data;
  calculateKPIs(filteredData);
  updateCharts(filteredData);
  applyColumnFiltersAndRender();
  updateTimestamp();
}

// ---------- Charts ----------
// Fix the chart label to show PKR
function updateCharts(data) {
  // Bar/Line chart: AD vs sum 2025_PAID
  const adMap = new Map();
  data.forEach(row => {
    const ad = row.AD_Z4 ? row.AD_Z4.trim() : '(blank)';
    const val = toNumber(row['2025_PAID_Z4']);
    adMap.set(ad, (adMap.get(ad) || 0) + val);
  });
  const sortedAd = Array.from(adMap.entries()).sort((a, b) => b[1] - a[1]);
  const labelsBar = sortedAd.map(item => item[0] === '' ? 'BLANK' : item[0]);
  const valuesBar = sortedAd.map(item => item[1]);

  // Pie chart: specific statuses
  const allowedStatuses = Object.keys(statusColors);
  const statusCount = new Map();
  data.forEach(row => {
    let status = row.PT_STATUS_Z4 ? row.PT_STATUS_Z4.trim() : '';
    if (allowedStatuses.includes(status)) {
      statusCount.set(status, (statusCount.get(status) || 0) + 1);
    }
  });
  const labelsPie = Array.from(statusCount.keys());
  const valuesPie = Array.from(statusCount.values());
  const backgroundColors = labelsPie.map(label => statusColors[label]?.color || '#999');

  // Destroy previous charts
  if (barChartInstance) barChartInstance.destroy();

  const ctxBar = document.getElementById('barChart').getContext('2d');
  
  // Create chart based on toggle with PKR currency
  barChartInstance = new Chart(ctxBar, {
    type: currentChartType,
    data: {
      labels: labelsBar,
      datasets: [{
        label: 'Recovery 2025 (PKR)', // Changed from ₹ to PKR
        data: valuesBar,
        backgroundColor: currentChartType === 'bar' ? '#1F4A7A' : '#1F4A7A',
        borderColor: '#0B2B4A',
        borderWidth: currentChartType === 'line' ? 3 : 0,
        tension: 0.3,
        fill: currentChartType === 'line' ? false : true,
        pointBackgroundColor: '#0B2B4A',
        pointBorderColor: 'white',
        pointRadius: currentChartType === 'line' ? 4 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== undefined) {
                label += 'PKR ' + context.parsed.y.toLocaleString(); // PKR prefix
              }
              return label;
            }
          }
        }
      },
      scales: { y: { 
        beginAtZero: true, 
        grid: { color: '#DDE5ED' },
        ticks: {
          callback: function(value) {
            return 'PKR ' + value.toLocaleString();
          }
        }
      } }
    }
  });

  // Update pie chart
  if (pieChartInstance) pieChartInstance.destroy();
  const ctxPie = document.getElementById('pieChart').getContext('2d');
  pieChartInstance = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels: labelsPie,
      datasets: [{
        data: valuesPie,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: 'white'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#0B2B4A', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((ctx.raw / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.raw} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// ---------- Table rendering with expandable rows ----------
function applyColumnFiltersAndRender() {
  let dataToDisplay = filteredData;

  // Apply column filters
  Object.keys(columnFilters).forEach(col => {
    const filterValue = columnFilters[col].toLowerCase();
    if (filterValue === '') return;
    
    if (col.includes('Area') || col.includes('Total') || col.includes('PAID')) {
      // Numeric filter (minimum value)
      const minVal = parseFloat(filterValue) || 0;
      dataToDisplay = dataToDisplay.filter(row => toNumber(row[col]) >= minVal);
    } else {
      // Text filter
      dataToDisplay = dataToDisplay.filter(row => {
        const cell = row[col] ? String(row[col]).toLowerCase() : '';
        return cell.includes(filterValue);
      });
    }
  });

  // Global search
  const searchTerm = globalSearch.value.toLowerCase();
  if (searchTerm) {
    dataToDisplay = dataToDisplay.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm)
      );
    });
  }

  // Sorting
  if (sortConfig.column) {
    dataToDisplay.sort((a, b) => {
      let aVal = a[sortConfig.column];
      let bVal = b[sortConfig.column];
      
      if (sortConfig.column.includes('Area') || sortConfig.column.includes('Total') || sortConfig.column.includes('PAID')) {
        aVal = toNumber(aVal);
        bVal = toNumber(bVal);
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  rowCountSpan.textContent = `${dataToDisplay.length} rows`;
  renderTable(dataToDisplay);
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:2rem;">No matching records</td></tr>`;
    return;
  }

  const rows = data.map((row, index) => {
    const rowId = `row-${index}`;
    const isExpanded = expandedRows.has(rowId) || allExpanded;
    const total = toNumber(row.Total_Z4);
    const paid2025 = toNumber(row['2025_PAID_Z4']);
    const progress = total > 0 ? Math.round((paid2025 / total) * 100) : 0;
    const status = row.PT_STATUS_Z4 ? row.PT_STATUS_Z4.trim() : '';
    const statusClass = statusColors[status]?.class || '';

    return `
      <tr id="${rowId}" class="${isExpanded ? 'expanded' : ''}">
        <td class="expand-col">
          <button class="expand-btn" onclick="toggleRow('${rowId}')">
            <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
          </button>
        </td>
        <td>${escapeHtml(row.Plot_Z4 || '')}</td>
        <td>${escapeHtml(row.PHASE_Z4 || '')}</td>
        <td>${escapeHtml(row.Block_Z4 || '')}</td>
        <td>${escapeHtml(row.Scheme_Z4 || '')}</td>
        <td>${formatNumber(toNumber(row.Plot_Area_Z4))}</td>
        <td>${escapeHtml(row.DC_Z4 || '')}</td>
        <td>${formatNumber(total)}</td>
        <td>${formatNumber(toNumber(row['2024_PAID_Z4']))}</td>
        <td>${formatNumber(paid2025)}</td>
        <td class="progress-cell">
          <div class="progress-container">
            <div class="progress-fill" style="width: ${progress}%"></div>
            <span class="progress-text">${progress}%</span>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(status || 'N/A')}</span></td>
      </tr>
      ${isExpanded ? `
      <tr class="remarks-row">
        <td colspan="12" class="remarks-cell">
          <div class="remarks-content">
            <div class="remarks-icon"><i class="fas fa-sticky-note"></i></div>
            <div class="remarks-text">
              <strong>Remarks:</strong> ${escapeHtml(row.REMARKS_Z4 || 'No remarks')}<br>
              <strong>AD:</strong> ${escapeHtml(row.AD_Z4 || 'N/A')} | 
              <strong>Category:</strong> ${escapeHtml(row.Category_Z4 || 'N/A')} | 
              <strong>Extra:</strong> ${escapeHtml(row.EXTRA_Z4 || 'N/A')}
            </div>
          </div>
        </td>
      </tr>
      ` : ''}
    `;
  }).join('');

  tableBody.innerHTML = rows;
}

// Toggle row expansion (global function)
window.toggleRow = function(rowId) {
  if (expandedRows.has(rowId)) {
    expandedRows.delete(rowId);
  } else {
    expandedRows.add(rowId);
  }
  applyColumnFiltersAndRender();
};

// ---------- Populate dropdowns ----------
function populateFilters() {
  const schemeSet = new Set(allData.map(r => r.Scheme_Z4).filter(v => v && v.trim() !== ''));
  const schemes = Array.from(schemeSet).sort();
  schemeSelect.innerHTML = '<option value="ALL">All Schemes</option>' + 
    schemes.map(s => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('');

  const adSet = new Set(allData.map(r => r.AD_Z4).filter(v => v && v.trim() !== ''));
  const ads = Array.from(adSet).sort();
  adSelect.innerHTML = '<option value="ALL">All AD</option>' + 
    ads.map(a => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`).join('');
}

// ---------- Event Listeners ----------
schemeSelect.addEventListener('change', updateDashboard);
adSelect.addEventListener('change', updateDashboard);
statusFilter.addEventListener('change', updateDashboard);
globalSearch.addEventListener('input', applyColumnFiltersAndRender);

// Column filters
filterInputs.forEach(input => {
  input.addEventListener('input', (e) => {
    const col = e.target.dataset.col;
    columnFilters[col] = e.target.value;
    applyColumnFiltersAndRender();
  });
});

// Sorting
sortableHeaders.forEach(header => {
  header.addEventListener('click', () => {
    const col = header.dataset.col;
    if (sortConfig.column === col) {
      sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortConfig.column = col;
      sortConfig.direction = 'asc';
    }
    
    // Update sort icons
    document.querySelectorAll('.sortable i').forEach(i => i.className = 'fas fa-sort');
    header.querySelector('i').className = `fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`;
    
    applyColumnFiltersAndRender();
  });
});

// KPI card clicks
kpiCards.forEach(card => {
  card.addEventListener('click', () => {
    const filter = card.dataset.filter;
    
    if (activeKpiFilter === filter) {
      activeKpiFilter = null;
      card.classList.remove('active-filter');
    } else {
      kpiCards.forEach(c => c.classList.remove('active-filter'));
      activeKpiFilter = filter;
      card.classList.add('active-filter');
    }
    
    updateDashboard();
  });
});

// Chart toggle
toggleBarBtn.addEventListener('click', () => {
  toggleBarBtn.classList.add('active');
  toggleLineBtn.classList.remove('active');
  currentChartType = 'bar';
  updateCharts(filteredData);
});

toggleLineBtn.addEventListener('click', () => {
  toggleLineBtn.classList.add('active');
  toggleBarBtn.classList.remove('active');
  currentChartType = 'line';
  updateCharts(filteredData);
});

// Expand all
expandAllBtn.addEventListener('click', () => {
  allExpanded = !allExpanded;
  expandAllBtn.innerHTML = allExpanded ? 
    '<i class="fas fa-chevron-up"></i> Collapse all' : 
    '<i class="fas fa-chevron-down"></i> Expand all';
  expandedRows.clear();
  applyColumnFiltersAndRender();
});

// Reset filters
resetFiltersBtn.addEventListener('click', () => {
  schemeSelect.value = 'ALL';
  adSelect.value = 'ALL';
  statusFilter.value = 'ALL';
  globalSearch.value = '';
  activeKpiFilter = null;
  kpiCards.forEach(c => c.classList.remove('active-filter'));
  columnFilters = {};
  filterInputs.forEach(input => input.value = '');
  sortConfig = { column: null, direction: 'asc' };
  document.querySelectorAll('.sortable i').forEach(i => i.className = 'fas fa-sort');
  expandedRows.clear();
  allExpanded = false;
  expandAllBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Expand all';
  updateDashboard();
});

// ---------- Load data ----------
async function loadData() {
  loadingEl.classList.remove('hidden');
  try {
    const response = await fetch('zone4_data.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    const cleanText = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;
    allData = parseCSV(cleanText);
    populateFilters();
    updateDashboard();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="12" style="color:#b33; text-align:center;">
      ❌ Failed to load CSV: ${err.message}. Place zone4_data.csv in the same folder.
    </td></tr>`;
    console.error(err);
  } finally {
    loadingEl.classList.add('hidden');
  }
}

// Start
loadData();