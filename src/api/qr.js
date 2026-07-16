import apiClient from './client';

export const qrAPI = {
  generate: (formData) => apiClient.post('/qr/generate', formData),
  scan: (qrToken) => apiClient.post('/qr/scan', { qr_token: qrToken }),
  decodeImage: (imageFile) => {
    const formData = new FormData();
    formData.append('qr_image', imageFile);
    return apiClient.post('/qr/decode-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};