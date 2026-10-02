import { DataService } from './dataService.js';
import { showToast } from './utils.js';

let selectedTripId = null;

export function init() {
    const container = document.getElementById('delivery-content');
    if (!container) return;

    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-select-trip')) {
            selectedTripId = e.target.getAttribute('data-trip-id');
            refresh();
        } else if (e.target.id === 'btn-back-trips') {
            selectedTripId = null;
            refresh();
        } else if (e.target.id === 'btn-record-delivery') {
            handleRecordDelivery();
        } else if (e.target.id === 'btn-complete-trip') {
            handleCompleteTrip();
        }
    });
}

export function refresh() {
    const container = document.getElementById('delivery-content');
    if (!container) return;

    if (selectedTripId) {
        const trip = DataService.getTrip(selectedTripId);
        if (trip) {
            renderStep2(container, trip);
        } else {
            selectedTripId = null;
            renderStep1(container);
        }
    } else {
        renderStep1(container);
    }
}

function renderStep1(container) {
    const trips = DataService.getActiveTrips().filter(t => t.status === 'in-transit');
    
    container.innerHTML = `
        <div class="delivery-step1">
            <h2>Select Active Trip for Delivery</h2>
            <div class="trips-grid" style="display: flex; gap: 15px; flex-wrap: wrap;">
                ${trips.length === 0 ? '<p>No active in-transit trips.</p>' : ''}
                ${trips.map(t => `
                    <div class="trip-card" style="border: 1px solid #ccc; padding: 15px; border-radius: 5px; min-width: 200px;">
                        <h3>Truck: ${t.truckNumber}</h3>
                        <p>Driver: ${t.driverName}</p>
                        <p>Items Loaded: ${t.items ? t.items.length : 0}</p>
                        <button class="btn primary btn-select-trip" data-trip-id="${t.id}">Select Trip</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderStep2(container, trip) {
    const itemsHtml = (trip.items || []).map(item => {
        const prod = DataService.getProduct(item.productId);
        const prodName = prod ? prod.name : item.productId;
        const maxQty = item.loadedQty; // Assuming we can only deliver what was loaded (simplified)

        return `
            <div class="delivery-item-row" data-product-id="${item.productId}" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <div style="flex: 2;">${prodName} (Loaded: ${maxQty})</div>
                <div style="flex: 1;">
                    <label>Delivered:</label>
                    <input type="number" class="del-qty" value="0" min="0" max="${maxQty}" style="width: 60px;" />
                </div>
                <div style="flex: 1;">
                    <label>Short:</label>
                    <input type="number" class="short-qty" value="0" min="0" max="${maxQty}" style="width: 60px;" />
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="delivery-step2">
            <button id="btn-back-trips" class="btn secondary">⬅ Back to Trips</button>
            <h2>Record Delivery Stop</h2>
            <div class="trip-header" style="background: #f9f9f9; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <p><strong>Truck:</strong> ${trip.truckNumber} | <strong>Driver:</strong> ${trip.driverName}</p>
            </div>

            <div class="delivery-form" style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Shop / Customer Name</label>
                    <input type="text" id="shop-name" placeholder="Enter shop name" style="width: 100%;" />
                </div>

                <div class="delivery-items">
                    <h4>Products</h4>
                    ${itemsHtml || '<p>No items loaded.</p>'}
                </div>

                <div class="status-payment" style="margin-top: 20px;">
                    <div class="form-group">
                        <label>Delivery Status:</label>
                        <select id="delivery-status">
                            <option value="delivered">Delivered Successfully</option>
                            <option value="partial">Partial Delivery</option>
                            <option value="refused">Refused by Shop</option>
                            <option value="shop-closed">Shop Closed</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="display: flex; gap: 10px; margin-top: 10px;">
                        <div>
                            <label>Payment Amount:</label>
                            <input type="number" id="payment-amount" value="0" />
                        </div>
                        <div>
                            <label>Payment Mode:</label>
                            <select id="payment-mode">
                                <option value="cash">Cash</option>
                                <option value="credit">Credit</option>
                                <option value="upi">UPI</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>Notes:</label>
                        <textarea id="delivery-notes" style="width: 100%; height: 60px;"></textarea>
                    </div>
                </div>

                <button id="btn-record-delivery" class="btn primary" style="margin-top: 15px;">Save Delivery Stop</button>
            </div>

            <div class="trip-actions" style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 15px;">
                <button id="btn-complete-trip" class="btn success" style="width: 100%; padding: 15px; font-size: 1.1em;">End of Day: Complete Trip & Return Godown</button>
            </div>
        </div>
    `;
}

function handleRecordDelivery() {
    if (!selectedTripId) return;

    const shopName = document.getElementById('shop-name').value.trim();
    const status = document.getElementById('delivery-status').value;
    const paymentAmt = parseFloat(document.getElementById('payment-amount').value || 0);
    const paymentMode = document.getElementById('payment-mode').value;
    const notes = document.getElementById('delivery-notes').value;

    if (!shopName) {
        showToast('Please enter shop name', 'error');
        return;
    }

    const itemRows = document.querySelectorAll('.delivery-item-row');
    const deliveryItems = [];
    
    let hasErrors = false;

    itemRows.forEach(row => {
        const productId = row.getAttribute('data-product-id');
        const delQty = parseInt(row.querySelector('.del-qty').value || 0, 10);
        const shortQty = parseInt(row.querySelector('.short-qty').value || 0, 10);

        if (delQty > 0 || shortQty > 0) {
            deliveryItems.push({ productId, deliveredQty: delQty, shortQty: shortQty });
            
            // Process the transaction in the system immediately
            if (status === 'refused' || status === 'shop-closed') {
                // If entire delivery is refused, it moves to hold stock
                DataService.moveToHold(selectedTripId, productId, delQty + shortQty, status);
            } else {
                const result = DataService.recordDelivery(selectedTripId, productId, delQty, shortQty);
                if (!result.success) {
                    hasErrors = true;
                    showToast(result.error, 'error');
                }
            }
        }
    });

    if (hasErrors) return;

    // Log the delivery stop
    DataService.addDeliveryToTrip(selectedTripId, {
        shopName,
        status,
        payment: { amount: paymentAmt, mode: paymentMode },
        notes,
        items: deliveryItems,
        timestamp: new Date().toISOString()
    });

    showToast('Delivery recorded successfully!', 'success');
    refresh(); // Reset form for next stop
}

function handleCompleteTrip() {
    if (!selectedTripId) return;
    
    DataService.completeTrip(selectedTripId);
    showToast('Trip completed. Remaining stock returned to godown.', 'success');
    selectedTripId = null;
    refresh();
}
