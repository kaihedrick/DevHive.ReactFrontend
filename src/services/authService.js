import axios from 'axios';

const API_URL = 'http://localhost:7170/api/User';

export const login = async (credentials) => {
  const response = await axios.post(`${API_URL}/ProcessLogin/`, credentials);
  return response.data; // This contains the token
};

export const register = async (userData) => {
  const response = await axios.post(`${API_URL}`, userData);
  return response.data;
};
