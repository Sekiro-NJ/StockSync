/**
 * @file router.js
 * @description A lightweight, dependency-free hash-based Single Page Application (SPA) router.
 * WHY IT EXISTS: To provide navigable views (dashboard, loading, delivery) without reloading the page,
 * ensuring a smooth user experience.
 */

export const Router = {
    onNavigateCallback: null,

    /**
     * Initializes the router and sets up the hashchange event listener.
     * @param {Function} onNavigate - Callback triggered when the route changes. Receives the route string.
     */
    init(onNavigate) {
        this.onNavigateCallback = onNavigate;
        
        // Listen to hash changes in the URL
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });

        // Trigger initial routing based on current hash when loaded
        this.handleHashChange();
    },

    /**
     * Handles the hash change and maps it to a specific route.
     * Maps '' and '#dashboard' to 'dashboard', and so on.
     */
    handleHashChange() {
        let hash = window.location.hash;
        let route = 'dashboard'; // Default route

        if (hash === '#loading') route = 'loading';
        else if (hash === '#analytics') route = 'analytics';
        else if (hash === '#delivery') route = 'delivery';
        else if (hash === '#returns') route = 'returns';
        else if (hash === '#reconciliation') route = 'reconciliation';
        else if (hash === '#dashboard') route = 'dashboard';

        if (this.onNavigateCallback) {
            this.onNavigateCallback(route);
        }
    },

    /**
     * Programmatically navigates to a specific hash.
     * @param {string} hash - The hash to navigate to (e.g., '#loading')
     */
    navigate(hash) {
        window.location.hash = hash;
    }
};
