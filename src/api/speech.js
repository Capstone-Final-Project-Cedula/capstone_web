import apiClient from './client';

export const speechAPI = {
  transcribe: (audioFile) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    return apiClient.post('/speech/transcribe', formData);
  },
  verify: (data) => apiClient.post('/speech/verify', data),
  getScript: (fields) => apiClient.post('/speech/script', fields),
};
