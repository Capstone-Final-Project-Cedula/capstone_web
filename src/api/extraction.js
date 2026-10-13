import apiClient from './client';

export const extractionAPI = {
  extractFields: (transcript) => apiClient.post('/extraction/fields', { transcript }),
  // Live interview: understand one answer (DistilBERT + regex) and say why if it does not fit.
  understandAnswer: (fieldKey, transcript) =>
    apiClient.post('/extraction/answer', { field_key: fieldKey, transcript }, { timeout: 15000 }),
  // Re-check every answer (including manual edits) before issuing.
  checkAnswers: (answers) => apiClient.post('/extraction/answers', { answers }, { timeout: 20000 }),
  computeTax: (income) =>
    apiClient.post('/extraction/tax', null, {
      params: { gross_annual_income: income },
    }),
};
