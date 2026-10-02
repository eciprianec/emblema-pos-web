import React, { useState, useEffect } from 'react';
import { 
  Store, 
  User, 
  Clock, 
  DollarSign, 
  ArrowDownRight, 
  ArrowUpRight, 
  Search, 
  LogOut,
  ShieldCheck,
  Menu
} from 'lucide-react';

export default function Header({ 
  user, 
  storeSettings, 
  onLogout, 
  onOpenQuickModal, 
  toggleSidebar,
  cajaAbierta,
  onNavigate
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRDDate = (d) => {
    return d.toLocaleDateString('es-DO', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md select-none border-b border-slate-800">
      {/* Lado izquierdo: Botón Menú + Identidad del Negocio */}
      <div className="flex items-center space-x-3">
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Alternar Menú Lateral"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white font-bold flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-wide flex items-center gap-1.5">
              {storeSettings?.store_name || 'Emblema POS'}
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                WEB
              </span>
            </h1>
            <p className="text-xs text-slate-400 leading-none">
              {storeSettings?.slogan || 'Punto de Venta con Facturación e-CF DGII'}
            </p>
          </div>
        </div>
      </div>

      {/* Centro: Acciones Rápidas */}
      <div className="hidden lg:flex items-center space-x-2">
        <button
          onClick={() => onOpenQuickModal && onOpenQuickModal('verificador')}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs border border-slate-700 transition"
          title="Verificador de Precios (F3)"
        >
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span>F3 Checador</span>
        </button>

        <button
          onClick={() => onOpenQuickModal && onOpenQuickModal('entrada')}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs border border-slate-700 transition"
          title="Entrada de Efectivo a Caja (F7)"
        >
          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
          <span>F7 Entrada RD$</span>
        </button>

        <button
          onClick={() => onOpenQuickModal && onOpenQuickModal('salida')}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs border border-slate-700 transition"
          title="Salida de Efectivo de Caja (F8)"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          <span>F8 Salida RD$</span>
        </button>

        <div className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs bg-slate-800/80 border border-slate-700/60 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-mono">{time.toLocaleTimeString()}</span>
          <span className="text-slate-500">|</span>
          <span className="capitalize text-[11px]">{formatRDDate(time)}</span>
        </div>
      </div>

      {/* Lado derecho: Estado de Caja + Usuario Activo + Salir */}
      <div className="flex items-center space-x-3">
        {/* Indicador de Turno/Caja */}
        <button
          onClick={() => onNavigate && onNavigate('cortes')}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
            cajaAbierta
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900'
              : 'bg-amber-950 text-amber-300 border border-amber-700/60 hover:bg-amber-900'
          }`}
          title="Ver estado de caja y turnos (F6)"
        >
          <span className={`w-2 h-2 rounded-full ${cajaAbierta ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{cajaAbierta ? 'Turno Abierto' : 'Caja Cerrada (F6)'}</span>
        </button>

        {/* Info Cajero */}
        <div className="flex items-center space-x-2 border-l border-slate-700 pl-3">
          <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold leading-none">{user?.full_name || user?.username || 'Cajero'}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role || 'Ventas'}</p>
          </div>
        </div>

        {/* Salir */}
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-colors"
          title="Cerrar Sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
