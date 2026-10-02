/**
 * @file analytics.js
 * @description Analytics & Insights Engine — transforms raw transaction logs into
 * actionable business intelligence.
 * 
 * WHY IT EXISTS: This is what elevates the system from a "digital notebook" to a
 * "decision-support platform." Tracking stock movement is table stakes — any DMS
 * (Bizom, FieldAssist) does that. What creates real value is INSIGHT from the data:
 * 
 * - Which shops have the highest refusal rates? (Stop sending trucks there on Mondays)
 * - Which products get damaged most? (Packaging problem? Handling problem?)
 * - Which drivers have the most shorts? (Accountability signal)
 * - What's the trend of SAP drift over time? (Is the problem getting worse?)
 * - What's the delivery success rate? (Operational KPI)
 * 
 * Engineering Decision: All analytics are computed client-side by mining the transaction
 * log (Event Sourcing payoff). In production, this would be a scheduled ETL pipeline
 * feeding a data warehouse, with a BI tool like Power BI or Looker on top.
 */

import { DataService } from './dataService.js';
import { formatNumber, formatDate, formatTime } from './utils.js';
import { drawDonutChart, drawBarChart } from './charts.js';

export function init() {
    const container = document.getElementById('analytics-content');
    if (!container) return;

    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('analytics-tab-btn')) {
            document.querySelectorAll('.analytics-tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const tab = e.target.dataset.tab;
            document.querySelectorAll('.analytics-panel').forEach(p => p.style.display = 'none');
            const panel = document.getElementById(`panel-${tab}`);
            if (panel) panel.style.display = 'block';
        }
    });
}

export function refresh() {
    const container = document.getElementById('analytics-content');
    if (!container) return;

    const transactions = DataService.getTransactions();
    const products = DataService.getProducts();
    const trips = DataService.getAllTrips();

    // === COMPUTE ALL ANALYTICS ===
    const exceptionAnalysis = computeExceptionAnalytics(transactions, products);
    const productAnalysis = computeProductAnalytics(transactions, products);
    const operationalKPIs = computeOperationalKPIs(transactions, trips, products);
    const driverAnalysis = computeDriverAnalytics(trips, transactions);
    const shopAnalysis = computeShopAnalytics(trips, transactions);

    container.innerHTML = `
        <div class="analytics-tabs tab-bar">
            <button class="analytics-tab-btn tab-btn active" data-tab="kpis">📊 KPIs</button>
            <button class="analytics-tab-btn tab-btn" data-tab="exceptions">⚠️ Exception Analysis</button>
            <button class="analytics-tab-btn tab-btn" data-tab="products">📦 Product Intelligence</button>
            <button class="analytics-tab-btn tab-btn" data-tab="drivers">🚛 Driver Performance</button>
            <button class="analytics-tab-btn tab-btn" data-tab="shops">🏪 Shop Insights</button>
        </div>

        <!-- KPIs Panel -->
        <div id="panel-kpis" class="analytics-panel" style="display: block;">
            ${renderKPIsPanel(operationalKPIs, transactions, products)}
        </div>

        <!-- Exception Analysis Panel -->
        <div id="panel-exceptions" class="analytics-panel" style="display: none;">
            ${renderExceptionPanel(exceptionAnalysis)}
        </div>

        <!-- Product Intelligence Panel -->
        <div id="panel-products" class="analytics-panel" style="display: none;">
            ${renderProductPanel(productAnalysis)}
        </div>

        <!-- Driver Performance Panel -->
        <div id="panel-drivers" class="analytics-panel" style="display: none;">
            ${renderDriverPanel(driverAnalysis)}
        </div>

        <!-- Shop Insights Panel -->
        <div id="panel-shops" class="analytics-panel" style="display: none;">
            ${renderShopPanel(shopAnalysis)}
        </div>
    `;

    // Draw charts after DOM update
    drawAnalyticsCharts(exceptionAnalysis, productAnalysis, operationalKPIs);
}

// ============================================================
// COMPUTATION ENGINES
// Engineering Note: Each function mines the immutable transaction log.
// This is the Event Sourcing payoff — the log IS the analytical dataset.
// ============================================================

/**
 * Exception Analytics — surfaces patterns in returns, damages, refusals.
 * Interview Talking Point: "Instead of just tracking exceptions, we analyze them
 * to find root causes — is it a packaging issue, a route issue, or a shop issue?"
 */
function computeExceptionAnalytics(transactions, products) {
    const exceptions = transactions.filter(t =>
        ['return', 'damage', 'refused', 'shop-closed', 'short'].includes(t.type)
    );

    // By type
    const byType = {};
    exceptions.forEach(ex => {
        if (!byType[ex.type]) byType[ex.type] = { count: 0, totalQty: 0 };
        byType[ex.type].count++;
        byType[ex.type].totalQty += ex.quantity;
    });

    // By product — which products have the most issues?
    const byProduct = {};
    exceptions.forEach(ex => {
        if (!byProduct[ex.productId]) byProduct[ex.productId] = { total: 0, byType: {} };
        byProduct[ex.productId].total += ex.quantity;
        if (!byProduct[ex.productId].byType[ex.type]) byProduct[ex.productId].byType[ex.type] = 0;
        byProduct[ex.productId].byType[ex.type] += ex.quantity;
    });

    // Rank products by exception rate
    const productRanking = Object.entries(byProduct)
        .map(([productId, data]) => {
            const product = products.find(p => p.id === productId);
            return { productId, name: product ? product.name : productId, ...data };
        })
        .sort((a, b) => b.total - a.total);

    // Exception rate = exceptions / total loads
    const totalLoaded = transactions.filter(t => t.type === 'load').reduce((s, t) => s + t.quantity, 0);
    const totalExceptions = exceptions.reduce((s, t) => s + t.quantity, 0);
    const exceptionRate = totalLoaded > 0 ? ((totalExceptions / totalLoaded) * 100).toFixed(1) : 0;

    return { byType, productRanking, exceptionRate, totalExceptions, totalLoaded };
}

/**
 * Product Analytics — stock velocity, turnover signals, category health.
 * Interview Talking Point: "We can identify slow-moving vs fast-moving SKUs
 * to inform replenishment planning — data SAP alone can't provide."
 */
function computeProductAnalytics(transactions, products) {
    const productStats = {};

    products.forEach(p => {
        productStats[p.id] = {
            id: p.id,
            name: p.name,
            category: p.category,
            currentStock: p.godownStock + p.inTransitStock + p.holdStock,
            godownStock: p.godownStock,
            loaded: 0,
            delivered: 0,
            returned: 0,
            damaged: 0,
            shorted: 0,
            deliveryRate: 0,   // delivered / loaded
            damageRate: 0,     // damaged / loaded
            returnRate: 0      // returned / loaded
        };
    });

    transactions.forEach(tx => {
        const stat = productStats[tx.productId];
        if (!stat) return;
        switch (tx.type) {
            case 'load': stat.loaded += tx.quantity; break;
            case 'deliver': stat.delivered += tx.quantity; break;
            case 'return': stat.returned += tx.quantity; break;
            case 'damage': stat.damaged += tx.quantity; break;
            case 'short': stat.shorted += tx.quantity; break;
        }
    });

    // Compute rates
    Object.values(productStats).forEach(s => {
        if (s.loaded > 0) {
            s.deliveryRate = ((s.delivered / s.loaded) * 100).toFixed(1);
            s.damageRate = ((s.damaged / s.loaded) * 100).toFixed(1);
            s.returnRate = ((s.returned / s.loaded) * 100).toFixed(1);
        }
    });

    // Category aggregation
    const categoryStats = {};
    Object.values(productStats).forEach(s => {
        if (!categoryStats[s.category]) {
            categoryStats[s.category] = { loaded: 0, delivered: 0, returned: 0, damaged: 0, shorted: 0 };
        }
        const c = categoryStats[s.category];
        c.loaded += s.loaded;
        c.delivered += s.delivered;
        c.returned += s.returned;
        c.damaged += s.damaged;
        c.shorted += s.shorted;
    });

    const ranking = Object.values(productStats).sort((a, b) => b.delivered - a.delivered);

    return { productStats, categoryStats, ranking };
}

/**
 * Operational KPIs — delivery success rate, fill rate, trip efficiency.
 * Interview Talking Point: "These are the metrics a distribution manager checks
 * every morning — we compute them automatically from the transaction log."
 */
function computeOperationalKPIs(transactions, trips, products) {
    const totalLoaded = transactions.filter(t => t.type === 'load').reduce((s, t) => s + t.quantity, 0);
    const totalDelivered = transactions.filter(t => t.type === 'deliver').reduce((s, t) => s + t.quantity, 0);
    const totalReturned = transactions.filter(t => t.type === 'return').reduce((s, t) => s + t.quantity, 0);
    const totalDamaged = transactions.filter(t => t.type === 'damage').reduce((s, t) => s + t.quantity, 0);
    const totalShorted = transactions.filter(t => t.type === 'short').reduce((s, t) => s + t.quantity, 0);
    const totalRefused = transactions.filter(t => ['refused', 'shop-closed'].includes(t.type)).reduce((s, t) => s + t.quantity, 0);

    const deliverySuccessRate = totalLoaded > 0 ? ((totalDelivered / totalLoaded) * 100).toFixed(1) : 0;
    const fillRate = totalLoaded > 0 ? (((totalLoaded - totalShorted) / totalLoaded) * 100).toFixed(1) : 0;
    const damageRate = totalLoaded > 0 ? ((totalDamaged / totalLoaded) * 100).toFixed(1) : 0;
    const returnRate = totalLoaded > 0 ? (((totalReturned + totalRefused) / totalLoaded) * 100).toFixed(1) : 0;

    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const totalTrips = trips.length;
    const avgDeliveriesPerTrip = completedTrips > 0
        ? (trips.filter(t => t.status === 'completed').reduce((s, t) => s + (t.deliveries?.length || 0), 0) / completedTrips).toFixed(1)
        : 0;

    // Stock utilization — how much of initial stock has been moved?
    const totalInitialStock = products.reduce((s, p) => s + p.sapStock, 0);
    const stockMovementRate = totalInitialStock > 0 ? ((totalLoaded / totalInitialStock) * 100).toFixed(1) : 0;

    return {
        totalLoaded, totalDelivered, totalReturned, totalDamaged, totalShorted, totalRefused,
        deliverySuccessRate, fillRate, damageRate, returnRate,
        completedTrips, totalTrips, avgDeliveriesPerTrip, stockMovementRate
    };
}

/**
 * Driver/Worker Performance — accountability metrics per trip.
 * Interview Talking Point: "We can identify which workers have the most shorts
 * or damages — not to punish, but to target training."
 */
function computeDriverAnalytics(trips, transactions) {
    const driverStats = {};

    trips.forEach(trip => {
        const key = trip.driverName || 'Unknown';
        if (!driverStats[key]) {
            driverStats[key] = {
                name: key,
                trips: 0,
                totalLoaded: 0,
                totalDelivered: 0,
                totalReturned: 0,
                totalDamaged: 0,
                totalShorted: 0,
                deliveries: 0,
                efficiency: 0
            };
        }
        const ds = driverStats[key];
        ds.trips++;
        ds.deliveries += (trip.deliveries?.length || 0);

        // Get transactions for this trip
        const tripTxns = transactions.filter(t => t.tripId === trip.id);
        tripTxns.forEach(tx => {
            switch (tx.type) {
                case 'load': ds.totalLoaded += tx.quantity; break;
                case 'deliver': ds.totalDelivered += tx.quantity; break;
                case 'return': ds.totalReturned += tx.quantity; break;
                case 'damage': ds.totalDamaged += tx.quantity; break;
                case 'short': ds.totalShorted += tx.quantity; break;
            }
        });
    });

    Object.values(driverStats).forEach(ds => {
        ds.efficiency = ds.totalLoaded > 0 ? ((ds.totalDelivered / ds.totalLoaded) * 100).toFixed(1) : 0;
    });

    return Object.values(driverStats).sort((a, b) => b.trips - a.trips);
}

/**
 * Shop Insights — refusal rates, payment patterns per shop.
 * Interview Talking Point: "If Krishna Medicals refuses 40% of deliveries,
 * we should call ahead before sending a truck."
 */
function computeShopAnalytics(trips, transactions) {
    const shopStats = {};

    trips.forEach(trip => {
        (trip.deliveries || []).forEach(del => {
            const shopName = del.shopName || 'Unknown';
            if (!shopStats[shopName]) {
                shopStats[shopName] = {
                    name: shopName,
                    totalDeliveries: 0,
                    successful: 0,
                    refused: 0,
                    partial: 0,
                    shopClosed: 0,
                    totalPayment: 0,
                    paymentModes: {}
                };
            }
            const ss = shopStats[shopName];
            ss.totalDeliveries++;
            if (del.status === 'delivered') ss.successful++;
            else if (del.status === 'refused') ss.refused++;
            else if (del.status === 'partial') ss.partial++;
            else if (del.status === 'shop-closed') ss.shopClosed++;

            const payment = del.payment?.amount || 0;
            ss.totalPayment += payment;
            const mode = del.payment?.mode || del.paymentMode || 'unknown';
            if (!ss.paymentModes[mode]) ss.paymentModes[mode] = 0;
            ss.paymentModes[mode] += payment;
        });
    });

    Object.values(shopStats).forEach(ss => {
        ss.refusalRate = ss.totalDeliveries > 0
            ? (((ss.refused + ss.shopClosed) / ss.totalDeliveries) * 100).toFixed(1)
            : 0;
        ss.successRate = ss.totalDeliveries > 0
            ? ((ss.successful / ss.totalDeliveries) * 100).toFixed(1)
            : 0;
    });

    return Object.values(shopStats).sort((a, b) => b.totalDeliveries - a.totalDeliveries);
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

function renderKPIsPanel(kpis, transactions, products) {
    const hasData = transactions.length > 0;

    if (!hasData) {
        return `
            <div class="empty-state" style="padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
                <h3>No data yet</h3>
                <p>Start by loading products onto a truck from the <a href="#loading">Morning Loading</a> screen. Analytics will appear as you perform operations.</p>
            </div>
        `;
    }

    return `
        <div class="stats-grid" style="margin-top: 1rem;">
            <div class="stat-card" style="border-left: 4px solid var(--success);">
                <div class="stat-title">Delivery Success Rate</div>
                <div class="stat-value" style="color: var(--success);">${kpis.deliverySuccessRate}%</div>
                <div class="stat-label">${formatNumber(kpis.totalDelivered)} of ${formatNumber(kpis.totalLoaded)} cases</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid var(--primary);">
                <div class="stat-title">Fill Rate</div>
                <div class="stat-value" style="color: var(--primary);">${kpis.fillRate}%</div>
                <div class="stat-label">Orders filled without shorts</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid var(--error);">
                <div class="stat-title">Damage Rate</div>
                <div class="stat-value" style="color: var(--error);">${kpis.damageRate}%</div>
                <div class="stat-label">${formatNumber(kpis.totalDamaged)} cases damaged</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid var(--warning);">
                <div class="stat-title">Return Rate</div>
                <div class="stat-value" style="color: var(--warning);">${kpis.returnRate}%</div>
                <div class="stat-label">${formatNumber(kpis.totalReturned + kpis.totalRefused)} cases returned</div>
            </div>
        </div>

        <div class="stats-grid" style="margin-top: 1rem;">
            <div class="stat-card">
                <div class="stat-title">Trips</div>
                <div class="stat-value">${kpis.totalTrips}</div>
                <div class="stat-label">${kpis.completedTrips} completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Avg Stops/Trip</div>
                <div class="stat-value">${kpis.avgDeliveriesPerTrip}</div>
                <div class="stat-label">delivery stops per trip</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Stock Utilized</div>
                <div class="stat-value">${kpis.stockMovementRate}%</div>
                <div class="stat-label">of initial stock loaded</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Total Shorts</div>
                <div class="stat-value" style="color: var(--warning);">${formatNumber(kpis.totalShorted)}</div>
                <div class="stat-label">cases under-delivered</div>
            </div>
        </div>

        <div class="card" style="margin-top: 1rem;">
            <h3>📈 Operations Flow</h3>
            <div id="kpi-flow-chart"></div>
        </div>
    `;
}

function renderExceptionPanel(data) {
    if (data.totalExceptions === 0) {
        return `<div class="empty-state" style="padding: 3rem;"><div style="font-size: 3rem; margin-bottom: 1rem;">✅</div><h3>No exceptions recorded</h3><p>Great! No returns, damages, shorts, or refusals yet.</p></div>`;
    }

    const typeLabels = { return: '↩️ Returns', damage: '💥 Damages', refused: '🚫 Refused', 'shop-closed': '🔒 Shop Closed', short: '📉 Shorts' };
    const typeColors = { return: '#f9ab00', damage: '#ea4335', refused: '#e8710a', 'shop-closed': '#9e9e9e', short: '#1a73e8' };

    return `
        <div class="stats-grid" style="margin-top: 1rem;">
            <div class="stat-card" style="border-left: 4px solid var(--error);">
                <div class="stat-title">Total Exceptions</div>
                <div class="stat-value" style="color: var(--error);">${formatNumber(data.totalExceptions)}</div>
                <div class="stat-label">cases flagged</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid var(--warning);">
                <div class="stat-title">Exception Rate</div>
                <div class="stat-value" style="color: var(--warning);">${data.exceptionRate}%</div>
                <div class="stat-label">of loaded stock</div>
            </div>
        </div>

        <div class="card" style="margin-top: 1rem;">
            <h3>Exceptions by Type</h3>
            <div id="exception-donut-chart"></div>
            <div style="margin-top: 1rem;">
                ${Object.entries(data.byType).map(([type, val]) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                        <span>${typeLabels[type] || type}</span>
                        <span><strong>${val.totalQty}</strong> cases (${val.count} events)</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="card" style="margin-top: 1rem;">
            <h3>🔴 Most Problematic Products</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.85rem;">
                Products ranked by total exception volume — investigate top items for root cause.
            </p>
            <table class="data-table">
                <thead><tr>
                    <th>Product</th><th>Total Exceptions</th><th>Returns</th><th>Damages</th><th>Shorts</th><th>Refused</th>
                </tr></thead>
                <tbody>
                    ${data.productRanking.slice(0, 10).map(p => `
                        <tr>
                            <td><strong>${p.name}</strong></td>
                            <td style="color: var(--error); font-weight: 600;">${p.total}</td>
                            <td>${p.byType['return'] || 0}</td>
                            <td>${p.byType['damage'] || 0}</td>
                            <td>${p.byType['short'] || 0}</td>
                            <td>${(p.byType['refused'] || 0) + (p.byType['shop-closed'] || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderProductPanel(data) {
    const ranking = data.ranking;
    if (ranking.length === 0 || ranking[0].loaded === 0) {
        return `<div class="empty-state" style="padding: 3rem;"><div style="font-size: 3rem;">📦</div><h3>No product movement data yet</h3></div>`;
    }

    return `
        <div class="card" style="margin-top: 1rem;">
            <h3>Product Performance Scorecard</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.85rem;">
                Each product scored on delivery efficiency, damage rate, and return rate.
            </p>
            <table class="data-table">
                <thead><tr>
                    <th>Product</th><th>Category</th><th>Loaded</th><th>Delivered</th>
                    <th>Delivery %</th><th>Damage %</th><th>Return %</th><th>Score</th>
                </tr></thead>
                <tbody>
                    ${ranking.filter(p => p.loaded > 0).map(p => {
                        const score = (parseFloat(p.deliveryRate) - parseFloat(p.damageRate) - parseFloat(p.returnRate)).toFixed(0);
                        const scoreColor = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--error)';
                        return `
                        <tr>
                            <td><strong>${p.name}</strong><br><small style="color:var(--text-secondary)">${p.id}</small></td>
                            <td><span class="badge badge-info">${p.category}</span></td>
                            <td>${p.loaded}</td>
                            <td>${p.delivered}</td>
                            <td style="color: var(--success); font-weight: 600;">${p.deliveryRate}%</td>
                            <td style="color: ${parseFloat(p.damageRate) > 5 ? 'var(--error)' : 'var(--text-secondary)'};">${p.damageRate}%</td>
                            <td style="color: ${parseFloat(p.returnRate) > 5 ? 'var(--warning)' : 'var(--text-secondary)'};">${p.returnRate}%</td>
                            <td style="color: ${scoreColor}; font-weight: 700; font-size: 1.1rem;">${score}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="card" style="margin-top: 1rem;">
            <h3>Category Comparison</h3>
            <div id="category-comparison-chart"></div>
        </div>

        <div class="card" style="margin-top: 1rem;">
            <h3>🔍 Stock Health Indicators</h3>
            ${ranking.filter(p => p.loaded > 0).map(p => {
                const pct = parseFloat(p.deliveryRate);
                const barColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';
                return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 0.85rem; font-weight: 500;">${p.name}</span>
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">${p.deliveryRate}% delivered</span>
                    </div>
                    <div style="background: var(--border-color); border-radius: 4px; height: 8px; overflow: hidden;">
                        <div style="background: ${barColor}; height: 100%; width: ${p.deliveryRate}%; border-radius: 4px; transition: width 0.5s ease;"></div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderDriverPanel(drivers) {
    if (drivers.length === 0) {
        return `<div class="empty-state" style="padding: 3rem;"><div style="font-size: 3rem;">🚛</div><h3>No driver data yet</h3><p>Complete some trips to see driver performance metrics.</p></div>`;
    }

    return `
        <div class="card" style="margin-top: 1rem;">
            <h3>Driver / Worker Performance</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.85rem;">
                Accountability metrics per driver — identify training needs, not just performance gaps.
            </p>
            <table class="data-table">
                <thead><tr>
                    <th>Driver</th><th>Trips</th><th>Stops</th><th>Loaded</th><th>Delivered</th>
                    <th>Shorts</th><th>Damages</th><th>Efficiency</th>
                </tr></thead>
                <tbody>
                    ${drivers.map(d => {
                        const effColor = d.efficiency >= 80 ? 'var(--success)' : d.efficiency >= 50 ? 'var(--warning)' : 'var(--error)';
                        return `
                        <tr>
                            <td><strong>${d.name}</strong></td>
                            <td>${d.trips}</td>
                            <td>${d.deliveries}</td>
                            <td>${formatNumber(d.totalLoaded)}</td>
                            <td>${formatNumber(d.totalDelivered)}</td>
                            <td style="color: var(--warning);">${d.totalShorted}</td>
                            <td style="color: var(--error);">${d.totalDamaged}</td>
                            <td style="color: ${effColor}; font-weight: 700; font-size: 1.1rem;">${d.efficiency}%</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderShopPanel(shops) {
    if (shops.length === 0) {
        return `<div class="empty-state" style="padding: 3rem;"><div style="font-size: 3rem;">🏪</div><h3>No shop data yet</h3><p>Record deliveries to see shop-level insights.</p></div>`;
    }

    return `
        <div class="card" style="margin-top: 1rem;">
            <h3>Shop Delivery Insights</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.85rem;">
                Identify problematic shops — high refusal rates signal route planning issues or relationship problems.
            </p>
            <table class="data-table">
                <thead><tr>
                    <th>Shop</th><th>Total Visits</th><th>Successful</th><th>Refused</th>
                    <th>Closed</th><th>Success Rate</th><th>Refusal Rate</th><th>Revenue</th>
                </tr></thead>
                <tbody>
                    ${shops.map(s => {
                        const refColor = parseFloat(s.refusalRate) > 20 ? 'var(--error)' : 'var(--text-secondary)';
                        return `
                        <tr>
                            <td><strong>${s.name}</strong></td>
                            <td>${s.totalDeliveries}</td>
                            <td style="color: var(--success);">${s.successful}</td>
                            <td style="color: var(--error);">${s.refused}</td>
                            <td>${s.shopClosed}</td>
                            <td style="color: var(--success); font-weight: 600;">${s.successRate}%</td>
                            <td style="color: ${refColor}; font-weight: 600;">${s.refusalRate}%</td>
                            <td>₹${formatNumber(s.totalPayment)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// CHART RENDERING
// ============================================================

function drawAnalyticsCharts(exceptionData, productData, kpis) {
    // Exception donut chart
    if (exceptionData.totalExceptions > 0) {
        const typeColors = { return: '#f9ab00', damage: '#ea4335', refused: '#e8710a', 'shop-closed': '#9e9e9e', short: '#1a73e8' };
        const donutData = Object.entries(exceptionData.byType).map(([type, val]) => ({
            label: type, value: val.totalQty, color: typeColors[type] || '#666'
        }));
        drawDonutChart('exception-donut-chart', donutData, { centerText: `${exceptionData.totalExceptions}` });
    }

    // KPI flow bar chart
    if (kpis.totalLoaded > 0) {
        const flowData = [
            { label: 'Loaded', value: kpis.totalLoaded, color: '#1a73e8' },
            { label: 'Delivered', value: kpis.totalDelivered, color: '#34a853' },
            { label: 'Returned', value: kpis.totalReturned, color: '#f9ab00' },
            { label: 'Damaged', value: kpis.totalDamaged, color: '#ea4335' },
            { label: 'Shorted', value: kpis.totalShorted, color: '#e8710a' },
            { label: 'Refused', value: kpis.totalRefused, color: '#9e9e9e' }
        ];
        drawBarChart('kpi-flow-chart', flowData);
    }

    // Category comparison chart
    const catStats = productData.categoryStats;
    if (Object.keys(catStats).length > 0) {
        const catColors = { 'Toothpaste': '#1a73e8', 'Toothbrush': '#34a853', 'Mouthwash': '#f9ab00' };
        const catData = Object.entries(catStats).map(([cat, s]) => ({
            label: `${cat} (${s.delivered}/${s.loaded})`,
            value: s.delivered,
            color: catColors[cat] || '#999'
        }));
        drawBarChart('category-comparison-chart', catData);
    }
}
