import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (existsSync('.env')) loadEnvFile('.env')

const [{ app }, { databaseState, initializeDatabase, pool }] = await Promise.all([
  import('./app.js'),
  import('./database.js'),
])
const port = Number(process.env.PORT) || 4000

pool?.on('error', error => {
  databaseState.status = 'unavailable'
  console.error('PostgreSQL pool error:', error.code || 'connection error')
})

try {
  await initializeDatabase()
} catch (error) {
  databaseState.status = 'unavailable'
  console.error('Database initialization failed (code ' + (error.code || 'unknown') + ').')
}

const server = app.listen(port, () => {
  console.log('SkillOrbit API listening on port ' + port + ' (database: ' + databaseState.status + ')')
})

async function shutdown() {
  server.close()
  await pool?.end()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
