import axios from 'axios'
const service = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000
})
service.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
service.interceptors.response.use(res => res.data, err => {
  console.error('请求异常', err)
  return Promise.reject(err)
})
export default service