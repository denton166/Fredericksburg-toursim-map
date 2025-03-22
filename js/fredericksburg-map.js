/**
 * Fredericksburg Tourism Interactive Map
 * Main JavaScript file that integrates all map functionality
 * Version 1.0.0
 */

// Immediately Invoked Function Expression to avoid global scope pollution
(function () {
    'use strict';

    /**
     * =================================================================
     * CONFIGURATION SETTINGS
     * =================================================================
     */
    const CONFIG = {
        // API configuration
        api: {
            baseUrl: 'https://api.fredericksburg-tourism.com/v1',
            apiKey: 'your-api-key-here', // Change in production
            timeout: 30000, // 30 seconds
            cacheDuration: 30 * 60 * 1000 // 30 minutes
        },

        // Map configuration
        map: {
            center: { lat: 30.2752, lng: -98.8719 }, // Fredericksburg center
            defaultZoom: 14,
            minZoom: 10,
            maxZoom: 19,
            mapboxToken: 'pk.eyJ1IjoiZnJlZGVyaWNrc2J1cmdtYXAiLCJhIjoiY2ttNXlzNjd4MGIyMjJvbnU0aDUzajhqMCJ9.UqmqGj4zqJmirGVBK3PsYw',
            style: 'mapbox://styles/mapbox/streets-v11',
            bounds: {
                north: 30.3152,
                south: 30.2352,
                east: -98.8219,
                west: -98.9219
            }
        },

        // Category colors
        categoryColors: {
            wineries: '#8E24AA',
            restaurants: '#FF5722',
            shopping: '#1E88E5',
            lodging: '#43A047',
            outdoor: '#FB8C00',
            cultural: '#E53935'
        },

        // Feature flags
        features: {
            offlineMode: true,
            analytics: true,
            experiments: true,
            debugMode: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        },

        // UI configuration
        ui: {
            resultsPerPage: 10,
            animationDuration: 300,
            toastDuration: 3000
        }
    };

    /**
     * =================================================================
     * UTILITY FUNCTIONS
     * =================================================================
     */
    const Utils = {
        /**
         * Debounce function to limit how often a function is called
         */
        debounce(func, wait, immediate) {
            let timeout;
            return function () {
                const context = this, args = arguments;
                const later = function () {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                const callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        },

        /**
         * Throttle function to limit how often a function is called
         */
        throttle(func, limit) {
            let inThrottle;
            return function () {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * Format a price range into dollar signs
         */
        formatPriceRange(priceRange) {
            return priceRange ? '$'.repeat(priceRange) : 'N/A';
        },

        /**
         * Format a distance in miles with correct units
         */
        formatDistance(distance) {
            if (distance < 0.1) {
                return `${Math.round(distance * 5280)} ft`;
            } else {
                return `${distance.toFixed(1)} mi`;
            }
        },

        /**
         * Calculate distance between two points
         */
        calculateDistance(point1, point2) {
            // Implementation of Haversine formula
            const R = 3958.8; // Earth radius in miles
            const dLat = this.toRadians(point2.lat - point1.lat);
            const dLon = this.toRadians(point2.lng - point1.lng);

            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            return distance;
        },

        /**
         * Convert degrees to radians
         */
        toRadians(degrees) {
            return degrees * (Math.PI / 180);
        },

        /**
         * Generate a random ID
         */
        generateId() {
            return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        },

        /**
         * Store item in localStorage with error handling
         */
        setLocalStorage(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Failed to save to localStorage:', error);
                return false;
            }
        },

        /**
         * Get item from localStorage with error handling
         */
        getLocalStorage(key, defaultValue = null) {
            try {
                const stored = localStorage.getItem(key);
                return stored ? JSON.parse(stored) : defaultValue;
            } catch (error) {
                console.error('Failed to get from localStorage:', error);
                return defaultValue;
            }
        },

        /**
         * Show a notification toast
         */
        showNotification(message, type = 'info', duration = CONFIG.ui.toastDuration) {
            const container = document.getElementById('notification-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `notification ${type}`;
            toast.textContent = message;

            container.appendChild(toast);

            // Animation
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => {
                    container.removeChild(toast);
                }, 300);
            }, duration);
        },

        /**
         * Show an error message
         */
        showError(message, duration = CONFIG.ui.toastDuration * 1.5) {
            const container = document.getElementById('error-container');
            if (!container) return;

            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.textContent = message;

            container.appendChild(errorEl);

            // Animation
            setTimeout(() => {
                errorEl.classList.add('removing');
                setTimeout(() => {
                    container.removeChild(errorEl);
                }, 300);
            }, duration);
        },

        /**
         * Get user's current location
         */
        getUserLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported by your browser'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    position => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    },
                    error => {
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            });
        },

        /**
         * Check if the device is mobile
         */
        isMobileDevice() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },

        /**
         * Check if the connection is slow
         */
        isSlowConnection() {
            return navigator.connection &&
                (navigator.connection.saveData ||
                    ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType));
        }
    };

    /**
     * =================================================================
     * API SERVICE
     * =================================================================
     */
    const API = {
        /**
         * Cache for API responses
         */
        cache: new Map(),

        /**
         * Make a GET request to the API
         */
        async get(endpoint, params = {}, options = {}) {
            const url = this.buildUrl(endpoint, params);
            const useCache = options.useCache !== false;
            const cacheDuration = options.cacheDuration || CONFIG.api.cacheDuration;

            // Check cache first if enabled
            if (useCache) {
                const cachedResponse = this.getCachedResponse(url);
                if (cachedResponse) {
                    return cachedResponse;
                }
            }

            try {
                // Set up request with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.api.timeout);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: this.getHeaders(),
                    signal: controller.signal
                });

                // Clear timeout
                clearTimeout(timeoutId);

                // Check if response is ok
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }

                // Parse response
                const data = await response.json();

                // Cache response if caching is enabled
                if (useCache) {
                    this.cacheResponse(url, data, cacheDuration);
                }

                return data;
            } catch (error) {
                // Handle timeout error
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout for ${endpoint}`);
                }

                // Use cached data as fallback if available
                if (useCache) {
                    const cachedResponse = this.getCachedResponse(url, true);
                    if (cachedResponse) {
                        Utils.showNotification('Using cached data due to connection issues', 'warning');
                        return cachedResponse;
                    }
                }

                // Rethrow other errors
                throw error;
            }
        },

        /**
         * Make a POST request to the API
         */
        async post(endpoint, data = {}, options = {}) {
            const url = this.buildUrl(endpoint);

            try {
                // Set up request with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.api.timeout);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(data),
                    signal: controller.signal
                });

                // Clear timeout
                clearTimeout(timeoutId);

                // Check if response is ok
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }

                // Parse response
                return await response.json();
            } catch (error) {
                // Handle timeout error
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout for ${endpoint}`);
                }

                // Rethrow other errors
                throw error;
            }
        },

        /**
         * Build a URL with query parameters
         */
        buildUrl(endpoint, params = {}) {
            // Ensure endpoint starts with a slash
            if (!endpoint.startsWith('/')) {
                endpoint = `/${endpoint}`;
            }

            // Create URL
            const url = new URL(`${CONFIG.api.baseUrl}${endpoint}`);

            // Add query parameters
            Object.entries(params).forEach(([key, value]) => {
                // Handle arrays and objects
                if (typeof value === 'object' && value !== null) {
                    url.searchParams.append(key, JSON.stringify(value));
                } else {
                    url.searchParams.append(key, value);
                }
            });

            return url.toString();
        },

        /**
         * Get request headers
         */
        getHeaders() {
            return {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.api.apiKey,
                'Accept': 'application/json'
            };
        },

        /**
         * Get cached response if available and not expired
         */
        getCachedResponse(url, ignoreExpiry = false) {
            const cached = this.cache.get(url);

            if (cached && (ignoreExpiry || Date.now() < cached.expiry)) {
                console.log(`Using cached response for ${url}`);
                return cached.data;
            }

            return null;
        },

        /**
         * Cache API response
         */
        cacheResponse(url, data, duration) {
            const expiry = Date.now() + duration;
            this.cache.set(url, { data, expiry });

            // Clean up expired cache entries occasionally
            if (Math.random() < 0.1) {
                this.cleanCache();
            }
        },

        /**
         * Clean expired cache entries
         */
        cleanCache() {
            const now = Date.now();

            for (const [url, cached] of this.cache.entries()) {
                if (now >= cached.expiry) {
                    this.cache.delete(url);
                }
            }
        },

        /**
         * Clear the entire cache
         */
        clearCache() {
            this.cache.clear();
        }
    };

    /**
     * =================================================================
     * MAP MANAGER
     * =================================================================
     */
    const MapManager = {
        map: null,
        markers: [],
        businessData: [],
        selectedMarkerId: null,
        userLocation: null,
        mapReady: false,
        mapFallbackTimeout: null,

        /**
         * Initialize the map
         */
        init() {
            console.log('Initializing Map Manager');

            // Show map fallback after timeout if map doesn't load
            this.mapFallbackTimeout = setTimeout(() => {
                this.showMapFallback('Map is taking too long to load');
            }, 10000);

            // Check if map element exists
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                console.error('Map element not found');
                this.showMapFallback('Map element not found on page');
                return;
            }

            // Load the map
            this.loadMap(mapElement);

            // Initialize map controls
            this.initMapControls();
        },

        /**
         * Load the map using Mapbox GL JS
         */
        loadMap(mapElement) {
            try {
                // Check if mapbox-gl is available
                if (typeof mapboxgl === 'undefined') {
                    this.loadMapboxScript().then(() => {
                        this.createMap(mapElement);
                    }).catch(error => {
                        throw new Error('Failed to load Mapbox GL JS: ' + error.message);
                    });
                } else {
                    this.createMap(mapElement);
                }
            } catch (error) {
                console.error('Failed to initialize map:', error);
                this.showMapFallback(error.message);
            }
        },

        /**
         * Load Mapbox GL JS script dynamically
         */
        loadMapboxScript() {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.9.1/mapbox-gl.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);

                const link = document.createElement('link');
                link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.9.1/mapbox-gl.css';
                link.rel = 'stylesheet';
                document.head.appendChild(link);
            });
        },

        /**
         * Create the Mapbox map
         */
        createMap(mapElement) {
            // Set mapbox access token
            mapboxgl.accessToken = CONFIG.map.mapboxToken;

            // Create the map
            this.map = new mapboxgl.Map({
                container: mapElement,
                style: CONFIG.map.style,
                center: [CONFIG.map.center.lng, CONFIG.map.center.lat],
                zoom: CONFIG.map.defaultZoom,
                minZoom: CONFIG.map.minZoom,
                maxZoom: CONFIG.map.maxZoom,
                attributionControl: true,
                localIdeographFontFamily: "'Open Sans', sans-serif"
            });

            // Add map controls
            this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
            this.map.addControl(new mapboxgl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true
                },
                trackUserLocation: true
            }), 'top-right');

            // Add scale control
            this.map.addControl(new mapboxgl.ScaleControl({
                maxWidth: 100,
                unit: 'imperial'
            }), 'bottom-left');

            // Set up event listeners
            this.setupMapEventListeners();

            console.log('Map created successfully');
        },

        /**
         * Set up map event listeners
         */
        setupMapEventListeners() {
            if (!this.map) return;

            // Create optimized event handlers
            const handleMapMove = Utils.throttle(() => {
                // Update visible businesses based on map bounds
                this.updateVisibleBusinesses();
            }, 300);

            const handleMapIdle = Utils.debounce(() => {
                // Load businesses for current map view
                this.loadBusinessData();
            }, 500);

            // Apply handlers to map
            this.map.on('load', this.handleMapLoad.bind(this));
            this.map.on('move', handleMapMove);
            this.map.on('moveend', handleMapIdle);
            this.map.on('click', this.handleMapClick.bind(this));
            this.map.on('error', this.handleMapError.bind(this));
        },

        /**
         * Handle map load event
         */
        handleMapLoad() {
            console.log('Map loaded');

            // Clear fallback timeout
            clearTimeout(this.mapFallbackTimeout);

            // Add custom map layers
            this.addMapLayers();

            // Load initial data
            this.loadBusinessData();

            // Set map as ready
            this.mapReady = true;

            // Hide map fallback if it's showing
            document.getElementById('map-fallback')?.classList.remove('active');

            // Dispatch map ready event
            document.dispatchEvent(new CustomEvent('mapReady', {
                detail: { map: this.map }
            }));
        },

        /**
         * Add custom layers to the map
         */
        addMapLayers() {
            if (!this.map) return;

            // Add custom source for markers
            this.map.addSource('businesses', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add business markers layer
            this.map.addLayer({
                id: 'business-markers',
                type: 'symbol',
                source: 'businesses',
                layout: {
                    'icon-image': ['get', 'icon'],
                    'icon-size': 1,
                    'icon-allow-overlap': true,
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Regular'],
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-size': 12
                },
                paint: {
                    'text-color': '#333',
                    'text-halo-color': '#fff',
                    'text-halo-width': 1
                }
            });
        },

        /**
         * Handle map click event
         */
        handleMapClick(e) {
            if (!this.map) return;

            // Check if a marker was clicked
            const features = this.map.queryRenderedFeatures(e.point, {
                layers: ['business-markers']
            });

            if (features.length) {
                // Get the clicked marker's data
                const feature = features[0];
                const businessId = feature.properties.id;

                // Show business details
                this.selectBusiness(businessId);
            } else {
                // Clear selection if clicking on the map
                this.clearSelection();
            }
        },

        /**
         * Handle map error event
         */
        handleMapError(error) {
            console.error('Map error:', error);

            // Show fallback for critical errors
            if (!this.mapReady) {
                this.showMapFallback(error.message);
            }
        },

        /**
         * Show map fallback when map fails to load
         */
        showMapFallback(errorMessage) {
            const mapFallback = document.getElementById('map-fallback');
            if (mapFallback) {
                // Add error message if provided
                if (errorMessage) {
                    const errorElement = document.createElement('p');
                    errorElement.className = 'fallback-error';
                    errorElement.textContent = `Error: ${errorMessage}`;
                    mapFallback.querySelector('.fallback-content').appendChild(errorElement);
                }

                // Show fallback
                mapFallback.classList.add('active');

                // Add retry handler
                const retryButton = document.getElementById('retry-load-btn');
                if (retryButton) {
                    retryButton.addEventListener('click', () => {
                        window.location.reload();
                    });
                }
            }
        },

        /**
         * Initialize map controls
         */
        initMapControls() {
            // Zoom in button
            document.getElementById('zoom-in')?.addEventListener('click', () => {
                if (this.map) this.map.zoomIn();
            });

            // Zoom out button
            document.getElementById('zoom-out')?.addEventListener('click', () => {
                if (this.map) this.map.zoomOut();
            });

            // Locate me button
            document.getElementById('locate-me')?.addEventListener('click', this.getUserLocation.bind(this));

            // Reset map button
            document.getElementById('reset-map')?.addEventListener('click', this.resetMap.bind(this));
        },

        /**
         * Get user's current location
         */
        getUserLocation() {
            if (!this.map) return;

            Utils.getUserLocation()
                .then(location => {
                    // Store user location
                    this.userLocation = location;

                    // Fly to user location
                    this.map.flyTo({
                        center: [location.lng, location.lat],
                        zoom: 15,
                        speed: 1.5
                    });

                    // Add or update user marker
                    this.updateUserLocationMarker(location.lat, location.lng);

                    // Update distances for businesses
                    this.updateBusinessDistances();

                    Utils.showNotification('Located you on the map', 'success');
                })
                .catch(error => {
                    console.error('Error getting user location:', error);
                    Utils.showError('Could not access your location. Please check your device settings.');
                });
        },

        /**
         * Update user location marker on the map
         */
        updateUserLocationMarker(latitude, longitude) {
            if (!this.map) return;

            // Remove existing user marker if any
            if (this.userMarker) {
                this.userMarker.remove();
            }

            // Create a DOM element for the marker
            const el = document.createElement('div');
            el.className = 'user-location-marker';

            // Create the marker
            this.userMarker = new mapboxgl.Marker({
                element: el,
                anchor: 'center'
            })
                .setLngLat([longitude, latitude])
                .addTo(this.map);
        },

        /**
         * Reset map to default view
         */
        resetMap() {
            if (!this.map) return;

            this.map.flyTo({
                center: [CONFIG.map.center.lng, CONFIG.map.center.lat],
                zoom: CONFIG.map.defaultZoom,
                speed: 1.2
            });
        },

        /**
         * Load business data from the API
         */
        async loadBusinessData() {
            if (!this.map) return;

            try {
                // Show loading indicator
                this.showLoading(true);

                // Get current map bounds
                const bounds = this.map.getBounds();

                // Call API to get businesses within these bounds
                const response = await API.get('/businesses', {
                    bounds: {
                        north: bounds.getNorth(),
                        east: bounds.getEast(),
                        south: bounds.getSouth(),
                        west: bounds.getWest()
                    }
                });

                // Store business data
                this.businessData = response.data || [];

                // Update markers
                this.updateMarkers(this.businessData);

                // Update distances if user location is known
                if (this.userLocation) {
                    this.updateBusinessDistances();
                }

                // Update results count
                document.getElementById('results-count').textContent = `(${this.businessData.length})`;

                // Update business list
                BusinessDirectory.renderBusinessList(this.businessData);

                // Dispatch data loaded event
                document.dispatchEvent(new CustomEvent('businessDataLoaded', {
                    detail: { businesses: this.businessData }
                }));

                console.log(`Loaded ${this.businessData.length} businesses`);
            } catch (error) {
                console.error('Error loading business data:', error);
                Utils.showError('Failed to load business data. Please try again.');
            } finally {
                // Hide loading indicator
                this.showLoading(false);
            }
        },

        /**
         * Update map markers with business data
         */
        updateMarkers(businesses) {
            if (!this.map || !businesses) return;

            // Create GeoJSON data
            const geojsonData = {
                type: 'FeatureCollection',
                features: businesses.map(business => {
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [business.location.lng, business.location.lat]
                        },
                        properties: {
                            id: business.id,
                            name: business.name,
                            category: business.category,
                            icon: `${business.category}-marker`
                        }
                    };
                })
            };

            // Update the source data
            const source = this.map.getSource('businesses');
            if (source) {
                source.setData(geojsonData);
            }
        },

        /**
         * Update distances for all businesses based on user location
         */
        updateBusinessDistances() {
            if (!this.userLocation || !this.businessData.length) return;

            this.businessData.forEach(business => {
                if (business.location) {
                    business.distance = Utils.calculateDistance(this.userLocation, business.location);
                }
            });

            // Dispatch event for business list to update
            document.dispatchEvent(new CustomEvent('businessDistancesUpdated', {
                detail: { businesses: this.businessData }
            }));
        },

        /**
         * Update the list of businesses that are visible in the current map view
         */
        updateVisibleBusinesses() {
            if (!this.map || !this.businessData.length) return;

            const bounds = this.map.getBounds();

            // Mark businesses as visible or not
            this.businessData.forEach(business => {
                if (business.location) {
                    business.visible = bounds.contains([business.location.lng, business.location.lat]);
                }
            });

            // Dispatch event for UI to update
            document.dispatchEvent(new CustomEvent('visibleBusinessesUpdated', {
                detail: { businesses: this.businessData.filter(b => b.visible) }
            }));
        },

        /**
         * Select a business and show its details
         */
        selectBusiness(businessId) {
            // Clear previous selection
            this.clearSelection();

            // Find the business
            const business = this.businessData.find(b => b.id === businessId);
            if (!business) return;

            // Store selected ID
            this.selectedMarkerId = businessId;

            // Highlight on map
            this.highlightMarker(businessId);

            // Pan to the marker
            this.map.flyTo({
                center: [business.location.lng, business.location.lat],
                zoom: Math.max(this.map.getZoom(), 15),
                offset: [0, -100], // Offset to account for the detail panel
                speed: 1.2
            });

            // Show business details panel
            BusinessDetails.showBusinessDetails(business);

            // Add to recently viewed
            UsabilityFeatures.addToRecentlyViewed(business);

            // Track view in analytics
            if (window.AnalyticsManager) {
                window.AnalyticsManager.trackEvent('Business', 'View', business.name);
            }
        },

        /**
         * Highlight a marker on the map
         */
        highlightMarker(businessId) {
            if (!this.map) return;

            // Set a filter to highlight the selected marker
            this.map.setFilter('highlighted-marker', ['==', 'id', businessId]);
        },

        /**
         * Clear the current selection
         */
        clearSelection() {
            if (!this.map) return;

            if (this.selectedMarkerId) {
                // Clear highlight
                this.map.setFilter('highlighted-marker', ['==', 'id', '']);

                this.selectedMarkerId = null;
            }

            // Hide business details panel
            BusinessDetails.hideBusinessDetails();
        },

        /**
         * Filter markers by category
         */
        filterMarkersByCategory(category) {
            if (!this.map) return;

            if (category && category !== 'all') {
                // Set a filter to only show markers of the selected category
                this.map.setFilter('business-markers', ['==', 'category', category]);
            } else {
                // Show all markers
                this.map.setFilter('business-markers', null);
            }
        },

        /**
         * Show loading indicator
         */
        showLoading(show) {
            const loadingIndicator = document.querySelector('.loading-indicator');
            if (loadingIndicator) {
                if (show) {
                    loadingIndicator.classList.add('active');
                } else {
                    loadingIndicator.classList.remove('active');
                }
            }
        },

        /**
         * Center map on a business
         */
        centerOnBusiness(businessId) {
            const business = this.businessData.find(b => b.id === businessId);
            if (business && business.location && this.map) {
                this.map.flyTo({
                    center: [business.location.lng, business.location.lat],
                    zoom: 16,
                    speed: 1.5
                });
            }
        }
    };

    /**
     * =================================================================
     * CATEGORY MANAGER
     * =================================================================
     */
    const CategoryManager = {
        categories: [
            { id: 'all', name: 'All', icon: 'icon-all' },
            { id: 'wineries', name: 'Wineries', icon: 'icon-wine', color: CONFIG.categoryColors.wineries },
            { id: 'restaurants', name: 'Restaurants', icon: 'icon-food', color: CONFIG.categoryColors.restaurants },
            { id: 'shopping', name: 'Shopping', icon: 'icon-shopping', color: CONFIG.categoryColors.shopping },
            { id: 'lodging', name: 'Lodging', icon: 'icon-hotel', color: CONFIG.categoryColors.lodging },
            { id: 'outdoor', name: 'Outdoor', icon: 'icon-outdoor', color: CONFIG.categoryColors.outdoor },
            { id: 'cultural', name: 'Cultural', icon: 'icon-museum', color: CONFIG.categoryColors.cultural }
        ],

        activeCategory: 'all',

        /**
         * Initialize category manager
         */
        init() {
            console.log('Initializing Category Manager');

            // Render category selector
            this.renderCategorySelector();

            // Render map legend
            this.renderMapLegend();

            // Set up event listeners
            this.setupEventListeners();

            // Get active category from localStorage if available
            const savedCategory = Utils.getLocalStorage('fredericksburg-active-category');
            if (savedCategory) {
                this.setActiveCategory(savedCategory);
            }
        },

        /**
         * Render category selector
         */
        renderCategorySelector() {
            const selector = document.getElementById('category-selector');
            if (!selector) return;

            // Clear existing content
            selector.innerHTML = '';

            // Add category options
            this.categories.forEach(category => {
                const categoryOption = document.createElement('div');
                categoryOption.className = `category-option${category.id === this.activeCategory ? ' active' : ''}`;
                categoryOption.dataset.category = category.id;

                categoryOption.innerHTML = `
                    <div class="category-icon" style="${category.color ? `color: ${category.color};` : ''}">
                        <i class="${category.icon}"></i>
                    </div>
                    <span class="category-name">${category.name}</span>
                `;

                // Add click event
                categoryOption.addEventListener('click', () => {
                    this.setActiveCategory(category.id);
                });

                selector.appendChild(categoryOption);
            });
        },

        /**
         * Render map legend
         */
        renderMapLegend() {
            const legend = document.getElementById('map-legend');
            if (!legend) return;

            // Only show categories other than 'all'
            const categories = this.categories.filter(c => c.id !== 'all');

            legend.innerHTML = `
                <h4>Map Legend</h4>
                <ul class="legend-list">
                    ${categories.map(category => `
                        <li class="legend-item">
                            <span class="legend-color" style="background-color: ${category.color}"></span>
                            <span class="legend-label">${category.name}</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Listen for changes to filter inputs
            document.querySelectorAll('.filter-options input, .filter-options select').forEach(input => {
                input.addEventListener('change', this.handleFilterChange.bind(this));
            });
        },

        /**
         * Set active category
         */
        setActiveCategory(categoryId) {
            // Update active category
            this.activeCategory = categoryId;

            // Save to localStorage
            Utils.setLocalStorage('fredericksburg-active-category', categoryId);

            // Update UI
            const categoryOptions = document.querySelectorAll('.category-option');
            categoryOptions.forEach(option => {
                if (option.dataset.category === categoryId) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });

            // Update filters for this category
            this.updateCategoryFilters(categoryId);

            // Update map markers
            MapManager.filterMarkersByCategory(categoryId === 'all' ? null : categoryId);

            // Update business list
            BusinessDirectory.filterBusinessesByCategory(categoryId);

            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('categoryChanged', {
                detail: { categoryId }
            }));
        },

        /**
         * Update category filters based on selected category
         */
        updateCategoryFilters(categoryId) {
            const filterContainer = document.getElementById('category-filters');
            if (!filterContainer) return;

            // Clear existing filters
            filterContainer.innerHTML = '';

            // If 'all' is selected, don't show category-specific filters
            if (categoryId === 'all') {
                filterContainer.innerHTML = '<p>Select a specific category to see filters</p>';
                return;
            }

            // Get the category
            const category = this.categories.find(c => c.id === categoryId);
            if (!category) return;

            // Get filters for the category
            const filters = this.getFiltersForCategory(categoryId);

            // Generate filter HTML
            let filtersHtml = '';

            filters.forEach(filter => {
                filtersHtml += `
                    <div class="filter-group">
                        <h4>${filter.label}</h4>
                        ${this.generateFilterInputs(filter)}
                    </div>
                `;
            });

            // Set HTML
            filterContainer.innerHTML = filtersHtml || '<p>No filters available for this category</p>';

            // Setup event listeners for new filters
            this.setupEventListeners();
        },

        /**
         * Generate filter inputs HTML
         */
        generateFilterInputs(filter) {
            switch (filter.type) {
                case 'checkbox':
                    return `
                        <div class="checkbox-group">
                            ${filter.options.map(option => `
                                <label class="checkbox-label">
                                    <input type="checkbox" name="${filter.name}" value="${option.value}">
                                    ${option.label}
                                </label>
                            `).join('')}
                        </div>
                    `;

                case 'radio':
                    return `
                        <div class="radio-group">
                            ${filter.options.map(option => `
                                <label class="radio-label">
                                    <input type="radio" name="${filter.name}" value="${option.value}">
                                    ${option.label}
                                </label>
                            `).join('')}
                        </div>
                    `;

                case 'select':
                    return `
                        <select class="filter-select" name="${filter.name}">
                            <option value="">All ${filter.label}</option>
                            ${filter.options.map(option => `
                                <option value="${option.value}">${option.label}</option>
                            `).join('')}
                        </select>
                    `;

                case 'range':
                    return `
                        <div class="range-slider">
                            <input type="range" name="${filter.name}" min="${filter.min}" max="${filter.max}" step="${filter.step || 1}" value="${filter.min}">
                            <div class="range-values">
                                <span class="range-min">${filter.minLabel || filter.min}</span>
                                <span class="range-value">0</span>
                                <span class="range-max">${filter.maxLabel || filter.max}</span>
                            </div>
                        </div>
                    `;

                default:
                    return '';
            }
        },

        /**
         * Get filters for a specific category
         */
        getFiltersForCategory(categoryId) {
            // Define filters for each category
            const categoryFilters = {
                wineries: [
                    {
                        name: 'wineTypes',
                        label: 'Wine Types',
                        type: 'checkbox',
                        options: [
                            { value: 'red', label: 'Red Wine' },
                            { value: 'white', label: 'White Wine' },
                            { value: 'rose', label: 'Rosé' },
                            { value: 'sparkling', label: 'Sparkling' },
                            { value: 'dessert', label: 'Dessert Wine' }
                        ]
                    },
                    {
                        name: 'features',
                        label: 'Features',
                        type: 'checkbox',
                        options: [
                            { value: 'tours', label: 'Tours Available' },
                            { value: 'tastings', label: 'Tastings' },
                            { value: 'food', label: 'Food Service' },
                            { value: 'patio', label: 'Outdoor Seating' },
                            { value: 'petFriendly', label: 'Pet Friendly' }
                        ]
                    },
                    {
                        name: 'price',
                        label: 'Price Range',
                        type: 'radio',
                        options: [
                            { value: '1', label: '$' },
                            { value: '2', label: '$$' },
                            { value: '3', label: '$$$' },
                            { value: '4', label: '$$$$' }
                        ]
                    }
                ],
                restaurants: [
                    {
                        name: 'cuisine',
                        label: 'Cuisine Type',
                        type: 'select',
                        options: [
                            { value: 'american', label: 'American' },
                            { value: 'italian', label: 'Italian' },
                            { value: 'mexican', label: 'Mexican' },
                            { value: 'german', label: 'German' },
                            { value: 'bbq', label: 'BBQ' },
                            { value: 'steakhouse', label: 'Steakhouse' },
                            { value: 'seafood', label: 'Seafood' }
                        ]
                    },
                    {
                        name: 'price',
                        label: 'Price Range',
                        type: 'radio',
                        options: [
                            { value: '1', label: '$' },
                            { value: '2', label: '$$' },
                            { value: '3', label: '$$$' },
                            { value: '4', label: '$$$$' }
                        ]
                    },
                    {
                        name: 'features',
                        label: 'Features',
                        type: 'checkbox',
                        options: [
                            { value: 'outdoor', label: 'Outdoor Seating' },
                            { value: 'delivery', label: 'Delivery' },
                            { value: 'takeout', label: 'Takeout' },
                            { value: 'reservations', label: 'Reservations' },
                            { value: 'petFriendly', label: 'Pet Friendly' }
                        ]
                    }
                ],
                lodging: [
                    {
                        name: 'lodgingType',
                        label: 'Lodging Type',
                        type: 'select',
                        options: [
                            { value: 'hotel', label: 'Hotel' },
                            { value: 'bb', label: 'Bed & Breakfast' },
                            { value: 'vacation', label: 'Vacation Rental' },
                            { value: 'cabin', label: 'Cabin' },
                            { value: 'resort', label: 'Resort' }
                        ]
                    },
                    {
                        name: 'price',
                        label: 'Price Range',
                        type: 'radio',
                        options: [
                            { value: '1', label: '$' },
                            { value: '2', label: '$$' },
                            { value: '3', label: '$$$' },
                            { value: '4', label: '$$$$' }
                        ]
                    },
                    {
                        name: 'amenities',
                        label: 'Amenities',
                        type: 'checkbox',
                        options: [
                            { value: 'pool', label: 'Swimming Pool' },
                            { value: 'wifi', label: 'Free WiFi' },
                            { value: 'breakfast', label: 'Breakfast Included' },
                            { value: 'parking', label: 'Free Parking' },
                            { value: 'petFriendly', label: 'Pet Friendly' }
                        ]
                    }
                ]
            };

            // Return filters for the requested category or empty array if none defined
            return categoryFilters[categoryId] || [];
        },

        /**
         * Handle filter change event
         */
        handleFilterChange(event) {
            // Collect all current filter values
            const filters = this.collectFilterValues();

            // Apply filters to business list
            BusinessDirectory.applyFilters(filters);

            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('filtersChanged', {
                detail: { filters }
            }));
        },

        /**
         * Collect all current filter values
         */
        collectFilterValues() {
            const filters = {};
            const filterContainer = document.getElementById('category-filters');

            if (!filterContainer) return filters;

            // Collect checkbox values
            filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
                if (!filters[input.name]) {
                    filters[input.name] = [];
                }
                filters[input.name].push(input.value);
            });

            // Collect radio values
            filterContainer.querySelectorAll('input[type="radio"]:checked').forEach(input => {
                filters[input.name] = input.value;
            });

            // Collect select values
            filterContainer.querySelectorAll('select').forEach(select => {
                if (select.value) {
                    filters[select.name] = select.value;
                }
            });

            // Collect range values
            filterContainer.querySelectorAll('input[type="range"]').forEach(range => {
                filters[range.name] = range.value;
            });

            return filters;
        }
    };

    /**
     * =================================================================
     * BUSINESS DIRECTORY
     * =================================================================
     */
    const BusinessDirectory = {
        businesses: [],
        filteredBusinesses: [],
        currentPage: 1,
        itemsPerPage: CONFIG.ui.resultsPerPage,

        /**
         * Initialize business directory
         */
        init() {
            console.log('Initializing Business Directory');

            // Set up event listeners
            this.setupEventListeners();

            // Set up pagination
            this.setupPagination();
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Listen for map data changes
            document.addEventListener('businessDataLoaded', this.handleBusinessDataLoaded.bind(this));
            document.addEventListener('businessDistancesUpdated', this.handleBusinessDistancesUpdated.bind(this));

            // Listen for search input
            document.getElementById('map-search')?.addEventListener('input', Utils.debounce(this.handleSearchInput.bind(this), 300));

            // Listen for business list item clicks
            document.getElementById('business-list')?.addEventListener('click', this.handleBusinessListClick.bind(this));
        },

        /**
         * Set up pagination
         */
        setupPagination() {
            // Next page button
            document.querySelector('.pagination-next')?.addEventListener('click', () => {
                if (this.currentPage < this.getTotalPages()) {
                    this.goToPage(this.currentPage + 1);
                }
            });

            // Previous page button
            document.querySelector('.pagination-prev')?.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.goToPage(this.currentPage - 1);
                }
            });
        },

        /**
         * Handle business data loaded event
         */
        handleBusinessDataLoaded(event) {
            this.businesses = event.detail.businesses || [];
            this.filteredBusinesses = [...this.businesses];

            // Reset pagination to first page
            this.currentPage = 1;

            // Apply any current category filter
            if (CategoryManager.activeCategory !== 'all') {
                this.filterBusinessesByCategory(CategoryManager.activeCategory);
            } else {
                this.renderBusinessList(this.filteredBusinesses);
            }
        },

        /**
         * Handle business distances updated event
         */
        handleBusinessDistancesUpdated(event) {
            this.businesses = event.detail.businesses || [];

            // Apply current filters again
            this.applyCurrentFilters();

            // Re-render with updated distances
            this.renderBusinessList(this.filteredBusinesses);
        },

        /**
         * Handle search input
         */
        handleSearchInput(event) {
            const searchTerm = event.target.value.trim().toLowerCase();

            if (searchTerm === '') {
                // If search is empty, reset to current category filter
                this.filterBusinessesByCategory(CategoryManager.activeCategory);
            } else {
                // Filter businesses by search term
                this.filteredBusinesses = this.businesses.filter(business => {
                    return (
                        business.name.toLowerCase().includes(searchTerm) ||
                        (business.description && business.description.toLowerCase().includes(searchTerm)) ||
                        (business.category && business.category.toLowerCase().includes(searchTerm))
                    );
                });

                // Reset to first page
                this.currentPage = 1;

                // Render filtered list
                this.renderBusinessList(this.filteredBusinesses);
            }
        },

        /**
         * Handle business list item click
         */
        handleBusinessListClick(event) {
            // Find the business card that was clicked or contains the clicked element
            const businessCard = event.target.closest('.business-card');

            if (businessCard) {
                const businessId = businessCard.dataset.id;

                // If favorite button was clicked
                if (event.target.closest('.favorite-btn')) {
                    UsabilityFeatures.toggleFavorite(businessId);
                    return;
                }

                // Otherwise select the business
                MapManager.selectBusiness(businessId);
            }
        },

        /**
         * Filter businesses by category
         */
        filterBusinessesByCategory(categoryId) {
            if (categoryId === 'all') {
                this.filteredBusinesses = [...this.businesses];
            } else {
                this.filteredBusinesses = this.businesses.filter(business => business.category === categoryId);
            }

            // Reset to first page
            this.currentPage = 1;

            // Apply any other current filters
            this.applyCurrentFilters();

            // Render filtered list
            this.renderBusinessList(this.filteredBusinesses);
        },

        /**
         * Apply filters to businesses
         */
        applyFilters(filters) {
            // Start with businesses filtered by category
            let filtered = [...this.filteredBusinesses];

            // Apply each filter
            Object.entries(filters).forEach(([filterName, filterValue]) => {
                switch (filterName) {
                    case 'price':
                        filtered = filtered.filter(business => business.priceRange == filterValue);
                        break;

                    case 'cuisine':
                        filtered = filtered.filter(business => business.cuisine === filterValue);
                        break;

                    case 'wineTypes':
                        filtered = filtered.filter(business => {
                            if (!business.wineTypes) return false;
                            return filterValue.some(type => business.wineTypes.includes(type));
                        });
                        break;

                    case 'features':
                        filtered = filtered.filter(business => {
                            if (!business.features) return false;
                            return filterValue.some(feature => business.features.includes(feature));
                        });
                        break;

                    case 'amenities':
                        filtered = filtered.filter(business => {
                            if (!business.amenities) return false;
                            return filterValue.some(amenity => business.amenities.includes(amenity));
                        });
                        break;

                    case 'lodgingType':
                        filtered = filtered.filter(business => business.lodgingType === filterValue);
                        break;
                }
            });

            // Update filtered businesses
            this.filteredBusinesses = filtered;

            // Reset to first page
            this.currentPage = 1;

            // Render filtered list
            this.renderBusinessList(this.filteredBusinesses);
        },

        /**
         * Apply current filters again (used after data changes)
         */
        applyCurrentFilters() {
            // Get current filters
            const filters = CategoryManager.collectFilterValues();

            // Apply filters
            this.applyFilters(filters);
        },

        /**
         * Render business list
         */
        renderBusinessList(businesses) {
            const businessList = document.getElementById('business-list');
            if (!businessList) return;

            // Clear list
            businessList.innerHTML = '';

            // Get current page of businesses
            const pageStart = (this.currentPage - 1) * this.itemsPerPage;
            const pageEnd = pageStart + this.itemsPerPage;
            const pagedBusinesses = businesses.slice(pageStart, pageEnd);

            // Update results count
            document.getElementById('results-count').textContent = `(${businesses.length})`;

            // Show empty state if no results
            if (businesses.length === 0) {
                businessList.innerHTML = `
                    <div class="empty-state">
                        <p>No businesses found matching your criteria.</p>
                        <button id="reset-filters" class="btn btn-secondary">Reset Filters</button>
                    </div>
                `;

                document.getElementById('reset-filters')?.addEventListener('click', () => {
                    // Reset category to all
                    CategoryManager.setActiveCategory('all');

                    // Clear search
                    const searchInput = document.getElementById('map-search');
                    if (searchInput) searchInput.value = '';
                });

                // Update pagination
                this.updatePagination(businesses.length);

                return;
            }

            // Create business cards for this page
            pagedBusinesses.forEach(business => {
                const card = this.createBusinessCard(business);
                businessList.appendChild(card);
            });

            // Update pagination
            this.updatePagination(businesses.length);
        },

        /**
         * Create a business card element
         */
        createBusinessCard(business) {
            const card = document.createElement('div');
            card.className = 'business-card';
            card.dataset.id = business.id;

            // Format price range
            const priceDisplay = Utils.formatPriceRange(business.priceRange);

            // Format distance if available
            const distanceDisplay = business.distance ? Utils.formatDistance(business.distance) : '';

            // Check if business is in favorites
            const isFavorite = UsabilityFeatures.isFavorite(business.id);

            card.innerHTML = `
                <div class="business-card__image">
                    <img src="${business.imageUrl || 'images/placeholder.jpg'}" alt="${business.name}" loading="lazy">
                    ${business.category ? `<span class="business-card__category">${business.category}</span>` : ''}
                </div>
                <div class="business-card__content">
                    <h3 class="business-card__name">${business.name}</h3>
                    <div class="business-card__rating">
                        <div class="star-rating">
                            ${this.renderStarRating(business.rating || 0)}
                        </div>
                        <span class="business-card__review-count">(${business.reviewCount || 0})</span>
                    </div>
                    <div class="business-card__details">
                        <span class="business-card__price">${priceDisplay}</span>
                        ${distanceDisplay ? `<span class="business-card__distance">${distanceDisplay}</span>` : ''}
                    </div>
                    <p class="business-card__description">${business.shortDescription || ''}</p>
                </div>
                <div class="business-card__actions">
                    <button class="btn btn-primary business-card__view-btn">View Details</button>
                    <button class="btn favorite-btn" aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <i class="${isFavorite ? 'icon-heart-filled' : 'icon-heart'}"></i>
                    </button>
                </div>
            `;

            return card;
        },

        /**
         * Render star rating HTML
         */
        renderStarRating(rating) {
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

            let html = '';

            // Add full stars
            for (let i = 0; i < fullStars; i++) {
                html += '<i class="icon-star-filled"></i>';
            }

            // Add half star if needed
            if (halfStar) {
                html += '<i class="icon-star-half"></i>';
            }

            // Add empty stars
            for (let i = 0; i < emptyStars; i++) {
                html += '<i class="icon-star"></i>';
            }

            return html;
        },

        /**
         * Update pagination controls
         */
        updatePagination(totalItems) {
            const paginationContainer = document.querySelector('.pagination');
            if (!paginationContainer) return;

            const totalPages = this.getTotalPages(totalItems);

            // Update pagination text
            const paginationInfo = paginationContainer.querySelector('.pagination-info');
            if (paginationInfo) {
                paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
            }

            // Update button states
            const prevButton = paginationContainer.querySelector('.pagination-prev');
            const nextButton = paginationContainer.querySelector('.pagination-next');

            if (prevButton) {
                prevButton.disabled = this.currentPage <= 1;
            }

            if (nextButton) {
                nextButton.disabled = this.currentPage >= totalPages;
            }
        },

        /**
         * Get total number of pages
         */
        getTotalPages(totalItems) {
            const items = totalItems || this.filteredBusinesses.length;
            return Math.max(1, Math.ceil(items / this.itemsPerPage));
        },

        /**
         * Go to specific page
         */
        goToPage(page) {
            const totalPages = this.getTotalPages();

            // Validate page number
            if (page < 1 || page > totalPages) return;

            // Update current page
            this.currentPage = page;

            // Render business list for this page
            this.renderBusinessList(this.filteredBusinesses);

            // Scroll to top of list
            document.getElementById('business-list')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    /**
     * =================================================================
     * BUSINESS DETAILS
     * =================================================================
     */
    const BusinessDetails = {
        currentBusiness: null,

        /**
         * Initialize business details
         */
        init() {
            console.log('Initializing Business Details');

            // Set up event listeners
            this.setupEventListeners();
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Close button
            document.querySelector('.business-detail-panel .close-panel')?.addEventListener('click', () => {
                this.hideBusinessDetails();
            });

            // Add to favorites button
            document.getElementById('add-to-favorites')?.addEventListener('click', () => {
                if (this.currentBusiness) {
                    UsabilityFeatures.toggleFavorite(this.currentBusiness.id);
                    this.updateFavoriteButton();
                }
            });

            // Add to itinerary button
            document.getElementById('add-to-itinerary')?.addEventListener('click', () => {
                if (this.currentBusiness) {
                    // Add to itinerary
                    document.dispatchEvent(new CustomEvent('addToItinerary', {
                        detail: { business: this.currentBusiness }
                    }));

                    Utils.showNotification(`Added ${this.currentBusiness.name} to your itinerary`, 'success');
                }
            });

            // Share business button
            document.getElementById('share-business')?.addEventListener('click', () => {
                if (this.currentBusiness) {
                    this.shareBusiness(this.currentBusiness);
                }
            });
        },

        /**
         * Show business details panel
         */
        showBusinessDetails(business) {
            this.currentBusiness = business;

            // Get panel element
            const detailPanel = document.querySelector('.business-detail-panel');
            const detailContainer = document.querySelector('.business-detail-container');

            if (!detailPanel || !detailContainer) return;

            // Generate detail content
            detailContainer.innerHTML = this.generateBusinessDetailHTML(business);

            // Update favorite button
            this.updateFavoriteButton();

            // Show panel
            detailPanel.classList.add('active');

            // Add to recently viewed
            UsabilityFeatures.addToRecentlyViewed(business);
        },

        /**
         * Hide business details panel
         */
        hideBusinessDetails() {
            const detailPanel = document.querySelector('.business-detail-panel');

            if (detailPanel) {
                detailPanel.classList.remove('active');
            }

            this.currentBusiness = null;
        },

        /**
         * Generate business detail HTML
         */
        generateBusinessDetailHTML(business) {
            return `
                <div class="business-detail">
                    <div class="business-detail__image">
                        <img src="${business.imageUrl || 'images/placeholder.jpg'}" alt="${business.name}">
                    </div>
                    
                    <div class="business-detail__header">
                        <h2 class="business-detail__name">${business.name}</h2>
                        <div class="business-detail__rating">
                            <div class="star-rating">
                                ${BusinessDirectory.renderStarRating(business.rating || 0)}
                            </div>
                            <span class="business-detail__review-count">(${business.reviewCount || 0} reviews)</span>
                        </div>
                    </div>
                    
                    <div class="business-detail__info">
                        <div class="business-detail__info-item">
                            <i class="icon-category"></i>
                            <span>${business.category || 'N/A'}</span>
                        </div>
                        <div class="business-detail__info-item">
                            <i class="icon-price"></i>
                            <span>${Utils.formatPriceRange(business.priceRange)}</span>
                        </div>
                        ${business.phone ? `
                            <div class="business-detail__info-item">
                                <i class="icon-phone"></i>
                                <a href="tel:${business.phone}">${business.phone}</a>
                            </div>
                        ` : ''}
                        ${business.website ? `
                            <div class="business-detail__info-item">
                                <i class="icon-website"></i>
                                <a href="${business.website}" target="_blank" rel="noopener noreferrer">Website</a>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="business-detail__address">
                        <i class="icon-location"></i>
                        <address>
                            ${business.address || 'Address not available'}
                        </address>
                    </div>
                    
                    <div class="business-detail__description">
                        <h3>About</h3>
                        <p>${business.description || 'No description available.'}</p>
                    </div>
                    
                    ${business.hours ? `
                        <div class="business-detail__hours">
                            <h3>Hours</h3>
                            <ul class="hours-list">
                                ${this.generateHoursHTML(business.hours)}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${business.features && business.features.length > 0 ? `
                        <div class="business-detail__features">
                            <h3>Features</h3>
                            <ul class="features-list">
                                ${business.features.map(feature => `
                                    <li class="feature-item">
                                        <i class="icon-check"></i>
                                        <span>${feature}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        },

        /**
         * Generate hours HTML
         */
        generateHoursHTML(hours) {
            if (!hours) return '';

            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            return days.map(day => {
                const dayHours = hours[day.toLowerCase()];
                return `
                    <li class="hours-item">
                        <span class="day">${day}</span>
                        <span class="time">${dayHours || 'Closed'}</span>
                    </li>
                `;
            }).join('');
        },

        /**
         * Update favorite button based on current state
         */
        updateFavoriteButton() {
            if (!this.currentBusiness) return;

            const favoriteButton = document.getElementById('add-to-favorites');
            if (!favoriteButton) return;

            const isFavorite = UsabilityFeatures.isFavorite(this.currentBusiness.id);

            if (isFavorite) {
                favoriteButton.innerHTML = '<i class="icon-heart-filled"></i> Remove from Favorites';
                favoriteButton.classList.add('favorited');
            } else {
                favoriteButton.innerHTML = '<i class="icon-heart"></i> Add to Favorites';
                favoriteButton.classList.remove('favorited');
            }
        },

        /**
         * Share business
         */
        shareBusiness(business) {
            // Create share URL
            const shareUrl = `${window.location.origin}${window.location.pathname}?business=${business.id}`;

            // Open share modal
            const shareModal = document.getElementById('share-modal');
            const shareInput = document.getElementById('share-link-input');

            if (shareModal && shareInput) {
                // Set share URL
                shareInput.value = shareUrl;

                // Show modal
                shareModal.classList.add('active');

                // Focus and select input
                shareInput.focus();
                shareInput.select();
            }

            // Try native share if available
            if (navigator.share) {
                navigator.share({
                    title: `Check out ${business.name} in Fredericksburg`,
                    text: `I found ${business.name} on the Fredericksburg Tourism Map!`,
                    url: shareUrl
                }).catch(err => {
                    console.error('Share failed:', err);
                });
            }
        }
    };

    /**
     * =================================================================
     * USABILITY FEATURES
     * =================================================================
     */
    const UsabilityFeatures = {
        favorites: [],
        recentlyViewed: [],
        maxRecentItems: 5,

        /**
         * Initialize usability features
         */
        init() {
            console.log('Initializing Usability Features');

            // Load data from local storage
            this.loadFromLocalStorage();

            // Set up event listeners
            this.setupEventListeners();

            // Render lists
            this.renderFavoritesList();
            this.renderRecentlyViewedList();
        },

        /**
         * Load data from local storage
         */
        loadFromLocalStorage() {
            this.favorites = Utils.getLocalStorage('fredericksburg-favorites', []);
            this.recentlyViewed = Utils.getLocalStorage('fredericksburg-recently-viewed', []);
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Manage favorites button
            document.getElementById('manage-favorites-btn')?.addEventListener('click', this.toggleManageFavorites.bind(this));

            // Clear history button
            document.getElementById('clear-history-btn')?.addEventListener('click', this.clearRecentlyViewed.bind(this));

            // Close modal button
            document.querySelector('.close-modal')?.addEventListener('click', () => {
                document.getElementById('share-modal')?.classList.remove('active');
            });

            // Copy link button
            document.getElementById('copy-link-btn')?.addEventListener('click', this.copyShareLink.bind(this));

            // Handle social share buttons
            document.querySelectorAll('.social-share-buttons .social-btn').forEach(button => {
                button.addEventListener('click', this.handleSocialShare.bind(this));
            });

            // Share map button
            document.getElementById('share-map-btn')?.addEventListener('click', this.shareMap.bind(this));

            // Print map button
            document.getElementById('print-map-btn')?.addEventListener('click', this.printMap.bind(this));

            // Offline mode button
            document.getElementById('offline-mode-btn')?.addEventListener('click', this.toggleOfflineMode.bind(this));

            // Favorites list click events
            document.getElementById('favorites-list')?.addEventListener('click', this.handleFavoritesListClick.bind(this));

            // Recently viewed list click events
            document.getElementById('recently-viewed-list')?.addEventListener('click', this.handleRecentlyViewedListClick.bind(this));
        },

        /**
         * Check if a business is favorited
         */
        isFavorite(businessId) {
            return this.favorites.some(fav => fav.id === businessId);
        },

        /**
         * Toggle favorite status of a business
         */
        toggleFavorite(businessId) {
            const isFavorite = this.isFavorite(businessId);

            if (isFavorite) {
                // Remove from favorites
                this.favorites = this.favorites.filter(fav => fav.id !== businessId);
                Utils.showNotification('Removed from favorites', 'info');
            } else {
                // Find business data
                const business = MapManager.businessData.find(b => b.id === businessId);

                if (business) {
                    // Add to favorites
                    this.favorites.push({
                        id: business.id,
                        name: business.name,
                        category: business.category,
                        imageUrl: business.imageUrl,
                        addedAt: new Date().toISOString()
                    });

                    Utils.showNotification('Added to favorites', 'success');
                }
            }

            // Save to local storage
            Utils.setLocalStorage('fredericksburg-favorites', this.favorites);

            // Update UI
            this.renderFavoritesList();
            this.updateFavoriteButtons(businessId);
        },

        /**
         * Update favorite buttons for a business
         */
        updateFavoriteButtons(businessId) {
            const isFavorite = this.isFavorite(businessId);

            // Update business cards
            document.querySelectorAll(`.business-card[data-id="${businessId}"] .favorite-btn`).forEach(button => {
                button.innerHTML = `<i class="${isFavorite ? 'icon-heart-filled' : 'icon-heart'}"></i>`;
                button.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
            });

            // Update details panel if open
            if (BusinessDetails.currentBusiness && BusinessDetails.currentBusiness.id === businessId) {
                BusinessDetails.updateFavoriteButton();
            }
        },

        /**
         * Add a business to recently viewed
         */
        addToRecentlyViewed(business) {
            // Check if already in recently viewed
            const existingIndex = this.recentlyViewed.findIndex(item => item.id === business.id);

            if (existingIndex !== -1) {
                // Remove existing entry
                this.recentlyViewed.splice(existingIndex, 1);
            }

            // Add to beginning of array
            this.recentlyViewed.unshift({
                id: business.id,
                name: business.name,
                category: business.category,
                imageUrl: business.imageUrl,
                viewedAt: new Date().toISOString()
            });

            // Limit to max items
            if (this.recentlyViewed.length > this.maxRecentItems) {
                this.recentlyViewed = this.recentlyViewed.slice(0, this.maxRecentItems);
            }

            // Save to local storage
            Utils.setLocalStorage('fredericksburg-recently-viewed', this.recentlyViewed);

            // Update UI
            this.renderRecentlyViewedList();
        },

        /**
         * Render favorites list
         */
        renderFavoritesList() {
            const favoritesList = document.getElementById('favorites-list');
            if (!favoritesList) return;

            // Clear list
            favoritesList.innerHTML = '';

            // Show empty state if no favorites
            if (this.favorites.length === 0) {
                favoritesList.innerHTML = `
                    <div class="empty-favorites-message">
                        <p>You haven't saved any favorites yet.</p>
                        <p>Click the heart icon on any business to add it to your favorites.</p>
                    </div>
                `;
                return;
            }

            // Create favorite items
            this.favorites.forEach(favorite => {
                const item = document.createElement('div');
                item.className = 'favorite-item';
                item.dataset.id = favorite.id;

                item.innerHTML = `
                    <div class="favorite-item__image">
                        <img src="${favorite.imageUrl || 'images/placeholder.jpg'}" alt="${favorite.name}">
                    </div>
                    <div class="favorite-item__content">
                        <h4 class="favorite-item__name">${favorite.name}</h4>
                        <p class="favorite-item__category">${favorite.category || ''}</p>
                    </div>
                    <button class="favorite-item__remove" aria-label="Remove from favorites">
                        <i class="icon-remove"></i>
                    </button>
                `;

                favoritesList.appendChild(item);
            });
        },

        /**
         * Render recently viewed list
         */
        renderRecentlyViewedList() {
            const recentList = document.getElementById('recently-viewed-list');
            if (!recentList) return;

            // Clear list
            recentList.innerHTML = '';

            // Show empty state if no recent items
            if (this.recentlyViewed.length === 0) {
                recentList.innerHTML = `
                    <div class="empty-history-message">
                        <p>No recently viewed businesses.</p>
                        <p>Businesses you view will appear here for quick access.</p>
                    </div>
                `;
                return;
            }

            // Create recent items
            this.recentlyViewed.forEach(recent => {
                const item = document.createElement('div');
                item.className = 'recent-item';
                item.dataset.id = recent.id;

                // Format date
                const viewedDate = new Date(recent.viewedAt);
                const formattedDate = viewedDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                });

                item.innerHTML = `
                    <div class="recent-item__image">
                        <img src="${recent.imageUrl || 'images/placeholder.jpg'}" alt="${recent.name}">
                    </div>
                    <div class="recent-item__content">
                        <h4 class="recent-item__name">${recent.name}</h4>
                        <p class="recent-item__meta">
                            <span class="recent-item__category">${recent.category || ''}</span>
                            <span class="recent-item__date">${formattedDate}</span>
                        </p>
                    </div>
                `;

                recentList.appendChild(item);
            });
        },

        /**
         * Toggle manage favorites mode
         */
        toggleManageFavorites() {
            const favoritesList = document.getElementById('favorites-list');
            if (!favoritesList) return;

            const isManaging = favoritesList.classList.toggle('managing');

            const manageButton = document.getElementById('manage-favorites-btn');
            if (manageButton) {
                manageButton.textContent = isManaging ? 'Done' : 'Manage';
            }
        },

        /**
         * Clear recently viewed list
         */
        clearRecentlyViewed() {
            this.recentlyViewed = [];

            // Save to local storage
            Utils.setLocalStorage('fredericksburg-recently-viewed', []);

            // Update UI
            this.renderRecentlyViewedList();

            Utils.showNotification('Recently viewed list cleared', 'info');
        },

        /**
         * Handle favorites list click
         */
        handleFavoritesListClick(event) {
            const favoriteItem = event.target.closest('.favorite-item');
            if (!favoriteItem) return;

            const businessId = favoriteItem.dataset.id;

            // Check if remove button was clicked
            if (event.target.closest('.favorite-item__remove')) {
                this.toggleFavorite(businessId);
                return;
            }

            // Otherwise show business details
            MapManager.selectBusiness(businessId);
        },

        /**
         * Handle recently viewed list click
         */
        handleRecentlyViewedListClick(event) {
            const recentItem = event.target.closest('.recent-item');
            if (!recentItem) return;

            const businessId = recentItem.dataset.id;

            // Show business details
            MapManager.selectBusiness(businessId);
        },

        /**
         * Copy share link
         */
        copyShareLink() {
            const shareInput = document.getElementById('share-link-input');
            if (!shareInput) return;

            // Select and copy
            shareInput.select();
            document.execCommand('copy');

            // Show success notification
            Utils.showNotification('Link copied to clipboard', 'success');
        },

        /**
         * Handle social share button click
         */
        handleSocialShare(event) {
            const button = event.currentTarget;
            const shareUrl = document.getElementById('share-link-input')?.value || window.location.href;
            const shareTitle = 'Fredericksburg Tourism Map';
            const shareText = 'Check out this interactive map of Fredericksburg, Texas!';

            let shareLink = '';

            // Get platform from button class
            if (button.classList.contains('facebook')) {
                shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            } else if (button.classList.contains('twitter')) {
                shareLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
            } else if (button.classList.contains('pinterest')) {
                shareLink = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}`;
            }

            // Open share dialog
            if (shareLink) {
                window.open(shareLink, '_blank', 'width=600,height=400');
            }

            // Close modal
            document.getElementById('share-modal')?.classList.remove('active');
        },

        /**
         * Share the map
         */
        shareMap() {
            // Open share modal
            const shareModal = document.getElementById('share-modal');
            const shareInput = document.getElementById('share-link-input');

            if (shareModal && shareInput) {
                // Set share URL
                shareInput.value = window.location.href;

                // Show modal
                shareModal.classList.add('active');

                // Focus and select input
                shareInput.focus();
                shareInput.select();
            }

            // Try native share if available
            if (navigator.share) {
                navigator.share({
                    title: 'Fredericksburg Tourism Map',
                    text: 'Check out this interactive map of Fredericksburg, Texas!',
                    url: window.location.href
                }).catch(err => {
                    console.error('Share failed:', err);
                });
            }
        },

        /**
         * Print the map
         */
        printMap() {
            // Create print-friendly version
            const printContent = this.generatePrintContent();

            // Open print dialog
            window.print();
        },

        /**
         * Generate print-friendly content
         */
        generatePrintContent() {
            // Create print stylesheet
            if (!document.getElementById('print-styles')) {
                const printStyles = document.createElement('style');
                printStyles.id = 'print-styles';
                printStyles.innerHTML = `
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .map-container, .map-container * {
                            visibility: visible;
                        }
                        .map-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                        }
                        .business-list-print {
                            visibility: visible;
                            position: absolute;
                            left: 0;
                            top: 50%;
                            width: 100%;
                        }
                    }
                `;
                document.head.appendChild(printStyles);
            }

            // Create business list for print
            if (!document.querySelector('.business-list-print')) {
                const printList = document.createElement('div');
                printList.className = 'business-list-print';

                // Add visible businesses
                printList.innerHTML = `
                    <h2>Businesses in View</h2>
                    <ul>
                        ${MapManager.businessData.filter(b => b.visible).map(business => `
                            <li>${business.name} - ${business.category}</li>
                        `).join('')}
                    </ul>
                `;

                document.body.appendChild(printList);
            }
        },

        /**
         * Toggle offline mode
         */
        toggleOfflineMode() {
            if (!CONFIG.features.offlineMode) {
                Utils.showNotification('Offline mode is not available in this version', 'warning');
                return;
            }

            // Check if service worker is available
            if ('serviceWorker' in navigator) {
                Utils.showNotification('Saving map data for offline use...', 'info');

                // Trigger cache update
                this.cacheMapForOffline()
                    .then(() => {
                        Utils.showNotification('Map data saved for offline use', 'success');
                    })
                    .catch(error => {
                        console.error('Failed to cache for offline:', error);
                        Utils.showError('Failed to save map for offline use');
                    });
            } else {
                Utils.showError('Offline mode is not supported in your browser');
            }
        },

        /**
         * Cache map data for offline use
         */
        async cacheMapForOffline() {
            return new Promise((resolve, reject) => {
                // Simulate caching process
                setTimeout(() => {
                    // In a real implementation, this would interact with the service worker
                    resolve();
                }, 2000);
            });
        }
    };

    /**
     * =================================================================
     * TOUCH OPTIMIZATION
     * =================================================================
     */
    const TouchOptimizer = {
        /**
         * Initialize touch optimization
         */
        init() {
            console.log('Initializing Touch Optimization');

            // Check if device supports touch
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                document.documentElement.classList.add('touch-device');

                // Initialize swipe detection
                this.initSwipeDetection();

                // Initialize pull-to-refresh
                this.initPullToRefresh();

                // Initialize floating action button
                this.initFloatingActionButton();

                // Initialize bottom sheet
                this.initBottomSheet();
            }
        },

        /**
         * Initialize swipe detection
         */
        initSwipeDetection() {
            let touchStartX = 0;
            let touchStartY = 0;
            let touchEndX = 0;
            let touchEndY = 0;
            const minSwipeDistance = 50;

            // Detect touch start
            document.addEventListener('touchstart', function (event) {
                touchStartX = event.changedTouches[0].screenX;
                touchStartY = event.changedTouches[0].screenY;
            }, { passive: true });

            // Detect touch end
            document.addEventListener('touchend', function (event) {
                touchEndX = event.changedTouches[0].screenX;
                touchEndY = event.changedTouches[0].screenY;

                // Calculate distance
                const distanceX = touchEndX - touchStartX;
                const distanceY = touchEndY - touchStartY;

                // Check if swipe length is sufficient
                if (Math.abs(distanceX) > minSwipeDistance || Math.abs(distanceY) > minSwipeDistance) {
                    // Determine direction
                    const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);

                    if (isHorizontal) {
                        if (distanceX > 0) {
                            // Right swipe
                            document.dispatchEvent(new CustomEvent('swiperight', {
                                detail: {
                                    distance: distanceX,
                                    target: event.target
                                }
                            }));
                        } else {
                            // Left swipe
                            document.dispatchEvent(new CustomEvent('swipeleft', {
                                detail: {
                                    distance: distanceX,
                                    target: event.target
                                }
                            }));
                        }
                    } else {
                        if (distanceY > 0) {
                            // Down swipe
                            document.dispatchEvent(new CustomEvent('swipedown', {
                                detail: {
                                    distance: distanceY,
                                    target: event.target
                                }
                            }));
                        } else {
                            // Up swipe
                            document.dispatchEvent(new CustomEvent('swipeup', {
                                detail: {
                                    distance: distanceY,
                                    target: event.target
                                }
                            }));
                        }
                    }
                }
            }, { passive: true });

            // Handle business details panel swipe
            document.addEventListener('swiperight', function (event) {
                const detailPanel = document.querySelector('.business-detail-panel');
                if (detailPanel && detailPanel.classList.contains('active')) {
                    if (event.detail.target.closest('.business-detail-panel')) {
                        BusinessDetails.hideBusinessDetails();
                    }
                }
            });
        },

        /**
         * Initialize pull-to-refresh
         */
        initPullToRefresh() {
            const contentWrapper = document.querySelector('.map-container');

            if (!contentWrapper) return;

            // Create refresh indicator element
            const refreshIndicator = document.createElement('div');
            refreshIndicator.className = 'refresh-indicator';
            refreshIndicator.innerHTML = `
                <div class="refresh-spinner">
                    <svg viewBox="0 0 50 50" class="refresh-circular">
                        <circle class="refresh-path" cx="25" cy="25" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
                    </svg>
                </div>
                <div class="refresh-text">Pull down to refresh</div>
            `;

            // Insert indicator at the top of the content
            contentWrapper.insertBefore(refreshIndicator, contentWrapper.firstChild);

            // State variables
            let startY = 0;
            let currentY = 0;
            let refreshing = false;
            let startedPulling = false;
            const MAX_PULL_DISTANCE = 150;
            const REFRESH_THRESHOLD = 100;

            // Handle touch start
            contentWrapper.addEventListener('touchstart', function (e) {
                // Only allow pull-to-refresh when at the top of the page
                if (window.scrollY === 0) {
                    startY = e.touches[0].clientY;
                    startedPulling = true;
                    refreshIndicator.style.transition = 'none';
                }
            }, { passive: true });

            // Handle touch move
            contentWrapper.addEventListener('touchmove', function (e) {
                if (!startedPulling || refreshing) return;

                currentY = e.touches[0].clientY;
                let pullDistance = currentY - startY;

                // Only activate when pulling down
                if (pullDistance > 0) {
                    // For better feel, we apply some resistance to the pull
                    pullDistance = Math.min(MAX_PULL_DISTANCE, pullDistance * 0.5);

                    // Apply transform to show the indicator
                    refreshIndicator.style.transform = `translateY(${pullDistance}px)`;

                    // Update indicator text based on threshold
                    if (pullDistance >= REFRESH_THRESHOLD) {
                        refreshIndicator.querySelector('.refresh-text').textContent = 'Release to refresh';
                    } else {
                        refreshIndicator.querySelector('.refresh-text').textContent = 'Pull down to refresh';
                    }

                    // Add a dampening effect to the content
                    contentWrapper.style.transform = `translateY(${pullDistance * 0.3}px)`;

                    // Prevent default to avoid scrolling
                    e.preventDefault();
                }
            }, { passive: false });

            // Handle touch end
            contentWrapper.addEventListener('touchend', function () {
                if (!startedPulling) return;

                startedPulling = false;

                // Calculate final pull distance
                const pullDistance = currentY - startY;

                // Reset transitions
                refreshIndicator.style.transition = 'transform 0.3s ease-out';
                contentWrapper.style.transition = 'transform 0.3s ease-out';

                // Check if we've pulled far enough to trigger a refresh
                if (pullDistance >= REFRESH_THRESHOLD && !refreshing) {
                    // Trigger refresh
                    refreshing = true;

                    // Position indicator at threshold
                    refreshIndicator.style.transform = `translateY(${REFRESH_THRESHOLD}px)`;
                    refreshIndicator.querySelector('.refresh-text').textContent = 'Refreshing...';
                    refreshIndicator.querySelector('.refresh-spinner').classList.add('spinning');

                    // Add haptic feedback
                    if ('vibrate' in navigator) {
                        navigator.vibrate(30);
                    }

                    // Reset content position
                    contentWrapper.style.transform = 'translateY(0)';

                    // Refresh data (reload map data)
                    MapManager.loadBusinessData().then(() => {
                        // Reset refreshing state
                        refreshing = false;

                        // Hide indicator
                        refreshIndicator.style.transform = 'translateY(0)';
                        refreshIndicator.querySelector('.refresh-spinner').classList.remove('spinning');

                        // Show success message
                        Utils.showNotification('Data refreshed successfully!', 'success');
                    });
                } else {
                    // Reset indicator and content position
                    refreshIndicator.style.transform = 'translateY(0)';
                    contentWrapper.style.transform = 'translateY(0)';
                }
            });
        },

        /**
         * Initialize floating action button
         */
        initFloatingActionButton() {
            const fabButton = document.getElementById('main-fab');
            const fabMenu = document.getElementById('fab-menu');
            const fabBackdrop = document.getElementById('fab-backdrop');

            if (!fabButton || !fabMenu || !fabBackdrop) return;

            // Toggle menu on button click
            fabButton.addEventListener('click', () => {
                const isOpen = fabMenu.classList.contains('open');

                if (isOpen) {
                    this.closeFabMenu();
                } else {
                    this.openFabMenu();
                }

                // Trigger haptic feedback
                if ('vibrate' in navigator) {
                    navigator.vibrate(20);
                }
            });

            // Close menu when backdrop is clicked
            fabBackdrop.addEventListener('click', () => {
                this.closeFabMenu();
            });

            // Set up FAB item actions
            document.getElementById('fab-near-me')?.addEventListener('click', () => {
                this.closeFabMenu();
                MapManager.getUserLocation();
            });

            document.getElementById('fab-favor
                    document.getElementById('fab-itinerary')?.addEventListener('click', () => {
                        this.closeFabMenu();
                        // Show itinerary panel
                        document.getElementById('itinerary-builder')?.classList.add('active');
                    });

            document.getElementById('fab-filters')?.addEventListener('click', () => {
                this.closeFabMenu();
                // Show filters in bottom sheet
                this.openBottomSheet();
            });
        },

        /**
         * Open FAB menu
         */
        openFabMenu() {
            const fabButton = document.getElementById('main-fab');
            const fabMenu = document.getElementById('fab-menu');
            const fabBackdrop = document.getElementById('fab-backdrop');

            if (!fabButton || !fabMenu || !fabBackdrop) return;

            fabMenu.classList.add('open');
            fabBackdrop.classList.add('open');
            fabButton.classList.add('active');
            fabButton.innerHTML = '<i class="icon-close"></i>';
        },

        /**
         * Close FAB menu
         */
        closeFabMenu() {
            const fabButton = document.getElementById('main-fab');
            const fabMenu = document.getElementById('fab-menu');
            const fabBackdrop = document.getElementById('fab-backdrop');

            if (!fabButton || !fabMenu || !fabBackdrop) return;

            fabMenu.classList.remove('open');
            fabBackdrop.classList.remove('open');
            fabButton.classList.remove('active');
            fabButton.innerHTML = '<i class="icon-plus"></i>';
        },

        /**
         * Initialize bottom sheet
         */
        initBottomSheet() {
            const bottomSheet = document.getElementById('bottom-sheet');
            const bottomSheetOverlay = document.getElementById('bottom-sheet-overlay');
            const bottomSheetHandle = document.getElementById('bottom-sheet-handle');
            const bottomSheetClose = document.getElementById('bottom-sheet-close');

            if (!bottomSheet || !bottomSheetOverlay) return;

            // Close button
            bottomSheetClose?.addEventListener('click', () => {
                this.closeBottomSheet();
            });

            // Overlay click
            bottomSheetOverlay.addEventListener('click', () => {
                this.closeBottomSheet();
            });

            // Handle drag to open/close
            if (bottomSheetHandle) {
                let startY = 0;
                let currentY = 0;
                let startHeight = 0;

                bottomSheetHandle.addEventListener('touchstart', (e) => {
                    startY = e.touches.clientY;
                    startHeight = bottomSheet.offsetHeight;
                    bottomSheet.style.transition = 'none';
                }, { passive: true });

                bottomSheetHandle.addEventListener('touchmove', (e) => {
                    currentY = e.touches.clientY;
                    const deltaY = currentY - startY;

                    // Calculate new height (inverted, since we drag from top)
                    const newHeight = Math.max(100, startHeight - deltaY);
                    const maxHeight = window.innerHeight * 0.8;

                    // Apply new height if within bounds
                    if (newHeight <= maxHeight) {
                        bottomSheet.style.height = `${newHeight}px`;
                    }
                }, { passive: true });

                bottomSheetHandle.addEventListener('touchend', () => {
                    bottomSheet.style.transition = 'transform 0.3s ease-out, height 0.3s ease-out';

                    // Determine if we should snap open or closed
                    const deltaY = currentY - startY;

                    if (deltaY > 100 || bottomSheet.offsetHeight < 150) {
                        // Close if dragged far enough down or height is small
                        this.closeBottomSheet();
                    } else if (deltaY < -50) {
                        // Open fully if dragged up
                        bottomSheet.style.height = `${window.innerHeight * 0.8}px`;
                    } else {
                        // Restore previous height
                        bottomSheet.style.height = `${startHeight}px`;
                    }
                });
            }

            // Apply/Reset buttons
            document.getElementById('apply-filters')?.addEventListener('click', () => {
                // Apply filters from bottom sheet
                const filters = this.collectBottomSheetFilters();
                BusinessDirectory.applyFilters(filters);
                this.closeBottomSheet();
            });

            document.getElementById('reset-filters')?.addEventListener('click', () => {
                // Reset filters in bottom sheet
                const filterInputs = document.querySelectorAll('#bottom-sheet-content input, #bottom-sheet-content select');
                filterInputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else if (input.type === 'range') {
                        input.value = input.min;
                    } else {
                        input.value = '';
                    }
                });
            });
        },

        /**
         * Open bottom sheet
         */
        openBottomSheet() {
            const bottomSheet = document.getElementById('bottom-sheet');
            const bottomSheetOverlay = document.getElementById('bottom-sheet-overlay');
            const bottomSheetContent = document.getElementById('bottom-sheet-content');

            if (!bottomSheet || !bottomSheetOverlay || !bottomSheetContent) return;

            // Copy filters from sidebar to bottom sheet
            const sidebarFilters = document.getElementById('category-filters');
            if (sidebarFilters) {
                bottomSheetContent.innerHTML = sidebarFilters.innerHTML;
            } else {
                bottomSheetContent.innerHTML = '<p>No filters available for the current category</p>';
            }

            // Show bottom sheet
            bottomSheet.classList.add('open');
            bottomSheetOverlay.classList.add('open');

            // Add haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(20);
            }
        },

        /**
         * Close bottom sheet
         */
        closeBottomSheet() {
            const bottomSheet = document.getElementById('bottom-sheet');
            const bottomSheetOverlay = document.getElementById('bottom-sheet-overlay');

            if (!bottomSheet || !bottomSheetOverlay) return;

            // Hide bottom sheet
            bottomSheet.classList.remove('open');
            bottomSheetOverlay.classList.remove('open');

            // Reset any height adjustments
            setTimeout(() => {
                bottomSheet.style.height = '';
            }, 300);
        },

        /**
         * Collect filters from bottom sheet
         */
        collectBottomSheetFilters() {
            const filters = {};
            const bottomSheetContent = document.getElementById('bottom-sheet-content');

            if (!bottomSheetContent) return filters;

            // Collect checkbox values
            bottomSheetContent.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
                if (!filters[input.name]) {
                    filters[input.name] = [];
                }
                filters[input.name].push(input.value);
            });

            // Collect radio values
            bottomSheetContent.querySelectorAll('input[type="radio"]:checked').forEach(input => {
                filters[input.name] = input.value;
            });

            // Collect select values
            bottomSheetContent.querySelectorAll('select').forEach(select => {
                if (select.value) {
                    filters[select.name] = select.value;
                }
            });

            // Collect range values
            bottomSheetContent.querySelectorAll('input[type="range"]').forEach(range => {
                filters[range.name] = range.value;
            });

            return filters;
        }
    };

    /**
     * =================================================================
     * ITINERARY BUILDER
     * =================================================================
     */
    const ItineraryBuilder = {
        itineraryItems: [],

        /**
         * Initialize itinerary builder
         */
        init() {
            console.log('Initializing Itinerary Builder');

            // Load itinerary from local storage
            this.loadItinerary();

            // Set up event listeners
            this.setupEventListeners();

            // Render itinerary
            this.renderItinerary();
        },

        /**
         * Load itinerary from local storage
         */
        loadItinerary() {
            this.itineraryItems = Utils.getLocalStorage('fredericksburg-itinerary', []);
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Open itinerary panel
            document.getElementById('add-to-itinerary')?.addEventListener('click', () => {
                if (BusinessDetails.currentBusiness) {
                    this.addToItinerary(BusinessDetails.currentBusiness);
                }
            });

            // Close itinerary panel
            document.querySelector('#itinerary-builder .close-panel')?.addEventListener('click', () => {
                document.getElementById('itinerary-builder')?.classList.remove('active');
            });

            // Save itinerary
            document.getElementById('save-itinerary')?.addEventListener('click', this.saveItinerary.bind(this));

            // Share itinerary
            document.getElementById('share-itinerary')?.addEventListener('click', this.shareItinerary.bind(this));

            // Print itinerary
            document.getElementById('print-itinerary')?.addEventListener('click', this.printItinerary.bind(this));

            // Listen for add to itinerary events
            document.addEventListener('addToItinerary', (event) => {
                if (event.detail && event.detail.business) {
                    this.addToItinerary(event.detail.business);
                }
            });

            // Itinerary items list click handler
            document.getElementById('itinerary-items')?.addEventListener('click', this.handleItineraryItemClick.bind(this));
        },

        /**
         * Add a business to the itinerary
         */
        addToItinerary(business) {
            // Check if business is already in itinerary
            const existingIndex = this.itineraryItems.findIndex(item => item.id === business.id);

            if (existingIndex !== -1) {
                Utils.showNotification(`${business.name} is already in your itinerary`, 'info');
                document.getElementById('itinerary-builder')?.classList.add('active');
                return;
            }

            // Add to itinerary
            this.itineraryItems.push({
                id: business.id,
                name: business.name,
                category: business.category,
                imageUrl: business.imageUrl,
                location: business.location,
                address: business.address,
                order: this.itineraryItems.length + 1,
                addedAt: new Date().toISOString()
            });

            // Save to local storage
            Utils.setLocalStorage('fredericksburg-itinerary', this.itineraryItems);

            // Render itinerary
            this.renderItinerary();

            // Show itinerary panel
            document.getElementById('itinerary-builder')?.classList.add('active');

            // Show notification
            Utils.showNotification(`Added ${business.name} to your itinerary`, 'success');
        },

        /**
         * Remove an item from the itinerary
         */
        removeFromItinerary(businessId) {
            // Remove business from itinerary
            this.itineraryItems = this.itineraryItems.filter(item => item.id !== businessId);

            // Recalculate order
            this.itineraryItems.forEach((item, index) => {
                item.order = index + 1;
            });

            // Save to local storage
            Utils.setLocalStorage('fredericksburg-itinerary', this.itineraryItems);

            // Render itinerary
            this.renderItinerary();

            // Show notification
            Utils.showNotification('Removed from your itinerary', 'info');
        },

        /**
         * Render itinerary
         */
        renderItinerary() {
            const itineraryContainer = document.getElementById('itinerary-items');
            if (!itineraryContainer) return;

            // Clear container
            itineraryContainer.innerHTML = '';

            // Show empty state if itinerary is empty
            if (this.itineraryItems.length === 0) {
                itineraryContainer.innerHTML = `
                <div class="empty-state">
                    <p>Your itinerary is empty.</p>
                    <p>Add places from the map to create your perfect Fredericksburg experience!</p>
                </div>
            `;
                return;
            }

            // Sort items by order
            const sortedItems = [...this.itineraryItems].sort((a, b) => a.order - b.order);

            // Create itinerary list
            const itemsList = document.createElement('div');
            itemsList.className = 'itinerary-list';

            // Add items
            sortedItems.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'itinerary-item';
                itemElement.dataset.id = item.id;

                itemElement.innerHTML = `
                <div class="itinerary-item__order">${item.order}</div>
                <div class="itinerary-item__image">
                    <img src="${item.imageUrl || 'images/placeholder.jpg'}" alt="${item.name}">
                </div>
                <div class="itinerary-item__content">
                    <h4 class="itinerary-item__name">${item.name}</h4>
                    <p class="itinerary-item__category">${item.category || ''}</p>
                    <p class="itinerary-item__address">${item.address || ''}</p>
                </div>
                <div class="itinerary-item__actions">
                    <button class="itinerary-item__view" aria-label="View on map">
                        <i class="icon-map-pin"></i>
                    </button>
                    <button class="itinerary-item__remove" aria-label="Remove from itinerary">
                        <i class="icon-remove"></i>
                    </button>
                </div>
            `;

                itemsList.appendChild(itemElement);
            });

            // Add drag-to-reorder hint
            const reorderHint = document.createElement('p');
            reorderHint.className = 'reorder-hint';
            reorderHint.textContent = 'Drag items to reorder your itinerary';

            // Add to container
            itineraryContainer.appendChild(itemsList);
            itineraryContainer.appendChild(reorderHint);

            // Initialize drag-to-reorder
            this.initDragToReorder();
        },

        /**
         * Initialize drag-to-reorder functionality
         */
        initDragToReorder() {
            const itineraryItems = document.querySelectorAll('.itinerary-item');

            itineraryItems.forEach(item => {
                item.setAttribute('draggable', 'true');

                // Set up drag events
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', item.dataset.id);
                    item.classList.add('dragging');
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                });

                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    item.classList.add('drag-over');
                });

                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over');
                });

                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    item.classList.remove('drag-over');

                    const draggedItemId = e.dataTransfer.getData('text/plain');
                    const dropTargetId = item.dataset.id;

                    // Don't do anything if dropping on the same item
                    if (draggedItemId === dropTargetId) return;

                    // Find the items being reordered
                    const draggedItem = this.itineraryItems.find(i => i.id === draggedItemId);
                    const dropTarget = this.itineraryItems.find(i => i.id === dropTargetId);

                    if (!draggedItem || !dropTarget) return;

                    // Get current orders
                    const draggedOrder = draggedItem.order;
                    const dropOrder = dropTarget.order;

                    // Reorder items
                    this.itineraryItems.forEach(item => {
                        if (item.id === draggedItemId) {
                            item.order = dropOrder;
                        } else if (draggedOrder < dropOrder) {
                            // Moving down
                            if (item.order > draggedOrder && item.order <= dropOrder) {
                                item.order--;
                            }
                        } else {
                            // Moving up
                            if (item.order < draggedOrder && item.order >= dropOrder) {
                                item.order++;
                            }
                        }
                    });

                    // Save to local storage
                    Utils.setLocalStorage('fredericksburg-itinerary', this.itineraryItems);

                    // Re-render itinerary
                    this.renderItinerary();
                });
            });
        },

        /**
         * Handle clicks on itinerary items
         */
        handleItineraryItemClick(event) {
            const itineraryItem = event.target.closest('.itinerary-item');
            if (!itineraryItem) return;

            const businessId = itineraryItem.dataset.id;

            // Check if view button was clicked
            if (event.target.closest('.itinerary-item__view')) {
                // Show on map
                MapManager.selectBusiness(businessId);
                return;
            }

            // Check if remove button was clicked
            if (event.target.closest('.itinerary-item__remove')) {
                this.removeFromItinerary(businessId);
                return;
            }
        },

        /**
         * Save itinerary
         */
        saveItinerary() {
            if (this.itineraryItems.length === 0) {
                Utils.showNotification('Your itinerary is empty. Add some places first!', 'warning');
                return;
            }

            // Create URL with itinerary data
            const itineraryData = this.itineraryItems.map(item => ({
                id: item.id,
                order: item.order
            }));

            const itineraryParam = encodeURIComponent(JSON.stringify(itineraryData));
            const shareUrl = `${window.location.origin}${window.location.pathname}?itinerary=${itineraryParam}`;

            // Create save options
            const saveOptions = document.createElement('div');
            saveOptions.className = 'save-options';
            saveOptions.innerHTML = `
            <h3>Save Your Itinerary</h3>
            <div class="save-option">
                <button class="btn btn-secondary copy-link">Copy Link</button>
                <p>Copy a link to share your itinerary or access it later</p>
            </div>
            <div class="save-option">
                <button class="btn btn-secondary download-pdf">Download PDF</button>
                <p>Save as PDF for printing or offline viewing</p>
            </div>
            <div class="save-option">
                <button class="btn btn-secondary send-email">Send via Email</button>
                <p>Email your itinerary to yourself or others</p>
            </div>
        `;

            // Add to itinerary container temporarily
            const itineraryContent = document.querySelector('.panel-content');
            const originalContent = itineraryContent.innerHTML;
            itineraryContent.innerHTML = '';
            itineraryContent.appendChild(saveOptions);

            // Add event listeners to buttons
            saveOptions.querySelector('.copy-link').addEventListener('click', () => {
                // Copy link to clipboard
                const tempInput = document.createElement('input');
                document.body.appendChild(tempInput);
                tempInput.value = shareUrl;
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);

                Utils.showNotification('Itinerary link copied to clipboard', 'success');

                // Restore original content
                itineraryContent.innerHTML = originalContent;
                this.renderItinerary();
            });

            saveOptions.querySelector('.download-pdf').addEventListener('click', () => {
                // Generate and download PDF
                this.generateItineraryPDF();

                // Restore original content
                itineraryContent.innerHTML = originalContent;
                this.renderItinerary();
            });

            saveOptions.querySelector('.send-email').addEventListener('click', () => {
                // Open email compose window
                window.location.href = `mailto:?subject=My%20Fredericksburg%20Itinerary&body=Check%20out%20my%20Fredericksburg%20itinerary:%0A%0A${encodeURIComponent(shareUrl)}`;

                // Restore original content
                setTimeout(() => {
                    itineraryContent.innerHTML = originalContent;
                    this.renderItinerary();
                }, 500);
            });
        },

        /**
         * Generate PDF for the itinerary
         */
        generateItineraryPDF() {
            // In a real implementation, this would generate a PDF
            // For now, we'll simulate it with a download timeout
            Utils.showNotification('Preparing PDF download...', 'info');

            setTimeout(() => {
                Utils.showNotification('Itinerary PDF downloaded', 'success');
            }, 1500);
        },

        /**
         * Share itinerary
         */
        shareItinerary() {
            if (this.itineraryItems.length === 0) {
                Utils.showNotification('Your itinerary is empty. Add some places first!', 'warning');
                return;
            }

            // Create itinerary data URL
            const itineraryData = this.itineraryItems.map(item => ({
                id: item.id,
                order: item.order
            }));

            const itineraryParam = encodeURIComponent(JSON.stringify(itineraryData));
            const shareUrl = `${window.location.origin}${window.location.pathname}?itinerary=${itineraryParam}`;

            // Open share modal
            const shareModal = document.getElementById('share-modal');
            const shareInput = document.getElementById('share-link-input');

            if (shareModal && shareInput) {
                // Set title
                const modalTitle = shareModal.querySelector('.modal-header h3');
                if (modalTitle) {
                    modalTitle.textContent = 'Share Your Itinerary';
                }

                // Set share URL
                shareInput.value = shareUrl;

                // Show modal
                shareModal.classList.add('active');

                // Focus and select input
                shareInput.focus();
                shareInput.select();
            }

            // Try native share if available
            if (navigator.share) {
                navigator.share({
                    title: 'My Fredericksburg Itinerary',
                    text: 'Check out my Fredericksburg itinerary!',
                    url: shareUrl
                }).catch(err => {
                    console.error('Share failed:', err);
                });
            }
        },

        /**
         * Print itinerary
         */
        printItinerary() {
            if (this.itineraryItems.length === 0) {
                Utils.showNotification('Your itinerary is empty. Add some places first!', 'warning');
                return;
            }

            // Create print-friendly version
            if (!document.getElementById('print-styles')) {
                const printStyles = document.createElement('style');
                printStyles.id = 'print-styles';
                printStyles.innerHTML = `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #itinerary-print, #itinerary-print * {
                        visibility: visible;
                    }
                    #itinerary-print {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `;
                document.head.appendChild(printStyles);
            }

            // Create print container if it doesn't exist
            let printContainer = document.getElementById('itinerary-print');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'itinerary-print';
                document.body.appendChild(printContainer);
            }

            // Generate print content
            printContainer.innerHTML = `
            <div class="itinerary-print-content">
                <h1>My Fredericksburg Itinerary</h1>
                <p class="print-date">Created: ${new Date().toLocaleDateString()}</p>
                
                <div class="itinerary-print-list">
                    ${this.itineraryItems.sort((a, b) => a.order - b.order).map(item => `
                        <div class="itinerary-print-item">
                            <div class="print-item-header">
                                <h2>${item.order}. ${item.name}</h2>
                                <p class="print-item-category">${item.category || ''}</p>
                            </div>
                            <p class="print-item-address">${item.address || ''}</p>
                        </div>
                    `).join('')}
                </div>
                
                <div class="itinerary-print-footer">
                    <p>Powered by Fredericksburg Tourism Interactive Map</p>
                </div>
            </div>
        `;

            // Trigger print dialog
            window.print();
        }
    };

    /**
     * =================================================================
     * APPLICATION INITIALIZATION
     * =================================================================
     */

    /**
     * Initialize all application modules
     */
    function initializeApplication() {
        console.log('Initializing Fredericksburg Tourism Map Application');

        // Start loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'initial-loading';
        loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading Fredericksburg Tourism Map...</p>
    `;
        document.body.appendChild(loadingIndicator);

        // Initialize in order of dependencies
        CategoryManager.init();
        MapManager.init();
        BusinessDirectory.init();
        BusinessDetails.init();
        UsabilityFeatures.init();
        ItineraryBuilder.init();
        TouchOptimizer.init();

        // Set up global event listeners
        setupGlobalEventListeners();

        // Remove loading indicator when map is ready
        document.addEventListener('mapReady', () => {
            loadingIndicator.classList.add('fade-out');
            setTimeout(() => {
                loadingIndicator.remove();
            }, 500);
        });

        // Initialize service worker for offline support
        if (CONFIG.features.offlineMode && 'serviceWorker' in navigator) {
            registerServiceWorker();
        }

        console.log('Application initialization complete');
    }

    /**
     * Set up global event listeners
     */
    function setupGlobalEventListeners() {
        // Mobile menu toggle
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.body.classList.toggle('mobile-menu-open');
        });

        // Search toggle
        document.getElementById('search-toggle')?.addEventListener('click', () => {
            document.body.classList.toggle('search-open');
            if (document.body.classList.contains('search-open')) {
                document.getElementById('map-search')?.focus();
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close business details
                document.querySelector('.business-detail-panel')?.classList.remove('active');

                // Close itinerary builder
                document.getElementById('itinerary-builder')?.classList.remove('active');

                // Close share modal
                document.getElementById('share-modal')?.classList.remove('active');

                // Close bottom sheet
                TouchOptimizer.closeBottomSheet();

                // Close FAB menu
                TouchOptimizer.closeFabMenu();
            }
        });

        // Window resize
        window.addEventListener('resize', Utils.debounce(() => {
            // Close mobile menu on larger screens
            if (window.innerWidth >= 768) {
                document.body.classList.remove('mobile-menu-open');
            }
        }, 250));

        // Process URL parameters on page load
        processUrlParameters();
    }

    /**
     * Register service worker for offline support
     */
    function registerServiceWorker() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    /**
     * Process URL parameters
     */
    function processUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);

        // Open business details if specified
        const businessId = urlParams.get('business');
        if (businessId) {
            // Wait for business data to load
            document.addEventListener('businessDataLoaded', () => {
                setTimeout(() => {
                    MapManager.selectBusiness(businessId);
                }, 500);
            }, { once: true });
        }

        // Load itinerary if specified
        const itineraryParam = urlParams.get('itinerary');
        if (itineraryParam) {
            try {
                const itineraryData = JSON.parse(decodeURIComponent(itineraryParam));

                // Wait for business data to load
                document.addEventListener('businessDataLoaded', () => {
                    // Add businesses to itinerary
                    itineraryData.forEach(item => {
                        const business = MapManager.businessData.find(b => b.id === item.id);
                        if (business) {
                            business.order = item.order; // Set order from itinerary data
                            ItineraryBuilder.addToItinerary(business);
                        }
                    });

                    // Show itinerary panel
                    setTimeout(() => {
                        document.getElementById('itinerary-builder')?.classList.add('active');
                    }, 1000);
                }, { once: true });
            } catch (error) {
                console.error('Failed to parse itinerary data:', error);
            }
        }
    }

    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', initializeApplication);

