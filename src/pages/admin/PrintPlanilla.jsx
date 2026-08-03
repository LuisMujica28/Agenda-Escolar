import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, FileText, CheckSquare, Square, RefreshCw, Trash2, Plus, Layers, Grid } from 'lucide-react';

export default function PrintPlanilla() {
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    // Modo de impresión: 'single' (única), 'course' (lote por curso), 'batch' (lote por docente), 'all_courses' (todos los cursos)
    const [printMode, setPrintMode] = useState('single');

    // Filtros Modo Único
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('Matemáticas');
    const [selectedPeriod, setSelectedPeriod] = useState('1');
    const [isBlankTemplate, setIsBlankTemplate] = useState(false);

    // Estados Modo Lote (Docente / Curso / Todos)
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
        'Geometría',
        'Inglés',
        'Matemáticas'
    ];

    // Permitir acceso a administradores y docentes
    useEffect(() => {
        if (userRole && userRole !== 'admin' && userRole !== 'teacher') {
            navigate('/');
        }
    }, [userRole, navigate]);

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

                if (unique.length === 0) {
                    unique = ['101', '201', '301', '401', '501', '601', '701', '801', '901', '1001', '1002', '1003'];
                }

                setCourses(unique);
                if (unique.length > 0 && !selectedCourse) {
                    setSelectedCourse(unique[0]);
                }
            } catch (e) {
                console.error("Error al cargar cursos:", e);
                const fallback = ['101', '201', '301', '401', '501', '601', '701', '801', '901', '1001', '1002', '1003'];
                setCourses(fallback);
                if (!selectedCourse) setSelectedCourse('101');
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

    // Cargar asignaciones según el modo seleccionado
    useEffect(() => {
        if (printMode === 'batch' && selectedTeacher) {
            // Modo Docente
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
        } else if (printMode === 'course' && selectedCourse) {
            // Modo Lote por Curso (Todas las asignaturas del curso)
            const list = subjects.map(s => ({ course: selectedCourse, subject: s, checked: true }));
            setBatchClasses(list);
        } else if (printMode === 'all_courses' && courses.length > 0) {
            // Modo Todos los Cursos
            const list = [];
            courses.forEach(c => {
                subjects.forEach(s => {
                    list.push({ course: c, subject: s, checked: true });
                });
            });
            setBatchClasses(list);
        }
    }, [printMode, selectedTeacher, selectedCourse, courses]);

    // Cargar estudiantes y calificaciones de una planilla única
    const fetchPlanillaData = async () => {
        if (!selectedCourse) return;
        setLoading(true);
        try {
            const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
            const sSnap = await getDocs(qStudents);
            const rawStudentList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Deduplicar estudiantes
            const seenNames = new Set();
            const studentList = [];
            rawStudentList.forEach(st => {
                const normName = (st.name || `${st.lastName || ''} ${st.firstName || ''}`).trim().toUpperCase();
                if (!seenNames.has(normName) && st.status !== 'retirado') {
                    seenNames.add(normName);
                    studentList.push(st);
                }
            });

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
            studentList.sort(sortByLastName);

            if (studentList.length === 0) {
                studentList.push(
                    { id: `demo-p1-${selectedCourse}`, id_code: `ST-${selectedCourse}-001`, name: 'ARIZA VALENZUELA BRANDON THOMAS', firstName: 'BRANDON THOMAS', lastName: 'ARIZA VALENZUELA', grade: selectedCourse },
                    { id: `demo-p2-${selectedCourse}`, id_code: `ST-${selectedCourse}-002`, name: 'BARRERA PARRA GABRIEL JERONIMO', firstName: 'GABRIEL JERONIMO', lastName: 'BARRERA PARRA', grade: selectedCourse },
                    { id: `demo-p3-${selectedCourse}`, id_code: `ST-${selectedCourse}-003`, name: 'CARDENAS AYALA EILYN THAMARA', firstName: 'EILYN THAMARA', lastName: 'CARDENAS AYALA', grade: selectedCourse },
                    { id: `demo-p4-${selectedCourse}`, id_code: `ST-${selectedCourse}-004`, name: 'CASTIBLANCO VELANDIA JULIETA', firstName: 'JULIETA', lastName: 'CASTIBLANCO VELANDIA', grade: selectedCourse },
                    { id: `demo-p5-${selectedCourse}`, id_code: `ST-${selectedCourse}-005`, name: 'DUENAS ROJAS SAMANTHA', firstName: 'SAMANTHA', lastName: 'DUENAS ROJAS', grade: selectedCourse }
                );
            }

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

    // Cargar calificaciones y estudiantes para todo el lote
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
                const studentList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.status !== 'retirado').sort((a, b) => {
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
            <div className="printable-sheet bg-white border border-slate-350 shadow-2xl relative flex flex-col justify-between overflow-hidden shrink-0 mb-8 mx-auto">
                {/* Texto Vertical en Margen Izquierdo (Materia y Curso de arriba hacia abajo) */}
                <div 
                    className="absolute left-[0.55cm] top-[0.6cm] bottom-[0.6cm] w-[0.7cm] flex items-center justify-center pointer-events-none z-20 overflow-hidden"
                >
                    <span 
                        className="text-[9.5px] font-black text-slate-900 tracking-widest uppercase whitespace-nowrap"
                        style={{ 
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)'
                        }}
                    >
                        ASIGNATURA: {subjectName} — CURSO: {courseName} — PERIODO: {selectedPeriod}
                    </span>
                </div>

                {/* Borde doble oficial */}
                <div className="absolute top-[0.25cm] bottom-[0.25cm] left-[0.45cm] right-[0.35cm] border-[3px] border-slate-700 border-double rounded-lg pointer-events-none page-border"></div>

                <div className="relative z-10 flex flex-col h-full justify-between pt-0">
                    
                    {/* Header Institucional */}
                    <div>
                        <div className="flex items-center justify-between border-b pb-0.5 border-slate-300">
                            {/* Logo */}
                            <div className="w-[0.8cm] h-[0.8cm] shrink-0 flex items-center justify-center">
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
                                Lema: <span className="text-indigo-900 italic font-semibold">“Ciudadanos productivos desde la construcción de proyectos de vida con calidad y responsabilidad ambiental”</span>
                            </div>
                            <div>
                                Fecha de Impresión: <span className="text-slate-900">{new Date().toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* Registro y Descripción de Actividades Evaluativas (Compacto) */}
                        <div className="mt-1 border border-slate-300 bg-slate-50/40 rounded-md p-1 text-[7.5px] leading-none">
                            <div className="font-black text-slate-900 uppercase tracking-wider text-[8px] mb-0.5 flex items-center justify-between border-b pb-0.5 border-slate-250">
                                <span className="flex items-center gap-1.5 text-indigo-950 font-black">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block"></span>
                                    REGISTRO DE ACTIVIDADES Y CRITERIOS DE EVALUACIÓN
                                </span>
                                <span className="font-semibold text-[7px] text-slate-500 italic">Relaciones aquí los temas de las guías y ejercitaciones aplicadas</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Columna 1: Guías */}
                                <div className="space-y-0.5 border-r pr-2 border-slate-250">
                                    <span className="font-black text-indigo-950 uppercase text-[7.5px] block border-b border-slate-200">GUÍAS (20%):</span>
                                    <div className="grid grid-cols-1 gap-0.5 text-slate-800">
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">G1:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">G2:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">G3:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">G4:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">G5:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                    </div>
                                </div>

                                {/* Columna 2: Ejercitaciones */}
                                <div className="space-y-0.5">
                                    <span className="font-black text-indigo-950 uppercase text-[7.5px] block border-b border-slate-200">EJERCITACIÓN (20%):</span>
                                    <div className="grid grid-cols-1 gap-0.5 text-slate-800">
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">E1:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">E2:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">E3:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">E4:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                        <div className="flex items-end gap-1"><span className="font-black text-slate-950 w-4 text-[8px] leading-none pb-[1px]">E5:</span> <span className="border-b border-slate-400 flex-1 block mb-[1px]"></span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Estudiantes Compacta */}
                        <div className="mt-1">
                            <table className="w-full text-left text-[9px] border-collapse border-4 border-double border-slate-800 table-fixed">
                                <thead>
                                    <tr className="bg-white text-slate-950 uppercase text-[8.5px] tracking-wide text-center" style={{ height: '0.42cm' }}>
                                        <th rowSpan="2" className="border border-slate-400 w-[2.5%] font-black text-[9px]">N°</th>
                                        <th rowSpan="2" className="border border-slate-400 text-left px-1.5 w-[25%] font-bold text-[9.5px] truncate text-slate-950">Estudiante (Nombre Completo)</th>
                                        <th colSpan="10" className="border border-slate-400 w-[20%] font-black text-[8.5px] bg-white text-slate-950">ASISTENCIA</th>
                                        <th className="border border-slate-400 w-[3.5%] font-bold text-[7.5px]">Prueba 1</th>
                                        <th className="border border-slate-400 w-[3.5%] font-bold text-[7.5px]">Prueba 2</th>
                                        <th colSpan="6" className="border border-slate-400 w-[17.5%] font-bold text-[8px]">Guía (20%)</th>
                                        <th colSpan="6" className="border border-slate-400 w-[17.5%] font-bold text-[8px]">Ejercitación (20%)</th>
                                        <th className="border border-slate-400 w-[4.5%] font-bold text-[7.5px]">Actitud.</th>
                                        <th rowSpan="2" className="border border-slate-400 w-[5.5%] font-black text-[9px]">Def.</th>
                                    </tr>
                                    <tr className="bg-white text-slate-950 text-[7.5px] text-center font-bold" style={{ height: '0.34cm' }}>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>
                                        <th className="border border-slate-400 font-semibold"></th>

                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">20%</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">20%</th>

                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">G1</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">G2</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">G3</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">G4</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">G5</th>
                                        <th className="border border-slate-400 font-black bg-slate-100 text-[8px]">Def</th>

                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">E1</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">E2</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">E3</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">E4</th>
                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">E5</th>
                                        <th className="border border-slate-400 font-black bg-slate-100 text-[8px]">Def</th>

                                        <th className="border border-slate-400 font-extrabold text-[7.5px]">20%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentList.length === 0 ? (
                                        Array.from({ length: 22 }).map((_, index) => (
                                            <tr key={index} className="text-center font-normal" style={{ height: '0.36cm' }}>
                                                <td className="border border-slate-300 font-bold text-[8.5px]">{index + 1}</td>
                                                <td className="border border-slate-300 text-left px-1.5"></td>
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
                                                <td className="border border-slate-300"></td>
                                                <td className="border border-slate-300"></td>
                                                <td className="border border-slate-300"></td>
                                                <td className="border border-slate-300"></td>
                                                <td className="border border-slate-300"></td>
                                                <td className="border border-slate-300"></td>
                                            </tr>
                                        ))
                                    ) : (
                                        studentList.map((st, index) => {
                                            const gradeData = grades ? grades[st.id] : null;
                                            const finalGrade = gradeData ? Number(gradeData.grade) : null;
                                            const displayName = st.lastName && st.firstName 
                                                ? `${st.lastName} ${st.firstName}` 
                                                : st.name;

                                            return (
                                                <tr key={st.id} className="text-center font-normal hover:bg-slate-50/20" style={{ height: '0.36cm' }}>
                                                    <td className="border border-slate-300 font-bold text-[8.5px] text-slate-900">{index + 1}</td>
                                                    <td className="border border-slate-300 text-left px-1.5 font-medium uppercase truncate text-[9px] text-slate-900 tracking-tight leading-none">
                                                        {displayName}
                                                    </td>
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
                                                    <td className="border border-slate-300 text-slate-950 text-[8.5px] font-bold bg-slate-50/10">
                                                        {(!isBlankTemplate && gradeData?.components?.prueba1 !== undefined) ? gradeData.components.prueba1 : ''}
                                                    </td>
                                                    
                                                    {/* Prueba 2 */}
                                                    <td className="border border-slate-300 text-slate-950 text-[8.5px] font-bold bg-slate-50/10">
                                                        {(!isBlankTemplate && gradeData?.components?.prueba2 !== undefined) ? gradeData.components.prueba2 : ''}
                                                    </td>

                                                    {/* Guía */}
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300 bg-slate-50/50 text-slate-950 text-[8.5px] font-bold">
                                                        {(!isBlankTemplate && gradeData?.components?.guia !== undefined) ? gradeData.components.guia : ''}
                                                    </td>

                                                    {/* Ejercitación */}
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300"></td>
                                                    <td className="border border-slate-300 bg-slate-50/50 text-slate-950 text-[8.5px] font-bold">
                                                        {(!isBlankTemplate && gradeData?.components?.ejercitacion !== undefined) ? gradeData.components.ejercitacion : ''}
                                                    </td>

                                                    {/* Actitudinal */}
                                                    <td className="border border-slate-300 text-slate-950 text-[8.5px] font-bold bg-slate-50/10">
                                                        {(!isBlankTemplate && gradeData?.components?.actitudinal !== undefined) ? gradeData.components.actitudinal : ''}
                                                    </td>

                                                    {/* Definitiva */}
                                                    <td className={`border border-slate-300 text-[9.5px] font-bold ${
                                                        finalGrade ? (finalGrade >= 75 ? 'text-slate-950 bg-slate-50/20' : 'text-rose-700 bg-rose-50/10') : ''
                                                    }`}>
                                                        {finalGrade !== null ? finalGrade.toFixed(0) : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}

                                    {studentList.length > 0 && (
                                        <tr className="border-t-2 border-slate-450 font-black text-slate-950 bg-slate-50/50" style={{ height: '0.48cm' }}>
                                            <td colSpan="2" className="border border-slate-300 px-2 text-left text-[8.5px] uppercase font-black">
                                                Total Estudiantes
                                            </td>
                                            <td colSpan="26" className="border border-slate-300 text-left px-3 text-[8.5px] font-black">
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
        <div className="min-h-screen bg-slate-100 py-6 px-4 flex flex-col items-center select-none overflow-y-auto no-print-bg">
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
                    
                    /* Forzar tamaño oficio legal horizontal (33cm x 21.6cm) */
                    @page {
                        size: 33cm 21.6cm;
                        margin: 0;
                    }
                    
                    html, body {
                        width: 33cm !important;
                        height: 21.6cm !important;
                        max-height: 21.6cm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }

                    .no-print-scroll {
                        width: 33cm !important;
                        height: 20.2cm !important;
                        max-height: 20.2cm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .printable-sheet {
                        width: 33cm !important;
                        height: 20.2cm !important;
                        max-height: 20.2cm !important;
                        margin: 0 auto !important;
                        padding: 0.35cm 0.45cm 0.3cm 1.45cm !important;
                        box-sizing: border-box !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        overflow: hidden !important;
                        position: relative !important;
                    }

                    .printable-sheet:not(:last-child) {
                        page-break-after: always !important;
                        break-after: page !important;
                    }

                    .printable-sheet:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }

                    .page-border {
                        top: 0.25cm !important;
                        bottom: 0.25cm !important;
                        left: 0.45cm !important;
                        right: 0.35cm !important;
                        border: 2px double #334155 !important;
                    }
                }

                /* Estilo de pantalla normal para cada hoja */
                .printable-sheet {
                    width: 33cm;
                    height: 21.6cm;
                    margin: 0 auto;
                    background-color: white;
                    padding: 0.45cm 0.5cm 0.4cm 1.45cm;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                @media screen {
                    .no-print-scroll {
                        width: 100%;
                        overflow-x: auto;
                        padding-bottom: 12px;
                    }
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
                            <p className="text-[10px] text-gray-500">Imprime planillas en tamaño Oficio (33 x 22 cm) individuales o en lote masivo por Curso, Docente o Colegio.</p>
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
                            disabled={printMode !== 'single' && loadedBatchData.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-2xl transition text-xs shadow-md shadow-indigo-600/15 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Printer size={15} /> 
                            {printMode !== 'single' ? `Imprimir Lote (${loadedBatchData.length} planillas)` : 'Imprimir Planilla'}
                        </button>
                    </div>
                </div>

                {/* Selector de Modo de Impresión Masiva */}
                <div className="flex border-b border-gray-100 gap-2 flex-wrap">
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
                        onClick={() => setPrintMode('course')}
                        className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1 ${
                            printMode === 'course' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-gray-450 hover:text-gray-600'
                        }`}
                    >
                        <Layers size={14} /> Impresión por Curso
                    </button>
                    <button
                        onClick={() => setPrintMode('batch')}
                        className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all ${
                            printMode === 'batch' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-gray-450 hover:text-gray-600'
                        }`}
                    >
                        Impresión por Docente
                    </button>
                    <button
                        onClick={() => setPrintMode('all_courses')}
                        className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1 ${
                            printMode === 'all_courses' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-gray-450 hover:text-gray-600'
                        }`}
                    >
                        <Grid size={14} /> Todas las Planillas del Colegio
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

                {/* Configuración Modos Masivos / Lote */}
                {printMode !== 'single' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {printMode === 'batch' && (
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
                            )}

                            {printMode === 'course' && (
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Seleccionar Curso</label>
                                    <select 
                                        className="w-full bg-gray-55 border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                        disabled={loadingBatch}
                                    >
                                        {courses.map(c => (
                                            <option key={c} value={c}>Curso {c} (Todas las Asignaturas)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {printMode === 'all_courses' && (
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cursos Afectados</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                                        🎓 {courses.length} Cursos ({batchClasses.length} Planillas totales)
                                    </div>
                                </div>
                            )}

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
                                        <><RefreshCw size={14} /> Cargar Lote ({batchClasses.filter(c => c.checked).length} Planillas)</>
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
                                    <div className="text-[10px] text-gray-400 italic">No hay asignaturas seleccionadas.</div>
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
                    <div className="no-print-scroll">
                        {renderPlanillaSheet(selectedCourse, selectedSubject, students, gradesMap)}
                    </div>
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
                        <h4 className="text-xs font-bold text-slate-300">Lote de Planillas sin cargar</h4>
                        <p className="text-[10px] text-slate-400 max-w-sm font-semibold leading-normal mt-1">
                            Haz clic en "Cargar Lote de Planillas" para previsualizar y compilar las planillas antes de imprimir o guardar en PDF.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full gap-8">
                        {loadedBatchData.map((data, idx) => (
                            <div key={idx} className="no-print-scroll">
                                {renderPlanillaSheet(data.course, data.subject, data.students, data.gradesMap)}
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
