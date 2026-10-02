/**
 * @file seedData.js
 * @description Initial seed data for the FMCG Stock Tracking System.
 * WHY IT EXISTS: Provides realistic mock data to initialize the application and demonstrate
 * its capabilities without requiring a complex backend setup immediately.
 */

export const SEED_PRODUCTS = [
    // Toothpaste Category
    {
        id: 'CLG-TP-001',
        name: 'MaxFresh 75g',
        category: 'Toothpaste',
        unit: 'cases',
        godownStock: 150,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 150
    },
    {
        id: 'CLG-TP-002',
        name: 'MaxFresh 150g',
        category: 'Toothpaste',
        unit: 'cases',
        godownStock: 120,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 120
    },
    {
        id: 'CLG-TP-003',
        name: 'Strong Teeth 100g',
        category: 'Toothpaste',
        unit: 'cases',
        godownStock: 200,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 200
    },
    {
        id: 'CLG-TP-004',
        name: 'Strong Teeth 200g',
        category: 'Toothpaste',
        unit: 'cases',
        godownStock: 180,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 180
    },
    {
        id: 'CLG-TP-005',
        name: 'Visible White 100g',
        category: 'Toothpaste',
        unit: 'cases',
        godownStock: 80,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 80
    },
    
    // Toothbrush Category
    {
        id: 'CLG-TB-001',
        name: 'Zigzag Medium',
        category: 'Toothbrush',
        unit: 'cases',
        godownStock: 100,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 100
    },
    {
        id: 'CLG-TB-002',
        name: 'Super Flexi',
        category: 'Toothbrush',
        unit: 'cases',
        godownStock: 90,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 90
    },
    {
        id: 'CLG-TB-003',
        name: 'Slim Soft',
        category: 'Toothbrush',
        unit: 'cases',
        godownStock: 110,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 110
    },
    {
        id: 'CLG-TB-004',
        name: 'Extra Clean',
        category: 'Toothbrush',
        unit: 'cases',
        godownStock: 160,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 160
    },

    // Mouthwash Category
    {
        id: 'CLG-MW-001',
        name: 'Plax Fresh Mint 250ml',
        category: 'Mouthwash',
        unit: 'cases',
        godownStock: 60,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 60
    },
    {
        id: 'CLG-MW-002',
        name: 'Plax Complete Care 250ml',
        category: 'Mouthwash',
        unit: 'cases',
        godownStock: 50,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 50
    },
    {
        id: 'CLG-MW-003',
        name: 'Plax Fresh Tea 250ml',
        category: 'Mouthwash',
        unit: 'cases',
        godownStock: 75,
        inTransitStock: 0,
        holdStock: 0,
        sapStock: 75
    }
];

export const SEED_SHOPS = [
    {
        id: 'SHOP-001',
        name: 'Sharma General Store',
        area: 'Connaught Place',
        contactPerson: 'Rahul Sharma'
    },
    {
        id: 'SHOP-002',
        name: 'Krishna Medicals',
        area: 'Karol Bagh',
        contactPerson: 'Krishna Kumar'
    },
    {
        id: 'SHOP-003',
        name: 'New Modern Bazaar',
        area: 'Vasant Kunj',
        contactPerson: 'Amit Singh'
    },
    {
        id: 'SHOP-004',
        name: 'Gupta Provisions',
        area: 'Lajpat Nagar',
        contactPerson: 'Sanjay Gupta'
    },
    {
        id: 'SHOP-005',
        name: 'Daily Needs Supermart',
        area: 'Dwarka',
        contactPerson: 'Vikram Patel'
    },
    {
        id: 'SHOP-006',
        name: 'Verma Traders',
        area: 'Rohini',
        contactPerson: 'Rajeev Verma'
    },
    {
        id: 'SHOP-007',
        name: 'Aggarwal Sweets & Mart',
        area: 'Chandni Chowk',
        contactPerson: 'Mukesh Aggarwal'
    },
    {
        id: 'SHOP-008',
        name: 'City Care Pharmacy',
        area: 'South Ex',
        contactPerson: 'Dr. Neha Sharma'
    }
];
