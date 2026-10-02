import { DataService } from './dataService.js';
import { showToast, generateId } from './utils.js';

let currentTripId = null;

export function init() {
    const container = document.getElementById('loading-content');
    if (!container) return;

    // Event delegation for dynamically rendered content
    container.addEventListener('click', (e) => {
        if (e.target.id === 'btn-create-trip') {
            handleCreateTrip();
        } else if (e.target.classList.contains('btn-add-load')) {
            const productId = e.target.getAttribute('data-product-id');
            handleAddLoad(productId);
        } else if (e.target.id === 'btn-finalize-trip') {
            handleFinalizeTrip();
        } else if (e.target.classList.contains('qty-btn')) {
            const input = e.target.parentElement.querySelector('input');
            let val = parseInt(input.value || 0, 10);
            if (e.target.classList.contains('minus')) val = Math.max(0, val - 1);
            if (e.target.classList.contains('plus')) val += 1;
            input.value = val;
        }
    });
}

export function refresh() {
    const container = document.getElementById('loading-content');
    if (!container) return;

    // Check if there is an active trip in 'draft' or 'loading' state
    const activeTrips = DataService.getActiveTrips();
    const draftTrip = activeTrips.find(t => t.status === 'draft' || t.status === 'loading');

    if (draftTrip) {
        currentTripId = draftTrip.id;
        renderPhase2(container, draftTrip);
    } else {
        currentTripId = null;
        renderPhase1(container);
    }
}

function renderPhase1(container) {
    container.innerHTML = `
        <div class="loading-phase1">
            <h2>Morning Loading - Create Trip</h2>
            <div class="form-group">
                <label>Truck Number</label>
                <input type="text" id="truck-number" placeholder="e.g. MH-12-AB-1234" />
            </div>
            <div class="form-group">
                <label>Driver Name</label>
                <input type="text" id="driver-name" placeholder="Driver Name" />
            </div>
            <div class="form-group">
                <label>Worker Name</label>
                <input type="text" id="worker-name" placeholder="Worker Name" />
            </div>
            <button id="btn-create-trip" class="btn primary">Start Loading</button>
        </div>
    `;
}

function renderPhase2(container, trip) {
    const products = DataService.getProducts();

    container.innerHTML = `
        <div class="loading-phase2" style="display: flex; gap: 20px;">
            <div class="product-selection" style="flex: 2;">
                <h2>Load Products</h2>
                <div class="trip-info">
                    <p><strong>Truck:</strong> ${trip.truckNumber} | <strong>Driver:</strong> ${trip.driverName} | <strong>Worker:</strong> ${trip.workerName}</p>
                </div>
                
                <input type="text" id="product-search" placeholder="Search product..." style="width: 100%; margin-bottom: 10px;" />
                
                <table class="product-list-table" style="width: 100%; text-align: left;">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Name</th>
                            <th>Available</th>
                            <th>Quantity</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => `
                            <tr>
                                <td>${p.sku}</td>
                                <td>${p.name}</td>
                                <td>${p.godownStock}</td>
                                <td>
                                    <div class="qty-control" style="display:flex; align-items:center;">
                                        <button class="qty-btn minus">-</button>
                                        <input type="number" id="qty-${p.id}" value="0" min="0" max="${p.godownStock}" style="width: 60px; text-align:center;" />
                                        <button class="qty-btn plus">+</button>
                                    </div>
                                </td>
                                <td>
                                    <button class="btn btn-add-load" data-product-id="${p.id}">Add to Load</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="trip-summary" style="flex: 1; border-left: 1px solid #ccc; padding-left: 20px;">
                <h3>Loaded Items</h3>
                <ul id="loaded-items-list">
                    ${trip.items && trip.items.length > 0 ? trip.items.map(item => {
                        const prod = DataService.getProduct(item.productId);
                        return `<li>${prod ? prod.name : item.productId}: <strong>${item.loadedQty}</strong></li>`;
                    }).join('') : '<li>No items loaded yet.</li>'}
                </ul>
                <button id="btn-finalize-trip" class="btn success" style="margin-top: 20px; width: 100%;">Finalize Loading & Dispatch</button>
            </div>
        </div>
    `;
}

function handleCreateTrip() {
    const truckNumber = document.getElementById('truck-number').value.trim();
    const driverName = document.getElementById('driver-name').value.trim();
    const workerName = document.getElementById('worker-name').value.trim();

    if (!truckNumber || !driverName) {
        showToast('Please enter Truck Number and Driver Name', 'error');
        return;
    }

    const trip = DataService.createTrip({ truckNumber, driverName, workerName });
    currentTripId = trip.id;
    showToast('Trip created successfully!', 'success');
    refresh(); // Transition to phase 2
}

function handleAddLoad(productId) {
    const qtyInput = document.getElementById(`qty-${productId}`);
    const quantity = parseInt(qtyInput.value, 10);

    if (quantity <= 0) {
        showToast('Enter a valid quantity', 'error');
        return;
    }

    const result = DataService.loadOntoTruck(currentTripId, productId, quantity);
    
    if (result.success) {
        showToast('Product loaded onto truck', 'success');
        refresh(); // Refresh to update available stock and loaded items list
    } else {
        showToast(result.error || 'Failed to load product', 'error');
    }
}

function handleFinalizeTrip() {
    if (!currentTripId) return;
    
    DataService.updateTripStatus(currentTripId, 'in-transit');
    showToast('Trip finalized and dispatched!', 'success');
    currentTripId = null;
    refresh(); // Will return to Phase 1 since no 'draft' trip exists
}
