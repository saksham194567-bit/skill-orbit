import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from './app.js'
import { databaseState } from './database.js'

async function startServer() {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  return server
}

test('health reports the API process and database state', async () => {
  const previous = databaseState.status
  databaseState.status = 'not_configured'
  const server = await startServer()
  try {
    const address = server.address()
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/health')
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.database, 'not_configured')
  } finally {
    databaseState.status = previous
    await new Promise(resolve => server.close(resolve))
  }
})

test('CRUD routes clearly return 503 while PostgreSQL is not ready', async () => {
  const previous = databaseState.status
  databaseState.status = 'not_configured'
  const server = await startServer()
  try {
    const address = server.address()
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/skills')
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.equal(body.code, 'DATABASE_UNAVAILABLE')
    assert.match(body.error, /database is not ready/i)
  } finally {
    databaseState.status = previous
    await new Promise(resolve => server.close(resolve))
  }
})

test('malformed JSON returns a client error', async () => {
  const server = await startServer()
  try {
    const address = server.address()
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    })
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /valid JSON/)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
