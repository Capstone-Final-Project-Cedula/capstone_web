import apiClient from './client';

export const speechAPI = {
  // fieldKey (e.g. 'surname', 'sex') tells Whisper what answer to expect,
  // which noticeably improves accuracy on short answers. town (a PSGC code, with
  // 'address_barangay') puts that town's barangays in the hint; province (with
  // 'place_of_birth_town', plan 001.8) puts that province's towns in it.
  transcribe: (audioFile, fieldKey, { timeout = 30000, town, province } = {}) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    if (fieldKey) formData.append('field_key', fieldKey);
    if (town) formData.append('town', town);
    if (province) formData.append('province', province);
    return apiClient.post('/speech/transcribe', formData, { timeout });
  },
  verify: (data) => apiClient.post('/speech/verify', data),
  getScript: (fields) => apiClient.post('/speech/script', fields),
};
