const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
}

function parseSourceUrl(value) {
  if (!value) throw new Error('url is required')
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('url must start with http:// or https://')
  }
  return url
}

function parseNullableAmount(value) {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[,\s円]/g, '').trim())
  return Number.isFinite(n) ? n : null
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const sourceUrl = parseSourceUrl(event.queryStringParameters?.url || '')
    const endpoint = new URL('/api/projects-data', sourceUrl)
    const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`projects-data returned ${response.status}`)
    }

    const data = await response.json()
    const projects = Array.isArray(data.projects) ? data.projects : []
    const contracts = projects
      .map(project => ({
        number: String(project?.number || '').trim(),
        contractAmount: parseNullableAmount(project?.contractAmount),
      }))
      .filter(project => project.number)

    return { statusCode: 200, headers, body: JSON.stringify({ contracts }) }
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) }
  }
}
