/**
 * Step 1: Download audio + metadata from YouTube via yt-dlp (local, no API key)
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

export async function downloadAudio(jobId, youtubeUrl, tmpDir) {
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) throw new Error(`Invalid YouTube URL: ${youtubeUrl}`)

  const mp3Path = join(tmpDir, `${jobId}.mp3`)

  // yt-dlp: extract audio, convert to mp3, write metadata to stdout as JSON
  await execFileAsync('yt-dlp', [
    youtubeUrl,
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--format', 'bestaudio/best',
    '--output', mp3Path.replace('.mp3', '.%(ext)s'),
    '--no-playlist',
    '--no-update',
    '--extractor-args', 'youtube:player_client=web,default',
  ], { timeout: 120000 })

  // yt-dlp may output as .mp3 directly or need renaming
  if (!fs.existsSync(mp3Path)) {
    // Try common alternative output name
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(jobId))
    if (!files.length) throw new Error('yt-dlp did not produce an audio file')
    fs.renameSync(join(tmpDir, files[0]), mp3Path)
  }

  // Get metadata separately (fast, no download)
  const { stdout } = await execFileAsync('yt-dlp', [
    youtubeUrl,
    '--dump-json',
    '--no-playlist',
    '--quiet',
  ], { timeout: 30000 })

  const meta = JSON.parse(stdout)

  const duration = Math.round(meta.duration || 0)
  if (duration <= 0) throw new Error(`Invalid video duration (${meta.duration}). Live streams are not supported.`)

  return {
    mp3Path,
    videoId: meta.id,
    title: meta.title,
    duration,
  }
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}
