import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, transcript, audio } = req.body;

  try {
    await put(`sessions/${filename}.txt`, transcript, {
      access: 'public',
      contentType: 'text/plain'
    });

    if (audio) {
      const audioBuffer = Buffer.from(audio, 'base64');
      await put(`sessions/${filename}.webm`, audioBuffer, {
        access: 'public',
        contentType: 'audio/webm'
      });
    }

    res.json({ success: true, path: 'Vercel Blob' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
