import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Wallet, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  FileCheck, 
  ArrowRight,
  Package,
  PlusCircle,
  Receipt
} from 'lucide-react';
import { reportesApi, dgiiApi, clientesApi, inventariosApi } from '../api';

export default function Dashboard({ onNavigate, user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    ventas_hoy: 0,
    costo_hoy: 0,
    ganancia_hoy: 0,
    margen_hoy: 0,
    total_tickets_hoy: 0,
    ticket_promedio: 0,
    efectivo_en_caja: 0,
    ultimas_ventas: []
  });
  const [totalDeuda, setTotalDeuda] = useState(0);
  const [clientesDeudores, setClientesDeudores] = useState(0);
  const [bajoStockCount, setBajoStockCount] = useState(0);
  const [dgiiStatus, setDgiiStatus] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, deudaRes, stockRes, dgiiRes] = await Promise.allSettled([
        reportesApi.getDashboard(),
        clientesApi.getResumenDeuda(),
        inventariosApi.getBajoStock(),
        dgiiApi.getConfig()
      ]);

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value.data);
      }
      if (deudaRes.status === 'fulfilled') {
        setTotalDeuda(deudaRes.value.data.total_debt || 0);
        setClientesDeudores(deudaRes.value.data.clients_count || 0);
      }
      if (stockRes.status === 'fulfilled') {
        setBajoStockCount(stockRes.value.data.length || 0);
      }
      if (dgiiRes.status === 'fulfilled') {
        setDgiiStatus(dgiiRes.value.data);
      }
    } catch (err) {
      console.error("Error al cargar dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatRD = (val) => {
    return Number(val || 0).toLocaleString('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Saludo y bienvenida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            ¡Hola, {user?.full_name || user?.username || 'Administrador'}!
          </h2>
          <p className="text-blue-200 text-sm mt-1">
            Bienvenido a tu panel de control de <strong>Emblema POS</strong>. Aquí tienes el resumen financiero y operativo de hoy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('ventas')}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition transform active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ir a F1: Ventas</span>
          </button>
          <button
            onClick={() => onNavigate('cortes')}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-medium backdrop-blur-sm border border-white/20 transition"
          >
            <Receipt className="w-4 h-4" />
            <span>F6: Corte de Caja</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Principales de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Ventas del Día */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ventas de Hoy</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-800">{formatRD(data.ventas_hoy)}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {data.total_tickets_hoy} tickets emitidos hoy
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        {/* 2. Ganancia Neta Real */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ganancia Real Neta</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-emerald-600">{formatRD(data.ganancia_hoy)}</h3>
            <p className="text-xs text-emerald-700 mt-1 font-medium">
              Margen promedio: {data.margen_hoy}%
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* 3. Efectivo Actual en Caja */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dinero en Caja</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-800">{formatRD(data.efectivo_en_caja)}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Disponible en caja registradora
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        </div>

        {/* 4. Cuentas por Cobrar ("El Fiado") */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cuentas por Cobrar</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-amber-600">{formatRD(totalDeuda)}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {clientesDeudores} clientes con saldo pendiente
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>
      </div>

      {/* Sección Secundaria: Alertas Operativas + Estado Facturación DGII */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas de Stock y Clientes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Alertas Operativas</span>
          </h4>

          {bajoStockCount > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">{bajoStockCount} Productos con Stock Bajo</p>
                <p className="text-xs text-amber-700">Por debajo del mínimo establecido</p>
              </div>
              <button
                onClick={() => onNavigate('inventarios')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
              >
                Ver Lista
              </button>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-xs font-medium">Todos los productos tienen niveles de stock saludables.</p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Ticket promedio hoy:</span>
            <span className="font-bold text-slate-800">{formatRD(data.ticket_promedio)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Costo total mercancía vendida:</span>
            <span className="font-semibold text-slate-700">{formatRD(data.costo_hoy)}</span>
          </div>
        </div>

        {/* Facturación Electrónica DGII e-CF Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>Facturación Electrónica DGII</span>
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
              Ley 32-23
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Entorno DGII:</span>
              <span className="font-semibold text-slate-800">
                {dgiiStatus?.config?.environment === 'PROD' ? 'Producción' : 'Desarrollo (DEV)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Microservicio e-CF:</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                dgiiStatus?.service_online 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {dgiiStatus?.service_online ? 'En Línea (3001)' : 'Standby Local'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Próx. e-NCF Crédito Fiscal:</span>
              <span className="font-mono font-bold text-blue-700">
                E31{String(dgiiStatus?.config?.secuencia_e31_actual || 1).padStart(10, '0')}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Próx. e-NCF Consumo:</span>
              <span className="font-mono font-bold text-blue-700">
                E32{String(dgiiStatus?.config?.secuencia_e32_actual || 1).padStart(10, '0')}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('dgii')}
            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-blue-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
          >
            <span>Configurar Certificado & Secuencias</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Accesos Rápidos */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="font-bold text-slate-800">Accesos Rápidos</h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => onNavigate('ventas')}
              className="p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition group"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-slate-800">F1: Terminal</p>
              <p className="text-[11px] text-slate-500">Cobrar ventas</p>
            </button>

            <button
              onClick={() => onNavigate('clientes')}
              className="p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 text-left transition group"
            >
              <Users className="w-4 h-4 text-indigo-600 mb-1 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-slate-800">F2: Crédito</p>
              <p className="text-[11px] text-slate-500">Abonos y deudas</p>
            </button>

            <button
              onClick={() => onNavigate('productos')}
              className="p-3 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-left transition group"
            >
              <Package className="w-4 h-4 text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-slate-800">F3: Catálogo</p>
              <p className="text-[11px] text-slate-500">Precios y códigos</p>
            </button>

            <button
              onClick={() => onNavigate('cortes')}
              className="p-3 rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50 text-left transition group"
            >
              <Receipt className="w-4 h-4 text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-slate-800">F6: Cortes</p>
              <p className="text-[11px] text-slate-500">Cerrar turno</p>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('reportes')}
              className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
            >
              <span>Ver Reporte de Ganancias Detallado</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Últimas Ventas Realizadas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800">Últimas Ventas Emitidas</h4>
            <p className="text-xs text-slate-500">Transacciones más recientes registradas en el sistema</p>
          </div>
          <button
            onClick={() => onNavigate('ventas')}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            <span>Ir al Punto de Venta</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">ID / Factura</th>
                <th className="px-5 py-3">e-NCF</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Método</th>
                <th className="px-5 py-3">Total RD$</th>
                <th className="px-5 py-3">Estado DGII</th>
                <th className="px-5 py-3 text-right">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.ultimas_ventas && data.ultimas_ventas.length > 0 ? (
                data.ultimas_ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3 font-mono font-medium text-slate-700">#{v.id}</td>
                    <td className="px-5 py-3 font-mono text-blue-700 font-semibold">{v.encf}</td>
                    <td className="px-5 py-3 text-slate-700">{v.client_name || 'Consumidor Final'}</td>
                    <td className="px-5 py-3 capitalize text-slate-600">{v.payment_method}</td>
                    <td className="px-5 py-3 font-bold text-slate-800">{formatRD(v.total)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        v.dgii_status === 'aceptado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : v.dgii_status === 'enviado'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {v.dgii_status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 font-mono">
                      {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-slate-400">
                    Aún no se han registrado ventas hoy. Presiona <strong className="text-slate-600">F1: Ventas</strong> para iniciar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
