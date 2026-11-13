import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL;
const baseURL = apiBase
  ? apiBase.endsWith('/api')
    ? apiBase
    : `${apiBase.replace(/\/+$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export default api;
