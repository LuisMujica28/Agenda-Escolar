import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, ShieldAlert, KeyRound, Mail } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    async function handleGoogleLogin() {
        try {
            setError('');
            setGoogleLoading(true);
            await loginWithGoogle();
            navigate('/');
        } catch (err) {
            console.error("Error en Google Sign-In:", err);
            if (err.code === 'auth/popup-closed-by-user') {
                // Usuario cerró el popup intencionalmente
                setError('');
            } else if (err.code === 'auth/unauthorized-domain') {
                setError('Acceso denegado: Debes iniciar sesión con tu cuenta de correo institucional @inas.edu.co.');
            } else if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
                setError('El proveedor de Google aún no está activo en Firebase Console. Por favor actívalo en Authentication > Sign-in method.');
            } else {
                setError(err.message || 'No fue posible iniciar sesión con Google Institucional. Inténtalo de nuevo.');
            }
        } finally {
            setGoogleLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const cleanEmail = email.trim().toLowerCase();
        
        // Validación estricta de dominio institucional (@inas.edu.co)
        // Se mantiene admin@colegio.com para compatibilidad administrativa de despliegue
        if (!cleanEmail.endsWith('@inas.edu.co') && cleanEmail !== 'admin@colegio.com') {
            setError('Acceso denegado: Solo se permiten cuentas institucionales autorizadas con dominio @inas.edu.co.');
            return;
        }

        try {
            setError('');
            setLoading(true);
            await login(cleanEmail, password);
            navigate('/'); // Redirigir al panel principal
        } catch (err) {
            console.error("Error en autenticación:", err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Credenciales inválidas. Verifica tu correo y contraseña institucional.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Demasiados intentos fallidos por seguridad. Inténtalo de nuevo más tarde.');
            } else {
                setError('Error al iniciar sesión. Verifica tus credenciales de acceso institucional.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-900 to-indigo-950 p-4 relative overflow-hidden font-sans">
            {/* Elementos Decorativos de Fondo */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5E7892]/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10 space-y-6">
                {/* Logo & Título */}
                <div className="text-center space-y-2">
                    <div className="inline-flex w-16 h-16 rounded-2xl bg-white p-2 items-center justify-center shadow-xl shadow-indigo-600/30 border border-white/40 ring-2 ring-indigo-500/30">
                        <img src="/Escudo1.png" alt="Escudo INAS" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">INAS</h1>
                    <p className="text-slate-300 text-sm font-bold tracking-wide uppercase">Instituto Nueva América de Suba</p>
                    <p className="text-indigo-300/80 text-[10.5px] italic max-w-sm mx-auto font-medium leading-tight">
                        “Ciudadanos productivos desde la construcción de proyectos de vida con calidad y responsabilidad ambiental”
                    </p>
                </div>

                {/* Tarjeta de Formulario */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-slate-100">Portal Institucional</h2>
                        <p className="text-xs text-slate-400">Ingresa con tu cuenta de Google del colegio o credenciales</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/25 text-red-200 text-xs px-4 py-3 rounded-2xl flex items-start gap-2.5 leading-relaxed">
                            <ShieldAlert className="shrink-0 text-red-400 mt-0.5" size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Botón Principal: Google Workspace for Education */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || loading}
                        className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-white/5 flex items-center justify-center gap-3 text-sm active:scale-[0.99] border border-slate-200 group cursor-pointer"
                    >
                        {googleLoading ? (
                            <><Loader2 className="animate-spin text-indigo-600" size={18} /> Conectando con Google...</>
                        ) : (
                            <>
                                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <span className="text-slate-800 font-bold">Ingresar con Google Institucional</span>
                            </>
                        )}
                    </button>

                    {/* Divisor Visual */}
                    <div className="relative flex py-0.5 items-center">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink mx-3 text-slate-500 text-[10px] font-bold uppercase tracking-wider">o con contraseña institucional</span>
                        <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider">Correo Institucional</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-3 text-slate-500"><Mail size={16} /></span>
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-200 text-sm transition placeholder:text-slate-600"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nombre@inas.edu.co"
                                    autoComplete="username"
                                />
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">Dominio requerido: @inas.edu.co</span>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider">Contraseña</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-3 text-slate-500"><KeyRound size={16} /></span>
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-200 text-sm transition placeholder:text-slate-600"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/25 mt-2"
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={18} /> Validando credenciales...</>
                            ) : (
                                'Ingresar al Portal Institucional'
                            )}
                        </button>
                    </form>

                    {/* Aviso de Seguridad y Privacidad */}
                    <div className="border-t border-slate-800/80 pt-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px]">
                            <Sparkles size={12} className="text-indigo-400" />
                            <span>Acceso restringido a la comunidad educativa INAS</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">
                            Protección de datos conforme a la Ley Estatutaria 1581 de 2012.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
