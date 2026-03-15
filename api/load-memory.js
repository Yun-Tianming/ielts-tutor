import { list } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const { blobs } = await list({ prefix: 'casual_chat_memory.json' });

    if (blobs.length === 0) {
      return res.json({ success: true, memory: null });
    }

    const response = await fetch(blobs[0].url);
    const memory = await response.json();

    res.json({ success: true, memory });
  } catch (error) {
    res.json({ success: true, memory: null });
  }
}
