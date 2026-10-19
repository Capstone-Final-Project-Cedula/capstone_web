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
  
  // Admin only. Only purpose 'print' counts: the first print is the original and every
  // later print comes back marked COPY / RE-PRINT. purpose 'download' is always a COPY
  // and never uses up the original (plan 001.4). Both are written to the access log.
  download: (ctcNumber, purpose = 'download') =>
    apiClient.get(`/forms/download/${ctcNumber}`, { params: { purpose }, responseType: 'blob' }),

  getRecords: (params) => apiClient.get('/forms/records', { params }),

  getRecord: (id) => apiClient.get(`/forms/records/${id}`),

  deleteRecord: (id) => apiClient.delete(`/forms/records/${id}`),

  getAccessLog: (params) => apiClient.get('/forms/access-log', { params }),

  getStats: () => apiClient.get('/forms/dashboard/stats'),
};
