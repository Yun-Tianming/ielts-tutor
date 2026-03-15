<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# IELTS Speaking Tutor

An AI-powered IELTS speaking practice app using Gemini API.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO)

### Environment Variables

Configure these in Vercel Dashboard → Settings → Environment Variables:

- `VITE_GEMINI_API_KEY` - Your Gemini API key (get from https://aistudio.google.com/app/apikey)
- `GEMINI_API_KEY` - Same Gemini API key (for serverless functions)
- `BLOB_READ_WRITE_TOKEN` - Auto-generated when you enable Vercel Blob Storage

### Enable Vercel Blob Storage

1. Go to your Vercel project dashboard
2. Navigate to Storage tab
3. Create a new Blob store
4. The `BLOB_READ_WRITE_TOKEN` will be automatically added to your environment variables

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your API key:
   ```bash
   cp .env.example .env.local
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Test serverless functions locally (optional):
   ```bash
   vercel dev
   ```
