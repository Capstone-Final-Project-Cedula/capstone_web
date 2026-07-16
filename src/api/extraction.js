import apiClient from './client';

export const extractionAPI = {
  extractFields: (transcript) => apiClient.post('/extraction/fields', { transcript }),
  computeTax: (income) =>
    apiClient.post('/extraction/tax', null, {
      params: { gross_annual_income: income },
    }),
};
