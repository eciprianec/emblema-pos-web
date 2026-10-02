import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Building, 
  Calendar, 
  DollarSign, 
  X, 
  CheckCircle 
} from 'lucide-react';
import { comprasApi, productosApi } from '../api';

export default function Compras() {
  const [activeTab, setActiveTab] = useState('compras'); // 'compras', 'proveedores', 'nueva'
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);

  // Modal Nuevo Proveedor
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    rnc: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  });

  // Formulario Nueva Compra
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [costToAdd, setCostToAdd] = useState('');

  const loadData = async () => {
    try {
      const [suppRes, purRes, prodRes] = await Promise.all([
        comprasApi.getSuppliers(),
        comprasApi.getPurchases(),
        productosApi.getAll()
      ]);
      setSuppliers(suppRes.data);
      setPurchases(purRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error("Error al cargar compras:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await comprasApi.createSupplier(supplierForm);
      setShowSupplierModal(false);
      setSupplierForm({
        name: '',
        rnc: '',
        contact_person: '',
        phone: '',
        email: '',
        address: ''
      });
      loadData();
    } catch (err) {
      alert("Error al registrar proveedor");
    }
  };

  const handleAddItemToPurchase = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find(p => p.id === parseInt(selectedProductToAdd));
    if (!prod) return;

    const cost = parseFloat(costToAdd) || prod.cost_price;
    const qty = parseFloat(qtyToAdd) || 1;

    setPurchaseItems([
      ...purchaseItems,
      {
        product_id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        quantity: qty,
        cost_price: cost,
        subtotal: qty * cost
      }
    ]);

    setSelectedProductToAdd('');
    setCostToAdd('');
    setQtyToAdd(1);
  };

  const handleRemovePurchaseItem = (index) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert("Selecciona un proveedor");
      return;
    }
    if (purchaseItems.length === 0) {
      alert("Agrega al menos un producto a la compra");
      return;
    }

    try {
      await comprasApi.createPurchase({
        supplier_id: parseInt(selectedSupplierId),
        invoice_number: invoiceNumber || null,
        notes: notes || null,
        items: purchaseItems.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          cost_price: i.cost_price
        }))
      });

      alert("¡Factura de compra registrada! El inventario y costos fueron actualizados.");
      setSelectedSupplierId('');
      setInvoiceNumber('');
      setNotes('');
      setPurchaseItems([]);
      setActiveTab('compras');
      loadData();
    } catch (err) {
      alert("Error al registrar la compra");
    }
  };

  const formatRD = (val) => {
    return Number(val || 0).toLocaleString('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    });
  };

  const totalNuevaCompra = purchaseItems.reduce((s, i) => s + i.subtotal, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-500" />
            <span>F5: Compras & Proveedores</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registra facturas de proveedores para aumentar inventario y actualizar precios de costo.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('compras')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'compras' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-slate-600'
            }`}
          >
            Historial de Compras
          </button>
          <button
            onClick={() => setActiveTab('nueva')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'nueva' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-slate-600'
            }`}
          >
            Registrar Factura de Compra
          </button>
          <button
            onClick={() => setActiveTab('proveedores')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'proveedores' ? 'bg-white text-orange-700 shadow-sm font-bold' : 'text-slate-600'
            }`}
          >
            Directorio Proveedores ({suppliers.length})
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: HISTORIAL DE COMPRAS */}
      {activeTab === 'compras' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-xs">Facturas de Compra Ingresadas</h3>
            <button
              onClick={() => setActiveTab('nueva')}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              + Ingresar Nueva Compra
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Proveedor</th>
                  <th className="px-5 py-3">No. Factura Proveedor</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3 text-right">Total RD$</th>
                  <th className="px-5 py-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length > 0 ? (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono font-bold text-slate-700">#{p.id}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{p.supplier?.name}</td>
                      <td className="px-5 py-3 font-mono text-slate-600">{p.invoice_number || 'S/N'}</td>
                      <td className="px-5 py-3 text-slate-500 font-mono">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-black text-slate-900">
                        {formatRD(p.total)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[11px]">{p.notes || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                      No hay compras registradas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: NUEVA COMPRA */}
      {activeTab === 'nueva' && (
        <form onSubmit={handleSavePurchase} className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Proveedor *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              >
                <option value="">Seleccione Proveedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">No. Factura o Conduce del Proveedor</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej: B0100004521"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Comentarios / Observaciones</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Pago contra entrega"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Selector de Items para la Compra */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-xs">Agregar Mercancía a la Factura</h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Producto</label>
                <select
                  value={selectedProductToAdd}
                  onChange={(e) => {
                    setSelectedProductToAdd(e.target.value);
                    const prod = products.find(p => p.id === parseInt(e.target.value));
                    if (prod) setCostToAdd(prod.cost_price.toString());
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Buscar producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cantidad Recibida</label>
                <input
                  type="number"
                  step="0.01"
                  value={qtyToAdd}
                  onChange={(e) => setQtyToAdd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Costo Unit. RD$</label>
                <input
                  type="number"
                  step="0.01"
                  value={costToAdd}
                  onChange={(e) => setCostToAdd(e.target.value)}
                  placeholder="Costo factura"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <button
                type="button"
                onClick={handleAddItemToPurchase}
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs"
              >
                + Agregar Línea
              </button>
            </div>

            {/* Tabla de items en la compra */}
            <div className="border rounded-xl overflow-hidden mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr>
                    <th className="px-4 py-2">Código</th>
                    <th className="px-4 py-2">Producto</th>
                    <th className="px-4 py-2 text-center">Cantidad</th>
                    <th className="px-4 py-2 text-right">Costo Unit.</th>
                    <th className="px-4 py-2 text-right">Subtotal RD$</th>
                    <th className="px-4 py-2 text-center w-16">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseItems.length > 0 ? (
                    purchaseItems.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 font-mono text-slate-500">{item.barcode}</td>
                        <td className="px-4 py-2 font-bold text-slate-800">{item.name}</td>
                        <td className="px-4 py-2 text-center font-bold">{item.quantity}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatRD(item.cost_price)}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-orange-700">
                          {formatRD(item.subtotal)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseItem(index)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        No hay productos agregados a esta factura todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Barra de Total de la Compra */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-xs text-slate-500">
                Al guardar, se sumarán las existencias al inventario y se actualizará el costo unitario de cada producto.
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Total Factura</span>
                  <span className="text-xl font-black font-mono text-slate-900">{formatRD(totalNuevaCompra)}</span>
                </div>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow transition disabled:opacity-40"
                >
                  Registrar Compra en Inventario
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* PESTAÑA 3: PROVEEDORES */}
      {activeTab === 'proveedores' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-xs">Directorio de Casas Comerciales y Suplidores</h3>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold"
            >
              + Nuevo Proveedor
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="px-5 py-3">Proveedor / Empresa</th>
                  <th className="px-5 py-3">RNC</th>
                  <th className="px-5 py-3">Contacto</th>
                  <th className="px-5 py-3">Teléfono</th>
                  <th className="px-5 py-3">Correo</th>
                  <th className="px-5 py-3">Dirección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{s.name}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{s.rnc || 'N/A'}</td>
                    <td className="px-5 py-3 text-slate-700">{s.contact_person || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{s.phone || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{s.email || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{s.address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nuevo Proveedor */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-400" />
                <span>Registrar Proveedor</span>
              </h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre de la Empresa / Razón Social *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Ej: Cervecería Nacional Dominicana"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RNC</label>
                  <input
                    type="text"
                    value={supplierForm.rnc}
                    onChange={(e) => setSupplierForm({ ...supplierForm, rnc: e.target.value })}
                    placeholder="101001569"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={supplierForm.contact_person}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                    placeholder="Marcos Reyes"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="809-487-3000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="pedidos@empresa.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Autopista 30 de Mayo, Santo Domingo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
