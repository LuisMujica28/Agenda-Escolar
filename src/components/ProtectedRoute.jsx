import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
    const { currentUser, userRole, loading } = useAuth();
    const location = useLocation();

    // 1. Mientras se verifica la autenticación y el rol
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-white">
                <Loader2 className="animate-spin text-indigo-500" size={40} />
                <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Verificando credenciales de seguridad...
                </p>
            </div>
        );
    }

    // 2. Si no hay sesión activa, redirigir a Login
    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. Si hay roles permitidos especificados, verificar que el rol del usuario coincida
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-slate-850 border border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
                    <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
                        <ShieldAlert size={30} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Acceso Restringido</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Tu cuenta institucional no tiene los permisos requeridos para acceder a este módulo.
                        </p>
                    </div>
                    <div className="bg-slate-900/80 rounded-xl p-3 text-[11px] text-slate-300 font-medium text-left space-y-1 border border-slate-800">
                        <p>👤 <strong>Usuario:</strong> {currentUser.email}</p>
                        <p>🏷️ <strong>Rol asignado:</strong> <span className="uppercase text-indigo-400 font-bold">{userRole || 'Sin rol'}</span></p>
                        <p>🔒 <strong>Permisos requeridos:</strong> <span className="uppercase text-amber-400 font-bold">{allowedRoles.join(' / ')}</span></p>
                    </div>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
                    >
                        Volver a Mi Panel Principal
                    </button>
                </div>
            </div>
        );
    }

    return children;
}
