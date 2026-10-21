import apiClient from './client';

// TEMPORARY practice session log (plan 001.7; plan 003 replaces it).
// Staff calls only write; the admin calls read the log and switch test / real.
export const practiceLogAPI = {
  start: (inputMethod = 'manual') => apiClient.post('/practice-log/sessions', { input_method: inputMethod }),
  addAnswer: (sessionId, note) => apiClient.post(`/practice-log/sessions/${sessionId}/answers`, note),
  finish: (sessionId) => apiClient.post(`/practice-log/sessions/${sessionId}/finish`),

  // The tab is closing: a plain fetch with keepalive finishes after the page is gone (axios cannot).
  finishKeepalive: (sessionId) => {
    try {
      fetch(`${apiClient.defaults.baseURL}/practice-log/sessions/${sessionId}/finish`, {
        method: 'POST',
        keepalive: true,
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      }).catch(() => {});
    } catch {
      // best effort
    }
  },

  // Admin only.
  getStatus: () => apiClient.get('/practice-log/status'),
  setMode: (mode) => apiClient.put('/practice-log/mode', { mode }),
  getSessions: (params) => apiClient.get('/practice-log/sessions', { params }),
  getSession: (id) => apiClient.get(`/practice-log/sessions/${id}`),
};
