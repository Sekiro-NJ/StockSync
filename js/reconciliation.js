import { DataService } from './dataService.js';
import { formatNumber, showToast } from './utils.js';

export function init() {
    const container = document.getElementById('reconciliation-content');
    if (!container) return;

    container.addEventListener('click', (e) => {
        if (e.target.id === 'btn-sync-sap') {
            handleSyncSAP();
        } else if (e.target.id === 'btn-export-csv') {
            handleExportCSV();
        }
    });
}

export function refresh() {
    const container = document.getElementById('reconciliation-content');
    if (!container) return;

    const report = DataService.getReconciliationReport();
    
    // Determine alignment percentage (rough heuristic)
    const totalPhysical = report.totalPhysical;
    const alignment = totalPhysical === 0 ? 100 : Math.max(0, 100 - (Math.abs(report.totalVariance) / totalPhysical * 100)).toFixed(1);

    container.innerHTML = `
        <div class="variance-summary" style="display: flex; gap: 20px; margin-bottom: 30px;">
            <div class="card" style="flex: 1; padding: 20px; background: #e8f5e9; text-align: center; border-radius: 8px;">
                <h3>Total Physical Stock</h3>
                <h2 style="margin: 10px 0;">${formatNumber(report.totalPhysical)}</h2>
                <small>Godown: ${formatNumber(report.totalGodown)} | Transit: ${formatNumber(report.totalInTransit)} | Hold: ${formatNumber(report.totalHold)}</small>
            </div>
            <div class="card" style="flex: 1; padding: 20px; background: #e3f2fd; text-align: center; border-radius: 8px;">
                <h3>SAP Recorded Stock</h3>
                <h2 style="margin: 10px 0;">${formatNumber(report.totalSAP)}</h2>
            </div>
            <div class="card" style="flex: 1; padding: 20px; background: ${report.totalVariance === 0 ? '#e8f5e9' : '#ffebee'}; text-align: center; border-radius: 8px;">
                <h3>Variance</h3>
                <h2 style="margin: 10px 0; color: ${report.totalVariance === 0 ? 'green' : 'red'};">
                    ${report.totalVariance}
                </h2>
            </div>
            <div class="card" style="flex: 1; padding: 20px; background: #fff3e0; text-align: center; border-radius: 8px;">
                <h3>Alignment</h3>
                <h2 style="margin: 10px 0;">${alignment}%</h2>
            </div>
        </div>

        <div class="card" style="margin-bottom: 20px; padding: 15px;">
            <h3>Today's Activity</h3>
            <div style="display: flex; gap: 15px; margin-top: 10px;">
                <div class="stat-card" style="flex:1; text-align:center;"><div class="stat-value">${report.todayTransactionSummary.loads}</div><div class="stat-label">Loaded</div></div>
                <div class="stat-card" style="flex:1; text-align:center;"><div class="stat-value">${report.todayTransactionSummary.deliveries}</div><div class="stat-label">Delivered</div></div>
                <div class="stat-card" style="flex:1; text-align:center;"><div class="stat-value">${report.todayTransactionSummary.returns}</div><div class="stat-label">Returns</div></div>
                <div class="stat-card" style="flex:1; text-align:center;"><div class="stat-value">${report.todayTransactionSummary.damages}</div><div class="stat-label">Damages</div></div>
                <div class="stat-card" style="flex:1; text-align:center;"><div class="stat-value">${report.todayTransactionSummary.shorts}</div><div class="stat-label">Shorts</div></div>
            </div>
        </div>

        <div class="actions-section" style="margin-bottom: 30px; display: flex; gap: 15px;">
            <button id="btn-sync-sap" class="btn btn-primary" style="padding: 10px 20px;">🔄 Sync to SAP</button>
            <button id="btn-export-csv" class="btn btn-outline" style="padding: 10px 20px;">📥 Export CSV Report</button>
        </div>

        <div class="stock-summary">
            <h3>Detailed Stock Breakdown</h3>
            <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; margin-top: 10px;">
                <thead style="background: #f4f4f4;">
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd;">SKU</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Product</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Godown</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">In-Transit</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Hold</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Physical Total</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">SAP Stock</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Variance</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.products.map(item => {
                        let varColor = 'green';
                        const absVar = Math.abs(item.variance);
                        if (absVar > 0 && absVar <= 5) varColor = 'orange';
                        else if (absVar > 5) varColor = 'red';

                        return `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.id}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.godownStock}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.inTransitStock}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.holdStock}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${item.physical}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.sapStock}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; color: ${varColor}; font-weight: bold;">${item.variance}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        ${report.unresolvedHold.length > 0 ? `
        <div class="card" style="margin-top: 20px; padding: 15px; border-left: 4px solid #f9ab00;">
            <h3>⚠️ Unresolved Hold Stock (${report.unresolvedHold.length} products)</h3>
            <p>These items need resolution before SAP sync. Go to <a href="#returns">Returns & Hold</a> to resolve.</p>
            <ul>
                ${report.unresolvedHold.map(p => `<li>${p.name}: <strong>${p.holdStock}</strong> cases in hold</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    `;
}

function handleSyncSAP() {
    // In a real app, this would make an API call to SAP integration layer
    const adjustments = DataService.syncToSAP();
    
    if (adjustments && adjustments.length > 0) {
        showToast(`Synced! Made ${adjustments.length} adjustments to SAP to match physical reality.`, 'success');
    } else {
        showToast(`Synced successfully. No adjustments needed (100% aligned).`, 'success');
    }
    
    refresh();
}

function handleExportCSV() {
    const csvContent = DataService.exportToCSV();
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reconciliation_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Report downloaded', 'success');
}
