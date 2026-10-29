import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRecord } from './validation.js'

test('skills require a name and proficiency from one to five', () => {
  assert.equal(validateRecord('skills', { name: ' React ', proficiency: 4 }).value.name, 'React')
  assert.equal(validateRecord('skills', { name: 'React', proficiency: 6 }).ok, false)
  assert.equal(validateRecord('skills', { name: '', proficiency: 2 }).field, 'name')
})

test('project links only allow http and https URLs', () => {
  const valid = validateRecord('projects', { title: 'Demo', technologies: 'React, Node.js', githubUrl: 'https://github.com/demo' })
  assert.deepEqual(valid.value.technologies, ['React', 'Node.js'])
  assert.equal(validateRecord('projects', { title: 'Bad link', githubUrl: 'javascript:alert(1)' }).ok, false)
})

test('certificates validate issue dates and credential URLs', () => {
  assert.equal(validateRecord('certificates', { name: 'Course', issuer: 'School', issueDate: '2026-02-28' }).ok, true)
  assert.equal(validateRecord('certificates', { name: 'Course', issuer: 'School', issueDate: '2026-02-30' }).ok, false)
})

test('goal milestones preserve completion state and reject malformed items', () => {
  const result = validateRecord('goals', {
    title: 'Learn SQL',
    milestones: [{ title: 'Read docs', done: true }, { title: 'Build project', done: false }],
  })
  assert.deepEqual(result.value.milestones[0], { title: 'Read docs', done: true })
  assert.equal(validateRecord('goals', { title: 'Learn', milestones: [{ title: 'x'.repeat(141) }] }).ok, false)
  assert.equal(validateRecord('goals', { title: 'Learn', milestones: [{ title: 'Done?', done: 'false' }] }).ok, false)
})

test('opportunities accept only the supported statuses', () => {
  assert.equal(validateRecord('opportunities', {
    organization: 'Acme', title: 'Intern', status: 'Interviewed',
  }).ok, true)
  assert.equal(validateRecord('opportunities', {
    organization: 'Acme', title: 'Intern', status: 'Pending',
  }).ok, false)
})
