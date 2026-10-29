import { useMemo, useState } from 'react'

const singular = { skills: 'skill', projects: 'project', certificates: 'certificate', goals: 'goal', opportunities: 'opportunity' }

const labels = {
  skills: 'Skills',
  projects: 'Projects',
  certificates: 'Certificates',
  goals: 'Learning goals',
  opportunities: 'Opportunities',
}

const opportunityStatuses = ['Saved', 'Applied', 'Interviewed', 'Completed', 'Rejected']

const definitions = {
  skills: [
    { name: 'name', label: 'Skill name', required: true, placeholder: 'e.g. React' },
    { name: 'category', label: 'Category', placeholder: 'e.g. Frontend' },
    { name: 'proficiency', label: 'Proficiency', type: 'select', options: [
      ['1', 'Beginner'], ['2', 'Developing'], ['3', 'Intermediate'], ['4', 'Advanced'], ['5', 'Expert'],
    ] },
  ],
  projects: [
    { name: 'title', label: 'Project title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'technologies', label: 'Technologies', placeholder: 'React, Node.js, PostgreSQL' },
    { name: 'githubUrl', label: 'GitHub link', type: 'url' },
    { name: 'demoUrl', label: 'Demo link', type: 'url' },
  ],
  certificates: [
    { name: 'name', label: 'Certificate name', required: true },
    { name: 'issuer', label: 'Issuing organization', required: true },
    { name: 'issueDate', label: 'Issue date', type: 'date' },
    { name: 'credentialUrl', label: 'Credential link', type: 'url' },
  ],
  goals: [
    { name: 'title', label: 'Goal title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'targetDate', label: 'Target date', type: 'date' },
    { name: 'milestonesText', label: 'Milestones', type: 'textarea', placeholder: 'One milestone per line' },
  ],
  opportunities: [
    { name: 'organization', label: 'Organization', required: true },
    { name: 'title', label: 'Opportunity title', required: true },
    { name: 'type', label: 'Type', placeholder: 'Internship, scholarship, event…' },
    { name: 'deadline', label: 'Deadline', type: 'date' },
    { name: 'url', label: 'Opportunity link', type: 'url' },
    { name: 'status', label: 'Status', type: 'select', options: [
      ['Saved', 'Saved'], ['Applied', 'Applied'], ['Interviewed', 'Interviewed'],
      ['Completed', 'Completed'], ['Rejected', 'Rejected'],
    ] },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
}

function formFrom(record, resource) {
  if (!record) {
    return resource === 'skills' ? { proficiency: '1' }
      : resource === 'opportunities' ? { type: 'Internship', status: 'Saved' } : {}
  }
  const result = { ...record }
  if (resource === 'projects') result.technologies = (record.technologies || []).join(', ')
  if (resource === 'goals') result.milestonesText = (record.milestones || []).map(item => (item.done ? '[x] ' : '[ ] ') + item.title).join('\n')
  if (resource === 'skills') result.proficiency = String(record.proficiency)
  return result
}

function toPayload(resource, form) {
  const result = { ...form }
  if (resource === 'projects') result.technologies = String(form.technologies || '').split(',').map(item => item.trim()).filter(Boolean)
  if (resource === 'goals') {
    result.milestones = String(form.milestonesText || '').split('\n').map(title => title.trim()).filter(Boolean)
      .map(line => ({ title: line.replace(/^\[(x| )\]\s*/i, '').trim(), done: /^\[x\]/i.test(line) }))
    delete result.milestonesText
  }
  if (resource === 'skills') result.proficiency = Number(form.proficiency)
  delete result.id
  delete result.createdAt
  delete result.updatedAt
  return result
}

function titleOf(item) {
  return item.title || item.name
}

function summaryOf(resource, item) {
  if (resource === 'skills') return item.category || 'Skill'
  if (resource === 'projects') return item.description || (item.technologies || []).join(' · ') || 'Project'
  if (resource === 'certificates') return item.issuer + (item.issueDate ? ' · ' + item.issueDate.slice(0, 10) : '')
  if (resource === 'goals') return item.description || 'Learning goal'
  return item.organization + ' · ' + item.type
}

export default function ResourcePage({ resource, records, busy, onSave, onDelete }) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const visible = useMemo(() => records.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
    && (resource !== 'opportunities' || statusFilter === 'All statuses' || item.status === statusFilter)),
  [records, resource, search, statusFilter])
  const hasActiveFilters = Boolean(search) || (resource === 'opportunities' && statusFilter !== 'All statuses')

  function openForm(record = null) {
    setEditing(record || {})
    setForm(formFrom(record, resource))
    setFormError('')
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await onSave(resource, editing?.id, toPayload(resource, form))
      setEditing(null)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSaving(false)
    }
  }

  function fieldInput(field) {
    const value = form[field.name] ?? ''
    const common = {
      id: resource + '-' + field.name,
      name: field.name,
      value,
      required: field.required,
      placeholder: field.placeholder,
      onChange: event => setForm(current => ({ ...current, [field.name]: event.target.value })),
    }
    if (field.type === 'textarea') return <textarea {...common} rows="3" />
    if (field.type === 'select') return (
      <select {...common}>{field.options.map(([option, label]) =>
        <option key={option} value={option}>{label}</option>)}</select>
    )
    return <input {...common} type={field.type || 'text'} />
  }

  return (
    <section className="module-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your tracker</p>
          <h2>{labels[resource]}</h2>
          <p className="muted">{records.length} {records.length === 1 ? 'record' : 'records'} saved to your database</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => openForm()}>＋ Add {singular[resource]}</button>
      </div>

      {editing !== null && (
        <form className="panel editor-form" onSubmit={submit}>
          <div className="form-heading">
            <h3>{editing?.id ? 'Edit record' : 'Create ' + (singular[resource])}</h3>
            <button className="text-btn" type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
          <div className="form-grid">
            {definitions[resource].map(field => (
              <label className={'field ' + (field.type === 'textarea' ? 'wide' : '')} key={field.name} htmlFor={resource + '-' + field.name}>
                <span>{field.label}{field.required ? ' *' : ''}</span>
                {fieldInput(field)}
              </label>
            ))}
          </div>
          {formError && <p className="error-message" role="alert">{formError}</p>}
          <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Create record'}</button>
        </form>
      )}

      {moduleError && <p className="error-message" role="alert">{moduleError}</p>}
      <label className="search-field">
        <span className="sr-only">Search {labels[resource].toLowerCase()}</span>
        <span aria-hidden="true">⌕</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={'Search ' + labels[resource].toLowerCase()} />
      </label>

      {resource === 'opportunities' && <label className="filter-field">
        <span>Filter by status</span>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option>All statuses</option>
          {opportunityStatuses.map(status => <option key={status}>{status}</option>)}
        </select>
      </label>}

      {busy ? <div className="empty-state panel" role="status">Loading {labels[resource].toLowerCase()}…</div>
        : visible.length === 0 ? (
          <div className="empty-state panel">
            <span className="empty-icon" aria-hidden="true">✳</span>
            <h3>{hasActiveFilters ? 'No matching records' : 'A fresh start'}</h3>
            <p>{hasActiveFilters ? 'Try another search or status.' : 'Add your first ' + (resource === 'goals' ? 'learning goal' : singular[resource]) + ' to see it here.'}</p>
            {!hasActiveFilters && <button className="secondary-btn" type="button" onClick={() => openForm()}>Add the first one</button>}
          </div>
        ) : (
          <div className="record-grid">
            {visible.map(item => {
              const milestones = item.milestones || []
              const progress = milestones.length ? Math.round(100 * milestones.filter(step => step.done).length / milestones.length) : 0
              return (
                <article className="record-card panel" key={item.id}>
                  <div className="record-top">
                    <div>
                      <h3>{titleOf(item)}</h3>
                      <p className="muted">{summaryOf(resource, item)}</p>
                    </div>
                    {resource === 'skills' && <span className="status-tag">Level {item.proficiency}/5</span>}
                    {resource === 'opportunities' && <span className={'status-tag status-' + item.status.toLowerCase()}>{item.status}</span>}
                  </div>
                  {resource === 'projects' && item.technologies?.length > 0 && (
                    <div className="tag-list">{item.technologies.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
                  )}
                  {resource === 'projects' && <div className="link-row">
                    {item.githubUrl && <a href={item.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}
                    {item.demoUrl && <a href={item.demoUrl} target="_blank" rel="noreferrer">Live demo ↗</a>}
                  </div>}
                  {resource === 'certificates' && item.credentialUrl && <a href={item.credentialUrl} target="_blank" rel="noreferrer">View credential ↗</a>}
                  {resource === 'goals' && (
                    <div className="goal-progress">
                      <div className="progress-meta"><span>{milestones.filter(step => step.done).length} of {milestones.length} milestones</span><span>{progress}%</span></div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: progress + '%' }} /></div>
                      <ul className="milestone-list">{milestones.map((step, index) =>
                        <li key={index}><label><input type="checkbox" checked={step.done} onChange={async () => { setModuleError(''); try { await onSave(resource, item.id, { ...item, milestones: milestones.map((entry, i) => i === index ? { ...entry, done: !entry.done } : entry) }) } catch (error) { setModuleError(error.message) } }} />{step.title}</label></li>)}</ul>
                    </div>
                  )}
                  {resource === 'opportunities' && item.deadline && <p className="card-date">Deadline · {item.deadline.slice(0, 10)}</p>}
                  <div className="record-actions">
                    <button className="text-btn" type="button" onClick={() => openForm(item)}>Edit</button>
                    <button className="text-btn danger-btn" type="button" onClick={() => onDelete(resource, item.id)}>Delete</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
    </section>
  )
}
