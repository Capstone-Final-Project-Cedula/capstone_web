import apiClient from './client';

export const speechAPI = {
  // fieldKey (e.g. 'surname', 'sex') tells Whisper what answer to expect,
  // which noticeably improves accuracy on short answers.
  transcribe: (audioFile, fieldKey) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    if (fieldKey) formData.append('field_key', fieldKey);
    return apiClient.post('/speech/transcribe', formData);
  },
  verify: (data) => apiClient.post('/speech/verify', data),
  getScript: (fields) => apiClient.post('/speech/script', fields),
};
