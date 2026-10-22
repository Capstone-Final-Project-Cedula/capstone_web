import apiClient from './client';

// The lists behind the typing pickers (plan 002.1), written exactly as the voice path writes them.
export const placesAPI = {
  birth: (q) => apiClient.get('/places/birth', { params: { q } }),
  towns: () => apiClient.get('/places/towns'),
  barangays: (code) => apiClient.get(`/places/towns/${encodeURIComponent(code)}/barangays`),
};
