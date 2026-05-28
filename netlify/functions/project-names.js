const SOURCE_URL = 'https://files-mentioned-by-the-user-original.netlify.app/'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
}

function parseSourceUrl(value) {
  const url = new URL(value || SOURCE_URL)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('url must start with http:// or https://')
  }
  return url
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[ 　_\-().（）]/g, '')
}

function pickValue(object, keys) {
  if (!object || typeof object !== 'object') return ''
  const wanted = keys.map(normalizeKey)
  for (const [key, value] of Object.entries(object)) {
    if (wanted.includes(normalizeKey(key)) && value !== null && value !== undefined && value !== '') {
      return String(value).trim()
    }
  }
  return ''
}

function looksLikeBusinessNumber(value) {
  return /^\d{2}-\d{3}/.test(String(value || '').trim())
}

function findNumber(object) {
  const direct = pickValue(object, [
    'number',
    '業務番号',
    '業務No',
    '業務NO',
    'projectNumber',
    'projectNo',
    'businessNumber',
    'businessNo',
    'code',
  ])
  if (direct) return direct

  for (const [key, value] of Object.entries(object || {})) {
    const normalized = normalizeKey(key)
    if ((normalized.includes('number') || normalized.includes('no') || normalized.includes('番号')) && looksLikeBusinessNumber(value)) {
      return String(value).trim()
    }
  }
  return ''
}

function findName(object, number) {
  const direct = pickValue(object, [
    'name',
    'Name',
    '業務名',
    '件名',
    '工事件名',
    'projectName',
    'projectTitle',
    'businessName',
    'businessTitle',
    'title',
    'displayName',
    'label',
  ])
  if (direct && direct !== number) return direct

  for (const [key, value] of Object.entries(object || {})) {
    const normalized = normalizeKey(key)
    const text = String(value ?? '').trim()
    if (!text || text === number) continue
    if (normalized.includes('名') || normalized.includes('件名') || normalized.includes('title')) {
      return text
    }
  }
  return ''
}

function collectObjects(value, results = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectObjects(item, results))
    return results
  }
  if (!value || typeof value !== 'object') return results

  if (findNumber(value)) results.push(value)

  Object.values(value).forEach(child => {
    if (child && typeof child === 'object') collectObjects(child, results)
  })
  return results
}

async function fetchProjectData(sourceUrl) {
  const endpoints = [
    '/api/projects?sort=number&direction=asc',
    '/api/projects-data',
  ]
  const errors = []

  for (const path of endpoints) {
    const endpoint = new URL(path, sourceUrl)
    try {
      const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        errors.push(`${path} returned ${response.status}`)
        continue
      }
      return await response.json()
    } catch (error) {
      errors.push(`${path}: ${error.message}`)
    }
  }

  throw new Error(errors.join(' / ') || 'project source unavailable')
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const sourceUrl = parseSourceUrl(event.queryStringParameters?.url)
    const data = await fetchProjectData(sourceUrl)
    const projects = collectObjects(data)
    const seen = new Set()
    const projectNames = projects
      .map(project => {
        const number = findNumber(project)
        return {
          number,
          name: findName(project, number),
        }
      })
      .filter(project => project.number && project.name)
      .filter(project => {
        if (seen.has(project.number)) return false
        seen.add(project.number)
        return true
      })

    return { statusCode: 200, headers, body: JSON.stringify({ projectNames }) }
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) }
  }
}
