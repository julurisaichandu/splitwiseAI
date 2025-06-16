// VoiceRecorder.tsx
import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onProcessedData: (items: any[]) => void;
}

export default function VoiceRecorder({ onProcessedData }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Start recording function
  const startRecording = async () => {
    try {
      // Stop any existing recording first
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          console.log("Stopping existing recording before starting new one");
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      }
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear audio chunks before starting a new recording
      setAudioChunks([]);
      
      // Get a new stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create a new MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event listeners
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("Data available: ", event.data.size);
          setAudioChunks(prev => [...prev, event.data]);
        }
      };
      
      // Start recording
      mediaRecorder.start(500); // Collect data every 500ms
      
      console.log("MediaRecorder started, state:", mediaRecorder.state);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingStatus('Recording...');
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingStatus(`Error: ${error instanceof Error ? error.message : 'Could not access microphone'}`);
    }
  };
  
  // Pause recording function with proper state checking
  const pauseRecording = () => {
    if (!mediaRecorderRef.current) {
      console.log("No media recorder to pause");
      return;
    }
    
    try {
      console.log("Current recorder state before pause:", mediaRecorderRef.current.state);
      
      // Check if pause method exists AND the recorder is in 'recording' state
      if (typeof mediaRecorderRef.current.pause === 'function' && 
          mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        setRecordingStatus('Paused');
        console.log("MediaRecorder paused successfully");
      } else {
        console.log("Cannot pause - recorder state is not 'recording'");
        
        // If state is 'inactive', update the UI
        if (mediaRecorderRef.current.state === 'inactive') {
          setIsRecording(false);
          setRecordingStatus('Recording has already stopped');
        } 
        // If browser doesn't support pause or recorder is in another state
        else {
          // Just update UI and don't try to pause
          setIsPaused(true);
          setRecordingStatus('Paused (browser emulation)');
        }
      }
    } catch (error) {
      console.error("Error pausing recorder:", error);
      // Just update UI state instead of trying to pause
      setIsPaused(true);
      setRecordingStatus('Paused (error handled)');
    }
  };
  
  // Resume recording function with proper state checking
  const resumeRecording = () => {
    if (!mediaRecorderRef.current) {
      console.log("No media recorder to resume");
      startRecording(); // Just start a new recording
      return;
    }
    
    try {
      console.log("Current recorder state before resume:", mediaRecorderRef.current.state);
      
      // Check if resume method exists AND the recorder is in 'paused' state
      if (typeof mediaRecorderRef.current.resume === 'function' && 
          mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        setRecordingStatus('Recording...');
        console.log("MediaRecorder resumed successfully");
      } else {
        console.log("Cannot resume - either not supported or not in paused state");
        
        // If state is 'inactive', start a new recording
        if (mediaRecorderRef.current.state === 'inactive') {
          startRecording();
        }
        // If already recording, just update UI
        else if (mediaRecorderRef.current.state === 'recording') {
          setIsPaused(false);
          setRecordingStatus('Recording...');
        }
        // For any other state, try to start a new recording
        else {
          startRecording();
        }
      }
    } catch (error) {
      console.error("Error resuming recorder:", error);
      // Fallback to starting a new recording
      startRecording();
    }
  };
  
  // Stop recording function with proper state checking
  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      console.log("No media recorder to stop");
      setIsRecording(false);
      setIsPaused(false);
      return;
    }
    
    try {
      console.log("Current recorder state before stop:", mediaRecorderRef.current.state);
      
      // Only try to stop if not already inactive
      if (mediaRecorderRef.current.state !== 'inactive') {
        // Register onstop handler
        mediaRecorderRef.current.onstop = () => {
          console.log("MediaRecorder stopped, chunks:", audioChunks.length);
          // Process the audio
          processAudioAfterStopping();
        };
        
        // Request final data chunk if recording
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
        
        // Stop the recorder
        mediaRecorderRef.current.stop();
        console.log("Stopped recorder");
      } else {
        console.log("Recorder already inactive, processing directly");
        // If already inactive, process whatever data we have
        processAudioAfterStopping();
      }
    } catch (error) {
      console.error("Error stopping recorder:", error);
      setRecordingStatus(`Error: ${error instanceof Error ? error.message : 'Failed to stop recording'}`);
    } finally {
      // Stop the stream regardless of any errors
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Update UI state
      setIsRecording(false);
      setIsPaused(false);
    }
  };
  
  // Process the recorded audio
  const processAudioAfterStopping = async () => {
    console.log("Processing audio chunks:", audioChunks.length);
    
    if (audioChunks.length === 0) {
      setRecordingStatus('No audio recorded. Please try again.');
      return;
    }
    
    setIsProcessing(true);
    setRecordingStatus('Processing audio...');
    
    try {
      // Create a single audio blob from all chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log("Created audio blob:", audioBlob.size, "bytes");
      
      // For debugging: Create audio URL for the audio player
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Create FormData to send to the backend
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Send to our backend API endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/process-voice`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error (${response.status}): ${errorData}`);
      }
      
      const data = await response.json();
      setTranscript(data.transcript);
      
      // If we have processed items from LLM, update the UI
      if (data.items && data.items.length > 0) {
        onProcessedData(data.items);
        setRecordingStatus('Successfully processed! Items added to the list.');
      } else {
        setRecordingStatus('Processed, but no clear items detected. Please try again.');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setRecordingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      // Don't clear the audio chunks yet so the audio player can work
    }
  };
  
  // Audio player for testing/verification
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);
  
  return (
    <div className="p-4 border rounded-lg mb-6 bg-white">
      <h2 className="text-xl font-semibold mb-4">Voice-Based Bill Entry</h2>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg ${
              isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Start Recording
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
              >
                Resume
              </button>
            )}
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
            >
              Stop & Process
            </button>
          </>
        )}
      </div>
      
      <div className="status mb-4">
        <p className={`font-medium ${
          recordingStatus.includes('Error') 
            ? 'text-red-500' 
            : recordingStatus.includes('Success') 
              ? 'text-green-500' 
              : 'text-gray-700'
        }`}>
          {recordingStatus}
        </p>
        
        {isRecording && !isPaused && (
          <div className="flex items-center mt-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
            <p className="text-sm text-gray-600">
              Speak clearly about which items were purchased and who should pay for them
            </p>
          </div>
        )}
        
        <p className="text-sm mt-2">
          Chunks captured: {audioChunks.length}
        </p>
      </div>
      
      {audioUrl && (
        <div className="mt-2 mb-4">
          <p className="text-sm font-medium mb-1">Preview recording:</p>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
      
      {transcript && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Transcript:</h3>
          <p className="text-sm">{transcript}</p>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p className="font-semibold">Tips for best results:</p>
        <ul className="list-disc pl-5">
          <li>Clearly state the item name and price: "We bought pizza for $15.99"</li>
          <li>Specify who shares each item: "The pizza was split between John and Sarah"</li>
          <li>For corrections, be explicit: "Actually, remove Sarah from the pizza and add Mike"</li>
          <li>For best results, try to complete your recording in one session</li>
        </ul>
      </div>
    </div>
  );
}