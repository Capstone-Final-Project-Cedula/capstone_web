import apiClient from './client';

export const susAPI = {
  // No login needed (also used by the standalone /sus page).
  submit: (response) => apiClient.post('/sus/responses', response),
  // Admin/staff only.
  summary: () => apiClient.get('/sus/summary'),
  resync: () => apiClient.post('/sus/resync'),
};
