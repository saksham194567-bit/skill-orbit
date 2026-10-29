import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (existsSync('.env')) loadEnvFile('.env')

const { databaseState, initializeDatabase, pool } = await import('./database.js')
try {
  await initializeDatabase()
  if (databaseState.status !== 'ready') {
    throw new Error('Set DATABASE_URL in server/.env before running migrations.')
  }
  console.log('Database migrations are current.')
} catch (error) {
  console.error('Database migration failed (code ' + (error.code || 'unknown') + ').')
  process.exitCode = 1
} finally {
  await pool?.end()
}
