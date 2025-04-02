let currentTrip = null;
let trips = []; // Store all trips
let isConnected = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Test Firebase connection
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
        isConnected = snap.val();
        if (isConnected) {
            console.log("Connected to Firebase!");
            showConnectionStatus(true);
        } else {
            console.log("Not connected to Firebase!");
            showConnectionStatus(false);
        }
    });

    // Check for shared trip in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedTripId = urlParams.get('tripId');
    
    if (sharedTripId) {
        // Load shared trip
        loadSharedTrip(sharedTripId);
    } else {
        // Load local trips
        loadLocalTrips();
    }
    
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
});

function loadLocalTrips() {
    const savedTrips = localStorage.getItem('trips');
    if (savedTrips) {
        trips = JSON.parse(savedTrips);
        updateTripList();
    }
}

function saveLocalTrips() {
    localStorage.setItem('trips', JSON.stringify(trips));
}

async function loadSharedTrip(tripId) {
    const tripRef = database.ref(`trips/${tripId}`);
    
    // Listen for real-time updates
    tripRef.on('value', (snapshot) => {
        const tripData = snapshot.val();
        if (tripData) {
            currentTrip = { ...tripData, id: tripId };
            
            // Show trip details page
            document.getElementById('features-page').style.display = 'none';
            document.getElementById('trip-details-page').style.display = 'block';
            
            // Update UI
            document.getElementById('tripDetailsTitle').textContent = tripData.name;
            document.getElementById('tripDetailsDestination').textContent = `Destination: ${tripData.destination}`;
            document.getElementById('tripDetailsDate').textContent = 
                `Trip Date: ${new Date(tripData.startDate).toLocaleDateString()} - ${new Date(tripData.endDate).toLocaleDateString()}`;
            
            // Update expenses and charts
            updateExpenseList();
            updateExpenseChart();
            updateTotalExpenses();
            updateWeatherInput();
        }
    });
}

function createTrip() {
    console.log('Create trip function called');
    
    const tripName = document.getElementById('tripName').value;
    const tripDestination = document.getElementById('tripDestination').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    console.log('Form values:', { tripName, tripDestination, startDate, endDate });

    if (!tripName || !tripDestination || !startDate || !endDate) {
        alert('Please fill in all fields');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
    }

    // Create new trip
    const newTrip = {
        name: tripName,
        destination: tripDestination,
        startDate: startDate,
        endDate: endDate,
        expenses: [],
        createdAt: Date.now()
    };

    console.log('Attempting to save trip to Firebase:', newTrip);

    // Save to Firebase temporarily
    saveTemporaryTrip(newTrip)
        .then(tripId => {
            console.log('Trip saved successfully with ID:', tripId);
            currentTrip = { ...newTrip, id: tripId };
            trips.push(currentTrip);
            
            // Update trip details page
            document.getElementById('tripDetailsTitle').textContent = tripName;
            document.getElementById('tripDetailsDestination').textContent = `Destination: ${tripDestination}`;
            document.getElementById('tripDetailsDate').textContent = 
                `Trip Date: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;

            // Show trip details page
            document.getElementById('features-page').style.display = 'none';
            document.getElementById('trip-details-page').style.display = 'block';

            // Clear form
            document.getElementById('tripName').value = '';
            document.getElementById('tripDestination').value = '';
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';

            // Update the trip list
            updateTripList();
        })
        .catch(error => {
            console.error('Error creating trip:', error);
            alert('Failed to create trip. Please try again. Error: ' + error.message);
        });
}

function showShareDialog() {
    if (!currentTrip) return;
    
    const shareLink = generateShareLink(currentTrip.id);
    document.getElementById('shareLink').value = shareLink;
    document.getElementById('shareDialog').style.display = 'flex';
}

function closeShareDialog() {
    document.getElementById('shareDialog').style.display = 'none';
}

function copyShareLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');
    
    // Show feedback
    const copyButton = document.querySelector('.copy-button');
    const originalText = copyButton.textContent;
    copyButton.textContent = 'Copied!';
    setTimeout(() => {
        copyButton.textContent = originalText;
    }, 2000);
}

function updateTripList() {
    const tripList = document.getElementById('tripList');
    tripList.innerHTML = '';

    if (trips.length === 0) {
        tripList.innerHTML = '<p>No trips created yet</p>';
        return;
    }

    trips.forEach(trip => {
        const tripItem = document.createElement('div');
        tripItem.className = 'trip-item';
        tripItem.innerHTML = `
            <div class="trip-info">
                <h3>${trip.name}</h3>
                <p>Destination: ${trip.destination}</p>
                <p>Date: ${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}</p>
            </div>
            <div class="trip-actions">
                <button onclick="openTrip(${trip.id})" class="action-button">Open</button>
                <button onclick="deleteTrip(${trip.id})" class="action-button delete">Delete</button>
            </div>
        `;
        tripList.appendChild(tripItem);
    });
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
    if (currentTrip) {
        locationInput.value = currentTrip.destination;
        checkWeatherForLocation(currentTrip.destination);
    } else {
        locationInput.value = '';
    }
}

async function openTrip(tripId) {
    currentTrip = trips.find(trip => trip.id === tripId);
    if (currentTrip) {
        document.getElementById('tripDetailsTitle').textContent = currentTrip.name;
        document.getElementById('tripDetailsDestination').textContent = `Destination: ${currentTrip.destination}`;
        document.getElementById('tripDetailsDate').textContent = 
            `Trip Date: ${new Date(currentTrip.startDate).toLocaleDateString()} - ${new Date(currentTrip.endDate).toLocaleDateString()}`;
        
        // Show trip details page
        document.getElementById('features-page').style.display = 'none';
        document.getElementById('trip-details-page').style.display = 'block';
        
        // Update expense list and chart
        updateExpenseList();
        updateExpenseChart();
        updateTotalExpenses();

        // Update weather input but don't clear existing weather data
        updateWeatherInput();
        
        // Only fetch new weather if we don't have any weather data displayed
        const weatherResult = document.getElementById('weatherResult');
        if (!weatherResult.innerHTML) {
            const locationData = await getCoordinatesForLocation(currentTrip.destination);
            if (locationData) {
                checkWeatherForLocation(locationData.name, locationData.lat, locationData.lon);
            } else {
                weatherResult.innerHTML = `
                    <div class="weather-result">
                        <h3>Weather for ${currentTrip.destination}</h3>
                        <div class="weather-details">
                            <p class="error">Unable to find weather data for this destination. Please try searching for a specific city.</p>
                        </div>
                    </div>
                `;
            }
        }
    }
}

function deleteTrip(tripId) {
    if (confirm('Are you sure you want to delete this trip?')) {
        // Remove from Firebase
        const tripRef = database.ref(`trips/${tripId}`);
        tripRef.remove()
            .then(() => {
                trips = trips.filter(trip => trip.id !== tripId);
                if (currentTrip && currentTrip.id === tripId) {
                    currentTrip = null;
                    goBack();
                }
                updateTripList();
            })
            .catch(error => {
                console.error('Error deleting trip:', error);
                alert('Failed to delete trip. Please try again.');
            });
    }
}

function goBack() {
    document.getElementById('trip-details-page').style.display = 'none';
    document.getElementById('features-page').style.display = 'flex';
    currentTrip = null;
    // Don't clear weather data when going back
    updateWeatherInput();
}

function addExpense() {
    if (!currentTrip) return;

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
        date: new Date().toLocaleDateString(),
        addedAt: Date.now(),
        userId: 'anonymous' // You can replace this with actual user ID when implementing authentication
    };

    // Add expense to the trip
    currentTrip.expenses.push(newExpense);
    
    // Update in Firebase
    const tripRef = database.ref(`trips/${currentTrip.id}`);
    tripRef.update({
        expenses: currentTrip.expenses,
        lastModified: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
        // Clear form
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';

        // Update UI
        updateExpenseList();
        updateExpenseChart();
        updateTotalExpenses();
    })
    .catch(error => {
        console.error('Error adding expense:', error);
        alert('Failed to add expense. Please try again.');
        // Remove the expense from the array since it failed to save
        currentTrip.expenses.pop();
    });
}

function updateExpenseList() {
    const expenseList = document.getElementById('expenseList');
    expenseList.innerHTML = '';

    if (!currentTrip || currentTrip.expenses.length === 0) {
        expenseList.innerHTML = '<p>No expenses added yet</p>';
        return;
    }

    currentTrip.expenses.forEach((expense, index) => {
        const expenseItem = document.createElement('div');
        expenseItem.className = 'expense-item';
        expenseItem.innerHTML = `
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
        `;
        expenseList.appendChild(expenseItem);
    });
}

function deleteExpense(index) {
    if (confirm('Are you sure you want to delete this expense?')) {
        currentTrip.expenses.splice(index, 1);
        
        // Update in Firebase
        const tripRef = database.ref(`trips/${currentTrip.id}`);
        tripRef.update({
            expenses: currentTrip.expenses,
            lastModified: firebase.database.ServerValue.TIMESTAMP
        })
        .then(() => {
            updateExpenseList();
            updateExpenseChart();
            updateTotalExpenses();
        })
        .catch(error => {
            console.error('Error deleting expense:', error);
            alert('Failed to delete expense. Please try again.');
            // Reload the trip data to ensure consistency
            loadSharedTrip(currentTrip.id);
        });
    }
}

function editExpense(index) {
    const expense = currentTrip.expenses[index];
    
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

function updateExpense(index) {
    const amount = document.getElementById('expenseAmount').value;
    const description = document.getElementById('expenseDescription').value;
    const category = document.getElementById('expenseCategory').value;

    if (!amount || !description) {
        alert('Please fill in both amount and description');
        return;
    }

    // Update the expense
    currentTrip.expenses[index] = {
        ...currentTrip.expenses[index],
        amount: parseFloat(amount),
        description: description,
        category: category,
        lastModified: Date.now()
    };

    // Update in Firebase
    const tripRef = database.ref(`trips/${currentTrip.id}`);
    tripRef.update({
        expenses: currentTrip.expenses,
        lastModified: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
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
    })
    .catch(error => {
        console.error('Error updating expense:', error);
        alert('Failed to update expense. Please try again.');
        // Reload the trip data to ensure consistency
        loadSharedTrip(currentTrip.id);
    });
}

function updateTotalExpenses() {
    if (!currentTrip || !currentTrip.expenses) return;
    const total = currentTrip.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    document.getElementById('totalExpenses').textContent = total.toFixed(2);
}

let expenseChart = null;

function updateExpenseChart() {
    if (!currentTrip || !currentTrip.expenses || currentTrip.expenses.length === 0) {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        if (expenseChart) {
            expenseChart.destroy();
        }
        expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['No expenses yet'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#e0e0e0']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
        return;
    }

    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    // Remove old chart
    if (expenseChart) {
        expenseChart.destroy();
    }

    // Sum expenses by category
    const categoryTotals = {};
    currentTrip.expenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    // Prep data for chart
    const categories = Object.keys(categoryTotals);
    const amounts = Object.values(categoryTotals);

    // Create new chart
    expenseChart = new Chart(ctx, {
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
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                },
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
}

async function convertCurrency() {
    const amount = document.getElementById('amount').value;
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;

    if (!amount) {
        alert('Please enter an amount to convert');
        return;
    }

    try {
        // Get exchange rates
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch exchange rates');
        }

        const data = await response.json();
        const rates = data.rates;
        
        // Format based on currency
        const formatCurrency = (amount, currency) => {
            switch (currency) {
                case 'JPY':
                    return Math.round(amount).toLocaleString('ja-JP');
                case 'KRW':
                    return Math.round(amount).toLocaleString('ko-KR');
                default:
                    return amount.toFixed(2);
            }
        };

        const numericAmount = parseFloat(amount);
        let convertedAmount;

        if (fromCurrency === toCurrency) {
            convertedAmount = numericAmount;
        } else {
            const rate = rates[toCurrency];
            if (!rate) {
                throw new Error('Currency conversion not available');
            }
            convertedAmount = numericAmount * rate;
        }

        // Calc rate for 1 unit
        const rateForOne = convertedAmount / numericAmount;

        document.getElementById('conversionResult').innerHTML = `
            <div class="conversion-result">
                <p class="conversion-amount">${formatCurrency(numericAmount, fromCurrency)} ${fromCurrency} = ${formatCurrency(convertedAmount, toCurrency)} ${toCurrency}</p>
                <p class="conversion-rate">Rate: 1 ${fromCurrency} = ${formatCurrency(rateForOne, toCurrency)} ${toCurrency}</p>
                <p class="conversion-time">Last updated: ${new Date().toLocaleTimeString()}</p>
            </div>
        `;
    } catch (error) {
        document.getElementById('conversionResult').innerHTML = `
            <p class="error">Error: ${error.message}. Please try again.</p>
        `;
    }
}

let weatherAutocompleteTimeout = null;

function handleLocationInput() {
    const locationInput = document.getElementById('location');
    const location = locationInput.value.trim();
    
    if (location.length < 2) {
        return;
    }

    checkWeatherForLocation(location);
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

async function checkWeatherForLocation(locationString) {
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
        // First get coordinates
        const geoResponse = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationString)}&count=1&language=en&format=json`
        );
        
        if (!geoResponse.ok) {
            throw new Error('Location not found');
        }

        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('Location not found');
        }

        const { latitude: lat, longitude: lon } = geoData.results[0];

        // Get weather data
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
                    <button onclick="checkWeatherForLocation('${locationString}')" class="weather-button">
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
                    <button onclick="checkWeatherForLocation('${locationString}')" class="weather-button">
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
                <button onclick="checkWeatherForLocation('${locationString}')" class="weather-button">
                    Refresh Weather
                </button>
            </div>
        </div>
    `;
}

function showConnectionStatus(connected) {
    // Remove existing status if any
    const existingStatus = document.getElementById('connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Create new status element
    const status = document.createElement('div');
    status.id = 'connection-status';
    status.style.position = 'fixed';
    status.style.bottom = '20px';
    status.style.right = '20px';
    status.style.padding = '10px 20px';
    status.style.borderRadius = '20px';
    status.style.color = 'white';
    status.style.fontSize = '14px';
    status.style.zIndex = '1000';
    status.style.transition = 'all 0.3s ease';

    if (connected) {
        status.style.backgroundColor = '#27ae60';
        status.textContent = '🟢 Connected';
    } else {
        status.style.backgroundColor = '#e74c3c';
        status.textContent = '🔴 Disconnected';
    }

    document.body.appendChild(status);
    
    // Fade out after 5 seconds if connected
    if (connected) {
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => status.remove(), 300);
        }, 5000);
    }
}

function testNewTrip(tripId) {
    console.log(`Testing new trip: ${tripId}`);
    const tripRef = database.ref(`trips/${tripId}`);
    
    // Listen for changes
    tripRef.on('value', (snapshot) => {
        console.log('Trip updated:', snapshot.val());
    });
}

function testExpenseUpdate(tripId) {
    console.log(`Testing expense update for trip: ${tripId}`);
    const expensesRef = database.ref(`trips/${tripId}/expenses`);
    
    // Listen for changes
    expensesRef.on('value', (snapshot) => {
        console.log('Expenses updated:', snapshot.val());
    });
} 