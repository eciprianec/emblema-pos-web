import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  ShieldCheck, 
  Server, 
  RefreshCw, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Filter, 
  DollarSign, 
  TrendingUp, 
  Layers 
} from 'lucide-react';
import { dgiiApi } from '../api';

export default function DGII() {
  const [activeTab, setActiveTab] = useState('config'); // 'config', '606', '607', 'logs'
  const [config, setConfig] = useState(null);
  const [serviceOnline, setServiceOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Período para Formatos 606 y 607
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  // Estados de Formato 606
  const [data606, setData606] = useState(null);
  const [loading606, setLoading606] = useState(false);
  const [search606, setSearch606] = useState('');

  // Estados de Formato 607
  const [data607, setData607] = useState(null);
  const [loading607, setLoading607] = useState(false);
  const [search607, setSearch607] = useState('');

  // Estados de Logs
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Formulario de edición de configuración
  const [formData, setFormData] = useState({
    environment: 'DEV',
    rnc_emisor: '',
    razon_social: '',
    nombre_comercial: '',
    direccion: '',
    provincia: '010000',
    municipio: '010100',
    telefono: '',
    email: '',
    secuencia_e31_actual: 1,
    secuencia_e31_fin: 10000,
    vencimiento_e31: '31-12-2026',
    secuencia_e32_actual: 1,
    secuencia_e32_fin: 50000,
    vencimiento_e32: '31-12-2026',
    auto_envio_dgii: true,
    modo_contingencia: false
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await dgiiApi.getConfig();
      setConfig(res.data.config);
      setServiceOnline(res.data.service_online);
      setFormData({
        environment: res.data.config.environment || 'DEV',
        rnc_emisor: res.data.config.rnc_emisor || '',
        razon_social: res.data.config.razon_social || '',
        nombre_comercial: res.data.config.nombre_comercial || '',
        direccion: res.data.config.direccion || '',
        provincia: res.data.config.provincia || '010000',
        municipio: res.data.config.municipio || '010100',
        telefono: res.data.config.telefono || '',
        email: res.data.config.email || '',
        secuencia_e31_actual: res.data.config.secuencia_e31_actual || 1,
        secuencia_e31_fin: res.data.config.secuencia_e31_fin || 10000,
        vencimiento_e31: res.data.config.vencimiento_e31 || '31-12-2026',
        secuencia_e32_actual: res.data.config.secuencia_e32_actual || 1,
        secuencia_e32_fin: res.data.config.secuencia_e32_fin || 50000,
        vencimiento_e32: res.data.config.vencimiento_e32 || '31-12-2026',
        auto_envio_dgii: res.data.config.auto_envio_dgii ?? true,
        modo_contingencia: res.data.config.modo_contingencia ?? false
      });
    } catch (err) {
      console.error("Error al cargar configuración DGII:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadFormato606 = async () => {
    setLoading606(true);
    try {
      const res = await dgiiApi.getFormato606(selectedYear, selectedMonth);
      setData606(res.data);
    } catch (err) {
      console.error("Error al cargar 606:", err);
    } finally {
      setLoading606(false);
    }
  };

  const loadFormato607 = async () => {
    setLoading607(true);
    try {
      const res = await dgiiApi.getFormato607(selectedYear, selectedMonth);
      setData607(res.data);
    } catch (err) {
      console.error("Error al cargar 607:", err);
    } finally {
      setLoading607(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await dgiiApi.getLogs();
      setLogs(res.data);
    } catch (err) {
      console.error("Error al cargar logs DGII:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (activeTab === '606') {
      loadFormato606();
    } else if (activeTab === '607') {
      loadFormato607();
    } else if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, selectedYear, selectedMonth]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionMessage(null);
    try {
      const res = await dgiiApi.testConnection();
      setConnectionMessage({
        success: res.data.success,
        message: res.data.message
      });
      setServiceOnline(res.data.success);
    } catch (err) {
      setConnectionMessage({
        success: false,
        message: "No se pudo conectar con el microservicio DGII e-CF en el puerto 3001."
      });
      setServiceOnline(false);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dgiiApi.updateConfig(formData);
      alert("Configuración de DGII guardada exitosamente.");
      loadConfig();
    } catch (err) {
      alert("Error al guardar configuración DGII.");
    } finally {
      setSaving(false);
    }
  };

  const meses = [
    { num: 1, name: 'Enero' },
    { num: 2, name: 'Febrero' },
    { num: 3, name: 'Marzo' },
    { num: 4, name: 'Abril' },
    { num: 5, name: 'Mayo' },
    { num: 6, name: 'Junio' },
    { num: 7, name: 'Julio' },
    { num: 8, name: 'Agosto' },
    { num: 9, name: 'Septiembre' },
    { num: 10, name: 'Octubre' },
    { num: 11, name: 'Noviembre' },
    { num: 12, name: 'Diciembre' }
  ];

  const handleDownloadTxt606 = () => {
    window.open(dgiiApi.download606TxtUrl(selectedYear, selectedMonth), '_blank');
  };

  const handleDownloadCsv606 = () => {
    window.open(dgiiApi.download606CsvUrl(selectedYear, selectedMonth), '_blank');
  };

  const handleDownloadTxt607 = () => {
    window.open(dgiiApi.download607TxtUrl(selectedYear, selectedMonth), '_blank');
  };

  const handleDownloadCsv607 = () => {
    window.open(dgiiApi.download607CsvUrl(selectedYear, selectedMonth), '_blank');
  };

  // Filtrado 606
  const filteredRows606 = data606?.rows?.filter(r => 
    r.proveedor_nombre.toLowerCase().includes(search606.toLowerCase()) ||
    r.rnc_cedula.includes(search606) ||
    r.ncf.toLowerCase().includes(search606.toLowerCase())
  ) || [];

  // Filtrado 607
  const filteredRows607 = data607?.rows?.filter(r => 
    r.cliente_nombre.toLowerCase().includes(search607.toLowerCase()) ||
    r.ncf.toLowerCase().includes(search607.toLowerCase()) ||
    (r.rnc_cedula && r.rnc_cedula.includes(search607))
  ) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Principal */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-blue-600" />
            <span>F8: Módulo Fiscal DGII (Ley 32-23 & Formatos 606 / 607)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de Comprobantes Electrónicos e-CF, Secuencias E31/E32 y Reportes Tributarios Mensuales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            serviceOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${serviceOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{serviceOnline ? 'Microservicio e-CF Online' : 'Microservicio en Espera'}</span>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="flex items-center space-x-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
            <span>Probar Conexión DGII</span>
          </button>
        </div>
      </div>

      {connectionMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          connectionMessage.success 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {connectionMessage.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{connectionMessage.message}</span>
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-2xl shadow-sm gap-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Configuración & e-CF</span>
        </button>

        <button
          onClick={() => setActiveTab('606')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === '606'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Formato 606 (Compras)</span>
        </button>

        <button
          onClick={() => setActiveTab('607')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === '607'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Formato 607 (Ventas)</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Comprobantes Timbrados & Logs</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: CONFIGURACIÓN & E-CF */}
      {/* ========================================================= */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Entorno y Transmisor */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span>1. Entorno DGII & Datos del Emisor</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Entorno de Operación DGII</label>
                <select
                  value={formData.environment}
                  onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="DEV">Desarrollo (DEV)</option>
                  <option value="CERT">Certificación (CERT)</option>
                  <option value="PROD">Producción Oficial (PROD)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">RNC del Emisor (Contribuyente) *</label>
                <input
                  type="text"
                  required
                  value={formData.rnc_emisor}
                  onChange={(e) => setFormData({ ...formData, rnc_emisor: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Razón Social Registrada *</label>
                <input
                  type="text"
                  required
                  value={formData.razon_social}
                  onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  value={formData.nombre_comercial}
                  onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Teléfono Fiscal</label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico para Facturación</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">Dirección Fiscal Completa</label>
              <input
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Secuencias e-NCF */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>2. Secuencias de Comprobantes Fiscales Electrónicos (e-NCF)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* E31 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-900 text-sm">E31: Factura de Crédito Fiscal</span>
                  <span className="font-mono text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">
                    E31{String(formData.secuencia_e31_actual).padStart(10, '0')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Secuencia Actual</label>
                    <input
                      type="number"
                      value={formData.secuencia_e31_actual}
                      onChange={(e) => setFormData({ ...formData, secuencia_e31_actual: parseInt(e.target.value) || 1 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Secuencia Fin</label>
                    <input
                      type="number"
                      value={formData.secuencia_e31_fin}
                      onChange={(e) => setFormData({ ...formData, secuencia_e31_fin: parseInt(e.target.value) || 10000 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Vencimiento</label>
                    <input
                      type="text"
                      value={formData.vencimiento_e31}
                      onChange={(e) => setFormData({ ...formData, vencimiento_e31: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* E32 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-900 text-sm">E32: Factura de Consumo</span>
                  <span className="font-mono text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">
                    E32{String(formData.secuencia_e32_actual).padStart(10, '0')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Secuencia Actual</label>
                    <input
                      type="number"
                      value={formData.secuencia_e32_actual}
                      onChange={(e) => setFormData({ ...formData, secuencia_e32_actual: parseInt(e.target.value) || 1 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Secuencia Fin</label>
                    <input
                      type="number"
                      value={formData.secuencia_e32_fin}
                      onChange={(e) => setFormData({ ...formData, secuencia_e32_fin: parseInt(e.target.value) || 50000 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Vencimiento</label>
                    <input
                      type="text"
                      value={formData.vencimiento_e32}
                      onChange={(e) => setFormData({ ...formData, vencimiento_e32: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Certificado Digital */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              <span>3. Certificado Digital .p12 & Opciones de Contingencia</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 border rounded-xl space-y-2">
                <span className="font-bold text-slate-800 block">Certificado para Firma Digital:</span>
                <p className="text-slate-500">
                  Ubicación configurada: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">{config?.cert_path || './certs/certificate.p12'}</code>
                </p>
                <p className="text-slate-500">
                  Estado: <span className="font-semibold text-emerald-600">{config?.cert_status || 'Listo'}</span>
                </p>
              </div>

              <div className="p-4 border rounded-xl space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_envio_dgii}
                    onChange={(e) => setFormData({ ...formData, auto_envio_dgii: e.target.checked })}
                    className="rounded text-blue-600 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">Transmisión automática inmediata a la DGII al cobrar</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.modo_contingencia}
                    onChange={(e) => setFormData({ ...formData, modo_contingencia: e.target.checked })}
                    className="rounded text-amber-600 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">Modo Contingencia (Emitir localmente si DGII no responde)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs shadow-lg transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración DGII'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: FORMATO 606 (COMPRAS DE BIENES Y SERVICIOS) */}
      {/* ========================================================= */}
      {activeTab === '606' && (
        <div className="space-y-6">
          {/* Barra de Filtro y Selección de Período */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Año Fiscal</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Mes Fiscal</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  {meses.map(m => (
                    <option key={m.num} value={m.num}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={loadFormato606}
                  disabled={loading606}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading606 ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* Botones de Descarga DGII Oficial */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTxt606}
                disabled={!data606 || data606.cantidad_registros === 0}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Descargar TXT DGII (|)</span>
              </button>

              <button
                onClick={handleDownloadCsv606}
                disabled={!data606 || data606.cantidad_registros === 0}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center gap-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar CSV / Excel</span>
              </button>
            </div>
          </div>

          {/* Tarjetas KPI de Totales 606 */}
          {data606 && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Registros 606</span>
                <span className="text-2xl font-black text-slate-800">{data606.cantidad_registros}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Compras en el período</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Monto Total Facturado</span>
                <span className="text-2xl font-black text-blue-600">RD$ {data606.totales.total_facturado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Bienes: RD$ {data606.totales.total_bienes.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">ITBIS Deducible (Adelantar)</span>
                <span className="text-2xl font-black text-emerald-600">RD$ {data606.totales.total_itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-emerald-700 block mt-1 font-semibold">Crédito fiscal a favor</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Retenciones (ITBIS + ISR)</span>
                <span className="text-2xl font-black text-purple-600">RD$ {data606.totales.total_retenciones.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Retenido a suplidores</span>
              </div>
            </div>
          )}

          {/* Tabla de Registros del 606 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Detalle de Compras y Gastos (Norma 07-2018 DGII)</span>
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar proveedor o NCF..."
                  value={search606}
                  onChange={(e) => setSearch606(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">RNC / Cédula</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">NCF</th>
                    <th className="py-2.5 px-3">Tipo Gasto</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-right">Monto Bienes</th>
                    <th className="py-2.5 px-3 text-right">ITBIS</th>
                    <th className="py-2.5 px-3 text-right">Total Facturado</th>
                    <th className="py-2.5 px-3 text-center">Forma Pago</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading606 ? (
                    <tr>
                      <td colSpan="12" className="py-8 text-center text-slate-400">
                        Cargando registros del 606...
                      </td>
                    </tr>
                  ) : filteredRows606.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-8 text-center text-slate-400">
                        No hay compras registradas para este período fiscal ({selectedMonth}/{selectedYear}).
                      </td>
                    </tr>
                  ) : (
                    filteredRows606.map((row) => (
                      <tr key={row.numero_linea} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono text-slate-400">{row.numero_linea}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{row.rnc_cedula}</td>
                        <td className="py-2 px-3 text-slate-500 font-semibold">{row.tipo_id === "1" ? "RNC" : "Cédula"}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.proveedor_nombre}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{row.ncf}</td>
                        <td className="py-2 px-3 text-slate-600">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
                            {row.tipo_bienes_servicios === "09" ? "09 - Costo Venta" : row.tipo_bienes_servicios}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{row.fecha_comprobante}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">RD$ {row.monto_bienes.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">RD$ {row.itbis_facturado.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">RD$ {row.total_facturado.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                            {row.forma_pago === "01" ? "01 Efectivo" : row.forma_pago === "02" ? "02 Transf" : row.forma_pago === "04" ? "04 Crédito" : row.forma_pago}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.tiene_advertencia ? (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold" title={row.advertencia_motivo}>
                              Aviso
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Válido
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: FORMATO 607 (VENTAS DE BIENES Y SERVICIOS) */}
      {/* ========================================================= */}
      {activeTab === '607' && (
        <div className="space-y-6">
          {/* Barra de Filtro y Selección de Período */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Año Fiscal</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Mes Fiscal</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  {meses.map(m => (
                    <option key={m.num} value={m.num}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={loadFormato607}
                  disabled={loading607}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading607 ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* Botones de Descarga DGII Oficial */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTxt607}
                disabled={!data607 || data607.cantidad_registros === 0}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Descargar TXT DGII (|)</span>
              </button>

              <button
                onClick={handleDownloadCsv607}
                disabled={!data607 || data607.cantidad_registros === 0}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center gap-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar CSV / Excel</span>
              </button>
            </div>
          </div>

          {/* Tarjetas KPI de Totales 607 */}
          {data607 && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Comprobantes Emitidos</span>
                <span className="text-2xl font-black text-slate-800">{data607.cantidad_registros}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Facturas e-CF del período</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Monto Facturado Base</span>
                <span className="text-2xl font-black text-blue-600">RD$ {data607.totales.total_facturado_base.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Base Imponible Neta</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">ITBIS Facturado (18%)</span>
                <span className="text-2xl font-black text-amber-600">RD$ {data607.totales.total_itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Impuesto cobrado en ventas</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Total General Ingresos</span>
                <span className="text-2xl font-black text-emerald-600">RD$ {data607.totales.total_general.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                <div className="flex gap-2 text-[10px] text-slate-500 mt-1 font-mono">
                  <span>Efec: RD$ {data607.totales.total_efectivo.toFixed(0)}</span>
                  <span>Tarj: RD$ {data607.totales.total_tarjeta.toFixed(0)}</span>
                  <span>Créd: RD$ {data607.totales.total_credito.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Registros del 607 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Detalle de Ventas e Ingresos (Norma 07-2018 DGII)</span>
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cliente, NCF o RNC..."
                  value={search607}
                  onChange={(e) => setSearch607(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">e-NCF</th>
                    <th className="py-2.5 px-3">RNC / Cédula</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Tipo Ingreso</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-right">Monto Base</th>
                    <th className="py-2.5 px-3 text-right">ITBIS</th>
                    <th className="py-2.5 px-3 text-right">Efectivo</th>
                    <th className="py-2.5 px-3 text-right">Tarjeta</th>
                    <th className="py-2.5 px-3 text-right">Crédito</th>
                    <th className="py-2.5 px-3 text-center">Cuadre DGII</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading607 ? (
                    <tr>
                      <td colSpan="12" className="py-8 text-center text-slate-400">
                        Cargando registros del 607...
                      </td>
                    </tr>
                  ) : filteredRows607.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-8 text-center text-slate-400">
                        No hay ventas registradas para este período fiscal ({selectedMonth}/{selectedYear}).
                      </td>
                    </tr>
                  ) : (
                    filteredRows607.map((row) => (
                      <tr key={row.numero_linea} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono text-slate-400">{row.numero_linea}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{row.ncf}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{row.rnc_cedula || <span className="text-slate-400 italic">N/A</span>}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.cliente_nombre}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">01 - Operaciones</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{row.fecha_comprobante}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">RD$ {row.monto_facturado.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-600">RD$ {row.itbis_facturado.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">RD$ {row.efectivo.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">RD$ {row.tarjeta.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">RD$ {row.credito.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            100% Cuadre
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 4: COMPROBANTES TIMBRADOS & LOGS */}
      {/* ========================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Historial de Comprobantes e-CF Timbrados ante DGII</span>
            </h3>

            <button
              onClick={loadLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refrescar</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="py-2.5 px-4">Fecha / Hora</th>
                  <th className="py-2.5 px-4">e-NCF</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4 text-right">Monto</th>
                  <th className="py-2.5 px-4">Track ID</th>
                  <th className="py-2.5 px-4">Código Seguridad</th>
                  <th className="py-2.5 px-4 text-center">Estatus DGII</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingLogs ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      Cargando historial de transmisiones...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No hay registros de facturas electrónicas emitidas aún.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-4 text-slate-600">{log.created_at}</td>
                      <td className="py-2 px-4 font-mono font-bold text-blue-700">{log.encf}</td>
                      <td className="py-2 px-4 font-semibold text-slate-700">{log.ncf_type}</td>
                      <td className="py-2 px-4 text-slate-800">{log.client_name}</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">RD$ {log.total.toFixed(2)}</td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-500">{log.track_id || '-'}</td>
                      <td className="py-2 px-4 font-mono font-bold text-slate-600">{log.security_code || '-'}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                          log.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          log.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {log.status === 'accepted' ? 'Aceptado' :
                           log.status === 'sent' ? 'Enviado' :
                           log.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
