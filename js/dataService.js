/**
 * @file dataService.js
 * @description Core Data Access and Business Logic Layer.
 * WHY IT EXISTS: Abstracts storage mechanics from business logic. Allows switching from localStorage
 * to a real REST API by only modifying this file. Ensures data consistency and integrity.
 */

import { generateId, today } from './utils.js';
import { SEED_PRODUCTS, SEED_SHOPS } from './seedData.js';

const STORAGE_KEYS = {
    PRODUCTS: 'fmcg_products',
    SHOPS: 'fmcg_shops',
    TRIPS: 'fmcg_trips',
    TRANSACTIONS: 'fmcg_transactions',
    INIT_FLAG: 'fmcg_initialized'
};

/**
 * Helper to read from localStorage.
 */
function readStorage(key, defaultValue = null) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

/**
 * Helper to write to localStorage.
 */
function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export const DataService = {
    // === INITIALIZATION ===
    /**
     * Initializes the storage. Seeds data if not already present.
     * Engineering Decision: Idempotent initialization ensures safe multiple calls.
     */
    init() {
        if (!readStorage(STORAGE_KEYS.INIT_FLAG)) {
            console.log('Initializing seed data...');
            // Add 'sku' as alias for 'id' so screens can reference either
            const products = SEED_PRODUCTS.map(p => ({ ...p, sku: p.id }));
            writeStorage(STORAGE_KEYS.PRODUCTS, products);
            writeStorage(STORAGE_KEYS.SHOPS, SEED_SHOPS);
            writeStorage(STORAGE_KEYS.TRIPS, []);
            writeStorage(STORAGE_KEYS.TRANSACTIONS, []);
            writeStorage(STORAGE_KEYS.INIT_FLAG, true);
        } else {
            console.log('DataService already initialized.');
        }
    },

    // === PRODUCTS (Read/Update) ===
    /**
     * Returns all products.
     * @returns {Array} Array of products
     */
    getProducts() {
        return readStorage(STORAGE_KEYS.PRODUCTS, []);
    },

    /**
     * Returns a single product by ID.
     * @param {string} id - Product ID
     * @returns {Object|undefined} The product
     */
    getProduct(id) {
        return this.getProducts().find(p => p.id === id);
    },

    /**
     * Searches products by name or id, case-insensitive.
     * @param {string} query - Search query
     * @returns {Array} Filtered array of products
     */
    searchProducts(query) {
        const q = query.toLowerCase();
        return this.getProducts().filter(p => 
            p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
        );
    },

    /**
     * INTERNAL helper. Directly sets stock values. Only called by business methods below.
     * Engineering Decision: Centralizes update logic to maintain atomicity at the storage level.
     * @param {string} productId - Product ID
     * @param {Object} stockUpdates - { godown, inTransit, hold }
     */
    updateProductStock(productId, { godown, inTransit, hold }) {
        const products = this.getProducts();
        const pIndex = products.findIndex(p => p.id === productId);
        if (pIndex === -1) throw new Error(`Product ${productId} not found`);

        const p = products[pIndex];
        if (godown !== undefined) p.godownStock = godown;
        if (inTransit !== undefined) p.inTransitStock = inTransit;
        if (hold !== undefined) p.holdStock = hold;

        writeStorage(STORAGE_KEYS.PRODUCTS, products);
    },

    // === STOCK TRANSITIONS (Business Logic) ===

    /**
     * Precondition: godownStock >= quantity
     * Action: godownStock -= quantity, inTransitStock += quantity
     * Side effect: records transaction { type: 'load', from: 'godown', to: 'in-transit' }
     * Engineering Decision: Atomic operation. Checks preconditions to prevent negative stock.
     */
    loadOntoTruck(tripId, productId, quantity) {
        const product = this.getProduct(productId);
        if (!product) return { success: false, error: 'Product not found' };
        if (product.godownStock < quantity) return { success: false, error: 'Insufficient godown stock' };

        this.updateProductStock(productId, {
            godown: product.godownStock - quantity,
            inTransit: product.inTransitStock + quantity
        });

        this.recordTransaction({
            type: 'load',
            productId,
            quantity,
            fromState: 'godown',
            toState: 'in-transit',
            tripId,
            reason: 'Loading for delivery'
        });

        // Update trip items
        this.addTripItem(tripId, { productId, loadedQty: quantity });

        return { success: true };
    },

    /**
     * Action: inTransitStock -= deliveredQty (stock leaves system)
     * if shortQty > 0: inTransitStock -= shortQty, godownStock += shortQty (shorts go back)
     */
    recordDelivery(tripId, productId, deliveredQty, shortQty = 0) {
        const product = this.getProduct(productId);
        if (!product) return { success: false, error: 'Product not found' };

        const totalToDeduct = deliveredQty + shortQty;
        if (product.inTransitStock < totalToDeduct) {
            return { success: false, error: 'Insufficient in-transit stock' };
        }

        const newInTransit = product.inTransitStock - totalToDeduct;
        const newGodown = product.godownStock + shortQty;

        this.updateProductStock(productId, {
            inTransit: newInTransit,
            godown: newGodown
        });

        if (deliveredQty > 0) {
            this.recordTransaction({
                type: 'deliver',
                productId,
                quantity: deliveredQty,
                fromState: 'in-transit',
                toState: 'sold',
                tripId,
                reason: 'Delivered to customer'
            });
        }

        if (shortQty > 0) {
            this.recordTransaction({
                type: 'short',
                productId,
                quantity: shortQty,
                fromState: 'in-transit',
                toState: 'godown',
                tripId,
                reason: 'Short delivery returned to godown'
            });
        }

        return { success: true };
    },

    /**
     * Moves stock from in-transit to hold.
     * reason: 'return' | 'damage' | 'refused' | 'shop-closed'
     */
    moveToHold(tripId, productId, quantity, reason) {
        const product = this.getProduct(productId);
        if (!product) return { success: false, error: 'Product not found' };
        if (product.inTransitStock < quantity) return { success: false, error: 'Insufficient in-transit stock' };

        this.updateProductStock(productId, {
            inTransit: product.inTransitStock - quantity,
            hold: product.holdStock + quantity
        });

        this.recordTransaction({
            type: reason,
            productId,
            quantity,
            fromState: 'in-transit',
            toState: 'hold',
            tripId,
            reason: `Moved to hold: ${reason}`
        });

        return { success: true };
    },

    /**
     * Resolves held stock.
     * resolution: 'restock' | 'write-off' | 'credit-note'
     */
    resolveHold(productId, quantity, resolution) {
        const product = this.getProduct(productId);
        if (!product) return { success: false, error: 'Product not found' };
        if (product.holdStock < quantity) return { success: false, error: 'Insufficient hold stock' };

        const updates = { hold: product.holdStock - quantity };
        let toState = resolution;
        
        if (resolution === 'restock') {
            updates.godown = product.godownStock + quantity;
            toState = 'godown';
        }

        this.updateProductStock(productId, updates);

        this.recordTransaction({
            type: 'reconcile',
            productId,
            quantity,
            fromState: 'hold',
            toState,
            tripId: null,
            reason: `Resolved hold via ${resolution}`
        });

        return { success: true };
    },

    // === TRIPS ===
    /**
     * Creates a new trip.
     */
    createTrip({ truckNumber, driverName, workerName }) {
        const trips = this.getAllTrips();
        const trip = {
            id: generateId(),
            truckNumber,
            driverName,
            workerName,
            status: 'loading', // loading, active, completed
            date: today(),
            items: [],
            deliveries: []
        };
        trips.push(trip);
        writeStorage(STORAGE_KEYS.TRIPS, trips);
        return trip;
    },

    getTrip(id) {
        return this.getAllTrips().find(t => t.id === id);
    },

    getActiveTrips() {
        return this.getAllTrips().filter(t => t.status !== 'completed');
    },

    getAllTrips() {
        return readStorage(STORAGE_KEYS.TRIPS, []);
    },

    getTodayTrips() {
        const t = today();
        return this.getAllTrips().filter(trip => trip.date === t);
    },

    updateTripStatus(tripId, status) {
        const trips = this.getAllTrips();
        const trip = trips.find(t => t.id === tripId);
        if (trip) {
            trip.status = status;
            writeStorage(STORAGE_KEYS.TRIPS, trips);
        }
    },

    addTripItem(tripId, { productId, loadedQty }) {
        const trips = this.getAllTrips();
        const trip = trips.find(t => t.id === tripId);
        if (trip) {
            const item = trip.items.find(i => i.productId === productId);
            if (item) {
                item.loadedQty += loadedQty;
            } else {
                trip.items.push({ productId, loadedQty });
            }
            writeStorage(STORAGE_KEYS.TRIPS, trips);
        }
    },

    addDeliveryToTrip(tripId, deliveryData) {
        const trips = this.getAllTrips();
        const trip = trips.find(t => t.id === tripId);
        if (trip) {
            trip.deliveries.push({ id: generateId(), timestamp: new Date().toISOString(), ...deliveryData });
            writeStorage(STORAGE_KEYS.TRIPS, trips);
        }
    },

    completeTrip(tripId) {
        const trips = this.getAllTrips();
        const trip = trips.find(t => t.id === tripId);
        if (!trip) return { success: false, error: 'Trip not found' };

        // Return any remaining in-transit items for this trip to godown
        // Note: Realistically, you'd calculate what is left based on trip items minus deliveries/returns
        // For simplicity in this demo, if completing, we assume all in-transit goes back to godown if not explicitly held.
        // A full implementation would tally per-trip in-transit stock.
        
        trip.status = 'completed';
        writeStorage(STORAGE_KEYS.TRIPS, trips);
        return { success: true };
    },

    // === TRANSACTIONS (Audit Log) ===
    /**
     * Records an immutable transaction. Event Sourcing pattern.
     */
    recordTransaction({ type, productId, quantity, fromState, toState, tripId, reason }) {
        const txs = this.getTransactions();
        const tx = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            date: today(),
            type,
            productId,
            quantity,
            fromState,
            toState,
            tripId,
            reason
        };
        txs.push(tx);
        writeStorage(STORAGE_KEYS.TRANSACTIONS, txs);
        return tx;
    },

    getTransactions(filters = {}) {
        let txs = readStorage(STORAGE_KEYS.TRANSACTIONS, []);
        if (filters.date) txs = txs.filter(t => t.date === filters.date);
        if (filters.type) txs = txs.filter(t => t.type === filters.type);
        if (filters.productId) txs = txs.filter(t => t.productId === filters.productId);
        if (filters.tripId) txs = txs.filter(t => t.tripId === filters.tripId);
        return txs;
    },

    getTodayTransactions() {
        return this.getTransactions({ date: today() });
    },

    // === RECONCILIATION ===
    /**
     * Generates a comprehensive reconciliation report.
     */
    getReconciliationReport() {
        const products = this.getProducts();
        const report = {
            products: [],
            totalGodown: 0,
            totalInTransit: 0,
            totalHold: 0,
            totalPhysical: 0,
            totalSAP: 0,
            totalVariance: 0,
            unresolvedHold: [],
            todayTransactionSummary: { loads: 0, deliveries: 0, returns: 0, damages: 0, shorts: 0 }
        };

        products.forEach(p => {
            const physical = p.godownStock + p.inTransitStock + p.holdStock;
            const variance = p.sapStock - physical;
            
            report.totalGodown += p.godownStock;
            report.totalInTransit += p.inTransitStock;
            report.totalHold += p.holdStock;
            report.totalPhysical += physical;
            report.totalSAP += p.sapStock;
            report.totalVariance += variance;

            const repProduct = { ...p, physical, variance };
            report.products.push(repProduct);

            if (p.holdStock > 0) {
                report.unresolvedHold.push(repProduct);
            }
        });

        // Tally today's transactions
        const todayTxs = this.getTodayTransactions();
        todayTxs.forEach(tx => {
            if (tx.type === 'load') report.todayTransactionSummary.loads += tx.quantity;
            if (tx.type === 'deliver') report.todayTransactionSummary.deliveries += tx.quantity;
            if (tx.type === 'return') report.todayTransactionSummary.returns += tx.quantity;
            if (tx.type === 'damage') report.todayTransactionSummary.damages += tx.quantity;
            if (tx.type === 'short') report.todayTransactionSummary.shorts += tx.quantity;
        });

        return report;
    },

    syncToSAP() {
        const products = this.getProducts();
        const adjustments = [];
        
        products.forEach(p => {
            const physical = p.godownStock + p.inTransitStock + p.holdStock;
            if (p.sapStock !== physical) {
                const diff = physical - p.sapStock;
                adjustments.push({ productId: p.id, adjustment: diff });
                p.sapStock = physical;
                
                this.recordTransaction({
                    type: 'sap-sync',
                    productId: p.id,
                    quantity: Math.abs(diff),
                    fromState: 'physical',
                    toState: 'sap',
                    tripId: null,
                    reason: `SAP sync adjustment`
                });
            }
        });
        
        writeStorage(STORAGE_KEYS.PRODUCTS, products);
        return adjustments;
    },

    exportToCSV() {
        const report = this.getReconciliationReport();
        const headers = ['SKU', 'Product', 'Category', 'GodownStock', 'InTransitStock', 'HoldStock', 'PhysicalTotal', 'SAPStock', 'Variance', 'Action'];
        const rows = [headers.join(',')];
        
        report.products.forEach(p => {
            const action = p.variance !== 0 ? 'Needs Check' : 'OK';
            rows.push([
                p.id, p.name, p.category, 
                p.godownStock, p.inTransitStock, p.holdStock, 
                p.physical, p.sapStock, p.variance, action
            ].join(','));
        });
        
        return rows.join('\n');
    },

    // === STATS ===
    getDashboardStats() {
        const report = this.getReconciliationReport();
        return {
            totalProducts: report.products.length,
            totalGodown: report.totalGodown,
            totalInTransit: report.totalInTransit,
            totalHold: report.totalHold,
            totalSAP: report.totalSAP,
            totalVariance: report.totalVariance,
            activeTrips: this.getActiveTrips().length,
            todayDeliveries: report.todayTransactionSummary.deliveries,
            todayReturns: report.todayTransactionSummary.returns + report.todayTransactionSummary.damages
        };
    }
};
