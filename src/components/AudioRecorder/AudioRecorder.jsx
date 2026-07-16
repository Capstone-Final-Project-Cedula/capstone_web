import React, { useState, useEffect, useRef } from 'react';

const AudioRecorder = ({ onRecord }) => {
  const [isRecording, setIsRecording] = useState(false);
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

  const resetRecording = () => {
    setAudioURL(null);
    setAudioChunks([]);
    setRecordingDuration(0);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    if (isRecording) return 'bg-red-500 animate-pulse';
    if (audioURL) return 'bg-green-500';
    return 'bg-gray-300';
  };

  const getStatusText = () => {
    if (isRecording) return '🔴 Recording...';
    if (audioURL) return '✅ Recording Ready';
    return '⏸️ Press Record to Start';
  };

  return (
    <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-700">🎤 Voice Input</h3>
        <p className="text-sm text-gray-500">
          Speak clearly in English. The system will transcribe and extract information.
        </p>
      </div>

      <div className="flex items-center justify-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <span className="text-sm font-medium text-gray-600">{getStatusText()}</span>
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
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
          >
            <span className="mr-2">🎙️</span> Start Recording
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
          >
            <span className="mr-2">⏹️</span> Stop Recording
          </button>
        )}

        {audioURL && !isRecording && (
          <div className="flex items-center space-x-4">
            <audio controls src={audioURL} className="h-10" />
            <button
              onClick={resetRecording}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              🔄 Record Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;