const apiKey = 'ebd87276f4aa190082783af69b65a3a7';
const baseURL = 'https://api.openweathermap.org/data/2.5';

let searchInput, searchButton, weatherIcon, temperature, 
    description, cityName, humidity, wind;

let dateElement, timeElement;

let map, marker;

// Add theme handling
const darkModeToggle = document.getElementById('darkMode');
const themeButtons = document.querySelectorAll('.theme-btn');
let currentTheme = localStorage.getItem('theme') || 'default';
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Add new global variables
let currentUnit = localStorage.getItem('unit') || 'metric';
let currentMapType = 'standard';
let precipitation;
let lastWeatherData = null;

// Add list of major cities
const majorCities = [
    'London', 'New York', 'Tokyo', 'Paris', 'Sydney',
    'Dubai', 'Singapore', 'Rome', 'Moscow', 'Toronto',
    'Berlin', 'Madrid', 'Seoul', 'Mumbai', 'Cairo',
    'Manila'
];

// Initialize theme
function initTheme() {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : currentTheme);
    darkModeToggle.checked = isDarkMode;
    updateThemeButtons();
}

// Theme button handling
function updateThemeButtons() {
    themeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === currentTheme) {
            btn.classList.add('active');
        }
    });
}

darkModeToggle.addEventListener('change', () => {
    isDarkMode = darkModeToggle.checked;
    localStorage.setItem('darkMode', isDarkMode);
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : currentTheme);
});

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (!isDarkMode) {
            currentTheme = btn.dataset.theme;
            localStorage.setItem('theme', currentTheme);
            document.documentElement.setAttribute('data-theme', currentTheme);
            updateThemeButtons();
        }
    });
});

// Offline storage handling
function saveToLocalStorage(city, data) {
    const weatherData = {
        timestamp: new Date().getTime(),
        data: data
    };
    localStorage.setItem(`weather_${city}`, JSON.stringify(weatherData));
}

function getFromLocalStorage(city) {
    const stored = localStorage.getItem(`weather_${city}`);
    if (stored) {
        const weatherData = JSON.parse(stored);
        const now = new Date().getTime();
        // Data is valid for 30 minutes
        if (now - weatherData.timestamp < 30 * 60 * 1000) {
            return weatherData.data;
        }
    }
    return null;
}

function resetToDashboard() {
    // Clear the search input
    searchInput.value = '';
    
    // Reset weather info with placeholder values
    cityName.textContent = 'Enter a city';
    temperature.textContent = '--°C';
    description.textContent = 'Weather description';
    humidity.textContent = '--%';
    wind.textContent = '-- km/h';
    weatherIcon.src = 'https://openweathermap.org/img/wn/02d@2x.png'; // Default cloud icon
    
    // Clear forecast
    const forecastContainer = document.querySelector('.forecast-container');
    if (forecastContainer) {
        forecastContainer.innerHTML = '';
    }

    // Reset background
    document.body.style.background = 'linear-gradient(135deg, #00feba, #5b548a)';

    // Update to Philippine time
    updateDateTime();
}

document.addEventListener('DOMContentLoaded', () => {
    searchInput = document.getElementById('search-input');
    searchButton = document.getElementById('search-button');
    weatherIcon = document.querySelector('.weather-icon');
    temperature = document.querySelector('.temperature');
    description = document.querySelector('.description');
    cityName = document.querySelector('.city');
    humidity = document.querySelector('.humidity span');
    wind = document.querySelector('.wind span');
    dateElement = document.querySelector('.date');
    timeElement = document.querySelector('.time');
    precipitation = document.querySelector('.precipitation span');

    // Set initial opacity after welcome message
    const container = document.querySelector('.container');
    setTimeout(() => {
        container.style.opacity = '1';
        resetToDashboard(); // Initialize with placeholder values
    }, 100);

    searchButton.addEventListener('click', () => {
        const city = searchInput.value.trim();
        if (city) checkWeather(city);
    });

    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const city = searchInput.value.trim();
            if (city) checkWeather(city);
        }
    });

    updateDateTime();
    
    // Show only welcome message
    Swal.fire({
        title: 'Welcome to Weather App!',
        text: 'Search for any city to get weather information',
        icon: 'info',
        confirmButtonColor: '#00feba',
        background: 'rgba(0, 0, 0, 0)',
        color: '#fff',
        backdrop: 'rgba(0, 0, 0, 0.4)',
        showClass: {
            popup: 'animate__animated animate__fadeIn'
        }
    });

    // Initialize map
    initMap();

    // Initialize theme
    initTheme();

    // Initialize places overview
    updatePlacesOverview();

    // Initialize unit buttons with enhanced functionality
    const unitButtons = document.querySelectorAll('.unit-btn');
    unitButtons.forEach(btn => {
        if (btn.dataset.unit === currentUnit) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            if (btn.dataset.unit === currentUnit) return; // Skip if same unit

            unitButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const oldUnit = currentUnit;
            currentUnit = btn.dataset.unit;
            localStorage.setItem('unit', currentUnit);

            if (lastWeatherData) {
                updateUnitsDisplay(lastWeatherData, oldUnit);
            }
            
            // Update places overview when unit changes
            updatePlacesOverview();
        });
    });

    // Initialize map buttons
    const mapButtons = document.querySelectorAll('.map-btn');
    mapButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            mapButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMapType = btn.dataset.map;
            updateMapLayer();
        });
    });
});

function updateDateTime(timezone = 28800) { // Default to Philippine timezone (UTC+8)
    if (!dateElement || !timeElement) return;

    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    let cityTime;
    let timezoneName;

    // If no city is selected (default dashboard state) or Manila is selected
    if (cityName.textContent === 'Enter a city' || cityName.textContent.includes('Manila')) {
        // Use Philippine time
        cityTime = new Date(utc + (28800 * 1000)); // 28800 seconds = UTC+8
        timezoneName = 'Philippine Time (UTC+8)';
    } else {
        // Use the city's local time
        cityTime = new Date(utc + (timezone * 1000));
        const timezoneHours = Math.floor(Math.abs(timezone) / 3600);
        const timezoneMinutes = Math.floor((Math.abs(timezone) % 3600) / 60);
        const timezoneSign = timezone >= 0 ? '+' : '-';
        timezoneName = `GMT${timezoneSign}${String(timezoneHours).padStart(2, '0')}:${String(timezoneMinutes).padStart(2, '0')}`;
    }
    
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    };
    dateElement.textContent = cityTime.toLocaleString('en-US', dateOptions);

    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true
    };
    timeElement.textContent = cityTime.toLocaleString('en-US', timeOptions);

    // Update timezone info
    const existingTimezone = document.querySelector('.timezone-info');
    if (existingTimezone) {
        existingTimezone.remove();
    }

    const timezoneInfo = document.createElement('div');
    timezoneInfo.className = 'timezone-info';
    timezoneInfo.textContent = timezoneName;
    
    const datetimeBox = document.querySelector('.datetime-box');
    if (datetimeBox) {
        datetimeBox.appendChild(timezoneInfo);
    }

    return cityTime;
}

function isDayTime(localTime) {
    const hours = localTime.getHours();
    return hours >= 6 && hours < 18;
}

function getWeatherBackground(weatherCode) {
    const backgrounds = {
        '01d': 'linear-gradient(135deg, #00c6fb 0%, #1e89f7 100%)',
        '01n': 'linear-gradient(135deg, #243949 0%, #517fa4 100%)', 
    };

    // Remove existing weather effects
    removeWeatherEffects();

    // Add weather effects based on weather code
    if (weatherCode.startsWith('09') || weatherCode.startsWith('10')) {
        // Rain effect
        createRainEffect();
    } else if (weatherCode.startsWith('11')) {
        // Thunderstorm effect
        createThunderstormEffect();
    }

    return backgrounds[weatherCode] || 
           (weatherCode.endsWith('d') ? 
           'linear-gradient(135deg, #00feba, #5b548a)' : 
           'linear-gradient(135deg, #243949, #517fa4)');
}

function removeWeatherEffects() {
    // Remove existing weather effects
    const existingEffects = document.querySelectorAll('.weather-effect');
    existingEffects.forEach(effect => effect.remove());
}

function createRainEffect() {
    const rainContainer = document.createElement('div');
    rainContainer.className = 'weather-effect rain-container';
    document.body.appendChild(rainContainer);

    // Create multiple raindrops
    for (let i = 0; i < 100; i++) {
        const raindrop = document.createElement('div');
        raindrop.className = 'raindrop';
        raindrop.style.left = `${Math.random() * 100}%`;
        raindrop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
        raindrop.style.animationDelay = `${Math.random() * 2}s`;
        rainContainer.appendChild(raindrop);
    }
}

function createThunderstormEffect() {
    const stormContainer = document.createElement('div');
    stormContainer.className = 'weather-effect storm-container';
    document.body.appendChild(stormContainer);

    // Create rain effect
    createRainEffect();

    // Create lightning effect
    const lightning = document.createElement('div');
    lightning.className = 'lightning';
    stormContainer.appendChild(lightning);

    // Random lightning flashes
    setInterval(() => {
        if (Math.random() > 0.7) {
            lightning.style.opacity = '1';
            setTimeout(() => {
                lightning.style.opacity = '0';
            }, 100);
        }
    }, 2000);
}

function initMap() {
    // Initialize the map centered on a default location
    map = L.map('map').setView([0, 0], 2);
    
    // Add the OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create a marker but don't add it to the map yet
    marker = L.marker([0, 0]);
}

function updateMap(lat, lon, cityName) {
    // If map hasn't been initialized, initialize it
    if (!map) {
        initMap();
    }

    // Update map view and marker
    map.setView([lat, lon], 10);
    
    // Remove existing marker if it exists
    if (marker) {
        marker.remove();
    }
    
    // Add new marker
    marker = L.marker([lat, lon])
        .bindPopup(cityName)
        .addTo(map);
}

async function checkWeather(city) {
    try {
        const container = document.querySelector('.container');
        container.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check offline storage first
        const offlineData = getFromLocalStorage(city);
        if (offlineData && !navigator.onLine) {
            updateWeatherUI(offlineData);
            Swal.fire({
                icon: 'info',
                title: 'Offline Mode',
                text: 'Showing stored data for ' + city,
                timer: 2000,
                showConfirmButton: false,
                background: 'rgba(0, 0, 0, 0)',
                color: '#fff',
                backdrop: 'rgba(0, 0, 0, 0.4)'
            });
            container.style.opacity = '1';
            return;
        }

        // Show loading state
        const loadingAlert = Swal.fire({
            title: 'Loading...',
            text: 'Fetching weather data',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: 'rgba(0, 0, 0, 0)',
            color: '#fff',
            backdrop: 'rgba(0, 0, 0, 0.4)'
        });

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(response.status === 404 ? 'City not found. Please check the spelling.' :
                          response.status === 401 ? 'Invalid API key. Please check your API key.' :
                          'Weather service error: ' + response.status);
        }

        const data = await response.json();

        // Close loading alert
        await loadingAlert.close();

        // Check for severe weather conditions
        checkSevereWeather(data);

        // Update UI and other functionality
        if (window.timeInterval) {
            clearInterval(window.timeInterval);
        }

        const cityTime = updateDateTime(data.timezone);
        
        window.timeInterval = setInterval(() => {
            updateDateTime(data.timezone);
        }, 1000);

        const weatherCode = data.weather[0].icon;
        const isDay = isDayTime(cityTime);
        const adjustedWeatherCode = weatherCode.slice(0, -1) + (isDay ? 'd' : 'n');

        document.body.style.background = getWeatherBackground(adjustedWeatherCode);

        // Update the UI with weather data
        updateWeatherUI(data);
        
        // Save data to local storage
        saveToLocalStorage(city, data);

        // After all data is updated, fade in the container
        container.style.opacity = '1';

        // Show success message
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: `Current weather in ${data.name}`,
            timer: 1500,
            showConfirmButton: false,
            background: 'rgba(0, 0, 0, 0)',
            color: '#fff',
            backdrop: 'rgba(0, 0, 0, 0.4)'
        });

        // Update forecast
        await updateForecast(city);

    } catch (error) {
        // Close any existing loading alert
        Swal.close();
        handleWeatherError(error, city);
    }
}

function checkSevereWeather(data) {
    const temp = data.main.temp;
    const windSpeed = data.wind.speed;
    const alerts = [];

    // Temperature alerts
    if (temp >= 35) {
        alerts.push({
            type: 'Extreme Heat',
            message: 'Temperature is very high. Stay hydrated and avoid prolonged sun exposure.',
            icon: 'warning'
        });
    } else if (temp <= 0) {
        alerts.push({
            type: 'Freezing Conditions',
            message: 'Temperature is below freezing. Take precautions against ice and frost.',
            icon: 'warning'
        });
    }

    // Wind alerts
    if (windSpeed >= 20) {
        alerts.push({
            type: 'Strong Winds',
            message: 'High wind speeds detected. Secure loose objects outdoors.',
            icon: 'warning'
        });
    }

    // Severe weather conditions
    const weatherId = data.weather[0].id;
    if (weatherId >= 200 && weatherId < 300) {
        alerts.push({
            type: 'Thunderstorm Warning',
            message: 'Thunderstorm activity detected. Seek shelter indoors.',
            icon: 'warning'
        });
    } else if (weatherId >= 500 && weatherId < 600 && data.rain && data.rain['1h'] > 10) {
        alerts.push({
            type: 'Heavy Rain',
            message: 'Heavy rainfall may cause flooding in low-lying areas.',
            icon: 'warning'
        });
    }

    // Show alerts if any
    if (alerts.length > 0) {
        showWeatherAlerts(alerts);
    }
}

function showWeatherAlerts(alerts) {
    alerts.forEach((alert, index) => {
        setTimeout(() => {
            Swal.fire({
                icon: alert.icon,
                title: alert.type,
                text: alert.message,
                toast: true,
                position: 'top-end',
                timer: 8000,
                timerProgressBar: true,
                showConfirmButton: false,
                background: 'rgba(0, 0, 0, 0.9)',
                color: '#fff'
            });
        }, index * 1000); // Show alerts with 1-second delay between each
    });
}

function showLoadingAlert() {
    Swal.fire({
        title: 'Loading...',
        text: 'Fetching weather data',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: 'rgba(0, 0, 0, 0)',
        color: '#fff',
        backdrop: 'rgba(0, 0, 0, 0.4)'
    });
}

function handleWeatherError(error, city) {
    console.error('Error:', error);
    
    // Check for offline data as fallback
    const offlineData = getFromLocalStorage(city);
    if (offlineData) {
        updateWeatherUI(offlineData);
        showWeatherAlert('Connection Error', 'Showing stored data for ' + city, 'warning');
        return;
    }

    // Reset to dashboard state
    resetToDashboard();

    // Fade in the container
    const container = document.querySelector('.container');
    setTimeout(() => {
        container.style.opacity = '1';
    }, 100);

    // Show error message
    showWeatherAlert('Error', error.message, 'error');

    // Reset map to default view
    if (map) {
        map.setView([0, 0], 2);
        if (marker) {
            marker.remove();
        }
    }
}

function showWeatherAlert(title, text, icon) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: icon === 'warning' || icon === 'info',
        position: icon === 'warning' || icon === 'info' ? 'top-end' : 'center',
        timer: icon === 'warning' || icon === 'info' ? 5000 : undefined,
        timerProgressBar: true,
        showConfirmButton: !['warning', 'info'].includes(icon),
        confirmButtonColor: '#00feba',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#fff'
    });
}

function updateTimezoneInfo(timezone) {
    const timezoneHours = Math.floor(Math.abs(timezone) / 3600);
    const timezoneMinutes = Math.floor((Math.abs(timezone) % 3600) / 60);
    const timezoneSign = timezone >= 0 ? '+' : '-';
    const timezoneFormatted = `GMT${timezoneSign}${String(timezoneHours).padStart(2, '0')}:${String(timezoneMinutes).padStart(2, '0')}`;
    
    const existingTimezone = document.querySelector('.timezone-info');
    if (existingTimezone) {
        existingTimezone.remove();
    }

    const timezoneInfo = document.createElement('div');
    timezoneInfo.className = 'timezone-info';
    timezoneInfo.textContent = timezoneFormatted;
    
    const datetimeBox = document.querySelector('.datetime-box');
    if (datetimeBox) {
        datetimeBox.appendChild(timezoneInfo);
    }
}

async function updateForecast(city) {
    try {
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
        const forecastResponse = await fetch(forecastUrl);
        if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json();
            
            const forecastContainer = document.querySelector('.forecast-container');
            if (!forecastContainer) return;
            
            forecastContainer.innerHTML = '';

            const dailyForecasts = forecastData.list
                .filter(forecast => forecast.dt_txt.includes('12:00:00'))
                .slice(0, 5);

            dailyForecasts.forEach((forecast, index) => {
                const date = new Date(forecast.dt * 1000);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const temp = currentUnit === 'metric' ? 
                    Math.round(forecast.main.temp) : 
                    Math.round(celsiusToFahrenheit(forecast.main.temp));
                const iconCode = forecast.weather[0].icon;

                const forecastItem = document.createElement('div');
                forecastItem.className = 'forecast-item';
                forecastItem.innerHTML = `
                    <div class="date">${dayName}</div>
                    <img src="https://openweathermap.org/img/wn/${iconCode}.png" 
                         alt="weather icon" 
                         style="--i: ${index}">
                    <div class="temp">${temp}°${currentUnit === 'metric' ? 'C' : 'F'}</div>
                `;

                forecastContainer.appendChild(forecastItem);
            });
        }
    } catch (error) {
        console.error('Forecast error:', error);
    }
}

function initApp() {
    updateDateTime();
    
    initWeatherApp();
}

function initWeatherApp() {
    checkWeather('London');
    showWelcomeMessage();
}

function showWelcomeMessage() {
    Swal.fire({
        title: 'Welcome to Weather App!',
        text: 'Search for any city to get weather information',
        icon: 'info',
        confirmButtonColor: '#00feba',
        background: 'rgba(0, 0, 0, 0.75)',
        color: '#fff',
        backdrop: 'rgba(0, 0, 0, 0.4)',
        showClass: {
            popup: 'animate__animated animate__fadeIn'
        }
    });
}

// Helper function to update UI with weather data
function updateWeatherUI(data) {
    // Store the data for unit conversion
    lastWeatherData = data;

    const cityTime = updateDateTime(data.timezone);
    const weatherCode = data.weather[0].icon;
    const isDay = isDayTime(cityTime);
    const adjustedWeatherCode = weatherCode.slice(0, -1) + (isDay ? 'd' : 'n');

    document.body.style.background = getWeatherBackground(adjustedWeatherCode);
    
    // Update temperature based on unit
    const temp = currentUnit === 'metric' ? 
        Math.round(data.main.temp) : 
        Math.round(celsiusToFahrenheit(data.main.temp));
    temperature.textContent = `${temp}°${currentUnit === 'metric' ? 'C' : 'F'}`;
    
    cityName.textContent = `${data.name}, ${data.sys.country}`;
    description.textContent = data.weather[0].description;
    humidity.textContent = `${data.main.humidity}%`;
    
    // Update wind speed based on unit
    const windSpeed = currentUnit === 'metric' ? 
        data.wind.speed : 
        kmhToMph(data.wind.speed);
    wind.textContent = `${windSpeed.toFixed(1)} ${currentUnit === 'metric' ? 'km/h' : 'mph'}`;
    
    weatherIcon.src = `https://openweathermap.org/img/wn/${weatherCode}@2x.png`;

    // Update sun cycle times
    const sunriseTime = new Date(data.sys.sunrise * 1000);
    const sunsetTime = new Date(data.sys.sunset * 1000);
    document.querySelector('.sunrise span').textContent = sunriseTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    document.querySelector('.sunset span').textContent = sunsetTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    updateTimezoneInfo(data.timezone);
    updateMap(data.coord.lat, data.coord.lon, data.name);
    
    // Fetch and update additional data
    fetchUVIndex(data.coord.lat, data.coord.lon);
    fetchAirQuality(data.coord.lat, data.coord.lon);
}

// Unit conversion functions
function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

function kmhToMph(kmh) {
    return kmh * 0.621371;
}

// Update map layer based on selected type
function updateMapLayer() {
    if (map) {
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        let tileLayer;
        switch (currentMapType) {
            case 'satellite':
                tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
                break;
            case 'radar':
                // Add weather radar layer if available
                tileLayer = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + apiKey);
                break;
            default:
                tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        }
        tileLayer.addTo(map);
    }
}

// Fetch UV Index data
async function fetchUVIndex(lat, lon) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&appid=${apiKey}`);
        const data = await response.json();
        const uvSpan = document.querySelector('.uv-index span');
        const uvValue = Math.round(data.current.uvi);
        uvSpan.textContent = uvValue;
        
        // Add color coding based on UV level
        uvSpan.className = 'uv-' + getUVRiskLevel(uvValue);
        
        // Show UV warning if needed
        if (uvValue >= 3) {
            showUVAlert(uvValue);
        }
    } catch (error) {
        console.error('UV Index fetch error:', error);
        const uvSpan = document.querySelector('.uv-index span');
        uvSpan.textContent = 'N/A';
    }
}

function getUVRiskLevel(uvIndex) {
    if (uvIndex <= 2) return 'low';
    if (uvIndex <= 5) return 'moderate';
    if (uvIndex <= 7) return 'high';
    if (uvIndex <= 10) return 'very-high';
    return 'extreme';
}

function getUVAdvice(uvIndex) {
    const uvLevels = {
        low: {
            risk: 'Low',
            color: '#3498db',
            advice: 'No protection required. You can safely stay outside.'
        },
        moderate: {
            risk: 'Moderate',
            color: '#2ecc71',
            advice: 'Wear sunscreen, protective clothing, and seek shade during midday hours.'
        },
        high: {
            risk: 'High',
            color: '#f1c40f',
            advice: 'Reduce time in the sun between 10 a.m. and 4 p.m. Apply sunscreen SPF 30+.'
        },
        'very-high': {
            risk: 'Very High',
            color: '#e67e22',
            advice: 'Minimize sun exposure during midday hours. Shirt, sunscreen, and hat are essential.'
        },
        extreme: {
            risk: 'Extreme',
            color: '#e74c3c',
            advice: 'Avoid sun exposure during midday hours. Shirt, sunscreen, and hat are essential.'
        }
    };

    let riskLevel = getUVRiskLevel(uvIndex);
    return uvLevels[riskLevel];
}

function showUVAlert(uvIndex) {
    const uvInfo = getUVAdvice(uvIndex);
    Swal.fire({
        icon: 'warning',
        title: `UV Index: ${uvIndex} (${uvInfo.risk})`,
        html: `
            <div style="color: ${uvInfo.color}; font-size: 1.2em; margin-bottom: 10px;">
                Risk Level: ${uvInfo.risk}
            </div>
            <div style="margin-bottom: 15px;">
                ${uvInfo.advice}
            </div>
            <div style="font-size: 0.9em; opacity: 0.8;">
                UV Index scale: 1-2 (Low), 3-5 (Moderate), 6-7 (High), 8-10 (Very High), 11+ (Extreme)
            </div>
        `,
        timer: 8000,
        timerProgressBar: true,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#fff'
    });
}

// Fetch Air Quality data
async function fetchAirQuality(lat, lon) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Air Quality Data:', data); // Debug log

        const aqiSpan = document.querySelector('.air-quality .text span');
        if (!aqiSpan) {
            console.error('Air quality span element not found');
            return;
        }

        if (!data.list || !data.list[0] || !data.list[0].main) {
            throw new Error('Invalid air quality data format');
        }

        const aqi = data.list[0].main.aqi;
        const aqiLabels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
        const aqiLabel = aqiLabels[aqi - 1];
        const aqiText = `${aqiLabel} (${aqi}/5)`;

        // Update the span content and class
        aqiSpan.textContent = aqiText;
        
        // Remove any existing aqi classes
        aqiSpan.className = '';
        // Add the new class
        aqiSpan.classList.add(`aqi-${getAQIClass(aqi)}`);

        // Show air quality details if AQI is available
        if (data.list[0].components) {
            const components = data.list[0].components;
            showAirQualityDetails(aqiLabel, components);
        }

    } catch (error) {
        console.error('Air Quality fetch error:', error);
        const aqiSpan = document.querySelector('.air-quality .text span');
        if (aqiSpan) {
            aqiSpan.textContent = 'N/A';
            aqiSpan.className = 'aqi-unknown';
        }
    }
}

function getAQIClass(aqi) {
    switch(aqi) {
        case 1: return 'good';
        case 2: return 'fair';
        case 3: return 'moderate';
        case 4: return 'poor';
        case 5: return 'very-poor';
        default: return 'unknown';
    }
}

// Weather Alert Functions
function showAirQualityDetails(quality, components) {
    Swal.fire({
        icon: quality === 'Good' || quality === 'Fair' ? 'info' : 'warning',
        title: 'Air Quality Details',
        html: `
            <div class="air-quality-details">
                <div>Air Quality: <b>${quality}</b></div>
                <div style="margin-top: 15px; text-align: left;">
                    <div>Fine particles (PM2.5): ${components.pm2_5} μg/m³</div>
                    <div>Coarse particles (PM10): ${components.pm10} μg/m³</div>
                    <div>Ozone (O₃): ${components.o3} μg/m³</div>
                    <div>Nitrogen Dioxide (NO₂): ${components.no2} μg/m³</div>
                    <div>Carbon Monoxide (CO): ${components.co} μg/m³</div>
                    <div>Sulfur Dioxide (SO₂): ${components.so2} μg/m³</div>
                </div>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    WHO guidelines for 24-hour mean:
                    <br>PM2.5: < 15 μg/m³
                    <br>PM10: < 45 μg/m³
                    <br>NO₂: < 25 μg/m³
                </div>
            </div>
        `,
        timer: 10000,
        timerProgressBar: true,
        toast: true,
        position: 'top-end',
        showConfirmButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#00feba',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#fff'
    });
}

// Add these helper functions before updateWeatherUI
function calculatePrecipitation(data) {
    console.log('Precipitation data:', data.rain, data.snow); // Debug log
    
    let amount = 0;
    let type = 'none';

    // Check for rain data
    if (data.rain) {
        // API can return 1h or 3h precipitation
        amount = data.rain['1h'] || data.rain['3h'] || 0;
        type = 'rain';
    }
    // Check for snow data
    else if (data.snow) {
        // API can return 1h or 3h precipitation
        amount = data.snow['1h'] || data.snow['3h'] || 0;
        type = 'snow';
    }
    // Check weather condition codes for precipitation when amount is not provided
    else if (data.weather && data.weather[0]) {
        const code = data.weather[0].id;
        if (code >= 200 && code < 600) {
            type = code >= 600 ? 'snow' : 'rain';
            amount = 0.1; // Set a minimal amount to indicate precipitation
        }
    }

    console.log('Calculated precipitation:', { amount, type }); // Debug log
    return { amount, type };
}

function getPrecipitationText(precip) {
    if (precip.type === 'none' || precip.amount === 0) {
        // Check weather description for precipitation indicators
        const weatherDesc = lastWeatherData?.weather[0]?.description?.toLowerCase() || '';
        if (weatherDesc.includes('rain') || weatherDesc.includes('shower')) {
            return 'Light rain (trace amount)';
        } else if (weatherDesc.includes('snow')) {
            return 'Light snow (trace amount)';
        }
        return 'No precipitation';
    }
    
    const formattedAmount = precip.amount.toFixed(1);
    if (precip.type === 'rain') {
        if (precip.amount < 0.5) return `Light rain (${formattedAmount} mm)`;
        if (precip.amount < 4) return `Moderate rain (${formattedAmount} mm)`;
        return `Heavy rain (${formattedAmount} mm)`;
    } else {
        if (precip.amount < 1) return `Light snow (${formattedAmount} mm)`;
        if (precip.amount < 5) return `Moderate snow (${formattedAmount} mm)`;
        return `Heavy snow (${formattedAmount} mm)`;
    }
}

// Add these unit conversion functions
function convertTemperature(value, toUnit) {
    if (toUnit === 'imperial') {
        return celsiusToFahrenheit(value);
    } else {
        return fahrenheitToCelsius(value);
    }
}

function fahrenheitToCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5/9;
}

function mphToKmh(mph) {
    return mph / 0.621371;
}

// Add this new function to handle unit conversions
function updateUnitsDisplay(data, oldUnit) {
    // Update temperature
    const currentTemp = parseFloat(temperature.textContent);
    const newTemp = oldUnit === 'metric' ? 
        celsiusToFahrenheit(currentTemp) : 
        fahrenheitToCelsius(currentTemp);
    temperature.textContent = `${Math.round(newTemp)}°${currentUnit === 'metric' ? 'C' : 'F'}`;

    // Update wind speed
    const currentWind = parseFloat(wind.textContent);
    const newWind = oldUnit === 'metric' ? 
        kmhToMph(currentWind) : 
        mphToKmh(currentWind);
    wind.textContent = `${newWind.toFixed(1)} ${currentUnit === 'metric' ? 'km/h' : 'mph'}`;

    // Update forecast temperatures if they exist
    const forecastItems = document.querySelectorAll('.forecast-item .temp');
    forecastItems.forEach(item => {
        const temp = parseFloat(item.textContent);
        const newTemp = oldUnit === 'metric' ? 
            celsiusToFahrenheit(temp) : 
            fahrenheitToCelsius(temp);
        item.textContent = `${Math.round(newTemp)}°${currentUnit === 'metric' ? 'C' : 'F'}`;
    });
}

// Add function to fetch and display places
async function updatePlacesOverview() {
    const placesGrid = document.querySelector('.places-grid');
    if (!placesGrid) return;

    placesGrid.innerHTML = ''; // Clear existing content
    
    // Show loading state
    placesGrid.innerHTML = '<div class="loading">Loading places...</div>';

    try {
        // Fetch weather data for all cities
        const promises = majorCities.map(city => 
            fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${currentUnit}`)
            .then(response => response.json())
        );

        const results = await Promise.all(promises);

        // Clear loading state
        placesGrid.innerHTML = '';

        // Display each place
        results.forEach(data => {
            if (data.cod === 200) {
                const temp = Math.round(data.main.temp);
                const placeCard = document.createElement('div');
                placeCard.className = 'place-card';
                placeCard.innerHTML = `
                    <div class="city-name">${data.name}, ${data.sys.country}</div>
                    <div class="temp">${temp}°${currentUnit === 'metric' ? 'C' : 'F'}</div>
                    <div class="description">${data.weather[0].description}</div>
                `;
                placeCard.addEventListener('click', () => {
                    searchInput.value = data.name;
                    checkWeather(data.name);
                });
                placesGrid.appendChild(placeCard);
            }
        });
    } catch (error) {
        console.error('Error fetching places:', error);
        placesGrid.innerHTML = '<div class="error">Error loading places</div>';
    }
}