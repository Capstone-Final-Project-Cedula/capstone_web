import apiClient from './client';

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  me: () => apiClient.get('/auth/me'),
  getStaff: () => apiClient.get('/auth/staff'),
  toggleStaffActive: (userId) => apiClient.patch(`/auth/staff/${userId}/toggle-active`),
  resetCitizenPassword: (username) => apiClient.post('/auth/citizens/reset-password', { username }),
  changePassword: (oldPassword, newPassword) =>
    apiClient.put('/auth/me/password', { old_password: oldPassword, new_password: newPassword }),
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },
};