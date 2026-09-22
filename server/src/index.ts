import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import api from './routes/api.ts'
import { errorMiddleware } from './errors.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const app = express()

app.use(express.json({ limit: '2mb' }))
app.use('/api', api)

// Production/demo mode: serve the built frontend from dist/
const dist = path.join(rootDir, 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => err && next())
})

app.use(errorMiddleware)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => console.log(`CIMT API listening on http://localhost:${port}`))
