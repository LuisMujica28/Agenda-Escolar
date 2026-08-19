import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, Award, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 text-slate-800">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-sm font-bold tracking-wide animate-pulse text-slate-700">
                    Procesando consolidado y ordenando ranking académico...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-6 px-4 flex flex-col items-center select-none no-print-bg">
            {/* Estilos específicos de impresión (Formato Oficio Horizontal: 33cm x 21.6cm) */}
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
                    }

                    .printable-consolidado {
                        width: 33cm !important;
                        height: 21.6cm !important;
                        max-height: 21.6cm !important;
                        margin: 0 auto !important;
                        padding: 0.35cm 0.45cm 0.3cm 1.45cm !important;
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
                    }

                    .printable-consolidado:last-of-type, .printable-consolidado:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    .page-border {
                        top: 0.25cm !important;
                        bottom: 0.25cm !important;
                        left: 0.45cm !important;
                        right: 0.35cm !important;
                        border: 2px double #334155 !important;
                    }
                }
            `}</style>

            {/* Panel de Control y Filtros (No imprenta) */}
            <div className="max-w-[33cm] w-full bg-white rounded-3xl p-5 mb-6 flex flex-col gap-4 shadow-xl border border-slate-700/10 no-print">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 border-slate-100">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate('/')} 
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-2xl transition"
                            title="Volver al Tablero"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <Award size={18} className="text-indigo-600" /> Consolidado de Calificaciones y Ranking Académico
                            </h2>
                            <p className="text-[10px] text-gray-500">Formato Oficial INAS: 22 alumnos exactos por hoja (sin cortes de fila).</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePrint}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl transition text-xs shadow-md shadow-indigo-600/15 flex items-center gap-2 shrink-0"
                        >
                            <Printer size={16} /> Imprimir / Exportar a PDF
                        </button>
                    </div>
                </div>

                {/* Filtros de Curso y Periodo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        <div className="bg-indigo-50/60 border border-indigo-100/80 rounded-xl p-2 px-4 w-full flex items-center justify-between text-xs font-extrabold text-indigo-900">
                            <span>Total Alumnos:</span>
                            <span className="bg-indigo-600 text-white text-[10px] px-2.5 py-0.5 rounded-full">{rankedStudents.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hojas de Impresión Consolidadas (Paginadas exactamente en bloques de 22 alumnos) */}
            <div className="no-print-scroll w-full flex flex-col items-center gap-8">
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
                        <div key={pageIndex} className="printable-consolidado bg-white border border-slate-350 shadow-2xl relative flex flex-col justify-between overflow-hidden shrink-0">
                            {/* Borde Oficial Doble */}
                            <div className="absolute inset-[0.25cm] border-[3px] border-slate-700 border-double rounded-lg pointer-events-none page-border"></div>

                            <div className="relative z-10 flex flex-col h-full justify-between">
                                {/* Header Institucional */}
                                <div>
                                    <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
                                        {/* Escudo */}
                                        <div className="w-[1.3cm] h-[1.3cm] shrink-0 flex items-center justify-center">
                                            {logoError ? (
                                                <svg viewBox="0 0 100 100" className="w-full h-full fill-indigo-900 text-indigo-950">
                                                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3" />
                                                    <path d="M50 15 L20 40 L30 75 L70 75 L80 40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                                </svg>
                                            ) : (
                                                <img 
                                                    src="/Escudo.png" 
                                                    alt="Escudo" 
                                                    className="w-full h-full object-contain" 
                                                    onError={() => setLogoError(true)} 
                                                />
                                            )}
                                        </div>

                                        {/* Textos del Colegio */}
                                        <div className="flex-1 text-center">
                                            <h1 className="text-xs font-black text-slate-900 tracking-wider uppercase leading-tight">
                                                Instituto Nueva América de Suba — INAS
                                            </h1>
                                            <h2 className="text-[10px] font-black text-indigo-950 tracking-wider uppercase mt-0.5 leading-none">
                                                Consolidado de Evaluaciones y Control Académico de Estudiantes
                                            </h2>
                                            <p className="text-[8px] text-slate-500 font-medium mt-0.5">
                                                Resolución de Aprobación SED N° 110254 | NIT: 830.123.456-7 | Año Lectivo 2026
                                            </p>
                                            <p className="text-[7.5px] font-semibold italic text-indigo-900 mt-0.5">
                                                “Ciudadanos productivos desde la construcción de proyectos de vida con calidad y responsabilidad ambiental”
                                            </p>
                                        </div>

                                        {/* Metadatos */}
                                        <div className="text-right text-[8px] leading-tight font-bold text-slate-500 border border-slate-200 bg-slate-50 p-1.5 rounded-lg">
                                            <p>Curso: <span className="text-slate-900 font-black">{selectedCourse === 'ALL' ? 'Todos los Cursos' : `Grado ${selectedCourse}`}</span></p>
                                            <p>Periodo: <span className="text-slate-900 font-black">{selectedPeriod === 'ALL' ? 'Acumulado' : `Periodo ${selectedPeriod}`}</span></p>
                                            <p>Página: <span className="text-indigo-900 font-black">{pageIndex + 1} de {studentPages.length}</span></p>
                                        </div>
                                    </div>

                                    {/* Tabla Principal del Consolidado (22 alumnos exactos por página) */}
                                    <div className="mt-1">
                                        <table className="w-full text-left text-[8px] border-collapse border-2 border-slate-800 table-fixed">
                                            <thead>
                                                <tr className="bg-slate-900 text-white uppercase text-[7.5px] tracking-tight text-center">
                                                    <th className="border border-slate-700 w-[3%] font-black py-1">N°</th>
                                                    <th className="border border-slate-700 text-left px-1.5 w-[16%] font-black truncate">ALUMNOS (Nombres Completo)</th>
                                                    
                                                    {/* Columnas de Asignaturas Oficiales */}
                                                    {SUBJECTS_LIST.map(subj => (
                                                        <th key={subj.key} className="border border-slate-700 font-extrabold px-0.5 py-0.5 text-[6.5px] leading-tight text-center bg-slate-850">
                                                            <div className="truncate">{subj.short}</div>
                                                        </th>
                                                    ))}

                                                    <th className="border border-slate-700 w-[5%] font-black bg-indigo-950 text-indigo-100 text-[7.5px]">PROM. GRAL</th>
                                                    <th className="border border-slate-700 w-[5%] font-black bg-rose-950 text-rose-100 text-[7px]">Mat. Per.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageStudents.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4 + SUBJECTS_LIST.length} className="py-6 text-center text-slate-400 text-xs font-bold">
                                                            No hay datos registrados para el filtro seleccionado.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    pageStudents.map((st) => {
                                                        const isTop3 = st.rank <= 3;
                                                        const hasFailures = st.failedSubjectsCount > 0;

                                                        return (
                                                            <tr key={st.id} className={`text-center font-semibold border-b border-slate-300 text-[8px] ${
                                                                isTop3 ? 'bg-amber-50/40' : 'hover:bg-slate-50/40'
                                                            }`}>
                                                                {/* N° / Puesto en Ranking */}
                                                                <td className={`border border-slate-300 font-black text-[8px] py-0.5 ${
                                                                    st.rank === 1 ? 'bg-amber-100 text-amber-900' :
                                                                    st.rank === 2 ? 'bg-slate-200 text-slate-800' :
                                                                    st.rank === 3 ? 'bg-amber-50 text-amber-800' : 'text-slate-700'
                                                                }`}>
                                                                    {st.rank}
                                                                </td>

                                                                {/* Alumno (Apellidos y Nombres) */}
                                                                <td className="border border-slate-300 text-left px-1.5 font-bold uppercase truncate text-slate-900 text-[8px] py-0.5">
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
                                                                                <div className="flex flex-col justify-between items-center h-full py-0">
                                                                                    <div className="flex items-center justify-center gap-1 text-[7px] font-semibold text-slate-700 w-full leading-none">
                                                                                        {periodDigits.map((val, idx) => (
                                                                                            <span key={idx}>{val}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                    <div className={`font-black text-[8.5px] border-t border-slate-200/80 w-full text-center leading-none mt-0.5 ${
                                                                                        isLoss ? 'text-rose-700 font-black' : 'text-slate-950 font-extrabold'
                                                                                    }`}>
                                                                                        {Math.round(avg)}
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-slate-300 font-normal text-[7.5px]">-</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}

                                                                {/* Promedio General */}
                                                                <td className="border border-slate-300 font-black text-[8.5px] bg-indigo-50/60 text-indigo-950 py-0.5">
                                                                    {st.overallAvg.toFixed(1)}
                                                                </td>

                                                                {/* Materias Perdidas (Mat. Per.) */}
                                                                <td className={`border border-slate-300 font-black text-[8.5px] py-0.5 ${
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

                                {/* Pie de Página y Firmas */}
                                <div className="mt-1 border-t pt-1 border-slate-300 grid grid-cols-3 gap-6 text-[8px] font-semibold text-slate-600">
                                    <div>
                                        <p className="font-extrabold text-slate-800 text-[8.5px] uppercase">Convenciones e Indicadores:</p>
                                        <p className="text-[7.5px] text-slate-500 leading-tight">
                                            • Arriba en casilla: Calificación digitada de cada periodo (P1, P2...). | Abajo: Promedio acumulado.
                                        </p>
                                        <p className="text-[7.5px] text-slate-500 leading-tight">
                                            • Mat. Per. = Número de asignaturas con promedio acumulado inferior a 75 pts.
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-center justify-end text-center">
                                        <div className="border-t border-slate-400 w-[5cm] mb-0.5"></div>
                                        <span className="uppercase text-slate-900 font-extrabold text-[8.5px]">COORDINACIÓN ACADÉMICA</span>
                                        <span className="text-[7px] text-slate-400">Verificación Oficial INAS</span>
                                    </div>

                                    <div className="flex flex-col items-center justify-end text-center">
                                        <div className="border-t border-slate-400 w-[5cm] mb-0.5"></div>
                                        <span className="uppercase text-slate-900 font-extrabold text-[8.5px]">RECTORÍA GENERAL</span>
                                        <span className="text-[7px] text-slate-400">Firma y Sello del Plantel</span>
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
