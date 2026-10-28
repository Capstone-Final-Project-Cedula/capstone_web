import apiClient from './client';
import { evalContext } from '../utils/evalLog';

export const speechAPI = {
  // fieldKey (e.g. 'surname', 'sex') tells Whisper what answer to expect,
  // which noticeably improves accuracy on short answers. town (a PSGC code, with
  // 'address_barangay') puts that town's barangays in the hint; province (with
  // 'place_of_birth_town', plan 001.8) puts that province's towns in it.
  // clip: the original compressed recording, kept by evaluation mode (plan 003) while a session is running.
  transcribe: (audioFile, fieldKey, { timeout = 30000, town, province, clip } = {}) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    if (fieldKey) formData.append('field_key', fieldKey);
    if (town) formData.append('town', town);
    if (province) formData.append('province', province);
    const log = evalContext.forTranscribe(fieldKey);
    if (log) {
      formData.append('eval_session_id', log.session);
      formData.append('eval_field', log.field);
      formData.append('eval_step', log.step);
      formData.append('eval_try', log.tryId);
      if (clip) formData.append('eval_clip', clip, 'answer.webm');
    }
    return apiClient.post('/speech/transcribe', formData, { timeout });
  },
  verify: (data) => apiClient.post('/speech/verify', data),
  getScript: (fields) => apiClient.post('/speech/script', fields),
};
