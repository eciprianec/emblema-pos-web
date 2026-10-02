import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  DollarSign, 
  History, 
  CreditCard, 
  CheckCircle, 
  X, 
  Printer, 
  AlertCircle 
} from 'lucide-react';
import { clientesApi } from '../api';

export default function Clientes({ storeSettings }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [movements, setMovements] = useState([]);

  // Modales
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAbonoReceipt, setShowAbonoReceipt] = useState(false);
  const [lastAbono, setLastAbono] = useState(null);

  // Formulario nuevo cliente
  const [formData, setFormData] = useState({
    name: '',
    rnc_cedula: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 5000.0
  });

  // Formulario de Abono
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await clientesApi.getAll(search);
      setClients(res.data);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [search]);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await clientesApi.create(formData);
      setShowNewModal(false);
      setFormData({
        name: '',
        rnc_cedula: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: 5000.0
      });
      fetchClients();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al crear cliente");
    }
  };

  const handleOpenAbono = (client) => {
    setSelectedClient(client);
    setAbonoAmount('');
    setAbonoNotes('');
    setShowAbonoModal(true);
  };

  const handleProcessAbono = async (e) => {
    e.preventDefault();
    const amount = parseFloat(abonoAmount);
    if (!amount || amount <= 0) {
      alert("Ingrese un monto válido para el abono");
      return;
    }

    try {
      const res = await clientesApi.registrarAbono(selectedClient.id, {
        amount,
        notes: abonoNotes
      });
      setLastAbono({
        client: selectedClient,
        amount,
        notes: abonoNotes,
        previous_balance: res.data.previous_balance,
        new_balance: res.data.new_balance,
        date: new Date()
      });
      setShowAbonoModal(false);
      setShowAbonoReceipt(true);
      fetchClients();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al registrar abono");
    }
  };

  const handleOpenHistory = async (client) => {
    setSelectedClient(client);
    try {
      const res = await clientesApi.getEstadoCuenta(client.id);
      setMovements(res.data);
      setShowHistoryModal(true);
    } catch (err) {
      alert("Error al cargar estado de cuenta");
    }
  };

  const formatRD = (val) => {
    return Number(val || 0).toLocaleString('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    });
  };

  const totalDeudaGeneral = clients.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>F2: Clientes & Crédito ("El Fiado")</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Administra tus cuentas por cobrar, límites de crédito y abonos con comprobantes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
            <span className="text-slate-500 block">Deuda Total por Cobrar:</span>
            <strong className="text-base text-indigo-700 font-mono">{formatRD(totalDeudaGeneral)}</strong>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente por nombre, RNC / Cédula o teléfono..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-600 shadow-sm"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
      </div>

      {/* Lista de Clientes en Tarjetas / Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Cliente / Razón Social</th>
                <th className="px-5 py-3">RNC / Cédula</th>
                <th className="px-5 py-3">Teléfono / Contacto</th>
                <th className="px-5 py-3 text-right">Límite Crédito</th>
                <th className="px-5 py-3 text-right">Deuda Actual</th>
                <th className="px-5 py-3 text-right">Disponible</th>
                <th className="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length > 0 ? (
                clients.map((c) => {
                  const disponible = (c.credit_limit || 0) - (c.current_balance || 0);
                  const tieneDeuda = (c.current_balance || 0) > 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {c.name}
                        {c.address && <p className="text-[11px] font-normal text-slate-400">{c.address}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">{c.rnc_cedula || 'N/A'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{c.phone || 'N/A'}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-700">{formatRD(c.credit_limit)}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">
                        <span className={tieneDeuda ? 'text-rose-600' : 'text-slate-400'}>
                          {formatRD(c.current_balance)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-600">
                        {formatRD(disponible)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenAbono(c)}
                            disabled={!tieneDeuda}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition disabled:opacity-30 disabled:pointer-events-none"
                            title="Registrar Abono a la deuda"
                          >
                            Abonar RD$
                          </button>
                          <button
                            onClick={() => handleOpenHistory(c)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Ver Estado de Cuenta / Historial"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center text-slate-400">
                    No se encontraron clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Cliente */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Registrar Nuevo Cliente</span>
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Completo o Razón Social *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Colmado Don Pedro"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RNC o Cédula</label>
                  <input
                    type="text"
                    value={formData.rnc_cedula}
                    onChange={(e) => setFormData({ ...formData, rnc_cedula: e.target.value })}
                    placeholder="Ej: 101889977"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="809-555-0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Límite de Crédito Permitido (RD$)</label>
                <input
                  type="number"
                  step="100"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle, sector, ciudad"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Abono */}
      {showAbonoModal && selectedClient && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <span>Registrar Abono a Cuenta</span>
              </h3>
              <button onClick={() => setShowAbonoModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessAbono} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="font-bold text-slate-800 text-sm">{selectedClient.name}</p>
                <div className="flex justify-between text-slate-600">
                  <span>Deuda Actual:</span>
                  <span className="font-bold text-rose-600 font-mono">{formatRD(selectedClient.current_balance)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto del Abono (RD$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  placeholder={`Máximo: ${selectedClient.current_balance}`}
                  className="w-full px-3 py-2 border-2 border-emerald-400 rounded-xl text-base font-bold text-right focus:outline-none focus:border-emerald-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Comentario o Referencia (Opcional)</label>
                <input
                  type="text"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  placeholder="Ej: Pago en efectivo / Transferencia Banreservas"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowAbonoModal(false)}
                  className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recibo de Abono para Impresión */}
      {showAbonoReceipt && lastAbono && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold">Comprobante de Abono</span>
              <button onClick={() => setShowAbonoReceipt(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50">
              <div id="ticket-print-area" className="bg-white p-4 border border-dashed border-slate-300 rounded font-mono text-[11px] leading-tight space-y-2 text-black">
                <div className="text-center pb-2 border-b">
                  <h4 className="font-extrabold text-sm">{storeSettings?.store_name || 'EMBLEMA POS'}</h4>
                  <p className="text-[10px]">RECIBO DE ABONO / PAGO DE CUENTA</p>
                  <p>{new Date().toLocaleString()}</p>
                </div>

                <div className="space-y-1">
                  <p><strong>Cliente:</strong> {lastAbono.client.name}</p>
                  <p><strong>RNC/Céd:</strong> {lastAbono.client.rnc_cedula || 'N/A'}</p>
                  <p className="border-t pt-1"><strong>Balance Anterior:</strong> {formatRD(lastAbono.previous_balance)}</p>
                  <p className="text-emerald-700 text-sm font-extrabold"><strong>MONTO ABONADO:</strong> {formatRD(lastAbono.amount)}</p>
                  <p className="border-t pt-1"><strong>NUEVO BALANCE:</strong> {formatRD(lastAbono.new_balance)}</p>
                  {lastAbono.notes && <p className="text-[10px] text-slate-600">Nota: {lastAbono.notes}</p>}
                </div>

                <div className="pt-4 border-t text-center text-[10px] text-slate-500">
                  <p>Firma del Cliente: __________________</p>
                  <p className="mt-2">¡Gracias por mantener su crédito al día!</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 flex gap-2 border-t">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo</span>
              </button>
              <button
                onClick={() => setShowAbonoReceipt(false)}
                className="px-3 py-2 bg-slate-300 text-slate-700 rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial / Estado de Cuenta */}
      {showHistoryModal && selectedClient && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">Estado de Cuenta: {selectedClient.name}</h3>
                <p className="text-xs text-slate-400">Balance Pendiente: {formatRD(selectedClient.current_balance)}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Movimiento</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                    <th className="px-4 py-2 text-right">Nuevo Balance</th>
                    <th className="px-4 py-2">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.length > 0 ? (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-500">
                          {new Date(m.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.type === 'abono' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {m.type === 'abono' ? 'ABONO' : 'CARGO / COMPRA'}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-right font-mono font-bold ${
                          m.type === 'abono' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {m.type === 'abono' ? '-' : '+'}{formatRD(m.amount)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-800 font-bold">
                          {formatRD(m.new_balance)}
                        </td>
                        <td className="px-4 py-2 text-slate-500 text-[11px]">{m.notes || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                        No hay movimientos registrados para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
