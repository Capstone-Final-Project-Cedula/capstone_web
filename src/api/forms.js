import apiClient from './client';

export const formsAPI = {
  issue: (data, inputMethod = 'voice', rawTranscript = null) => {
    // If data already has applicant_data, use as is
    if (data && data.applicant_data) {
      return apiClient.post('/forms/issue', data);
    }
    
    // Otherwise, wrap in applicant_data
    const payload = {
      applicant_data: data || {},
      input_method: inputMethod,
      raw_transcript: rawTranscript || null,
    };
    
    return apiClient.post('/forms/issue', payload);
  },
  
  download: (ctcNumber) =>
    apiClient.get(`/forms/download/${ctcNumber}`, { responseType: 'blob' }),
    
  getRecords: (params) => apiClient.get('/forms/records', { params }),
  
  getRecord: (id) => apiClient.get(`/forms/records/${id}`),

  deleteRecord: (id) => apiClient.delete(`/forms/records/${id}`),
  
  getStats: () => apiClient.get('/forms/dashboard/stats'),
};
