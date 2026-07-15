import { useState } from 'react';
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
import ImportCourse from './pages/admin/ImportCourse';
import ImportGrades from './pages/admin/ImportGrades';
import PrintBoletin from './pages/admin/PrintBoletin';
import PrintPlanilla from './pages/admin/PrintPlanilla';
import { PlusCircle, Home as HomeIcon, User, Search, BookOpen, Calendar as CalendarIcon, ClipboardList, MessageSquare, FileText, Table, Menu, X, LogOut, Bell, Sparkles, Printer } from 'lucide-react';

function Layout({ children }) {
  const { currentUser, userRole, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  if (!currentUser) return <Navigate to="/login" />;

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
          </>
        );
      case 'parent':
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
              to="/admin/import" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/import') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <Table size={18} /> Importar Curso
            </Link>
            <Link 
              to="/admin/import-grades" 
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-semibold ${
                isActive('/admin/import-grades') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <BookOpen size={18} /> Importar Notas
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
      case 'parent': return 'Acudiente';
      default: return 'Invitado';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white hidden md:flex flex-col border-r border-slate-800/40 shrink-0 sticky top-0 h-screen z-30">
        {/* Sidebar Header */}
        <div className="h-16 px-6 border-b border-slate-800/40 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-lg border border-slate-800 shrink-0">
            <img src="/Escudo.png" alt="INAS" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold tracking-wide uppercase leading-none">INAS</h2>
            <span className="text-[9px] text-slate-400 font-bold tracking-wide">NUEVA AMÉRICA DE SUBA</span>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800/40 bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-2.5 px-2">
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
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Mobile Navigation */}
      <aside className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-out md:hidden flex flex-col ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-slate-800 shrink-0">
              <img src="/Escudo.png" alt="INAS" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold uppercase">INAS</h2>
              <span className="text-[10px] text-slate-400">NUEVA AMÉRICA DE SUBA</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-2.5 px-2">
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
            className="w-full flex items-center justify-center gap-2 bg-slate-850 hover:bg-red-950/40 hover:text-red-400 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-300 border border-slate-800"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 md:hidden transition"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-bold text-gray-700 hidden md:block">
              {location.pathname === '/' ? 'Tablero General' : 'Panel de Control'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-gray-100"></div>
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-800 leading-none">{currentUser.displayName || currentUser.email}</p>
                <span className="text-[9px] text-gray-400 font-bold tracking-wide mt-0.5 inline-block">{getRoleLabel()}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-xs shadow-inner">
                {(currentUser.displayName || currentUser.email).charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Children Panel */}
        <main className="flex-1 p-6 md:p-8 bg-slate-50/50 overflow-y-auto">
          <div className="max-w-6xl w-full mx-auto">
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
          <Route path="/seed" element={<SeedPage />} />

          <Route path="/" element={<Layout><Dashboard /></Layout>} />

           {/* Admin Routes */}
          <Route path="/admin/new-circular" element={<Layout><CreateCircular /></Layout>} />
          <Route path="/admin/import" element={<Layout><ImportCourse /></Layout>} />
          <Route path="/admin/import-grades" element={<Layout><ImportGrades /></Layout>} />
          <Route path="/admin/boletin/:studentId" element={<Layout><GradesCard /></Layout>} />
          <Route path="/admin/boletin-print/:studentId" element={<PrintBoletin />} />
          <Route path="/planilla-print" element={<PrintPlanilla />} />

          {/* Teacher Routes */}
          <Route path="/teacher/search" element={<Layout><StudentSearch /></Layout>} />
          <Route path="/teacher/log/:studentId" element={<Layout><LogEntry /></Layout>} />
          <Route path="/teacher/create-task" element={<Layout><CreateTask /></Layout>} />
          <Route path="/teacher/sync-grades" element={<Layout><SyncGrades /></Layout>} />

          {/* Parent Routes */}
          <Route path="/parent/observer" element={<Layout><StudentObserver /></Layout>} />
          <Route path="/parent/id" element={<Layout><DigitalID /></Layout>} />
          <Route path="/parent/grades" element={<Layout><GradesCard /></Layout>} />
          <Route path="/parent/attendance" element={<Layout><AttendanceTracker /></Layout>} />
          <Route path="/parent/tasks" element={<Layout><HomeworkCalendar /></Layout>} />
          
          {/* Shared Routes */}
          <Route path="/messages" element={<Layout><MessagingPage /></Layout>} />

        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
