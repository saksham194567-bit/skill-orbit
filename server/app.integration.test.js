import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (!process.env.DATABASE_URL && existsSync('.env')) loadEnvFile('.env')

const configured = Boolean(process.env.DATABASE_URL)
const skip = configured ? false : 'DATABASE_URL is not configured; PostgreSQL integration tests skipped.'
const { app } = await import('./app.js')
const { databaseState, initializeDatabase, pool } = await import('./database.js')
let server
let base

before(async () => {
  if (!configured) return
  await initializeDatabase()
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = 'http://127.0.0.1:' + server.address().port + '/api/'
})

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  await pool?.end()
})

async function request(method, path, value) {
  const response = await fetch(base + path, {
    method,
    headers: value === undefined ? {} : { 'Content-Type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value),
  })
  const body = response.status === 204 ? null : await response.json()
  return { response, body }
}

test('API health, student profile, and normalized portfolio are available', { skip }, async () => {
  const health = await request('GET', 'health')
  assert.equal(health.response.status, 200)
  assert.equal(health.body.database, 'ready')

  const profile = await request('GET', 'profile')
  assert.equal(profile.response.status, 200)
  assert.equal(profile.body.name, 'Aarav Mehta')

  const portfolio = await request('GET', 'portfolio')
  assert.equal(portfolio.response.status, 200)
  assert.equal(portfolio.body.profile.id, profile.body.id)
  assert.ok(Array.isArray(portfolio.body.skills))
  assert.ok(Array.isArray(portfolio.body.projects))
  assert.ok(Array.isArray(portfolio.body.certificates))
  const ownership = await pool.query('SELECT (SELECT count(*) FROM skills WHERE student_id=$1) AS skills, (SELECT count(*) FROM project_technologies pt JOIN projects p ON p.id=pt.project_id WHERE p.student_id=$1) AS technologies, (SELECT count(*) FROM goal_milestones gm JOIN goals g ON g.id=gm.goal_id WHERE g.student_id=$1) AS milestones, (SELECT count(*) FROM opportunities WHERE student_id=$1) AS opportunities', [profile.body.id])
  assert.ok(Number(ownership.rows[0].skills) > 0)
  assert.ok(Number(ownership.rows[0].technologies) > 0)
  assert.ok(Number(ownership.rows[0].milestones) > 0)
  assert.ok(Number(ownership.rows[0].opportunities) > 0)
})

test('all core resources persist create, read, update, and delete', { skip }, async t => {
  const cases = [
    {
      name: 'skills',
      initial: { name: 'Integration Skill', category: 'Testing', proficiency: 2 },
      updated: { name: 'Integration Skill Updated', category: 'Testing', proficiency: 4 },
      verify: (record) => assert.equal(record.proficiency, 4),
    },
    {
      name: 'projects',
      initial: { title: 'Integration Project', description: 'First', technologies: ['React', 'SQL'], githubUrl: 'https://github.com/example/repo', demoUrl: '' },
      updated: { title: 'Integration Project Updated', description: 'Updated', technologies: ['Node.js'], githubUrl: '', demoUrl: 'https://example.com' },
      verify: (record) => assert.deepEqual(record.technologies, ['Node.js']),
    },
    {
      name: 'certificates',
      initial: { name: 'Integration Certificate', issuer: 'SkillOrbit QA', issueDate: '2026-10-01', credentialUrl: 'https://example.com/cert' },
      updated: { name: 'Integration Certificate Updated', issuer: 'SkillOrbit QA', issueDate: '2026-10-02', credentialUrl: '' },
      verify: (record) => assert.equal(record.issueDate, '2026-10-02'),
    },
    {
      name: 'goals',
      initial: { title: 'Integration Goal', description: 'First', targetDate: '2026-12-01', milestones: [{ title: 'Plan', done: false }, { title: 'Build', done: false }] },
      updated: { title: 'Integration Goal Updated', description: 'Updated', targetDate: '2026-12-02', milestones: [{ title: 'Plan', done: true }, { title: 'Build', done: false }] },
      verify: (record) => assert.equal(record.milestones[0].done, true),
    },
    {
      name: 'opportunities',
      initial: { organization: 'Integration Org', title: 'Integration Role', type: 'Internship', deadline: '2026-12-10', url: 'https://example.com/role', status: 'Saved', notes: 'First' },
      updated: { organization: 'Integration Org Updated', title: 'Integration Role Updated', type: 'Internship', deadline: '2026-12-11', url: '', status: 'Interviewed', notes: 'Updated' },
      verify: (record) => assert.equal(record.status, 'Interviewed'),
    },
  ]

  for (const item of cases) {
    await t.test(item.name, async () => {
      let id
      try {
        const created = await request('POST', item.name, item.initial)
        assert.equal(created.response.status, 201)
        id = created.body.id

        const list = await request('GET', item.name)
        assert.equal(list.response.status, 200)
        assert.ok(list.body.some(record => record.id === id))

        const updated = await request('PUT', item.name + '/' + id, item.updated)
        assert.equal(updated.response.status, 200)
        item.verify(updated.body)
        if (item.name === 'opportunities') {
          for (const status of ['Applied', 'Interviewed', 'Completed', 'Rejected']) {
            const transition = await request('PUT', item.name + '/' + id, { ...item.updated, status })
            assert.equal(transition.response.status, 200)
            assert.equal(transition.body.status, status)
          }
          const restored = await request('PUT', item.name + '/' + id, item.updated)
          assert.equal(restored.body.status, item.updated.status)
        }

        const persisted = await request('GET', item.name)
        const saved = persisted.body.find(record => record.id === id)
        assert.ok(saved)
        item.verify(saved)

        const removed = await request('DELETE', item.name + '/' + id)
        assert.equal(removed.response.status, 204)
        const missing = await request('PUT', item.name + '/' + id, item.initial)
        assert.equal(missing.response.status, 404)
      } finally {
        if (id) await request('DELETE', item.name + '/' + id)
      }
    })
  }
})

test('invalid values and missing records return useful HTTP errors', { skip }, async () => {
  const skill = await request('POST', 'skills', { name: '', proficiency: 8 })
  assert.equal(skill.response.status, 400)
  assert.ok(skill.body.error)

  const url = await request('POST', 'projects', { title: 'Bad link', githubUrl: 'javascript:alert(1)' })
  assert.equal(url.response.status, 400)

  const status = await request('POST', 'opportunities', {
    organization: 'QA', title: 'Bad status', status: 'Pending',
  })
  assert.equal(status.response.status, 400)

  const absent = '99999999-9999-4999-8999-999999999999'
  assert.equal((await request('PUT', 'skills/' + absent, { name: 'Missing', proficiency: 1 })).response.status, 404)
  assert.equal((await request('DELETE', 'skills/' + absent)).response.status, 404)
})

test('dashboard counts follow inserts and deletes from the demo student', { skip }, async () => {
  const before = await request('GET', 'dashboard')
  const created = await request('POST', 'skills', { name: 'Dashboard Integration Check', proficiency: 3 })
  assert.equal(created.response.status, 201)
  try {
    const during = await request('GET', 'dashboard')
    assert.equal(during.body.stats.skills, before.body.stats.skills + 1)
    assert.equal(during.body.activity[0].title, 'Dashboard Integration Check')
  } finally {
    await request('DELETE', 'skills/' + created.body.id)
  }
  const afterDelete = await request('GET', 'dashboard')
  assert.equal(afterDelete.body.stats.skills, before.body.stats.skills)
})

test('health stays readable and data routes reject access until database is ready', async () => {
  const previous = databaseState.status
  databaseState.status = 'not_configured'
  const health = await request('GET', 'health')
  assert.equal(health.response.status, 200)
  const data = await request('GET', 'skills')
  assert.equal(data.response.status, 503)
  assert.equal(data.body.code, 'DATABASE_UNAVAILABLE')
  databaseState.status = previous
})
