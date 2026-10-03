/**
 * Turn an API error into readable text for a toast.
 * FastAPI returns `detail` as a string for most errors but as a list of
 * objects for validation (422) errors; rendering that list directly in a
 * toast crashes React ("Objects are not valid as a React child").
 */
export const getApiErrorMessage = (error, fallback = "Something didn't go through. Let's try that again.") => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(' ');
  }
  if (!error?.response) return 'Cannot reach the server. Check the connection and try again.';
  return fallback;
};
