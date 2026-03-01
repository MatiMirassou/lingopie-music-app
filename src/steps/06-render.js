/**
 * Step 6: Render final video with fluent-ffmpeg
 * Pipeline:
 *   intro.mp4 → [BG image + MP3 + ASS subtitles] → concat → final.mp4
 *
 * Subtitles are converted from SRT → a single ASS file with two styles
 * (Lang + En) and rendered in one pass via the `ass=` filter.
 */
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildDualAss } from '../utils/ass.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '../..')
const BG_IMAGE = process.env.ASSET_BG_IMAGE || join(PROJECT_ROOT, 'assets', 'lingopie-music-bg.png')
const INTRO_VIDEO = process.env.ASSET_INTRO_VIDEO || join(PROJECT_ROOT, 'assets', 'lingopie-intro.mp4')

export async function renderVideo(jobId, mp3Path, correctedSrt, translatedSrt, duration, tmpDir, outputDir) {
  // Write SRT files (kept for debugging / future use)
  const langSrtPath = join(tmpDir, `${jobId}-lang.srt`)
  const enSrtPath = join(tmpDir, `${jobId}-en.srt`)
  fs.writeFileSync(langSrtPath, correctedSrt, 'utf8')
  fs.writeFileSync(enSrtPath, translatedSrt, 'utf8')

  // Convert both SRT tracks into a single dual-style ASS file
  const assPath = join(tmpDir, `${jobId}-subs.ass`)
  const assContent = buildDualAss(correctedSrt, translatedSrt)
  fs.writeFileSync(assPath, assContent, 'utf8')

  // Step A: BG image + MP3 + subtitles → body.mp4
  const bodyPath = join(tmpDir, `${jobId}-body.mp4`)
  await renderBody(mp3Path, assPath, duration, bodyPath)

  // Step B: concat intro + body → final.mp4
  const finalPath = join(outputDir, `${jobId}-final.mp4`)
  await concatIntroBody(bodyPath, finalPath)

  return finalPath
}

function renderBody(mp3Path, assPath, duration, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(BG_IMAGE)
      .inputOptions(['-loop 1'])
      .input(mp3Path)
      .complexFilter([
        // Single ASS file with both Lang + En styles — one render pass
        `[0:v]ass='${escapeFilterPath(assPath)}'[vout]`,
      ])
      .outputOptions([
        '-map [vout]',
        '-map 1:a',
        '-c:v libx264',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
        '-pix_fmt yuv420p',
        '-s 1920x1080',
        '-r 25',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

function concatIntroBody(bodyPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Check if intro exists
    if (!fs.existsSync(INTRO_VIDEO)) {
      // No intro — just copy body as final
      fs.copyFileSync(bodyPath, outputPath)
      return resolve()
    }

    ffmpeg()
      .input(INTRO_VIDEO)
      .input(bodyPath)
      .complexFilter([
        '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[vout][aout]',
      ])
      .outputOptions([
        '-map [vout]',
        '-map [aout]',
        '-c:v libx264',
        '-c:a aac',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

function escapeFilterPath(p) {
  // ffmpeg filter paths: convert to forward slashes and escape colons + single quotes
  return p
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
}
