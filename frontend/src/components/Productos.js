import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Tag, 
  Boxes, 
  X, 
  DollarSign, 
  Layers 
} from 'lucide-react';
import { productosApi } from '../api';

export default function Productos() {
  const [products, setProducts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    department_id: '',
    sell_type: 'unit',
    cost_price: 0,
    margin_percent: 30,
    sale_price: 0,
    tax_rate: 18,
    wholesale_price: '',
    wholesale_quantity: '',
    stock: 0,
    min_stock: 5,
    max_stock: 100
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, deptRes] = await Promise.all([
        productosApi.getAll({ search, department_id: selectedDept || undefined }),
        productosApi.getDepartments()
      ]);
      setProducts(prodRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error("Error al cargar productos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedDept]);

  // Calculadora de precios y margen
  const handleCostChange = (cost) => {
    const c = parseFloat(cost) || 0;
    const m = parseFloat(formData.margin_percent) || 0;
    const sale = c + (c * (m / 100));
    setFormData(prev => ({
      ...prev,
      cost_price: c,
      sale_price: Math.round(sale * 100) / 100
    }));
  };

  const handleMarginChange = (margin) => {
    const m = parseFloat(margin) || 0;
    const c = parseFloat(formData.cost_price) || 0;
    const sale = c + (c * (m / 100));
    setFormData(prev => ({
      ...prev,
      margin_percent: m,
      sale_price: Math.round(sale * 100) / 100
    }));
  };

  const handleSalePriceChange = (price) => {
    const p = parseFloat(price) || 0;
    const c = parseFloat(formData.cost_price) || 0;
    let margin = 0;
    if (c > 0) {
      margin = ((p - c) / c) * 100;
    }
    setFormData(prev => ({
      ...prev,
      sale_price: p,
      margin_percent: Math.round(margin * 10) / 10
    }));
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      barcode: '',
      name: '',
      department_id: departments[0]?.id || '',
      sell_type: 'unit',
      cost_price: 0,
      margin_percent: 30,
      sale_price: 0,
      tax_rate: 18,
      wholesale_price: '',
      wholesale_quantity: '',
      stock: 0,
      min_stock: 5,
      max_stock: 100
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingId(p.id);
    setFormData({
      barcode: p.barcode,
      name: p.name,
      department_id: p.department_id || '',
      sell_type: p.sell_type || 'unit',
      cost_price: p.cost_price || 0,
      margin_percent: p.margin_percent || 0,
      sale_price: p.sale_price || 0,
      tax_rate: p.tax_rate ?? 18,
      wholesale_price: p.wholesale_price || '',
      wholesale_quantity: p.wholesale_quantity || '',
      stock: p.stock || 0,
      min_stock: p.min_stock || 5,
      max_stock: p.max_stock || 100
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        cost_price: parseFloat(formData.cost_price) || 0,
        margin_percent: parseFloat(formData.margin_percent) || 0,
        sale_price: parseFloat(formData.sale_price) || 0,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        stock: parseFloat(formData.stock) || 0,
        min_stock: parseFloat(formData.min_stock) || 0,
        max_stock: parseFloat(formData.max_stock) || 0,
        wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : null,
        wholesale_quantity: formData.wholesale_quantity ? parseFloat(formData.wholesale_quantity) : null,
        department_id: formData.department_id ? parseInt(formData.department_id) : null
      };

      if (editingId) {
        await productosApi.update(editingId, payload);
      } else {
        await productosApi.create(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar el producto");
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`¿Seguro que deseas eliminar el producto "${name}"?`)) {
      try {
        await productosApi.delete(id);
        fetchData();
      } catch (err) {
        alert(err.response?.data?.detail || "Error al eliminar producto");
      }
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
      {/* Encabezado del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" />
            <span>F3: Productos & Catálogo</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Administra tus precios de costo, márgenes de ganancia, ventas a mayoreo y códigos de barra.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código de barras o nombre del producto..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        <div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 shadow-sm font-medium"
          >
            <option value="">Todos los Departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Descripción</th>
                <th className="px-5 py-3">Departamento</th>
                <th className="px-5 py-3 text-right">Costo RD$</th>
                <th className="px-5 py-3 text-right">Margen %</th>
                <th className="px-5 py-3 text-right">Precio Venta RD$</th>
                <th className="px-5 py-3 text-right">Stock Actual</th>
                <th className="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length > 0 ? (
                products.map((p) => {
                  const isLowStock = p.stock <= p.min_stock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3 font-mono font-medium text-slate-600">{p.barcode}</td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {p.sell_type === 'bulk' ? 'A Granel/Peso' : 'Por Unidad'}
                          </span>
                          <span className="text-[10px] text-slate-400">| ITBIS {p.tax_rate}%</span>
                          {p.wholesale_price && (
                            <span className="text-[10px] text-amber-600 font-semibold">
                              | Mayoreo: {formatRD(p.wholesale_price)} ({p.wholesale_quantity}+)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{p.department?.name || 'General'}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-500">{formatRD(p.cost_price)}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-600">
                        {p.margin_percent?.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatRD(p.sale_price)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          isLowStock ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {p.stock} {p.sell_type === 'bulk' ? 'lbs/kg' : 'u.'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Editar producto"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-slate-400">
                    No se encontraron productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Producto */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>{editingId ? 'Modificar Producto' : 'Nuevo Producto'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Código de Barras *</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="7460000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nombre / Descripción del Producto *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Leche Rica 1L Entera"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Departamento</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  >
                    <option value="">(Sin Departamento)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Venta</label>
                  <select
                    value={formData.sell_type}
                    onChange={(e) => setFormData({ ...formData, sell_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  >
                    <option value="unit">Por Unidad (Pieza, Botella, Lata)</option>
                    <option value="bulk">A Granel / Por Peso (Libras, Kilos)</option>
                    <option value="package">Por Paquete / Caja</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN PRECIOS CON CALCULADORA */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <span className="font-bold text-amber-900 block text-xs uppercase tracking-wider">
                  Cálculo de Precios & Margen de Ganancia
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Costo RD$</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost_price}
                      onChange={(e) => handleCostChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Margen Ganancia %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.margin_percent}
                      onChange={(e) => handleMarginChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-emerald-700 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Precio de Venta RD$ *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.sale_price}
                      onChange={(e) => handleSalePriceChange(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-amber-500 rounded-lg font-black text-amber-900 text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tasa de ITBIS</label>
                    <select
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="18">18% (ITBIS Regular)</option>
                      <option value="16">16% (Tasa reducida)</option>
                      <option value="0">0% (Exento)</option>
                    </select>
                  </div>

                  <div className="flex items-center text-slate-600 text-[11px] pt-4">
                    Ganancia por unidad: <strong className="ml-1 text-emerald-700 font-mono">{formatRD((formData.sale_price || 0) - (formData.cost_price || 0))}</strong>
                  </div>
                </div>
              </div>

              {/* MAYOREO */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Precio Mayoreo RD$ (Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                    placeholder="Ej: 165.00"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">A partir de cuántas unidades:</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.wholesale_quantity}
                    onChange={(e) => setFormData({ ...formData, wholesale_quantity: e.target.value })}
                    placeholder="Ej: 12"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* STOCK */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Actual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Máximo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_stock}
                    onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold shadow"
                >
                  {editingId ? 'Actualizar Producto' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
