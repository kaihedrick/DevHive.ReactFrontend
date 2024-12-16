<<<<<<< HEAD
import axios from "axios";

const API_URL = "https://localhost:7170/api/User";


export const login = async (credentials) => {
  try {
    // Make the POST request to the login endpoint
    const response = await axios.post(`${API_URL}/ProcessLogin/`, credentials);

    // Extract  token from response
    const token = response.data?.token;

    // Log JWT Token
    console.log("Login successful. JWT Token:", token);

    return response.data; // Return token
  } catch (error) {
    // Check errors
    if (error.response && error.response.status === 401) {
      console.error("Invalid credentials. Please check your username and password.");
    } else {
      // Log other errors
      console.error("Error during login:", error.message);
    }

    throw error; //throw error
  }
=======
import axios from 'axios';

const API_URL = 'http://localhost:7170/api/User';

export const login = async (credentials) => {
  const response = await axios.post(`${API_URL}/ProcessLogin/`, credentials);
  return response.data; // This contains the token
>>>>>>> 90dd45ff33993cb9ae61c9d37a9887add43e2f11
};

export const register = async (userData) => {
  const response = await axios.post(`${API_URL}`, userData);
<<<<<<< HEAD
  return response.data; // return response
};

// Function to check if the email is a duplicate
export const validateEmail = async (email) => {
  try {
    const response = await axios.post(
      `${API_URL}/ValidateEmail`, //match curl request
      { email }, 
      {
        headers: {
          Accept: "*/*", 
          "Content-Type": "application/json", // Ensures JSON content type
        },
      }
    );
    return response.data; // Expected to return a boolean (true/false)
  } catch (error) {
    console.error("Error checking email duplicate:", error);
    throw error;
  }
=======
  return response.data;
>>>>>>> 90dd45ff33993cb9ae61c9d37a9887add43e2f11
};
