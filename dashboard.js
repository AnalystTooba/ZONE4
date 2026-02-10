// Global variables
let allData = [];
let filteredData = [];
let currentFilters = {
    AD_Z4: [],
    Scheme_Z4: [],
    PT_STATUS_: [],
    Category_Z: []
};
let currentPage = 1;
let rowsPerPage = 50;
let sortColumn = null;
let sortDirection = 'asc';
let statusChart = null;
let schemesChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Starting Zone 4 Dashboard...');
    updateLoadingStatus('Loading TSV data...');
    loadTSVData();
});

// Load TSV data from csv.csv file
async function loadTSVData() {
    try {
        console.log('Loading TSV data from csv.csv...');
        
        const response = await fetch('csv.csv');
        if (!response.ok) {
            throw new Error(`Failed to load csv.csv file. Status: ${response.status}`);
        }
        
        const tsvText = await response.text();
        console.log('TSV loaded successfully');
        
        parseTSVData(tsvText);
        initializeFilters();
        updateDashboard();
        
        document.getElementById('loadingOverlay').style.display = 'none';
        console.log(`✅ Loaded ${allData.length} records from TSV`);
        
    } catch (error) {
        console.error('Error loading TSV:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        alert(`Error loading data: ${error.message}\n\nPlease make sure csv.csv file exists in the same folder.`);
    }
}

// Parse TSV data (tab-separated)
function parseTSVData(tsvText) {
    console.log('Parsing TSV data...');
    
    const lines = tsvText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        throw new Error('TSV file is empty');
    }
    
    // Parse headers
    const headers = lines[0].replace(/^\uFEFF/, '').split('\t');
    console.log('Headers:', headers);
    
    allData = [];
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.split('\t');
        
        if (values.length !== headers.length) {
            console.warn(`Skipping row ${i}: column count mismatch`);
            continue;
        }
        
        const row = {};
        let hasData = false;
        
        // Map values to headers
        headers.forEach((header, index) => {
            let value = values[index] || '';
            value = value.trim();
            
            // Check if this cell has data
            if (value !== '') {
                hasData = true;
            }
            
            // Handle numeric fields
            if (['Total_Z4', '2024_PAID_', '2025_PAID_', 'Pending_Z4', 'DC_Z4', 'FID', 'GISSr_', 'ID_Z4', 'Plot_Z4'].includes(header)) {
                const cleanValue = value.replace(/,/g, '');
                const numValue = parseFloat(cleanValue);
                row[header] = isNaN(numValue) ? 0 : numValue;
            } else {
                row[header] = value;
            }
        });
        
        if (!hasData) {
            continue;
        }
        
        // Ensure required fields exist
        if (!row['PT_STATUS_'] || row['PT_STATUS_'] === '') {
            row['PT_STATUS_'] = 'Unknown';
        }
        
        if (!row['Category_Z'] || row['Category_Z'] === '') {
            row['Category_Z'] = 'OTHER';
        }
        
        if (!row['AD_Z4'] || row['AD_Z4'] === '') {
            row['AD_Z4'] = 'Unknown AD';
        }
        
        // Auto-number Plot_Z4 if missing
        if (!row['Plot_Z4'] || row['Plot_Z4'] === 0) {
            row['Plot_Z4'] = allData.length + 1;
        }
        
        // Calculate Pending if missing
        if ((!row['Pending_Z4'] || row['Pending_Z4'] === 0) && row['Total_Z4']) {
            const paid2024 = row['2024_PAID_'] || 0;
            const paid2025 = row['2025_PAID_'] || 0;
            row['Pending_Z4'] = Math.max(0, row['Total_Z4'] - paid2024 - paid2025);
        }
        
        allData.push(row);
    }
    
    filteredData = [...allData];
    
    // Show statistics
    const totalDues = allData.reduce((sum, item) => sum + (item.Total_Z4 || 0), 0);
    const uniqueSchemes = [...new Set(allData.map(item => item.Scheme_Z4))].filter(Boolean).length;
    const uniqueADs = [...new Set(allData.map(item => item.AD_Z4))].filter(Boolean).length;
    
    console.log(`Parsed ${allData.length} records from TSV`);
    console.log(`Total Dues: ${totalDues.toLocaleString('en-IN')}`);
    console.log(`Unique Schemes: ${uniqueSchemes}`);
    console.log(`Unique ADs: ${uniqueADs}`);
}

// Initialize filter options
function initializeFilters() {
    console.log('Initializing filters...');
    
    // Get unique values from ALL data
    const uniqueADs = [...new Set(allData.map(item => item.AD_Z4).filter(Boolean))].sort();
    const uniqueSchemes = [...new Set(allData.map(item => item.Scheme_Z4).filter(Boolean))].sort();
    const uniqueStatuses = [...new Set(allData.map(item => item.PT_STATUS_).filter(Boolean))].sort();
    
    console.log(`Found ${uniqueADs.length} ADs, ${uniqueSchemes.length} schemes, ${uniqueStatuses.length} statuses`);
    
    // Populate AD filter
    const adFilterContainer = document.getElementById('adFilter');
    adFilterContainer.innerHTML = '';
    uniqueADs.forEach(ad => {
        const div = document.createElement('div');
        div.className = 'filter-option';
        div.innerHTML = `<input type="checkbox" class="filter-checkbox"> ${ad}`;
        div.onclick = () => toggleFilter('AD_Z4', ad);
        adFilterContainer.appendChild(div);
    });
    
    // Populate Scheme filter
    const schemeFilterContainer = document.getElementById('schemeFilter');
    schemeFilterContainer.innerHTML = '';
    uniqueSchemes.forEach(scheme => {
        const div = document.createElement('div');
        div.className = 'filter-option';
        div.innerHTML = `<input type="checkbox" class="filter-checkbox"> ${scheme}`;
        div.onclick = () => toggleFilter('Scheme_Z4', scheme);
        schemeFilterContainer.appendChild(div);
    });
    
    // Populate Status filter
    const statusFilterContainer = document.getElementById('statusFilter');
    statusFilterContainer.innerHTML = '';
    uniqueStatuses.forEach(status => {
        const div = document.createElement('div');
        div.className = 'filter-option';
        div.innerHTML = `<input type="checkbox" class="filter-checkbox"> ${status}`;
        div.onclick = () => toggleFilter('PT_STATUS_', status);
        statusFilterContainer.appendChild(div);
    });
    
    updateFilterCounts();
}

// Update loading status
function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loadingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Toggle filter selection
function toggleFilter(filterType, value) {
    const checkbox = event.target.querySelector('.filter-checkbox') || event.target;
    
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        if (!currentFilters[filterType].includes(value)) {
            currentFilters[filterType].push(value);
        }
    } else {
        const index = currentFilters[filterType].indexOf(value);
        if (index > -1) {
            currentFilters[filterType].splice(index, 1);
        }
    }
    
    updateFilterCounts();
}

// Update filter counts
function updateFilterCounts() {
    document.getElementById('adCount').textContent = currentFilters.AD_Z4.length;
    document.getElementById('schemeCount').textContent = currentFilters.Scheme_Z4.length;
    document.getElementById('statusCount').textContent = currentFilters.PT_STATUS_.length;
    document.getElementById('categoryCount').textContent = currentFilters.Category_Z.length;
}

// Apply filters
function applyFilters() {
    console.log('Applying filters...', currentFilters);
    
    filteredData = allData.filter(item => {
        // Check AD filter
        if (currentFilters.AD_Z4.length > 0 && !currentFilters.AD_Z4.includes(item.AD_Z4)) {
            return false;
        }
        
        // Check Scheme filter
        if (currentFilters.Scheme_Z4.length > 0 && !currentFilters.Scheme_Z4.includes(item.Scheme_Z4)) {
            return false;
        }
        
        // Check Status filter
        if (currentFilters.PT_STATUS_.length > 0 && !currentFilters.PT_STATUS_.includes(item.PT_STATUS_)) {
            return false;
        }
        
        // Check Category filter
        if (currentFilters.Category_Z.length > 0 && !currentFilters.Category_Z.includes(item.Category_Z)) {
            return false;
        }
        
        return true;
    });
    
    console.log(`Filtered ${filteredData.length} records (from ${allData.length})`);
    currentPage = 1;
    updateDashboard();
}

// Clear all filters
function clearFilters() {
    console.log('Clearing all filters');
    
    currentFilters = {
        AD_Z4: [],
        Scheme_Z4: [],
        PT_STATUS_: [],
        Category_Z: []
    };
    
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    filteredData = [...allData];
    currentPage = 1;
    updateFilterCounts();
    updateDashboard();
}

// Update the entire dashboard
function updateDashboard() {
    updateSummaryCards();
    updateCharts();
    updateTable();
    document.getElementById('totalRecords').textContent = allData.length.toLocaleString();
}

// Update summary cards
function updateSummaryCards() {
    const totalDues = filteredData.reduce((sum, item) => sum + (item.Total_Z4 || 0), 0);
    const paid2025 = filteredData.reduce((sum, item) => sum + (item['2025_PAID_'] || 0), 0);
    const paid2024 = filteredData.reduce((sum, item) => sum + (item['2024_PAID_'] || 0), 0);
    const pendingDues = filteredData.reduce((sum, item) => sum + (item.Pending_Z4 || 0), 0);
    const illegalPlots = filteredData.filter(item => item.Category_Z === 'ILLEGAL').length;

    // Format numbers
    const formatNumber = (num) => {
        return num.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
    };

    document.getElementById('totalDues').textContent = formatNumber(totalDues);
    document.getElementById('paid2025').textContent = formatNumber(paid2025);
    document.getElementById('paid2024').textContent = formatNumber(paid2024);
    document.getElementById('pendingDues').textContent = formatNumber(pendingDues);
    document.getElementById('totalPlots').textContent = filteredData.length.toLocaleString('en-IN');
    document.getElementById('illegalPlots').textContent = illegalPlots.toLocaleString('en-IN');
}

// Update charts
function updateCharts() {
    updateStatusChart();
    updateSchemesChart();
}

// Update status distribution chart
function updateStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    // Count status occurrences
    const statusCounts = {};
    filteredData.forEach(item => {
        const status = item.PT_STATUS_ || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Sort by count (descending)
    const sortedStatuses = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedStatuses.map(item => item[0]);
    const data = sortedStatuses.map(item => item[1]);

    // Colors for different statuses
    const statusColors = {
        'FULL PAYMENT': '#48bb78',
        'PARTIAL PAYMENT': '#ed8936',
        'NOT PAID/ NOTICE ISSUED': '#f56565',
        'ABANDONED': '#9f7aea',
        'PERM COMMERCIAL': '#4299e1',
        'RESIDENTIAL/USE RESTORED': '#68d391',
        'UNDER CONSTRUCTION': '#f6ad55',
        'OTHER': '#a0aec0',
        'Unknown': '#cbd5e0'
    };

    const backgroundColors = labels.map(label => statusColors[label] || '#cbd5e0');

    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update schemes chart
function updateSchemesChart() {
    const ctx = document.getElementById('schemesChart').getContext('2d');
    
    // Calculate total dues by scheme
    const schemeTotals = {};
    filteredData.forEach(item => {
        const scheme = item.Scheme_Z4;
        const total = item.Total_Z4 || 0;
        schemeTotals[scheme] = (schemeTotals[scheme] || 0) + total;
    });

    // Get top schemes
    const topSchemes = Object.entries(schemeTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const labels = topSchemes.map(item => {
        const name = item[0];
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
    });
    const data = topSchemes.map(item => item[1]);

    if (schemesChart) {
        schemesChart.destroy();
    }

    schemesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Dues',
                data: data,
                backgroundColor: 'rgba(66, 153, 225, 0.7)',
                borderColor: 'rgba(66, 153, 225, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 10000000) {
                                return (value / 10000000).toFixed(1) + ' Cr';
                            } else if (value >= 100000) {
                                return (value / 100000).toFixed(1) + ' L';
                            }
                            return value;
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Update data table
function updateTable() {
    rowsPerPage = parseInt(document.getElementById('rows-per-page').value);
    
    // Sort data if needed
    if (sortColumn !== null) {
        filteredData.sort((a, b) => {
            const valA = getCellValue(a, sortColumn);
            const valB = getCellValue(b, sortColumn);
            
            if (typeof valA === 'string') {
                return sortDirection === 'asc' 
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            } else {
                return sortDirection === 'asc' 
                    ? valA - valB
                    : valB - valA;
            }
        });
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    // Populate table
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    pageData.forEach(item => {
        const row = document.createElement('tr');
        
        // Get status class
        let statusClass = 'status-other';
        if (item.PT_STATUS_ === 'FULL PAYMENT') statusClass = 'status-paid';
        else if (item.PT_STATUS_ === 'PARTIAL PAYMENT') statusClass = 'status-partial';
        else if (item.PT_STATUS_ === 'NOT PAID/ NOTICE ISSUED') statusClass = 'status-not-paid';
        else if (item.PT_STATUS_ === 'ABANDONED') statusClass = 'status-abandoned';
        else if (item.PT_STATUS_ === 'PERM COMMERCIAL') statusClass = 'status-perm-comm';
        else if (item.PT_STATUS_ === 'RESIDENTIAL/USE RESTORED') statusClass = 'status-paid';

        row.innerHTML = `
            <td>${item.Plot_Z4 || ''}</td>
            <td>${item.Scheme_Z4 || ''}</td>
            <td>${item.Block_Z4 || ''}</td>
            <td>${item.AD_Z4 || ''}</td>
            <td>${formatCurrency(item.Total_Z4 || 0)}</td>
            <td>${formatCurrency(item['2024_PAID_'] || 0)}</td>
            <td>${formatCurrency(item['2025_PAID_'] || 0)}</td>
            <td>${formatCurrency(item.Pending_Z4 || 0)}</td>
            <td><span class="status-badge ${statusClass}">${item.PT_STATUS_ || ''}</span></td>
            <td>${item.Category_Z || ''}</td>
        `;
        tbody.appendChild(row);
    });

    // Update pagination info
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Disable/enable pagination buttons
    const prevBtn = document.querySelector('.page-btn:nth-child(1)');
    const nextBtn = document.querySelector('.page-btn:nth-child(3)');
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// Helper function to get cell value for sorting
function getCellValue(item, columnIndex) {
    switch(columnIndex) {
        case 0: return item.Plot_Z4;
        case 1: return item.Scheme_Z4;
        case 2: return item.Block_Z4;
        case 3: return item.AD_Z4;
        case 4: return item.Total_Z4;
        case 5: return item['2024_PAID_'];
        case 6: return item['2025_PAID_'];
        case 7: return item.Pending_Z4;
        case 8: return item.PT_STATUS_;
        case 9: return item.Category_Z;
        default: return '';
    }
}

// Sort table
function sortTable(columnIndex) {
    if (sortColumn === columnIndex) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = columnIndex;
        sortDirection = 'asc';
    }
    updateTable();
}

// Filter table by search
function filterTable() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    if (!searchTerm) {
        applyFilters();
        return;
    }

    filteredData = allData.filter(item => {
        return Object.values(item).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    
    currentPage = 1;
    updateDashboard();
}

// Change page
function changePage(delta) {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updateTable();
    }
}

// Format currency
function formatCurrency(amount) {
    return amount.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
}

// Export filtered data
function exportFilteredData() {
    // Convert filtered data to CSV
    const headers = ['Plot_Z4', 'Scheme_Z4', 'Block_Z4', 'AD_Z4', 'Total_Z4', '2024_PAID_', '2025_PAID_', 'Pending_Z4', 'PT_STATUS_', 'Category_Z'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map(item => headers.map(header => {
            const value = item[header] || '';
            return `"${value}"`;
        }).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zone4_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`Exported ${filteredData.length} records`);
}

// Refresh data
function refreshData() {
    console.log('Refreshing data...');
    document.getElementById('loadingOverlay').style.display = 'flex';
    updateLoadingStatus('Refreshing TSV data...');
    
    setTimeout(() => {
        loadTSVData();
    }, 500);
}

// Make functions globally available
window.toggleFilter = toggleFilter;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.sortTable = sortTable;
window.filterTable = filterTable;
window.changePage = changePage;
window.updateCharts = updateCharts;
window.exportFilteredData = exportFilteredData;
window.refreshData = refreshData;