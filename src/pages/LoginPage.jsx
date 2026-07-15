import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Loader2, Database, ShieldAlert, KeyRound, Mail } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();

        try {
            setError('');
            setLoading(true);
            await login(email, password);
            navigate('/'); // Redirigir al home
        } catch (err) {
            setError('Error al iniciar sesión. Verifica tus credenciales.');
            console.error(err);
        }

        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-900 to-indigo-950 p-4 relative overflow-hidden font-sans">
            {/* Elementos Decorativos de Fondo */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10 space-y-6">
                {/* Logo & Título */}
                <div className="text-center space-y-2">
                    <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center shadow-xl shadow-indigo-600/35 border border-indigo-500/30">
                        <Sparkles size={28} className="text-white animate-pulse" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">INAS</h1>
                    <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">Instituto Nueva América de Suba</p>
                </div>

                {/* Tarjeta de Formulario */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-slate-100">Iniciar Sesión</h2>
                        <p className="text-xs text-slate-400">Ingresa tus datos institucionales para continuar</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/25 text-red-200 text-xs px-4 py-3 rounded-2xl flex items-start gap-2.5">
                            <ShieldAlert className="shrink-0 text-red-400 mt-0.5" size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider">Correo Electrónico</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-3 text-slate-500"><Mail size={16} /></span>
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/45 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-200 text-sm transition"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@inas.edu.co"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider">Contraseña</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-3 text-slate-500"><KeyRound size={16} /></span>
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/45 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-200 text-sm transition"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/25"
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={18} /> Iniciando...</>
                            ) : (
                                'Ingresar al Portal'
                            )}
                        </button>
                    </form>

                    <div className="border-t border-slate-800 pt-4 flex flex-col items-center gap-2.5 text-xs text-slate-400">
                        <Link 
                            to="/seed" 
                            className="text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                        >
                            <Database size={14} /> Inicializar base de datos del curso 1001
                        </Link>
                        <span>¿Olvidaste tu contraseña? Contacta a soporte técnico.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
