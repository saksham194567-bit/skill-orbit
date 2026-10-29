CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  program text NOT NULL DEFAULT '',
  year text NOT NULL DEFAULT '',
  college text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO students (id, name, program, year, college, headline)
VALUES ('00000000-0000-4000-8000-000000000001', 'Aarav Mehta', 'B.Tech Computer Science',
        '3rd year', 'SkillOrbit Demo College', 'Aspiring full-stack intern')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  category text NOT NULL DEFAULT '',
  proficiency integer NOT NULL CHECK (proficiency BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  technologies text[] NOT NULL DEFAULT '{}',
  github_url text NOT NULL DEFAULT '',
  demo_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 140),
  issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 120),
  issue_date date,
  credential_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  description text NOT NULL DEFAULT '',
  target_date date,
  milestones jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  organization text NOT NULL CHECK (length(organization) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  type text NOT NULL DEFAULT 'Internship',
  deadline date,
  url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Saved'
    CHECK (status IN ('Saved','Applied','Interviewed','Completed','Rejected')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE skills ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS student_id uuid;

UPDATE skills SET student_id = '00000000-0000-4000-8000-000000000001' WHERE student_id IS NULL;
UPDATE projects SET student_id = '00000000-0000-4000-8000-000000000001' WHERE student_id IS NULL;
UPDATE certificates SET student_id = '00000000-0000-4000-8000-000000000001' WHERE student_id IS NULL;
UPDATE goals SET student_id = '00000000-0000-4000-8000-000000000001' WHERE student_id IS NULL;
UPDATE opportunities SET student_id = '00000000-0000-4000-8000-000000000001' WHERE student_id IS NULL;

ALTER TABLE skills ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE certificates ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE goals ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE opportunities ALTER COLUMN student_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skills_student_id_fkey') THEN
    ALTER TABLE skills ADD CONSTRAINT skills_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_student_id_fkey') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_student_id_fkey') THEN
    ALTER TABLE certificates ADD CONSTRAINT certificates_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_student_id_fkey') THEN
    ALTER TABLE goals ADD CONSTRAINT goals_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_student_id_fkey') THEN
    ALTER TABLE opportunities ADD CONSTRAINT opportunities_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS project_technologies (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE (project_id, name),
  UNIQUE (project_id, position)
);

INSERT INTO project_technologies (id, project_id, name, position)
SELECT gen_random_uuid(), p.id, btrim(tag.value), (tag.ordinality - 1)::integer
FROM projects p
CROSS JOIN LATERAL unnest(COALESCE(p.technologies, ARRAY[]::text[]))
  WITH ORDINALITY AS tag(value, ordinality)
WHERE btrim(tag.value) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM project_technologies pt
    WHERE pt.project_id = p.id AND pt.position = (tag.ordinality - 1)::integer
  )
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS goal_milestones (
  id uuid PRIMARY KEY,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, position)
);

INSERT INTO goal_milestones (id, goal_id, title, position, is_complete)
SELECT gen_random_uuid(), g.id, btrim(step.value->>'title'), (step.ordinality - 1)::integer,
       CASE WHEN lower(step.value->>'done') IN ('true','false') THEN (step.value->>'done')::boolean ELSE false END
FROM goals g
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(g.milestones) = 'array' THEN g.milestones ELSE '[]'::jsonb END
) WITH ORDINALITY AS step(value, ordinality)
WHERE btrim(COALESCE(step.value->>'title', '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM goal_milestones gm
    WHERE gm.goal_id = g.id AND gm.position = (step.ordinality - 1)::integer
  )
ON CONFLICT DO NOTHING;

ALTER TABLE projects DROP COLUMN IF EXISTS technologies;
ALTER TABLE goals DROP COLUMN IF EXISTS milestones;

CREATE TABLE IF NOT EXISTS seed_runs (
  seed_key text PRIMARY KEY,
  seeded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skills_student_updated_idx ON skills (student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_student_updated_idx ON projects (student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS certificates_student_date_idx ON certificates (student_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS goals_student_target_idx ON goals (student_id, target_date);
CREATE INDEX IF NOT EXISTS opportunities_student_deadline_idx ON opportunities (student_id, deadline);
CREATE INDEX IF NOT EXISTS project_technologies_project_position_idx ON project_technologies (project_id, position);
CREATE INDEX IF NOT EXISTS goal_milestones_goal_position_idx ON goal_milestones (goal_id, position);
