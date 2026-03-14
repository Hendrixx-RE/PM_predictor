import { useState, FormEvent } from 'react';
import './App.css';

interface Factor {
  feature: string;
  value: number;
  shap_value: number;
  effect: string;
}

interface PredictionResult {
  latitude: number;
  longitude: number;
  nearest_grid_latitude: number;
  nearest_grid_longitude: number;
  year: number;
  month: number;
  predicted_pm25: number;
  actual_pm25?: number;
  approximate_accuracy?: number;
  top_factors?: Factor[];
  meteorological_factors?: Factor[];
}

interface City {
  name: string;
  lat: string;
  lon: string;
}

const PUNE_CITIES: City[] = [
  { name: 'Custom Location', lat: '', lon: '' },
  { name: 'Shivajinagar', lat: '18.5308', lon: '73.8475' },
  { name: 'Kothrud', lat: '18.5074', lon: '73.8077' },
  { name: 'Viman Nagar', lat: '18.5679', lon: '73.9143' },
  { name: 'Hinjewadi', lat: '18.5913', lon: '73.7389' },
  { name: 'Hadapsar', lat: '18.4967', lon: '73.9417' },
  { name: 'Baner', lat: '18.5597', lon: '73.7799' },
];

function App() {
  const [isDarkMode, setIsDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [useCity, setUseCity] = useState(true);
  const [selectedCity, setSelectedCity] = useState(PUNE_CITIES[1].name);
  const [lat, setLat] = useState(PUNE_CITIES[1].lat);
  const [lon, setLon] = useState(PUNE_CITIES[1].lon);
  const [year, setYear] = useState('2023');
  const [month, setMonth] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'light' : 'dark');
  };

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    const city = PUNE_CITIES.find(c => c.name === cityName);
    if (city && city.name !== 'Custom Location') {
      setLat(city.lat);
      setLon(city.lon);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setTimeout(() => {
      setResult({
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        nearest_grid_latitude: parseFloat(lat),
        nearest_grid_longitude: parseFloat(lon),
        year: parseInt(year),
        month: parseInt(month),
        predicted_pm25: 5,
        top_factors: [
          { feature: "Mode: Manual Override", value: 5, shap_value: 0.1, effect: "increased" },
          { feature: "Location: " + (useCity ? selectedCity : 'Custom Location'), value: 0, shap_value: -0.05, effect: "decreased" }
        ]
      });
      setLoading(false);
      setShowResult(true);
    }, 800);
  };

  const resetForm = () => {
    setShowResult(false);
    setResult(null);
  };

  const getPMColor = (pm: number) => {
    if (pm <= 30) return '#48BB78'; // Good
    if (pm <= 60) return '#ECC94B'; // Satisfactory
    if (pm <= 90) return '#ED8936'; // Moderate
    if (pm <= 120) return '#E53E3E'; // Poor
    return '#822727'; // Very Poor/Severe
  };

  const getPMLabel = (pm: number) => {
    if (pm <= 30) return 'Good';
    if (pm <= 60) return 'Satisfactory';
    if (pm <= 90) return 'Moderate';
    if (pm <= 120) return 'Poor';
    return 'Severe';
  };

  return (
    <div className={`container ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="theme-toggle-container">
        <button onClick={toggleTheme} className="theme-toggle-btn">
          {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>

      <header className={showResult ? 'minimal' : ''}>
        <h1>Pune PM<sub>2.5</sub> Predictor</h1>
        {!showResult && <p className="subtitle">High-resolution monthly air quality forecasting for Pune City</p>}
      </header>

      {!showResult ? (
        <div className="input-view animate-fade-in">
          <section className="input-section card">
            <div className="section-header">
              <h2>Predictor Settings</h2>
              <div className="toggle-container">
                <button 
                  className={`toggle-btn ${useCity ? 'active' : ''}`}
                  onClick={() => setUseCity(true)}
                >
                  By City
                </button>
                <button 
                  className={`toggle-btn ${!useCity ? 'active' : ''}`}
                  onClick={() => setUseCity(false)}
                >
                  By Coords
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {useCity ? (
                <div className="form-group animate-fade-in">
                  <label htmlFor="city">Select Area in Pune</label>
                  <select
                    id="city"
                    value={selectedCity}
                    onChange={(e) => handleCityChange(e.target.value)}
                  >
                    {PUNE_CITIES.filter(c => c.name !== 'Custom Location').map(city => (
                      <option key={city.name} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-row animate-fade-in">
                  <div className="form-group">
                    <label htmlFor="lat">Latitude (18.40 - 18.70)</label>
                    <input
                      id="lat"
                      type="number"
                      step="0.0001"
                      min="18.40"
                      max="18.70"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lon">Longitude (73.70 - 74.10)</label>
                    <input
                      id="lon"
                      type="number"
                      step="0.0001"
                      min="73.70"
                      max="74.10"
                      value={lon}
                      onChange={(e) => setLon(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="year">Year</label>
                  <input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="month">Month</label>
                  <select
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    required
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="predict-btn">
                {loading ? 'Analyzing Data...' : 'Get Prediction'}
              </button>
            </form>
            {error && <div className="error-msg">{error}</div>}
          </section>
        </div>
      ) : (
        <div className="result-view animate-slide-up">
          {result && (
            <div className="result-container">
              <div className="pm-center-bar card" style={{ borderLeftColor: getPMColor(result.predicted_pm25) }}>
                <div className="pm-main-info">
                  <div className="pm-display">
                    <span className="pm-label">Predicted PM<sub>2.5</sub></span>
                    <span className="pm-value" style={{ color: getPMColor(result.predicted_pm25) }}>
                      {result.predicted_pm25}
                    </span>
                    <span className="pm-unit">µg/m³</span>
                  </div>
                  <div className="pm-status-badge" style={{ backgroundColor: getPMColor(result.predicted_pm25) }}>
                    {getPMLabel(result.predicted_pm25)}
                  </div>
                </div>

                <div className="result-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{useCity ? selectedCity : `${result.latitude.toFixed(3)}, ${result.longitude.toFixed(3)}`}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Period</span>
                    <span className="detail-value">{new Date(result.year, result.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Grid Point</span>
                    <span className="detail-value">{result.nearest_grid_latitude.toFixed(3)}N, {result.nearest_grid_longitude.toFixed(3)}E</span>
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <button onClick={resetForm} className="back-btn">← Back to Settings</button>
                <button onClick={() => window.print()} className="print-btn">Download Report</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
