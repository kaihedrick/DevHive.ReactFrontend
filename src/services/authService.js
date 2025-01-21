import axios from "axios";

const API_URL = "https://localhost:7170/api/User";


// Login function to authenticate the user and store token & user ID
export const login = async (credentials) => {
  try {
    // Make the POST request to the login endpoint
    const response = await axios.post(`${API_URL}/ProcessLogin/`, credentials);

    // Extract token from response
    const token = response.data?.token;

    if (token) {
      // Decode JWT to get user ID
      const decodedToken = JSON.parse(atob(token.split('.')[1])); 

      // Extract user ID from token payload (check your backend claims)
      const userId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];

      if (userId) {
        // Store token and user ID in localStorage
        localStorage.setItem("token", token);
        localStorage.setItem("userId", userId);

        console.log("Login successful. Token and user ID stored.");
      } else {
        console.error("Failed to extract user ID from token.");
      }
    } else {
      console.error("Login response did not include a token.");
    }

    return response.data; // Return response data for further use
  } catch (error) {
    // Handle different error responses
    if (error.response && error.response.status === 401) {
      console.error("Invalid credentials. Please check your username and password.");
    } else {
      console.error("Error during login:", error.message);
    }
    throw error;
  }
};
export const register = async (userData) => {
  const response = await axios.post(`${API_URL}`, userData);
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
};
// Function to get stored user ID
export const getUserId = () => {
  return localStorage.getItem("userId");
};
