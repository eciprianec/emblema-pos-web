import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Ventas from './components/Ventas';
import Clientes from './components/Clientes';
import Productos from './components/Productos';
import Inventarios from './components/Inventarios';
import Compras from './components/Compras';
import Cortes from './components/Cortes';
import Reportes from './components/Reportes';
import DGII from './components/DGII';
import Configuracion from './components/Configuracion';
import Login from './components/Login';
import { configApi, cortesApi } from './api';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('emblemapos_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentModule, setCurrentModule] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [storeSettings, setStoreSettings] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);

  useEffect(() => {
    if (user) {
      // Cargar configuración de tienda y estado de caja inicial
      configApi.getStore()
        .then(res => setStoreSettings(res.data))
        .catch(err => console.error("Error al cargar config de tienda:", err));

      cortesApi.getEstadoCaja()
        .then(res => setCajaAbierta(res.data.caja_abierta))
        .catch(err => console.error("Error al cargar estado de caja:", err));
    }
  }, [user]);

  // Atajos de teclado del sistema (F1 - F9)
  useEffect(() => {
    if (!user) return;
    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo en un input o textarea para no bloquear escritura
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setCurrentModule('ventas');
          break;
        case 'F2':
          e.preventDefault();
          setCurrentModule('clientes');
          break;
        case 'F3':
          if (!isInput) {
            e.preventDefault();
            setCurrentModule('productos');
          }
          break;
        case 'F4':
          e.preventDefault();
          setCurrentModule('inventarios');
          break;
        case 'F5':
          // F5 para actualizar navegador
          break;
        case 'F6':
          e.preventDefault();
          setCurrentModule('cortes');
          break;
        case 'F7':
          e.preventDefault();
          setCurrentModule('reportes');
          break;
        case 'F8':
          e.preventDefault();
          setCurrentModule('dgii');
          break;
        case 'F9':
          e.preventDefault();
          setCurrentModule('config');
          break;
        case 'Escape':
          if (!isInput && currentModule !== 'dashboard') {
            setCurrentModule('dashboard');
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, currentModule]);

  const handleLogout = () => {
    localStorage.removeItem('emblemapos_token');
    localStorage.removeItem('emblemapos_user');
    setUser(null);
    setCurrentModule('dashboard');
  };

  const handleQuickModal = (type) => {
    if (type === 'verificador') {
      setCurrentModule('ventas');
      // Despachar evento para activar F3
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3' }));
    } else if (type === 'entrada' || type === 'salida') {
      setCurrentModule('cortes');
    }
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 font-sans">
      {/* Barra Superior Header */}
      <Header
        user={user}
        storeSettings={storeSettings}
        onLogout={handleLogout}
        onOpenQuickModal={handleQuickModal}
        toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        cajaAbierta={cajaAbierta}
        onNavigate={setCurrentModule}
      />

      {/* Contenedor Principal (Sidebar + Módulo Activo) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Barra Lateral Navegación */}
        <Sidebar
          currentModule={currentModule}
          onSelectModule={setCurrentModule}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />

        {/* Área de Visualización del Módulo */}
        <main className="flex-1 overflow-y-auto bg-slate-100">
          {currentModule === 'dashboard' && (
            <Dashboard onNavigate={setCurrentModule} user={user} />
          )}

          {currentModule === 'ventas' && (
            <Ventas
              storeSettings={storeSettings}
              cajaAbierta={cajaAbierta}
              onOpenCorte={() => setCurrentModule('cortes')}
            />
          )}

          {currentModule === 'clientes' && (
            <Clientes storeSettings={storeSettings} />
          )}

          {currentModule === 'productos' && (
            <Productos />
          )}

          {currentModule === 'inventarios' && (
            <Inventarios />
          )}

          {currentModule === 'compras' && (
            <Compras />
          )}

          {currentModule === 'cortes' && (
            <Cortes
              storeSettings={storeSettings}
              cajaAbierta={cajaAbierta}
              onCajaStatusChange={setCajaAbierta}
            />
          )}

          {currentModule === 'reportes' && (
            <Reportes />
          )}

          {currentModule === 'dgii' && (
            <DGII />
          )}

          {currentModule === 'config' && (
            <Configuracion onStoreUpdate={setStoreSettings} />
          )}
        </main>
      </div>
    </div>
  );
}
