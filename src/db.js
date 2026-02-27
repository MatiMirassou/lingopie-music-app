/**
 * Simple file-based JSON store (no native deps, works everywhere)
 * Swap for Postgres/SQLite when deploying to server
 */
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../db.json')

function load() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ jobs: [] }))
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

export default {
  prepare: (sql) => ({
    run: (...args) => {
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
        // Parse SET fields from sql
        if (sql.includes('status=')) {
          if (sql.includes("status='running'")) { job.status = 'running'; job.step_number = args[0]; job.current_step = args[1] }
          else if (sql.includes("status='done'")) { job.status = 'done'; job.current_step = 'Complete'; job.output_url = args[0]; job.metadata = args[1] }
          else if (sql.includes("status='failed'")) { job.status = 'failed'; job.error = args[0] }
        }
        job.updated_at = new Date().toISOString()
        save(data)
      }
    },
    get: (id) => {
      const data = load()
      return data.jobs.find(j => j.id === id) || null
    },
    all: () => {
      const data = load()
      return data.jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50)
    },
  }),
  exec: () => {}, // no-op, schema is implicit
}
