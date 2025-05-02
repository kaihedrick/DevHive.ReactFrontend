import axios from 'axios';

// Force HTTPS for all requests
axios.defaults.baseURL = 'https://18.119.104.29:5001/api';

// Add a request interceptor
axios.interceptors.request.use(
  (config) => {
    // Make sure all URLs use HTTPS
    if (config.url && config.url.startsWith('http:')) {
      config.url = config.url.replace('http:', 'https:');
    }
    
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axios;
