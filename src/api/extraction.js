import apiClient from './client';
import { evalContext } from '../utils/evalLog';

export const extractionAPI = {
  extractFields: (transcript) => apiClient.post('/extraction/fields', { transcript }),
  // Live interview: understand one answer (DistilBERT + regex) and say why if it does not fit.
  // spoken: the transcript came from Whisper in the voice interview (names may be respelled locally).
  // town: PSGC code of the town answered before, for 'address_barangay' (plan 001.6).
  // province: PSGC code of the province of birth, for 'place_of_birth_town' (plan 001.8).
  // Evaluation mode (plan 003) adds the session, the step and the try id of the Whisper call before it.
  understandAnswer: (fieldKey, transcript, spoken = false, town = null, province = null) => {
    const log = evalContext.forExtraction(fieldKey);
    return apiClient.post('/extraction/answer', {
      field_key: fieldKey, transcript, spoken, ...(town ? { town } : {}), ...(province ? { province } : {}),
      ...(log ? { eval_session_id: log.session, eval_step: log.step, ...(log.tryId ? { eval_try: log.tryId } : {}) } : {}),
    }, { timeout: 15000 });
  },
  // Re-check every answer (including manual edits) before issuing.
  checkAnswers: (answers) => apiClient.post('/extraction/answers', { answers }, { timeout: 20000 }),
  computeTax: (income) =>
    apiClient.post('/extraction/tax', null, {
      params: { gross_annual_income: income },
    }),
};
