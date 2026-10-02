import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Printer, 
  Receipt,
  Scale, 
  Sliders, 
  DollarSign, 
  Mail, 
  HardDrive, 
  Users, 
  UserPlus, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  Check, 
  X, 
  Eye, 
  Send
} from 'lucide-react';
import { configApi } from '../api';

export default function Configuracion({ onStoreUpdate }) {
  const [activeTab, setActiveTab] = useState('negocio');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Formulario completo de StoreSettings
  const [storeForm, setStoreForm] = useState({
    store_name: 'Emblema POS',
    slogan: 'Soluciones de Punto de Venta Inteligente',
    rnc: '101010101',
    phone: '809-555-0000',
    whatsapp: '809-555-0000',
    email: 'contacto@ciberemblema.com',
    address: 'Av. Winston Churchill #45, Plaza Central, Santo Domingo',
    currency_symbol: 'RD$',
    currency_name: 'Pesos Dominicanos',
    ticket_header: '¡GRACIAS POR PREFERIRNOS!\nCalidad y servicio garantizado.',
    ticket_footer: 'Conserve este ticket para reclamos.\nNo se aceptan cambios pasadas 48 horas.',
    printer_width: 80,
    printer_copies: 1,
    auto_print_ticket: true,
    show_logo_on_ticket: true,
    show_cashier_on_ticket: true,
    show_tax_details: true,
    show_dgii_qr: true,
    font_size: 'normal',
    auto_open_drawer: true,
    drawer_on_cash_sale: true,
    drawer_on_movement: true,
    scale_enabled: false,
    scale_model: 'Torrey / Rhino',
    scale_port: 'COM1',
    barcode_scanner_beep: true,
    allow_sales_without_stock: true,
    warn_low_stock_on_sale: true,
    ask_confirm_delete_item: false,
    costing_method: 'last_cost',
    prices_include_tax: true,
    accept_cash: true,
    accept_card: true,
    accept_transfer: true,
    accept_credit: true,
    email_corte_notification: false,
    corte_notification_email: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: ''
  });

  // Cajeros y Permisos
  const [users, setUsers] = useState([]);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'cajero',
    can_discount: true,
    can_view_costs: false,
    can_modify_inventory: false,
    can_corte: true,
    can_cancel_sales: false,
    can_change_prices: false,
    can_manage_clients: true,
    can_view_reports: false,
    can_access_config: false
  });

  // Acciones de Mantenimiento y Báscula
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [scaleTestWeight, setScaleTestWeight] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [storeRes, usersRes] = await Promise.all([
        configApi.getStore(),
        configApi.getUsers()
      ]);
      if (storeRes.data) {
        setStoreForm(prev => ({ ...prev, ...storeRes.data }));
      }
      if (usersRes.data) {
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error("Error al cargar configuración:", err);
      setErrorMessage("No se pudo cargar la configuración del sistema");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveStore = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');
    try {
      const res = await configApi.updateStore(storeForm);
      setSaveSuccess(true);
      if (onStoreUpdate && res.data?.settings) {
        onStoreUpdate(res.data.settings);
      }
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || "Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await configApi.createUser(newUser);
      setShowNewUserModal(false);
      setNewUser({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'cajero',
        can_discount: true,
        can_view_costs: false,
        can_modify_inventory: false,
        can_corte: true,
        can_cancel_sales: false,
        can_change_prices: false,
        can_manage_clients: true,
        can_view_reports: false,
        can_access_config: false
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al crear usuario");
    }
  };

  const handleToggleUserPermission = async (userId, permKey, currentValue) => {
    try {
      const updated = { [permKey]: !currentValue };
      await configApi.updateUser(userId, updated);
      setUsers(users.map(u => u.id === userId ? { ...u, ...updated } : u));
    } catch (err) {
      alert("Error al actualizar permiso");
    }
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al cajero "${user.full_name}" (@${user.username})?`)) {
      try {
        await configApi.deleteUser(user.id);
        setUsers(users.filter(u => u.id !== user.id));
      } catch (err) {
        alert(err.response?.data?.detail || "No se pudo eliminar el usuario");
      }
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const response = await configApi.downloadBackup();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `emblemapos_backup_${dateStr}.db`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Error al descargar respaldo de base de datos");
    }
  };

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      alert("Seleccione un archivo .db primero");
      return;
    }
    if (!window.confirm("¡ATENCIÓN! Restaurar una base de datos sobreescribirá los datos actuales del sistema. ¿Desea continuar?")) {
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      const res = await configApi.restoreBackup(formData);
      alert(res.data?.message || "Base de datos restaurada correctamente");
      setRestoreFile(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al restaurar base de datos");
    } finally {
      setRestoring(false);
    }
  };

  const handleOptimizeDb = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const res = await configApi.optimizeDatabase();
      setOptimizeResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Error optimizando base de datos");
    } finally {
      setOptimizing(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailResult(null);
    try {
      const res = await configApi.testEmail();
      setEmailResult({ success: true, message: res.data.message });
    } catch (err) {
      setEmailResult({ 
        success: false, 
        message: err.response?.data?.detail || "Error al conectar con servidor SMTP" 
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSimulateScale = () => {
    const weights = [0.450, 0.780, 1.250, 2.340, 0.920, 3.110];
    const randomWeight = weights[Math.floor(Math.random() * weights.length)];
    setScaleTestWeight(randomWeight);
  };

  const handlePrintTestTicket = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    const widthStyle = storeForm.printer_width === 58 ? 'width: 58mm;' : 'width: 80mm;';
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket de Prueba - ${storeForm.store_name}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              ${widthStyle}
              margin: 0 auto;
              padding: 10px;
              font-size: ${storeForm.font_size === 'compact' ? '11px' : '13px'};
              color: #000;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center">
            ${storeForm.show_logo_on_ticket ? '<div class="bold" style="font-size:16px;">[ LOGO EMPRESA ]</div>' : ''}
            <div class="bold" style="font-size: 15px;">${storeForm.store_name}</div>
            <div>${storeForm.slogan}</div>
            <div>RNC: ${storeForm.rnc}</div>
            <div>Tel: ${storeForm.phone}</div>
            <div>${storeForm.address}</div>
            <div class="divider"></div>
            <div>${storeForm.ticket_header.replace(/\n/g, '<br/>')}</div>
            <div class="divider"></div>
          </div>
          <div>Ticket: #00001 (DEMO)</div>
          <div>Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
          ${storeForm.show_cashier_on_ticket ? '<div>Cajero: Administrador</div>' : ''}
          <div class="divider"></div>
          <div>1x Refresco Coca Cola 20oz ....... $50.00</div>
          <div>2x Pan de Agua ................... $20.00</div>
          <div>1x Queso Holandés (0.500 kg) ..... $175.00</div>
          <div class="divider"></div>
          <div class="right">Subtotal: $245.00</div>
          ${storeForm.show_tax_details ? '<div class="right">ITBIS (18%): $44.10</div>' : ''}
          <div class="right bold" style="font-size:14px;">TOTAL: $245.00</div>
          <div class="right">Efectivo Recibido: $500.00</div>
          <div class="right">Cambio: $255.00</div>
          <div class="divider"></div>
          <div class="center">
            ${storeForm.show_dgii_qr ? '<div>[ CÓDIGO QR DGII e-CF ]<br/><small>E320000000001</small></div><div class="divider"></div>' : ''}
            <div>${storeForm.ticket_footer.replace(/\n/g, '<br/>')}</div>
            <div style="margin-top:10px; font-size:10px;">*** TICKET DE PRUEBA EXITOSO ***</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const tabs = [
    { id: 'negocio', label: 'Datos del Negocio', icon: Store },
    { id: 'cajeros', label: 'Cajeros y Permisos', icon: Users },
    { id: 'impresora', label: 'Impresora de Tickets', icon: Printer },
    { id: 'ticket', label: 'Personalización Ticket', icon: Receipt },
    { id: 'dispositivos', label: 'Cajón & Báscula', icon: Scale },
    { id: 'comportamiento', label: 'Comportamiento Venta', icon: Sliders },
    { id: 'pagos', label: 'Moneda & Formas de Pago', icon: DollarSign },
    { id: 'notificaciones', label: 'Notificaciones Correo', icon: Mail },
    { id: 'mantenimiento', label: 'Respaldos & BD', icon: HardDrive }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-slate-600 font-bold">Cargando opciones de configuración de Emblema POS...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Principal */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <span>Configuración del Sistema Emblema POS</span>
              <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-full">F9</span>
            </h2>
            <p className="text-xs text-slate-500">
              Personaliza todos los parámetros operativos, hardware, comprobantes fiscales, cajeros y copias de seguridad.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-emerald-200">
              <CheckCircle className="w-4 h-4" />
              <span>¡Configuración Guardada!</span>
            </span>
          )}
          {errorMessage && (
            <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-rose-200">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </span>
          )}
          <button
            onClick={handleSaveStore}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando Cambios...' : 'Guardar Todo (F9)'}</span>
          </button>
        </div>
      </div>

      {/* Contenedor con Menú Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Barra Lateral de Secciones */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            Módulos de Configuración
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition text-left ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="flex-1">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel Central con el Contenido de la Pestaña Activa */}
        <div className="lg:col-span-3">
          {/* TAB 1: DATOS DEL NEGOCIO */}
          {activeTab === 'negocio' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <Store className="w-5 h-5 text-blue-600" />
                  <span>Datos de la Empresa / Mi Negocio</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Información principal que aparece en las facturas, comprobantes fiscales e impresiones.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nombre Comercial de la Empresa *</label>
                  <input
                    type="text"
                    required
                    value={storeForm.store_name}
                    onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lema o Slogan del Negocio</label>
                  <input
                    type="text"
                    value={storeForm.slogan}
                    onChange={(e) => setStoreForm({ ...storeForm, slogan: e.target.value })}
                    placeholder="Ej: La mejor atención y calidad para ti"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">RNC o Cédula Fiscal *</label>
                  <input
                    type="text"
                    required
                    value={storeForm.rnc}
                    onChange={(e) => setStoreForm({ ...storeForm, rnc: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono Principal</label>
                  <input
                    type="text"
                    value={storeForm.phone}
                    onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp de Contacto</label>
                  <input
                    type="text"
                    value={storeForm.whatsapp}
                    onChange={(e) => setStoreForm({ ...storeForm, whatsapp: e.target.value })}
                    placeholder="809-555-0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Correo Electrónico Comercial</label>
                  <input
                    type="email"
                    value={storeForm.email}
                    onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Dirección del Establecimiento</label>
                  <input
                    type="text"
                    value={storeForm.address}
                    onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAJEROS & PERMISOS */}
          {activeTab === 'cajeros' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span>Cajeros & Matriz de Permisos Granulares</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define con precisión qué acciones puede realizar cada cajero en el punto de venta.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewUserModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Cajero</span>
                </button>
              </div>

              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                          {user.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800">{user.full_name}</span>
                            <span className="text-xs text-slate-400 font-mono">(@{user.username})</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.role?.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">{user.email}</span>
                        </div>
                      </div>

                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Matriz de Permisos */}
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_discount}
                          onChange={() => handleToggleUserPermission(user.id, 'can_discount', user.can_discount)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Aplicar descuentos al cobrar</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_change_prices}
                          onChange={() => handleToggleUserPermission(user.id, 'can_change_prices', user.can_change_prices)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Modificar precio en venta</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_view_costs}
                          onChange={() => handleToggleUserPermission(user.id, 'can_view_costs', user.can_view_costs)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Ver costos y ganancias</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_modify_inventory}
                          onChange={() => handleToggleUserPermission(user.id, 'can_modify_inventory', user.can_modify_inventory)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Modificar inventario</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_corte}
                          onChange={() => handleToggleUserPermission(user.id, 'can_corte', user.can_corte)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Hacer corte de caja (F6)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_cancel_sales}
                          onChange={() => handleToggleUserPermission(user.id, 'can_cancel_sales', user.can_cancel_sales)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Cancelar tickets cobrados</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_manage_clients}
                          onChange={() => handleToggleUserPermission(user.id, 'can_manage_clients', user.can_manage_clients)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Manejar créditos & fiado</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_view_reports}
                          onChange={() => handleToggleUserPermission(user.id, 'can_view_reports', user.can_view_reports)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700">Ver reportes de ventas</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={user.can_access_config}
                          onChange={() => handleToggleUserPermission(user.id, 'can_access_config', user.can_access_config)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-slate-700 font-bold text-amber-700">Acceso a Configuración</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: IMPRESORA DE TICKETS */}
          {activeTab === 'impresora' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-indigo-600" />
                    <span>Configuración de la Impresora de Tickets</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ajuste el formato físico de papel térmico, cantidad de copias y envío automático.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintTestTicket}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Ticket de Prueba</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ancho de Papel de Ticket</label>
                  <select
                    value={storeForm.printer_width}
                    onChange={(e) => setStoreForm({ ...storeForm, printer_width: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value={80}>80 milímetros (Recomendado - Ticket Estándar)</option>
                    <option value={58}>58 milímetros (Mini Impresora Térmica)</option>
                  </select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    80mm permite imprimir tablas de detalle claras con QR fiscal de DGII.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número de Copias por Venta</label>
                  <select
                    value={storeForm.printer_copies}
                    onChange={(e) => setStoreForm({ ...storeForm, printer_copies: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value={1}>1 copia (Solo cliente)</option>
                    <option value={2}>2 copias (Cliente + Archivo del Negocio)</option>
                    <option value={3}>3 copias</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tamaño de Fuente del Ticket</label>
                  <select
                    value={storeForm.font_size}
                    onChange={(e) => setStoreForm({ ...storeForm, font_size: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="normal">Normal (Lectura clara y estándar)</option>
                    <option value="compact">Compacto (Ahorra papel térmico)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.auto_print_ticket}
                      onChange={(e) => setStoreForm({ ...storeForm, auto_print_ticket: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Imprimir ticket automáticamente al cobrar la venta</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PERSONALIZACIÓN DEL TICKET */}
          {activeTab === 'ticket' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <span>Personalización del Ticket & Vista Previa en Vivo</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Redacta el membrete, políticas de garantía y activa elementos visuales con vista previa en tiempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulario de Textos y Toggles */}
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Encabezado / Mensaje Superior</label>
                    <textarea
                      rows="3"
                      value={storeForm.ticket_header}
                      onChange={(e) => setStoreForm({ ...storeForm, ticket_header: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pie de Página / Políticas de Devolución</label>
                    <textarea
                      rows="3"
                      value={storeForm.ticket_footer}
                      onChange={(e) => setStoreForm({ ...storeForm, ticket_footer: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={storeForm.show_logo_on_ticket}
                        onChange={(e) => setStoreForm({ ...storeForm, show_logo_on_ticket: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>Mostrar logotipo de la empresa en el ticket</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={storeForm.show_cashier_on_ticket}
                        onChange={(e) => setStoreForm({ ...storeForm, show_cashier_on_ticket: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>Mostrar nombre del cajero en turno</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={storeForm.show_tax_details}
                        onChange={(e) => setStoreForm({ ...storeForm, show_tax_details: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>Desglosar detalle de impuestos fiscales (ITBIS 18%)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={storeForm.show_dgii_qr}
                        onChange={(e) => setStoreForm({ ...storeForm, show_dgii_qr: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>Imprimir Código QR de Factura Electrónica DGII (e-CF)</span>
                    </label>
                  </div>
                </div>

                {/* Vista Previa en Vivo del Ticket Térmico */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Simulador de Ticket Térmico ({storeForm.printer_width}mm)</span>
                  </span>

                  <div className="bg-amber-50/50 border-2 border-dashed border-slate-300 rounded-xl p-5 shadow-inner w-full max-w-[320px] font-mono text-[11px] text-slate-800 space-y-2 select-none">
                    <div className="text-center space-y-0.5">
                      {storeForm.show_logo_on_ticket && (
                        <div className="font-extrabold text-xs text-blue-700">[ LOGO EMPRESA ]</div>
                      )}
                      <div className="font-extrabold text-sm">{storeForm.store_name || 'MI NEGOCIO'}</div>
                      <div className="text-[10px] text-slate-600">{storeForm.slogan}</div>
                      <div>RNC: {storeForm.rnc}</div>
                      <div>Tel: {storeForm.phone}</div>
                      <div className="text-[10px]">{storeForm.address}</div>
                      <div className="border-t border-dashed border-slate-400 my-1.5" />
                      <div className="whitespace-pre-line text-[10px]">{storeForm.ticket_header}</div>
                      <div className="border-t border-dashed border-slate-400 my-1.5" />
                    </div>

                    <div>
                      <div>Ticket #: 0001-DEMO</div>
                      <div>Fecha: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
                      {storeForm.show_cashier_on_ticket && <div>Cajero: Juan Pérez</div>}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-1.5" />

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>1x Refresco 20oz</span>
                        <span>{storeForm.currency_symbol} 50.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2x Pan de Agua</span>
                        <span>{storeForm.currency_symbol} 20.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1x Jamón Cocido</span>
                        <span>{storeForm.currency_symbol} 150.00</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-1.5" />

                    <div className="space-y-0.5 text-right">
                      <div>Subtotal: {storeForm.currency_symbol} 220.00</div>
                      {storeForm.show_tax_details && (
                        <div>ITBIS (18%): {storeForm.currency_symbol} 39.60</div>
                      )}
                      <div className="font-extrabold text-xs text-slate-900">
                        TOTAL: {storeForm.currency_symbol} 220.00
                      </div>
                      <div>Efectivo: {storeForm.currency_symbol} 500.00</div>
                      <div>Cambio: {storeForm.currency_symbol} 280.00</div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-1.5" />

                    <div className="text-center space-y-1">
                      {storeForm.show_dgii_qr && (
                        <div className="p-2 border border-slate-400 rounded bg-white inline-block">
                          <div className="w-16 h-16 bg-slate-800 text-white flex items-center justify-center text-[8px] font-bold mx-auto">
                            QR DGII
                          </div>
                          <span className="text-[9px] font-bold block mt-0.5">e-NCF: E320000000001</span>
                        </div>
                      )}
                      <div className="whitespace-pre-line text-[10px] text-slate-600">
                        {storeForm.ticket_footer}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CAJÓN, BÁSCULA & DISPOSITIVOS */}
          {activeTab === 'dispositivos' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-600" />
                  <span>Cajón de Dinero, Báscula Electrónica & Periféricos</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conexión con cajón portamonedas RJ11, balanzas de pesaje en tiempo real y lector de código de barras.
                </p>
              </div>

              {/* Cajón de Dinero */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-xs text-slate-800 block">Apertura Automática del Cajón de Dinero</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.drawer_on_cash_sale}
                      onChange={(e) => setStoreForm({ ...storeForm, drawer_on_cash_sale: e.target.checked })}
                      className="rounded text-amber-600 w-4 h-4"
                    />
                    <span>Abrir al cobrar ventas en efectivo</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.drawer_on_movement}
                      onChange={(e) => setStoreForm({ ...storeForm, drawer_on_movement: e.target.checked })}
                      className="rounded text-amber-600 w-4 h-4"
                    />
                    <span>Abrir al registrar entradas o salidas (F7 / F8)</span>
                  </label>
                </div>
              </div>

              {/* Báscula Electrónica */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">Báscula para Productos a Granel (Kilos / Libras)</span>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-blue-600">
                    <input
                      type="checkbox"
                      checked={storeForm.scale_enabled}
                      onChange={(e) => setStoreForm({ ...storeForm, scale_enabled: e.target.checked })}
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>Habilitar Lectura de Báscula</span>
                  </label>
                </div>

                {storeForm.scale_enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Modelo / Protocolo</label>
                      <select
                        value={storeForm.scale_model}
                        onChange={(e) => setStoreForm({ ...storeForm, scale_model: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="Torrey / Rhino">Torrey PCR / Rhino BAR-8</option>
                        <option value="Ohaus">Ohaus Defender / Ranger</option>
                        <option value="CAS">CAS AP-1 / ER-Plus</option>
                        <option value="Toledo">Toledo / Mettler Toledo</option>
                        <option value="Generica">Protocolo Continuo Genérico</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Puerto de Comunicación</label>
                      <select
                        value={storeForm.scale_port}
                        onChange={(e) => setStoreForm({ ...storeForm, scale_port: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        <option value="COM1">COM1</option>
                        <option value="COM2">COM2</option>
                        <option value="COM3">COM3</option>
                        <option value="COM4">COM4</option>
                        <option value="USB-Serial">USB Serial (Virtual Port)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        onClick={handleSimulateScale}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Scale className="w-4 h-4" />
                        <span>Probar Conexión Báscula</span>
                      </button>
                    </div>

                    {scaleTestWeight !== null && (
                      <div className="sm:col-span-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800">
                        <span className="font-bold">¡Lectura exitosa del puerto {storeForm.scale_port}!</span>
                        <span className="font-black text-sm bg-white px-3 py-1 rounded border border-emerald-300 font-mono">
                          Peso recibido: {scaleTestWeight} kg
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lector de Código de Barras */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block">Lector de Código de Barras</span>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={storeForm.barcode_scanner_beep}
                    onChange={(e) => setStoreForm({ ...storeForm, barcode_scanner_beep: e.target.checked })}
                    className="rounded text-amber-600 w-4 h-4"
                  />
                  <span>Emitir sonido de confirmación al escanear código en la venta</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 6: COMPORTAMIENTO DE VENTA */}
          {activeTab === 'comportamiento' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-teal-600" />
                  <span>Comportamiento de Venta & Control de Inventario</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reglas de validación al agregar productos al ticket, alertas de existencias y cálculo de costos.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeForm.allow_sales_without_stock}
                      onChange={(e) => setStoreForm({ ...storeForm, allow_sales_without_stock: e.target.checked })}
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Permitir vender sin existencias (inventario negativo)</span>
                      <span className="text-slate-500 text-[11px]">
                        Si está marcado, podrás cobrar artículos aunque su existencia llegue a números negativos con advertencia.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeForm.warn_low_stock_on_sale}
                      onChange={(e) => setStoreForm({ ...storeForm, warn_low_stock_on_sale: e.target.checked })}
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Alertar cuando un producto alcance su stock mínimo</span>
                      <span className="text-slate-500 text-[11px]">
                        Muestra un aviso visual cuando la venta deja el producto en estado crítico.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeForm.ask_confirm_delete_item}
                      onChange={(e) => setStoreForm({ ...storeForm, ask_confirm_delete_item: e.target.checked })}
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Confirmar antes de eliminar un artículo del ticket</span>
                      <span className="text-slate-500 text-[11px]">
                        Evita eliminaciones accidentales de productos agregados en el módulo de ventas F1.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 block mb-1">Método de Valuación de Costos de Inventario</span>
                  <select
                    value={storeForm.costing_method}
                    onChange={(e) => setStoreForm({ ...storeForm, costing_method: e.target.value })}
                    className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="last_cost">Último Costo de Compra (Recomendado)</option>
                    <option value="average">Costo Promedio Ponderado</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: MONEDA & FORMAS DE PAGO */}
          {activeTab === 'pagos' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Símbolo de Moneda & Formas de Pago Aceptadas</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Establece la divisa oficial para República Dominicana y los métodos de pago habilitados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Símbolo de la Moneda *</label>
                  <input
                    type="text"
                    required
                    value={storeForm.currency_symbol}
                    onChange={(e) => setStoreForm({ ...storeForm, currency_symbol: e.target.value })}
                    placeholder="RD$"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nombre de la Moneda</label>
                  <input
                    type="text"
                    value={storeForm.currency_name}
                    onChange={(e) => setStoreForm({ ...storeForm, currency_name: e.target.value })}
                    placeholder="Pesos Dominicanos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <span className="font-bold text-slate-800 block">Formas de Pago Habilitadas en Ventas (F1 / F12 Cobrar)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.accept_cash}
                      onChange={(e) => setStoreForm({ ...storeForm, accept_cash: e.target.checked })}
                      className="rounded text-emerald-600 w-4 h-4"
                    />
                    <span>Efectivo (Con cálculo de cambio automático)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.accept_card}
                      onChange={(e) => setStoreForm({ ...storeForm, accept_card: e.target.checked })}
                      className="rounded text-emerald-600 w-4 h-4"
                    />
                    <span>Tarjeta de Crédito / Débito (Vía Verifone / Terminal)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.accept_transfer}
                      onChange={(e) => setStoreForm({ ...storeForm, accept_transfer: e.target.checked })}
                      className="rounded text-emerald-600 w-4 h-4"
                    />
                    <span>Transferencia Bancaria / Pago Móvil</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={storeForm.accept_credit}
                      onChange={(e) => setStoreForm({ ...storeForm, accept_credit: e.target.checked })}
                      className="rounded text-emerald-600 w-4 h-4"
                    />
                    <span>Crédito a Clientes ("El Fiado" con límite de crédito)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: NOTIFICACIONES POR CORREO */}
          {activeTab === 'notificaciones' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-sky-600" />
                  <span>Notificaciones de Corte de Turno por Correo (F6)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Envía un correo automático al dueño con el desglose de ventas, entradas y salidas al cerrar caja.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={storeForm.email_corte_notification}
                    onChange={(e) => setStoreForm({ ...storeForm, email_corte_notification: e.target.checked })}
                    className="rounded text-sky-600 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Enviar reporte de corte al cerrar turno automáticamente</span>
                    <span className="text-slate-500 text-[11px]">
                      Cada vez que un cajero haga corte F6, el sistema notificará inmediatamente al correo indicado.
                    </span>
                  </div>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Correo de Destino del Dueño / Gerente</label>
                    <input
                      type="email"
                      value={storeForm.corte_notification_email}
                      onChange={(e) => setStoreForm({ ...storeForm, corte_notification_email: e.target.value })}
                      placeholder="dueño@empresa.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Servidor SMTP (Host)</label>
                    <input
                      type="text"
                      value={storeForm.smtp_host}
                      onChange={(e) => setStoreForm({ ...storeForm, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Puerto SMTP</label>
                    <input
                      type="number"
                      value={storeForm.smtp_port}
                      onChange={(e) => setStoreForm({ ...storeForm, smtp_port: parseInt(e.target.value) || 587 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Usuario SMTP</label>
                    <input
                      type="text"
                      value={storeForm.smtp_user}
                      onChange={(e) => setStoreForm({ ...storeForm, smtp_user: e.target.value })}
                      placeholder="notificaciones@gmail.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contraseña de Aplicación SMTP</label>
                    <input
                      type="password"
                      value={storeForm.smtp_password}
                      onChange={(e) => setStoreForm({ ...storeForm, smtp_password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1.5 transition"
                  >
                    <Send className="w-4 h-4" />
                    <span>{testingEmail ? 'Probando Conexión SMTP...' : 'Enviar Correo de Prueba'}</span>
                  </button>

                  {emailResult && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                      emailResult.success 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {emailResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>{emailResult.message}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: RESPALDOS & MANTENIMIENTO */}
          {activeTab === 'mantenimiento' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-600" />
                  <span>Copias de Seguridad & Mantenimiento de la Base de Datos</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Descarga respaldos instantáneos, restaura copias previas y optimiza los índices de almacenamiento.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                {/* Descarga en 1 Clic */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="font-extrabold text-sm text-slate-800 block mb-1">
                      Descargar Respaldo
                    </span>
                    <p className="text-slate-500 text-[11px]">
                      Descarga una copia completa e idéntica de la base de datos SQLite (.db) con todas las ventas, productos y clientes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Copia (.db)</span>
                  </button>
                </div>

                {/* Restaurar Respaldo */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-3">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="font-extrabold text-sm text-slate-800 block mb-1">
                      Restaurar Base de Datos
                    </span>
                    <p className="text-slate-500 text-[11px] mb-2">
                      Selecciona un archivo .db para recuperar una copia de seguridad anterior.
                    </p>
                    <input
                      type="file"
                      accept=".db,.sqlite"
                      onChange={(e) => setRestoreFile(e.target.files[0])}
                      className="text-[10px] w-full text-slate-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreBackup}
                    disabled={restoring || !restoreFile}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold shadow flex items-center justify-center gap-1.5 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{restoring ? 'Restaurando...' : 'Aplicar Respaldo'}</span>
                  </button>
                </div>

                {/* Optimización y Compactación */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <span className="font-extrabold text-sm text-slate-800 block mb-1">
                      Optimizar Base de Datos
                    </span>
                    <p className="text-slate-500 text-[11px]">
                      Ejecuta VACUUM y REINDEX para defragmentar la base de datos y acelerar las búsquedas de productos.
                    </p>
                  </div>
                  <div>
                    {optimizeResult && (
                      <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[10px] font-bold">
                        Tamaño: {optimizeResult.size_kb} KB
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleOptimizeDb}
                      disabled={optimizing}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow flex items-center justify-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-4 h-4 ${optimizing ? 'animate-spin' : ''}`} />
                      <span>{optimizing ? 'Optimizando...' : 'Optimizar Ahora'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR NUEVO CAJERO */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <span>Nuevo Cajero / Usuario</span>
              </h3>
              <button 
                onClick={() => setShowNewUserModal(false)} 
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-3.5 text-xs max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="Ej: Marcos Almonte"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Usuario *</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="marcos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contraseña *</label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="marcos@empresa.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rol en el Sistema</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="cajero">Cajero (Operación de Punto de Venta)</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-2">Permisos Iniciales</span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.can_discount}
                      onChange={(e) => setNewUser({ ...newUser, can_discount: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>Aplicar descuentos en venta</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.can_change_prices}
                      onChange={(e) => setNewUser({ ...newUser, can_change_prices: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>Modificar precios al cobrar</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.can_corte}
                      onChange={(e) => setNewUser({ ...newUser, can_corte: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>Realizar corte de caja (F6)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.can_manage_clients}
                      onChange={(e) => setNewUser({ ...newUser, can_manage_clients: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>Administrar clientes y créditos (Fiado)</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
