import axios from 'axios';

// REACT_APP_API_URL wins when set. Otherwise the backend is on the same computer as the page
// (port 8000), so opening the web app at http://<this-computer's-IP>:3000 from another
// device reaches the backend too, instead of that device's own "localhost".
const API_BASE = process.env.REACT_APP_API_URL || `http://${window.location.hostname || 'localhost'}:8000/api`;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // A wrong password on the login form is also a 401; let the login page
    // show that error instead of reloading the page (which wiped the message).
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // Public pages (login, the /sus survey) stay put; only the expired login is cleared.
      if (!['/login', '/sus'].includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
