import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import { ChatMessage } from '../types';

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Audio Playback
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // API Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // To handle transcript updates cleanly
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const connect = async (systemInstruction: string) => {
    try {
      setError(null);
      setTranscripts([]);
      setAudioChunks([]);
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';

      if (!import.meta.env.VITE_GEMINI_API_KEY) throw new Error("API Key not found");

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // Resume audio contexts if suspended
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      const inputNode = inputAudioContextRef.current.createGain();
      const outputNode = outputAudioContextRef.current.createGain();

      // Create mixed stream for recording
      audioDestinationRef.current = outputAudioContextRef.current.createMediaStreamDestination();
      outputNode.connect(audioDestinationRef.current);
      outputNode.connect(outputAudioContextRef.current.destination);

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
          }
      });
      streamRef.current = stream;

      // Create mixed audio context for recording both input and output
      const mixContext = new AudioContextClass({ sampleRate: 24000 });
      const mixDestination = mixContext.createMediaStreamDestination();

      // Add microphone to mix
      const micSource = mixContext.createMediaStreamSource(stream);
      micSource.connect(mixDestination);

      mixedStreamRef.current = mixDestination.stream;

      // Start recording mixed stream
      const recorder = new MediaRecorder(mixedStreamRef.current);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks(prev => [...prev, e.data]);
        }
      };
      recorder.start(1000);

      // Connect to Gemini Live
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Opened');
            setIsConnected(true);
            
            // Setup Input Processing (Mic -> API)
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            inputSourceRef.current = source;
            
            // Using ScriptProcessor as per instructions (though deprecated, it's what the API expects for raw PCM streaming usually in these demos)
            // Buffer size 4096, 1 input channel, 1 output channel
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
               // Calculate volume for visualizer
               const inputData = e.inputBuffer.getChannelData(0);
               let sum = 0;
               for(let i=0; i<inputData.length; i++) {
                   sum += inputData[i] * inputData[i];
               }
               const rms = Math.sqrt(sum / inputData.length);
               setVolume(Math.min(1, rms * 5)); // Boost a bit for visibility

               if (isMuted) return;

               // Convert to blob and send
               const pcmBlob = createBlob(inputData);
               sessionPromiseRef.current?.then((session: any) => {
                   session.sendRealtimeInput({ media: pcmBlob });
               });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Transcript
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                currentOutputTranscriptionRef.current += text;
                updateTranscript('assistant', currentOutputTranscriptionRef.current, true);
             } else if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                currentInputTranscriptionRef.current += text;
                updateTranscript('user', currentInputTranscriptionRef.current, true);
             }

             if (message.serverContent?.turnComplete) {
                const finalInput = currentInputTranscriptionRef.current;
                const finalOutput = currentOutputTranscriptionRef.current;
                
                if (finalInput) updateTranscript('user', finalInput, false);
                if (finalOutput) updateTranscript('assistant', finalOutput, false);

                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
             }

             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current) {
                 const ctx = outputAudioContextRef.current;
                 const audioData = decode(base64Audio);
                 
                 // Ensure nextStartTime is valid
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 
                 const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
                 
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(ctx.destination);
                 
                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += audioBuffer.duration;
                 
                 sourcesRef.current.add(source);
                 source.onended = () => {
                     sourcesRef.current.delete(source);
                 };
             }
             
             // Handle Interruption
             if (message.serverContent?.interrupted) {
                 console.log("Model interrupted");
                 sourcesRef.current.forEach(source => {
                     try { source.stop(); } catch(e) {}
                 });
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
                 // Also clear current partial output transcript
                 currentOutputTranscriptionRef.current = '';
             }
          },
          onclose: () => {
             console.log("Session Closed");
             setIsConnected(false);
          },
          onerror: (e) => {
              console.error("Session Error", e);
              setError(new Error("Connection error occurred."));
              setIsConnected(false);
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        }
      });
      
    } catch (err: any) {
        console.error(err);
        setError(err);
        setIsConnected(false);
    }
  };

  const disconnect = () => {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }

      // Close session
      if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then((session: any) => {
              try { session.close(); } catch(e) {}
          });
          sessionPromiseRef.current = null;
      }

      // Stop sources
      sourcesRef.current.forEach(s => {
          try { s.stop(); } catch(e) {}
      });
      sourcesRef.current.clear();

      // Close audio contexts
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      
      // Stop media stream
      streamRef.current?.getTracks().forEach(t => t.stop());

      setIsConnected(false);
      setTranscripts([]);
      setVolume(0);
  };
  
  // Helper to update transcript state safely
  const updateTranscript = (role: 'user' | 'assistant', text: string, isPartial: boolean) => {
      setTranscripts(prev => {
          const lastMsg = prev[prev.length - 1];
          // If the last message is partial and from the same role, update it
          if (lastMsg && lastMsg.role === role && lastMsg.isPartial) {
              const newMsg = { ...lastMsg, text, isPartial };
              return [...prev.slice(0, -1), newMsg];
          } 
          // If we are starting a new message (even if partial)
          else if (text.trim().length > 0) {
              // But wait, if we have a finished partial message, we might need logic to overwrite?
              // The logic `turnComplete` sends `isPartial: false`.
              // If we receive a partial update for an existing partial message, we update.
              // If we receive a "final" update (isPartial=false) for an existing partial, we update.
              // If we receive a partial for a NEW turn, we append.
              
              // Let's simplify:
              // If last message is partial & same role => Update
              // Else => Append new message
               if (lastMsg && lastMsg.role === role && lastMsg.isPartial) {
                  return [...prev.slice(0, -1), { ...lastMsg, text, isPartial }];
               }
               return [...prev, { id: Date.now().toString(), role, text, isPartial }];
          }
          return prev;
      });
  };

  useEffect(() => {
      return () => {
          disconnect();
      };
  }, []);

  return {
      connect,
      disconnect,
      isConnected,
      isMuted,
      setIsMuted,
      volume,
      transcripts,
      error,
      audioChunks
  };
}
