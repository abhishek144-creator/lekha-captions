export class LekhaClient {
  constructor({ apiKey, baseUrl = 'https://api.lekhacaptions.com' } = {}) {
    if (!apiKey) throw new Error('apiKey is required')
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async request(path) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.detail || `Lekha API request failed (${response.status})`)
      error.status = response.status
      error.payload = payload
      throw error
    }
    return payload
  }

  listProjects() {
    return this.request('/api/v1/projects')
  }

  getProject(projectId) {
    return this.request(`/api/v1/projects/${encodeURIComponent(projectId)}`)
  }

  getExport(exportId) {
    return this.request(`/api/v1/exports/${encodeURIComponent(exportId)}`)
  }
}
