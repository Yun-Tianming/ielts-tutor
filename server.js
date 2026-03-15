import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '50mb' }));

app.post('/api/save-session', (req, res) => {
  const { filename, transcript, audio } = req.body;
  const saveDir = path.join(__dirname, 'sessions');

  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  // Save transcript
  fs.writeFileSync(path.join(saveDir, `${filename}.txt`), transcript);

  // Save audio
  if (audio) {
    const audioBuffer = Buffer.from(audio, 'base64');
    fs.writeFileSync(path.join(saveDir, `${filename}.webm`), audioBuffer);
  }

  res.json({ success: true, path: saveDir });
});

app.get('/api/load-memory', (req, res) => {
  const memoryPath = path.join(__dirname, 'sessions', 'casual_chat_memory.json');
  if (fs.existsSync(memoryPath)) {
    const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
    res.json({ success: true, memory });
  } else {
    res.json({ success: true, memory: null });
  }
});

app.post('/api/save-memory', async (req, res) => {
  const { messages, apiKey } = req.body;
  const memoryPath = path.join(__dirname, 'sessions', 'casual_chat_memory.json');
  const saveDir = path.join(__dirname, 'sessions');

  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  let oldSummary = '';
  if (fs.existsSync(memoryPath)) {
    const oldMemory = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
    oldSummary = oldMemory.summary || '';
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const conversationText = messages.map(m => `${m.role}: ${m.text}`).join('\n');
  const prompt = `Previous summary: ${oldSummary}\n\nNew conversation:\n${conversationText}\n\nCompress this into a comprehensive summary (max 1000 words) covering key topics, student's interests, progress, and important context. Be detailed but concise.`;

  const result = await model.generateContent(prompt);
  const summary = result.response.text();

  const memory = {
    lastUpdated: Date.now(),
    summary,
    recentMessages: messages.slice(-10)
  };

  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
  res.json({ success: true });
});

app.listen(3001, () => console.log('Save server running on :3001'));
