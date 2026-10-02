import { DataService } from './dataService.js';
import { formatNumber, formatDate, formatTime } from './utils.js';
import { drawDonutChart, drawBarChart } from './charts.js';

/**
 * Initializes the dashboard module.
 * Called once during application setup.
 */
export function init() {
    // Dashboard is primarily a display screen — no persistent event listeners needed
}

/**
 * Refreshes the dashboard UI with the latest data.
 * Called every time the user navigates to the dashboard.
 * 
 * Engineering Decision: We re-render the entire dashboard on each visit rather than
 * using fine-grained DOM updates. For a dashboard with ~20 DOM elements, full re-render
 * is simpler and fast enough. In a high-frequency update scenario, we'd use virtual DOM diffing.
 */
export function refresh() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const stats = DataService.getDashboardStats();
    const products = DataService.getProducts();
    const activeTrips = DataService.getActiveTrips();
    const recentTransactions = DataService.getTransactions().slice(-10).reverse();

    container.innerHTML = `
        <div class="stats-grid" id="dashboard-stats">
            <div class="stat-card">
                <div class="stat-title">🏢 Godown Stock</div>
                <div class="stat-value">${formatNumber(stats.totalGodown)}</div>
                <div class="stat-label">cases in warehouse</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">🚚 In-Transit</div>
                <div class="stat-value">${formatNumber(stats.totalInTransit)}</div>
                <div class="stat-label">cases on trucks</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">⚠️ Hold Stock</div>
                <div class="stat-value">${formatNumber(stats.totalHold)}</div>
                <div class="stat-label">awaiting resolution</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">🔄 SAP Variance</div>
                <div class="stat-value" style="color: ${stats.totalVariance === 0 ? 'var(--color-success)' : 'var(--color-error)'}">
                    ${stats.totalVariance > 0 ? '+' : ''}${formatNumber(stats.totalVariance)}
                </div>
                <div class="stat-label">${stats.totalVariance === 0 ? 'Fully aligned' : 'drift detected'}</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="card">
                <h3>Stock Distribution by Category</h3>
                <div id="stock-distribution-chart"></div>
            </div>
            <div class="card">
                <h3>Stock State Breakdown</h3>
                <div id="category-chart"></div>
            </div>
        </div>

        <div class="card">
            <h3>Active Trips (${activeTrips.length})</h3>
            <div id="active-trips-list" class="trips-grid">
                ${activeTrips.length === 0 ? '<div class="empty-state">No active trips. Start loading from the Morning Loading screen.</div>' : ''}
                ${activeTrips.map(trip => `
                    <div class="card" style="padding: 12px;">
                        <strong>🚛 ${trip.truckNumber}</strong><br/>
                        <small>Driver: ${trip.driverName}</small><br/>
                        <span class="badge badge-${trip.status === 'in-transit' ? 'warning' : 'info'}">${trip.status}</span>
                        <small> · ${trip.items ? trip.items.length : 0} products loaded</small>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="card">
            <h3>Recent Transactions</h3>
            <div id="recent-transactions" class="timeline">
                ${recentTransactions.length === 0 ? '<div class="empty-state">No transactions yet. Load products to start tracking.</div>' : ''}
                ${recentTransactions.map(tx => {
                    const product = DataService.getProduct(tx.productId);
                    const productName = product ? product.name : tx.productId;
                    const typeColors = { load: '#1a73e8', deliver: '#34a853', short: '#f9ab00', return: '#ea4335', damage: '#ea4335', refused: '#f9ab00', 'shop-closed': '#f9ab00', reconcile: '#1a73e8', 'sap-sync': '#34a853' };
                    return `
                        <div class="timeline-item">
                            <span class="badge" style="background: ${typeColors[tx.type] || '#666'}; color: white;">${tx.type}</span>
                            <strong>${tx.quantity}</strong> × ${productName}
                            <small style="opacity: 0.7; margin-left: 8px;">${formatTime(new Date(tx.timestamp))}</small>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    drawCharts(products);
}

/**
 * Prepares data and draws charts using our zero-dependency canvas library.
 * Engineering Decision: Aggregating data client-side is acceptable for <100 products.
 * For larger datasets, aggregation would happen server-side.
 */
function drawCharts(products) {
    const COLORS = {
        'Toothpaste': '#1a73e8',
        'Toothbrush': '#34a853',
        'Mouthwash': '#f9ab00'
    };

    // Aggregate by category
    const categoryTotals = {};
    products.forEach(p => {
        const cat = p.category;
        if (!categoryTotals[cat]) categoryTotals[cat] = 0;
        categoryTotals[cat] += (p.godownStock + p.inTransitStock + p.holdStock);
    });

    // Donut chart data — needs { label, value, color }
    const donutData = Object.keys(categoryTotals).map(cat => ({
        label: cat,
        value: categoryTotals[cat],
        color: COLORS[cat] || '#999'
    }));

    drawDonutChart('stock-distribution-chart', donutData, {
        centerText: formatNumber(donutData.reduce((s, d) => s + d.value, 0))
    });

    // Bar chart — flatten categories × states into individual bars
    const barData = [];
    Object.keys(COLORS).forEach(cat => {
        let godown = 0, inTransit = 0, hold = 0;
        products.filter(p => p.category === cat).forEach(p => {
            godown += p.godownStock;
            inTransit += p.inTransitStock;
            hold += p.holdStock;
        });
        barData.push({ label: `${cat} (Godown)`, value: godown, color: COLORS[cat] });
        barData.push({ label: `${cat} (Transit)`, value: inTransit, color: COLORS[cat] + '99' });
        barData.push({ label: `${cat} (Hold)`, value: hold, color: '#ea4335' });
    });

    drawBarChart('category-chart', barData);
}

