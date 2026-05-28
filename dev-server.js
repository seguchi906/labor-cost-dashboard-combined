const http = require('http')
const fs = require('fs')
const path = require('path')

const root = __dirname
const port = Number(process.env.PORT || 3000)

loadEnv(path.join(root, '.env'))

const functionHandlers = {
  '/api/data': require('./netlify/functions/data').handler,
  '/api/contracts': require('./netlify/functions/contracts').handler,
  '/api/outsourcing': require('./netlify/functions/outsourcing').handler,
  '/api/project-names': require('./netlify/functions/project-names').handler,
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const rawValue = trimmed.slice(index + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      body += chunk
      if (body.length > 10 * 1024 * 1024) {
        req.destroy()
        reject(new Error('Request body is too large'))
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers)
  res.end(body)
}

function serveIndex(res) {
  const indexPath = path.join(root, 'index.html')
  send(res, 200, { 'Content-Type': 'text/html; charset=utf-8' }, fs.readFileSync(indexPath))
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`)
    const handler = functionHandlers[requestUrl.pathname]

    if (handler) {
      const body = req.method === 'POST' ? await readBody(req) : ''
      const result = await handler({
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
        body,
      })
      send(res, result.statusCode || 200, result.headers || {}, result.body || '')
      return
    }

    serveIndex(res)
  } catch (error) {
    send(
      res,
      500,
      { 'Content-Type': 'application/json; charset=utf-8' },
      JSON.stringify({ error: error.message })
    )
  }
})

server.listen(port, () => {
  console.log(`Labor cost dashboard is running at http://localhost:${port}/`)
})
