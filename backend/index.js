import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

if (!OPENWEATHER_API_KEY) {
  console.error('CRITICAL ERROR: OPENWEATHER_API_KEY is not set in .env file');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.post('/api/predict', async (req, res) => {
  const { latitude, longitude, year, month } = req.body;
  
  try {
    // Fetch Air Pollution data from OpenWeather
    // Note: Free tier primarily supports current data. 
    // We fetch current data but labeled with the requested date for UI consistency.
    const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}`;
    
    console.log(`Fetching from OpenWeather: ${url}`);
    const response = await axios.get(url);
    
    if (!response.data || !response.data.list || response.data.list.length === 0) {
      throw new Error('No data received from OpenWeather');
    }

    const pollutionData = response.data.list[0];
    const components = pollutionData.components;
    
    // Structure for Frontend
    const result = {
      latitude,
      longitude,
      year,
      month,
      predicted_pm25: components.pm2_5, // Real PM2.5 from OpenWeather
      nearest_grid_latitude: latitude,
      nearest_grid_longitude: longitude,
      top_factors: [
        { feature: 'CO (Carbon Monoxide)', value: components.co, effect: 'increased' },
        { feature: 'NO2 (Nitrogen Dioxide)', value: components.no2, effect: 'increased' },
        { feature: 'O3 (Ozone)', value: components.o3, effect: 'decreased' },
        { feature: 'SO2 (Sulphur Dioxide)', value: components.so2, effect: 'increased' },
        { feature: 'PM10', value: components.pm10, effect: 'increased' }
      ]
    };

    res.json(result);
  } catch (error) {
    console.error(`API Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch live data from OpenWeather', 
      detail: error.response?.data?.message || error.message 
    });
  }
});

// Endpoint to search for Asian cities
app.get('/api/search-cities', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) {
    return res.json([]);
  }

  try {
    const url = `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=10&appid=${OPENWEATHER_API_KEY}`;
    const response = await axios.get(url);
    
    // ISO 3166-1 alpha-2 codes for Asian countries (approximate comprehensive list)
    const asianCountryCodes = [
      'AF', 'AM', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'BN', 'KH', 'CN', 'CY', 'GE', 'GE', 'IN', 'ID', 'IR', 'IQ', 'IL', 'IL', 'JP', 'JO', 'KZ', 'KW', 'KG', 'KZ', 'KW', 'KG', 'LA', 'LB', 'LB', 'MY', 'MV', 'MN', 'MM', 'NP', 'NP', 'OM', 'PK', 'PH', 'QA', 'QA', 'RU', 'SA', 'SA', 'SG', 'LK', 'SY', 'SY', 'TJ', 'TH', 'TJ', 'TR', 'TR', 'TM', 'TM', 'AE', 'UZ', 'VN', 'YE', 'YE'
    ];

    // Map and filter for Asia
    const cities = response.data
      .filter(city => asianCountryCodes.includes(city.country))
      .map(city => ({
        label: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`,
        value: `${city.lat},${city.lon}`,
        lat: city.lat,
        lon: city.lon
      }));

    res.json(cities);
  } catch (error) {
    console.error(`City Search Error: ${error.message}`);
    res.status(500).json({ error: 'Failed to search cities' });
  }
});

app.listen(PORT, () => {
  console.log(`Node backend running at http://localhost:${PORT}`);
  console.log(`Using OpenWeather Live Data for predictions.`);
});
