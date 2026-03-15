import { list, put } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    // List all blobs
    const { blobs } = await list();

    // Test write
    if (req.method === 'POST') {
      const testData = { test: 'data', timestamp: Date.now() };
      const blob = await put('test.json', JSON.stringify(testData), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false
      });
      return res.json({ success: true, blobs, newBlob: blob });
    }

    res.json({ success: true, blobs });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
