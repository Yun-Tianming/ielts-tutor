
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, MicOff, Play, Square, Volume2, Award, BookOpen, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { AudioVisualizer } from './components/AudioVisualizer';
import { ChatLog } from './components/ChatLog';
import { PART_1_TOPICS, PART_2_3_TOPICS } from './constants';
import { ExamMode } from './types';

// Fisher-Yates shuffle and pick n elements
function getRandomElements<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

export default function App() {
  const [activeMode, setActiveMode] = useState<ExamMode | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [shouldSave, setShouldSave] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [casualMemory, setCasualMemory] = useState<ChatMessage[]>([]);
  
  const {
    connect,
    disconnect,
    isConnected,
    isMuted,
    setIsMuted,
    volume,
    transcripts,
    error,
    audioChunks,
  } = useGeminiLive();

  // Check for API key on mount
  useEffect(() => {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setApiKeyError(true);
    }
  }, []);

  const handleStartSession = async (mode: ExamMode) => {
    setActiveMode(mode);
    setIsSessionActive(true);
    setSessionStartTime(Date.now());
    setShowSaveDialog(false);
    setShouldSave(false);

    let selectedContentContext = "";

    if (mode === 'casual_chat') {
        try {
            const response = await fetch('/api/load-memory');
            const data = await response.json();
            if (data.success && data.memory) {
                const { summary, recentMessages } = data.memory;
                setCasualMemory(recentMessages);

                const recentContext = recentMessages
                    .map(m => `${m.role === 'user' ? 'Student' : 'You'}: ${m.text}`)
                    .join('\n');

                selectedContentContext = `CONVERSATION HISTORY:\nSummary: ${summary}\n\nRecent messages:\n${recentContext}\n\n`;
            }
        } catch (err) {
            console.log('Starting fresh conversation');
        }
    } else if (mode === 'part_1') {
        const randomTopics = getRandomElements(PART_1_TOPICS, 3);
        selectedContentContext = `SELECTED PART 1 TOPICS FOR THIS SESSION:\n${randomTopics.map(t => `Topic: ${t.topic}\nQuestions: ${t.questions.join(' ')}`).join('\n\n')}`;
    } else if (mode === 'part_2' || mode === 'part_3') {
        const randomTopic = getRandomElements(PART_2_3_TOPICS, 1)[0];
        selectedContentContext = `SELECTED PART 2 CUE CARD:\n${randomTopic.part2}\n\nSELECTED PART 3 FOLLOW-UP QUESTIONS:\n${randomTopic.part3}`;
    } else if (mode === 'full_mock') {
        const p1 = getRandomElements(PART_1_TOPICS, 2);
        const p2 = getRandomElements(PART_2_3_TOPICS, 1)[0];
        selectedContentContext = `SELECTED PART 1 TOPICS:\n${p1.map(t => `Topic: ${t.topic}\nQuestions: ${t.questions.join(' ')}`).join('\n\n')}\n\nSELECTED PART 2 CUE CARD:\n${p2.part2}\n\nSELECTED PART 3 FOLLOW-UP QUESTIONS:\n${p2.part3}`;
    } else if (mode === 'warm_up') {
        selectedContentContext = "Standard Warm-up: Name, ID check, Study/Work questions.";
    }

    // --- SYSTEM INSTRUCTION ---
    const systemInstruction = mode === 'casual_chat' ? `
You are a friendly English tutor named 'Gemini' in casual chat mode.

CRITICAL LANGUAGE RULE: You MUST communicate ONLY in English or Chinese (中文). NEVER use Japanese, Korean, French, Spanish, or any other language. If you accidentally use another language, immediately switch back to English or Chinese.

${selectedContentContext}

YOUR ROLE:
- Have natural, relaxed conversations with the student
- Keep your English teacher identity but be casual and friendly
- Help them practice English in a low-pressure environment

GENTLE CORRECTION & FEEDBACK:
- DO NOT directly point out grammar mistakes during conversation
- Instead, naturally use the correct form in your response
- Example: Student says "I go to school yesterday" → You respond "Oh, you went to school yesterday? How was it?"
- Every 3-4 exchanges, give a brief, encouraging comment on their English
- Example: "By the way, your vocabulary is improving! Keep it up." or "I noticed you're using past tense more naturally now."
- Keep feedback positive and motivating, never critical

STYLE:
- Ask follow-up questions
- Show genuine interest
- Use simple, clear English
- Be encouraging and warm

Start by greeting the student warmly.
    ` : `
      You are an expert IELTS Speaking Examiner and Tutor named 'Gemini'.
      Your goal is to conduct a speaking practice session with immediate feedback.

      IMPORTANT: Communicate ONLY in English or Chinese. Do not use any other language.

      CURRENT MODE: ${mode.toUpperCase()}
      
      === QUESTIONS TO USE ===
      ${selectedContentContext}
      ========================

      **CRITICAL PROTOCOL (TUTOR MODE)**:
      1. ASK: Ask **ONE** question from the selected list above.
      2. LISTEN: Wait for the user's response.
      3. EVALUATE (IMMEDIATELY):
         After the user finishes their answer, you MUST provide:
         - A short comment on their **Fluency** and **Vocabulary**.
         - **Corrections** if they made grammar mistakes.
         - An estimated **Band Score (0-9)** for that specific answer.
         (Keep this feedback concise, 2-3 sentences).
      4. NEXT: After providing feedback, immediately ask the **next** question from the list.

      SPECIFIC INSTRUCTIONS BY MODE:
      - WARM_UP: Introduce yourself, ask for name/ID. Ask 1 simple question. Provide feedback.
      - PART_1: Ask questions one by one from the selected topics. Give feedback after EACH answer.
      - PART_2: Read the Cue Card topic clearly. Give the user 1 minute to think (simulate silence or ask if they are ready). Then listen to their 1-2 min speech. After they finish, give detailed feedback and score.
      - PART_3: Ask abstract questions related to the Part 2 topic. Feedback/Score after each answer.
      - FULL_MOCK: Follow the flow P1 -> P2 -> P3. 
      
      Start by welcoming the candidate and asking the first question.
    `;

    try {
      await connect(systemInstruction);
    } catch (err) {
      console.error("Failed to connect", err);
      setIsSessionActive(false);
      setActiveMode(null);
    }
  };

  const handleEndSession = () => {
    setShowSaveDialog(true);
  };

  const confirmEndSession = (save: boolean) => {
    if (save) {
      saveSession();
    }
    disconnect();
    setIsSessionActive(false);
    setActiveMode(null);
    setShowSaveDialog(false);
  };

  const saveSession = async () => {
    const timestamp = new Date(sessionStartTime).toISOString().replace(/[:.]/g, '-');
    const filename = `IELTS_${activeMode}_${timestamp}`;

    // Filter non-English characters
    const cleanText = (text: string) => text.replace(/[^\x00-\x7F]/g, '');

    // Remove duplicate messages
    const uniqueTranscripts = transcripts.filter((msg, index, arr) =>
      index === 0 || msg.text !== arr[index - 1].text || msg.role !== arr[index - 1].role
    );

    const transcript = uniqueTranscripts.map(m => `[${m.role.toUpperCase()}]: ${cleanText(m.text)}`).join('\n\n');

    let audioBase64 = '';
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      audioBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });
    }

    try {
      const response = await fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, transcript, audio: audioBase64 })
      });
      const data = await response.json();

      if (activeMode === 'casual_chat') {
        try {
          await fetch('/api/save-memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: transcripts,
              apiKey: import.meta.env.VITE_GEMINI_API_KEY
            })
          });
        } catch (memErr) {
          console.error('Memory save failed:', memErr);
        }
      }

      alert(`已保存到: ${data.path}`);
    } catch (err) {
      console.error('Save error:', err);
      alert('保存失败，请确保后端服务已启动');
    }
  };

  if (apiKeyError) {
    return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
            <div className="text-center p-8 max-w-md">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">API Key Missing</h2>
                <p className="text-slate-600">Please provide a valid Google GenAI API Key in the environment variables to use this application.</p>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
              I
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">IELTS Tutor 2025</h1>
              <p className="text-xs text-slate-500 font-medium">Sep-Dec 2025 Question Bank • Random Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-sm font-medium text-slate-600">
              {isConnected ? 'Live Connected' : 'Ready'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="max-w-5xl mx-auto h-full p-6 flex flex-col gap-6">
          
          {!isSessionActive ? (
            /* Dashboard / Mode Selection */
            <div className="flex-1 flex flex-col justify-center items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-12 max-w-2xl">
                <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                  Master Your Speaking Test
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                  Start a practice session. The AI will <span className="font-semibold text-blue-600">randomly select topics</span> and provide <span className="font-semibold text-blue-600">immediate feedback & score</span> after every answer.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
                <ModeCard
                  mode="warm_up"
                  title="Warm Up"
                  icon={<MessageSquare className="w-6 h-6" />}
                  description="Intro & ID check"
                  onClick={() => handleStartSession('warm_up')}
                />
                <ModeCard
                  mode="part_1"
                  title="Part 1"
                  icon={<Volume2 className="w-6 h-6" />}
                  description="Random Topic Q&A"
                  onClick={() => handleStartSession('part_1')}
                />
                <ModeCard
                  mode="part_2"
                  title="Part 2"
                  icon={<BookOpen className="w-6 h-6" />}
                  description="Random Cue Card"
                  onClick={() => handleStartSession('part_2')}
                />
                <ModeCard
                  mode="part_3"
                  title="Part 3"
                  icon={<MessageSquare className="w-6 h-6" />}
                  description="Discussion"
                  onClick={() => handleStartSession('part_3')}
                />
                <ModeCard
                  mode="casual_chat"
                  title="Casual Chat"
                  icon={<MessageSquare className="w-6 h-6" />}
                  description="Free conversation"
                  onClick={() => handleStartSession('casual_chat')}
                />
              </div>
              
              <div className="mt-6 w-full max-w-4xl">
                 <button 
                    onClick={() => handleStartSession('full_mock')}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl p-6 shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1 flex items-center justify-between group"
                 >
                    <div className="text-left">
                        <h3 className="text-xl font-bold mb-1">Full Mock Exam (Randomized)</h3>
                        <p className="text-blue-100 text-sm">P1 + P2 + P3 with immediate scoring.</p>
                    </div>
                    <div className="bg-white/20 p-3 rounded-full group-hover:bg-white/30 transition-colors">
                        <Award className="w-8 h-8 text-white" />
                    </div>
                 </button>
              </div>
            </div>
          ) : (
            /* Live Session View */
            <div className="flex-1 flex flex-col lg:flex-row gap-6 h-full overflow-hidden animate-in zoom-in-95 duration-300">
              
              {/* Left: Visualization & Controls */}
              <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative flex items-center justify-center p-8">
                  {/* Background Accents */}
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_50%)]"></div>
                  
                  {/* Visualizer */}
                  <div className="w-full h-64 flex items-center justify-center relative z-10">
                     <AudioVisualizer isConnected={isConnected} volume={volume} />
                  </div>

                  {/* Status Text */}
                  <div className="absolute top-6 left-6 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <span className="text-blue-200 text-xs font-medium tracking-wide uppercase">
                        {activeMode?.replace('_', ' ')}
                    </span>
                    <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                    <span className="text-slate-300 text-xs">Evaluator Mode</span>
                  </div>
                </div>

                {/* Controls Bar */}
                <div className="h-24 bg-white border-t border-slate-100 flex items-center justify-between px-8">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status</span>
                            <span className="text-sm font-medium text-slate-700">
                                {isConnected ? "Listening..." : "Initializing..."}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                        >
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                        <button 
                            onClick={handleEndSession}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg shadow-red-200 transition-all flex items-center gap-2"
                        >
                            <Square className="w-4 h-4 fill-current" />
                            <span>End Session</span>
                        </button>
                    </div>
                </div>
              </div>

              {/* Right: Live Transcript */}
              <div className="lg:w-96 bg-white rounded-2xl shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden border border-slate-100">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        Live Transcript
                    </h3>
                    <span className="text-xs text-slate-400">Randomized Questions</span>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <ChatLog messages={transcripts} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-2">保存此次对话？</h3>
            <p className="text-slate-600 mb-6">对话记录将保存为文本文件</p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmEndSession(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                保存并结束
              </button>
              <button
                onClick={() => confirmEndSession(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-lg font-semibold transition-colors"
              >
                不保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 z-50">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error.message}</span>
          </div>
      )}
    </div>
  );
}

function ModeCard({ mode, title, icon, description, onClick }: { mode: string, title: string, icon: React.ReactNode, description: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-start p-6 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 text-left group h-full"
        >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">{title}</h3>
            <p className="text-slate-500 text-sm">{description}</p>
        </button>
    )
}
