/**
 * Pipeline orchestrator — runs all 7 steps, updates DB after each
 */
import { join } from 'path'
import db from './db.js'
import { downloadAudio } from './steps/01-download.js'
import { transcribe } from './steps/02-transcribe.js'
import { correctTranscription } from './steps/03-correct.js'
import { translateSrt } from './steps/04-translate.js'
import { generateThumbnail } from './steps/05-thumbnail.js'
import { renderVideo } from './steps/06-render.js'
import { uploadVideo } from './steps/07-upload.js'

const TMP_DIR = process.env.TMP_DIR || './tmp'
const OUTPUT_DIR = process.env.OUTPUT_DIR || './outputs'

const STEPS = [
  'Downloading audio',
  'Transcribing',
  'Correcting transcription',
  'Translating to English',
  'Generating thumbnail',
  'Rendering video',
  'Uploading',
]

export async function runPipeline(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId)
  if (!job) throw new Error(`Job ${jobId} not found`)

  const tmpDir = join(TMP_DIR, jobId)
  const { mkdirSync } = await import('fs')
  mkdirSync(tmpDir, { recursive: true })

  let mp3Path, metadata, rawSrt, correctedSrt, translatedSrt

  try {
    // Step 1: Download
    setStep(jobId, 1, STEPS[0])
    ;({ mp3Path, ...metadata } = await downloadAudio(jobId, job.youtube_url, tmpDir))

    // Step 2: Transcribe
    setStep(jobId, 2, STEPS[1])
    rawSrt = await transcribe(mp3Path, job.language)

    // Step 3: Correct
    setStep(jobId, 3, STEPS[2])
    correctedSrt = await correctTranscription(rawSrt, metadata.title, job.language)

    // Step 4: Translate
    setStep(jobId, 4, STEPS[3])
    translatedSrt = await translateSrt(correctedSrt, job.language)

    // Step 5: Thumbnail
    setStep(jobId, 5, STEPS[4])
    await generateThumbnail(jobId, { ...metadata }, tmpDir)

    // Step 6: Render
    setStep(jobId, 6, STEPS[5])
    const finalPath = await renderVideo(
      jobId, mp3Path, correctedSrt, translatedSrt,
      metadata.duration, tmpDir, OUTPUT_DIR
    )

    // Step 7: Upload
    setStep(jobId, 7, STEPS[6])
    const uploads = await uploadVideo(finalPath)

    // Done
    db.prepare(`
      UPDATE jobs SET status='done', current_step='Complete', output_url=?, metadata=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(uploads.local, JSON.stringify({ ...metadata }), jobId)

  } catch (err) {
    db.prepare(`
      UPDATE jobs SET status='failed', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(err.message, jobId)
    throw err
  }
}

function setStep(jobId, stepNumber, stepName) {
  db.prepare(`
    UPDATE jobs SET status='running', step_number=?, current_step=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(stepNumber, stepName, jobId)
  console.log(`[${jobId}] Step ${stepNumber}/7: ${stepName}`)
}
