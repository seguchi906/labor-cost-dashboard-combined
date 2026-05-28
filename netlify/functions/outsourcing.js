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

function getLatestVersion(record) {
  const versions = Array.isArray(record?.versions) ? record.versions : []
  for (let i = versions.length - 1; i >= 0; i--) {
    const version = versions[i] || {}
    if (version.amount || version.startDate || version.endDate || version.appDate) return version
  }
  return versions[0] || {}
}

function buildOutsourcing(records) {
  const map = new Map()
  for (const record of records) {
    const number = String(record?.jobNo || '').trim()
    if (!number) continue
    const latest = getLatestVersion(record)
    const amount = parseFloat(latest.amount) || 0
    if (amount > 0) {
      map.set(number, (map.get(number) || 0) + amount)
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([number, outsourcingAmount]) => ({ number, outsourcingAmount }))
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
    const endpoint = new URL('/api/records', sourceUrl)
    const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`records returned ${response.status}`)
    }

    const records = await response.json()
    if (!Array.isArray(records)) throw new Error('records response must be an array')
    return { statusCode: 200, headers, body: JSON.stringify({ outsourcing: buildOutsourcing(records) }) }
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) }
  }
}
