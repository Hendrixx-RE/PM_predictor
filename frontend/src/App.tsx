import { useState, FormEvent, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, useMap } from 'react-leaflet';
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
  const [view, setView] = useState<'predictor' | 'heatmap'>('predictor');
  const [mapMode, setMapMode] = useState<'markers' | 'gradient'>('markers');
  const [isCriticalOnly, setIsCriticalOnly] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
  const [useCity, setUseCity] = useState(true);
  // ... rest of state ...

  const getCigarettes = (pm: number) => {
    const daily = Math.max(1, Math.round(pm / 22));
    return {
      daily,
      weekly: daily * 7,
      monthly: daily * 30
    };
  };
  const [selectedCity, setSelectedCity] = useState(PUNE_CITIES[1].name);
  const [lat, setLat] = useState(PUNE_CITIES[1].lat);
  const [lon, setLon] = useState(PUNE_CITIES[1].lon);
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
    setResult(null);

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
      setResult(data);
      setShowResult(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
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
        <h1>{view === 'heatmap' ? 'Asia PM2.5 Heatmap' : 'Pune PM2.5 Predictor'}</h1>
        {!showResult && view === 'predictor' && <p className="subtitle">High-resolution monthly air quality forecasting for Pune City</p>}
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
                      <label htmlFor="lat">Latitude</label>
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
                      <label htmlFor="lon">Longitude</label>
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
                  </div>                )}

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
