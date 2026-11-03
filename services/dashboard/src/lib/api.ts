/**
 * api.ts — API client for the Kwudle dashboard.
 * Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_API_KEY in your .env file.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

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
    overview: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/stats?${qs}`)
    },
    sessions: async (limit = 50) => apiFetch(`/api/stats/sessions?limit=${limit}`),
    deployments: async (params: any = 'production', hours = 24) => {
      const envVal = typeof params === 'object' ? params.env || 'production' : params
      const hoursVal = typeof params === 'object' ? params.hours || 24 : hours
      return apiFetch(`/api/stats/deployments?env=${envVal}&hours=${hoursVal}`)
    },
    samplingStatus: async () => apiFetch('/api/stats/sampling-status'),
  },
  business: {
    revenue: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/revenue?${qs}`)
    },
    topItems: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/top-items?${qs}`)
    },
    peakHours: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/peak-hours?${qs}`)
    },
    tableTurnover: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/table-turnover?${qs}`)
    },
    customerLoyalty: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/customer-loyalty?${qs}`)
    },
    stock: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/stock?${qs}`)
    },
    live: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/live?${qs}`)
    },
    reviews: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/reviews?${qs}`)
    },
    saas: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/saas?${qs}`)
    },
    locations: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/locations?${qs}`)
    },
    alertTemplates: async (params: any = {}) => {
      const qs = new URLSearchParams(params).toString()
      return apiFetch(`/api/business/alert-templates?${qs}`)
    },
  },
  alerts: {
    list: async () => apiFetch('/api/alerts/rules'),
    create: async (body: any) => apiFetch('/api/alerts/rules', { method: 'POST', body: JSON.stringify(body) }),
    delete: async (id: string) => apiFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' }),
  },
  logs: {
    list: async (params: any = {}) => {
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
    list: async () => apiFetch('/api/suggestions'),
    markDone: async (id: string) => apiFetch(`/api/suggestions/${id}/done`, { method: 'PATCH' }),
    dismiss: async (id: string) => apiFetch(`/api/suggestions/${id}/dismiss`, { method: 'PATCH' }),
  },
}
