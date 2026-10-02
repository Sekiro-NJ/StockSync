/**
 * @file demoScenario.js
 * @description Pre-seeds a realistic demo scenario so analytics dashboards have
 * meaningful data from the moment the app launches.
 * 
 * WHY IT EXISTS: An empty analytics dashboard in an interview is a dead demo.
 * This module simulates a full day's worth of distribution operations — 3 trucks,
 * 8 shop deliveries, various exceptions — so every analytics tab has rich data
 * to discuss.
 * 
 * Engineering Decision: This runs ONCE after initial seed. It uses the exact same
 * DataService API that real interactions use, proving the system works end-to-end.
 */

import { DataService } from './dataService.js';

export function seedDemoScenario() {
    // Only seed if no transactions exist yet (fresh install)
    const existing = DataService.getTransactions();
    if (existing.length > 0) return false;

    console.log('Seeding demo scenario...');

    // === TRIP 1: Rajesh's morning run (mostly successful) ===
    const trip1 = DataService.createTrip({
        truckNumber: 'DL-01-AB-1234',
        driverName: 'Rajesh Kumar',
        workerName: 'Amit Singh'
    });

    // Load products
    DataService.loadOntoTruck(trip1.id, 'CLG-TP-001', 30);  // MaxFresh 75g
    DataService.loadOntoTruck(trip1.id, 'CLG-TP-003', 25);  // Strong Teeth 100g
    DataService.loadOntoTruck(trip1.id, 'CLG-TB-001', 15);  // Zigzag Medium
    DataService.loadOntoTruck(trip1.id, 'CLG-MW-001', 10);  // Plax Fresh Mint

    // Dispatch
    DataService.updateTripStatus(trip1.id, 'in-transit');

    // Delivery 1: Sharma General Store — full delivery
    DataService.recordDelivery(trip1.id, 'CLG-TP-001', 10, 0);
    DataService.recordDelivery(trip1.id, 'CLG-TP-003', 8, 0);
    DataService.recordDelivery(trip1.id, 'CLG-TB-001', 5, 0);
    DataService.recordDelivery(trip1.id, 'CLG-MW-001', 3, 0);
    DataService.addDeliveryToTrip(trip1.id, {
        shopName: 'Sharma General Store',
        status: 'delivered',
        payment: { amount: 4500, mode: 'cash' },
        items: [
            { productId: 'CLG-TP-001', deliveredQty: 10 },
            { productId: 'CLG-TP-003', deliveredQty: 8 },
            { productId: 'CLG-TB-001', deliveredQty: 5 },
            { productId: 'CLG-MW-001', deliveredQty: 3 }
        ]
    });

    // Delivery 2: Krishna Medicals — partial with shorts
    DataService.recordDelivery(trip1.id, 'CLG-TP-001', 8, 2); // 2 short
    DataService.recordDelivery(trip1.id, 'CLG-TP-003', 5, 0);
    DataService.recordDelivery(trip1.id, 'CLG-TB-001', 4, 1); // 1 short
    DataService.addDeliveryToTrip(trip1.id, {
        shopName: 'Krishna Medicals',
        status: 'partial',
        payment: { amount: 3200, mode: 'upi' },
        items: [
            { productId: 'CLG-TP-001', deliveredQty: 8, shortQty: 2 },
            { productId: 'CLG-TP-003', deliveredQty: 5 },
            { productId: 'CLG-TB-001', deliveredQty: 4, shortQty: 1 }
        ]
    });

    // Delivery 3: New Modern Bazaar — REFUSED (shop closed)
    DataService.moveToHold(trip1.id, 'CLG-TP-001', 5, 'shop-closed');
    DataService.moveToHold(trip1.id, 'CLG-TP-003', 5, 'shop-closed');
    DataService.moveToHold(trip1.id, 'CLG-MW-001', 3, 'shop-closed');
    DataService.addDeliveryToTrip(trip1.id, {
        shopName: 'New Modern Bazaar',
        status: 'shop-closed',
        payment: { amount: 0, mode: 'cash' },
        items: []
    });

    // Delivery 4: Gupta Provisions — damaged goods found
    DataService.recordDelivery(trip1.id, 'CLG-TP-001', 5, 0);
    DataService.moveToHold(trip1.id, 'CLG-TB-001', 2, 'damage');
    DataService.recordDelivery(trip1.id, 'CLG-MW-001', 2, 0);
    DataService.addDeliveryToTrip(trip1.id, {
        shopName: 'Gupta Provisions',
        status: 'delivered',
        payment: { amount: 2800, mode: 'credit' },
        items: [
            { productId: 'CLG-TP-001', deliveredQty: 5 },
            { productId: 'CLG-MW-001', deliveredQty: 2 }
        ]
    });

    DataService.completeTrip(trip1.id);

    // === TRIP 2: Sunil's route (more issues) ===
    const trip2 = DataService.createTrip({
        truckNumber: 'DL-02-CD-5678',
        driverName: 'Sunil Yadav',
        workerName: 'Ravi Sharma'
    });

    DataService.loadOntoTruck(trip2.id, 'CLG-TP-002', 20);  // MaxFresh 150g
    DataService.loadOntoTruck(trip2.id, 'CLG-TP-004', 25);  // Strong Teeth 200g
    DataService.loadOntoTruck(trip2.id, 'CLG-TB-002', 12);  // Super Flexi
    DataService.loadOntoTruck(trip2.id, 'CLG-TB-003', 10);  // Slim Soft
    DataService.loadOntoTruck(trip2.id, 'CLG-MW-002', 8);   // Plax Complete Care

    DataService.updateTripStatus(trip2.id, 'in-transit');

    // Delivery 1: Daily Needs Supermart — successful
    DataService.recordDelivery(trip2.id, 'CLG-TP-002', 8, 0);
    DataService.recordDelivery(trip2.id, 'CLG-TP-004', 10, 0);
    DataService.recordDelivery(trip2.id, 'CLG-TB-002', 5, 0);
    DataService.recordDelivery(trip2.id, 'CLG-MW-002', 3, 0);
    DataService.addDeliveryToTrip(trip2.id, {
        shopName: 'Daily Needs Supermart',
        status: 'delivered',
        payment: { amount: 5500, mode: 'upi' },
        items: [
            { productId: 'CLG-TP-002', deliveredQty: 8 },
            { productId: 'CLG-TP-004', deliveredQty: 10 },
            { productId: 'CLG-TB-002', deliveredQty: 5 },
            { productId: 'CLG-MW-002', deliveredQty: 3 }
        ]
    });

    // Delivery 2: Verma Traders — REFUSED
    DataService.moveToHold(trip2.id, 'CLG-TP-002', 6, 'refused');
    DataService.moveToHold(trip2.id, 'CLG-TP-004', 8, 'refused');
    DataService.moveToHold(trip2.id, 'CLG-TB-003', 5, 'refused');
    DataService.addDeliveryToTrip(trip2.id, {
        shopName: 'Verma Traders',
        status: 'refused',
        payment: { amount: 0, mode: 'cash' },
        items: []
    });

    // Delivery 3: Aggarwal Sweets — partial, some damage
    DataService.recordDelivery(trip2.id, 'CLG-TP-002', 4, 2);  // 2 short
    DataService.recordDelivery(trip2.id, 'CLG-TP-004', 5, 0);
    DataService.moveToHold(trip2.id, 'CLG-TB-002', 3, 'damage');
    DataService.moveToHold(trip2.id, 'CLG-TB-003', 2, 'damage');
    DataService.recordDelivery(trip2.id, 'CLG-MW-002', 3, 0);
    DataService.addDeliveryToTrip(trip2.id, {
        shopName: 'Aggarwal Sweets & Mart',
        status: 'partial',
        payment: { amount: 3100, mode: 'cash' },
        items: [
            { productId: 'CLG-TP-002', deliveredQty: 4, shortQty: 2 },
            { productId: 'CLG-TP-004', deliveredQty: 5 },
            { productId: 'CLG-MW-002', deliveredQty: 3 }
        ]
    });

    DataService.completeTrip(trip2.id);

    // === TRIP 3: Mohan's route (still in-transit for live demo) ===
    const trip3 = DataService.createTrip({
        truckNumber: 'DL-03-EF-9012',
        driverName: 'Mohan Lal',
        workerName: 'Deepak Kumar'
    });

    DataService.loadOntoTruck(trip3.id, 'CLG-TP-005', 15);  // Visible White
    DataService.loadOntoTruck(trip3.id, 'CLG-TB-004', 20);  // Extra Clean
    DataService.loadOntoTruck(trip3.id, 'CLG-MW-003', 12);  // Plax Fresh Tea

    DataService.updateTripStatus(trip3.id, 'in-transit');

    // One delivery done so far
    DataService.recordDelivery(trip3.id, 'CLG-TP-005', 5, 0);
    DataService.recordDelivery(trip3.id, 'CLG-TB-004', 8, 2); // 2 short
    DataService.recordDelivery(trip3.id, 'CLG-MW-003', 4, 0);
    DataService.addDeliveryToTrip(trip3.id, {
        shopName: 'City Care Pharmacy',
        status: 'delivered',
        payment: { amount: 3800, mode: 'upi' },
        items: [
            { productId: 'CLG-TP-005', deliveredQty: 5 },
            { productId: 'CLG-TB-004', deliveredQty: 8, shortQty: 2 },
            { productId: 'CLG-MW-003', deliveredQty: 4 }
        ]
    });

    // One return
    DataService.moveToHold(trip3.id, 'CLG-MW-003', 2, 'return');

    // Resolve some hold stock from earlier trips
    DataService.resolveHold('CLG-TP-001', 3, 'restock');  // Returned to godown
    DataService.resolveHold('CLG-TB-001', 1, 'write-off'); // Written off

    console.log('Demo scenario seeded successfully! 3 trips, 8 delivery stops, multiple exceptions.');
    return true;
}
