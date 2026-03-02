/**
 * Step 4: Translate corrected SRT to English (Gemini Flash)
 */
import { geminiModel } from '../utils/gemini.js'
import { isValidSrt } from '../utils/srt.js'

export async function translateSrt(correctedSrt, language) {
  const model = geminiModel

  const prompt = `You are a professional subtitle translator. Translate the following SRT from ${language} to English.

Rules:
- Keep ALL timestamps exactly as-is
- Only translate the text lines
- Keep translations natural and singable where possible
- Each subtitle entry must have exactly ONE line of text — do not combine lines
- Do NOT add markdown, code fences, or extra text — output ONLY valid SRT

--- SRT TO TRANSLATE ---
${correctedSrt}

Output the English SRT:`

  const result = await model.generateContent(prompt)
  const translatedSrt = result.response.text().replace(/```[a-z]*\n?/gi, '').trim()

  if (!isValidSrt(translatedSrt)) {
    throw new Error('Translation step produced invalid SRT output')
  }

  return translatedSrt
}

