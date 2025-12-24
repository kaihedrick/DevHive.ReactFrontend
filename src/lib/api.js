import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL ?? 'https://go.devhive.it.com/api/v1',
})

api.interceptors.request.use(config => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const p = err.response?.data
    const message = p?.detail || p?.title || err.message
    // show toast/banner here
    return Promise.reject(new Error(message))
  }
)
