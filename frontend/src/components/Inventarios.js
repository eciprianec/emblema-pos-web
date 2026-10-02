import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  PlusCircle, 
  SlidersHorizontal, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Search, 
  History, 
  X, 
  Check 
} from 'lucide-react';
import { inventariosApi, productosApi } from '../api';

export default function Inventarios() {
  const [activeTab, setActiveTab] = useState('agregar'); // 'agregar', 'ajustar', 'alertas', 'valuacion'
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState([]);
  const [valuation, setValuation] = useState({
    total_products: 0,
    total_units: 0,
    total_cost_value: 0,
    total_retail_value: 0,
    potential_profit: 0
  });

  // Modal Kárdex
  const [kardexProduct, setKardexProduct] = useState(null);
  const [kardexList, setKardexList] = useState([]);
  const [showKardex, setShowKardex] = useState(false);

  // Formulario Agregar Stock Rápido
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addQty, setAddQty] = useState('');
  const [addNotes, setAddNotes] = useState('');

  // Formulario Ajuste / Merma
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('ajuste'); // 'ajuste', 'merma', 'salida'
  const [adjustNotes, setAdjustNotes] = useState('');

  const loadData = async () => {
    try {
      const [prodRes, lowRes, valRes] = await Promise.all([
        productosApi.getAll({ search }),
        inventariosApi.getBajoStock(),
        inventariosApi.getValuacion()
      ]);
      setProducts(prodRes.data);
      setLowStock(lowRes.data);
      setValuation(valRes.data);
    } catch (err) {
      console.error("Error al cargar datos de inventarios:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("Seleccione un producto.");
      return;
    }
    const qty = parseFloat(addQty);
    if (!qty || qty <= 0) {
      alert("Ingrese una cantidad válida mayor a 0.");
      return;
    }

    try {
      await inventariosApi.agregarStock({
        product_id: selectedProduct.id,
        quantity: qty,
        notes: addNotes || "Entrada manual de inventario"
      });
      alert(`Se agregaron ${qty} unidades a "${selectedProduct.name}".`);
      setAddQty('');
      setAddNotes('');
      setSelectedProduct(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al agregar stock");
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("Seleccione un producto.");
      return;
    }
    const newStock = parseFloat(adjustQty);
    if (isNaN(newStock) || newStock < 0) {
      alert("Ingrese una cantidad de stock válida.");
      return;
    }

    try {
      await inventariosApi.ajustarStock({
        product_id: selectedProduct.id,
        new_stock: newStock,
        type: adjustType,
        notes: adjustNotes || "Ajuste físico de inventario"
      });
      alert(`Stock de "${selectedProduct.name}" actualizado a ${newStock}.`);
      setAdjustQty('');
      setAdjustNotes('');
      setSelectedProduct(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al ajustar stock");
    }
  };

  const handleOpenKardex = async (p) => {
    setKardexProduct(p);
    try {
      const res = await inventariosApi.getKardex(p.id);
      setKardexList(res.data);
      setShowKardex(true);
    } catch (err) {
      alert("Error al cargar kárdex");
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
            <Boxes className="w-6 h-6 text-cyan-600" />
            <span>F4: Inventarios & Kárdex</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Entradas rápidas de mercancía, ajustes de existencias, mermas y valuación de almacén.
          </p>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {[
            { id: 'agregar', label: 'Agregar Stock', icon: PlusCircle },
            { id: 'ajustar', label: 'Ajustes / Mermas', icon: SlidersHorizontal },
            { id: 'alertas', label: `Stock Bajo (${lowStock.length})`, icon: AlertTriangle },
            { id: 'valuacion', label: 'Valuación RD$', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-white text-cyan-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PESTAÑA 1: AGREGAR STOCK */}
      {activeTab === 'agregar' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-cyan-600" />
              <span>Entrada de Mercancía</span>
            </h3>

            {selectedProduct ? (
              <form onSubmit={handleAddStock} className="space-y-3.5 text-xs">
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-cyan-900">{selectedProduct.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-cyan-700 hover:text-cyan-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-cyan-800 font-mono">Código: {selectedProduct.barcode}</p>
                  <p className="text-[11px] text-cyan-800">
                    Stock Actual: <strong>{selectedProduct.stock}</strong>
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cantidad a Agregar ({selectedProduct.sell_type === 'bulk' ? 'lbs/kg' : 'unidades'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    placeholder="Ej: 24"
                    className="w-full px-3 py-2 border-2 border-cyan-500 rounded-xl font-bold text-sm text-slate-900"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Motivo / Proveedor / Factura</label>
                  <input
                    type="text"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="Ej: Llegó camión de Induveca"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow transition"
                >
                  Confirmar Entrada de Stock
                </button>
              </form>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                Selecciona un producto de la lista derecha para agregarle stock.
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-slate-50">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por código o nombre..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-xs">
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`p-3 cursor-pointer flex items-center justify-between transition ${
                    selectedProduct?.id === p.id ? 'bg-cyan-50 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{p.barcode}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-700 font-bold">Stock: {p.stock}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenKardex(p);
                      }}
                      className="p-1 text-slate-400 hover:text-cyan-600"
                      title="Ver Kárdex de movimientos"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: AJUSTES / MERMAS */}
      {activeTab === 'ajustar' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              <span>Ajustar Stock Físico</span>
            </h3>

            {selectedProduct ? (
              <form onSubmit={handleAdjustStock} className="space-y-3.5 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-amber-900">{selectedProduct.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-amber-700 hover:text-amber-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Stock en Sistema: <strong>{selectedProduct.stock}</strong>
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Ajuste</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="ajuste">Ajuste de Conteo Físico</option>
                    <option value="merma">Merma / Producto Dañado o Vencido</option>
                    <option value="salida">Salida Interna / Consumo Propio</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nuevo Stock Real Existente *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="Cantidad contada en estantería"
                    className="w-full px-3 py-2 border-2 border-amber-500 rounded-xl font-bold text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Razón o Justificación</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Ej: Lata abollada / Auditoría"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow transition"
                >
                  Guardar Ajuste de Inventario
                </button>
              </form>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                Selecciona un producto para ajustar su existencia física.
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-slate-50">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar para ajustar..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-xs">
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`p-3 cursor-pointer flex items-center justify-between transition ${
                    selectedProduct?.id === p.id ? 'bg-amber-50 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{p.barcode}</p>
                  </div>
                  <span className="font-mono font-bold text-slate-700">Stock: {p.stock}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: PRODUCTOS CON STOCK BAJO */}
      {activeTab === 'alertas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="font-extrabold text-sm text-rose-900">
                Productos que requieren reabastecimiento urgente
              </h3>
            </div>
            <span className="text-xs font-bold text-rose-700">{lowStock.length} productos</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3 text-right">Stock Actual</th>
                  <th className="px-5 py-3 text-right">Mínimo Permitido</th>
                  <th className="px-5 py-3 text-right">Faltante Sugerido</th>
                  <th className="px-5 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStock.length > 0 ? (
                  lowStock.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-slate-600">{p.barcode}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{p.name}</td>
                      <td className="px-5 py-3 text-right font-mono font-black text-rose-600">{p.stock}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-500">{p.min_stock}</td>
                      <td className="px-5 py-3 text-right font-mono text-blue-700 font-bold">
                        +{p.min_stock - p.stock}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedProduct(p);
                            setActiveTab('agregar');
                          }}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          Reponer Stock
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                      Excelente. No hay productos con stock por debajo del mínimo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: VALUACIÓN DE INVENTARIO */}
      {activeTab === 'valuacion' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-semibold text-slate-400">Valor a Costo (Inversión)</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2 font-mono">
                {formatRD(valuation.total_cost_value)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Capital total invertido en almacén</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-semibold text-slate-400">Valor a Precio de Venta</span>
              <h3 className="text-2xl font-black text-blue-600 mt-2 font-mono">
                {formatRD(valuation.total_retail_value)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Venta total estimada de todo el inventario</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-semibold text-slate-400">Ganancia Potencial Esperada</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                {formatRD(valuation.potential_profit)}
              </h3>
              <p className="text-xs text-emerald-700 mt-1">Venta total menos costo de mercancía</p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
            <div>
              <h4 className="font-bold text-base">Resumen General de Existencias</h4>
              <p className="text-xs text-slate-400 mt-1">
                Total de códigos distintos: <strong className="text-white">{valuation.total_products}</strong> | 
                Unidades físicas globales: <strong className="text-white font-mono">{valuation.total_units}</strong>
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700"
            >
              Imprimir Reporte de Almacén
            </button>
          </div>
        </div>
      )}

      {/* Modal Kárdex de Movimientos */}
      {showKardex && kardexProduct && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">Kárdex de Movimientos: {kardexProduct.name}</h3>
                <p className="text-xs text-slate-400 font-mono">Código: {kardexProduct.barcode} | Stock Actual: {kardexProduct.stock}</p>
              </div>
              <button onClick={() => setShowKardex(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2 text-right">Cantidad</th>
                    <th className="px-4 py-2 text-right">Anterior</th>
                    <th className="px-4 py-2 text-right">Nuevo Stock</th>
                    <th className="px-4 py-2">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kardexList.length > 0 ? (
                    kardexList.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-500">
                          {new Date(k.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            k.type === 'venta' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {k.type.toUpperCase()}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-right font-mono font-bold ${
                          k.type === 'venta' ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {k.quantity}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-500">{k.previous_stock}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-900 font-bold">{k.new_stock}</td>
                        <td className="px-4 py-2 text-slate-500 text-[11px]">{k.notes || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        No hay movimientos registrados para este producto todavía.
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
