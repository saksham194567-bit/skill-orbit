import { readFile } from 'node:fs/promises'
import { Pool, types } from 'pg'

types.setTypeParser(1082, value => value)
import { DEMO_STUDENT_ID, migrationFile, migrationVersion } from './schema.js'

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? true : undefined,
      connectionTimeoutMillis: 5000,
    })
  : null

export const databaseState = { status: pool ? 'connecting' : 'not_configured' }

export async function initializeDatabase() {
  if (!pool) {
    databaseState.status = 'not_configured'
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(741762219)')
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migrationVersion])
    if (!applied.rowCount) {
      const migration = await readFile(new URL(migrationFile, import.meta.url), 'utf8')
      await client.query(migration)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migrationVersion])
    }
    await seedDemoData(client)
    await client.query('COMMIT')
    databaseState.status = 'ready'
  } catch (error) {
    await client.query('ROLLBACK')
    databaseState.status = 'unavailable'
    throw error
  } finally {
    client.release()
  }
}

export async function seedDemoData(client) {
  const marker = await client.query(
    "INSERT INTO seed_runs (seed_key) VALUES ('skillorbit-demo-v1') ON CONFLICT DO NOTHING",
  )
  if (!marker.rowCount) return

  await client.query(
    "INSERT INTO skills (id,student_id,name,category,proficiency) SELECT gen_random_uuid(),$1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM skills WHERE student_id=$1 AND name=$2)",
    [DEMO_STUDENT_ID, 'React', 'Frontend', 4],
  )
  await client.query(
    "INSERT INTO skills (id,student_id,name,category,proficiency) SELECT gen_random_uuid(),$1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM skills WHERE student_id=$1 AND name=$2)",
    [DEMO_STUDENT_ID, 'JavaScript', 'Programming', 4],
  )
  await client.query(
    "INSERT INTO skills (id,student_id,name,category,proficiency) SELECT gen_random_uuid(),$1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM skills WHERE student_id=$1 AND name=$2)",
    [DEMO_STUDENT_ID, 'SQL', 'Database', 3],
  )
  await client.query(
    "INSERT INTO skills (id,student_id,name,category,proficiency) SELECT gen_random_uuid(),$1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM skills WHERE student_id=$1 AND name=$2)",
    [DEMO_STUDENT_ID, 'Communication', 'Professional', 4],
  )
  const project = await client.query(
    "INSERT INTO projects (id,student_id,title,description,github_url,demo_url) SELECT gen_random_uuid(),$1,'Campus Connect','A student community portal for campus events.','https://github.com/','' WHERE NOT EXISTS (SELECT 1 FROM projects WHERE student_id=$1 AND title='Campus Connect') RETURNING id",
    [DEMO_STUDENT_ID],
  )
  if (project.rows[0]) {
    for (const [position, name] of ['React', 'Node.js', 'Express'].entries()) {
      await client.query(
        'INSERT INTO project_technologies (id,project_id,name,position) VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING',
        [project.rows[0].id, name, position],
      )
    }
  }
  await client.query(
    "INSERT INTO certificates (id,student_id,name,issuer,issue_date,credential_url) SELECT gen_random_uuid(),$1,'Web Development Foundations','OpenLearn',CURRENT_DATE - 90,'' WHERE NOT EXISTS (SELECT 1 FROM certificates WHERE student_id=$1 AND name='Web Development Foundations')",
    [DEMO_STUDENT_ID],
  )
  const goal = await client.query(
    "INSERT INTO goals (id,student_id,title,description,target_date) SELECT gen_random_uuid(),$1,'Ship a full-stack project','Build and publish one complete app.',CURRENT_DATE + 45 WHERE NOT EXISTS (SELECT 1 FROM goals WHERE student_id=$1 AND title='Ship a full-stack project') RETURNING id",
    [DEMO_STUDENT_ID],
  )
  if (goal.rows[0]) {
    for (const [position, title, isComplete] of [
      [0, 'Design the core screens', true],
      [1, 'Build the API', false],
      [2, 'Deploy the app', false],
    ]) {
      await client.query(
        'INSERT INTO goal_milestones (id,goal_id,title,position,is_complete) VALUES (gen_random_uuid(),$1,$2,$3,$4)',
        [goal.rows[0].id, title, position, isComplete],
      )
    }
  }
  await client.query(
    "INSERT INTO opportunities (id,student_id,organization,title,type,deadline,url,status) SELECT gen_random_uuid(),$1,'Northstar Labs','Software Engineering Intern','Internship',CURRENT_DATE + 20,'','Saved' WHERE NOT EXISTS (SELECT 1 FROM opportunities WHERE student_id=$1 AND organization='Northstar Labs' AND title='Software Engineering Intern')",
    [DEMO_STUDENT_ID],
  )
}

export { DEMO_STUDENT_ID }
