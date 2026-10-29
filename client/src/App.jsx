import { useCallback, useEffect, useState } from 'react'
import {
  createRecord, deleteRecord, fetchDashboard, fetchHealth, fetchPortfolio,
  fetchProfile, fetchResource, updateRecord,
} from './api.js'
import Dashboard from './components/Dashboard.jsx'
import Header from './components/Header.jsx'
import Portfolio from './components/Portfolio.jsx'
import ResourcePage from './components/ResourcePage.jsx'
import Sidebar from './components/Sidebar.jsx'
import { navItems } from './demoStudent.js'

const resourceNames = ['skills', 'projects', 'certificates', 'goals', 'opportunities']
const emptyRecords = { skills: [], projects: [], certificates: [], goals: [], opportunities: [] }
const emptyPortfolio = { profile: null, skills: [], projects: [], certificates: [] }
const resourceLabels = {
  skills: 'Skill',
  projects: 'Project',
  certificates: 'Certificate',
  goals: 'Learning goal',
  opportunities: 'Opportunity',
}

function apiStatusFrom(data) {
  const state = data.database === 'ready' ? 'ok' : data.database === 'connecting' ? 'checking' : 'down'
  const label = data.database === 'ready' ? 'connected'
    : data.database === 'not_configured' ? 'database setup needed'
      : data.database === 'connecting' ? 'connecting' : 'database unavailable'
  return { state, label }
}

async function fetchAppData() {
  const [values, dashboard, portfolio, profile] = await Promise.all([
    Promise.all(resourceNames.map(fetchResource)),
    fetchDashboard(),
    fetchPortfolio(),
    fetchProfile(),
  ])
  return {
    records: Object.fromEntries(resourceNames.map((name, index) => [name, values[index]])),
    dashboard,
    portfolio,
    profile,
  }
}

export default function App() {
  const [view, setView] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState({ state: 'checking', label: 'checking…' })
  const [records, setRecords] = useState(emptyRecords)
  const [dashboard, setDashboard] = useState(null)
  const [portfolio, setPortfolio] = useState(emptyPortfolio)
  const [profile, setProfile] = useState({ name: 'Student', program: '', year: '', college: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const applyData = useCallback(data => {
    setRecords(data.records)
    setDashboard(data.dashboard)
    setPortfolio(data.portfolio)
    setProfile(data.profile)
  }, [])

  const loadData = useCallback(async () => {
    try {
      applyData(await fetchAppData())
      setError('')
      return true
    } catch (requestError) {
      setError(requestError.message)
      setRecords(emptyRecords)
      setDashboard(null)
      setPortfolio(emptyPortfolio)
      return false
    } finally {
      setLoading(false)
    }
  }, [applyData])

  const refreshApiStatus = useCallback(async () => {
    try {
      setApiStatus(apiStatusFrom(await fetchHealth()))
    } catch {
      setApiStatus({ state: 'down', label: 'unreachable' })
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchHealth().then(data => {
      if (active) setApiStatus(apiStatusFrom(data))
    }).catch(() => {
      if (active) setApiStatus({ state: 'down', label: 'unreachable' })
    })

    fetchAppData().then(data => {
      if (active) {
        applyData(data)
        setError('')
      }
    }).catch(requestError => {
      if (active) {
        setError(requestError.message)
        setRecords(emptyRecords)
        setDashboard(null)
        setPortfolio(emptyPortfolio)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [applyData, refreshApiStatus])

  async function refreshData() {
    setLoading(true)
    setError('')
    refreshApiStatus()
    return loadData()
  }

  async function save(resource, id, value) {
    setNotice('')
    if (id) await updateRecord(resource, id, value)
    else await createRecord(resource, value)
    const refreshed = await refreshData()
    setNotice(refreshed
      ? resourceLabels[resource] + (id ? ' updated.' : ' created.')
      : 'Saved, but the refreshed data could not be loaded. Retry to confirm.')
  }

  async function remove(resource, id) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    setNotice('')
    try {
      await deleteRecord(resource, id)
      const refreshed = await refreshData()
      if (refreshed) setNotice(resourceLabels[resource] + ' deleted.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const current = navItems.find(item => item.id === view)
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar current={view} onNavigate={setView} open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <button type="button" className="backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <main className="main" id="main-content" tabIndex="-1">
        <Header student={profile} apiStatus={apiStatus} menuOpen={menuOpen} onMenu={() => setMenuOpen(true)}
          pageTitle={view === 'dashboard' ? 'Welcome back, ' + (profile.name || 'Student').split(' ')[0] : current?.label}
          eyebrow={view === 'dashboard' ? 'Overview' : 'Your tracker'} />
        {error && <div className="error-banner" role="alert">
          <div><strong>Data service unavailable</strong><p>{error}</p></div>
          <button className="secondary-btn" type="button" onClick={refreshData}>Retry</button>
        </div>}
        {notice && <div className="success-banner" role="status">
          <span>{notice}</span>
          <button type="button" className="text-btn" aria-label="Dismiss message" onClick={() => setNotice('')}>Dismiss</button>
        </div>}
        {view === 'dashboard' && (loading ? <section className="panel unavailable" role="status">Loading dashboard…</section> : dashboard
          ? <Dashboard data={dashboard} records={records} />
          : <section className="panel unavailable"><h2>Dashboard data unavailable</h2><p className="muted">Connect PostgreSQL to load saved records. Nothing is stored in temporary browser memory.</p></section>)}
        {resourceNames.includes(view) && <ResourcePage
          key={view}
          resource={view}
          records={records[view]}
          busy={loading}
          onSave={save}
          onDelete={remove}
        />}
        {view === 'portfolio' && (loading ? <section className="panel unavailable" role="status">Loading portfolio…</section> : <Portfolio data={portfolio} />)}
        {!['dashboard', ...resourceNames, 'portfolio'].includes(view) && (
          <section className="panel unavailable"><h2>{current?.label}</h2><p className="muted">This module is planned for a later phase.</p></section>
        )}
      </main>
    </div>
  )
}
