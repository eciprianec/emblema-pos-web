import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar, 
  Printer, 
  Layers, 
  ArrowUpRight 
} from 'lucide-react';
import { reportesApi } from '../api';

export default function Reportes() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const [periodSummary, setPeriodSummary] = useState({
    total_sales: 0,
    total_cost: 0,
    total_profit: 0,
    profit_margin: 0,
    total_tickets: 0,
    average_ticket: 0,
    sales_by_method: {},
    sales_by_ncf: {}
  });

  const [topProducts, setTopProducts] = useState([]);
  const [deptSales, setDeptSales] = useState([]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [periodRes, topRes, deptRes] = await Promise.all([
        reportesApi.getVentasPeriodo(startDate, endDate),
        reportesApi.getTopProductos(10),
        reportesApi.getVentasDepartamento()
      ]);
      setPeriodSummary(periodRes.data);
      setTopProducts(topRes.data);
      setDeptSales(deptRes.data);
    } catch (err) {
      console.error("Error al cargar reportes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [startDate, endDate]);

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
            <BarChart3 className="w-6 h-6 text-rose-500" />
            <span>F7: Reportes Financieros & Ganancias Reales</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Análisis de rentabilidad: Ventas menos Costo de Mercancía igual a Ganancia Neta Real.
          </p>
        </div>

        {/* Selector de Rango de Fechas */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
          <Calendar className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-white px-2 py-1 border border-slate-200 rounded-lg text-slate-700 font-semibold"
          />
          <span className="text-slate-400">al</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-white px-2 py-1 border border-slate-200 rounded-lg text-slate-700 font-semibold"
          />
          <button
            onClick={() => window.print()}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg ml-1 transition"
            title="Imprimir reporte"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tarjetas Principales de Ganancia Real Neta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400">Ventas Totales Brutas</span>
          <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono">
            {formatRD(periodSummary.total_sales)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">En {periodSummary.total_tickets} tickets</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400">Costo de Mercancía</span>
          <h3 className="text-2xl font-black text-slate-600 mt-2 font-mono">
            {formatRD(periodSummary.total_cost)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Costo de reposición a proveedores</p>
        </div>

        <div className="bg-emerald-900 text-white p-5 rounded-2xl shadow-md">
          <span className="text-xs font-semibold uppercase text-emerald-200">Ganancia Real Neta</span>
          <h3 className="text-2xl font-black text-emerald-300 mt-2 font-mono">
            {formatRD(periodSummary.total_profit)}
          </h3>
          <p className="text-xs text-emerald-200 mt-1">Ventas - Costos = Tu Ganancia</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-400">Margen de Rentabilidad</span>
          <h3 className="text-2xl font-black text-blue-600 mt-2 font-mono">
            {periodSummary.profit_margin}%
          </h3>
          <p className="text-xs text-slate-500 mt-1">Ticket promedio: {formatRD(periodSummary.average_ticket)}</p>
        </div>
      </div>

      {/* Desglose por Formas de Pago y Tipos de e-NCF */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Ventas por Método de Pago
          </h4>
          <div className="space-y-2 text-xs">
            {Object.entries(periodSummary.sales_by_method || {}).map(([method, amount]) => (
              <div key={method} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                <span className="font-semibold text-slate-700 capitalize">{method}</span>
                <span className="font-mono font-bold text-slate-900">{formatRD(amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Ventas por Comprobante DGII
          </h4>
          <div className="space-y-2 text-xs">
            {Object.entries(periodSummary.sales_by_ncf || {}).map(([ncf, amount]) => (
              <div key={ncf} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                <span className="font-mono font-bold text-blue-800">
                  {ncf === 'E31' ? 'E31 - Crédito Fiscal' : 'E32 - Consumo'}
                </span>
                <span className="font-mono font-bold text-slate-900">{formatRD(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOP PRODUCTOS MÁS VENDIDOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
            <Package className="w-4 h-4 text-rose-500" />
            <span>Top 10 Productos Más Vendidos</span>
          </h3>
          <span className="text-[11px] text-slate-400">Ordenado por unidades vendidas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-5 py-3 w-12 text-center">#</th>
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3 text-right">Unidades Vendidas</th>
                <th className="px-5 py-3 text-right">Venta Total RD$</th>
                <th className="px-5 py-3 text-right">Ganancia Generada RD$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProducts.length > 0 ? (
                topProducts.map((p, index) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-center font-bold text-slate-400">{index + 1}</td>
                    <td className="px-5 py-3 font-bold text-slate-800">{p.name}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-700">{p.units_sold}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">
                      {formatRD(p.total_sales)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-black text-emerald-600">
                      {formatRD(p.total_profit)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-5 py-8 text-center text-slate-400">
                    Aún no hay datos de ventas para mostrar en el ranking.
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
