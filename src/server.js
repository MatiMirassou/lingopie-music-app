import 'dotenv/config'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import { runPipeline } from './pipeline.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3500

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(join(__dirname, '../public')))
app.use('/outputs', express.static(join(__dirname, '../outputs')))

// POST /api/jobs — create a new job
app.post('/api/jobs', async (req, res) => {
  const { youtube_url, language } = req.body
  if (!youtube_url || !language) return res.status(400).json({ error: 'youtube_url and language required' })

  const id = uuidv4()
  db.prepare('INSERT INTO jobs (id, youtube_url, language) VALUES (?, ?, ?)').run(id, youtube_url, language)

  // Run pipeline in background (no await)
  runPipeline(id).catch(err => console.error(`Pipeline failed for ${id}:`, err.message))

  res.json({ jobId: id })
})

// GET /api/jobs/:id — job status
app.get('/api/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

// GET /api/jobs — list all jobs
app.get('/api/jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50').all()
  res.json(jobs)
})

// GET /api/jobs/:id/progress — SSE real-time updates
app.get('/api/jobs/:id/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = () => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)
    if (!job) { res.write('data: {"error":"not found"}\n\n'); return }
    res.write(`data: ${JSON.stringify(job)}\n\n`)
    if (job.status === 'done' || job.status === 'failed') clearInterval(interval)
  }

  send()
  const interval = setInterval(send, 2000)
  req.on('close', () => clearInterval(interval))
})

app.listen(PORT, () => {
  console.log(`🎵 Lingopie Music Pipeline running at http://localhost:${PORT}`)
})
