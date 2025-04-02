// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBwOD8qgTe_4iDZ5KddKPEfS98qmvahI1o",
    authDomain: "itriperary-96237.firebaseapp.com",
    projectId: "itriperary-96237",
    storageBucket: "itriperary-96237.firebasestorage.app",
    messagingSenderId: "722774240779",
    appId: "1:722774240779:web:820eb4cf13d92f9293e10e"
};

// Initialize Firebase with error handling
let db;
try {
    const app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
    alert('Error initializing the application. Please check the console for details.');
}

// Global state management
const state = {
    currentTrip: null,
    currentTripId: null,
    trips: [],
    expenseChart: null,
    listeners: {
        trip: null,
        tripList: null
    }
};

// Debounce function for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimized cleanup function
function cleanupListeners() {
    Object.values(state.listeners).forEach(listener => {
        if (listener) {
            listener();
        }
    });
    state.listeners = {
        trip: null,
        tripList: null
    };
}

// Optimized UI update function
function updateUI() {
    if (!state.currentTrip) return;
    
    // Batch DOM updates
    const updates = {
        tripDetailsTitle: state.currentTrip.name,
        tripDetailsDestination: `Destination: ${state.currentTrip.destination}`,
        tripDetailsDate: `Trip Date: ${new Date(state.currentTrip.startDate).toLocaleDateString()} - ${new Date(state.currentTrip.endDate).toLocaleDateString()}`
    };

    // Apply updates
    Object.entries(updates).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    // Update expenses
    updateExpenseList();
    updateExpenseChart();
    updateTotalExpenses();
    
    // Update weather if needed
    const weatherResult = document.getElementById('weatherResult');
    if (!weatherResult.innerHTML) {
        getCoordinatesForLocation(state.currentTrip.destination).then(locationData => {
            if (locationData) {
                checkWeatherForLocation(locationData.name, locationData.lat, locationData.lon);
            }
        });
    }
}

// Optimized trip listener setup
function setupTripListener(tripId) {
    cleanupListeners();
    
    state.listeners.trip = db.collection('trips').doc(tripId).onSnapshot((doc) => {
        if (doc.exists) {
            state.currentTrip = doc.data();
            state.currentTripId = tripId;
            updateUI();
        } else {
            console.error('Trip not found');
            showFeatures();
        }
    }, (error) => {
        console.error('Error listening to trip updates:', error);
        showFeatures();
    });
}

// Optimized trip list listener
function setupTripListListener() {
    cleanupListeners();
    
    state.listeners.tripList = db.collection('trips').onSnapshot((snapshot) => {
        const tripList = document.getElementById('tripList');
        tripList.innerHTML = '';
        
        if (snapshot.empty) {
            tripList.innerHTML = '<p>No trips created yet</p>';
            return;
        }
        
        const trips = [];
        snapshot.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() });
        });
        
        state.trips = trips;
        renderTripList(trips);
    }, (error) => {
        console.error('Error listening to trips:', error);
        const tripList = document.getElementById('tripList');
        tripList.innerHTML = '<p>Error loading trips. Please refresh the page.</p>';
    });
}

// Separate render function for trip list
function renderTripList(trips) {
    const tripList = document.getElementById('tripList');
    tripList.innerHTML = trips.map(trip => `
        <div class="trip-item">
            <h3>${trip.name}</h3>
            <p>Destination: ${trip.destination}</p>
            <p>Date: ${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}</p>
            <p class="share-code">Share Code: ${trip.shareCode}</p>
            <div class="collaborators-list">
                <p>Collaborators: ${trip.collaborators.map(c => 
                    `<span class="collaborator">${c.name}${c.role === 'owner' ? ' (Owner)' : ''}</span>`
                ).join(', ')}</p>
            </div>
            <div class="trip-actions">
                <button onclick="openTrip('${trip.id}')" class="action-button">Open</button>
                <button onclick="deleteTrip('${trip.id}')" class="action-button delete">Delete</button>
            </div>
        </div>
    `).join('');
}

// Optimized expense updates
const updateExpenseList = debounce(() => {
    const expenseList = document.getElementById('expenseList');
    if (!state.currentTrip || !state.currentTrip.expenses?.length) {
        expenseList.innerHTML = '<p>No expenses added yet</p>';
        return;
    }

    expenseList.innerHTML = state.currentTrip.expenses.map((expense, index) => `
        <div class="expense-item">
            <div class="expense-content">
                <p><strong>${expense.description}</strong></p>
                <p>Amount: $${expense.amount.toFixed(2)}</p>
                <p>Category: ${expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}</p>
                <p>Date: ${expense.date}</p>
            </div>
            <div class="expense-actions">
                <button onclick="editExpense(${index})" class="action-button edit">Edit</button>
                <button onclick="deleteExpense(${index})" class="action-button delete">Delete</button>
            </div>
        </div>
    `).join('');
}, 100);

// Optimized chart updates
const updateExpenseChart = debounce(() => {
    if (!state.currentTrip?.expenses?.length) {
        if (state.expenseChart) {
            state.expenseChart.destroy();
            state.expenseChart = null;
        }
        return;
    }

    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (state.expenseChart) {
        state.expenseChart.destroy();
    }

    const categoryTotals = state.currentTrip.expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
    }, {});

    const categories = Object.keys(categoryTotals);
    const amounts = Object.values(categoryTotals);

    state.expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories.map(cat => {
                const categoryNames = {
                    'food': 'Food & Dining',
                    'activities': 'Activities & Entertainment',
                    'accommodation': 'Accommodation',
                    'transportation': 'Transportation',
                    'shopping': 'Shopping',
                    'miscellaneous': 'Miscellaneous'
                };
                return categoryNames[cat] || cat;
            }),
            datasets: [{
                data: amounts,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: $${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}, 100);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Show home page by default
    showHome();
    
    // Initialize any other necessary components
    initializeCharts();
    
    // Setup location input
    const locationInput = document.getElementById('location');
    if (locationInput) {
        locationInput.addEventListener('input', handleLocationInput);
        
        // Close dropdown on outside click
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('locationDropdown');
            const locationInput = document.getElementById('location');
            
            if (!locationInput.contains(event.target) && !dropdown.contains(event.target)) {
                hideAutocompleteDropdown();
            }
        });
    }

    if (window.location.pathname.endsWith('index.html')) {
        addJoinForm();
    }
});

// Add this function to generate random share codes
function generateRandomShareCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('shareCode').value = code;
}

// Update createTrip function to handle optional share codes
async function createTrip() {
    try {
        const tripName = document.getElementById('tripName').value;
        const tripDestination = document.getElementById('tripDestination').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        let shareCode = document.getElementById('shareCode').value.toUpperCase();

        if (!tripName || !tripDestination || !startDate || !endDate) {
            alert('Please fill in all required fields');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('Start date must be before end date');
            return;
        }

        // Generate a random share code if none provided
        if (!shareCode) {
            shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        } else if (!/^[A-Z0-9]{6}$/.test(shareCode)) {
            alert('Share code must be exactly 6 characters (letters or numbers)');
            return;
        }

        // Check if share code is already in use
        const existingTrip = await db.collection('trips').where('shareCode', '==', shareCode).get();
        if (!existingTrip.empty) {
            alert('This share code is already in use. Please choose a different one or generate a new one.');
            return;
        }

        const apiKey = 'cac3923cef164a92bec0a99632bafc53';
        const geoApiUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(tripDestination)}&apiKey=${apiKey}`;

        const response = await fetch(geoApiUrl);
        const result = await response.json();
        
        if (result.features && result.features.length > 0) {
            const validatedDestination = result.features[0].properties.formatted;

            // Create a new document reference
            const tripRef = db.collection('trips').doc();
            
            const tripData = {
                id: tripRef.id, // Use the Firebase document ID
                name: tripName,
                destination: tripDestination,
                startDate: startDate,
                endDate: endDate,
                shareCode: shareCode,
                collaborators: [{ name: 'You (Owner)', role: 'owner' }],
                expenses: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Save to Firebase
            await tripRef.set(tripData);
            console.log('Trip created successfully:', tripRef.id);

            // Update UI
            state.currentTrip = tripData;
            state.currentTripId = tripRef.id;

            // Show trip details page
            document.getElementById('home-page').style.display = 'none';
            document.getElementById('features-page').style.display = 'none';
            document.getElementById('trip-details-page').style.display = 'block';

            // Update trip details
            document.getElementById('tripDetailsTitle').textContent = tripName;
            document.getElementById('tripDetailsDestination').textContent = `Destination: ${tripDestination}`;
            document.getElementById('tripDetailsDate').textContent = 
                `Trip Date: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;

            // Clear form
            document.getElementById('tripName').value = '';
            document.getElementById('tripDestination').value = '';
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            document.getElementById('shareCode').value = '';

            // Update the trip list
            updateTripList();
        } else {
            alert("Could not validate destination. Please enter a more specific location.");
        }
    } catch (error) {
        console.error('Error creating trip:', error);
        alert("There was an error creating the trip. Please try again.");
    }
}

// Update joinTrip function to use Firebase
async function joinTrip() {
    try {
        const shareCode = document.getElementById('joinCode').value.toUpperCase();
        console.log('Attempting to join trip with code:', shareCode);
        
        const tripQuery = await db.collection('trips').where('shareCode', '==', shareCode).get();
        
        if (tripQuery.empty) {
            alert('Invalid share code. Please try again.');
            return;
        }

        const trip = tripQuery.docs[0].data();
        const userName = prompt('Enter your name:');
        
        if (!userName) return;

        // Check if user is already a collaborator
        if (!trip.collaborators.some(c => c.name === userName)) {
            // Update collaborators array
            await db.collection('trips').doc(trip.id).update({
                collaborators: firebase.firestore.FieldValue.arrayUnion({
                    name: userName,
                    role: 'collaborator'
                })
            });

            console.log('Successfully joined trip:', trip.id);
            alert('Successfully joined the trip!');
            
            // Update the join trip section to show the user's name
            const joinTripSection = document.querySelector('.join-trip-section');
            joinTripSection.innerHTML = `
                <input type="text" id="joinCode" placeholder="Enter share code" maxlength="6" pattern="[A-Za-z0-9]{6}">
                <button onclick="joinTrip()" class="join-button">Join Trip</button>
                <p class="joined-user">Joined as: ${userName}</p>
            `;
            
            // Open the trip instead of redirecting
            openTrip(trip.id);
        } else {
            alert('You are already a collaborator on this trip.');
        }
    } catch (error) {
        console.error('Error joining trip:', error);
        alert('There was an error joining the trip. Please try again.');
    }
}

// Update openTrip function to use real-time listener
async function openTrip(tripId) {
    try {
        cleanupListeners();
        
        const tripDoc = await db.collection('trips').doc(tripId).get();
        if (!tripDoc.exists) {
            alert('Trip not found');
            return;
        }

        state.currentTrip = tripDoc.data();
        state.currentTripId = tripId;

        // Show trip details page
        document.getElementById('features-page').style.display = 'none';
        document.getElementById('trip-details-page').style.display = 'block';

        // Update trip details
        document.getElementById('tripDetailsTitle').textContent = state.currentTrip.name;
        document.getElementById('tripDetailsDestination').textContent = `Destination: ${state.currentTrip.destination}`;
        document.getElementById('tripDetailsDate').textContent = 
            `Trip Date: ${new Date(state.currentTrip.startDate).toLocaleDateString()} - ${new Date(state.currentTrip.endDate).toLocaleDateString()}`;

        // Setup real-time listener for this trip
        state.listeners.trip = db.collection('trips').doc(tripId).onSnapshot((doc) => {
            if (doc.exists) {
                state.currentTrip = doc.data();
                updateUI();
            } else {
                console.error('Trip not found');
                showFeatures();
            }
        });
        
        // Initial UI update
        updateUI();
    } catch (error) {
        console.error('Error opening trip:', error);
        alert('There was an error opening the trip. Please try again.');
    }
}

// Update showFeatures to use real-time listener
function showFeatures() {
    cleanupListeners();
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('features-page').style.display = 'block';
    document.getElementById('trip-details-page').style.display = 'none';
    state.currentTrip = null;
    state.currentTripId = null;
    updateWeatherInput();
    
    // Setup trip list listener
    if (!state.listeners.tripList) {
        state.listeners.tripList = setupTripListListener();
    }
}

// Update deleteTrip to handle real-time updates
async function deleteTrip(tripId) {
    if (confirm('Are you sure you want to delete this trip?')) {
        try {
            await db.collection('trips').doc(tripId).delete();
            console.log('Trip deleted successfully:', tripId);
            
            // If we're viewing the deleted trip, go back to features page
            if (state.currentTripId === tripId) {
                showFeatures();
            }
        } catch (error) {
            console.error('Error deleting trip:', error);
            alert('There was an error deleting the trip. Please try again.');
        }
    }
}

async function getCoordinatesForLocation(location) {
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch location coordinates');
        }

        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error('Location not found');
        }

        return {
            name: `${data.results[0].name}${data.results[0].admin1 ? `, ${data.results[0].admin1}` : ''}, ${data.results[0].country}`,
            lat: data.results[0].latitude,
            lon: data.results[0].longitude
        };
    } catch (error) {
        console.error('Error getting coordinates:', error);
        return null;
    }
}

function updateWeatherInput() {
    const locationInput = document.getElementById('location');
    if (state.currentTrip) {
        locationInput.value = state.currentTrip.destination;
        locationInput.disabled = true;
        locationInput.placeholder = "Weather for trip destination";
    } else {
        locationInput.value = '';
        locationInput.disabled = false;
        locationInput.placeholder = "Enter location";
    }
}

async function addExpense() {
    if (!state.currentTrip) return;

    try {
        const amount = document.getElementById('expenseAmount').value;
        const description = document.getElementById('expenseDescription').value;
        const category = document.getElementById('expenseCategory').value;

        if (!amount || !description) {
            alert('Please fill in both amount and description');
            return;
        }

        const newExpense = {
            amount: parseFloat(amount),
            description: description,
            category: category,
            date: new Date().toLocaleDateString()
        };

        // Add expense to Firebase
        await db.collection('trips').doc(state.currentTrip.id).update({
            expenses: firebase.firestore.FieldValue.arrayUnion(newExpense)
        });

        // Update local state
        if (!state.currentTrip.expenses) {
            state.currentTrip.expenses = [];
        }
        state.currentTrip.expenses.push(newExpense);

        // Update the UI
        updateExpenseList();
        updateExpenseChart();
        updateTotalExpenses();
        
        // Clear form
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('There was an error adding the expense. Please try again.');
    }
}

async function deleteExpense(index) {
    if (!state.currentTrip || !state.currentTrip.expenses) return;

    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            const expenseToDelete = state.currentTrip.expenses[index];
            
            // Remove expense from Firebase
            await db.collection('trips').doc(state.currentTrip.id).update({
                expenses: firebase.firestore.FieldValue.arrayRemove(expenseToDelete)
            });

            // Update local state
            state.currentTrip.expenses.splice(index, 1);
            
            // Update the UI
            updateExpenseList();
            updateExpenseChart();
            updateTotalExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('There was an error deleting the expense. Please try again.');
        }
    }
}

async function editExpense(index) {
    if (!state.currentTrip || !state.currentTrip.expenses) return;
    
    const expense = state.currentTrip.expenses[index];
    
    // Fill the form with the expense data
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseCategory').value = expense.category;
    
    // Change the add button to update
    const addButton = document.querySelector('button[onclick="addExpense()"]');
    const originalText = addButton.textContent;
    addButton.textContent = 'Update Expense';
    addButton.onclick = () => updateExpense(index);
    
    // Scroll to the form
    document.querySelector('.expense-form').scrollIntoView({ behavior: 'smooth' });
}

async function updateExpense(index) {
    if (!state.currentTrip || !state.currentTrip.expenses) return;

    try {
        const amount = document.getElementById('expenseAmount').value;
        const description = document.getElementById('expenseDescription').value;
        const category = document.getElementById('expenseCategory').value;

        if (!amount || !description) {
            alert('Please fill in both amount and description');
            return;
        }

        const oldExpense = state.currentTrip.expenses[index];
        const newExpense = {
            amount: parseFloat(amount),
            description: description,
            category: category,
            date: oldExpense.date // Keep the original date
        };

        // Update expense in Firebase
        await db.collection('trips').doc(state.currentTrip.id).update({
            expenses: firebase.firestore.FieldValue.arrayRemove(oldExpense)
        });
        await db.collection('trips').doc(state.currentTrip.id).update({
            expenses: firebase.firestore.FieldValue.arrayUnion(newExpense)
        });

        // Update local state
        state.currentTrip.expenses[index] = newExpense;

        // Update the UI
        updateExpenseList();
        updateExpenseChart();
        updateTotalExpenses();
        
        // Clear form and reset the button
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
        const addButton = document.querySelector('button[onclick="updateExpense(' + index + ')"]');
        addButton.textContent = 'Add Expense';
        addButton.onclick = addExpense;
    } catch (error) {
        console.error('Error updating expense:', error);
        alert('There was an error updating the expense. Please try again.');
    }
}

function updateTotalExpenses() {
    if (!state.currentTrip || !state.currentTrip.expenses) return;
    const total = state.currentTrip.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    document.getElementById('totalExpenses').textContent = total.toFixed(2);
}

let weatherAutocompleteTimeout = null;

async function handleLocationInput() {
    const locationInput = document.getElementById('location');
    const location = locationInput.value.trim();
    const dropdown = document.getElementById('locationDropdown');
    
    if (location.length < 2) {
        hideAutocompleteDropdown();
        return;
    }

    // Clear previous timeout
    if (weatherAutocompleteTimeout) {
        clearTimeout(weatherAutocompleteTimeout);
    }

    // Show loading state
    dropdown.innerHTML = '<div class="autocomplete-item loading">Searching locations...</div>';
    dropdown.style.display = 'block';

    // Set new timeout to prevent too many API calls
    weatherAutocompleteTimeout = setTimeout(async () => {
        try {
            const response = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=5&language=en&format=json`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch locations');
            }

            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-item">No locations found</div>';
                return;
            }

            showAutocompleteDropdown(data.results);
        } catch (error) {
            console.error('Location Search Error:', error);
            dropdown.innerHTML = `
                <div class="autocomplete-item error">
                    Error searching locations. Please try again.
                </div>`;
        }
    }, 300);
}

function showAutocompleteDropdown(results) {
    const dropdown = document.getElementById('locationDropdown');
    dropdown.innerHTML = '';
    
    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        // Format the location name with country and admin area
        const locationName = `${result.name}${result.admin1 ? `, ${result.admin1}` : ''}, ${result.country}`;
        item.textContent = locationName;
        item.onclick = () => selectLocation(result);
        dropdown.appendChild(item);
    });
    
    dropdown.style.display = 'block';
}

function hideAutocompleteDropdown() {
    const dropdown = document.getElementById('locationDropdown');
    dropdown.style.display = 'none';
}

function selectLocation(location) {
    console.log('Selected location:', location);
    const locationName = `${location.name}${location.admin1 ? `, ${location.admin1}` : ''}, ${location.country}`;
    document.getElementById('location').value = locationName;
    hideAutocompleteDropdown();
    
    // Clear old weather data
    document.getElementById('weatherResult').innerHTML = '';
    
    // Get weather for selected location
    checkWeatherForLocation(locationName, location.latitude, location.longitude);
}

async function checkWeatherForLocation(locationString, lat, lon) {
    // Show loading message
    document.getElementById('weatherResult').innerHTML = `
        <div class="weather-result">
            <h3>Weather for ${locationString}</h3>
            <div class="weather-details">
                <p class="loading">Loading weather data...</p>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`
        );
        if (!response.ok) {
            throw new Error('Weather data not available');
        }
        const weatherData = await response.json();
        
        if (!weatherData.current || !weatherData.daily) {
            throw new Error('Invalid weather data received');
        }

        displayWeather(weatherData, locationString, lat, lon);
    } catch (error) {
        console.error('Weather Error:', error);
        document.getElementById('weatherResult').innerHTML = `
            <div class="weather-result">
                <h3>Weather for ${locationString}</h3>
                <div class="weather-details">
                    <p class="error">Unable to fetch weather data. Please try again.</p>
                    <button onclick="checkWeatherForLocation('${locationString}', ${lat}, ${lon})" class="weather-button">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }
}

function displayWeather(weatherData, locationString, lat, lon) {
    // Check if weather data is valid
    if (!weatherData.current || 
        typeof weatherData.current.temperature_2m !== 'number' ||
        typeof weatherData.current.relative_humidity_2m !== 'number' ||
        typeof weatherData.current.wind_speed_10m !== 'number' ||
        typeof weatherData.current.weather_code !== 'number') {
        document.getElementById('weatherResult').innerHTML = `
            <div class="weather-result">
                <h3>Weather for ${locationString}</h3>
                <div class="weather-details">
                    <p class="error">Invalid weather data received. Please try again.</p>
                    <button onclick="checkWeatherForLocation('${locationString}', ${lat}, ${lon})" class="weather-button">
                        Try Again
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Convert temps from Celsius to Fahrenheit
    const tempC = weatherData.current.temperature_2m;
    const tempF = (tempC * 9/5) + 32;
    const feelsLikeC = weatherData.current.apparent_temperature;
    const feelsLikeF = (feelsLikeC * 9/5) + 32;
    
    // Get weather description from code
    const weatherCodes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    
    const description = weatherCodes[weatherData.current.weather_code] || 'Unknown';
    
    // Get current conditions
    const humidity = weatherData.current.relative_humidity_2m;
    const windSpeed = Math.round(weatherData.current.wind_speed_10m * 0.621371); // m/s to mph
    const precipProb = weatherData.current.precipitation_probability || 0;

    // Get today's forecast
    const dailyMax = Math.round((weatherData.daily.temperature_2m_max[0] * 9/5) + 32);
    const dailyMin = Math.round((weatherData.daily.temperature_2m_min[0] * 9/5) + 32);
    const dailyPrecipProb = weatherData.daily.precipitation_probability_max[0];

    const currentTime = new Date().toLocaleTimeString();

    // Update weather display
    document.getElementById('weatherResult').innerHTML = `
        <div class="weather-result">
            <h3>Weather for ${locationString}</h3>
            <div class="weather-details">
                <p class="temperature">${Math.round(tempF)}°F</p>
                <p class="feels-like">Feels like ${Math.round(feelsLikeF)}°F</p>
                <p class="description">${description}</p>
                <p class="humidity">Humidity: ${humidity}%</p>
                <p class="wind">Wind Speed: ${windSpeed} mph</p>
                <p class="precipitation">Precipitation: ${precipProb}%</p>
                <div class="daily-forecast">
                    <h4>Today's Forecast</h4>
                    <p>High: ${dailyMax}°F</p>
                    <p>Low: ${dailyMin}°F</p>
                    <p>Max Precipitation: ${dailyPrecipProb}%</p>
                </div>
                <p class="update-time">Last updated: ${currentTime}</p>
                <button onclick="checkWeatherForLocation('${locationString}', ${lat}, ${lon})" class="weather-button">
                    Refresh Weather
                </button>
            </div>
        </div>
    `;
}

// Make navigation functions globally available
window.showHome = function() {
    cleanupListeners();
    document.getElementById('home-page').style.display = 'block';
    document.getElementById('features-page').style.display = 'none';
    document.getElementById('trip-details-page').style.display = 'none';
    state.currentTrip = null;
    state.currentTripId = null;
};

window.showFeatures = function() {
    cleanupListeners();
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('features-page').style.display = 'block';
    document.getElementById('trip-details-page').style.display = 'none';
    state.currentTrip = null;
    state.currentTripId = null;
    
    // Setup trip list listener
    if (!state.listeners.tripList) {
        state.listeners.tripList = setupTripListListener();
    }
};

window.goBack = function() {
    cleanupListeners();
    document.getElementById('trip-details-page').style.display = 'none';
    document.getElementById('features-page').style.display = 'block';
    document.getElementById('home-page').style.display = 'none';
    state.currentTrip = null;
    state.currentTripId = null;
    
    // Setup trip list listener
    if (!state.listeners.tripList) {
        state.listeners.tripList = setupTripListListener();
    }
};

// Collaboration feature
function generateShareCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shareTrip(tripId) {
    const trips = JSON.parse(localStorage.getItem('trips')) || [];
    const trip = trips.find(t => t.id === tripId);
    
    if (!trip) {
        alert('Trip not found');
        return;
    }
    
    // Copy share code to clipboard
    navigator.clipboard.writeText(trip.shareCode).then(() => {
        alert('Share code copied to clipboard! Share this code with others to collaborate on this trip.');
    }).catch(() => {
        alert('Share code: ' + trip.shareCode + '\n\nPlease copy this code manually to share with others.');
    });
    
    // Update the UI to show the share code and collaborators
    updateTripDetails(tripId);
}

// Update the updateTripDetails function to show collaboration features
function updateTripDetails(tripId) {
    const trips = JSON.parse(localStorage.getItem('trips')) || [];
    const trip = trips.find(t => t.id === tripId);
    
    if (!trip) {
        window.location.href = 'index.html';
        return;
    }
    
    // Update trip details in the header
    document.getElementById('tripDetailsTitle').textContent = trip.name;
    document.getElementById('tripDetailsDestination').textContent = `Destination: ${trip.destination}`;
    document.getElementById('tripDetailsDate').textContent = 
        `Trip Date: ${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}`;
    
    // Update share section
    const shareSection = document.querySelector('.share-section');
    if (shareSection) {
        shareSection.innerHTML = `
            <h3>Collaboration</h3>
            <p>Share this code with others:</p>
            <div class="share-code">${trip.shareCode}</div>
            <div class="collaborators">
                <h4>Collaborators:</h4>
                ${trip.collaborators.map(c => `
                    <span class="collaborator">${c.name} ${c.role === 'owner' ? '(Owner)' : ''}</span>
                `).join('')}
            </div>
        `;
    }
    
    // Update other trip details
    updateExpenseList();
    updateExpenseChart();
    updateTotalExpenses();
    updateWeatherInput();
}

// Add join form to index.html
function addJoinForm() {
    const header = document.querySelector('.header');
    const joinForm = document.createElement('div');
    joinForm.className = 'join-form';
    joinForm.innerHTML = `
        <input type="text" id="joinCode" placeholder="Enter share code" maxlength="6">
        <button onclick="joinTrip()">Join Trip</button>
    `;
    header.appendChild(joinForm);
} 