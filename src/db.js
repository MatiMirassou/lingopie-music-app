/**
 * Simple file-based JSON store (no native deps, works everywhere)
 * Swap for Postgres/SQLite when deploying to server
 */
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../db.json')
const LOCK_PATH = DB_PATH + '.lock'

function acquireLock(retries = 20, delay = 50) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.mkdirSync(LOCK_PATH)
      return
    } catch {
      // Lock exists, wait and retry
      const start = Date.now()
      while (Date.now() - start < delay) { /* busy wait */ }
    }
  }
  // Stale lock fallback — remove if older than 5 seconds
  try {
    const stat = fs.statSync(LOCK_PATH)
    if (Date.now() - stat.mtimeMs > 5000) {
      fs.rmdirSync(LOCK_PATH)
      fs.mkdirSync(LOCK_PATH)
      return
    }
  } catch { /* ignore */ }
  throw new Error('Could not acquire db.json lock')
}

function releaseLock() {
  try { fs.rmdirSync(LOCK_PATH) } catch { /* ignore */ }
}

function load() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ jobs: [] }))
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

function withLock(fn) {
  acquireLock()
  try {
    return fn()
  } finally {
    releaseLock()
  }
}

export default {
  prepare: (sql) => ({
    run: (...args) => {
      withLock(() => {
        const data = load()
        if (sql.includes('INSERT INTO jobs')) {
          const [id, youtube_url, language] = args
          data.jobs.push({
            id, youtube_url, language,
            status: 'queued', current_step: null,
            step_number: 0, total_steps: 7,
            error: null, output_url: null, metadata: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          save(data)
        } else if (sql.includes('UPDATE jobs')) {
          const id = args[args.length - 1]
          const job = data.jobs.find(j => j.id === id)
          if (!job) return
          if (sql.includes("status='running'")) {
            job.status = 'running'
            // Match positional args to SET clause order: step_number=?, current_step=?
            job.step_number = args[0]
            job.current_step = args[1]
          } else if (sql.includes("status='done'")) {
            job.status = 'done'
            job.current_step = 'Complete'
            // Match positional args: output_url=?, metadata=?
            job.output_url = args[0]
            job.metadata = args[1]
          } else if (sql.includes("status='failed'")) {
            job.status = 'failed'
            // Match positional args: error=?
            job.error = args[0]
          }
          job.updated_at = new Date().toISOString()
          save(data)
        }
      })
    },
    get: (id) => {
      return withLock(() => {
        const data = load()
        return data.jobs.find(j => j.id === id) || null
      })
    },
    all: () => {
      return withLock(() => {
        const data = load()
        return data.jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50)
      })
    },
  }),
  exec: () => {}, // no-op, schema is implicit
}
