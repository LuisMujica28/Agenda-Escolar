import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    Loader2, ArrowLeft, Printer, Award, BookOpen, AlertTriangle, 
    CheckCircle2, Trophy, Medal, Search, ChevronDown, ChevronUp, 
    FileSpreadsheet, Sparkles, Filter, X, Users
} from 'lucide-react';

const SUBJECTS_LIST = [
    { key: 'Artes plásticas', short: 'ARTES PLÁSTICAS' },
    { key: 'C. Naturales (Física)', short: 'FÍSICA' },
    { key: 'C Naturales (Química)', short: 'QUÍMICA' },
    { key: 'C. Naturales (Biología)', short: 'BIOLOGÍA' },
    { key: 'C Sociales Filosofía', short: 'SOCIALES / FILOSOFÍA' },
    { key: 'C Políticas Económicas', short: 'POLÍTICAS Y ECON.' },
    { key: 'Ed Ética y Valores', short: 'ÉTICA Y VALORES' },
    { key: 'Ed Física', short: 'ED. FÍSICA' },
    { key: 'Ed Religiosa y Moral', short: 'RELIGIOSA Y MORAL' },
    { key: 'Tecnología e Informática', short: 'INFORMÁTICA' },
    { key: 'Español y Literatura', short: 'ESPAÑOL' },
    { key: 'Geometría', short: 'GEOMETRÍA' },
    { key: 'Inglés', short: 'INGLÉS' },
    { key: 'Matemáticas', short: 'MATEMÁTICAS' }
];

export default function PrintConsolidado() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('ALL');
    const [selectedPeriod, setSelectedPeriod] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [logoError, setLogoError] = useState(false);

    const [rankedStudents, setRankedStudents] = useState([]);

    // Vista Responsiva: 'cards' (Ranking móvil y tarjetas interactivas) o 'table' (Sábana de impresión oficial)
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 'cards' : 'table';
        }
        return 'table';
    });

    // Estados para la vista de ranking interactiva en celulares
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'TOP10', 'CLEAN', 'FAIL'
    const [expandedStudentId, setExpandedStudentId] = useState(null);

    // Cargar cursos disponibles
    useEffect(() => {
        async function loadCourses() {
            try {
                const cSnap = await getDocs(collection(db, 'courses'));
                let unique = [];
                if (!cSnap.empty) {
                    unique = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                } else {
                    const snap = await getDocs(collection(db, 'students'));
                    const list = snap.docs.map(d => d.data().grade).filter(Boolean);
                    unique = Array.from(new Set(list));
                    for (const c of unique) {
                        await setDoc(doc(db, 'courses', c), { created_at: new Date() });
                    }
                    unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                }
                setCourses(unique);
            } catch (e) {
                console.error("Error al cargar cursos:", e);
            }
        }
        loadCourses();
    }, []);

    // Cargar y procesar datos del consolidado
    useEffect(() => {
        async function fetchAndCalculateConsolidado() {
            setLoading(true);
            try {
                // 1. Cargar estudiantes filtrados o todos
                let qStudents;
                if (selectedCourse === 'ALL') {
                    qStudents = query(collection(db, 'students'));
                } else {
                    qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
                }

                const sSnap = await getDocs(qStudents);
                let rawStudentsData = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Deduplicar estudiantes por nombre y código
                const uniqueMap = new Map();
                rawStudentsData.forEach(st => {
                    const normName = (st.name || `${st.lastName || ''} ${st.firstName || ''}`).trim().toUpperCase();
                    if (!uniqueMap.has(normName)) {
                        uniqueMap.set(normName, st);
                    }
                });
                let studentsData = Array.from(uniqueMap.values()).filter(st => st.status !== 'retirado');

                // 2. Cargar calificaciones
                const gSnap = await getDocs(collection(db, 'grades'));
                const gradesData = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // 3. Procesar asignaturas y promedios por estudiante
                const computed = studentsData.map(student => {
                    const studentGrades = gradesData.filter(g => g.student_id === student.id);

                    const subjectsBreakdown = {};
                    let totalSubjectsCount = 0;
                    let accumulatedSum = 0;
                    let failedSubjectsCount = 0;

                    SUBJECTS_LIST.forEach(subjObj => {
                        const subjKey = subjObj.key;
                        let subjGrades = studentGrades.filter(g => g.subject === subjKey);

                        if (selectedPeriod !== 'ALL') {
                            subjGrades = subjGrades.filter(g => String(g.period) === String(selectedPeriod));
                        }

                        // Notas por periodo digitadas (P1, P2, P3, P4)
                        const getPVal = (pNum) => {
                            const found = subjGrades.find(g => Number(g.period) === pNum);
                            if (!found) return null;
                            const val = Number(found.grade);
                            return (!isNaN(val) && val > 0) ? val : null;
                        };

                        const p1 = getPVal(1);
                        const p2 = getPVal(2);
                        const p3 = getPVal(3);
                        const p4 = getPVal(4);

                        const validNumericGrades = subjGrades
                            .map(g => Number(g.grade))
                            .filter(n => !isNaN(n) && n > 0);

                        let subjAvg = null;
                        if (validNumericGrades.length > 0) {
                            subjAvg = validNumericGrades.reduce((sum, val) => sum + val, 0) / validNumericGrades.length;
                            accumulatedSum += subjAvg;
                            totalSubjectsCount++;

                            if (subjAvg < 75) {
                                failedSubjectsCount++;
                            }
                        }

                        subjectsBreakdown[subjKey] = {
                            p1,
                            p2,
                            p3,
                            p4,
                            avg: subjAvg !== null ? subjAvg : null
                        };
                    });

                    const overallAvg = totalSubjectsCount > 0 
                        ? (accumulatedSum / totalSubjectsCount)
                        : 0;

                    const fullName = student.lastName && student.firstName
                        ? `${student.lastName} ${student.firstName}`
                        : student.name || 'ESTUDIANTE';

                    return {
                        ...student,
                        fullName,
                        subjectsBreakdown,
                        overallAvg: Number(overallAvg.toFixed(1)),
                        failedSubjectsCount
                    };
                });

                // 4. ORDENAR DE MEJOR A PEOR RESULTADO (PROMEDIO GENERAL DESCENDENTE)
                computed.sort((a, b) => b.overallAvg - a.overallAvg);

                // Asignar puestos
                computed.forEach((item, index) => {
                    item.rank = index + 1;
                });

                setRankedStudents(computed);
            } catch (err) {
                console.error("Error cargando consolidado:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAndCalculateConsolidado();
    }, [selectedCourse, selectedPeriod]);

    // Estadísticas calculadas para la barra superior
    const stats = useMemo(() => {
        const total = rankedStudents.length;
        if (total === 0) {
            return { total: 0, groupAvg: '0.0', cleanCount: 0, failCount: 0, topStudent: null };
        }
        const sum = rankedStudents.reduce((acc, s) => acc + s.overallAvg, 0);
        const groupAvg = (sum / total).toFixed(1);
        const cleanCount = rankedStudents.filter(s => s.failedSubjectsCount === 0).length;
        const failCount = rankedStudents.filter(s => s.failedSubjectsCount > 0).length;
        const topStudent = rankedStudents[0] || null;
        return { total, groupAvg, cleanCount, failCount, topStudent };
    }, [rankedStudents]);

    // Filtrar estudiantes para la vista de ranking interactivo
    const filteredRankedStudents = useMemo(() => {
        return rankedStudents.filter(st => {
            // Filtro por texto
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = st.fullName?.toLowerCase().includes(q);
                const matchCode = String(st.code || st.id_code || '').toLowerCase().includes(q);
                if (!matchName && !matchCode) return false;
            }

            // Filtro por estado
            if (statusFilter === 'TOP10') {
                return st.rank <= 10;
            }
            if (statusFilter === 'CLEAN') {
                return st.failedSubjectsCount === 0;
            }
            if (statusFilter === 'FAIL') {
                return st.failedSubjectsCount > 0;
            }

            return true;
        });
    }, [rankedStudents, searchQuery, statusFilter]);

    const toggleExpand = (id) => {
        setExpandedStudentId(prev => prev === id ? null : id);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 text-slate-800 px-4">
                <Loader2 className="animate-spin text-indigo-600" size={44} />
                <p className="text-xs sm:text-sm font-bold tracking-wide animate-pulse text-slate-700 text-center">
                    Procesando consolidado y ordenando ranking académico...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-3.5 sm:py-6 px-2.5 sm:px-4 flex flex-col items-center select-none no-print-bg">
            <style>{`
                @media print {
                    header, sidebar, aside, nav, .no-print {
                        display: none !important;
                    }
                    
                    body, html {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        width: 33cm !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    .no-print-bg {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    @page {
                        size: 33cm 21.6cm landscape;
                        margin: 0;
                    }

                    .no-print-scroll {
                        width: 33cm !important;
                        height: auto !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }

                    .printable-consolidado {
                        width: 33cm !important;
                        height: 21.6cm !important;
                        max-height: 21.6cm !important;
                        margin: 0 auto !important;
                        padding: 0.45cm 0.6cm 0.4cm 0.6cm !important;
                        box-sizing: border-box !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        overflow: hidden !important;
                        position: relative !important;
                        display: flex !important;
                    }

                    .printable-consolidado:last-of-type, .printable-consolidado:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    .page-border {
                        top: 0.25cm !important;
                        bottom: 0.25cm !important;
                        left: 0.25cm !important;
                        right: 0.25cm !important;
                        border: 2px double #334155 !important;
                    }
                }

                .printable-consolidado {
                    width: 33cm;
                    height: 21.6cm;
                    margin: 0 auto;
                    background-color: white;
                    padding: 0.45cm 0.6cm 0.4cm 0.6cm;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    flex-shrink: 0;
                    box-sizing: border-box;
                }
                @media screen {
                    .no-print-scroll {
                        width: 100%;
                        overflow-x: auto;
                        padding-bottom: 24px;
                        -webkit-overflow-scrolling: touch;
                    }
                    .no-print-scroll::-webkit-scrollbar {
                        height: 8px;
                    }
                    .no-print-scroll::-webkit-scrollbar-track {
                        background: #f1f5f9;
                        border-radius: 9999px;
                    }
                    .no-print-scroll::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 9999px;
                    }
                    .no-print-scroll::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8;
                    }
                }
            `}</style>

            {/* Panel de Control y Filtros (No imprenta) */}
            <div className="max-w-[33cm] w-full bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 mb-4 sm:mb-6 flex flex-col gap-3.5 sm:gap-4 shadow-xl border border-slate-700/10 no-print">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-b pb-3.5 border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <button 
                            onClick={() => navigate('/')} 
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition shrink-0 active:scale-95"
                            title="Volver al Tablero"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h2 className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5 leading-snug">
                                <Award size={18} className="text-indigo-600 shrink-0" /> Consolidado & Ranking Académico
                            </h2>
                            <p className="text-[9.5px] sm:text-[10px] text-gray-500 leading-tight">
                                {selectedCourse === 'ALL' ? 'Todos los Cursos' : `Grado ${selectedCourse}`} • {selectedPeriod === 'ALL' ? 'Acumulado General' : `Periodo ${selectedPeriod}`} • 33x21.6cm Legal
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                        {/* Selector de Modo de Vista */}
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-1 sm:flex-none justify-between sm:justify-start">
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    viewMode === 'cards' 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Ver vista interactiva de tarjetas para celular"
                            >
                                <Trophy size={14} /> 
                                <span>Ranking Móvil</span>
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    viewMode === 'table' 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Ver planilla de 14 materias oficial"
                            >
                                <FileSpreadsheet size={14} /> 
                                <span>Sábana Oficio</span>
                            </button>
                        </div>

                        {/* Botón Imprimir / PDF */}
                        <button 
                            onClick={handlePrint}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition text-xs shadow-md shadow-indigo-600/15 flex items-center gap-1.5 sm:gap-2 shrink-0 active:scale-95"
                            title="Imprimir / Exportar a PDF"
                        >
                            <Printer size={16} /> 
                            <span className="hidden xs:inline">Imprimir PDF</span>
                            <span className="xs:hidden">PDF</span>
                        </button>
                    </div>
                </div>

                {/* Filtros de Curso y Periodo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Curso / Grado</label>
                        <select 
                            value={selectedCourse} 
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        >
                            <option value="ALL">🎓 Todos los Cursos ({rankedStudents.length} Estudiantes)</option>
                            {courses.map(c => (
                                <option key={c} value={c}>Grado {c}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Filtro de Periodo</label>
                        <select 
                            value={selectedPeriod} 
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        >
                            <option value="ALL">🗓️ Acumulado de Periodos Digitados</option>
                            <option value="1">Periodo 1</option>
                            <option value="2">Periodo 2</option>
                            <option value="3">Periodo 3</option>
                            <option value="4">Periodo 4</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <div className="bg-indigo-50/70 border border-indigo-100/90 rounded-xl p-2 px-3 sm:px-4 w-full flex items-center justify-between text-xs font-extrabold text-indigo-900">
                            <span>Total Alumnos:</span>
                            <span className="bg-indigo-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{rankedStudents.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* VISTA 1: RANKING MÓVIL EN TARJETAS INTERACTIVAS (Optimizada para Celulares) */}
            {viewMode === 'cards' && (
                <div className="max-w-[33cm] w-full no-print flex flex-col gap-4">
                    {/* Tarjetas de Métricas Resumen */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Users size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400">Total Alumnos</p>
                                <p className="text-sm sm:text-base font-black text-slate-800 leading-tight">{stats.total}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <Award size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400">Promedio Curso</p>
                                <p className="text-sm sm:text-base font-black text-emerald-700 leading-tight">{stats.groupAvg}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-amber-200/80 rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Trophy size={18} />
                            </div>
                            <div className="min-w-0 flex-1 truncate">
                                <p className="text-[9.5px] uppercase tracking-wider font-bold text-amber-700">1° Puesto ({stats.topStudent ? stats.topStudent.overallAvg : 0})</p>
                                <p className="text-xs sm:text-sm font-black text-slate-800 truncate leading-tight">
                                    {stats.topStudent ? stats.topStudent.fullName : 'Sin datos'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center gap-3">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${stats.failCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {stats.failCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400">Aprobados / Riesgo</p>
                                <p className="text-xs sm:text-sm font-black text-slate-800 leading-tight">
                                    <span className="text-emerald-700 font-extrabold">{stats.cleanCount}</span> / <span className={stats.failCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}>{stats.failCount}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Controles de Búsqueda y Filtros Rápidos */}
                    <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
                        {/* Buscador de Alumno */}
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar estudiante por nombre..."
                                className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Píldoras de Filtro */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                            {[
                                { id: 'ALL', label: 'Todos' },
                                { id: 'TOP10', label: '🏆 Top 10' },
                                { id: 'CLEAN', label: '✅ 100% Aprobando' },
                                { id: 'FAIL', label: '⚠️ Con Reprobadas' }
                            ].map(pill => (
                                <button
                                    key={pill.id}
                                    onClick={() => setStatusFilter(pill.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                                        statusFilter === pill.id
                                            ? 'bg-slate-900 text-white shadow-xs'
                                            : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-600'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Podio Visual Top 3 (Solo cuando no hay búsqueda y filtro es ALL) */}
                    {!searchQuery.trim() && statusFilter === 'ALL' && rankedStudents.length >= 3 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                            {/* 2° PUESTO (Plata) */}
                            <div className="order-2 sm:order-1 bg-gradient-to-br from-slate-100 to-white border-2 border-slate-300 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="flex items-center gap-1 text-[10.5px] font-black uppercase text-slate-700 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                                        <Medal size={13} className="text-slate-500" /> 2° Puesto
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                                        {rankedStudents[1].overallAvg.toFixed(1)}
                                    </span>
                                </div>
                                <p className="font-extrabold text-xs sm:text-sm text-slate-900 truncate uppercase mb-1">
                                    {rankedStudents[1].fullName}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-1.5 border-t border-slate-200/60">
                                    <span>Grado {rankedStudents[1].grade || selectedCourse}</span>
                                    <span className={rankedStudents[1].failedSubjectsCount > 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                                        {rankedStudents[1].failedSubjectsCount === 0 ? "✓ 0 reprobadas" : `⚠️ ${rankedStudents[1].failedSubjectsCount} rep.`}
                                    </span>
                                </div>
                            </div>

                            {/* 1° PUESTO (Oro - Al centro) */}
                            <div className="order-1 sm:order-2 bg-gradient-to-br from-amber-500/15 via-amber-100/40 to-white border-2 border-amber-400 rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden sm:-translate-y-1">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="flex items-center gap-1 text-[11px] font-black uppercase text-amber-900 bg-amber-200/90 px-3 py-0.5 rounded-full shadow-xs">
                                        <Trophy size={14} className="text-amber-700 fill-amber-500" /> 1° Puesto • Campeón
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-amber-900 bg-amber-100/80 border border-amber-300 px-2.5 py-0.5 rounded-xl">
                                        {rankedStudents[0].overallAvg.toFixed(1)}
                                    </span>
                                </div>
                                <p className="font-black text-sm sm:text-base text-slate-900 truncate uppercase mb-1">
                                    {rankedStudents[0].fullName}
                                </p>
                                <div className="flex items-center justify-between text-[10.5px] text-amber-900/80 font-bold pt-1.5 border-t border-amber-200/60">
                                    <span>Grado {rankedStudents[0].grade || selectedCourse}</span>
                                    <span className="text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md font-black">
                                        Excelencia Académica
                                    </span>
                                </div>
                            </div>

                            {/* 3° PUESTO (Bronce) */}
                            <div className="order-3 bg-gradient-to-br from-amber-900/10 to-white border-2 border-amber-700/40 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="flex items-center gap-1 text-[10.5px] font-black uppercase text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                        <Medal size={13} className="text-amber-700" /> 3° Puesto
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                                        {rankedStudents[2].overallAvg.toFixed(1)}
                                    </span>
                                </div>
                                <p className="font-extrabold text-xs sm:text-sm text-slate-900 truncate uppercase mb-1">
                                    {rankedStudents[2].fullName}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-1.5 border-t border-slate-200/60">
                                    <span>Grado {rankedStudents[2].grade || selectedCourse}</span>
                                    <span className={rankedStudents[2].failedSubjectsCount > 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                                        {rankedStudents[2].failedSubjectsCount === 0 ? "✓ 0 reprobadas" : `⚠️ ${rankedStudents[2].failedSubjectsCount} rep.`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lista Completa de Tarjetas de Estudiantes */}
                    <div className="space-y-2">
                        {filteredRankedStudents.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200/70">
                                <Search size={28} className="mx-auto mb-2 text-slate-300" />
                                <p className="font-bold text-xs sm:text-sm text-slate-600">No se encontraron estudiantes con ese criterio.</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Prueba cambiando la búsqueda o el filtro seleccionado.</p>
                            </div>
                        ) : (
                            filteredRankedStudents.map((st) => {
                                const isExpanded = expandedStudentId === st.id;
                                const isTop3 = st.rank <= 3;
                                const hasFailures = st.failedSubjectsCount > 0;

                                return (
                                    <div 
                                        key={st.id} 
                                        className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                                            isExpanded 
                                                ? 'border-indigo-500 ring-2 ring-indigo-500/10' 
                                                : isTop3 
                                                    ? 'border-amber-300/80 hover:border-amber-400' 
                                                    : 'border-slate-200/80 hover:border-slate-300'
                                        }`}
                                    >
                                        <div 
                                            onClick={() => toggleExpand(st.id)}
                                            className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer select-none active:bg-slate-50/50"
                                        >
                                            {/* Puesto y Datos del Alumno */}
                                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                                    st.rank === 1 ? 'bg-amber-400 text-white shadow-sm shadow-amber-400/40' :
                                                    st.rank === 2 ? 'bg-slate-300 text-slate-800 shadow-sm' :
                                                    st.rank === 3 ? 'bg-amber-700 text-white shadow-sm' :
                                                    'bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}>
                                                    #{st.rank}
                                                </span>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-extrabold text-xs sm:text-sm text-slate-900 truncate uppercase leading-tight">
                                                            {st.fullName}
                                                        </p>
                                                        {isTop3 && (
                                                            <span className="hidden xs:inline-block text-[9.5px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded">
                                                                Top 3
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] text-slate-500 font-semibold mt-0.5">
                                                        <span>Grado {st.grade || selectedCourse}</span>
                                                        {st.id_code && <span>• Cód: {st.id_code}</span>}
                                                        <span className="hidden sm:inline">• {hasFailures ? `${st.failedSubjectsCount} reprobadas` : '100% aprobadas'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Promedio General y Botón Desplegable */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="text-right">
                                                    <span className={`inline-block font-black text-xs sm:text-sm px-2.5 py-0.5 sm:py-1 rounded-xl ${
                                                        st.overallAvg >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                        st.overallAvg >= 75 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                                        'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {st.overallAvg.toFixed(1)}
                                                    </span>
                                                    <span className={`block text-[9px] font-bold text-center mt-0.5 ${
                                                        hasFailures ? 'text-rose-600' : 'text-slate-400'
                                                    }`}>
                                                        {hasFailures ? `${st.failedSubjectsCount} rep.` : '0 rep.'}
                                                    </span>
                                                </div>

                                                <button 
                                                    type="button"
                                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                                                    aria-label={isExpanded ? "Ocultar notas" : "Ver notas"}
                                                >
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Desglose Expandible de las 14 Materias */}
                                        {isExpanded && (
                                            <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-1 border-t border-slate-100 bg-slate-50/70">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                                                    <span>Calificaciones por Asignatura (14 materias)</span>
                                                    <span className="text-indigo-600 font-bold">Promedio: {st.overallAvg.toFixed(1)}</span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
                                                    {SUBJECTS_LIST.map(subj => {
                                                        const breakdown = st.subjectsBreakdown[subj.key];
                                                        const avg = breakdown?.avg;
                                                        const isLoss = avg !== null && avg < 75;

                                                        const periodDigits = [
                                                            breakdown?.p1 !== null && breakdown?.p1 !== undefined ? { p: 'P1', v: breakdown.p1 } : null,
                                                            breakdown?.p2 !== null && breakdown?.p2 !== undefined ? { p: 'P2', v: breakdown.p2 } : null,
                                                            breakdown?.p3 !== null && breakdown?.p3 !== undefined ? { p: 'P3', v: breakdown.p3 } : null,
                                                            breakdown?.p4 !== null && breakdown?.p4 !== undefined ? { p: 'P4', v: breakdown.p4 } : null
                                                        ].filter(Boolean);

                                                        return (
                                                            <div 
                                                                key={subj.key}
                                                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                                                                    isLoss 
                                                                        ? 'bg-rose-50/90 border-rose-200 text-rose-950' 
                                                                        : 'bg-white border-slate-200/80 text-slate-800'
                                                                }`}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[10px] font-black truncate uppercase leading-tight">
                                                                        {subj.short}
                                                                    </p>
                                                                    <div className="flex items-center gap-1 mt-1 text-[8.5px] text-slate-500 font-semibold">
                                                                        {periodDigits.length > 0 ? (
                                                                            periodDigits.map((item, idx) => (
                                                                                <span key={idx} className="bg-slate-100 px-1 py-0.2 rounded text-[8px]">
                                                                                    {item.p}:{item.v}
                                                                                </span>
                                                                            ))
                                                                        ) : (
                                                                            <span className="italic text-slate-400">Sin notas</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="text-right shrink-0">
                                                                    <span className={`font-black text-xs px-2 py-0.5 rounded-lg inline-block ${
                                                                        isLoss ? 'bg-rose-600 text-white font-black' :
                                                                        avg !== null ? 'bg-slate-100 text-slate-900 font-black' :
                                                                        'text-slate-300'
                                                                    }`}>
                                                                        {avg !== null ? Math.round(avg) : '-'}
                                                                    </span>
                                                                    {isLoss && (
                                                                        <span className="block text-[7.5px] font-black text-rose-700 uppercase mt-0.5">
                                                                            Reprobada
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Aviso Guía para Sábana Oficial en Móviles */}
            {viewMode === 'table' && (
                <div className="w-full max-w-[33cm] bg-indigo-50 border border-indigo-200/90 rounded-2xl p-2.5 sm:p-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-indigo-950 font-semibold no-print shadow-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-base animate-pulse">👉</span>
                        <span className="text-[11px] sm:text-xs">
                            Desliza horizontalmente la tabla para explorar las 14 asignaturas, promedio general y materias reprobadas.
                        </span>
                    </div>
                    <button 
                        onClick={() => setViewMode('cards')}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl shrink-0 transition active:scale-95 shadow-xs"
                    >
                        Ver vista rápida de tarjetas
                    </button>
                </div>
            )}

            {/* Hojas de Impresión Consolidadas (33cm x 21.6cm — 22 alumnos por página) */}
            {/* Si viewMode es 'cards' en pantalla se oculta, pero al imprimir (print) SIEMPRE se imprime la sábana oficial */}
            <div className={`no-print-scroll w-full ${viewMode === 'cards' ? 'hidden print:flex print:flex-col' : 'flex flex-col'} items-center gap-8`}>
                {(() => {
                    const ROWS_PER_PAGE = 22;
                    const studentPages = [];
                    if (rankedStudents.length === 0) {
                        studentPages.push([]);
                    } else {
                        for (let i = 0; i < rankedStudents.length; i += ROWS_PER_PAGE) {
                            studentPages.push(rankedStudents.slice(i, i + ROWS_PER_PAGE));
                        }
                    }

                    return studentPages.map((pageStudents, pageIndex) => (
                        <div key={pageIndex} className="printable-consolidado bg-white border border-slate-350 shadow-2xl relative flex flex-col overflow-hidden shrink-0">
                            {/* Borde Oficial Doble */}
                            <div className="absolute inset-[0.25cm] border-[3px] border-slate-700 border-double rounded-lg pointer-events-none page-border"></div>

                            <div className="relative z-10 flex flex-col h-full">
                                {/* Header Institucional */}
                                <div>
                                    <div className="flex items-center justify-between border-b pb-2 border-slate-300">
                                        {/* Escudo */}
                                        <div className="w-[1.4cm] h-[1.4cm] shrink-0 flex items-center justify-center">
                                            {logoError ? (
                                                <svg viewBox="0 0 100 100" className="w-full h-full fill-indigo-900 text-indigo-950">
                                                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3" />
                                                    <path d="M50 15 L20 40 L30 75 L70 75 L80 40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                                </svg>
                                            ) : (
                                                <img 
                                                    src="/Escudo1.png" 
                                                    alt="Escudo Institucional" 
                                                    className="w-full h-full object-contain" 
                                                    onError={() => setLogoError(true)} 
                                                />
                                            )}
                                        </div>

                                        {/* Textos del Colegio */}
                                        <div className="flex-1 text-center">
                                            <h1 className="text-sm font-black text-slate-900 tracking-wider uppercase leading-tight">
                                                Instituto Nueva América de Suba — INAS
                                            </h1>
                                            <h2 className="text-[11px] font-black text-indigo-950 tracking-wider uppercase mt-0.5 leading-none">
                                                Consolidado de Evaluaciones y Control Académico de Estudiantes
                                            </h2>
                                            <p className="text-[8.5px] text-slate-500 font-medium mt-0.5">
                                                Resolución de Aprobación SED N° 110254 | NIT: 830.123.456-7 | Año Lectivo 2026
                                            </p>
                                            <p className="text-[8px] font-semibold italic text-indigo-900 mt-0.5">
                                                “Ciudadanos productivos desde la construcción de proyectos de vida con calidad y responsabilidad ambiental”
                                            </p>
                                        </div>

                                        {/* Metadatos */}
                                        <div className="text-right text-[8.5px] leading-tight font-bold text-slate-500 border border-slate-200 bg-slate-50 p-2 rounded-lg">
                                            <p>Curso: <span className="text-slate-900 font-black">{selectedCourse === 'ALL' ? 'Todos los Cursos' : `Grado ${selectedCourse}`}</span></p>
                                            <p>Periodo: <span className="text-slate-900 font-black">{selectedPeriod === 'ALL' ? 'Acumulado' : `Periodo ${selectedPeriod}`}</span></p>
                                            <p>Página: <span className="text-indigo-900 font-black">{pageIndex + 1} de {studentPages.length}</span></p>
                                        </div>
                                    </div>

                                    {/* Tabla Principal del Consolidado (22 alumnos exactos por página) */}
                                    <div className="mt-2">
                                        <table className="w-full text-left text-[8.5px] border-collapse border-2 border-slate-800 table-fixed">
                                            <thead>
                                                <tr className="bg-slate-900 text-white uppercase text-[8px] tracking-tight text-center">
                                                    <th className="border border-slate-700 w-[3%] font-black py-1.5">N°</th>
                                                    <th className="border border-slate-700 text-left px-1.5 w-[16%] font-black truncate">ALUMNOS (Nombres Completo)</th>
                                                    
                                                    {/* Columnas de Asignaturas Oficiales */}
                                                    {SUBJECTS_LIST.map(subj => (
                                                        <th key={subj.key} className="border border-slate-700 font-extrabold px-0.5 py-1 text-[7px] leading-tight text-center bg-slate-850">
                                                            <div className="truncate">{subj.short}</div>
                                                        </th>
                                                    ))}

                                                    <th className="border border-slate-700 w-[5%] font-black bg-indigo-950 text-indigo-100 text-[8px]">PROM. GRAL</th>
                                                    <th className="border border-slate-700 w-[5%] font-black bg-rose-950 text-rose-100 text-[7.5px]">Mat. Per.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageStudents.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4 + SUBJECTS_LIST.length} className="py-8 text-center text-slate-400 text-xs font-bold">
                                                            No hay datos registrados para el filtro seleccionado.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    pageStudents.map((st) => {
                                                        const isTop3 = st.rank <= 3;
                                                        const hasFailures = st.failedSubjectsCount > 0;

                                                        return (
                                                            <tr key={st.id} className={`text-center font-semibold border-b border-slate-300 text-[8.5px] ${
                                                                isTop3 ? 'bg-amber-50/40' : 'hover:bg-slate-50/40'
                                                            }`}>
                                                                {/* N° / Puesto en Ranking */}
                                                                <td className={`border border-slate-300 font-black text-[9px] ${
                                                                    st.rank === 1 ? 'bg-amber-100 text-amber-900' :
                                                                    st.rank === 2 ? 'bg-slate-200 text-slate-800' :
                                                                    st.rank === 3 ? 'bg-amber-50 text-amber-800' : 'text-slate-700'
                                                                }`}>
                                                                    {st.rank}
                                                                </td>

                                                                {/* Alumno (Apellidos y Nombres) */}
                                                                <td className="border border-slate-300 text-left px-1.5 font-bold uppercase truncate text-slate-900 text-[8.5px]">
                                                                    {st.fullName}
                                                                </td>

                                                                {/* Casilla por Materia: Arriba Notas Periodos, Abajo Promedio Centrado */}
                                                                {SUBJECTS_LIST.map(subj => {
                                                                    const breakdown = st.subjectsBreakdown[subj.key];
                                                                    const avg = breakdown?.avg;
                                                                    const isLoss = avg !== null && avg < 75;

                                                                    const periodDigits = [
                                                                        breakdown?.p1 !== null && breakdown?.p1 !== undefined ? breakdown.p1 : null,
                                                                        breakdown?.p2 !== null && breakdown?.p2 !== undefined ? breakdown.p2 : null,
                                                                        breakdown?.p3 !== null && breakdown?.p3 !== undefined ? breakdown.p3 : null,
                                                                        breakdown?.p4 !== null && breakdown?.p4 !== undefined ? breakdown.p4 : null
                                                                    ].filter(val => val !== null);

                                                                    return (
                                                                        <td key={subj.key} className={`border border-slate-300 p-0.5 align-middle ${
                                                                            isLoss ? 'bg-rose-50/90' : ''
                                                                        }`}>
                                                                            {avg !== null ? (
                                                                                <div className="flex flex-col justify-between items-center h-full py-0.5">
                                                                                    <div className="flex items-center justify-center gap-1.5 text-[7.5px] font-semibold text-slate-700 w-full leading-none">
                                                                                        {periodDigits.map((val, idx) => (
                                                                                            <span key={idx}>{val}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                    <div className={`font-black text-[9px] mt-0.5 border-t border-slate-200/80 w-full text-center leading-none ${
                                                                                        isLoss ? 'text-rose-700 font-black' : 'text-slate-950 font-extrabold'
                                                                                    }`}>
                                                                                        {Math.round(avg)}
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-slate-300 font-normal text-[8px]">-</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}

                                                                {/* Promedio General */}
                                                                <td className="border border-slate-300 font-black text-[9.5px] bg-indigo-50/60 text-indigo-950">
                                                                    {st.overallAvg.toFixed(1)}
                                                                </td>

                                                                {/* Materias Perdidas (Mat. Per.) */}
                                                                <td className={`border border-slate-300 font-black text-[9.5px] ${
                                                                    hasFailures 
                                                                        ? 'bg-rose-100 text-rose-800 font-black' 
                                                                        : 'bg-emerald-50/40 text-emerald-700 font-bold'
                                                                }`}>
                                                                    {hasFailures ? (
                                                                        <span className="text-rose-700 font-black">
                                                                            {st.failedSubjectsCount}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-700 font-bold">0</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ));
                })()}
            </div>
        </div>
    );
}
