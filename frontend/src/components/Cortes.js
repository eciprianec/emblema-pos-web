import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  ArrowDownRight, 
  ArrowUpRight, 
  DollarSign, 
  Lock, 
  Unlock, 
  Printer, 
  History, 
  Clock, 
  AlertCircle, 
  X, 
  CheckCircle2 
} from 'lucide-react';
import { cortesApi } from '../api';

export default function Cortes({ storeSettings, cajaAbierta, onCajaStatusChange }) {
  const [sessionData, setSessionData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modales
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('entrada'); // 'entrada', 'salida'
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [corteReceiptData, setCorteReceiptData] = useState(null);

  // Formulario Apertura
  const [initialCash, setInitialCash] = useState('1000');
  const [openNotes, setOpenNotes] = useState('');

  // Formulario Movimiento F7/F8
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  // Formulario de Cierre / Arqueo Dominicano
  const [denominations, setDenominations] = useState({
    b2000: 0,
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 0,
    b50: 0,
    monedas: 0
  });
  const [closeNotes, setCloseNotes] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, histRes] = await Promise.all([
        cortesApi.getEstadoCaja(),
        cortesApi.getHistorial()
      ]);
      setSessionData(statusRes.data);
      setHistory(histRes.data);
      if (onCajaStatusChange) {
        onCajaStatusChange(statusRes.data.caja_abierta);
      }
    } catch (err) {
      console.error("Error al cargar estado de caja:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Calcular total contado con billetes dominicanos
  const totalCountedBills = 
    (denominations.b2000 * 2000) +
    (denominations.b1000 * 1000) +
    (denominations.b500 * 500) +
    (denominations.b200 * 200) +
    (denominations.b100 * 100) +
    (denominations.b50 * 50) +
    (parseFloat(denominations.monedas) || 0);

  const handleOpenCaja = async (e) => {
    e.preventDefault();
    try {
      await cortesApi.abrirCaja({
        initial_cash: parseFloat(initialCash) || 0,
        notes: openNotes
      });
      setShowOpenModal(false);
      loadStatus();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al abrir la caja");
    }
  };

  const handleProcessMovement = async (e) => {
    e.preventDefault();
    const amount = parseFloat(movementAmount);
    if (!amount || amount <= 0) {
      alert("Ingrese un monto válido");
      return;
    }
    if (!movementReason.trim()) {
      alert("Ingrese el motivo del movimiento");
      return;
    }

    try {
      await cortesApi.movimientoCaja({
        type: movementType,
        amount,
        reason: movementReason
      });
      setShowMovementModal(false);
      setMovementAmount('');
      setMovementReason('');
      loadStatus();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al registrar movimiento");
    }
  };

  const handleCloseCaja = async (e) => {
    e.preventDefault();
    try {
      const res = await cortesApi.cerrarCorte({
        final_cash_counted: totalCountedBills,
        notes: closeNotes,
        bills_breakdown: denominations
      });
      setCorteReceiptData(res.data);
      setShowCloseModal(false);
      setShowPrintModal(true);
      loadStatus();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al cerrar el corte de caja");
    }
  };

  const formatRD = (val) => {
    return Number(val || 0).toLocaleString('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-purple-600" />
            <span>F6: Cortes de Caja & Control de Turnos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Apertura de turno, entradas y salidas de efectivo, y arqueo ciego con denominaciones en Pesos Dominicanos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessionData?.caja_abierta ? (
            <>
              <button
                onClick={() => {
                  setMovementType('entrada');
                  setShowMovementModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200"
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                <span>F7 Entrada</span>
              </button>

              <button
                onClick={() => {
                  setMovementType('salida');
                  setShowMovementModal(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold border border-rose-200"
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span>F8 Salida</span>
              </button>

              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow"
              >
                <Lock className="w-4 h-4" />
                <span>Hacer Corte de Turno</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center space-x-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Nuevo Turno de Caja</span>
            </button>
          )}
        </div>
      </div>

      {/* ESTADO ACTUAL DEL TURNO EN VIVO */}
      {sessionData?.caja_abierta ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-semibold text-slate-400">Fondo Inicial en Caja</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono">
                {formatRD(sessionData.session.initial_cash)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Efectivo para dar cambio al abrir</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-semibold text-slate-400">Ventas en Efectivo</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                {formatRD(sessionData.resumen.ventas_efectivo)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{sessionData.resumen.total_tickets} tickets cobrados</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-semibold text-slate-400">Entradas / Salidas</span>
              <div className="flex items-center gap-3 mt-2 font-mono">
                <span className="text-emerald-700 font-bold text-sm">+{formatRD(sessionData.resumen.entradas)}</span>
                <span className="text-rose-700 font-bold text-sm">-{formatRD(sessionData.resumen.salidas)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Movimientos varios de efectivo</p>
            </div>

            <div className="bg-purple-900 text-white p-5 rounded-2xl shadow-md">
              <span className="text-xs uppercase font-semibold text-purple-200">Total Esperado en Caja</span>
              <h3 className="text-2xl font-black mt-2 font-mono text-purple-100">
                {formatRD(sessionData.resumen.efectivo_esperado)}
              </h3>
              <p className="text-xs text-purple-300 mt-1">Debe haber físicamente en el cajón</p>
            </div>
          </div>

          {/* Tabla de Movimientos del Turno Actual */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs">Entradas y Salidas de Efectivo (F7/F8)</h3>
              <span className="text-xs text-slate-500">
                Turno iniciado: {new Date(sessionData.session.opened_at).toLocaleTimeString()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr>
                    <th className="px-5 py-3">Hora</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3 text-right">Monto</th>
                    <th className="px-5 py-3">Concepto / Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionData.movements && sessionData.movements.length > 0 ? (
                    sessionData.movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-slate-500">
                          {new Date(m.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.type === 'entrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {m.type.toUpperCase()}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-right font-mono font-bold ${
                          m.type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {m.type === 'entrada' ? '+' : '-'}{formatRD(m.amount)}
                        </td>
                        <td className="px-5 py-3 text-slate-700">{m.reason}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-400">
                        No hay movimientos manuales de efectivo registrados en este turno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Caja Registradora Cerrada</h3>
          <p className="text-xs text-slate-500">
            Para poder emitir ventas, registrar ingresos y controlar el dinero en efectivo, debes iniciar un nuevo turno de caja.
          </p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
          >
            Abrir Turno Ahora
          </button>
        </div>
      )}

      {/* HISTORIAL DE CORTES ANTERIORES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-4 bg-slate-50 border-b">
          <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" />
            <span>Historial de Cortes de Turno Realizados</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-5 py-3">Turno #</th>
                <th className="px-5 py-3">Cajero</th>
                <th className="px-5 py-3">Apertura</th>
                <th className="px-5 py-3">Cierre</th>
                <th className="px-5 py-3 text-right">Efectivo Esperado</th>
                <th className="px-5 py-3 text-right">Efectivo Contado</th>
                <th className="px-5 py-3 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => {
                const diff = (h.cash_difference || 0);
                const hasDiff = Math.abs(diff) > 0.01;
                return (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-bold text-slate-700">#{h.id}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{h.cashier_name || 'Cajero'}</td>
                    <td className="px-5 py-3 font-mono text-slate-500">{new Date(h.opened_at).toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-slate-500">
                      {h.closed_at ? new Date(h.closed_at).toLocaleString() : 'En curso'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                      {formatRD(h.expected_cash)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                      {formatRD(h.final_cash_counted)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-extrabold">
                      {!hasDiff ? (
                        <span className="text-emerald-600">Exacto ($0.00)</span>
                      ) : diff > 0 ? (
                        <span className="text-blue-600">+{formatRD(diff)} (Sobrante)</span>
                      ) : (
                        <span className="text-rose-600">{formatRD(diff)} (Faltante)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Apertura de Caja */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Unlock className="w-5 h-5" />
                <span>Abrir Turno de Caja</span>
              </h3>
              <button onClick={() => setShowOpenModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenCaja} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fondo Inicial en Efectivo (RD$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  placeholder="Ej: 1000.00"
                  className="w-full px-4 py-2.5 border-2 border-emerald-400 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:border-emerald-600 text-right"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">Monto que hay en la gaveta para iniciar el día.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas de Apertura (Opcional)</label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Ej: Turno matutino"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow"
                >
                  Confirmar Apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento Manual F7/F8 */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className={`px-5 py-4 text-white flex items-center justify-between ${
              movementType === 'entrada' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                {movementType === 'entrada' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                <span>{movementType === 'entrada' ? 'F7: Entrada de Dinero a Caja' : 'F8: Salida de Dinero de Caja'}</span>
              </h3>
              <button onClick={() => setShowMovementModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessMovement} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto en RD$ *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-xl text-base font-bold text-right focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo o Justificación *</label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder={movementType === 'entrada' ? "Ej: Cambio adicional traído del banco" : "Ej: Pago de almuerzo / delivery"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-lg font-bold shadow ${
                    movementType === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cierre de Corte con Arqueo Dominicano de Billetes */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  <span>Corte de Turno & Arqueo Ciego</span>
                </h3>
                <p className="text-xs text-slate-400">Ingresa la cantidad de billetes contados en el cajón.</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseCaja} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Tabla de Conteo Físico por Denominación */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-800 block text-xs uppercase">
                  Desglose de Efectivo (Pesos Dominicanos):
                </span>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'b2000', label: 'Billetes de RD$2,000', val: 2000 },
                    { key: 'b1000', label: 'Billetes de RD$1,000', val: 1000 },
                    { key: 'b500', label: 'Billetes de RD$500', val: 500 },
                    { key: 'b200', label: 'Billetes de RD$200', val: 200 },
                    { key: 'b100', label: 'Billetes de RD$100', val: 100 },
                    { key: 'b50', label: 'Billetes de RD$50', val: 50 }
                  ].map((denom) => (
                    <div key={denom.key} className="flex items-center justify-between gap-2 bg-white p-2 border rounded-lg">
                      <span className="font-bold text-slate-700">{denom.label}</span>
                      <input
                        type="number"
                        min="0"
                        value={denominations[denom.key] || ''}
                        onChange={(e) => setDenominations({
                          ...denominations,
                          [denom.key]: parseInt(e.target.value) || 0
                        })}
                        placeholder="0"
                        className="w-16 px-2 py-1 text-right font-bold border border-slate-300 rounded"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 bg-white p-2 border rounded-lg">
                  <span className="font-bold text-slate-700">Monedas y monedas sueltas (Total RD$):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={denominations.monedas || ''}
                    onChange={(e) => setDenominations({
                      ...denominations,
                      monedas: parseFloat(e.target.value) || 0
                    })}
                    placeholder="RD$0.00"
                    className="w-24 px-2 py-1 text-right font-bold border border-slate-300 rounded"
                  />
                </div>

                {/* Total Contado en Vivo */}
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-purple-900 text-xs">TOTAL FÍSICO CONTADO:</span>
                  <span className="text-xl font-black text-purple-900 font-mono">
                    {formatRD(totalCountedBills)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas del Corte / Observaciones</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Turno entregado a María"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow text-xs"
                >
                  Cerrar Turno & Imprimir Corte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recibo del Corte para Impresión Térmica */}
      {showPrintModal && corteReceiptData && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold">Ticket de Corte de Turno</span>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50">
              <div id="ticket-print-area" className="bg-white p-4 border border-dashed border-slate-300 rounded font-mono text-[11px] leading-tight space-y-2 text-black">
                <div className="text-center pb-2 border-b">
                  <h4 className="font-extrabold text-sm">{storeSettings?.store_name || 'EMBLEMA POS'}</h4>
                  <p className="text-[10px]">CORTE DE CAJA / AUDITORÍA DE TURNO</p>
                  <p>Turno #{corteReceiptData.session_id}</p>
                </div>

                <div className="space-y-0.5 text-[10px] border-b pb-1.5">
                  <p>Cajero: {corteReceiptData.cashier_name || 'Cajero'}</p>
                  <p>Apertura: {new Date(corteReceiptData.opened_at).toLocaleString()}</p>
                  <p>Cierre: {new Date(corteReceiptData.closed_at).toLocaleString()}</p>
                </div>

                <div className="space-y-1 text-[11px] border-b pb-2">
                  <div className="flex justify-between">
                    <span>Fondo Inicial:</span>
                    <span>{formatRD(corteReceiptData.initial_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventas Efectivo:</span>
                    <span>+{formatRD(corteReceiptData.sales_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entradas Efectivo:</span>
                    <span>+{formatRD(corteReceiptData.cash_entries)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Salidas Efectivo:</span>
                    <span>-{formatRD(corteReceiptData.cash_exits)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total Esperado:</span>
                    <span>{formatRD(corteReceiptData.expected_cash)}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] border-b pb-2 font-bold">
                  <div className="flex justify-between text-purple-900">
                    <span>Efectivo Contado:</span>
                    <span>{formatRD(corteReceiptData.final_cash_counted)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>DIFERENCIA:</span>
                    <span className={corteReceiptData.cash_difference < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatRD(corteReceiptData.cash_difference)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 text-center text-[10px] text-slate-500">
                  <p>Firma Cajero: __________________</p>
                  <p className="mt-2">Firma Supervisor: __________________</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 flex gap-2 border-t">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-purple-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Corte</span>
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-3 py-2 bg-slate-300 text-slate-700 rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
