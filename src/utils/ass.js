/**
 * SRT → ASS subtitle converter
 * Builds a single ASS file with dual styles (original language + English translation)
 * for reliable ffmpeg rendering via the `ass=` filter.
 */

/**
 * Convert SRT timestamp to ASS timestamp
 * SRT:  00:00:01,500  (HH:MM:SS,mmm — comma, 3-digit ms)
 * ASS:  0:00:01.50    (H:MM:SS.cc  — dot, 2-digit centiseconds)
 */
function srtTimeToAss(srtTime) {
  const [time, ms] = srtTime.trim().split(',')
  const [h, m, s] = time.split(':')
  const cs = Math.floor(parseInt(ms || '0') / 10)
  return `${parseInt(h)}:${m}:${s}.${String(cs).padStart(2, '0')}`
}

/**
 * Parse SRT content into an array of subtitle entries.
 * Skips empty subtitle blocks (instrumental sections with no text).
 */
function parseSrt(srtContent) {
  const entries = []
  const blocks = srtContent.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // Line 0 = index number (skip), Line 1 = timestamps, Lines 2+ = text
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    )
    if (!timeMatch) continue

    // Join multi-line text with ASS hard line break
    const text = lines
      .slice(2)
      .join('\\N')
      .trim()
    if (!text) continue // skip empty blocks

    entries.push({
      start: srtTimeToAss(timeMatch[1]),
      end: srtTimeToAss(timeMatch[2]),
      text,
    })
  }

  return entries
}

// ── ASS header template ─────────────────────────────────────────────────────
const ASS_HEADER = `[Script Info]
Title: Lingopie Music Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Lang,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,8,10,10,300,1
Style: En,Arial,52,&H0000FFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,8,10,10,480,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

/**
 * Build a single ASS file containing both subtitle tracks.
 *
 * Layout (1920×1080):
 *   Lang style — white, bold, top-center, MarginV=300 (upper area)
 *   En   style — yellow, top-center, MarginV=480 (below Lang)
 *
 * @param {string} langSrt  Original-language SRT content
 * @param {string} enSrt    English translation SRT content
 * @returns {string}        Complete ASS file content
 */
export function buildDualAss(langSrt, enSrt) {
  const langEntries = parseSrt(langSrt)
  const enEntries = parseSrt(enSrt)

  let events = ''

  for (const e of langEntries) {
    events += `Dialogue: 0,${e.start},${e.end},Lang,,0,0,0,,${e.text}\n`
  }
  for (const e of enEntries) {
    events += `Dialogue: 0,${e.start},${e.end},En,,0,0,0,,${e.text}\n`
  }

  return ASS_HEADER + events
}
