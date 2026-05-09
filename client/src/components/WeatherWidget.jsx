import React, { useState, useEffect } from 'react';

// Caspian Sea platform coordinates
const LOCATIONS = [
  { name: 'Baku HQ', lat: 40.4093, lon: 49.8671 },
  { name: 'ACG Platform', lat: 40.8500, lon: 50.3000 },
  { name: 'Shah Deniz', lat: 39.8800, lon: 49.9200 },
];

const WMO_CODES = {
  0: { label: 'Clear Sky', icon: '☀️' },
  1: { label: 'Mainly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Icy Fog', icon: '🌫️' },
  51: { label: 'Light Drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  61: { label: 'Light Rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy Rain', icon: '🌧️' },
  71: { label: 'Light Snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '❄️' },
  80: { label: 'Rain Showers', icon: '🌦️' },
  85: { label: 'Snow Showers', icon: '🌨️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
};

const getWindDescription = (speed) => {
  if (speed < 2) return { label: 'Calm', color: 'text-green-400' };
  if (speed < 5) return { label: 'Light Breeze', color: 'text-green-400' };
  if (speed < 10) return { label: 'Moderate Wind', color: 'text-yellow-400' };
  if (speed < 15) return { label: 'Fresh Wind', color: 'text-orange-400' };
  if (speed < 20) return { label: 'Strong Wind', color: 'text-orange-500' };
  return { label: '⚠️ Storm Warning', color: 'text-red-400' };
};

const getWaveHeight = (windSpeed) => {
  // Beaufort-based Caspian wave estimate
  if (windSpeed < 3) return '< 0.5m';
  if (windSpeed < 7) return '0.5 – 1.2m';
  if (windSpeed < 12) return '1.2 – 2.5m';
  if (windSpeed < 18) return '2.5 – 4.0m';
  return '> 4.0m ⚠️';
};

const getWindDirection = (deg) => {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
};

function WeatherWidget({ onClose }) {
  const [activeLocation, setActiveLocation] = useState(0);
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchWeather = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        LOCATIONS.map(loc =>
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
            `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weathercode,relative_humidity_2m,apparent_temperature` +
            `&wind_speed_unit=ms&timezone=Asia%2FBaku`
          ).then(r => r.json())
        )
      );
      const mapped = {};
      LOCATIONS.forEach((loc, i) => {
        const c = results[i].current;
        mapped[i] = {
          temp: Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          wind: Math.round(c.wind_speed_10m * 10) / 10,
          windDir: c.wind_direction_10m,
          humidity: c.relative_humidity_2m,
          code: c.weathercode,
        };
      });
      setWeatherData(mapped);
      setLastUpdated(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Weather fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loc = LOCATIONS[activeLocation];
  const w = weatherData[activeLocation];
  const weather = w ? (WMO_CODES[w.code] || { label: 'Unknown', icon: '🌡️' }) : null;
  const wind = w ? getWindDescription(w.wind) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md border border-blue-500 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌊</span>
            <div>
              <h2 className="text-white font-bold text-lg">Caspian Sea Conditions</h2>
              <p className="text-blue-400 text-xs">
                Live weather · BP Azerbaijan Operations
                {lastUpdated && <span className="ml-2 text-gray-500">Updated {lastUpdated}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchWeather} className="text-gray-400 hover:text-white text-sm" title="Refresh">
              🔄
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Location tabs */}
        <div className="flex border-b border-gray-700">
          {LOCATIONS.map((l, i) => (
            <button
              key={i}
              onClick={() => setActiveLocation(i)}
              className={`flex-1 py-2.5 text-xs font-semibold transition ${
                activeLocation === i
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900 bg-opacity-20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3 animate-pulse">🌊</p>
              <p className="text-gray-400 text-sm">Fetching Caspian conditions...</p>
            </div>
          ) : w ? (
            <div>
              {/* Main condition */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-6xl font-bold text-white">{w.temp}°C</p>
                  <p className="text-gray-400 text-sm mt-1">Feels like {w.feelsLike}°C</p>
                  <p className="text-white text-lg mt-2">{weather.icon} {weather.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs mb-1">📍 {loc.name}</p>
                  <p className="text-gray-400 text-xs">{loc.lat}°N {loc.lon}°E</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Wind */}
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-500 text-xs mb-1">💨 Wind Speed</p>
                  <p className="text-white font-bold text-lg">{w.wind} m/s</p>
                  <p className={`text-xs font-semibold ${wind.color}`}>{wind.label}</p>
                  <p className="text-gray-500 text-xs mt-1">Direction: {getWindDirection(w.windDir)} ({w.windDir}°)</p>
                </div>

                {/* Wave height estimate */}
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-500 text-xs mb-1">🌊 Est. Wave Height</p>
                  <p className={`font-bold text-lg ${w.wind >= 18 ? 'text-red-400' : w.wind >= 12 ? 'text-orange-400' : 'text-blue-400'}`}>
                    {getWaveHeight(w.wind)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Caspian estimate</p>
                </div>

                {/* Humidity */}
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-500 text-xs mb-1">💧 Humidity</p>
                  <p className="text-white font-bold text-lg">{w.humidity}%</p>
                  <p className="text-gray-500 text-xs mt-1">Relative humidity</p>
                </div>

                {/* Platform ops status */}
                <div className={`rounded-lg p-3 border ${
                  w.wind >= 18 ? 'bg-red-900 bg-opacity-30 border-red-600' :
                  w.wind >= 12 ? 'bg-yellow-900 bg-opacity-30 border-yellow-600' :
                  'bg-green-900 bg-opacity-30 border-green-700'
                }`}>
                  <p className="text-gray-400 text-xs mb-1">🛢️ Ops Status</p>
                  <p className={`font-bold text-sm ${
                    w.wind >= 18 ? 'text-red-400' :
                    w.wind >= 12 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {w.wind >= 18 ? '⛔ SUSPENDED' :
                     w.wind >= 12 ? '⚠️ RESTRICTED' :
                     '✅ NORMAL'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {w.wind >= 18 ? 'Cease outdoor ops' :
                     w.wind >= 12 ? 'Caution advised' :
                     'All ops permitted'}
                  </p>
                </div>
              </div>

              {/* Storm warning banner */}
              {w.wind >= 18 && (
                <div className="bg-red-900 bg-opacity-50 border border-red-500 rounded-lg px-4 py-3 text-center">
                  <p className="text-red-400 font-bold text-sm animate-pulse">
                    ⛈️ STORM WARNING — Notify OIM immediately
                  </p>
                  <p className="text-red-300 text-xs mt-1">
                    Wind {w.wind} m/s exceeds safe operating threshold
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Failed to load weather data</p>
              <button onClick={fetchWeather} className="mt-3 text-blue-400 text-sm hover:underline">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;