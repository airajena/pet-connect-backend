const axios = require('axios');

class LocationService {
  // Convert coordinates to human readable address
  static async reverseGeocode(lat, lng) {
    try {
      // Using OpenStreetMap Nominatim API (free)
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'PetConnect/1.0'
          }
        }
      );

      if (response.data && response.data.address) {
        const address = response.data.address;
        const city = address.city || address.town || address.village || '';
        const state = address.state || '';
        const country = address.country || '';
        
        return `${city}${state ? ', ' + state : ''}${country ? ', ' + country : ''}`.trim();
      }
      
      return 'Location not found';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Unknown location';
    }
  }

  // Get coordinates from address
  static async geocode(address) {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'PetConnect/1.0'
          }
        }
      );

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.display_name
        };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }
}

module.exports = LocationService;
