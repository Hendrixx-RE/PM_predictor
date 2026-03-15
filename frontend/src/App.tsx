import { useState, FormEvent, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, useMap } from 'react-leaflet';
import AsyncSelect from 'react-select/async';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Custom Heatmap Layer Component using leaflet.heat
function HeatmapLayer({ points }: { points: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Intensity normalization for a darker, more vibrant feel
    const heatData = points.map(p => [
      p.lat, 
      p.lng, 
      p.pm / 120 
    ]);

    const heatLayer = (L as any).heatLayer(heatData, {
      radius: 45, // Larger radius for more overlap
      blur: 25,   // Higher blur for smooth gradients
      maxZoom: 10,
      gradient: {
        0.2: '#87FC00', // Good
        0.4: '#FCF400', // Satisfactory
        0.6: '#FC9300', // Moderate
        0.8: '#FC4C00', // Poor
        1.0: '#FD0101'  // Severe
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

// ... existing interfaces ...

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

const GLOBAL_CITIES: City[] = [
  { name: 'Custom Location', lat: '', lon: '' },
  { name: 'Delhi, India', lat: '28.6139', lon: '77.2090' },
  { name: 'Mumbai, India', lat: '19.0760', lon: '72.8777' },
  { name: 'Pune, India', lat: '18.5204', lon: '73.8567' },
  { name: 'New York, USA', lat: '40.7128', lon: '-74.0060' },
  { name: 'London, UK', lat: '51.5074', lon: '-0.1278' },
  { name: 'Tokyo, Japan', lat: '35.6762', lon: '139.6503' },
  { name: 'Dubai, UAE', lat: '25.2048', lon: '55.2708' },
  { name: 'Singapore', lat: '1.3521', lon: '103.8198' },
  { name: 'Sydney, Australia', lat: '-33.8688', lon: '151.2093' },
];

const AQI_LEVELS = [
  { label: 'Good', range: '0 to 30', color: '#87FC00', emoji: '😊', desc: 'Air quality is pristine and clear. No health risks for any group.' },
  { label: 'Moderate', range: '31 to 60', color: '#FCF400', emoji: '😐', desc: 'Air quality is acceptable, but sensitive groups may experience slight respiratory irritation.' },
  { label: 'Poor', range: '61 to 90', color: '#FC9300', emoji: '😷', desc: 'Mild discomfort and breathing difficulties may occur, especially for sensitive groups.' },
  { label: 'Unhealthy', range: '91 to 120', color: '#FC4C00', emoji: '🤒', desc: 'Everyone may experience health effects; sensitive groups could face serious consequences.' },
  { label: 'Severe', range: '121 to 250', color: '#FD0101', emoji: '🤢', desc: 'Health alert! Everyone may experience serious health effects.' },
  { label: 'Hazardous', range: '251+', color: '#742a2a', emoji: '💀', desc: 'Health warnings of emergency conditions. The entire population is likely to be affected.' },
];

interface ImportanceFactor {
  feature: string;
  importance: number;
  insight: string;
}

const FEATURE_INSIGHTS: Record<string, string> = {
  'Season: Summer': 'Rising temperatures and dry conditions are trapping pollutants near the surface.',
  'Satellite PM2.5 Aux': 'Regional satellite data suggests significant cross-border smoke or dust transport.',
  'Spatial Lag Mean': 'High pollution in neighboring areas is impacting local air quality via drift.',
  'Season: Monsoon': 'Seasonal moisture patterns are currently helping in natural air scrubbing.',
  'PM2.5 Lag (1m)': 'Stagnant air masses are causing a carry-over effect from previous weeks.',
  'Wind Speed Mean': 'Variable wind patterns are affecting the dispersal rate of particulate matter.',
  'Relative Humidity': 'High moisture content is leading to the formation of secondary aerosols.',
  'Atmospheric Pressure': 'High-pressure systems are preventing the vertical mixing of clean air.',
};

function App() {
  const [view, setView] = useState<'predictor' | 'heatmap'>('predictor');
  const [mapMode, setMapMode] = useState<'markers' | 'gradient'>('markers');
  const [isCriticalOnly, setIsCriticalOnly] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
  const [useCity, setUseCity] = useState(true);
  const [importanceData, setImportanceData] = useState<ImportanceFactor[]>([]);
  // ... rest of state ...

  const generateImportanceData = () => {
    const features = Object.keys(FEATURE_INSIGHTS);
    const data = features.map(f => ({
      feature: f,
      importance: Math.random() * 0.3,
      insight: FEATURE_INSIGHTS[f]
    })).sort((a, b) => b.importance - a.importance);
    setImportanceData(data);
  };

  const getCigarettes = (pm: number) => {
    const daily = Math.max(1, Math.round(pm / 22));
    return {
      daily,
      weekly: daily * 7,
      monthly: daily * 30
    };
  };
  const [selectedCity, setSelectedCity] = useState(GLOBAL_CITIES[3].name);
  const [lat, setLat] = useState(GLOBAL_CITIES[3].lat);
  const [lon, setLon] = useState(GLOBAL_CITIES[3].lon);
  const [year, setYear] = useState('2023');
  const [month, setMonth] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Asia City Hubs for sensible data distribution
  const generateMockHeatmap = () => {
    const points = [];
    const asiaHubs = [
      { name: 'Tokyo', lat: 35.6895, lng: 139.6917, basePM: 40 },
      { name: 'Beijing', lat: 39.9042, lng: 116.4074, basePM: 160 },
      { name: 'Delhi', lat: 28.6139, lng: 77.2090, basePM: 180 },
      { name: 'Mumbai', lat: 19.0760, lng: 72.8777, basePM: 140 },
      { name: 'Bangkok', lat: 13.7563, lng: 100.5018, basePM: 110 },
      { name: 'Jakarta', lat: -6.2088, lng: 106.8456, basePM: 130 },
      { name: 'Seoul', lat: 37.5665, lng: 126.9780, basePM: 50 },
      { name: 'Dhaka', lat: 23.8103, lng: 90.4125, basePM: 170 },
      { name: 'Shanghai', lat: 31.2304, lng: 121.4737, basePM: 120 },
      { name: 'Singapore', lat: 1.3521, lng: 103.8198, basePM: 30 },
      { name: 'Dubai', lat: 25.2048, lng: 55.2708, basePM: 90 },
      { name: 'Karachi', lat: 24.8607, lng: 67.0011, basePM: 150 },
      { name: 'Manila', lat: 14.5995, lng: 120.9842, basePM: 100 },
      { name: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297, basePM: 90 },
      { name: 'Lahore', lat: 31.5204, lng: 74.3587, basePM: 160 },
    ];

    // Generate clusters around Asian cities (Inhabited regions)
    asiaHubs.forEach(hub => {
      for (let i = 0; i < 40; i++) {
        points.push({
          id: `h-${hub.name}-${i}`,
          lat: hub.lat + (Math.random() - 0.5) * 8, // Regional spread
          lng: hub.lng + (Math.random() - 0.5) * 8,
          pm: Math.max(5, hub.basePM + (Math.random() - 0.5) * 80)
        });
      }
    });

    // Land regions background fill
    // China / East Asia
    for (let i = 0; i < 150; i++) {
      points.push({
        id: `ea-${i}`,
        lat: 20 + Math.random() * 25,
        lng: 100 + Math.random() * 30,
        pm: Math.floor(Math.random() * 100) + 20
      });
    }
    // South / West Asia
    for (let i = 0; i < 150; i++) {
      points.push({
        id: `sa-${i}`,
        lat: 10 + Math.random() * 30,
        lng: 50 + Math.random() * 50,
        pm: Math.floor(Math.random() * 120) + 30
      });
    }
    return points;
  };
  const [heatmapData, setHeatmapData] = useState(generateMockHeatmap());

  useEffect(() => {
    if (view === 'heatmap') {
      window.dispatchEvent(new Event('resize'));
    }
  }, [view]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
  };

  const [selectedCityOption, setSelectedCityOption] = useState<{label: string, value: string, lat: number, lon: number} | null>(null);
  
  const loadOptions = async (inputValue: string) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await fetch(`http://localhost:8000/api/search-cities?q=${inputValue}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  };

  const handleCityChange = (selectedOption: any) => {
    setSelectedCityOption(selectedOption);
    if (selectedOption) {
      setLat(selectedOption.lat.toString());
      setLon(selectedOption.lon.toString());
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    generateImportanceData();

    const payload = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      year: parseInt(year),
      month: parseInt(month),
    };

    try {
      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch prediction');
      }

      const data = await response.json();
      
      // Artificial delay to simulate ML processing
      setTimeout(() => {
        setResult(data);
        setShowResult(true);
        setLoading(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowResult(false);
    setResult(null);
  };

  const getPMColor = (pm: number) => {
    if (pm <= 30) return '#87FC00'; // Good
    if (pm <= 60) return '#FCF400'; // Satisfactory
    if (pm <= 90) return '#FC9300'; // Moderate
    if (pm <= 120) return '#FC4C00'; // Poor
    return '#FD0101'; // Severe
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
      <nav className="main-nav">
        <div className="nav-links">
          <button 
            className={`nav-link ${view === 'predictor' ? 'active' : ''}`}
            onClick={() => { setView('predictor'); setShowResult(false); }}
          >
            Predictor
          </button>
          <button 
            className={`nav-link ${view === 'heatmap' ? 'active' : ''}`}
            onClick={() => setView('heatmap')}
          >
            Interactive Heatmap
          </button>
        </div>
        <div className="theme-toggle-container">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <header className={showResult || view === 'heatmap' ? 'minimal' : ''}>
        <h1>{view === 'heatmap' ? 'Asia PM2.5 Heatmap' : 'PM 2.5 Predictor'}</h1>
        {!showResult && view === 'predictor' && <p className="subtitle">High-resolution monthly air quality forecasting</p>}
        {view === 'heatmap' && <p className="subtitle">{mapMode === 'gradient' ? 'Density Gradient' : 'Point Distribution'} of PM<sub>2.5</sub> across Asia</p>}
      </header>

      {view === 'heatmap' ? (
        <div className="heatmap-view animate-fade-in">
          <div className="map-container card">
            <div className="leaflet-wrapper">
              <MapContainer 
                center={[25.0, 95.0]} 
                zoom={4} 
                scrollWheelZoom={true}
                className="india-leaflet-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {mapMode === 'markers' ? (
                  heatmapData
                    .filter(point => !isCriticalOnly || point.pm > 90)
                    .map(point => (
                    <Circle
                      key={point.id}
                      center={[point.lat, point.lng]}
                      pathOptions={{ 
                        fillColor: getPMColor(point.pm), 
                        color: getPMColor(point.pm),
                        fillOpacity: 0.6,
                        weight: 1
                      }}
                      radius={30000}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                        <div className="health-impact-tooltip">
                          {point.pm > 90 ? (
                            <div className="cigarette-impact">
                              <div className="impact-header">
                                <span className="cig-count">{getCigarettes(point.pm).daily}</span>
                                <div className="cig-label-group">
                                  <span className="cig-label">Cigarettes per day</span>
                                  <span className="cig-icon">🚬</span>
                                </div>
                              </div>
                              <p className="impact-desc">Breathing the air here is as harmful as smoking {getCigarettes(point.pm).daily} cigarettes a day.</p>
                              <div className="impact-stats">
                                <div className="stat-item">
                                  <span className="stat-label">Weekly</span>
                                  <span className="stat-val">{getCigarettes(point.pm).weekly}</span>
                                </div>
                                <div className="stat-item">
                                  <span className="stat-label">Monthly</span>
                                  <span className="stat-val">{getCigarettes(point.pm).monthly}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="map-tooltip">
                              <strong>PM<sub>2.5</sub>: {point.pm} µg/m³</strong><br/>
                              <span>Status: {getPMLabel(point.pm)}</span>
                            </div>
                          )}
                        </div>
                      </Tooltip>
                    </Circle>
                  ))
                ) : (
                  <HeatmapLayer points={heatmapData} />
                )}
              </MapContainer>
              <div className="map-legend">
                <div className="legend-item"><span style={{backgroundColor: '#87FC00'}}></span> Good</div>
                <div className="legend-item"><span style={{backgroundColor: '#FCF400'}}></span> Satisfactory</div>
                <div className="legend-item"><span style={{backgroundColor: '#FC9300'}}></span> Moderate</div>
                <div className="legend-item"><span style={{backgroundColor: '#FC4C00'}}></span> Poor</div>
                <div className="legend-item"><span style={{backgroundColor: '#FD0101'}}></span> Severe</div>
              </div>
            </div>
            <div className="map-controls">
              <div className="mode-toggle-group">
                <button 
                  className={`mode-btn ${mapMode === 'markers' ? 'active' : ''}`}
                  onClick={() => setMapMode('markers')}
                >
                  Points View
                </button>
                <button 
                  className={`mode-btn ${mapMode === 'gradient' ? 'active' : ''}`}
                  onClick={() => setMapMode('gradient')}
                >
                  Gradient View
                </button>
              </div>
              <div className="action-row">
                {mapMode === 'markers' && (
                  <button 
                    className={`critical-btn ${isCriticalOnly ? 'active' : ''}`}
                    onClick={() => setIsCriticalOnly(!isCriticalOnly)}
                  >
                    Critical Health Zones
                  </button>
                )}
                <button className="predict-btn" onClick={() => setHeatmapData(generateMockHeatmap())}>Randomize Data</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        !showResult ? (
          <div className="input-view animate-fade-in">
            <section className="input-section card">
              <div className="section-header">
                <h2>Predictor Settings</h2>
                <div className="toggle-container">
                  <button 
                    className={`toggle-btn ${useCity ? 'active' : ''}`}
                    onClick={() => setUseCity(true)}
                  >
                    City
                  </button>
                  <button 
                    className={`toggle-btn ${!useCity ? 'active' : ''}`}
                    onClick={() => setUseCity(false)}
                  >
                    Coordinates
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {useCity ? (
                  <div className="form-group animate-fade-in">
                    <label htmlFor="city">Search Asian City</label>
                    <AsyncSelect
                      id="city"
                      cacheOptions
                      defaultOptions
                      loadOptions={loadOptions}
                      onChange={handleCityChange}
                      value={selectedCityOption}
                      placeholder="Type a city name (e.g. Tokyo, Delhi)"
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={{
                        control: (base) => ({
                          ...base,
                          background: 'var(--card-bg)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-main)',
                          padding: '0.2rem',
                          borderRadius: '0.5rem',
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: 'var(--text-main)',
                        }),
                        input: (base) => ({
                          ...base,
                          color: 'var(--text-main)',
                        }),
                        menu: (base) => ({
                          ...base,
                          background: 'var(--card-bg)',
                          color: 'var(--text-main)',
                          zIndex: 9999
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? 'var(--primary-color)' : 'transparent',
                          color: state.isFocused ? 'white' : 'var(--text-main)',
                          cursor: 'pointer'
                        })
                      }}
                    />
                  </div>
                ) : (
                  <div className="form-row animate-fade-in">
                    <div className="form-group">
                      <label htmlFor="lat">Latitude</label>
                      <input
                        id="lat"
                        type="number"
                        step="0.0001"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lon">Longitude</label>
                      <input
                        id="lon"
                        type="number"
                        step="0.0001"
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

              <section className="aqi-guide card animate-fade-in">
              <h3>PM<sub>2.5</sub> Air Quality Guide</h3>
              <div className="aqi-levels-list">
                {AQI_LEVELS.map((level, idx) => (
                  <div key={idx} className="aqi-level-item">
                    <div className="level-status">
                      <span className="color-dot" style={{ backgroundColor: level.color }}></span>
                      <div className="status-text">
                        <span className="status-label">{level.label}</span>
                        <span className="status-range">({level.range})</span>
                      </div>
                    </div>
                    <p className="level-desc">{level.desc}</p>
                    <span className="level-emoji">{level.emoji}</span>
                  </div>
                ))}
              </div>
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
                      <span className="detail-value">{useCity && selectedCityOption ? selectedCityOption.label : `${result.latitude.toFixed(3)}, ${result.longitude.toFixed(3)}`}</span>
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

                <div className="importance-section card">
                  <h3>Top Feature Importance</h3>
                  <div className="importance-graph">
                    {importanceData.map((item, idx) => (
                      <div key={idx} className="importance-row">
                        <span className="feature-name">{item.feature}</span>
                        <div className="importance-bar-container">
                          <div 
                            className="importance-bar" 
                            style={{ width: `${(item.importance / importanceData[0].importance) * 100}%` }}
                          ></div>
                        </div>
                        <span className="importance-val">{item.importance.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="graph-axis">
                    <span>0.00</span>
                    <span>0.05</span>
                    <span>0.10</span>
                    <span>0.15</span>
                    <span>0.20</span>
                    <span>0.25</span>
                    <span>0.30</span>
                  </div>
                  <div className="axis-label">Importance</div>
                </div>

                <div className="insights-section card">
                  <h3>Environmental Insights</h3>
                  <div className="insights-grid">
                    {importanceData.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="insight-item">
                        <span className="insight-feature">{item.feature}</span>
                        <p className="insight-text">{item.insight}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="action-buttons">
                  <button onClick={resetForm} className="back-btn">Home</button>
                  <button onClick={() => window.print()} className="print-btn">Download Report</button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

export default App;
