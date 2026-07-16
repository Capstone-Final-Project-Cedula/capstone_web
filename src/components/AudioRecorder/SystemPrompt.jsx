import React, { useState, useEffect } from 'react';

const SystemPrompt = ({ 
  currentField, 
  fieldLabel, 
  isPlaying, 
  onPlayPrompt,
  onNext,
  onPrevious,
  fieldNumber,
  totalFields,
  currentAnswer,
  isComplete
}) => {
  return (
    <div className="bg-indigo-50 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg">🤖</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-600">System</span>
            <span className="text-xs text-gray-400">
              Question {fieldNumber} of {totalFields}
            </span>
          </div>
          <p className="text-gray-800 mt-1 text-lg font-medium">
            {fieldLabel}
          </p>
          {currentAnswer && (
            <div className="mt-2 p-2 bg-white rounded-lg border border-indigo-200">
              <span className="text-sm text-gray-500">Your answer: </span>
              <span className="text-gray-800 font-medium">"{currentAnswer}"</span>
            </div>
          )}
          <div className="flex space-x-3 mt-3">
            <button
              onClick={onPlayPrompt}
              disabled={isPlaying}
              className="px-4 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
            >
              🔊 {isPlaying ? 'Playing...' : 'Play Question'}
            </button>
            {currentAnswer && (
              <span className="text-sm text-green-600 flex items-center">
                ✅ Answered
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPrompt;