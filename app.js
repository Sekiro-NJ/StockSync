/**
 * FMCG Real-Time Stock Tracking System
 *
 * ARCHITECTURE OVERVIEW
 * ---------------------
 * 1. SPA Architecture: Uses hash-based routing to switch between views without page reloads.
 * 2. Service Layer Pattern: `DataService` handles all data interactions, abstracting away localStorage/API.
 * 3. Event Sourcing: Transactions are recorded sequentially, providing a full audit trail.
 * 4. State Machine: Stock moves through states: Godown -> InTransit -> Delivered/Hold -> Godown.
 *
 * This entry point orchestrates initialization, routing, and theme management.
 */

import { DataService } from './js/dataService.js';
import { Router } from './js/router.js';
import * as Dashboard from './js/dashboard.js';
import * as Analytics from './js/analytics.js';
import * as Loading from './js/loading.js';
import * as Delivery from './js/delivery.js';
import * as Returns from './js/returns.js';
import * as Reconciliation from './js/reconciliation.js';
import { seedDemoScenario } from './js/demoScenario.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize data service (seeds data if empty)
  DataService.init();

  // 1b. Seed demo scenario (realistic day of operations for analytics)
  seedDemoScenario();

  // 2. Initialize screen modules (safely checking if they have an init function)
  const modules = {
    dashboard: Dashboard,
    analytics: Analytics,
    loading: Loading,
    delivery: Delivery,
    returns: Returns,
    reconciliation: Reconciliation
  };

  for (const key in modules) {
    if (modules[key] && typeof modules[key].init === 'function') {
      modules[key].init();
    }
  }

  // 3. Initialize Router
  Router.init((route) => {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.remove('active');
    });

    // Show active section
    const activeSection = document.getElementById(`${route}-section`);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.route === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Refresh module data
    const activeModule = modules[route];
    if (activeModule && typeof activeModule.refresh === 'function') {
      activeModule.refresh();
    }
  });

  // 4. Setup Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    if (themeToggle) {
      themeToggle.innerHTML = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }
  }

  // 5. Setup Reset Button
  const resetBtn = document.getElementById('reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all demo data? This cannot be undone.')) {
        localStorage.clear();
        window.location.reload();
      }
    });
  }
});
