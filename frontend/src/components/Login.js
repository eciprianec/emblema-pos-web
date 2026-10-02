import React, { useState } from 'react';
import { Store, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi } from '../api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin1234*');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login({
        username_or_email: username,
        password: password
      });

      localStorage.setItem('emblemapos_token', res.data.access_token);
      localStorage.setItem('emblemapos_user', JSON.stringify(res.data.user));
      onLoginSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || "Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="bg-slate-950 p-8 text-center text-white relative">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30 mb-3">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Emblema POS</h2>
          <p className="text-xs text-slate-400 mt-1">
            Punto de Venta Web con Facturación Electrónica DGII (Ley 32-23)
          </p>
          <div className="mt-2">
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono">
              Powered by Ciber Emblema
            </span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Usuario o Correo</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white font-mono"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Iniciando sesión...' : 'Ingresar al Punto de Venta'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Accesos rápidos de prueba */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <span className="text-[11px] text-slate-400 font-semibold block">Cuentas de demostración:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'Admin1234*')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition"
              >
                <p className="font-bold text-slate-800 text-[11px]">Administrador</p>
                <p className="text-[10px] text-slate-500 font-mono">admin / Admin1234*</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('cajero', 'Cajero1234*')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition"
              >
                <p className="font-bold text-slate-800 text-[11px]">Cajero</p>
                <p className="text-[10px] text-slate-500 font-mono">cajero / Cajero1234*</p>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
