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
  
  // Admin only. purpose 'print' labels the audit-log row; the first download or
  // print is the original, every later one comes back marked COPY / RE-PRINT.
  download: (ctcNumber, purpose = 'download') =>
    apiClient.get(`/forms/download/${ctcNumber}`, { params: { purpose }, responseType: 'blob' }),

  getRecords: (params) => apiClient.get('/forms/records', { params }),

  getRecord: (id) => apiClient.get(`/forms/records/${id}`),

  deleteRecord: (id) => apiClient.delete(`/forms/records/${id}`),

  getAccessLog: (params) => apiClient.get('/forms/access-log', { params }),

  getStats: () => apiClient.get('/forms/dashboard/stats'),
};
