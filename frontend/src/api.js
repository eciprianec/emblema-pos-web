import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('emblemapos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('emblemapos_token');
      localStorage.removeItem('emblemapos_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
};

export const ventasApi = {
  buscarProducto: (term) => api.get(`/ventas/buscar-producto?q=${encodeURIComponent(term)}`),
  consultarPrecio: (term) => api.get(`/ventas/verificador-precio?q=${encodeURIComponent(term)}`),
  procesarVenta: (data) => api.post('/ventas', data),
  historialVentas: (limit = 20) => api.get(`/ventas/historial?limit=${limit}`),
  cancelarVenta: (id, reason) => api.post(`/ventas/${id}/cancelar`, { reason }),
};

export const clientesApi = {
  getAll: (search = '') => api.get(`/clientes${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getById: (id) => api.get(`/clientes/${id}`),
  create: (data) => api.post('/clientes', data),
  update: (id, data) => api.put(`/clientes/${id}`, data),
  registrarAbono: (id, data) => api.post(`/clientes/${id}/abono`, data),
  getEstadoCuenta: (id) => api.get(`/clientes/${id}/estado-cuenta`),
  getResumenDeuda: () => api.get('/clientes/resumen-deuda/total'),
};

export const productosApi = {
  getAll: (params = {}) => api.get('/productos', { params }),
  getById: (id) => api.get(`/productos/${id}`),
  getByBarcode: (barcode) => api.get(`/productos/barcode/${barcode}`),
  create: (data) => api.post('/productos', data),
  update: (id, data) => api.put(`/productos/${id}`, data),
  delete: (id) => api.delete(`/productos/${id}`),
  getDepartments: () => api.get('/productos/departamentos/list'),
  createDepartment: (data) => api.post('/productos/departamentos', data),
};

export const inventariosApi = {
  agregarStock: (data) => api.post('/inventarios/agregar-stock', data),
  ajustarStock: (data) => api.post('/inventarios/ajustar-stock', data),
  getBajoStock: () => api.get('/inventarios/bajo-stock'),
  getValuacion: () => api.get('/inventarios/valuacion'),
  getKardex: (productId, limit = 50) => api.get(`/inventarios/kardex/${productId}?limit=${limit}`),
};

export const comprasApi = {
  getSuppliers: () => api.get('/compras/proveedores'),
  createSupplier: (data) => api.post('/compras/proveedores', data),
  getPurchases: () => api.get('/compras'),
  createPurchase: (data) => api.post('/compras', data),
};

export const cortesApi = {
  getEstadoCaja: () => api.get('/cortes/estado-actual'),
  abrirCaja: (data) => api.post('/cortes/abrir', data),
  cerrarCorte: (data) => api.post('/cortes/cerrar', data),
  movimientoCaja: (data) => api.post('/cortes/movimiento', data),
  getHistorial: () => api.get('/cortes/historial'),
};

export const reportesApi = {
  getDashboard: () => api.get('/reportes/dashboard'),
  getVentasPeriodo: (startDate, endDate) => 
    api.get(`/reportes/ventas-periodo?start_date=${startDate}&end_date=${endDate}`),
  getTopProductos: (limit = 10) => api.get(`/reportes/top-productos?limit=${limit}`),
  getVentasDepartamento: () => api.get('/reportes/ventas-departamento'),
};

export const dgiiApi = {
  getConfig: () => api.get('/dgii/config'),
  updateConfig: (data) => api.put('/dgii/config', data),
  testConnection: () => api.post('/dgii/test-connection'),
  reintentarEnvio: (saleId) => api.post(`/dgii/reintentar-envio/${saleId}`),
  consultarStatus: (trackId) => api.get(`/dgii/consultar-status/${trackId}`),
  getLogs: () => api.get('/dgii/logs'),
  getSequences: () => api.get('/dgii/sequences'),
  getFormatosResumen: (year, month) => api.get(`/dgii/formatos/resumen?year=${year}&month=${month}`),
  getFormato606: (year, month) => api.get(`/dgii/formatos/606?year=${year}&month=${month}`),
  getFormato607: (year, month) => api.get(`/dgii/formatos/607?year=${year}&month=${month}`),
  download606TxtUrl: (year, month) => `${API_BASE_URL}/dgii/formatos/606/download-txt?year=${year}&month=${month}`,
  download606CsvUrl: (year, month) => `${API_BASE_URL}/dgii/formatos/606/download-csv?year=${year}&month=${month}`,
  download607TxtUrl: (year, month) => `${API_BASE_URL}/dgii/formatos/607/download-txt?year=${year}&month=${month}`,
  download607CsvUrl: (year, month) => `${API_BASE_URL}/dgii/formatos/607/download-csv?year=${year}&month=${month}`,
};

export const configApi = {
  getStore: () => api.get('/config/store'),
  updateStore: (data) => api.put('/config/store', data),
  getUsers: () => api.get('/config/users'),
  createUser: (data) => api.post('/config/users', data),
  updateUser: (id, data) => api.put(`/config/users/${id}`, data),
  deleteUser: (id) => api.delete(`/config/users/${id}`),
  downloadBackupUrl: `${API_BASE_URL}/config/backup/download`,
  downloadBackup: () => api.get('/config/backup/download', { responseType: 'blob' }),
  restoreBackup: (formData) => api.post('/config/backup/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  optimizeDatabase: () => api.post('/config/database/optimize'),
  testEmail: () => api.post('/config/test-email'),
};

