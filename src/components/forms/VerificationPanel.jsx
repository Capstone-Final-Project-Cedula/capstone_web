import React from 'react';

const VerificationPanel = ({ data, onUpdateField, onVerify, onConfirm, onBack, isLoading }) => {
  const fields = [
    { key: 'surname', label: 'Surname' },
    { key: 'given_name', label: 'Given Name' },
    { key: 'middle_name', label: 'Middle Name' },
    { key: 'address', label: 'Address' },
    { key: 'date', label: 'Date of Birth' },
    { key: 'sex', label: 'Sex' },
    { key: 'civil_status', label: 'Civil Status' },
    { key: 'citizenship', label: 'Citizenship' },
    { key: 'icr_no', label: 'ICR No.' },
    { key: 'place_of_birth', label: 'Place of Birth' },
    { key: 'height', label: 'Height (cm)' },
    { key: 'weight', label: 'Weight (kg)' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'gross_annual_income', label: 'Gross Income' },
    { key: 'tax_classification', label: 'Tax Classification' },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 Verify Extracted Information</h2>
      <p className="text-gray-500 mb-6">
        Review all fields below. Click "Play Verification" to hear the information read aloud.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {fields.map((field) => (
          <div key={field.key} className="p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {field.label}
            </label>
            <input
              type="text"
              value={data[field.key] || ''}
              onChange={(e) => onUpdateField(field.key, e.target.value)}
              className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 justify-end">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={onVerify}
          disabled={isLoading}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center"
        >
          🔊 Play Verification
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
        >
          ✓ Confirm & Continue
        </button>
      </div>
    </div>
  );
};

export default VerificationPanel;