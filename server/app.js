import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { DEMO_STUDENT_ID, databaseState, pool } from './database.js'
import { validateRecord } from './validation.js'

export const app = express()
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '100kb' }))

const resources = {
  skills: {
    table: 'skills',
    fields: [['name', 'name'], ['category', 'category'], ['proficiency', 'proficiency']],
  },
  projects: {
    table: 'projects',
    fields: [['title', 'title'], ['description', 'description'], ['githubUrl', 'github_url'], ['demoUrl', 'demo_url']],
    child: 'technologies',
  },
  certificates: {
    table: 'certificates',
    fields: [['name', 'name'], ['issuer', 'issuer'], ['issueDate', 'issue_date'], ['credentialUrl', 'credential_url']],
  },
  goals: {
    table: 'goals',
    fields: [['title', 'title'], ['description', 'description'], ['targetDate', 'target_date']],
    child: 'milestones',
  },
  opportunities: {
    table: 'opportunities',
    fields: [['organization', 'organization'], ['title', 'title'], ['type', 'type'], ['deadline', 'deadline'], ['url', 'url'], ['status', 'status'], ['notes', 'notes']],
  },
}

function camelize(row) {
  const publicRow = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'student_id'))
  return Object.fromEntries(Object.entries(publicRow).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    value,
  ]))
}

function dbRequired(_req, res, next) {
  if (!pool || databaseState.status !== 'ready') {
    return res.status(503).json({
      error: 'The database is not ready. Check the server configuration and try again.',
      code: 'DATABASE_UNAVAILABLE',
    })
  }
  next()
}

function listQuery(resource) {
  if (resource === 'projects') {
    return pool.query(
      "SELECT p.*, COALESCE(json_agg(pt.name ORDER BY pt.position) FILTER (WHERE pt.id IS NOT NULL), '[]'::json) AS technologies FROM projects p LEFT JOIN project_technologies pt ON pt.project_id = p.id WHERE p.student_id = $1 GROUP BY p.id ORDER BY p.updated_at DESC",
      [DEMO_STUDENT_ID],
    )
  }
  if (resource === 'goals') {
    return pool.query(
      "SELECT g.*, COALESCE(json_agg(json_build_object('id', gm.id, 'title', gm.title, 'done', gm.is_complete) ORDER BY gm.position) FILTER (WHERE gm.id IS NOT NULL), '[]'::json) AS milestones FROM goals g LEFT JOIN goal_milestones gm ON gm.goal_id = g.id WHERE g.student_id = $1 GROUP BY g.id ORDER BY g.updated_at DESC",
      [DEMO_STUDENT_ID],
    )
  }
  const config = resources[resource]
  return pool.query(
    'SELECT * FROM ' + config.table + ' WHERE student_id = $1 ORDER BY updated_at DESC',
    [DEMO_STUDENT_ID],
  )
}

async function readRecord(resource, id) {
  const { rows } = await listQuery(resource)
  return rows.find(row => row.id === id) || null
}

async function insertChildren(client, resource, parentId, value) {
  if (resource === 'projects') {
    for (const [position, name] of value.technologies.entries()) {
      await client.query(
        'INSERT INTO project_technologies (id, project_id, name, position) VALUES ($1,$2,$3,$4)',
        [randomUUID(), parentId, name, position],
      )
    }
  }
  if (resource === 'goals') {
    for (const [position, milestone] of value.milestones.entries()) {
      await client.query(
        'INSERT INTO goal_milestones (id, goal_id, title, position, is_complete) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), parentId, milestone.title, position, milestone.done],
      )
    }
  }
}

async function replaceChildren(client, resource, parentId, value) {
  if (resource === 'projects') {
    await client.query('DELETE FROM project_technologies WHERE project_id = $1', [parentId])
  } else if (resource === 'goals') {
    await client.query('DELETE FROM goal_milestones WHERE goal_id = $1', [parentId])
  } else {
    return
  }
  await insertChildren(client, resource, parentId, value)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'skillorbit-api', database: databaseState.status, time: new Date().toISOString() })
})

app.get('/api/profile', dbRequired, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id,name,program,year,college,headline FROM students WHERE id = $1',
      [DEMO_STUDENT_ID],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Demo student profile not found.' })
    res.json(camelize(rows[0]))
  } catch (error) {
    next(error)
  }
})

app.get('/api/dashboard', dbRequired, async (_req, res, next) => {
  try {
    const [counts, deadlines, activity, progress] = await Promise.all([
      pool.query(
        'SELECT (SELECT count(*)::int FROM skills WHERE student_id=$1) AS skills, (SELECT count(*)::int FROM projects WHERE student_id=$1) AS projects, (SELECT count(*)::int FROM certificates WHERE student_id=$1) AS certificates, (SELECT count(*)::int FROM goals WHERE student_id=$1) AS goals, (SELECT count(*)::int FROM opportunities WHERE student_id=$1) AS opportunities',
        [DEMO_STUDENT_ID],
      ),
      pool.query(
        "SELECT title,target_date AS date,'goal' AS kind FROM goals WHERE student_id=$1 AND target_date>=CURRENT_DATE UNION ALL SELECT title,deadline AS date,'opportunity' AS kind FROM opportunities WHERE student_id=$2 AND deadline>=CURRENT_DATE AND status NOT IN ('Completed','Rejected') ORDER BY date LIMIT 5",
        [DEMO_STUDENT_ID, DEMO_STUDENT_ID],
      ),
      pool.query(
        "SELECT kind,title,updated_at FROM (SELECT 'Skill' AS kind,name AS title,updated_at FROM skills WHERE student_id=$1 UNION ALL SELECT 'Project',title,updated_at FROM projects WHERE student_id=$1 UNION ALL SELECT 'Certificate',name,updated_at FROM certificates WHERE student_id=$1 UNION ALL SELECT 'Goal',title,updated_at FROM goals WHERE student_id=$1 UNION ALL SELECT 'Opportunity',title,updated_at FROM opportunities WHERE student_id=$1) activity ORDER BY updated_at DESC LIMIT 6",
        [DEMO_STUDENT_ID],
      ),
      pool.query(
        'SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE gm.is_complete) / NULLIF(count(gm.id),0)),0)::int AS progress FROM goals g LEFT JOIN goal_milestones gm ON gm.goal_id=g.id WHERE g.student_id=$1',
        [DEMO_STUDENT_ID],
      ),
    ])
    res.json({
      stats: counts.rows[0],
      goalProgress: progress.rows[0].progress,
      deadlines: deadlines.rows.map(camelize),
      activity: activity.rows.map(camelize),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/portfolio', dbRequired, async (_req, res, next) => {
  try {
    const [profile, skills, projects, certificates] = await Promise.all([
      pool.query('SELECT id,name,program,year,college,headline FROM students WHERE id=$1', [DEMO_STUDENT_ID]),
      listQuery('skills'),
      listQuery('projects'),
      listQuery('certificates'),
    ])
    res.json({
      profile: profile.rows[0] ? camelize(profile.rows[0]) : null,
      skills: skills.rows.map(camelize),
      projects: projects.rows.map(camelize),
      certificates: certificates.rows.map(camelize),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/:resource', dbRequired, async (req, res, next) => {
  try {
    if (!resources[req.params.resource]) return res.status(404).json({ error: 'Resource not found.' })
    const { rows } = await listQuery(req.params.resource)
    res.json(rows.map(camelize))
  } catch (error) {
    next(error)
  }
})

app.post('/api/:resource', dbRequired, async (req, res, next) => {
  try {
    const resource = req.params.resource
    const config = resources[resource]
    if (!config) return res.status(404).json({ error: 'Resource not found.' })
    const result = validateRecord(resource, req.body)
    if (!result.ok) return res.status(400).json({ error: result.error, field: result.field })

    const client = await pool.connect()
    const id = randomUUID()
    try {
      await client.query('BEGIN')
      const columns = config.fields.map(([, column]) => column)
      const values = config.fields.map(([field]) => result.value[field])
      const placeholders = values.map((_, index) => '$' + (index + 3))
      await client.query(
        'INSERT INTO ' + config.table + ' (id,student_id,' + columns.join(',') + ') VALUES ($1,$2,' + placeholders.join(',') + ')',
        [id, DEMO_STUDENT_ID, ...values],
      )
      await insertChildren(client, resource, id, result.value)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    res.status(201).json(camelize(await readRecord(resource, id)))
  } catch (error) {
    next(error)
  }
})

app.put('/api/:resource/:id', dbRequired, async (req, res, next) => {
  try {
    const resource = req.params.resource
    const config = resources[resource]
    if (!config) return res.status(404).json({ error: 'Resource not found.' })
    const result = validateRecord(resource, req.body)
    if (!result.ok) return res.status(400).json({ error: result.error, field: result.field })

    const client = await pool.connect()
    let updated = false
    try {
      await client.query('BEGIN')
      const assignments = config.fields.map(([, column], index) => column + '=$' + (index + 1))
      const values = config.fields.map(([field]) => result.value[field])
      const { rowCount } = await client.query(
        'UPDATE ' + config.table + ' SET ' + assignments.join(',') + ',updated_at=now() WHERE id=$' + (values.length + 1) + ' AND student_id=$' + (values.length + 2),
        [...values, req.params.id, DEMO_STUDENT_ID],
      )
      if (rowCount) {
        await replaceChildren(client, resource, req.params.id, result.value)
        updated = true
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    if (!updated) return res.status(404).json({ error: 'Record not found.' })
    res.json(camelize(await readRecord(resource, req.params.id)))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/:resource/:id', dbRequired, async (req, res, next) => {
  try {
    const config = resources[req.params.resource]
    if (!config) return res.status(404).json({ error: 'Resource not found.' })
    const { rowCount } = await pool.query(
      'DELETE FROM ' + config.table + ' WHERE id=$1 AND student_id=$2',
      [req.params.id, DEMO_STUDENT_ID],
    )
    if (!rowCount) return res.status(404).json({ error: 'Record not found.' })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.' })
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' })
  }
  if (['08000', '08003', '08006', '57P01', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
    databaseState.status = 'unavailable'
    return res.status(503).json({ error: 'The database is temporarily unavailable. Try again shortly.', code: 'DATABASE_UNAVAILABLE' })
  }
  if (['23514', '23502', '22P02'].includes(error.code)) {
    return res.status(400).json({ error: 'The submitted data is invalid.' })
  }
  console.error('API request failed:', error.code || 'internal error')
  res.status(500).json({ error: 'The server could not complete the request.' })
})
