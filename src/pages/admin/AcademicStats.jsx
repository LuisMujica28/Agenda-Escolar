import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, Loader2, TrendingUp, Award, Users, 
    BookOpen, AlertTriangle, Sparkles, BarChart2, CheckCircle2, Printer,
    Filter, Calendar, ShieldAlert, Target, GraduationCap, Flame, Star, ChevronRight,
    Medal, Crown, AlertCircle, FileText, Search, Trophy, Compass, Check
} from 'lucide-react';

export default function AcademicStats() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Pestaña Activa: 'overview', 'course_ranking', 'subject_ranking', 'global_ranking', 'honor_roll_print', 'diplomas_print'
    const [activeTab, setActiveTab] = useState('overview');

    // Filtros
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState("ALL");
    const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("ALL");
    const [coursesList, setCoursesList] = useState([]);
    const [subjectsList, setSubjectsList] = useState([]);

    // Curso seleccionado para impresión de Cuadro de Honor / Diplomas
    const [printSelectedCourse, setPrintSelectedCourse] = useState("");

    // Datasets
    const [rawStudents, setRawStudents] = useState([]);
    const [rawGrades, setRawGrades] = useState([]);

    // Estadísticas Calculadas
    const [stats, setStats] = useState({
        globalAverage: 0,
        passingRate: 0,
        excellentRate: 0,
        studentsAtRiskCount: 0,
        studentsYellowZoneCount: 0,
        totalStudents: 0,
        totalGradesRegistered: 0,
        totalSubjects: 0
    });

    const [resettingGrades, setResettingGrades] = useState(false);
    const [courseAverages, setCourseAverages] = useState([]);
    const [subjectAverages, setSubjectAverages] = useState([]);
    const [performanceDistribution, setPerformanceDistribution] = useState({
        superior: 0,
        alto: 0,
        basico: 0,
        bajo: 0
    });

    // Listas de Diagnóstico y Rankings
    const [topStudents, setTopStudents] = useState([]);
    const [studentsAtRiskList, setStudentsAtRiskList] = useState([]);
    const [yellowZoneList, setYellowZoneList] = useState([]);
    const [courseRankingsMap, setCourseRankingsMap] = useState({});
    const [subjectRankingsMap, setSubjectRankingsMap] = useState({});
    const [globalRankingsList, setGlobalRankingsList] = useState([]);
    const [topSubjectObj, setTopSubjectObj] = useState(null);
    const [lowestSubjectObj, setLowestSubjectObj] = useState(null);
    const [logoError, setLogoError] = useState(false);

    // 1. Carga inicial de datos desde Firestore
    useEffect(() => {
        if (!currentUser) return;

        async function fetchAcademicData() {
            setLoading(true);
            try {
                let studentsData = [];
                let gradesData = [];

                const sSnap = await getDocs(collection(db, 'students'));
                const gSnap = await getDocs(collection(db, 'grades'));

                studentsData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                gradesData = gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Generar datos simulados de respaldo si la base de datos está vacía
                if (studentsData.length === 0 || gradesData.length === 0) {
                    const courses = ['701', '801', '802', '901', '1001', '1101'];
                    const subjects = ['Matemáticas', 'Geometría', 'Español y Literatura', 'Inglés', 'C. Naturales (Biología)', 'C Sociales Filosofía', 'C. Naturales (Física)', 'C Naturales (Química)', 'Ed Ética y Valores', 'Ed Física', 'Tecnología e Informática', 'Artes plásticas'];
                    const firstNames = ['Juan', 'María', 'Carlos', 'Sofía', 'Andrés', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Felipe', 'Lucía', 'Diego', 'Paula', 'Nicolás', 'Gabriela', 'Alejandro'];
                    const lastNames = ['Pérez', 'García', 'López', 'Rodríguez', 'Gómez', 'Martínez', 'Sánchez', 'Díaz', 'Hernández', 'Álvarez', 'Torres', 'Ramírez', 'Ruiz', 'Castro', 'Morales', 'Suárez'];

                    for (let i = 1; i <= 80; i++) {
                        const sId = `s-mock-${i}`;
                        const course = courses[Math.floor(Math.random() * courses.length)];
                        const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
                        const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
                        const name = `${fName} ${lName}`.toUpperCase();

                        studentsData.push({
                            id: sId,
                            name,
                            firstName: fName.toUpperCase(),
                            lastName: lName.toUpperCase(),
                            grade: course,
                            id_code: `INAS-${1000 + i}`,
                            photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fName}${i}`
                        });

                        subjects.forEach(subject => {
                            let baseGrade = 65 + Math.floor(Math.random() * 33);
                            if (Math.random() < 0.12) baseGrade = 45 + Math.floor(Math.random() * 25);

                            [1, 2].forEach(p => {
                                gradesData.push({
                                    id: `g-mock-${sId}-${subject}-p${p}`,
                                    student_id: sId,
                                    subject,
                                    grade: baseGrade,
                                    period: p
                                });
                            });
                        });
                    }
                }

                setRawStudents(studentsData);
                setRawGrades(gradesData);

                const coursesFound = [...new Set(studentsData.map(s => s.grade))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                setCoursesList(coursesFound);
                if (coursesFound.length > 0) {
                    setPrintSelectedCourse(coursesFound[0]);
                }

                const subjectsFound = [...new Set(gradesData.map(g => g.subject))].filter(Boolean).sort();
                setSubjectsList(subjectsFound);

            } catch (err) {
                console.error("Error cargando estadísticas académicas:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAcademicData();
    }, [currentUser]);

    // Limpieza de notas de prueba para un curso
    const handleResetCourseGrades = async () => {
        if (!selectedCourse) return;

        const confirmationText = window.prompt(
            `⚠️ ATENCIÓN: Esta acción eliminará PERMANENTEMENTE todas las calificaciones guardadas del Curso ${selectedCourse}.\n\nPara confirmar, escribe exactamente la palabra "BORRAR" en el cuadro de abajo:`
        );

        if (!confirmationText || confirmationText.trim().toUpperCase() !== 'BORRAR') {
            if (confirmationText !== null) {
                alert('Acción cancelada: La palabra de confirmación no coincide.');
            }
            return;
        }

        setResettingGrades(true);
        try {
            const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
            const sSnap = await getDocs(qStudents);
            const studentIds = sSnap.docs.map(doc => doc.id);

            if (studentIds.length === 0) {
                alert("No hay estudiantes en este curso.");
                setResettingGrades(false);
                return;
            }

            let deletedCount = 0;
            const batch = writeBatch(db);

            for (const studentId of studentIds) {
                const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentId));
                const gSnap = await getDocs(qGrades);
                gSnap.docs.forEach(doc => {
                    batch.delete(doc.ref);
                    deletedCount++;
                });
            }

            if (deletedCount > 0) {
                await batch.commit();
            }

            alert(`Se eliminaron con éxito ${deletedCount} calificaciones del Curso ${selectedCourse}.`);

            const sSnapAll = await getDocs(collection(db, 'students'));
            const gSnapAll = await getDocs(collection(db, 'grades'));
            setRawStudents(sSnapAll.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setRawGrades(gSnapAll.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error("Error al restablecer calificaciones:", error);
            alert("Error al eliminar calificaciones: " + error.message);
        } finally {
            setResettingGrades(false);
        }
    };

    // 2. Efecto de cálculos estadísticos dinámicos y Rankings
    useEffect(() => {
        if (rawStudents.length === 0) return;

        // Filtrar notas por periodo si aplica
        let activeGrades = rawGrades;
        if (selectedPeriod !== "ALL") {
            activeGrades = rawGrades.filter(g => String(g.period) === String(selectedPeriod));
        }

        // Mapear solo estudiantes ACTIVOS (excluyendo retirados) a objeto de cálculos
        const activeStudentsOnly = rawStudents.filter(s => s.status !== 'retirado');

        const studentsMap = {};
        activeStudentsOnly.forEach(student => {
            studentsMap[student.id] = {
                ...student,
                subjectsMap: {},
                gradesSum: 0,
                gradesCount: 0,
                failedSubjectsCount: 0
            };
        });

        const overallSubjectStats = {};
        const filteredSubjectStats = {};
        const courseStats = {};

        activeGrades.forEach(gradeDoc => {
            const studentId = gradeDoc.student_id;
            const gradeVal = Number(gradeDoc.grade);
            const subject = gradeDoc.subject;

            if (isNaN(gradeVal) || gradeVal <= 0) return;

            if (studentsMap[studentId]) {
                const stObj = studentsMap[studentId];
                stObj.gradesSum += gradeVal;
                stObj.gradesCount += 1;

                if (!stObj.subjectsMap[subject]) {
                    stObj.subjectsMap[subject] = { sum: 0, count: 0 };
                }
                stObj.subjectsMap[subject].sum += gradeVal;
                stObj.subjectsMap[subject].count += 1;
            }

            if (!overallSubjectStats[subject]) {
                overallSubjectStats[subject] = { sum: 0, count: 0, totalFailed: 0 };
            }
            overallSubjectStats[subject].sum += gradeVal;
            overallSubjectStats[subject].count += 1;
        });

        // Calcular promedios por estudiante y materias reprobadas
        const analyzedStudents = Object.values(studentsMap).map(s => {
            const avg = s.gradesCount > 0 ? Number((s.gradesSum / s.gradesCount).toFixed(2)) : 0;
            
            let failedCount = 0;
            Object.entries(s.subjectsMap).forEach(([subjName, subjObj]) => {
                const subjAvg = subjObj.count > 0 ? subjObj.sum / subjObj.count : 0;
                if (subjAvg > 0 && subjAvg < 75) {
                    failedCount++;
                }
            });

            return {
                ...s,
                average: avg,
                failedSubjectsCount: failedCount
            };
        }).filter(s => s.gradesCount > 0);

        // Escalafón / Ranking Institucional Global
        const globalRanked = [...analyzedStudents].sort((a, b) => b.average - a.average).map((st, idx) => ({
            ...st,
            globalRank: idx + 1
        }));
        setGlobalRankingsList(globalRanked);

        // Rankings por Salón / Curso
        const courseMapRankings = {};
        coursesList.forEach(crs => {
            const courseSts = globalRanked.filter(s => s.grade === crs).sort((a, b) => b.average - a.average);
            courseMapRankings[crs] = courseSts.map((st, idx) => ({
                ...st,
                courseRank: idx + 1
            }));
        });
        setCourseRankingsMap(courseMapRankings);

        // Rankings por Asignatura
        const subjRankings = {};
        activeGrades.forEach(gradeDoc => {
            const gradeVal = Number(gradeDoc.grade);
            if (isNaN(gradeVal) || gradeVal <= 0) return;
            const subject = gradeDoc.subject;
            const stObj = rawStudents.find(s => s.id === gradeDoc.student_id);
            if (!stObj) return;

            if (!subjRankings[subject]) {
                subjRankings[subject] = [];
            }
            subjRankings[subject].push({
                studentId: stObj.id,
                name: stObj.name,
                firstName: stObj.firstName,
                lastName: stObj.lastName,
                grade: stObj.grade,
                id_code: stObj.id_code,
                photo_url: stObj.photo_url,
                gradeValue: gradeVal,
                period: gradeDoc.period
            });
        });

        Object.keys(subjRankings).forEach(subj => {
            subjRankings[subj].sort((a, b) => b.gradeValue - a.gradeValue);
        });
        setSubjectRankingsMap(subjRankings);

        // Promedios por curso (Comparativo)
        analyzedStudents.forEach(s => {
            const gradeName = s.grade;
            if (!courseStats[gradeName]) {
                courseStats[gradeName] = { sum: 0, count: 0, riskCount: 0 };
            }
            courseStats[gradeName].sum += s.average;
            courseStats[gradeName].count += 1;
            if (s.failedSubjectsCount > 0 || s.average < 75) {
                courseStats[gradeName].riskCount += 1;
            }
        });

        const coursesArray = Object.entries(courseStats).map(([grade, cStats]) => ({
            grade,
            average: Number((cStats.sum / cStats.count).toFixed(1)),
            studentCount: cStats.count,
            riskCount: cStats.riskCount
        })).sort((a, b) => a.grade.localeCompare(b, undefined, { numeric: true }));

        setCourseAverages(coursesArray);

        // Filtrar estudiantes por curso seleccionado
        const finalStudentsToAnalyze = selectedCourse 
            ? globalRanked.filter(s => s.grade === selectedCourse) 
            : globalRanked;

        const finalStudentIds = new Set(finalStudentsToAnalyze.map(s => s.id));

        // Asignaturas filtradas
        activeGrades.forEach(gradeDoc => {
            if (finalStudentIds.has(gradeDoc.student_id)) {
                const gradeVal = Number(gradeDoc.grade);
                if (isNaN(gradeVal) || gradeVal <= 0) return;
                const subject = gradeDoc.subject;
                if (!filteredSubjectStats[subject]) {
                    filteredSubjectStats[subject] = { sum: 0, count: 0, lowCount: 0 };
                }
                filteredSubjectStats[subject].sum += gradeVal;
                filteredSubjectStats[subject].count += 1;
                if (gradeVal < 75) {
                    filteredSubjectStats[subject].lowCount += 1;
                }
            }
        });

        const targetSubjectStats = selectedCourse ? filteredSubjectStats : overallSubjectStats;

        const subjectsArray = Object.entries(targetSubjectStats).map(([subject, sStats]) => {
            const avg = Number((sStats.sum / sStats.count).toFixed(1));
            return {
                subject,
                average: avg,
                totalNotes: sStats.count,
                lowCount: sStats.lowCount || 0
            };
        }).sort((a, b) => b.average - a.average);

        setSubjectAverages(subjectsArray);

        if (subjectsArray.length > 0) {
            setTopSubjectObj(subjectsArray[0]);
            setLowestSubjectObj(subjectsArray[subjectsArray.length - 1]);
        }

        // Indicadores consolidados
        const totalStudents = finalStudentsToAnalyze.length;
        let globalSum = 0;
        let passingCount = 0;
        let excellentCount = 0;
        let riskCount = 0;
        let yellowCount = 0;

        const dist = { superior: 0, alto: 0, basico: 0, bajo: 0 };

        finalStudentsToAnalyze.forEach(st => {
            globalSum += st.average;
            
            if (st.average >= 95) {
                dist.superior++;
                excellentCount++;
            } else if (st.average >= 80) {
                dist.alto++;
            } else if (st.average >= 75) {
                dist.basico++;
            } else {
                dist.bajo++;
            }

            if (st.failedSubjectsCount === 0 && st.average >= 75) {
                passingCount++;
            }

            if (st.failedSubjectsCount >= 2 || st.average < 75) {
                riskCount++;
            } else if (st.failedSubjectsCount === 1 || (st.average >= 75 && st.average < 79)) {
                yellowCount++;
            }
        });

        const gAvg = totalStudents > 0 ? (globalSum / totalStudents).toFixed(1) : "0.0";
        const passRate = totalStudents > 0 ? ((passingCount / totalStudents) * 100).toFixed(0) : 0;
        const excRate = totalStudents > 0 ? ((excellentCount / totalStudents) * 100).toFixed(0) : 0;

        setStats({
            globalAverage: gAvg,
            passingRate: passRate,
            excellentRate: excRate,
            studentsAtRiskCount: riskCount,
            studentsYellowZoneCount: yellowCount,
            totalStudents,
            totalGradesRegistered: activeGrades.length,
            totalSubjects: subjectsArray.length
        });

        setPerformanceDistribution(dist);

        // Cuadro de Honor Top
        const sortedTop = [...finalStudentsToAnalyze].sort((a, b) => b.average - a.average);
        setTopStudents(sortedTop.slice(0, 10));

        // Estudiantes en Riesgo (Zona Roja: 2 o más materias reprobadas o promedio < 75)
        const sortedRisk = [...finalStudentsToAnalyze]
            .filter(s => s.failedSubjectsCount >= 2 || s.average < 75)
            .sort((a, b) => a.average - b.average);
        setStudentsAtRiskList(sortedRisk);

        // Estudiantes en Zona Amarilla (Alerta Preventiva: 1 materia en bajo O promedio al borde 75-78 pts)
        const sortedYellow = [...finalStudentsToAnalyze]
            .filter(s => (s.failedSubjectsCount === 1) || (s.failedSubjectsCount === 0 && s.average >= 75 && s.average < 79))
            .sort((a, b) => a.average - b.average);
        setYellowZoneList(sortedYellow);

    }, [rawStudents, rawGrades, selectedCourse, selectedPeriod, coursesList]);

    if (loading) {
        return (
            <div className="p-12 flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-indigo-600 mb-3" size={40} />
                <p className="text-sm font-extrabold text-slate-600">Calculando analíticas y escalafones académicos...</p>
            </div>
        );
    }

    const targetCourseForPrint = printSelectedCourse || selectedCourse || (coursesList.length > 0 ? coursesList[0] : '701');
    const honorRollStudentsPrint = (courseRankingsMap[targetCourseForPrint] || []).slice(0, 5);
    const topThreeDiplomasPrint = (courseRankingsMap[targetCourseForPrint] || []).slice(0, 3);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            
            {/* Header de Navegación y Título */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition border border-slate-200/60 active-press"
                        title="Volver al Tablero Principal"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                                Instituto Nueva América de Suba
                            </span>
                        </div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                            Estadísticas & Rankings Académicos
                        </h1>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setActiveTab('honor_roll_print')}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl shadow-md transition flex items-center gap-2 active-press"
                    >
                        <Printer size={15} /> Cuadro de Honor
                    </button>
                    <button
                        onClick={() => setActiveTab('diplomas_print')}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition flex items-center gap-2 active-press"
                    >
                        <Award size={15} /> Diplomas de Excelencia (Top 3)
                    </button>
                </div>
            </div>

            {/* Menú de Pestañas de Navegación del Módulo */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-3">
                {[
                    { id: 'overview', label: '📊 Resumen & Diagnóstico', icon: BarChart2 },
                    { id: 'course_ranking', label: '🏆 Ranking por Salón', icon: Trophy },
                    { id: 'subject_ranking', label: '🥇 Ranking por Materia', icon: Medal },
                    { id: 'global_ranking', label: '🎖️ Ranking Institucional', icon: Crown },
                    { id: 'honor_roll_print', label: '📜 Cuadro de Honor Imprimible', icon: Printer },
                    { id: 'diplomas_print', label: '🎓 Diplomas de Excelencia (Top 3)', icon: Award }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 border transition active-press ${
                                isActive
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Filtros Generales Supremos */}
            {activeTab !== 'honor_roll_print' && activeTab !== 'diplomas_print' && (
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-indigo-600" />
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Filtros de Análisis Académico</h3>
                        </div>

                        <div className="text-[11px] font-bold text-slate-500">
                            Evaluados: <span className="text-slate-900 font-extrabold">{stats.totalStudents} Estudiantes</span> • Calificaciones: <span className="text-indigo-600 font-extrabold">{stats.totalGradesRegistered} notas</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Selector de Periodo */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Periodo Escolar</label>
                            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                                {[
                                    { id: "ALL", label: "🗓️ Todos" },
                                    { id: "1", label: "P1" },
                                    { id: "2", label: "P2" },
                                    { id: "3", label: "P3" },
                                    { id: "4", label: "P4" }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPeriod(p.id)}
                                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                                            selectedPeriod === p.id 
                                                ? 'bg-white text-indigo-600 shadow-sm' 
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Selector de Cursos (Pills) */}
                        <div className="lg:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grado / Curso</label>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                <button
                                    onClick={() => setSelectedCourse("")}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                                        selectedCourse === ""
                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                    }`}
                                >
                                    🎓 Todos los Cursos
                                </button>
                                {coursesList.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setSelectedCourse(c)}
                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                                            selectedCourse === c
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                        }`}
                                    >
                                        Curso {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 1: RESUMEN GENERAL & DIAGNÓSTICO */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Tarjetas KPI de Métricas Académicas Clave */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* 1. Promedio General */}
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl"></div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">PROMEDIO GENERAL</p>
                                    <h3 className="text-4xl font-black text-white mt-2 tracking-tight">
                                        {stats.globalAverage || "0.0"} <span className="text-xs font-normal text-indigo-300">/100 pts</span>
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                    <TrendingUp className="text-indigo-300" size={20} />
                                </div>
                            </div>
                            <p className="text-[11px] text-indigo-200/80 font-medium mt-4">
                                {selectedCourse ? `Grado ${selectedCourse}` : 'Institucional Completo'}
                            </p>
                        </div>

                        {/* 2. Tasa de Aprobación */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TASA DE APROBACIÓN</p>
                                    <h3 className="text-4xl font-black text-slate-800 mt-2 tracking-tight">
                                        {stats.passingRate}%
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle2 size={20} />
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.passingRate}%` }}></div>
                            </div>
                        </div>

                        {/* 3. Nivel Excelente */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EXCELENTE (SUPERIOR ≥95)</p>
                                    <h3 className="text-4xl font-black text-slate-800 mt-2 tracking-tight">
                                        {stats.excellentRate}%
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                                    <Star size={20} />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 font-semibold mt-4">
                                {performanceDistribution.superior} estudiantes en nivel Superior
                            </p>
                        </div>

                        {/* 4. Alerta Semáforo de Riesgo */}
                        <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">ALUMNOS EN RIESGO</p>
                                    <h3 className="text-4xl font-black text-rose-700 mt-2 tracking-tight">
                                        {stats.studentsAtRiskCount} <span className="text-xs font-semibold text-rose-500">alumnos</span>
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                    <ShieldAlert size={20} />
                                </div>
                            </div>
                            <p className="text-[11px] text-rose-600 font-bold mt-4">
                                Tienen 2 o más materias perdidas (&lt;75)
                            </p>
                        </div>
                    </div>

                    {/* Semáforo de Alerta Temprana & Diagnóstico de Materias */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Escala de Desempeño Ley 1290 */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                            <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2 border-b pb-3">
                                <Target size={18} className="text-indigo-600" /> Escala de Desempeño Escolar
                            </h3>

                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
                                    <span className="font-bold text-emerald-800">Superior (95 - 100 pts)</span>
                                    <span className="font-black text-emerald-700 bg-white px-2.5 py-0.5 rounded-full shadow-xs">{performanceDistribution.superior} alumnos</span>
                                </div>

                                <div className="flex justify-between items-center bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
                                    <span className="font-bold text-blue-800">Alto (80 - 94 pts)</span>
                                    <span className="font-black text-blue-700 bg-white px-2.5 py-0.5 rounded-full shadow-xs">{performanceDistribution.alto} alumnos</span>
                                </div>

                                <div className="flex justify-between items-center bg-amber-50/60 p-3 rounded-2xl border border-amber-100">
                                    <span className="font-bold text-amber-800">Básico (75 - 79 pts)</span>
                                    <span className="font-black text-amber-700 bg-white px-2.5 py-0.5 rounded-full shadow-xs">{performanceDistribution.basico} alumnos</span>
                                </div>

                                <div className="flex justify-between items-center bg-rose-50/60 p-3 rounded-2xl border border-rose-100">
                                    <span className="font-bold text-rose-800">Bajo (&lt; 75 pts)</span>
                                    <span className="font-black text-rose-700 bg-white px-2.5 py-0.5 rounded-full shadow-xs">{performanceDistribution.bajo} alumnos</span>
                                </div>
                            </div>
                        </div>

                        {/* Asignatura Estrella vs Asignatura Crítica */}
                        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                            <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2 border-b pb-3">
                                <Compass size={18} className="text-indigo-600" /> Diagnóstico de Asignaturas (Estrella vs Crítica)
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Materia Estrella */}
                                {topSubjectObj ? (
                                    <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 rounded-2xl shadow-md space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">MATERIA ESTRELLA</span>
                                            <Star size={18} className="text-amber-300 fill-amber-300" />
                                        </div>
                                        <h4 className="text-lg font-black">{topSubjectObj.subject}</h4>
                                        <p className="text-2xl font-black tracking-tight">{topSubjectObj.average} <span className="text-xs font-normal">/100 pts</span></p>
                                        <p className="text-[10px] text-emerald-100 font-medium">Mayor promedio general acumulado</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-bold">Cargando materia...</div>
                                )}

                                {/* Materia Crítica */}
                                {lowestSubjectObj ? (
                                    <div className="bg-gradient-to-br from-rose-600 to-pink-800 text-white p-5 rounded-2xl shadow-md space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">MATERIA CRÍTICA</span>
                                            <AlertTriangle size={18} className="text-amber-300" />
                                        </div>
                                        <h4 className="text-lg font-black">{lowestSubjectObj.subject}</h4>
                                        <p className="text-2xl font-black tracking-tight">{lowestSubjectObj.average} <span className="text-xs font-normal">/100 pts</span></p>
                                        <p className="text-[10px] text-rose-100 font-medium">Requiere refuerzo pedagógico prioritario</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-bold">Cargando materia...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Semáforo de Prevención: Zona Amarilla (75 - 78 pts) y Zona Roja (<75) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Zona Amarilla: Prevención a Tiempo */}
                        <div className="bg-amber-50/40 border border-amber-200/70 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                                <h3 className="text-sm font-black text-amber-900 tracking-tight flex items-center gap-2">
                                    <AlertCircle size={18} className="text-amber-600" /> Zona Amarilla: Alerta Temprana (1 materia en bajo o Promedio 75 - 78 pts)
                                </h3>
                                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                    {yellowZoneList.length} alumnos
                                </span>
                            </div>

                            {yellowZoneList.length === 0 ? (
                                <p className="text-xs text-amber-700 font-semibold p-4 text-center">No hay alumnos en riesgo inminente de vulnerabilidad.</p>
                            ) : (
                                <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
                                    {yellowZoneList.map(st => (
                                        <div key={st.id} className="bg-white p-3 rounded-2xl border border-amber-200/50 flex items-center justify-between text-xs shadow-xs">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-100 shrink-0">
                                                    <img src={st.photo_url} alt={st.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <span className="font-extrabold text-slate-800 block">{st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}</span>
                                                    <span className="text-[10px] text-amber-700 font-bold">
                                                        {st.failedSubjectsCount > 0 ? `⚠️ ${st.failedSubjectsCount} materia en bajo (<75)` : '⚠️ Promedio en franja crítica (75-78 pts)'} • Grado {st.grade}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl text-xs">
                                                {st.average} Prom. Gral
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Zona Roja: Estudiantes Reprobados */}
                        <div className="bg-rose-50/40 border border-rose-200/70 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-rose-200/60 pb-3">
                                <h3 className="text-sm font-black text-rose-900 tracking-tight flex items-center gap-2">
                                    <ShieldAlert size={18} className="text-rose-600" /> Zona Roja: Pérdida por Materias Reprobadas (≥ 2 asignaturas)
                                </h3>
                                <span className="text-xs font-black text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full">
                                    {studentsAtRiskList.length} alumnos
                                </span>
                            </div>

                            {studentsAtRiskList.length === 0 ? (
                                <p className="text-xs text-emerald-700 font-semibold p-4 text-center">¡Felicitaciones! Ningún estudiante registra pérdida académica.</p>
                            ) : (
                                <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
                                    {studentsAtRiskList.map(st => (
                                        <div key={st.id} className="bg-white p-3 rounded-2xl border border-rose-200/50 flex items-center justify-between text-xs shadow-xs">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-rose-100 shrink-0">
                                                    <img src={st.photo_url} alt={st.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <span className="font-extrabold text-slate-800 block">{st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}</span>
                                                    <span className="text-[10px] text-rose-600 font-bold">⚠️ {st.failedSubjectsCount} materia(s) en bajo (&lt;75) • Grado {st.grade}</span>
                                                </div>
                                            </div>
                                            <span className="font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl text-xs">
                                                {st.average} Prom. Gral
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 2: RANKING POR SALÓN / CURSO */}
            {activeTab === 'course_ranking' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Trophy size={20} className="text-amber-500" /> Cuadro de Honor por Salón
                            </h3>
                            <span className="text-xs font-bold text-slate-400">Puestos 1° al 10° de cada grado</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(selectedCourse ? [selectedCourse] : coursesList).map(crs => {
                                const courseSts = (courseRankingsMap[crs] || []).slice(0, 5);
                                return (
                                    <div key={crs} className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <span className="font-black text-slate-800 text-sm">Curso {crs}</span>
                                            <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">Top 5 Salón</span>
                                        </div>

                                        <div className="space-y-2">
                                            {courseSts.map((st, idx) => {
                                                const medalColors = [
                                                    "bg-amber-400 text-white shadow-amber-400/30",
                                                    "bg-slate-300 text-slate-800 shadow-slate-300/30",
                                                    "bg-amber-700 text-white shadow-amber-700/30"
                                                ];
                                                return (
                                                    <div key={st.id} className="bg-white p-3 rounded-2xl border border-slate-200/60 flex items-center justify-between shadow-xs">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${medalColors[idx] || 'bg-slate-100 text-slate-600'}`}>
                                                                {idx + 1}°
                                                            </span>
                                                            <div>
                                                                <span className="font-bold text-slate-800 text-xs block truncate max-w-[130px]">
                                                                    {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-mono">Código: {st.id_code}</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-xs">
                                                            {st.average}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 3: RANKING POR MATERIA / ASIGNATURA */}
            {activeTab === 'subject_ranking' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Medal size={20} className="text-indigo-600" /> Medallero de Asignaturas
                            </h3>

                            {/* Selector de Asignatura */}
                            <select
                                value={selectedSubjectFilter}
                                onChange={e => setSelectedSubjectFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/20"
                            >
                                <option value="ALL">🌟 Todas las Asignaturas</option>
                                {subjectsList.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(selectedSubjectFilter === "ALL" ? subjectsList : [selectedSubjectFilter]).map(subj => {
                                const topThree = (subjectRankingsMap[subj] || []).slice(0, 3);
                                if (topThree.length === 0) return null;
                                return (
                                    <div key={subj} className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-lg space-y-4 relative overflow-hidden">
                                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                            <h4 className="font-extrabold text-sm text-indigo-100 truncate">{subj}</h4>
                                            <Crown size={18} className="text-amber-400 shrink-0" />
                                        </div>

                                        <div className="space-y-2.5">
                                            {topThree.map((st, idx) => (
                                                <div key={idx} className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-base">
                                                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                                        </span>
                                                        <div>
                                                            <span className="font-bold text-white block truncate max-w-[120px]">
                                                                {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                                            </span>
                                                            <span className="text-[9.5px] text-indigo-200">Grado {st.grade}</span>
                                                        </div>
                                                    </div>
                                                    <span className="font-black text-amber-300 text-sm">
                                                        {st.gradeValue} pts
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 4: RANKING INSTITUCIONAL GLOBAL */}
            {activeTab === 'global_ranking' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                    <div className="flex justify-between items-center border-b pb-3">
                        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Crown size={20} className="text-amber-500" /> Escalafón Institucional Completo
                        </h3>
                        <span className="text-xs font-bold text-slate-400">{globalRankingsList.length} Estudiantes Ordenados</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                                    <th className="p-3 text-center w-12">Puesto</th>
                                    <th className="p-3">Estudiante</th>
                                    <th className="p-3 text-center">Curso</th>
                                    <th className="p-3 text-center">Código</th>
                                    <th className="p-3 text-right">Promedio Acumulado</th>
                                    <th className="p-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {globalRankingsList.map((st) => (
                                    <tr key={st.id} className="hover:bg-slate-50/60 transition">
                                        <td className="p-3 text-center font-black">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs ${
                                                st.globalRank === 1 ? 'bg-amber-400 text-white font-black' :
                                                st.globalRank === 2 ? 'bg-slate-300 text-slate-800 font-black' :
                                                st.globalRank === 3 ? 'bg-amber-700 text-white font-black' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {st.globalRank}°
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-50 shrink-0">
                                                    <img src={st.photo_url} alt={st.name} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="font-extrabold text-slate-800">
                                                    {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-slate-700">Curso {st.grade}</td>
                                        <td className="p-3 text-center font-mono text-slate-400">{st.id_code}</td>
                                        <td className="p-3 text-right font-black text-indigo-700 text-sm">
                                            {st.average}
                                        </td>
                                        <td className="p-3 text-center">
                                            <Link 
                                                to={`/admin/boletin-print/${st.id}`}
                                                className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1"
                                            >
                                                <BookOpen size={12} /> Boletín
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PESTAÑA 5: VISTA IMPRIMIBLE DE CUADRO DE HONOR (IZADA DE BANDERA) */}
            {activeTab === 'honor_roll_print' && (
                <div className="space-y-6">
                    {/* Barra de Control de Impresión y Selección de Curso */}
                    <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
                        <div>
                            <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                                <Printer size={18} className="text-amber-400" /> Cuadro de Honor — Instituto Nueva América de Suba
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Selecciona el grado para visualizar o imprimir su Cuadro de Honor Oficial.</p>
                        </div>

                        {/* Botones de Selección de Curso */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 mr-1">Seleccionar Grado:</span>
                            {coursesList.map(crs => (
                                <button
                                    key={crs}
                                    onClick={() => setPrintSelectedCourse(crs)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition active-press ${
                                        targetCourseForPrint === crs
                                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-300'
                                            : 'bg-white/10 hover:bg-white/20 text-slate-300'
                                    }`}
                                >
                                    Curso {crs}
                                </button>
                            ))}
                            <button
                                onClick={() => window.print()}
                                className="ml-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 active-press"
                            >
                                <Printer size={15} /> Imprimir / Guardar PDF
                            </button>
                        </div>
                    </div>

                    {/* Hoja Formato Carta Imprimible Oficial */}
                    <div className="w-[21.5cm] min-h-[28cm] bg-white p-[1.5cm] border border-slate-300 shadow-2xl mx-auto relative flex flex-col justify-between overflow-hidden text-slate-900 printable-honor-roll">
                        {/* Borde Oficial Doble */}
                        <div className="absolute inset-[0.4cm] border-[3px] border-slate-800 border-double rounded-xl pointer-events-none"></div>

                        <div className="relative z-10 space-y-6">
                            {/* Encabezado Institucional */}
                            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                                <div className="w-[2.2cm] h-[2.2cm] shrink-0 flex items-center justify-center">
                                    {!logoError ? (
                                        <img 
                                            src="/logo.png" 
                                            alt="Escudo Institución" 
                                            className="w-full h-full object-contain"
                                            onError={() => setLogoError(true)}
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">INAS</div>
                                    )}
                                </div>

                                <div className="text-center space-y-1">
                                    <h2 className="text-xl font-black tracking-tight uppercase text-slate-900">INSTITUTO NUEVA AMÉRICA DE SUBA</h2>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">CUADRO DE HONOR Y EXCELENCIA ACADÉMICA</p>
                                    <p className="text-[10px] font-black text-indigo-900 bg-indigo-50 inline-block px-3.5 py-0.5 rounded-full border border-indigo-200">
                                        GRADO {targetCourseForPrint} • PERIODO LECTIVO {selectedPeriod === "ALL" ? "ACUMULADO GENERAL 2026" : `PERIODO ${selectedPeriod}`}
                                    </p>
                                </div>

                                <div className="text-right text-[9px] font-bold text-slate-500">
                                    <p>AÑO LECTIVO 2026</p>
                                    <p>{new Date().toLocaleDateString('es-ES')}</p>
                                </div>
                            </div>

                            {/* Mensaje de Reconocimiento */}
                            <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs italic font-medium text-slate-700">
                                "La Rectora y el Consejo Académico del Instituto Nueva América de Suba felicitan con orgullo a los estudiantes que han alcanzado la excelencia académica y disciplinaria en el Grado {targetCourseForPrint}."
                            </div>

                            {/* Tabla del Top 5 Cuadro de Honor */}
                            <table className="w-full text-left text-xs border-collapse border border-slate-800">
                                <thead>
                                    <tr className="bg-slate-900 text-white font-black uppercase text-[10px] text-center border-b border-slate-800">
                                        <th className="p-2.5 border-r border-slate-800 w-16">Puesto</th>
                                        <th className="p-2.5 border-r border-slate-800 text-left">Nombres y Apellidos del Estudiante</th>
                                        <th className="p-2.5 border-r border-slate-800 w-32">Código ID</th>
                                        <th className="p-2.5 w-28">Promedio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {honorRollStudentsPrint.map((st, idx) => (
                                        <tr key={st.id} className="border-b border-slate-800 text-center font-bold">
                                            <td className="p-3.5 border-r border-slate-800 font-black text-sm bg-slate-100">
                                                {idx + 1}°
                                            </td>
                                            <td className="p-3.5 border-r border-slate-800 text-left font-black text-sm uppercase">
                                                {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                            </td>
                                            <td className="p-3.5 border-r border-slate-800 font-mono text-slate-600">
                                                {st.id_code}
                                            </td>
                                            <td className="p-3.5 font-black text-base text-indigo-900 bg-indigo-50/50">
                                                {st.average} pts
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Firmas Institucionales al pie */}
                        <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs font-bold border-t border-slate-300 relative z-10">
                            <div>
                                <div className="border-t border-slate-900 w-48 mx-auto mb-1"></div>
                                <p className="font-black text-slate-800 uppercase">Rectora / Dirección</p>
                                <p className="text-[10px] text-slate-500 font-normal">Instituto Nueva América de Suba</p>
                            </div>
                            <div>
                                <div className="border-t border-slate-900 w-48 mx-auto mb-1"></div>
                                <p className="font-black text-slate-800 uppercase">Coordinación Académica</p>
                                <p className="text-[10px] text-slate-500 font-normal">Registro y Control Académico</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 6: GENERADOR DE DIPLOMAS IMPRIMIBLES DE EXCELENCIA (TOP 3) */}
            {activeTab === 'diplomas_print' && (
                <div className="space-y-6">
                    {/* Control de Selección de Curso e Impresión de Diplomas */}
                    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                        <div>
                            <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                                <Award size={22} className="text-amber-200" /> Diplomas de Excelencia Académica — Top 3
                            </h3>
                            <p className="text-xs text-amber-100 mt-1">Imprime los 3 Diplomas de Honor oficiales (1°, 2° y 3° Puesto) para la Izada de Bandera del grado seleccionado.</p>
                        </div>

                        {/* Selector de Curso y Botón de Impresión */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-amber-100 mr-1">Seleccionar Grado:</span>
                            {coursesList.map(crs => (
                                <button
                                    key={crs}
                                    onClick={() => setPrintSelectedCourse(crs)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition active-press ${
                                        targetCourseForPrint === crs
                                            ? 'bg-white text-amber-800 shadow-md shadow-amber-900/30 ring-2 ring-amber-300'
                                            : 'bg-white/20 hover:bg-white/30 text-white'
                                    }`}
                                >
                                    Curso {crs}
                                </button>
                            ))}
                            <button
                                onClick={() => window.print()}
                                className="ml-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 active-press"
                            >
                                <Printer size={15} /> Imprimir Diplomas PDF
                            </button>
                        </div>
                    </div>

                    {/* Generación de los 3 Diplomas de Excelencia por separado */}
                    <div className="space-y-12">
                        {topThreeDiplomasPrint.map((st, idx) => {
                            const rankNames = ["PRIMER LUGAR DE EXCELENCIA", "SEGUNDO LUGAR DE EXCELENCIA", "TERCER LUGAR DE EXCELENCIA"];
                            const rankMedals = ["🥇 1° PUESTO DE HONOR", "🥈 2° PUESTO DE HONOR", "🥉 3° PUESTO DE HONOR"];
                            const badgeGradients = [
                                "from-amber-400 to-yellow-600 border-amber-300 text-slate-950",
                                "from-slate-300 to-slate-400 border-slate-200 text-slate-900",
                                "from-amber-700 to-amber-900 border-amber-600 text-white"
                            ];

                            return (
                                <div 
                                    key={st.id}
                                    className="w-[27.9cm] min-h-[20cm] bg-white p-[1.5cm] border-[2px] border-amber-600/60 shadow-2xl mx-auto relative flex flex-col justify-between overflow-hidden text-slate-900 printable-diploma-page font-serif rounded-3xl"
                                >
                                    {/* Marco Ornamental Doble de Honor */}
                                    <div className="absolute inset-[0.4cm] border-[4px] border-amber-700/80 border-double rounded-2xl pointer-events-none"></div>
                                    <div className="absolute inset-[0.7cm] border border-amber-600/40 rounded-xl pointer-events-none"></div>

                                    {/* Esquinas Decorativas de Diploma */}
                                    <div className="absolute top-4 left-4 text-amber-600 font-bold text-xl pointer-events-none">❖</div>
                                    <div className="absolute top-4 right-4 text-amber-600 font-bold text-xl pointer-events-none">❖</div>
                                    <div className="absolute bottom-4 left-4 text-amber-600 font-bold text-xl pointer-events-none">❖</div>
                                    <div className="absolute bottom-4 right-4 text-amber-600 font-bold text-xl pointer-events-none">❖</div>

                                    <div className="relative z-10 space-y-6 text-center">
                                        {/* Encabezado del Colegio */}
                                        <div className="flex items-center justify-between border-b-2 border-amber-700/40 pb-4">
                                            <div className="w-[2.2cm] h-[2.2cm] shrink-0 flex items-center justify-center">
                                                {!logoError ? (
                                                    <img 
                                                        src="/logo.png" 
                                                        alt="Escudo Institución" 
                                                        className="w-full h-full object-contain"
                                                        onError={() => setLogoError(true)}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full rounded-full bg-slate-900 text-white font-sans font-black text-xs flex items-center justify-center">INAS</div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                <h2 className="text-2xl font-black tracking-wider uppercase text-slate-900 font-sans">
                                                    INSTITUTO NUEVA AMÉRICA DE SUBA
                                                </h2>
                                                <p className="text-[11px] font-sans font-bold text-slate-600 uppercase tracking-widest">
                                                    RESOLUCIÓN DE APROBACIÓN OFICIAL DE SECRETARÍA DE EDUCACIÓN
                                                </p>
                                                <p className="text-[10px] font-sans font-extrabold text-amber-900 bg-amber-50 inline-block px-4 py-0.5 rounded-full border border-amber-200">
                                                    AÑO LECTIVO 2026 • GRADO {targetCourseForPrint}
                                                </p>
                                            </div>

                                            <div className="w-[2.2cm] h-[2.2cm] shrink-0 flex items-center justify-center font-sans">
                                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-[10px] flex flex-col items-center justify-center shadow-lg border-2 border-white text-center leading-tight">
                                                    <span>EXCELENCIA</span>
                                                    <span>2026</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Título del Diploma */}
                                        <div className="py-2 space-y-1">
                                            <span className="text-xs font-sans font-black uppercase tracking-widest text-amber-800 block">
                                                CONFIERE EL PRESENTE RECONOCIMIENTO Y
                                            </span>
                                            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase font-sans">
                                                DIPLOMA DE EXCELENCIA ACADÉMICA
                                            </h1>
                                            <div className="w-48 h-1 bg-gradient-to-r from-transparent via-amber-600 to-transparent mx-auto mt-2"></div>
                                        </div>

                                        {/* Nombre del Estudiante */}
                                        <div className="py-2 space-y-2">
                                            <p className="text-xs italic text-slate-600">Se otorga con especial honor y mérito a:</p>
                                            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-wide font-sans underline decoration-amber-500/50 underline-offset-8">
                                                {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                            </h3>
                                            <p className="text-xs font-sans font-mono text-slate-500">Identificación / Código: {st.id_code}</p>
                                        </div>

                                        {/* Texto Conmemorativo */}
                                        <div className="max-w-3xl mx-auto text-xs font-sans leading-relaxed text-slate-700 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60">
                                            Por haber obtenido el <strong className="text-amber-900 font-extrabold">{rankNames[idx]}</strong> con un promedio sobresaliente de <strong className="text-indigo-900 font-extrabold text-sm">{st.average} puntos</strong> en el <strong className="font-extrabold">Grado {targetCourseForPrint}</strong>, destacándose por su permanente disciplina, vocación de aprendizaje y ejemplo constante para la comunidad educativa del Instituto Nueva América de Suba.
                                        </div>

                                        {/* Insignia del Puesto */}
                                        <div className="pt-1">
                                            <span className={`inline-block px-5 py-1.5 rounded-full font-sans font-black text-xs uppercase tracking-wider bg-gradient-to-r ${badgeGradients[idx]} shadow-md border`}>
                                                {rankMedals[idx]}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Firmas Oficiales */}
                                    <div className="pt-10 grid grid-cols-2 gap-16 text-center font-sans text-xs font-bold border-t border-slate-300 relative z-10">
                                        <div>
                                            <div className="border-t-2 border-slate-900 w-52 mx-auto mb-1"></div>
                                            <p className="font-black text-slate-900 uppercase">RECTORA / DIRECCIÓN GENERAL</p>
                                            <p className="text-[10px] text-slate-500 font-normal">Instituto Nueva América de Suba</p>
                                        </div>
                                        <div>
                                            <div className="border-t-2 border-slate-900 w-52 mx-auto mb-1"></div>
                                            <p className="font-black text-slate-900 uppercase">COORDINACIÓN ACADÉMICA</p>
                                            <p className="text-[10px] text-slate-500 font-normal">Consejo Académico e Investigaciones</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Zona de Mantenimiento Seguro Protegida */}
            {selectedCourse && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500 mt-6">
                    <div className="flex items-center gap-2.5">
                        <ShieldAlert className="text-slate-400 shrink-0" size={18} />
                        <div>
                            <span className="font-bold text-slate-700 block text-xs">Mantenimiento de Curso — Grado {selectedCourse}</span>
                            <span className="text-[10.5px] text-slate-400 font-medium">Requiere palabra clave de confirmación obligatoria ("BORRAR") para prevenir eliminaciones accidentales.</span>
                        </div>
                    </div>
                    <button
                        onClick={handleResetCourseGrades}
                        disabled={resettingGrades}
                        className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl font-extrabold transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 text-[11px] shadow-xs"
                    >
                        {resettingGrades ? <Loader2 size={12} className="animate-spin" /> : "⚠️ Reiniciar Planilla de este Curso"}
                    </button>
                </div>
            )}
        </div>
    );
}
