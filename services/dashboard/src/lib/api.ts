const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '6e3df3d7f06c3afe830c15c9945dbfd480e65e54dd74d734e4dd12611eeaf1d7'

async function apiFetch(path: string, options: any = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`, ...options.headers }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const api = {
  stats: {
    overview: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/stats?${qs}`)
    },
    sessions: (limit = 50) => apiFetch(`/api/stats/sessions?limit=${limit}`),
    deployments: (params: any = 'production', hours = 24) => {
      const envVal = typeof params === 'object' ? params.env || 'production' : params
      const hoursVal = typeof params === 'object' ? params.hours || 24 : hours
      return apiFetch(`/api/stats/deployments?env=${envVal}&hours=${hoursVal}`)
    },
    samplingStatus: () => apiFetch('/api/stats/sampling-status'),
  },
  business: {
    revenue: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/revenue?${qs}`)
    },
    topItems: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/top-items?${qs}`)
    },
    peakHours: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/peak-hours?${qs}`)
    },
    tableTurnover: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/table-turnover?${qs}`)
    },
    customerLoyalty: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/customer-loyalty?${qs}`)
    },
    stock: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/stock?${qs}`)
    },
    live: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/live?${qs}`)
    },
    reviews: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/reviews?${qs}`)
    },
    saas: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/saas?${qs}`)
    },
    locations: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/locations?${qs}`)
    },
    alertTemplates: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/alert-templates?${qs}`)
    }
  },
  alerts: {
    list: () => apiFetch('/api/alerts/rules'),
    create: (body: any) => apiFetch('/api/alerts/rules', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' }),
  },
  logs: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== '' && v != null)
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
      return apiFetch(`/api/logs?${qs}`)
    },
  },
  suggestions: {
    list: () => apiFetch('/api/suggestions'),
    markDone: (id: string) => apiFetch(`/api/suggestions/${id}/done`, { method: 'PATCH' }),
    dismiss: (id: string) => apiFetch(`/api/suggestions/${id}/dismiss`, { method: 'PATCH' }),
  },
}
