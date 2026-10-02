import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Search, 
  DollarSign, 
  Printer, 
  CheckCircle, 
  X, 
  User, 
  CreditCard, 
  QrCode,
  Tag,
  AlertCircle
} from 'lucide-react';
import { ventasApi, clientesApi } from '../api';

export default function Ventas({ storeSettings, cajaAbierta, onOpenCorte }) {
  // Manejo de multi-tickets
  const [tickets, setTickets] = useState([
    { id: 1, name: 'Ticket 1', items: [], client: null, ncfType: 'E32' }
  ]);
  const [activeTicketId, setActiveTicketId] = useState(1);

  // Input de código de barras / buscador
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Modales
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPriceChecker, setShowPriceChecker] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  // Estado del modal de cobro (F12)
  const [paymentMethod, setPaymentMethod] = useState('efectivo'); // efectivo, tarjeta, transferencia, credito
  const [cashReceived, setCashReceived] = useState('');
  const [ncfType, setNcfType] = useState('E32'); // E32 (Consumo), E31 (Crédito Fiscal)
  const [fiscalRnc, setFiscalRnc] = useState('');
  const [fiscalName, setFiscalName] = useState('');
  const [processingSale, setProcessingSale] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Estado del verificador de precios (F3)
  const [priceCheckerQuery, setPriceCheckerQuery] = useState('');
  const [priceCheckerResult, setPriceCheckerResult] = useState(null);

  // Lista de clientes para seleccionar
  const [clientsList, setClientsList] = useState([]);
  const [clientSearch, setClientSearch] = useState('');

  // Referencias a inputs
  const barcodeInputRef = useRef(null);
  const priceCheckerInputRef = useRef(null);

  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];

  // Mantener el foco en el lector de códigos de barra
  useEffect(() => {
    if (!showCheckoutModal && !showPriceChecker && !showClientSelector && !showReceiptModal) {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  }, [showCheckoutModal, showPriceChecker, showClientSelector, showReceiptModal, activeTicketId]);

  // Capturador global de atajos de teclado (F1, F3, F9, F10, F12)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowPriceChecker(true);
        setPriceCheckerResult(null);
        setPriceCheckerQuery('');
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleCancelTicket();
      } else if (e.key === 'F10') {
        e.preventDefault();
        loadClients();
        setShowClientSelector(true);
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (activeTicket.items.length > 0) {
          openCheckout();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTicket]);

  // Cálculos de totales del ticket actual
  const ticketSubtotal = activeTicket.items.reduce((sum, item) => sum + item.subtotal, 0);
  const ticketItbis = activeTicket.items.reduce((sum, item) => sum + item.itbis, 0);
  const ticketTotal = activeTicket.items.reduce((sum, item) => sum + item.total, 0);

  // Agregar nuevo ticket (pestaña)
  const handleAddTicket = () => {
    if (tickets.length >= 10) return;
    const newId = (tickets[tickets.length - 1]?.id || 0) + 1;
    const newTicket = { id: newId, name: `Ticket ${newId}`, items: [], client: null, ncfType: 'E32' };
    setTickets([...tickets, newTicket]);
    setActiveTicketId(newId);
  };

  // Cerrar pestaña de ticket
  const handleCloseTicket = (id, e) => {
    e.stopPropagation();
    if (tickets.length === 1) {
      // Si es el único, solo limpiarlo
      handleCancelTicket();
      return;
    }
    const filtered = tickets.filter(t => t.id !== id);
    setTickets(filtered);
    if (activeTicketId === id) {
      setActiveTicketId(filtered[0].id);
    }
  };

  // Buscar producto por código o texto
  const handleBarcodeSubmit = async (e) => {
    e?.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    // Soporte para sintaxis de cantidad multiplicador (ej: "5*74601001" o "3.5*arroz")
    let multiplier = 1;
    let actualTerm = query;
    if (query.includes('*')) {
      const parts = query.split('*');
      const parsedQty = parseFloat(parts[0]);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        multiplier = parsedQty;
        actualTerm = parts.slice(1).join('*').trim();
      }
    }

    try {
      const res = await ventasApi.buscarProducto(actualTerm);
      const matches = res.data;

      if (matches.length === 1) {
        // Coincidencia exacta o única -> agregar inmediatamente
        addProductToTicket(matches[0], multiplier);
        setBarcodeInput('');
        setSearchResults([]);
        setShowDropdown(false);
      } else if (matches.length > 1) {
        // Múltiples coincidencias -> mostrar dropdown de selección
        setSearchResults(matches);
        setShowDropdown(true);
      } else {
        alert(`No se encontró ningún producto con el código o nombre: "${actualTerm}"`);
      }
    } catch (err) {
      console.error("Error al buscar producto:", err);
    }
  };

  // Agregar producto al ticket activo
  const addProductToTicket = (product, quantityToAdd = 1) => {
    setTickets(prevTickets => {
      return prevTickets.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;

        const existingIndex = ticket.items.findIndex(item => item.product_id === product.id);
        let updatedItems = [...ticket.items];

        if (existingIndex >= 0) {
          const item = updatedItems[existingIndex];
          const newQty = item.quantity + quantityToAdd;
          
          // Verificar precio de mayoreo si aplica
          let unitPrice = product.sale_price;
          let isWholesale = false;
          if (product.wholesale_quantity && product.wholesale_price && newQty >= product.wholesale_quantity) {
            unitPrice = product.wholesale_price;
            isWholesale = true;
          }

          const taxRate = product.tax_rate || 0;
          const subtotal = newQty * unitPrice;
          const itbis = subtotal * (taxRate / 100);
          const total = subtotal + itbis;

          updatedItems[existingIndex] = {
            ...item,
            quantity: newQty,
            unit_price: unitPrice,
            is_wholesale: isWholesale,
            subtotal,
            itbis,
            total
          };
        } else {
          // Nuevo item
          let unitPrice = product.sale_price;
          let isWholesale = false;
          if (product.wholesale_quantity && product.wholesale_price && quantityToAdd >= product.wholesale_quantity) {
            unitPrice = product.wholesale_price;
            isWholesale = true;
          }

          const taxRate = product.tax_rate || 0;
          const subtotal = quantityToAdd * unitPrice;
          const itbis = subtotal * (taxRate / 100);
          const total = subtotal + itbis;

          updatedItems.push({
            product_id: product.id,
            barcode: product.barcode,
            name: product.name,
            sell_type: product.sell_type,
            cost_price: product.cost_price,
            unit_price: unitPrice,
            regular_price: product.sale_price,
            wholesale_price: product.wholesale_price,
            wholesale_quantity: product.wholesale_quantity,
            is_wholesale: isWholesale,
            tax_rate: taxRate,
            quantity: quantityToAdd,
            subtotal,
            itbis,
            total
          });
        }

        return { ...ticket, items: updatedItems };
      });
    });
  };

  // Modificar cantidad directamente en la tabla
  const handleUpdateItemQuantity = (index, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    setTickets(prevTickets => {
      return prevTickets.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;

        const updatedItems = [...ticket.items];
        const item = updatedItems[index];

        let unitPrice = item.regular_price;
        let isWholesale = false;
        if (item.wholesale_quantity && item.wholesale_price && newQty >= item.wholesale_quantity) {
          unitPrice = item.wholesale_price;
          isWholesale = true;
        }

        const subtotal = newQty * unitPrice;
        const itbis = subtotal * ((item.tax_rate || 0) / 100);
        const total = subtotal + itbis;

        updatedItems[index] = {
          ...item,
          quantity: newQty,
          unit_price: unitPrice,
          is_wholesale: isWholesale,
          subtotal,
          itbis,
          total
        };

        return { ...ticket, items: updatedItems };
      });
    });
  };

  // Quitar línea de producto
  const handleRemoveItem = (index) => {
    setTickets(prevTickets => {
      return prevTickets.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;
        const updatedItems = ticket.items.filter((_, i) => i !== index);
        return { ...ticket, items: updatedItems };
      });
    });
  };

  // Cancelar ticket completo (F9)
  const handleCancelTicket = () => {
    if (activeTicket.items.length === 0) return;
    if (window.confirm("¿Seguro que deseas cancelar y vaciar todos los productos del ticket actual? (F9)")) {
      setTickets(prevTickets => {
        return prevTickets.map(ticket => {
          if (ticket.id !== activeTicketId) return ticket;
          return { ...ticket, items: [], client: null };
        });
      });
    }
  };

  // Abrir modal de cobro (F12)
  const openCheckout = () => {
    setShowCheckoutModal(true);
    setPaymentMethod('efectivo');
    setCashReceived('');
    setCheckoutError('');
    setNcfType(activeTicket.client ? 'E31' : 'E32');
    if (activeTicket.client) {
      setFiscalRnc(activeTicket.client.rnc_cedula || '');
      setFiscalName(activeTicket.client.name || '');
    } else {
      setFiscalRnc('');
      setFiscalName('');
    }
  };

  // Confirmar y procesar cobro (F12)
  const handleProcessCheckout = async () => {
    setCheckoutError('');

    const total = ticketTotal;
    const received = paymentMethod === 'efectivo' 
      ? (parseFloat(cashReceived) || total) 
      : total;

    if (paymentMethod === 'efectivo' && received < total) {
      setCheckoutError(`El monto recibido (RD$${received}) es menor al total a cobrar (RD$${total.toFixed(2)})`);
      return;
    }

    if (paymentMethod === 'credito' && !activeTicket.client) {
      setCheckoutError("Para vender a crédito debes seleccionar un cliente registrado.");
      return;
    }

    if (ncfType === 'E31' && (!fiscalRnc.trim() || !fiscalName.trim())) {
      setCheckoutError("Para Factura con Crédito Fiscal (E31) debes indicar el RNC/Cédula y la Razón Social del comprador.");
      return;
    }

    setProcessingSale(true);
    try {
      const payload = {
        client_id: activeTicket.client ? activeTicket.client.id : null,
        ncf_type: ncfType,
        fiscal_rnc: fiscalRnc || null,
        fiscal_name: fiscalName || null,
        payment_method: paymentMethod,
        cash_received: received,
        items: activeTicket.items.map(item => ({
          product_id: item.product_id,
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price || 0,
          tax_rate: item.tax_rate || 0,
          subtotal: item.subtotal,
          itbis: item.itbis,
          total: item.total
        }))
      };

      const res = await ventasApi.procesarVenta(payload);
      const saleData = res.data;

      // Guardar para el ticket de impresión
      setLastSaleReceipt(saleData);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);

      // Limpiar ticket pagado
      setTickets(prevTickets => {
        return prevTickets.map(ticket => {
          if (ticket.id !== activeTicketId) return ticket;
          return { ...ticket, items: [], client: null };
        });
      });

    } catch (err) {
      console.error("Error al procesar venta:", err);
      setCheckoutError(err.response?.data?.detail || "Error al procesar la venta. Verifique los datos o el estado de la caja.");
    } finally {
      setProcessingSale(false);
    }
  };

  // Cargar clientes para F10
  const loadClients = async () => {
    try {
      const res = await clientesApi.getAll(clientSearch);
      setClientsList(res.data);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

  const handleSelectClient = (client) => {
    setTickets(prevTickets => {
      return prevTickets.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;
        return { 
          ...ticket, 
          client,
          ncfType: client.rnc_cedula ? 'E31' : 'E32'
        };
      });
    });
    setShowClientSelector(false);
  };

  // Verificador de precios (F3)
  const handleCheckPrice = async (e) => {
    e?.preventDefault();
    if (!priceCheckerQuery.trim()) return;
    try {
      const res = await ventasApi.consultarPrecio(priceCheckerQuery.trim());
      setPriceCheckerResult(res.data);
    } catch (err) {
      alert("No se encontró el producto.");
      setPriceCheckerResult(null);
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
    <div className="flex flex-col h-full bg-slate-100 select-none">
      {/* Barra superior de Pestañas Multi-Ticket */}
      <div className="bg-slate-200 border-b border-slate-300 px-4 pt-2 flex items-center justify-between">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveTicketId(t.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg text-xs font-semibold cursor-pointer transition border-t border-l border-r ${
                activeTicketId === t.id
                  ? 'bg-white text-blue-700 border-slate-300 shadow-sm'
                  : 'bg-slate-300/70 text-slate-600 border-transparent hover:bg-slate-300 hover:text-slate-900'
              }`}
            >
              <span>{t.name}</span>
              {t.items.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {t.items.length}
                </span>
              )}
              <button
                onClick={(e) => handleCloseTicket(t.id, e)}
                className="text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-100 transition"
                title="Cerrar ticket"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            onClick={handleAddTicket}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-300 rounded-t-lg transition"
            title="Agregar nuevo ticket (+)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo</span>
          </button>
        </div>

        {/* Info del Cliente Asignado al Ticket */}
        <div className="flex items-center space-x-2 pb-1.5">
          <button
            onClick={() => {
              loadClients();
              setShowClientSelector(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 shadow-sm transition"
            title="Asignar Cliente al Ticket (F10)"
          >
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {activeTicket.client ? activeTicket.client.name : 'Cliente: Mostrador / Público General (F10)'}
            </span>
          </button>
        </div>
      </div>

      {/* Área Principal de Ventas */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {/* Input Lector de Código de Barras con Autofocus */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative">
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Escanea el código de barras o escribe el nombre del producto (Ej: 74601001 o 3*arroz)... [F1]"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-blue-400 rounded-xl text-base font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
              <Search className="w-5 h-5 text-blue-500 absolute left-3 top-3" />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow transition"
            >
              Agregar [Enter]
            </button>
          </form>

          {/* Menú flotante de múltiples coincidencias */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
              {searchResults.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    addProductToTicket(prod, 1);
                    setBarcodeInput('');
                    setShowDropdown(false);
                  }}
                  className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex items-center justify-between text-xs transition"
                >
                  <div>
                    <p className="font-bold text-slate-800">{prod.name}</p>
                    <p className="text-slate-500 font-mono text-[11px]">Código: {prod.barcode} | Stock: {prod.stock}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-blue-700 text-sm">{formatRD(prod.sale_price)}</p>
                    <span className="text-[10px] text-slate-400">ITBIS {prod.tax_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabla de Productos del Ticket Actual */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descripción del Producto</th>
                  <th className="px-4 py-3 text-center w-28">Cantidad</th>
                  <th className="px-4 py-3 text-right">Precio Unit.</th>
                  <th className="px-4 py-3 text-right">ITBIS (18%)</th>
                  <th className="px-4 py-3 text-right">Total RD$</th>
                  <th className="px-4 py-3 text-center w-16">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTicket.items.length > 0 ? (
                  activeTicket.items.map((item, index) => (
                    <tr key={index} className="hover:bg-blue-50/50 transition">
                      <td className="px-4 py-3 text-center font-mono text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-600">{item.barcode}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800 text-sm leading-tight">{item.name}</p>
                        {item.is_wholesale && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded mt-0.5">
                            <Tag className="w-2.5 h-2.5" /> Precio Mayoreo
                          </span>
                        )}
                        {item.sell_type === 'bulk' && (
                          <span className="text-[10px] text-slate-500 ml-1">Venta a granel / peso</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step={item.sell_type === 'bulk' ? '0.01' : '1'}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQuantity(index, parseFloat(e.target.value) || 0)}
                            className="w-14 text-center font-bold text-slate-800 bg-white text-xs py-1 focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {formatRD(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {formatRD(item.itbis)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-800 text-sm">
                        {formatRD(item.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-20 text-center text-slate-400">
                      <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                      <p className="text-base font-semibold text-slate-600">El ticket actual está vacío</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Escanea un código de barras o usa <strong className="text-blue-600">F1</strong> para buscar productos.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Totales y Botón de Cobro */}
          <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
            <div className="flex items-center space-x-6 text-xs">
              <div>
                <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Artículos</span>
                <span className="text-lg font-bold font-mono">
                  {activeTicket.items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <div className="border-l border-slate-700 pl-6">
                <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Subtotal Neto</span>
                <span className="text-lg font-semibold font-mono text-slate-200">
                  {formatRD(ticketSubtotal)}
                </span>
              </div>
              <div className="border-l border-slate-700 pl-6">
                <span className="text-slate-400 uppercase tracking-wider block text-[10px]">ITBIS (18%)</span>
                <span className="text-lg font-semibold font-mono text-slate-200">
                  {formatRD(ticketItbis)}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleCancelTicket}
                disabled={activeTicket.items.length === 0}
                className="px-4 py-3 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 rounded-xl text-xs font-semibold border border-slate-700 transition disabled:opacity-40"
                title="Cancelar ticket actual (F9)"
              >
                F9 Cancelar
              </button>

              <button
                onClick={openCheckout}
                disabled={activeTicket.items.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-between space-x-6 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-8 py-3 rounded-xl font-extrabold shadow-lg transition transform active:scale-95 disabled:opacity-40"
              >
                <div className="text-left">
                  <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-950">F12: COBRAR</span>
                  <span className="text-2xl font-black">{formatRD(ticketTotal)}</span>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-950" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL DE COBRO (F12) Con Desglose Dominicano y e-CF DGII */}
      {/* ========================================================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del modal */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Cobrar Venta [F12]</span>
                </h3>
                <p className="text-xs text-slate-400">Total a Pagar: <strong className="text-emerald-400 font-mono text-sm">{formatRD(ticketTotal)}</strong></p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* 1. Tipo de Comprobante Fiscal (DGII Ley 32-23) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Tipo de Comprobante Electrónico (DGII)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNcfType('E32')}
                    className={`p-3 rounded-xl border text-left transition ${
                      ncfType === 'E32'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">E32 - Factura de Consumo</p>
                    <p className="text-[11px] text-slate-500">Público general / consumidor final</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNcfType('E31')}
                    className={`p-3 rounded-xl border text-left transition ${
                      ncfType === 'E31'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">E31 - Crédito Fiscal</p>
                    <p className="text-[11px] text-slate-500">Para empresas con RNC deducible</p>
                  </button>
                </div>

                {ncfType === 'E31' && (
                  <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">RNC o Cédula del Cliente *</label>
                      <input
                        type="text"
                        value={fiscalRnc}
                        onChange={(e) => setFiscalRnc(e.target.value)}
                        placeholder="Ej: 101889977 o 001-1234567-8"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Razón Social / Nombre Comercial *</label>
                      <input
                        type="text"
                        value={fiscalName}
                        onChange={(e) => setFiscalName(e.target.value)}
                        placeholder="Ej: Distribuidora Quisqueya SRL"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Método de Pago
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'efectivo', label: 'Efectivo', icon: DollarSign },
                    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                    { id: 'transferencia', label: 'Transferencia', icon: QrCode },
                    { id: 'credito', label: 'A Crédito', icon: User }
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 text-xs transition ${
                          paymentMethod === m.id
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Desglose en Efectivo y Billetes Dominicanos */}
              {paymentMethod === 'efectivo' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Monto Recibido en Efectivo RD$:</label>
                    <button
                      type="button"
                      onClick={() => setCashReceived(ticketTotal.toFixed(2))}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Monto Exacto [RD${ticketTotal.toFixed(2)}]
                    </button>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={`RD$${ticketTotal.toFixed(2)}`}
                    className="w-full px-4 py-2.5 bg-white border-2 border-emerald-400 rounded-xl text-lg font-black text-slate-800 text-right focus:outline-none focus:border-emerald-600"
                    autoFocus
                  />

                  {/* Botones de billetes dominicanos de denominación rápida */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-500 font-semibold block">Billetes Dominicanos:</span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[2000, 1000, 500, 200, 100, 50].map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setCashReceived(bill.toString())}
                          className="py-1.5 px-2 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-sm"
                        >
                          RD${bill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cambio / Devuelta */}
                  {parseFloat(cashReceived) > ticketTotal && (
                    <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">CAMBIO / DEVUELTA:</span>
                      <span className="text-xl font-black text-emerald-900 font-mono">
                        {formatRD(parseFloat(cashReceived) - ticketTotal)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'credito' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5">
                  <p className="font-bold text-amber-900">Venta cargada a la cuenta de crédito ("El Fiado"):</p>
                  <p className="text-amber-800">
                    Cliente: <strong>{activeTicket.client ? activeTicket.client.name : 'Ningún cliente seleccionado'}</strong>
                  </p>
                  {activeTicket.client && (
                    <p className="text-amber-800">
                      Límite disponible: {formatRD(activeTicket.client.credit_limit - activeTicket.client.current_balance)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Pie del modal de cobro */}
            <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition"
              >
                Cancelar [Esc]
              </button>
              <button
                type="button"
                onClick={handleProcessCheckout}
                disabled={processingSale}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-sm font-extrabold shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                {processingSale ? 'Transmitiendo a DGII...' : 'Confirmar & Cobrar [Enter]'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL TICKET TÉRMICO / IMPRESIÓN (80mm / 58mm) */}
      {/* ========================================================= */}
      {showReceiptModal && lastSaleReceipt && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Ticket de Venta #{lastSaleReceipt.id}</span>
              </span>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vista previa del ticket térmico */}
            <div className="p-4 bg-slate-50 max-h-[70vh] overflow-y-auto">
              <div 
                id="ticket-print-area" 
                className="bg-white p-4 border border-dashed border-slate-300 rounded text-black font-mono text-[11px] leading-tight space-y-2 shadow-inner"
              >
                {/* Encabezado del ticket */}
                <div className="text-center space-y-0.5 border-b pb-2">
                  <h4 className="font-extrabold text-sm">{storeSettings?.store_name || 'EMBLEMA POS'}</h4>
                  <p className="text-[10px]">{storeSettings?.slogan || 'PUNTO DE VENTA INTELIGENTE'}</p>
                  <p>RNC: {storeSettings?.rnc || '101010101'}</p>
                  <p>{storeSettings?.address || 'SANTO DOMINGO, REP. DOM.'}</p>
                  <p>TEL: {storeSettings?.phone || '809-555-0000'}</p>
                </div>

                {/* Datos Fiscales DGII */}
                <div className="border-b pb-1.5 space-y-0.5 text-[10px]">
                  <p className="font-bold text-blue-900">
                    e-NCF: {lastSaleReceipt.encf}
                  </p>
                  <p>Tipo: {lastSaleReceipt.ncf_type === 'E31' ? 'Crédito Fiscal (E31)' : 'Consumo (E32)'}</p>
                  <p>Fecha: {new Date(lastSaleReceipt.created_at).toLocaleString()}</p>
                  {lastSaleReceipt.client_name && (
                    <p>Cliente: {lastSaleReceipt.client_name}</p>
                  )}
                  {lastSaleReceipt.security_code && (
                    <p className="font-bold">Cód. Seguridad: {lastSaleReceipt.security_code}</p>
                  )}
                </div>

                {/* Items */}
                <div className="border-b pb-2">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b text-slate-600">
                        <th className="text-left pb-1">CANT/DESC</th>
                        <th className="text-right pb-1">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed">
                      {lastSaleReceipt.items?.map((it, i) => (
                        <tr key={i}>
                          <td className="py-1">
                            <div>{it.name}</div>
                            <div className="text-slate-500">{it.quantity} x {formatRD(it.unit_price)}</div>
                          </td>
                          <td className="text-right py-1 align-top font-bold">{formatRD(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totales */}
                <div className="space-y-1 text-right text-[11px]">
                  <p>Subtotal: {formatRD(lastSaleReceipt.subtotal)}</p>
                  <p>ITBIS (18%): {formatRD(lastSaleReceipt.itbis)}</p>
                  <p className="text-sm font-extrabold border-t pt-1">TOTAL: {formatRD(lastSaleReceipt.total)}</p>
                  {lastSaleReceipt.payment_method === 'efectivo' && (
                    <>
                      <p className="text-[10px] text-slate-600">Efectivo Recibido: {formatRD(lastSaleReceipt.cash_received)}</p>
                      <p className="text-[10px] text-slate-600 font-bold">Cambio / Devuelta: {formatRD(lastSaleReceipt.cash_change)}</p>
                    </>
                  )}
                </div>

                {/* Código QR DGII Ley 32-23 */}
                <div className="pt-2 text-center border-t space-y-1">
                  <div className="w-24 h-24 mx-auto border border-black flex items-center justify-center p-1 bg-white">
                    <QrCode className="w-20 h-20 text-black" />
                  </div>
                  <p className="text-[8px] text-slate-600 font-sans">Consulte su e-CF en dgii.gov.do</p>
                </div>

                {/* Pie del ticket */}
                <div className="text-center pt-1 text-[9px] text-slate-600 whitespace-pre-line">
                  {storeSettings?.ticket_footer || '¡Gracias por su compra!\nConserve este comprobante.'}
                </div>
              </div>
            </div>

            <div className="bg-slate-100 p-4 border-t flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ticket</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2.5 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL VERIFICADOR DE PRECIOS (F3) */}
      {/* ========================================================= */}
      {showPriceChecker && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-amber-500 text-slate-950 px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Search className="w-5 h-5" />
                <span>Verificador de Precios [F3]</span>
              </h3>
              <button onClick={() => setShowPriceChecker(false)} className="text-slate-900 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleCheckPrice} className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Escanea o escribe el código de barras:
                </label>
                <input
                  ref={priceCheckerInputRef}
                  type="text"
                  value={priceCheckerQuery}
                  onChange={(e) => setPriceCheckerQuery(e.target.value)}
                  placeholder="Escanea aquí..."
                  className="w-full px-4 py-2 bg-slate-50 border-2 border-amber-400 rounded-xl text-base font-bold focus:outline-none focus:border-amber-600"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition"
                >
                  Consultar Precio
                </button>
              </form>

              {priceCheckerResult && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-center">
                  <h4 className="font-extrabold text-slate-800 text-base">{priceCheckerResult.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">Código: {priceCheckerResult.barcode}</p>
                  <p className="text-3xl font-black text-amber-600 my-2">{formatRD(priceCheckerResult.sale_price)}</p>
                  <p className="text-xs text-slate-600">Stock disponible: <strong className="font-mono">{priceCheckerResult.stock}</strong></p>
                  {priceCheckerResult.wholesale_price && (
                    <p className="text-xs text-blue-700">
                      Precio mayoreo: {formatRD(priceCheckerResult.wholesale_price)} (a partir de {priceCheckerResult.wholesale_quantity} u.)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL SELECCIONAR CLIENTE (F10) */}
      {/* ========================================================= */}
      {showClientSelector && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                <span>Asignar Cliente al Ticket [F10]</span>
              </h3>
              <button onClick={() => setShowClientSelector(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                onKeyUp={loadClients}
                placeholder="Buscar por nombre, RNC o teléfono..."
                className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                autoFocus
              />

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                <div
                  onClick={() => handleSelectClient(null)}
                  className="p-3 hover:bg-slate-50 cursor-pointer text-xs flex items-center justify-between font-semibold text-slate-700"
                >
                  <span>Público General / Sin Registro</span>
                  <span className="text-[10px] text-slate-400">Consumo normal</span>
                </div>

                {clientsList.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className="p-3 hover:bg-blue-50 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        RNC/Cédula: {c.rnc_cedula || 'N/A'} | Tel: {c.phone || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-amber-700 font-medium block">
                        Deuda: {formatRD(c.current_balance)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Límite: {formatRD(c.credit_limit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
