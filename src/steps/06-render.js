/**
 * Step 6: Render final video with fluent-ffmpeg
 * Pipeline:
 *   intro.mp4 → [BG image + MP3 + lang subtitles + EN subtitles] → concat → final.mp4
 */
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import { join } from 'path'

const BG_IMAGE = process.env.ASSET_BG_IMAGE || './assets/lingopie-music-bg.png'
const INTRO_VIDEO = process.env.ASSET_INTRO_VIDEO || './assets/lingopie-intro.mp4'

export async function renderVideo(jobId, mp3Path, correctedSrt, translatedSrt, duration, tmpDir, outputDir) {
  // Write SRT files
  const langSrtPath = join(tmpDir, `${jobId}-lang.srt`)
  const enSrtPath = join(tmpDir, `${jobId}-en.srt`)
  fs.writeFileSync(langSrtPath, correctedSrt, 'utf8')
  fs.writeFileSync(enSrtPath, translatedSrt, 'utf8')

  // Step A: BG image + MP3 + subtitles → body.mp4
  const bodyPath = join(tmpDir, `${jobId}-body.mp4`)
  await renderBody(mp3Path, langSrtPath, enSrtPath, duration, bodyPath)

  // Step B: concat intro + body → final.mp4
  const finalPath = join(outputDir, `${jobId}-final.mp4`)
  await concatIntroBody(bodyPath, finalPath)

  return finalPath
}

function renderBody(mp3Path, langSrtPath, enSrtPath, duration, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(BG_IMAGE)
      .inputOptions(['-loop 1'])
      .input(mp3Path)
      .complexFilter([
        // Two subtitle tracks — language on top, English below
        `[0:v]subtitles=${escapeFilterPath(langSrtPath)}:force_style='FontSize=22,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Alignment=8'[v1]`,
        `[v1]subtitles=${escapeFilterPath(enSrtPath)}:force_style='FontSize=18,PrimaryColour=&H00FFFF,OutlineColour=&H000000,Outline=2,Alignment=2'[vout]`,
      ])
      .outputOptions([
        '-map [vout]',
        '-map 1:a',
        '-c:v libx264',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
        '-pix_fmt yuv420p',
        `-t ${duration}`,
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
  // ffmpeg filter paths need colons and backslashes escaped on Windows
  return p.replace(/\\/g, '/').replace(/:/g, '\\:')
}
