import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, apiKey } = req.body;

  try {
    let oldSummary = '';

    const { blobs } = await list({ prefix: 'casual_chat_memory.json' });
    if (blobs.length > 0) {
      try {
        const response = await fetch(blobs[0].url);
        const oldMemory = await response.json();
        oldSummary = oldMemory.summary || '';
      } catch {}
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const conversationText = messages.map(m => `${m.role}: ${m.text}`).join('\n');
    const prompt = `Previous summary: ${oldSummary}\n\nNew conversation:\n${conversationText}\n\nCompress this into a comprehensive summary (max 1000 words) covering key topics, student's interests, progress, and important context. Be detailed but concise.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    const memory = {
      lastUpdated: Date.now(),
      summary,
      recentMessages: messages.slice(-10)
    };

    const blob = await put('casual_chat_memory.json', JSON.stringify(memory, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    res.json({ success: true, blobUrl: blob.url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
