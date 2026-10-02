import { DataService } from './dataService.js';
import { showToast } from './utils.js';

export function init() {
    const container = document.getElementById('returns-content');
    if (!container) return;

    container.addEventListener('click', (e) => {
        if (e.target.id === 'btn-process-return') {
            handleProcessReturn();
        } else if (e.target.classList.contains('btn-resolve')) {
            const productId = e.target.getAttribute('data-product-id');
            const resolution = e.target.getAttribute('data-resolution');
            const qty = parseInt(e.target.parentElement.querySelector('.resolve-qty').value || 0, 10);
            handleResolveHold(productId, qty, resolution);
        }
    });

    container.addEventListener('change', (e) => {
        if (e.target.id === 'trip-selector') {
            updateProductPicker();
        }
    });
}

export function refresh() {
    const container = document.getElementById('returns-content');
    if (!container) return;

    const activeTrips = DataService.getActiveTrips().filter(t => t.status === 'in-transit');
    const products = DataService.getProducts();
    const holdProducts = products.filter(p => p.holdStock > 0);

    // This screen is the core innovation: instantaneous handling of exceptions 
    // instead of logging them in notebooks for end-of-day SAP data entry.
    
    container.innerHTML = `
        <div class="returns-main">
            <h2>Process Returns / Damages</h2>
            <div class="return-form" style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Reason for hold:</label>
                    <select id="return-reason" style="width: 100%; padding: 8px;">
                        <option value="return">Customer Return</option>
                        <option value="damage">Damaged Goods</option>
                        <option value="refused">Refused Delivery</option>
                        <option value="shop-closed">Shop Closed</option>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Source Trip (Optional):</label>
                    <select id="trip-selector" style="width: 100%; padding: 8px;">
                        <option value="">Walk-in / Godown Return</option>
                        ${activeTrips.map(t => `<option value="${t.id}">${t.truckNumber} - ${t.driverName}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Select Product:</label>
                    <select id="product-selector" style="width: 100%; padding: 8px;">
                        ${products.map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('')}
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Quantity:</label>
                    <input type="number" id="return-qty" value="1" min="1" style="width: 100%; padding: 8px;" />
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Notes:</label>
                    <textarea id="return-notes" style="width: 100%; height: 60px; padding: 8px;"></textarea>
                </div>

                <button id="btn-process-return" class="btn warning" style="width: 100%; padding: 12px; font-weight: bold;">Move to Hold Stock instantly</button>
            </div>
        </div>

        <div class="hold-review" style="margin-top: 40px;">
            <h2>Hold Stock Review</h2>
            <p>Resolve items currently in hold status to clear variance before end of day.</p>
            
            <table class="data-table" style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #ccc;">
                        <th>Product</th>
                        <th>Hold Qty</th>
                        <th>Resolve Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${holdProducts.length === 0 ? '<tr><td colspan="3">No items in hold stock.</td></tr>' : ''}
                    ${holdProducts.map(p => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0;">${p.name} <br/><small>${p.sku}</small></td>
                            <td><strong style="color: #d9534f;">${p.holdStock}</strong></td>
                            <td>
                                <input type="number" class="resolve-qty" value="${p.holdStock}" min="1" max="${p.holdStock}" style="width: 60px; margin-right: 10px;" />
                                <button class="btn btn-resolve" data-product-id="${p.id}" data-resolution="restock" style="background: #5cb85c; color: white;">Restock</button>
                                <button class="btn btn-resolve" data-product-id="${p.id}" data-resolution="write-off" style="background: #d9534f; color: white;">Write Off</button>
                                <button class="btn btn-resolve" data-product-id="${p.id}" data-resolution="credit-note" style="background: #f0ad4e; color: white;">Credit Note</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    updateProductPicker();
}

function updateProductPicker() {
    const tripId = document.getElementById('trip-selector').value;
    const productSelector = document.getElementById('product-selector');
    
    // If a trip is selected, we ideally filter the products to those in the trip.
    // Simplified: we'll show all products but a real app would filter by trip.items.
    // For now, no-op since we populate all products initially.
}

function handleProcessReturn() {
    const reason = document.getElementById('return-reason').value;
    const tripId = document.getElementById('trip-selector').value || null; // null means godown
    const productId = document.getElementById('product-selector').value;
    const qty = parseInt(document.getElementById('return-qty').value, 10);
    const notes = document.getElementById('return-notes').value;

    if (qty <= 0) {
        showToast('Quantity must be greater than 0', 'error');
        return;
    }

    // Move stock to hold instantly, updating state in real-time
    const result = DataService.moveToHold(tripId, productId, qty, reason);

    if (result.success) {
        showToast(`Stock moved to Hold instantly due to: ${reason}`, 'success');
        refresh();
    } else {
        showToast(result.error || 'Failed to process return', 'error');
    }
}

function handleResolveHold(productId, qty, resolution) {
    if (qty <= 0) {
        showToast('Enter valid quantity to resolve', 'error');
        return;
    }

    const result = DataService.resolveHold(productId, qty, resolution);

    if (result.success) {
        showToast(`Hold resolved via ${resolution}`, 'success');
        refresh();
    } else {
        showToast(result.error || 'Failed to resolve hold', 'error');
    }
}
