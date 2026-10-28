import apiClient from './client';

// Evaluation mode (plan 003). Staff calls only write (a session id or ok comes back, nothing that was
// logged); every other call is admin only on the backend and is used by the Evaluation page and Settings.
export const evalAPI = {
  // Staff
  consent: () => apiClient.get('/eval/consent'),
  start: (inputMethod = 'manual', device = null) =>
    apiClient.post('/eval/sessions', { input_method: inputMethod, ...(device ? { device } : {}) }),
  finish: (sessionId, batch = null) => apiClient.post(`/eval/sessions/${sessionId}/finish`, batch || {}),

  // The tab is closing: a plain fetch with keepalive finishes after the page is gone (axios cannot).
  finishKeepalive: (sessionId, batch = null) => {
    try {
      fetch(`${apiClient.defaults.baseURL}/eval/sessions/${sessionId}/finish`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify(batch || {}),
      }).catch(() => {});
    } catch {
      // best effort
    }
  },

  // Admin only
  getSettings: () => apiClient.get('/eval/settings'),
  saveSettings: (data) => apiClient.put('/eval/settings', data),
  getStats: (params) => apiClient.get('/eval/stats', { params }),
  getSessions: (params) => apiClient.get('/eval/sessions', { params }),
  getSession: (id) => apiClient.get(`/eval/sessions/${id}`),
  getAudio: (answerId) => apiClient.get(`/eval/answers/${answerId}/audio`, { responseType: 'blob' }),
  exportCsv: (kind, params) => apiClient.get(`/eval/export/${kind}.csv`, { params, responseType: 'blob' }),
  deleteStatus: () => apiClient.get('/eval/delete-audio'),
  deleteAudioBatch: (size = 100) => apiClient.post('/eval/delete-audio', { confirm: true, size }),
};
