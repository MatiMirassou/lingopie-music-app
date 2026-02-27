/**
 * Step 4: Translate corrected SRT to English (Gemini Pro)
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function translateSrt(correctedSrt, language) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  const prompt = `You are a professional subtitle translator. Translate the following SRT from ${language} to English.

Rules:
- Keep ALL timestamps exactly as-is
- Only translate the text lines
- Keep translations natural and singable where possible
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

function isValidSrt(text) {
  return /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(text)
}
