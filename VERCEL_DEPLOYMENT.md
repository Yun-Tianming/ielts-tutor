# Vercel Deployment Guide

## Quick Deploy

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Configure environment variables (see below)
4. Deploy!

## Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
VITE_GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEY=your_gemini_api_key
```

## Enable Vercel Blob Storage

1. In your Vercel project, go to the **Storage** tab
2. Click **Create Database** → **Blob**
3. Name it (e.g., "ielts-sessions")
4. Click **Create**

The `BLOB_READ_WRITE_TOKEN` environment variable will be automatically added.

## Local Development

```bash
npm install
npm run dev
```

For testing serverless functions locally:
```bash
vercel dev
```

## What Changed

- Replaced Google Cloud Storage with Vercel Blob
- Removed Express server (using Vercel Serverless Functions)
- Updated environment variable names for consistency
- All session data now stored in Vercel Blob
