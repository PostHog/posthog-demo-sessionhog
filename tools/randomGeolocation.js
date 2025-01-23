const cities = [
  {
    city: "New York",
    state: "US-NY",
    country: "US",
    latitude: 40.7128,
    longitude: -74.0060
  },
  {
    city: "Los Angeles",
    state: "CA",
    country: "US",
    latitude: 34.0522,
    longitude: -118.2437
  },
  {
    city: "Chicago",
    state: "IL",
    country: "US",
    latitude: 41.8781,
    longitude: -87.6298
  },
  {
    city: "London",
    country: "GB",
    latitude: 51.5074,
    longitude: -0.1278
  },
  {
    city: "Paris",
    country: "FR",
    latitude: 48.8566,
    longitude: 2.3522
  },
  {
    city: "Munich",
    country: "DE",
    latitude: 48.1351,
    longitude: 11.5820
  },
  {
    city: "Berlin",
    country: "DE",
    latitude: 52.5200,
    longitude: 13.4050
  },
  {
    city: "San Francisco",
    state: "CA",
    country: "US",
    latitude: 37.7749,
    longitude: -122.4194
  },
  {
    city: "Boston",
    state: "MA",
    country: "US",
    latitude: 42.3601,
    longitude: -71.0589
  },
  {
    city: "Amsterdam",
    country: "NL",
    latitude: 52.3676,
    longitude: 4.9041
  },
  {
    city: "Vancouver",
    country: "CA",
    latitude: 49.2827,
    longitude: -123.1207
  },
  {
    city: "San Jose",
    state: "CA",
    country: "US",
    latitude: 37.3382,
    longitude: -121.8863
  },
  {
    city: "Nashville",
    state: "TN",
    country: "US",
    latitude: 36.1627,
    longitude: -86.7816
  },
  {
    city: "Atlanta",
    state: "GA",
    country: "US",
    latitude: 33.7490,
    longitude: -84.3880
  },
  {
    city: "Denver",
    state: "CO",
    country: "US",
    latitude: 39.7392,
    longitude: -104.9903
  },
  {
    city: "Salt Lake City",
    state: "UT",
    country: "US",
    latitude: 40.7608,
    longitude: -111.8910
  },
  {
    city: "Las Vegas",
    state: "NV",
    country: "US",
    latitude: 36.1699,
    longitude: -115.1398
  },
  {
    city: "Santa Barbara",
    state: "CA",
    country: "US",
    latitude: 34.4208,
    longitude: -119.6982
  },
  {
    city: "Kansas City",
    state: "KS",
    country: "US",
    latitude: 39.1147,
    longitude: -94.6270
  },
  {
    city: "Prairie Village",
    state: "US-KS",
    country: "US",
    latitude: 38.9917,
    longitude: -94.6336
  },
  {
    city: "Saint Charles",
    state: "US-MO",
    country: "US",
    latitude: 38.7881,
    longitude: -90.4974
  }
];

/**
 * Returns a random geolocation from the predefined list of cities
 * @returns {Object} Object containing latitude, longitude, city, country, and state (if US)
 */
export function randomizeGeolocation() {
  const randomCity = cities[Math.floor(Math.random() * cities.length)];
  
  // Add small random variation to the exact coordinates (within roughly 5km)
  const latVariation = (Math.random() - 0.5) * 0.05;
  const longVariation = (Math.random() - 0.5) * 0.05;
  
  const location = {
    latitude: randomCity.latitude + latVariation,
    longitude: randomCity.longitude + longVariation,
    city: randomCity.city,
    country: randomCity.country
  };

  // Add state only for US locations
  if (randomCity.state) {
    location.state = randomCity.state;
  }

  return location;
} 