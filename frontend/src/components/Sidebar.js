import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  Boxes, 
  Truck, 
  Receipt, 
  BarChart3, 
  FileCheck, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ currentModule, onSelectModule, isCollapsed, setIsCollapsed }) {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Panel Principal',
      shortcut: 'Inicio',
      icon: LayoutDashboard,
      color: 'text-sky-500',
      activeBg: 'bg-sky-600 text-white',
    },
    {
      id: 'ventas',
      label: 'F1: Ventas',
      shortcut: 'F1',
      icon: ShoppingCart,
      color: 'text-emerald-500',
      activeBg: 'bg-emerald-600 text-white',
    },
    {
      id: 'clientes',
      label: 'F2: Clientes & Crédito',
      shortcut: 'F2',
      icon: Users,
      color: 'text-indigo-500',
      activeBg: 'bg-indigo-600 text-white',
    },
    {
      id: 'productos',
      label: 'F3: Productos',
      shortcut: 'F3',
      icon: Package,
      color: 'text-amber-500',
      activeBg: 'bg-amber-600 text-white',
    },
    {
      id: 'inventarios',
      label: 'F4: Inventarios',
      shortcut: 'F4',
      icon: Boxes,
      color: 'text-cyan-500',
      activeBg: 'bg-cyan-600 text-white',
    },
    {
      id: 'compras',
      label: 'F5: Compras',
      shortcut: 'F5',
      icon: Truck,
      color: 'text-orange-500',
      activeBg: 'bg-orange-600 text-white',
    },
    {
      id: 'cortes',
      label: 'F6: Cortes de Caja',
      shortcut: 'F6',
      icon: Receipt,
      color: 'text-purple-500',
      activeBg: 'bg-purple-600 text-white',
    },
    {
      id: 'reportes',
      label: 'F7: Reportes & Ganancias',
      shortcut: 'F7',
      icon: BarChart3,
      color: 'text-rose-500',
      activeBg: 'bg-rose-600 text-white',
    },
    {
      id: 'dgii',
      label: 'F8: Facturación DGII',
      shortcut: 'F8',
      icon: FileCheck,
      color: 'text-blue-500',
      activeBg: 'bg-blue-600 text-white',
    },
    {
      id: 'config',
      label: 'F9: Configuración',
      shortcut: 'F9',
      icon: Settings,
      color: 'text-slate-400',
      activeBg: 'bg-slate-700 text-white',
    },
  ];

  return (
    <aside 
      className={`bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Lista de Módulos */}
      <div className="py-2 overflow-y-auto overflow-x-hidden">
        <nav className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                  isActive
                    ? `${item.activeBg} shadow-sm font-semibold`
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={isCollapsed ? `${item.shortcut} - ${item.label}` : ''}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : item.color}`} />
                
                {!isCollapsed && (
                  <div className="ml-3 flex-1 flex items-center justify-between text-left">
                    <span className="truncate">{item.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                    }`}>
                      {item.shortcut}
                    </span>
                  </div>
                )}

                {/* Tooltip flotante si está colapsado */}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 w-max px-2 py-1 bg-slate-950 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Pie del Menú con botón de colapso */}
      <div className="p-2 border-t border-slate-800">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition"
          title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center space-x-2">
              <ChevronLeft className="w-4 h-4" />
              <span>Colapsar Menú</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
