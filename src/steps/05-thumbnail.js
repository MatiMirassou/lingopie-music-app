/**
 * Step 5: Generate thumbnail (1920x1080)
 * Uses ffmpeg to composite: BG image + YouTube thumbnail + title text
 */
import ffmpeg from 'fluent-ffmpeg'
import axios from 'axios'
import fs from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'

export async function generateThumbnail(jobId, metadata, tmpDir) {
  const { videoId, title } = metadata
  const bgImage = process.env.ASSET_BG_IMAGE || './assets/lingopie-music-bg.png'

  // Download YouTube thumbnail
  const thumbPath = join(tmpDir, `${jobId}-yt-thumb.jpg`)
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  const response = await axios.get(thumbUrl, { responseType: 'stream', timeout: 15000 })
  await pipeline(response.data, fs.createWriteStream(thumbPath))

  const outputPath = join(tmpDir, `${jobId}-thumbnail.jpg`)

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(bgImage)
      .input(thumbPath)
      .complexFilter([
        // Scale YT thumb to fit left side, overlay on BG
        '[1:v]scale=960:1080:force_original_aspect_ratio=decrease,pad=960:1080:(ow-iw)/2:(oh-ih)/2[thumb]',
        '[0:v][thumb]overlay=0:0',
        // Add title text
        `drawtext=text='${escapeFfmpegText(title)}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-120:shadowcolor=black:shadowx=2:shadowy=2`,
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
