const { neon } = require('@neondatabase/serverless')

const KEY = 'labor_cost_dashboard_v1'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'DATABASE_URL is not configured' }),
    }
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`SELECT value FROM app_data WHERE key = ${KEY}`
      const empty = {
        projects: [],
        monthlyCosts: [],
        completedCosts: [],
        lastImportedMonth: null,
        lastMonthlyUpdatedNumbers: [],
        updatedAt: null,
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(rows.length ? rows[0].value : empty),
      }
    }

    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}')
      const payload = {
        projects: Array.isArray(data.projects) ? data.projects : [],
        monthlyCosts: Array.isArray(data.monthlyCosts) ? data.monthlyCosts : [],
        completedCosts: Array.isArray(data.completedCosts) ? data.completedCosts : [],
        lastImportedMonth: data.lastImportedMonth || null,
        lastMonthlyUpdatedNumbers: Array.isArray(data.lastMonthlyUpdatedNumbers)
          ? data.lastMonthlyUpdatedNumbers
          : [],
        updatedAt: new Date().toISOString(),
      }

      await sql`
        INSERT INTO app_data (key, value, updated_at)
        VALUES (${KEY}, ${JSON.stringify(payload)}::jsonb, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value = ${JSON.stringify(payload)}::jsonb, updated_at = NOW()
      `

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: payload }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}
