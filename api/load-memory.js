import { head, download } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const blobUrl = process.env.MEMORY_BLOB_URL;
    if (!blobUrl) {
      return res.json({ success: true, memory: null });
    }

    const { downloadUrl } = await head(blobUrl);
    const response = await fetch(downloadUrl);
    const memory = await response.json();

    res.json({ success: true, memory });
  } catch (error) {
    res.json({ success: true, memory: null });
  }
}
