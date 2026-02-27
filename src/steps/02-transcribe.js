/**
 * Step 2: Transcribe MP3 with OpenAI Whisper → raw SRT
 */
import OpenAI from 'openai'
import fs from 'fs'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const LANGUAGE_CODES = {
  Spanish: 'es', French: 'fr', English: 'en', German: 'de',
  Italian: 'it', Korean: 'ko', Portuguese: 'pt', Japanese: 'ja',
  Chinese: 'zh', Arabic: 'ar',
}

export async function transcribe(mp3Path, language) {
  const langCode = LANGUAGE_CODES[language]
  if (!langCode) {
    const supported = Object.keys(LANGUAGE_CODES).join(', ')
    throw new Error(`Unsupported language "${language}". Supported: ${supported}`)
  }

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(mp3Path),
    model: 'whisper-1',
    language: langCode,
    response_format: 'srt',
  })

  return transcription // raw SRT string
}
