import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, FileText, CheckSquare, Square, RefreshCw, Users, Trash2, Plus } from 'lucide-react';

export default function PrintPlanilla() {
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    // Modo de impresión: 'single' (planilla única) o 'batch' (lote por docente)
    const [printMode, setPrintMode] = useState('single');

    // Filtros Modo Único
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('Matemáticas');
    const [selectedPeriod, setSelectedPeriod] = useState('1');
    const [isBlankTemplate, setIsBlankTemplate] = useState(false);

    // Estados Modo Lote (Docente)
    const [teachersList, setTeachersList] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [batchClasses, setBatchClasses] = useState([]); // Array de { course, subject, checked }
    const [loadedBatchData, setLoadedBatchData] = useState([]); // Array de { course, subject, students, gradesMap }
    const [loadingBatch, setLoadingBatch] = useState(false);

    // Datos planilla única
    const [students, setStudents] = useState([]);
    const [gradesMap, setGradesMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [logoError, setLogoError] = useState(false);

    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    const subjects = [
        'Artes plásticas',
        'C. Naturales (Biología)',
        'C. Naturales (Física)',
        'C Naturales (Química)',
        'C Sociales Filosofía',
        'C Políticas Económicas',
        'Ed Ética y Valores',
        'Ed Física',
        'Ed Religiosa y Moral',
        'Tecnología e Informática',
        'Español y Literatura',
        'Inglés',
        'Matemáticas'
    ];

    // Redirigir si no es administrador
    useEffect(() => {
        if (userRole && userRole !== 'admin') {
            navigate('/');
        }
    }, [userRole, navigate]);

    // Cargar cursos
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
                if (unique.length > 0) {
                    setSelectedCourse(unique[0]);
                }
            } catch (e) {
                console.error("Error al cargar cursos:", e);
            }
        }
        loadCourses();
    }, []);

    // Cargar lista única de docentes basados en class_sheets
    useEffect(() => {
        async function loadTeachers() {
            try {
                const snap = await getDocs(collection(db, 'class_sheets'));
                if (!snap.empty) {
                    const emails = snap.docs.map(doc => doc.data().teacher_email).filter(Boolean);
                    const uniqueEmails = Array.from(new Set(emails)).sort();
                    setTeachersList(uniqueEmails);
                    if (uniqueEmails.length > 0) {
                        setSelectedTeacher(uniqueEmails[0]);
                    }
                }
            } catch (e) {
                console.error("Error al cargar docentes:", e);
            }
        }
        loadTeachers();
    }, []);

    // Cargar asignaciones del docente seleccionado
    useEffect(() => {
        if (!selectedTeacher) return;
        async function loadTeacherAssignments() {
            try {
                const snap = await getDocs(collection(db, 'class_sheets'));
                const list = snap.docs
                    .map(doc => doc.data())
                    .filter(d => d.teacher_email === selectedTeacher)
                    .map(d => ({ course: d.course, subject: d.subject, checked: true }));
                setBatchClasses(list);
            } catch (e) {
                console.error("Error al cargar asignaturas del docente:", e);
            }
        }
        loadTeacherAssignments();
    }, [selectedTeacher]);

    // Cargar estudiantes y calificaciones de una planilla única
    const fetchPlanillaData = async () => {
        if (!selectedCourse) return;
        setLoading(true);
        try {
            const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
            const sSnap = await getDocs(qStudents);
            const studentList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const sortByLastName = (a, b) => {
                const getSortKey = (student) => {
                    if (student.lastName && student.firstName) return `${student.lastName} ${student.firstName}`;
                    const name = student.name || '';
                    const words = name.trim().split(/\s+/);
                    if (words.length <= 1) return name;
                    if (words.length === 2) return `${words[1]} ${words[0]}`;
                    const apellidos = words.slice(-2).join(' ');
                    const nombres = words.slice(0, -2).join(' ');
                    return `${apellidos} ${nombres}`;
                };
                return getSortKey(a).localeCompare(getSortKey(b));
            };
            studentList.sort(sortByLastName);
            setStudents(studentList);

            if (!isBlankTemplate && studentList.length > 0) {
                const qGrades = query(
                    collection(db, 'grades'), 
                    where('subject', '==', selectedSubject),
                    where('period', '==', Number(selectedPeriod))
                );
                const gSnap = await getDocs(qGrades);
                const gMap = {};
                gSnap.docs.forEach(doc => {
                    const data = doc.data();
                    gMap[data.student_id] = data;
                });
                setGradesMap(gMap);
            } else {
                setGradesMap({});
            }
        } catch (e) {
            console.error("Error cargando planilla única:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (printMode === 'single') {
            fetchPlanillaData();
        }
    }, [selectedCourse, selectedSubject, selectedPeriod, isBlankTemplate, printMode]);

    // Cargar calificaciones y estudiantes para todo el lote del docente en paralelo
    const fetchBatchData = async () => {
        const activeClasses = batchClasses.filter(c => c.checked);
        if (activeClasses.length === 0) {
            alert("Selecciona al menos una asignatura para imprimir.");
            return;
        }

        setLoadingBatch(true);
        setLoadedBatchData([]);

        try {
            const results = [];
            for (const item of activeClasses) {
                // 1. Cargar alumnos de ese curso
                const qS = query(collection(db, 'students'), where('grade', '==', item.course));
                const sSnap = await getDocs(qS);
                const studentList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
                    const getSortKey = (student) => {
                        if (student.lastName && student.firstName) return `${student.lastName} ${student.firstName}`;
                        const words = (student.name || '').trim().split(/\s+/);
                        if (words.length <= 1) return student.name || '';
                        if (words.length === 2) return `${words[1]} ${words[0]}`;
                        return `${words.slice(-2).join(' ')} ${words.slice(0, -2).join(' ')}`;
                    };
                    return getSortKey(a).localeCompare(getSortKey(b));
                });

                // 2. Cargar notas de esa materia y periodo
                let gMap = {};
                if (!isBlankTemplate && studentList.length > 0) {
                    const qG = query(
                        collection(db, 'grades'),
                        where('subject', '==', item.subject),
                        where('period', '==', Number(selectedPeriod))
                    );
                    const gSnap = await getDocs(qG);
                    gSnap.docs.forEach(doc => {
                        const data = doc.data();
                        gMap[data.student_id] = data;
                    });
                }

                results.push({
                    course: item.course,
                    subject: item.subject,
                    students: studentList,
                    gradesMap: gMap
                });
            }
            setLoadedBatchData(results);
        } catch (e) {
            console.error("Error al cargar lote de planillas:", e);
            alert("Error al cargar datos del lote: " + e.message);
        } finally {
            setLoadingBatch(false);
        }
    };

    // Añadir asignatura manualmente al lote en pantalla
    const handleAddManualClass = () => {
        const exists = batchClasses.some(c => c.course === selectedCourse && c.subject === selectedSubject);
        if (exists) {
            alert("Esta asignatura ya se encuentra agregada en la lista.");
            return;
        }
        setBatchClasses(prev => [...prev, { course: selectedCourse, subject: selectedSubject, checked: true }]);
    };

    // Remover asignatura del lote
    const handleRemoveClass = (index) => {
        setBatchClasses(prev => prev.filter((_, idx) => idx !== index));
    };

    // Alternar check de asignatura
    const handleToggleClassCheck = (index) => {
        setBatchClasses(prev => prev.map((item, idx) => {
            if (idx === index) {
                return { ...item, checked: !item.checked };
            }
            return item;
        }));
    };

    const handlePrint = () => {
        window.print();
    };

    // RENDERIZADOR DE PLANILLA INDIVIDUAL (Componente Interno)
    const renderPlanillaSheet = (courseName, subjectName, studentList, grades) => {
        return (
            <div className="printable-sheet bg-white border border-slate-350 shadow-2xl relative flex flex-col justify-between overflow-hidden shrink-0 mb-8">
                {/* Borde doble oficial */}
                <div className="absolute inset-[0.25cm] border-[3px] border-slate-700 border-double rounded-lg pointer-events-none page-border"></div>

                <div className="relative z-10 flex flex-col h-full justify-between">
                    
                    {/* Header Institucional */}
                    <div>
                        <div className="flex items-center justify-between border-b pb-1 border-slate-300">
                            {/* Logo */}
                            <div className="w-[1.1cm] h-[1.1cm] shrink-0 flex items-center justify-center">
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

                            {/* Títulos del Plantel */}
                            <div className="flex-1 text-center">
                                <h1 className="text-xs font-black text-slate-900 tracking-wider uppercase leading-tight">
                                    Instituto Nueva América de Suba — INAS
                                </h1>
                                <h2 className="text-[9px] font-extrabold text-indigo-900 tracking-wider uppercase mt-0.5 leading-none">
                                    Planilla Auxiliar de Calificaciones y Control de Asistencia
                                </h2>
                            </div>

                            {/* Metadatos de Impresión */}
                            <div className="text-right text-[7px] leading-tight font-bold text-slate-500 border border-slate-200 bg-slate-50/50 p-1 rounded-lg">
                                <p>Curso: <span className="text-slate-800 font-extrabold">{courseName}</span></p>
                                <p>Materia: <span className="text-slate-800 font-extrabold">{subjectName}</span></p>
                                <p>Periodo: <span className="text-slate-800 font-extrabold">{selectedPeriod}</span></p>
                            </div>
                        </div>

                        {/* Metadatos Generales de la Planilla */}
                        <div className="flex justify-between items-center bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-1 mt-1 text-[7.5px] leading-none font-semibold text-slate-600">
                            <div>
                                Docente Asignado: <span className="text-slate-900 uppercase font-bold">
                                    {printMode === 'batch' && selectedTeacher ? selectedTeacher : (currentUser?.displayName || currentUser?.email)}
                                </span>
                            </div>
                            <div>
                                Lema: <span className="text-indigo-900 italic font-semibold">“Formación Integral para la Excelencia y el Futuro”</span>
                            </div>
                            <div>
                                Fecha de Impresión: <span className="text-slate-900">{new Date().toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* Tabla de Estudiantes Compacta con Ahorro de Tinta */}
                        <div className="mt-2">
                            <table className="w-full text-left text-[7px] border-collapse border-4 border-double border-slate-800 table-fixed">
                                <thead>
                                    <tr className="bg-white text-slate-900 uppercase text-[6.5px] tracking-wide text-center" style={{ height: '0.45cm' }}>
                                        <th rowSpan="2" className="border border-slate-400 w-[2.5%] font-extrabold">N°</th>
                                        <th rowSpan="2" className="border border-slate-400 text-left px-1.5 w-[20%] font-extrabold truncate">Estudiante (Nombre Completo)</th>
                                        <th colSpan="10" className="border border-slate-400 w-[22.5%] font-extrabold text-[6.5px] bg-white text-slate-800">ASISTENCIA</th>
                                        <th className="border border-slate-400 w-[4%] font-bold text-[6px]">Prueba 1</th>
                                        <th className="border border-slate-400 w-[4%] font-bold text-[6px]">Prueba 2</th>
                                        <th colSpan="6" className="border border-slate-400 w-[18%] font-bold text-[6px]">Guía (20%)</th>
                                        <th colSpan="6" className="border border-slate-400 w-[18%] font-bold text-[6px]">Ejercitación (20%)</th>
                                        <th className="border border-slate-400 w-[5%] font-bold text-[6px]">Actitudinal</th>
                                        <th rowSpan="2" className="border border-slate-400 w-[4%] font-extrabold text-[6.5px]">Def.</th>
                                    </tr>
                                    <tr className="bg-white text-slate-900 text-[5.5px] text-center" style={{ height: '0.35cm' }}>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal"></th>
                                        <th className="border border-slate-400 font-normal text-[5.5px] bg-slate-50/30">(20%)</th>
                                        <th className="border border-slate-400 font-normal text-[5.5px] bg-slate-50/30">(20%)</th>
                                        <th className="border border-slate-400 font-normal">1</th>
                                        <th className="border border-slate-400 font-normal">2</th>
                                        <th className="border border-slate-400 font-normal">3</th>
                                        <th className="border border-slate-400 font-normal">4</th>
                                        <th className="border border-slate-400 font-normal">5</th>
                                        <th className="border border-slate-400 font-bold bg-slate-50">T</th>
                                        <th className="border border-slate-400 font-normal">1</th>
                                        <th className="border border-slate-400 font-normal">2</th>
                                        <th className="border border-slate-400 font-normal">3</th>
                                        <th className="border border-slate-400 font-normal">4</th>
                                        <th className="border border-slate-400 font-normal">5</th>
                                        <th className="border border-slate-400 font-bold bg-slate-50">T</th>
                                        <th className="border border-slate-400 font-normal text-[5.5px] bg-slate-50/30">(20%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentList.length === 0 ? (
                                        <tr>
                                            <td colSpan="28" className="py-8 text-center text-slate-400 italic text-[10px] border border-slate-350">
                                                No se encontraron estudiantes para este curso. Selecciona otro curso.
                                            </td>
                                        </tr>
                                    ) : (
                                        studentList.map((student, index) => {
                                            const gradeData = grades[student.id];
                                            const finalGrade = gradeData ? Number(gradeData.grade) : null;

                                            return (
                                                <tr 
                                                    key={student.id} 
                                                    className="border-b border-slate-350 text-center font-bold text-slate-800 hover:bg-slate-50" 
                                                    style={{ height: '0.42cm' }}
                                                >
                                                    <td className="border border-slate-300 text-slate-500 font-extrabold text-[6.5px]">{index + 1}</td>
                                                    <td className="px-1 text-left font-black uppercase text-[6.5px] truncate border border-slate-300 leading-none">
                                                        {student.lastName && student.firstName 
                                                            ? `${student.lastName} ${student.firstName}` 
                                                            : student.name}
                                                    </td>
                                                    
                                                    {/* Casillas de control de asistencia vacías */}
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>

                                                    {/* Prueba 1 */}
                                                    <td className="border border-slate-300 text-slate-900 text-[6.5px] font-extrabold bg-slate-50/10">
                                                        {(!isBlankTemplate && gradeData?.components?.prueba1 !== undefined) ? gradeData.components.prueba1 : ''}
                                                    </td>
                                                    
                                                    {/* Prueba 2 */}
                                                    <td className="border border-slate-300 text-slate-900 text-[6.5px] font-extrabold bg-slate-50/10">
                                                        {(!isBlankTemplate && gradeData?.components?.prueba2 !== undefined) ? gradeData.components.prueba2 : ''}
                                                    </td>

                                                    {/* Guía */}
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300 bg-slate-50/50 text-slate-900 text-[6.5px] font-extrabold">
                                                        {(!isBlankTemplate && gradeData?.components?.guia !== undefined) ? gradeData.components.guia : ''}
                                                    </td>

                                                    {/* Ejercitación */}
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300 bg-slate-50/50 text-slate-900 text-[6.5px] font-extrabold">
                                                        {(!isBlankTemplate && gradeData?.components?.ejercitacion !== undefined) ? gradeData.components.ejercitacion : ''}
                                                    </td>

                                                    {/* Actitudinal */}
                                                    <td className="border border-slate-300 text-slate-900 text-[6.5px] font-extrabold bg-slate-50/10">
                                                        {(!isBlankTemplate && gradeData?.components?.actitudinal !== undefined) ? gradeData.components.actitudinal : ''}
                                                    </td>

                                                    {/* Definitiva */}
                                                    <td className={`border border-slate-300 text-[7px] font-black ${
                                                        finalGrade ? (finalGrade >= 75 ? 'text-slate-900 bg-slate-50/20' : 'text-rose-700 bg-rose-50/10') : ''
                                                    }`}>
                                                        {finalGrade !== null ? finalGrade.toFixed(0) : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}

                                    {studentList.length > 0 && (
                                        <tr className="border-t-2 border-slate-450 font-black text-slate-950 bg-slate-50/50" style={{ height: '0.45cm' }}>
                                            <td colSpan="2" className="border border-slate-300 px-2 text-left text-[7px] uppercase font-black">
                                                Total Estudiantes
                                            </td>
                                            <td colSpan="26" className="border border-slate-300 text-left px-3 text-[7px] font-black">
                                                {studentList.length}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer y Firmas */}
                    <div className="grid grid-cols-3 gap-8 text-[7.5px] font-bold text-slate-500 mt-2 border-t pt-1 border-slate-200 relative">
                        <div className="flex flex-col items-start leading-tight text-slate-400">
                            <p>• La calificación final aprobatoria mínima es de 75 puntos (100 totales).</p>
                            <p>• Planilla auxiliar para registro interno de notas y fechas de asistencia diaria.</p>
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <div className="border-t border-slate-350 w-[4cm] mb-0.5"></div>
                            <span className="uppercase text-slate-900 font-extrabold text-[8px]">FIRMA DEL DOCENTE</span>
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <div className="border-t border-slate-350 w-[4cm] mb-0.5"></div>
                            <span className="uppercase text-slate-900 font-extrabold text-[8px]">COORDINACIÓN ACADÉMICA</span>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-800/90 py-6 px-4 flex flex-col items-center select-none overflow-y-auto no-print-bg">
            <style>{`
                @media print {
                    /* Ocultar elementos en la impresión */
                    header, aside, .no-print, .no-print-area {
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
                    
                    /* Forzar tamaño oficio legal horizontal (33cm x 22cm) */
                    @page {
                        size: 33cm 22cm;
                        margin: 0;
                    }
                    
                    .printable-sheet {
                        width: 33cm !important;
                        height: 22cm !important;
                        margin: 0 !important;
                        padding: 0.6cm 0.8cm !important;
                        box-sizing: border-box !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        position: relative !important;
                    }

                    .page-border {
                        border: 2px double #334155 !important;
                    }
                }

                /* Estilo de pantalla normal para cada hoja */
                .printable-sheet {
                    width: 33cm;
                    height: 22cm;
                    background-color: white;
                    padding: 0.7cm;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    overflow: hidden;
                    flex-shrink: 0;
                }
            `}</style>

            {/* Panel de Control y Filtros */}
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
                                <FileText size={16} className="text-indigo-600" /> Planilla Auxiliar de Calificaciones y Asistencia (Horizontal)
                            </h2>
                            <p className="text-[10px] text-gray-500">Imprime planillas en tamaño Oficio (33 x 22 cm) de forma individual o por lote del docente.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        <button 
                            onClick={() => setIsBlankTemplate(!isBlankTemplate)}
                            className={`font-bold px-4 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 ${
                                isBlankTemplate 
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/15'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            {isBlankTemplate ? <CheckSquare size={14} /> : <Square size={14} />}
                            {isBlankTemplate ? 'Planilla en Blanco Activa' : 'Generar en Blanco'}
                        </button>

                        <button 
                            onClick={handlePrint}
                            disabled={printMode === 'batch' && loadedBatchData.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-2xl transition text-xs shadow-md shadow-indigo-600/15 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Printer size={15} /> 
                            {printMode === 'batch' ? `Imprimir Lote (${loadedBatchData.length} planillas)` : 'Imprimir Planilla'}
                        </button>
                    </div>
                </div>

                {/* Selector de Modo de Impresión */}
                <div className="flex border-b border-gray-100 gap-2">
                    <button
                        onClick={() => setPrintMode('single')}
                        className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all ${
                            printMode === 'single' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-gray-450 hover:text-gray-600'
                        }`}
                    >
                        Planilla Única
                    </button>
                    <button
                        onClick={() => setPrintMode('batch')}
                        className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all ${
                            printMode === 'batch' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-gray-450 hover:text-gray-600'
                        }`}
                    >
                        Impresión por Lote (Docente)
                    </button>
                </div>

                {/* Selectores Modo Único */}
                {printMode === 'single' && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Curso / Grado</label>
                            <select 
                                className="w-full bg-gray-55 border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                            >
                                {courses.map(c => (
                                    <option key={c} value={c}>Curso {c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Asignatura (Materia)</label>
                            <select 
                                className="w-full bg-gray-55 border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                            >
                                {subjects.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Periodo Escolar</label>
                            <select 
                                className="w-full bg-gray-55 border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                <option value="1">Periodo 1</option>
                                <option value="2">Periodo 2</option>
                                <option value="3">Periodo 3</option>
                                <option value="4">Periodo 4</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button 
                                onClick={fetchPlanillaData}
                                className="w-full bg-slate-105 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar Datos
                            </button>
                        </div>
                    </div>
                )}

                {/* Configuración Modo Lote */}
                {printMode === 'batch' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Seleccionar Docente (Correo)</label>
                                <select 
                                    className="w-full bg-gray-55 border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                    value={selectedTeacher}
                                    onChange={(e) => setSelectedTeacher(e.target.value)}
                                    disabled={loadingBatch}
                                >
                                    {teachersList.length === 0 ? (
                                        <option value="">No hay docentes vinculados a planillas</option>
                                    ) : (
                                        teachersList.map(email => (
                                            <option key={email} value={email}>{email}</option>
                                        ))
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Periodo Escolar</label>
                                <select 
                                    className="w-full bg-gray-55 border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                    value={selectedPeriod}
                                    onChange={(e) => setSelectedPeriod(e.target.value)}
                                    disabled={loadingBatch}
                                >
                                    <option value="1">Periodo 1</option>
                                    <option value="2">Periodo 2</option>
                                    <option value="3">Periodo 3</option>
                                    <option value="4">Periodo 4</option>
                                </select>
                            </div>

                            <div className="flex items-end">
                                <button 
                                    onClick={fetchBatchData}
                                    disabled={loadingBatch || batchClasses.length === 0}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md shadow-indigo-600/10"
                                >
                                    {loadingBatch ? (
                                        <><Loader2 className="animate-spin" size={14} /> Cargando Lote...</>
                                    ) : (
                                        <><RefreshCw size={14} /> Cargar Lote de Planillas</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Listado de Asignaturas del Lote */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Asignaturas en el Lote</h4>
                                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-650 font-bold">{batchClasses.length} clases</span>
                            </div>
                            
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                                {batchClasses.length === 0 ? (
                                    <div className="text-[10px] text-gray-400 italic">No hay asignaturas vinculadas a este docente. Agrega algunas usando la herramienta de abajo.</div>
                                ) : (
                                    batchClasses.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-gray-150">
                                            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={() => handleToggleClassCheck(idx)}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                Grado {item.course} — Asignatura: {item.subject}
                                            </label>
                                            <button 
                                                onClick={() => handleRemoveClass(idx)}
                                                className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition"
                                                title="Quitar asignatura"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Agregar asignatura manual al lote */}
                            <div className="border-t pt-3 flex flex-col sm:flex-row items-end gap-3">
                                <div className="flex-1 space-y-1">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase block">Grado Auxiliar</label>
                                    <select 
                                        className="w-full bg-white border border-gray-150 rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none"
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                    >
                                        {courses.map(c => (
                                            <option key={c} value={c}>Curso {c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase block">Asignatura Auxiliar</label>
                                    <select 
                                        className="w-full bg-white border border-gray-150 rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none"
                                        value={selectedSubject}
                                        onChange={(e) => setSelectedSubject(e.target.value)}
                                    >
                                        {subjects.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddManualClass}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-650 text-[10px] font-black px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-1 h-9"
                                >
                                    <Plus size={14} /> Añadir al Lote
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Renderizado de Planillas en pantalla */}
            {printMode === 'single' ? (
                loading ? (
                    <div className="printable-sheet bg-white flex flex-col justify-center items-center gap-3">
                        <Loader2 className="animate-spin text-indigo-600" size={36} />
                        <span className="text-xs font-bold text-slate-400">Descargando registros académicos...</span>
                    </div>
                ) : (
                    renderPlanillaSheet(selectedCourse, selectedSubject, students, gradesMap)
                )
            ) : (
                /* Modo Lote */
                loadingBatch ? (
                    <div className="printable-sheet bg-white flex flex-col justify-center items-center gap-3">
                        <Loader2 className="animate-spin text-indigo-600" size={36} />
                        <span className="text-xs font-bold text-slate-400">Descargando calificaciones del lote...</span>
                    </div>
                ) : loadedBatchData.length === 0 ? (
                    <div className="printable-sheet bg-slate-700/20 flex flex-col justify-center items-center text-center p-12 text-slate-350 no-print border-dashed border-2 border-slate-500/35 shadow-none rounded-3xl">
                        <FileText className="text-slate-400 mb-3" size={40} />
                        <h4 className="text-xs font-bold text-slate-300">Lote de Planillas vacío</h4>
                        <p className="text-[10px] text-slate-400 max-w-sm font-semibold leading-normal mt-1">
                            Selecciona un docente o agrega asignaturas manualmente arriba, luego haz clic en "Cargar Lote de Planillas" para previsualizarlas antes de imprimir.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full gap-8">
                        {loadedBatchData.map((data, idx) => (
                            <div key={idx}>
                                {renderPlanillaSheet(data.course, data.subject, data.students, data.gradesMap)}
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
