/**
 * Step 3: Correct transcription by merging with fetched lyrics (Gemini Flash)
 * - Fetches lyrics via lyrics API
 * - AI merges Whisper output + official lyrics → clean SRT
 */
import axios from 'axios'
import { geminiModel } from '../utils/gemini.js'
import { isValidSrt } from '../utils/srt.js'

export async function correctTranscription(rawSrt, title, language) {
  const lyrics = await fetchLyrics(title)

  const model = geminiModel

  const prompt = `You are a subtitle correction expert for ${language} music.

You have:
1. A Whisper transcription (may have timing errors or mishearings)
2. Official lyrics (may lack timing)

Your job: Produce a corrected SRT with accurate timing from Whisper and correct words from the lyrics.

Rules:
- Keep all SRT timestamps from the Whisper output
- Fix words using the official lyrics where Whisper got them wrong
- Do NOT add markdown, code fences, or extra text — output ONLY valid SRT
- Each subtitle entry must have exactly ONE line of text (no multi-line blocks)
- If a line is too long, split it into separate sequential subtitle entries with their own timestamps

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
