# Lingopie Music Pipeline

Web app that turns any YouTube music video into a Lingopie-branded bilingual video.

## Pipeline

```
1. Download audio (YouTube → RapidAPI)
2. Transcribe (OpenAI Whisper)
3. Correct transcription (lyrics fetch + Gemini Flash merge)
4. Translate to English (Gemini Pro)
5. Generate thumbnail (ffmpeg composite)
6. Render final video (fluent-ffmpeg: BG + intro + subtitles + MP3)
7. Upload (YouTube private + GCS)
```

## Setup

```bash
cd projects/lingopie-music-app
npm install
cp .env.example .env
# Fill in your API keys in .env
```

## Add Assets

Place these in `assets/`:
- `lingopie-music-bg.png` — 1920x1080 background
- `lingopie-intro.mp4` — branded intro clip (optional)

## Run Locally

```bash
npm run dev
# Open http://localhost:3500
```

## Deploy to Server

```bash
# Ubuntu VPS
apt install ffmpeg nodejs npm
git clone / scp project
npm install --production
npm start
# Use pm2 or systemd to keep it running
```

## Environment Variables

See `.env.example` for all required keys.
YouTube + GCS uploads are **optional** — if credentials missing, video is available locally.
