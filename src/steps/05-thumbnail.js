/**
 * Step 5: Generate thumbnail (1920x1080)
 * Uses ffmpeg to composite: BG image + YouTube thumbnail + title text
 */
import ffmpeg from 'fluent-ffmpeg'
import axios from 'axios'
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '../..')
const DEFAULT_BG = join(PROJECT_ROOT, 'assets', 'lingopie-music-bg.png')

export async function generateThumbnail(jobId, metadata, tmpDir) {
  const { videoId, title } = metadata
  const bgImage = process.env.ASSET_BG_IMAGE || DEFAULT_BG

  // Download YouTube thumbnail with fallback resolutions
  const thumbPath = join(tmpDir, `${jobId}-yt-thumb.jpg`)
  const resolutions = ['maxresdefault', 'sddefault', 'hqdefault']
  let downloaded = false
  for (const res of resolutions) {
    try {
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/${res}.jpg`
      const response = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 15000 })
      if (response.status === 200 && response.data.length > 1000) {
        fs.writeFileSync(thumbPath, response.data)
        downloaded = true
        break
      }
    } catch { /* try next resolution */ }
  }
  if (!downloaded) throw new Error(`Could not download YouTube thumbnail for ${videoId}`)

  const outputPath = join(tmpDir, `${jobId}-thumbnail.jpg`)

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(bgImage)
      .input(thumbPath)
      .complexFilter([
        // Scale YT thumb to fit left side, overlay on BG
        '[1:v]scale=960:1080:force_original_aspect_ratio=decrease,pad=960:1080:(ow-iw)/2:(oh-ih)/2[thumb]',
        '[0:v][thumb]overlay=0:0[ov]',
        // Add title text
        `[ov]drawtext=text='${escapeFfmpegText(title)}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-120:shadowcolor=black:shadowx=2:shadowy=2`,
      ])
      .output(outputPath)
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .on('end', resolve)
      .on('error', reject)
      .run()
  })

  return outputPath
}

function escapeFfmpegText(text) {
  return text.replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/\[/g, '\\[').replace(/\]/g, '\\]')
}
