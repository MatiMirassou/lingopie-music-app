/**
 * Step 3: Correct transcription by merging with fetched lyrics (Gemini Flash)
 * - Fetches lyrics via lyrics API
 * - AI merges Whisper output + official lyrics → clean SRT
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import axios from 'axios'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function correctTranscription(rawSrt, title, language) {
  const lyrics = await fetchLyrics(title)

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1beta' })

  const prompt = `You are a subtitle correction expert for ${language} music.

You have:
1. A Whisper transcription (may have timing errors or mishearings)
2. Official lyrics (may lack timing)

Your job: Produce a corrected SRT with accurate timing from Whisper and correct words from the lyrics.

Rules:
- Keep all SRT timestamps from the Whisper output
- Fix words using the official lyrics where Whisper got them wrong
- Do NOT add markdown, code fences, or extra text — output ONLY valid SRT
- Keep line lengths reasonable (max 2 lines per subtitle block)

--- WHISPER SRT ---
${rawSrt}

--- OFFICIAL LYRICS ---
${lyrics || 'Not available — use Whisper transcription as-is, clean it up only.'}

Output the corrected SRT:`

  const result = await model.generateContent(prompt)
  const correctedSrt = result.response.text().replace(/```[a-z]*\n?/gi, '').trim()

  if (!isValidSrt(correctedSrt)) {
    console.warn('[03-correct] AI output failed SRT validation, falling back to raw Whisper SRT')
    return rawSrt
  }

  return correctedSrt
}

function isValidSrt(text) {
  // Basic check: SRT must contain at least one timestamp line (00:00:00,000 --> 00:00:00,000)
  return /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(text)
}

async function fetchLyrics(title) {
  try {
    // Using lyrics.ovh (free, no key needed)
    const parts = title.split(' - ')
    const artist = parts[0]?.trim()
    const song = parts[1]?.trim() || title
    const { data } = await axios.get(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`,
      { timeout: 8000 }
    )
    return data.lyrics || null
  } catch {
    return null // non-fatal, Whisper will be used as-is
  }
}
