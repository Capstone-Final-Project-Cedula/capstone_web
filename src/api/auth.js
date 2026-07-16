import apiClient from './client';

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  me: () => apiClient.get('/auth/me'),
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },
};