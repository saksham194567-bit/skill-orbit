const definitions = {
  skills: { required: ['name'], limits: { name: 100, category: 60 }, optional: ['category'] },
  projects: { required: ['title'], limits: { title: 120, description: 2000 }, optional: ['description'] },
  certificates: { required: ['name', 'issuer'], limits: { name: 140, issuer: 120 } },
  goals: { required: ['title'], limits: { title: 140, description: 2000 }, optional: ['description'] },
  opportunities: {
    required: ['organization', 'title'],
    limits: { organization: 120, title: 140, type: 60, notes: 1000 },
    optional: ['type', 'notes'],
    statuses: ['Saved', 'Applied', 'Interviewed', 'Completed', 'Rejected'],
  },
}

export function validateRecord(resource, input) {
  const definition = definitions[resource]
  if (!definition || !input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, field: '', error: 'Invalid request body.' }
  }
  const value = {}
  for (const field of definition.required) {
    const text = String(input[field] ?? '').trim()
    if (!text) return { ok: false, field, error: field + ' is required.' }
    if (text.length > definition.limits[field]) return { ok: false, field, error: field + ' is too long.' }
    value[field] = text
  }
  for (const field of definition.optional || []) {
    const text = String(input[field] ?? '').trim()
    if (text.length > definition.limits[field]) return { ok: false, field, error: field + ' is too long.' }
    value[field] = text
  }
  if (resource === 'skills') {
    value.category = String(input.category ?? '').trim()
    const proficiency = Number(input.proficiency)
    if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 5) {
      return { ok: false, field: 'proficiency', error: 'Proficiency must be between 1 and 5.' }
    }
    value.proficiency = proficiency
  }
  if (resource === 'projects') {
    value.technologies = Array.isArray(input.technologies)
      ? input.technologies.map(String).map(item => item.trim()).filter(Boolean).slice(0, 20)
      : String(input.technologies ?? '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 20)
    value.technologies = [...new Set(value.technologies)]
    if (value.technologies.some(item => item.length > 40)) {
      return { ok: false, field: 'technologies', error: 'Each technology must be 40 characters or fewer.' }
    }
    value.githubUrl = validUrl(input.githubUrl)
    value.demoUrl = validUrl(input.demoUrl)
    if (value.githubUrl === false || value.demoUrl === false) {
      return { ok: false, field: 'githubUrl', error: 'Links must be valid http or https URLs.' }
    }
  }
  if (resource === 'certificates') {
    value.issueDate = validDate(input.issueDate)
    if (value.issueDate === false) return { ok: false, field: 'issueDate', error: 'Enter a valid issue date.' }
    value.credentialUrl = validUrl(input.credentialUrl)
    if (value.credentialUrl === false) return { ok: false, field: 'credentialUrl', error: 'Enter a valid http or https URL.' }
  }
  if (resource === 'goals') {
    value.targetDate = validDate(input.targetDate)
    if (value.targetDate === false) return { ok: false, field: 'targetDate', error: 'Enter a valid target date.' }
    if (input.milestones !== undefined && !Array.isArray(input.milestones)) return { ok: false, field: 'milestones', error: 'Milestones must be a list.' }
    const milestones = Array.isArray(input.milestones) ? input.milestones : []
    if (milestones.length > 30 || milestones.some(item => !item || typeof item.title !== 'string' || item.title.trim().length > 140 || (item.done !== undefined && typeof item.done !== 'boolean'))) {
      return { ok: false, field: 'milestones', error: 'Use up to 30 milestones, each with a title under 140 characters.' }
    }
    value.milestones = milestones.filter(item => item.title.trim()).map(item => ({
      title: item.title.trim(),
      done: Boolean(item.done),
    }))
  }
  if (resource === 'opportunities') {
    value.type = String(input.type || '').trim() || 'Internship'
    if (value.type.length > 60) return { ok: false, field: 'type', error: 'Opportunity type is too long.' }
    value.deadline = validDate(input.deadline)
    if (value.deadline === false) return { ok: false, field: 'deadline', error: 'Enter a valid deadline.' }
    value.url = validUrl(input.url)
    if (value.url === false) return { ok: false, field: 'url', error: 'Enter a valid http or https URL.' }
    value.status = input.status || 'Saved'
    if (!definition.statuses.includes(value.status)) return { ok: false, field: 'status', error: 'Choose a valid status.' }
  }
  return { ok: true, value }
}

function validUrl(input) {
  const text = String(input ?? '').trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : false
  } catch {
    return false
  }
}

function validDate(input) {
  const text = String(input ?? '').trim()
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(text + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : false
}
