/**
 * Step 7: "Upload" — just moves the final video to the outputs folder
 * and returns a local URL for download. No cloud needed.
 */
import { basename } from 'path'

export async function uploadVideo(finalPath) {
  // File is already in outputs/ from the render step
  // Just return the local serving URL
  const filename = basename(finalPath)
  return {
    local: `/outputs/${filename}`,
  }
}
