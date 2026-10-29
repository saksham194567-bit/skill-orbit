const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export async function request(path, options = {}) {
  const response = await fetch(API_BASE + '/api/' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'The request could not be completed.')
    error.status = response.status
    error.code = data.code
    error.field = data.field
    throw error
  }
  return data
}

export const fetchHealth = () => request('health')
export const fetchProfile = () => request('profile')
export const fetchResource = (name) => request(name)
export const fetchDashboard = () => request('dashboard')
export const fetchPortfolio = () => request('portfolio')
export const createRecord = (name, value) =>
  request(name, { method: 'POST', body: JSON.stringify(value) })
export const updateRecord = (name, id, value) =>
  request(name + '/' + id, { method: 'PUT', body: JSON.stringify(value) })
export const deleteRecord = (name, id) =>
  request(name + '/' + id, { method: 'DELETE' })
