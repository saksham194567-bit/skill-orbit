import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (existsSync('.env')) loadEnvFile('.env')

const { databaseState, initializeDatabase, pool } = await import('./database.js')
try {
  await initializeDatabase()
  if (databaseState.status !== 'ready') {
    throw new Error('Set DATABASE_URL in server/.env before running the database seed.')
  }
  console.log('SkillOrbit schema is current and synthetic demo data is seeded.')
} catch {
  console.error('Database setup or seed failed. Check DATABASE_URL and PostgreSQL availability.')
  process.exitCode = 1
} finally {
  await pool?.end()
}
