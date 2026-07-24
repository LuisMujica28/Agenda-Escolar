import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, BookOpen, AlertCircle } from 'lucide-react';

const AREAS_CURRICULUM = [
    {
        area: 'Humanidades: Lengua Castellana e Inglés',
        subjects: ['Español y Literatura', 'Inglés']
    },
    {
        area: 'Matemáticas',
        subjects: ['Matemáticas']
    },
    {
        area: 'Ciencias Naturales y Educación Ambiental',
        subjects: [
            'C. Naturales (Biología)',
            'C. Naturales (Física)',
            'C Naturales (Química)'
        ]
    },
    {
        area: 'Ciencias Sociales, Geografía, Constitución y Democracia',
        subjects: [
            'C Sociales Filosofía',
            'C Políticas Económicas'
        ]
    },
    {
        area: 'Educación Ética y en Valores Humanos',
        subjects: ['Ed Ética y Valores']
    },
    {
        area: 'Educación Religiosa y Moral',
        subjects: ['Ed Religiosa y Moral']
    },
    {
        area: 'Educación Física, Recreación y Deporte',
        subjects: ['Ed Física']
    },
    {
        area: 'Tecnología e Informática',
        subjects: ['Tecnología e Informática']
    },
    {
        area: 'Educación Artística y Cultural',
        subjects: ['Artes plásticas']
    }
];

export default function PrintBoletin() {
    const { studentId } = useParams();
    const navigate = useNavigate();

    // Modo: 'single' si viene studentId por URL, 'batch' si no viene
    const isSingleMode = Boolean(studentId);

    // Estados para modo masivo / individual
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('ALL');
    const [studentsList, setStudentsList] = useState([]);
    const [allGradesMap, setAllGradesMap] = useState({}); // { student_id: [grades] }
    const [loading, setLoading] = useState(true);
    const [logoError, setLogoError] = useState(false);

    // Cargar lista de cursos disponibles
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

    // Cargar datos (Individual o Masivo)
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                if (isSingleMode) {
                    // Modo Estudiante Único
                    const sDoc = await getDoc(doc(db, 'students', studentId));
                    if (sDoc.exists()) {
                        const sObj = { id: sDoc.id, ...sDoc.data() };
                        setStudentsList([sObj]);

                        const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentId));
                        const gSnap = await getDocs(qGrades);
                        const gradesArr = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        setAllGradesMap({ [studentId]: gradesArr });
                    } else {
                        setStudentsList([]);
                    }
                } else {
                    // Modo Masivo (Por Curso o Todos)
                    let qStudents;
                    if (selectedCourse === 'ALL') {
                        qStudents = query(collection(db, 'students'));
                    } else {
                        qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
                    }

                    const sSnap = await getDocs(qStudents);
                    const list = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Ordenar por Apellidos/Nombres
                    const sortByLastName = (a, b) => {
                        const getSortKey = (student) => {
                            if (student.lastName && student.firstName) return `${student.lastName} ${student.firstName}`;
                            const name = student.name || '';
                            const words = name.trim().split(/\s+/);
                            if (words.length <= 1) return name;
                            if (words.length === 2) return `${words[1]} ${words[0]}`;
                            return `${words.slice(-2).join(' ')} ${words.slice(0, -2).join(' ')}`;
                        };
                        return getSortKey(a).localeCompare(getSortKey(b));
                    };
                    list.sort(sortByLastName);
                    setStudentsList(list);

                    // Cargar calificaciones de todos los estudiantes encontrados
                    const gMap = {};
                    if (list.length > 0) {
                        const qGrades = collection(db, 'grades');
                        const gSnap = await getDocs(qGrades);
                        gSnap.docs.forEach(d => {
                            const gData = { id: d.id, ...d.data() };
                            if (!gMap[gData.student_id]) {
                                gMap[gData.student_id] = [];
                            }
                            gMap[gData.student_id].push(gData);
                        });
                    }
                    setAllGradesMap(gMap);
                }
            } catch (error) {
                console.error("Error al cargar datos para boletines:", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [studentId, selectedCourse, isSingleMode]);

    // Auxiliares de desempeño
    const getDesempenoAbbr = (grade) => {
        const num = Number(grade);
        if (isNaN(num)) return '-';
        if (num >= 95) return 'S';
        if (num >= 80) return 'A';
        if (num >= 75) return 'Bs';
        return 'BJ';
    };

    const getDesempenoColorClass = (grade) => {
        const num = Number(grade);
        if (isNaN(num)) return 'text-slate-450 font-normal';
        if (num >= 95) return 'text-emerald-700 font-extrabold';
        if (num >= 80) return 'text-indigo-700 font-bold';
        if (num >= 75) return 'text-slate-700 font-semibold';
        return 'text-rose-700 font-black';
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
                <Loader2 className="animate-spin text-indigo-400" size={48} />
                <p className="text-sm font-semibold tracking-wide animate-pulse">
                    {isSingleMode ? 'Generando boletín oficial...' : 'Compilando boletines masivos por lote...'}
                </p>
            </div>
        );
    }

    if (studentsList.length === 0) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
                <div className="bg-white rounded-3xl p-8 max-w-md shadow-xl text-center border border-slate-200">
                    <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-gray-800">No se encontraron estudiantes</h3>
                    <p className="text-sm text-gray-500 mt-2">
                        {isSingleMode 
                            ? 'El identificador de estudiante no es válido o ha sido eliminado.' 
                            : 'No hay estudiantes registrados en el curso seleccionado.'}
                    </p>
                    <button 
                        onClick={() => navigate('/')} 
                        className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl transition text-xs shadow-md shadow-indigo-600/10"
                    >
                        Volver al Tablero
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-800/90 py-8 px-4 flex flex-col items-center select-none overflow-y-auto no-print-bg">
            {/* Estilos específicos de impresión */}
            <style>{`
                @media print {
                    /* Ocultar elementos de pantalla */
                    header, aside, .no-print {
                        display: none !important;
                    }
                    
                    body {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    .no-print-bg {
                        background: white !important;
                        padding: 0 !important;
                    }
                    
                    /* Forzar tamaño oficio legal (22cm x 33cm) */
                    @page {
                        size: 22cm 33cm;
                        margin: 0;
                    }
                    
                    .printable-boletin-page {
                        page-break-after: always !important;
                        break-after: page !important;
                        position: relative !important;
                        width: 22cm !important;
                        height: 33cm !important;
                        margin: 0 !important;
                        padding: 1.2cm !important;
                        box-sizing: border-box !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .page-border {
                        border: 2px double #334155 !important;
                    }
                }
                @media screen {
                    .no-print-scroll {
                        width: 100%;
                        overflow-x: auto;
                        padding-bottom: 12px;
                    }
                }
            `}</style>

            {/* Barra de Controles y Filtros Masivos (Solo visible en pantalla) */}
            <div className="max-w-[22cm] w-full bg-white rounded-3xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl border border-slate-700/10 no-print">
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
                            <BookOpen size={16} className="text-indigo-600" /> Boletines Oficiales de Calificaciones
                        </h2>
                        <p className="text-[10px] text-gray-500">
                            {isSingleMode 
                                ? 'Vista individual en tamaño Oficio (22 cm x 33 cm)' 
                                : `Impresión Masiva: ${studentsList.length} boletines listos`}
                        </p>
                    </div>
                </div>

                {/* Filtros de Curso en modo Masivo */}
                {!isSingleMode && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-600">Curso:</span>
                        <select 
                            value={selectedCourse} 
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        >
                            <option value="ALL">🎓 Todos los Cursos ({studentsList.length} Estudiantes)</option>
                            {courses.map(c => (
                                <option key={c} value={c}>Grado {c}</option>
                            ))}
                        </select>
                    </div>
                )}

                <button 
                    onClick={handlePrint}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl transition text-xs shadow-md shadow-indigo-600/15 flex items-center gap-2 shrink-0"
                >
                    <Printer size={16} /> Imprimir / Guardar como PDF
                </button>
            </div>

            {/* Listado de Hojas de Boletín (1 por cada estudiante) */}
            <div className="no-print-scroll w-full flex flex-col items-center gap-8">
                {studentsList.map((studentItem) => {
                    const studentGrades = allGradesMap[studentItem.id] || [];

                    // Agrupar calificaciones por materia
                    const gradesBySubject = studentGrades.reduce((acc, current) => {
                        const { subject } = current;
                        if (!acc[subject]) {
                            acc[subject] = [];
                        }
                        acc[subject].push(current);
                        acc[subject].sort((a, b) => (Number(a.period) || 1) - (Number(b.period) || 1));
                        return acc;
                    }, {});

                    // Calcular promedio general
                    const totalGrades = studentGrades.map(g => Number(g.grade)).filter(n => !isNaN(n));
                    const overallAverage = totalGrades.length > 0 
                        ? (totalGrades.reduce((sum, g) => sum + g, 0) / totalGrades.length).toFixed(1)
                        : '0.0';

                    return (
                        <div 
                            key={studentItem.id}
                            className="printable-boletin-page w-[22cm] h-[33cm] bg-white p-[1.2cm] border border-slate-300 shadow-2xl relative flex flex-col justify-between overflow-hidden shrink-0"
                        >
                            {/* Borde Oficial Doble */}
                            <div className="absolute inset-[0.4cm] border-[3px] border-slate-700 border-double rounded-xl pointer-events-none page-border"></div>

                            <div className="relative z-10 flex flex-col h-full justify-between">
                                {/* Encabezado Institucional */}
                                <div>
                                    <div className="flex items-center justify-between gap-4 border-b pb-3 border-slate-300">
                                        {/* Logo / Escudo */}
                                        <div className="w-[1.8cm] h-[1.8cm] shrink-0 flex items-center justify-center">
                                            {logoError ? (
                                                <svg viewBox="0 0 100 100" className="w-full h-full fill-indigo-900 text-indigo-950">
                                                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3" />
                                                    <path d="M50 15 L20 40 L30 75 L70 75 L80 40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                                </svg>
                                            ) : (
                                                <img 
                                                    src="/Escudo.png" 
                                                    alt="Escudo INAS" 
                                                    className="w-full h-full object-contain" 
                                                    onError={() => setLogoError(true)} 
                                                />
                                            )}
                                        </div>

                                        {/* Textos del Colegio */}
                                        <div className="flex-1 text-center">
                                            <h1 className="text-xs font-black text-slate-900 tracking-wide uppercase leading-tight">
                                                Instituto Nueva América de Suba
                                            </h1>
                                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                                                INAS - BOGOTÁ D.C.
                                            </p>
                                            <p className="text-[7.5px] font-medium text-slate-500 mt-0.5 leading-normal">
                                                Resolución de Aprobación SED N° 110254 | NIT: 830.123.456-7 | Bogotá, Colombia
                                            </p>
                                            <h3 className="text-[10px] font-extrabold text-indigo-900 mt-1.5 tracking-wider uppercase border border-indigo-900/30 px-3 py-0.5 rounded-full w-fit mx-auto bg-indigo-50/50">
                                                Boletín Oficial de Rendimiento Académico
                                            </h3>
                                        </div>

                                        {/* Periodo y Año Lectivo */}
                                        <div className="w-[1.8cm] h-[1.8cm] shrink-0 flex flex-col items-center justify-center border border-slate-200 bg-slate-50 rounded-xl p-1 text-center">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Año</span>
                                            <span className="text-xl font-black text-indigo-950 leading-none">2026</span>
                                            <span className="text-[6.5px] font-bold text-slate-500 tracking-tighter mt-1 uppercase">LECTIVO</span>
                                        </div>
                                    </div>

                                    {/* Ficha de Información del Estudiante */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 bg-slate-50/50 border border-slate-200 rounded-2xl p-3 mt-3 text-[9px] leading-relaxed">
                                        <div className="col-span-2">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7.5px]">Estudiante:</span>
                                            <span className="font-extrabold text-slate-800 text-[10.5px] uppercase">
                                                {studentItem.lastName && studentItem.firstName 
                                                    ? `${studentItem.lastName} ${studentItem.firstName}` 
                                                    : studentItem.name}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7.5px]">Curso / Grado:</span>
                                            <span className="font-bold text-slate-700 text-[10px]">Grado {studentItem.grade}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7.5px]">Código Alumno:</span>
                                            <span className="font-mono font-bold text-slate-700 text-[10px]">{studentItem.id_code}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7.5px]">Director de Grupo:</span>
                                            <span className="font-semibold text-slate-600">Docente Titular - INAS</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7.5px]">Fecha de Expedición:</span>
                                            <span className="font-medium text-slate-600">{new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                        <div className="bg-indigo-900 text-white rounded-xl p-1.5 px-3 flex flex-col justify-center items-center text-center">
                                            <span className="font-bold text-[7px] uppercase tracking-wider leading-none text-indigo-200">Promedio</span>
                                            <span className="text-base font-black mt-0.5 leading-none">{overallAverage}</span>
                                        </div>
                                    </div>

                                    {/* Listado de Calificaciones */}
                                    <div className="mt-4">
                                        <table className="w-full text-left text-[8px] border-collapse border border-slate-350">
                                            <thead>
                                                <tr className="bg-slate-900 text-white uppercase text-[7px] tracking-wider text-center">
                                                    <th rowSpan="2" className="py-2 px-3 text-left w-[30%] border-r border-slate-700 align-middle">Áreas / Asignaturas</th>
                                                    <th colSpan="2" className="py-1 px-1 border-b border-slate-700 border-r border-slate-700 text-[7px]">1 Per.</th>
                                                    <th colSpan="2" className="py-1 px-1 border-b border-slate-700 border-r border-slate-700 text-[7px]">2 Per.</th>
                                                    <th colSpan="2" className="py-1 px-1 border-b border-slate-700 border-r border-slate-700 text-[7px]">3 Per.</th>
                                                    <th colSpan="2" className="py-1 px-1 border-b border-slate-700 border-r border-slate-700 text-[7px]">4 Per.</th>
                                                    <th colSpan="2" className="py-1 px-1 border-b border-slate-700 text-[7px] align-middle">Prom. Acumulado</th>
                                                </tr>
                                                <tr className="bg-slate-800 text-white uppercase text-[6px] text-center">
                                                    <th className="py-1 px-0.5 w-[6.5%] border-r border-slate-700">Nota</th>
                                                    <th className="py-1 px-0.5 w-[5%] border-r border-slate-700">Des.</th>
                                                    <th className="py-1 px-0.5 w-[6.5%] border-r border-slate-700">Nota</th>
                                                    <th className="py-1 px-0.5 w-[5%] border-r border-slate-700">Des.</th>
                                                    <th className="py-1 px-0.5 w-[6.5%] border-r border-slate-700">Nota</th>
                                                    <th className="py-1 px-0.5 w-[5%] border-r border-slate-700">Des.</th>
                                                    <th className="py-1 px-0.5 w-[6.5%] border-r border-slate-700">Nota</th>
                                                    <th className="py-1 px-0.5 w-[5%] border-r border-slate-700">Des.</th>
                                                    <th className="py-1 px-0.5 w-[7%] border-r border-slate-700">Nota</th>
                                                    <th className="py-1 px-0.5 w-[6.5%]">Des.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {AREAS_CURRICULUM.map((areaObj) => {
                                                    return (
                                                        <React.Fragment key={areaObj.area}>
                                                            {/* Encabezado de Área */}
                                                            <tr className="bg-slate-100/90 font-black text-[7.5px] text-slate-800 border-b border-slate-250">
                                                                <td colSpan="11" className="py-1 px-2.5 text-left uppercase tracking-wide border-r border-slate-200 bg-slate-100">
                                                                    {areaObj.area}
                                                                </td>
                                                            </tr>
                                                            
                                                            {/* Asignaturas dentro del área */}
                                                            {areaObj.subjects.map((subject) => {
                                                                const subjectGrades = gradesBySubject[subject] || [];
                                                                
                                                                const validGrades = subjectGrades.map(g => Number(g.grade)).filter(n => !isNaN(n));
                                                                const avg = validGrades.length > 0 
                                                                    ? validGrades.reduce((sum, g) => sum + g, 0) / validGrades.length 
                                                                    : null;

                                                                return (
                                                                    <tr key={subject} className="border-b border-slate-200 text-center font-semibold hover:bg-slate-50/30 transition text-[7.5px]">
                                                                        <td className="py-1.5 px-3 text-left font-bold text-slate-800 uppercase border-r border-slate-200 truncate">
                                                                            {subject}
                                                                        </td>
                                                                        
                                                                        {[1, 2, 3, 4].map(p => {
                                                                            const gradeDoc = subjectGrades.find(g => (Number(g.period) || 1) === p);
                                                                            if (gradeDoc) {
                                                                                const val = Number(gradeDoc.grade);
                                                                                return (
                                                                                    <React.Fragment key={p}>
                                                                                        <td className="py-1.5 px-0.5 font-bold border-r border-slate-200 text-slate-800">
                                                                                            {val.toFixed(0)}
                                                                                        </td>
                                                                                        <td className={`py-1.5 px-0.5 font-bold border-r border-slate-200 ${getDesempenoColorClass(val)}`}>
                                                                                            {getDesempenoAbbr(val)}
                                                                                        </td>
                                                                                    </React.Fragment>
                                                                                );
                                                                            } else {
                                                                                return (
                                                                                    <React.Fragment key={p}>
                                                                                        <td className="py-1.5 px-0.5 text-slate-400 border-r border-slate-200 font-normal">-</td>
                                                                                        <td className="py-1.5 px-0.5 text-slate-400 border-r border-slate-200 font-normal">-</td>
                                                                                    </React.Fragment>
                                                                                );
                                                                            }
                                                                        })}

                                                                        {avg !== null ? (
                                                                            <>
                                                                                <td className="py-1.5 px-0.5 font-extrabold border-r border-slate-200 text-indigo-900 bg-indigo-50/10">
                                                                                    {avg.toFixed(0)}
                                                                                </td>
                                                                                <td className={`py-1.5 px-0.5 font-black bg-indigo-50/10 ${getDesempenoColorClass(avg)}`}>
                                                                                    {getDesempenoAbbr(avg)}
                                                                                </td>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <td className="py-1.5 px-0.5 text-slate-450 border-r border-slate-200 font-normal bg-slate-50/30">N.A.</td>
                                                                                <td className="py-1.5 px-0.5 text-slate-450 font-normal bg-slate-50/30">N.A.</td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* Comentarios y Observaciones específicas */}
                                        {studentGrades.some(g => g.comment && g.comment.trim()) && (
                                            <div className="mt-2 border border-slate-200 rounded-xl p-2 bg-slate-50/30 text-[7px] leading-relaxed">
                                                <p className="font-extrabold text-[7.5px] text-indigo-950 uppercase mb-1 border-b border-slate-200 pb-0.5 tracking-wide">Observaciones Específicas por Asignatura:</p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                    {studentGrades.filter(g => g.comment && g.comment.trim()).map(g => (
                                                        <div key={g.id} className="text-slate-650 font-medium">
                                                            <span className="font-bold text-slate-800 uppercase">{g.subject}</span> (P{g.period}): <span className="italic">“{g.comment}”</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sección Inferior: Criterios, Escala, Observaciones y Firmas */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 border-t pt-3 border-slate-300">
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[7px] leading-normal text-slate-500">
                                            <p className="font-bold text-[8px] text-slate-700 uppercase mb-1">Criterios de Evaluación por Periodo</p>
                                            <p>• Cada asignatura se evalúa sobre un máximo acumulable de 100 puntos.</p>
                                            <p>• Componentes: Actitudinal (20%), Prueba 1 (20%), Ejercitación (20%), Prueba 2 (20%), Guía (20%).</p>
                                            <p>• Calificación mínima aprobatoria: <span className="font-extrabold text-slate-700">75 puntos</span>.</p>
                                            <p className="mt-1 font-semibold text-indigo-900">“Formación Integral para la Excelencia y el Futuro”</p>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl p-2.5 text-[7.5px] leading-relaxed text-slate-600 bg-white">
                                            <p className="font-bold text-[8px] text-slate-700 uppercase mb-1 text-center">Escala Oficial de Desempeño Escolar</p>
                                            <div className="grid grid-cols-4 gap-1.5 text-center mt-1">
                                                <div className="border border-slate-100 p-1 rounded bg-slate-50">
                                                    <p className="font-black text-emerald-800 text-[8px]">95 - 100</p>
                                                    <p className="text-[6.5px] font-bold text-slate-400">SUPERIOR</p>
                                                </div>
                                                <div className="border border-slate-100 p-1 rounded bg-slate-50">
                                                    <p className="font-black text-indigo-800 text-[8px]">80 - 94</p>
                                                    <p className="text-[6.5px] font-bold text-slate-400">ALTO</p>
                                                </div>
                                                <div className="border border-slate-100 p-1 rounded bg-slate-50">
                                                    <p className="font-black text-slate-800 text-[8px]">75 - 79</p>
                                                    <p className="text-[6.5px] font-bold text-slate-400">BÁSICO</p>
                                                </div>
                                                <div className="border border-slate-100 p-1 rounded bg-slate-50">
                                                    <p className="font-black text-rose-800 text-[8px]">0 - 74</p>
                                                    <p className="text-[6.5px] font-bold text-slate-400 text-rose-500">BAJO</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl p-3 bg-white">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7px] mb-2">Observaciones Generales y Recomendaciones Pedagógicas:</span>
                                        <div className="space-y-2.5">
                                            <div className="border-b border-slate-200 w-full h-[0.1cm]"></div>
                                            <div className="border-b border-slate-200 w-full h-[0.1cm]"></div>
                                            <div className="border-b border-slate-200 w-full h-[0.1cm]"></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12 pt-8 text-center text-[8.5px] font-bold text-slate-600 relative">
                                        <div className="flex flex-col items-center">
                                            <div className="border-t border-slate-400 w-[4.5cm] mb-1.5"></div>
                                            <span className="uppercase text-slate-900 font-extrabold text-[9px]">RECTOR / COORDINADOR</span>
                                            <span className="text-[7.5px] text-slate-400 font-medium tracking-tighter">Autoridad Administrativa INAS</span>
                                        </div>

                                        <div className="flex flex-col items-center">
                                            <div className="border-t border-slate-400 w-[4.5cm] mb-1.5"></div>
                                            <span className="uppercase text-slate-900 font-extrabold text-[9px]">DIRECTOR DE GRUPO</span>
                                            <span className="text-[7.5px] text-slate-400 font-medium tracking-tighter">Verificación Docente del Grado {studentItem.grade}</span>
                                        </div>

                                        <div className="absolute left-[50%] top-[-0.6cm] transform translate-x-[-50%] w-[1.6cm] h-[1.6cm] rounded-full border border-dashed border-indigo-900/35 flex flex-col justify-center items-center opacity-40">
                                            <span className="text-[5px] text-indigo-900 font-bold tracking-tighter uppercase leading-none">Sello</span>
                                            <span className="text-[6.5px] text-indigo-900 font-black tracking-tighter uppercase leading-none mt-0.5">INAS</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
