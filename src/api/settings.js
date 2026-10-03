import apiClient from './client';

// Fired after an admin saves, so the header updates without a page reload.
export const SETTINGS_UPDATED_EVENT = 'cedula:settings-updated';

export const settingsAPI = {
  get: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data),
};
