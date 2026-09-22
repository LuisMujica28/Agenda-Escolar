import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CreateCircular from './pages/admin/CreateCircular';
import StudentSearch from './pages/teacher/StudentSearch';
import LogEntry from './pages/teacher/LogEntry';
import StudentObserver from './pages/parent/StudentObserver';
import DigitalID from './pages/parent/DigitalID';
import SeedPage from './pages/SeedPage';
import GradesCard from './pages/parent/GradesCard';
import AttendanceTracker from './pages/parent/AttendanceTracker';
import HomeworkCalendar from './pages/parent/HomeworkCalendar';
import MessagingPage from './pages/parent/MessagingPage';
import CreateTask from './pages/teacher/CreateTask';
import SyncGrades from './pages/teacher/SyncGrades';
import ImportData from './pages/admin/ImportData';
import PrintBoletin from './pages/admin/PrintBoletin';
import PrintPlanilla from './pages/admin/PrintPlanilla';
import PrintConsolidado from './pages/admin/PrintConsolidado';
import PrintFormularioInscripcion from './pages/admin/PrintFormularioInscripcion';
import AcademicStats from './pages/admin/AcademicStats';
import DailyAttendance from './pages/teacher/DailyAttendance';
import DunasBackground from './components/DunasBackground';
import ProtectedRoute from './components/ProtectedRoute';
import { PlusCircle, Home as HomeIcon, User, Search, BookOpen, Calendar as CalendarIcon, ClipboardList, MessageSquare, FileText, Table, Menu, X, LogOut, Bell, Sparkles, Printer, BarChart2, Layers, Award, UserCheck } from 'lucide-react';

function Layout({ children }) {
  const { currentUser, userRole, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Reset sidebar state on route change and window resize
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!currentUser) return <Navigate to="/login" replace />;

  // Helper para verificar ruta activa
  const isActive = (path) => location.pathname === path;

  // Renderizar enlaces del menú
  const renderNavLinks = () => {
    switch (userRole) {
      case 'teacher':
        return (
          <>
            <Link 
              to="/" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <HomeIcon size={18} /> Inicio (Tablero)
            </Link>
            <Link 
              to="/teacher/daily-attendance" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/teacher/daily-attendance') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <UserCheck size={18} /> Pase de Lista Diario
            </Link>
            <Link 
              to="/teacher/search" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/teacher/search') || location.pathname.startsWith('/teacher/log') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <Search size={18} /> Buscar Alumnos
            </Link>
            <Link 
              to="/teacher/create-task" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/teacher/create-task') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <ClipboardList size={18} /> Crear Tarea
            </Link>
            <Link 
              to="/teacher/sync-grades" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/teacher/sync-grades') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <BookOpen size={18} /> Sincronizar Notas
            </Link>
            <Link 
              to="/messages" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/messages') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <MessageSquare size={18} /> Mensajería
            </Link>
            <Link 
              to="/planilla-print" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/planilla-print') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <Printer size={18} /> Planilla de Control
            </Link>
            <Link 
              to="/admin/stats" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/stats') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <BarChart2 size={18} /> Estadísticas Académicas
            </Link>
          </>
        );
      case 'parent':
      case 'student':
      case 'estudiante':
        return (
          <>
            <Link 
              to="/" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <HomeIcon size={18} /> Inicio (Tablero)
            </Link>
            <Link 
              to="/parent/observer" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/parent/observer') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <FileText size={18} /> Observador Escolar
            </Link>
            <Link 
              to="/parent/grades" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/parent/grades') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <BookOpen size={18} /> Boletín de Notas
            </Link>
            <Link 
              to="/parent/attendance" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/parent/attendance') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <CalendarIcon size={18} /> Control Asistencia
            </Link>
            <Link 
              to="/parent/tasks" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/parent/tasks') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <ClipboardList size={18} /> Agenda de Tareas
            </Link>
            <Link 
              to="/messages" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/messages') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <MessageSquare size={18} /> Buzón de Mensajes
            </Link>
            <Link 
              to="/parent/id" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/parent/id') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <User size={18} /> Carnet Estudiantil
            </Link>
          </>
        );
      case 'admin':
        return (
          <>
            <Link 
              to="/" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <HomeIcon size={18} /> Inicio (Tablero)
            </Link>
            <Link 
              to="/teacher/daily-attendance" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/teacher/daily-attendance') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <UserCheck size={18} /> Pase de Lista Diario
            </Link>
            <Link 
              to="/admin/import" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/import') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <Layers size={18} /> Carga Masiva
            </Link>
            <Link 
              to="/teacher/sync-grades" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/teacher/sync-grades') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <ClipboardList size={18} /> Planilla Digital de Notas
            </Link>
            <Link 
              to="/admin/new-circular" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/new-circular') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <PlusCircle size={18} /> Publicar Circular
            </Link>
            <Link 
              to="/planilla-print" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/planilla-print') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <Printer size={18} /> Planilla de Control
            </Link>
            <Link 
              to="/admin/boletin-print" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/boletin-print') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <BookOpen size={18} /> Boletines (Masivo)
            </Link>
            <Link 
              to="/admin/consolidado-print" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/consolidado-print') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <Award size={18} /> Consolidado & Ranking
            </Link>
            <Link 
              to="/admin/formulario-inscripcion" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/formulario-inscripcion') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <FileText size={18} /> Formulario Inscripción
            </Link>
            <Link 
              to="/admin/stats" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/stats') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <BarChart2 size={18} /> Estadísticas Académicas
            </Link>
          </>
        );
      default:
        return null;
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Docente';
      case 'student':
      case 'estudiante':
      case 'parent':
      default:
        return 'Estudiante';
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Fondo de Dunas generado con código puro (SVG + Mesh en Blanco y Azul) */}
      <DunasBackground />

      {/* Sidebar Desktop (Fijo en pantalla) */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white hidden md:flex flex-col border-r border-slate-800/40 shrink-0 fixed top-0 bottom-0 left-0 h-screen z-30">
        {/* Sidebar Header: Escudo con fondo blanco de alto contraste y Nombre Institucional */}
        <div className="p-4 border-b border-slate-800/40 flex items-center gap-3 bg-slate-950/40">
          <div className="w-11 h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-lg shadow-white/5 border border-white/40 ring-2 ring-indigo-500/30">
            <img src="/Escudo1.png" alt="Escudo Institucional" className="w-full h-full object-contain filter drop-shadow-sm" />
          </div>
          <div className="leading-tight text-left">
            <span className="text-[10px] text-slate-100 font-black tracking-wider uppercase block">
              INSTITUTO NUEVA AMÉRICA DE SUBA
            </span>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        {/* Imagen transparente sin fondo INAS.png libre sobre el fondo lateral */}
        <div className="py-2 px-2 text-center flex items-center justify-center my-1">
          <img 
            src="/INAS.png" 
            alt="INAS" 
            className="w-52 h-auto max-h-20 object-contain drop-shadow-lg opacity-95 hover:opacity-100 transition transform hover:scale-105" 
          />
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800/40 bg-slate-950/60 space-y-3">
          <div className="flex items-center gap-2.5 px-2 text-left">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700/50 shrink-0">
              <User size={16} className="text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-100 truncate leading-none">{currentUser.displayName || currentUser.email}</p>
              <span className="inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 bg-indigo-500/20 border border-indigo-500/35 text-indigo-300">
                {getRoleLabel()}
              </span>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-950/40 hover:text-red-400 border border-slate-700/30 hover:border-red-900/30 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-300"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Sidebar Mobile Overlay (Drawer) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
          style={{ display: window.innerWidth >= 768 ? 'none' : 'block' }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Mobile Navigation */}
      <aside className={`fixed top-0 bottom-0 left-0 w-72 max-w-[80vw] h-[100dvh] bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-out md:hidden flex flex-col shadow-2xl ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 pt-safe">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md border border-white/40 ring-1 ring-indigo-500/30">
              <img src="/Escudo1.png" alt="Escudo Institucional" className="w-full h-full object-contain" />
            </div>
            <span className="text-[9px] text-slate-100 font-black tracking-wide uppercase text-left leading-tight truncate">
              INSTITUTO NUEVA AMÉRICA DE SUBA
            </span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        {/* Imagen transparente sin fondo INAS.png Mobile */}
        <div className="py-1 px-3 text-center flex items-center justify-center">
          <img src="/INAS.png" alt="INAS" className="w-44 h-auto max-h-16 object-contain drop-shadow-md" />
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3 pb-safe">
          <div className="flex items-center gap-2.5 px-1 text-left">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
              <User size={16} className="text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-100 truncate leading-none">{currentUser.displayName || currentUser.email}</p>
              <span className="inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 bg-indigo-500/20 text-indigo-300">
                {getRoleLabel()}
              </span>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="w-full flex items-center justify-center gap-2 bg-slate-850 hover:bg-red-950/40 hover:text-red-400 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-300 border border-slate-800 min-h-[42px]"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area (con padding izquierdo correspondiente a la barra lateral fija) */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        {/* Top Header Bar con Glassmorphism */}
        <header className="h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20 shadow-xs transition-all pt-safe">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 md:hidden transition active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
              aria-label="Abrir menú de navegación"
            >
              <Menu size={22} />
            </button>
            <h2 className="text-xs sm:text-sm font-bold text-gray-700 truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
              {location.pathname === '/' ? 'Tablero General' : 'Panel de Control'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition relative min-w-[40px] min-h-[40px] flex items-center justify-center">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-7 w-px bg-gray-100 hidden sm:block"></div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-800 leading-none">{currentUser.displayName || currentUser.email}</p>
                <span className="text-[9px] text-gray-400 font-bold tracking-wide mt-0.5 inline-block">{getRoleLabel()}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-xs shadow-inner shrink-0">
                {(currentUser.displayName || currentUser.email).charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Children Panel Responsivo con margen cómodo en Mobile (360px-430px) */}
        <main className="flex-1 px-3 py-3.5 sm:p-6 md:p-8 lg:px-10 lg:py-8 overflow-y-auto min-w-0 relative z-10 pb-safe">
          <div className="w-full max-w-[1440px] mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/seed" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SeedPage />
              </ProtectedRoute>
            } 
          />

          {/* Tablero Principal y Mensajería Compartida */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent', 'student', 'estudiante']}>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/messages" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent', 'student', 'estudiante']}>
                <Layout><MessagingPage /></Layout>
              </ProtectedRoute>
            } 
          />

          {/* Rutas Administrativas y Académicas Compartidas */}
          <Route 
            path="/admin/stats" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                <Layout><AcademicStats /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/new-circular" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout><CreateCircular /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/import" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout><ImportData /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/boletin/:studentId" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent', 'student', 'estudiante']}>
                <Layout><GradesCard /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/boletin-print/:studentId?" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent', 'student', 'estudiante']}>
                <PrintBoletin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/consolidado-print" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PrintConsolidado />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/formulario-inscripcion/:studentId?" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PrintFormularioInscripcion />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/planilla-print" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                <PrintPlanilla />
              </ProtectedRoute>
            } 
          />

          {/* Rutas para Docentes */}
          <Route 
            path="/teacher/daily-attendance" 
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <Layout><DailyAttendance /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teacher/search" 
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <Layout><StudentSearch /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teacher/log/:studentId" 
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <Layout><LogEntry /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teacher/create-task" 
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <Layout><CreateTask /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teacher/sync-grades" 
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <Layout><SyncGrades /></Layout>
              </ProtectedRoute>
            } 
          />

          {/* Rutas para Acudientes / Estudiantes */}
          <Route 
            path="/parent/observer" 
            element={
              <ProtectedRoute allowedRoles={['parent', 'student', 'estudiante', 'admin']}>
                <Layout><StudentObserver /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/parent/id" 
            element={
              <ProtectedRoute allowedRoles={['parent', 'student', 'estudiante', 'admin']}>
                <Layout><DigitalID /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/parent/grades" 
            element={
              <ProtectedRoute allowedRoles={['parent', 'student', 'estudiante', 'admin']}>
                <Layout><GradesCard /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/parent/attendance" 
            element={
              <ProtectedRoute allowedRoles={['parent', 'student', 'estudiante', 'admin']}>
                <Layout><AttendanceTracker /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/parent/tasks" 
            element={
              <ProtectedRoute allowedRoles={['parent', 'student', 'estudiante', 'admin']}>
                <Layout><HomeworkCalendar /></Layout>
              </ProtectedRoute>
            } 
          />

          {/* Alias para /dashboard y Redirección por defecto */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
