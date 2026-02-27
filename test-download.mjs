import { mkdirSync } from 'fs'
import { downloadAudio } from './src/steps/01-download.js'

mkdirSync('./tmp/test-dl', { recursive: true })
const result = await downloadAudio('test-dl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', './tmp/test-dl')
console.log('Downloaded:', result.title, '| Duration:', result.duration, 's')
