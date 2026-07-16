import React, { useState, useRef } from 'react';

const InteractiveRecorder = ({ 
  onRecord, 
  isRecording, 
  setIsRecording,
  currentField,
  fieldLabel,
  fieldNumber,
  totalFields 
}) => {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        setAudioChunks(chunks);
        if (onRecord) {
          onRecord(blob);
        }
        // Auto-start next question after 1 second
        setTimeout(() => {
          setAudioURL(null);
          setAudioChunks([]);
        }, 1000);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg">
      <div className="text-center mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">
            Question {fieldNumber} of {totalFields}
          </span>
          <span className="text-sm font-medium text-indigo-600">
            {Math.round((fieldNumber / totalFields) * 100)}% Complete
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(fieldNumber / totalFields) * 100}%` }}
          />
        </div>

        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          🎤 {fieldLabel}
        </h3>
        <p className="text-sm text-gray-500">
          Speak clearly in English. Click record and say your answer.
        </p>
      </div>

      <div className="flex items-center justify-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-sm font-medium text-gray-600">
            {isRecording ? '🔴 Recording...' : '⏸️ Ready to Record'}
          </span>
        </div>

        {isRecording && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-red-500 font-mono">
              ⏱️ {formatDuration(recordingDuration)}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-center space-x-4 mt-4">
        {!isRecording && !audioURL && (
          <button
            onClick={startRecording}
            className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center text-lg"
          >
            <span className="mr-2">🎙️</span> Click to Speak
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center text-lg"
          >
            <span className="mr-2">⏹️</span> Stop Recording
          </button>
        )}

        {audioURL && !isRecording && (
          <div className="flex items-center space-x-4">
            <audio controls src={audioURL} className="h-10" />
            <span className="text-green-600 font-medium">✅ Answer recorded!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveRecorder;