import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, Loader2, TrendingUp, Award, Users, 
    BookOpen, AlertTriangle, Sparkles, BarChart2, CheckCircle2, Printer,
    Filter, Calendar, ShieldAlert, Target, GraduationCap, Flame, Star, ChevronRight
} from 'lucide-react';

export default function AcademicStats() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Filtros
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState("ALL");
    const [coursesList, setCoursesList] = useState([]);

    // Datasets
    const [rawStudents, setRawStudents] = useState([]);
    const [rawGrades, setRawGrades] = useState([]);

    // Estadísticas Calculadas
    const [stats, setStats] = useState({
        globalAverage: 0,
        passingRate: 0,
        excellentRate: 0,
        studentsAtRiskCount: 0,
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
    const [topStudents, setTopStudents] = useState([]);
    const [studentsAtRiskList, setStudentsAtRiskList] = useState([]);

    // 1. Carga inicial de datos desde Firestore
    useEffect(() => {
        if (!currentUser) return;

        async function fetchAcademicData() {
            setLoading(true);
            try {
                let studentsData = [];
                let gradesData = [];

                const isDemo = currentUser.uid.startsWith('fake-');

                if (!isDemo) {
                    const sSnap = await getDocs(collection(db, 'students'));
                    const gSnap = await getDocs(collection(db, 'grades'));

                    studentsData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    gradesData = gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }

                // Generar datos simulados de respaldo si la base de datos está vacía
                if (studentsData.length === 0 || gradesData.length === 0) {
                    const courses = ['601', '602', '701', '702', '801', '802', '901', '902', '1001', '1002', '1101', '1102'];
                    const subjects = ['Matemáticas', 'Español y Literatura', 'Inglés', 'C. Naturales (Biología)', 'C Sociales Filosofía', 'C. Naturales (Física)', 'C Naturales (Química)', 'Ed Ética y Valores', 'Ed Física', 'Tecnología e Informática', 'Artes plásticas'];
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
                            let baseGrade = 65 + Math.floor(Math.random() * 33); // 65 a 98
                            if (Math.random() < 0.12) baseGrade = 45 + Math.floor(Math.random() * 25); // algunas notas bajas

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
        const confirmReset = window.confirm(`⚠️ ATENCIÓN ⚠️\n\n¿Estás seguro de que deseas eliminar permanentemente TODAS las calificaciones del Curso ${selectedCourse}?\n\nEsta acción borrará las notas para iniciar registros limpios.`);
        if (!confirmReset) return;

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

    // 2. Efecto de cálculos estadísticos dinámicos
    useEffect(() => {
        if (rawStudents.length === 0) return;

        // Filtrar notas por periodo si aplica
        let activeGrades = rawGrades;
        if (selectedPeriod !== "ALL") {
            activeGrades = rawGrades.filter(g => String(g.period) === String(selectedPeriod));
        }

        // Mapear estudiantes a objeto de cálculos
        const studentsMap = {};
        rawStudents.forEach(student => {
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
                if (subjAvg < 75) {
                    failedCount++;
                }
            });

            return {
                ...s,
                average: avg,
                failedSubjectsCount: failedCount
            };
        }).filter(s => s.gradesCount > 0);

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
            ? analyzedStudents.filter(s => s.grade === selectedCourse) 
            : analyzedStudents;

        const finalStudentIds = new Set(finalStudentsToAnalyze.map(s => s.id));

        // Asignaturas filtradas
        activeGrades.forEach(gradeDoc => {
            if (finalStudentIds.has(gradeDoc.student_id)) {
                const gradeVal = Number(gradeDoc.grade);
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

        // Indicadores consolidados
        const totalStudents = finalStudentsToAnalyze.length;
        let globalSum = 0;
        let passingCount = 0;
        let excellentCount = 0;
        let riskCount = 0;

        const distribution = { superior: 0, alto: 0, basico: 0, bajo: 0 };
        const riskList = [];

        finalStudentsToAnalyze.forEach(s => {
            globalSum += s.average;
            if (s.average >= 75 && s.failedSubjectsCount === 0) passingCount++;
            if (s.average >= 95) excellentCount++;
            if (s.average < 75 || s.failedSubjectsCount > 0) {
                riskCount++;
                riskList.push(s);
            }

            if (s.average >= 95) distribution.superior++;
            else if (s.average >= 80) distribution.alto++;
            else if (s.average >= 75) distribution.basico++;
            else distribution.bajo++;
        });

        const globalAverage = totalStudents > 0 ? Number((globalSum / totalStudents).toFixed(1)) : 0;
        const passingRate = totalStudents > 0 ? Number(((passingCount / totalStudents) * 100).toFixed(1)) : 0;
        const excellentRate = totalStudents > 0 ? Number(((excellentCount / totalStudents) * 100).toFixed(1)) : 0;

        const sortedStudents = [...finalStudentsToAnalyze].sort((a, b) => b.average - a.average);
        const honorRoll = sortedStudents.slice(0, 10);

        setStats({
            globalAverage,
            passingRate,
            excellentRate,
            studentsAtRiskCount: riskCount,
            totalStudents,
            totalGradesRegistered: activeGrades.length,
            totalSubjects: subjectsArray.length
        });

        setPerformanceDistribution(distribution);
        setTopStudents(honorRoll);
        setStudentsAtRiskList(riskList.sort((a, b) => b.failedSubjectsCount - a.failedSubjectsCount || a.average - b.average));

    }, [rawStudents, rawGrades, selectedCourse, selectedPeriod]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col justify-center items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={36} />
                <p className="text-sm text-slate-500 font-bold tracking-wide">Compilando estadísticas generales del plantel...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-16 select-none">
            {/* Header Principal */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 space-y-1">
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-300 hover:text-white transition tracking-wider uppercase mb-2"
                    >
                        <ArrowLeft size={14} /> Regresar al Tablero
                    </button>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
                        <BarChart2 className="text-indigo-400" size={32} /> Estadísticas y Análisis Académico Institucional
                    </h1>
                    <p className="text-xs text-indigo-200 font-medium max-w-xl">
                        Tablero analítico con métricas completas de rendimiento, ranking de mejor a peor resultado y materias reprobadas INAS 2026.
                    </p>
                </div>

                <div className="relative z-10 flex flex-wrap gap-3">
                    <Link
                        to="/admin/consolidado-print"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-2xl transition text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0 border border-indigo-400/30 active-press"
                    >
                        <Printer size={16} /> Ver Consolidado e Imprimir PDF
                    </Link>
                </div>
            </div>

            {/* Barra de Filtros Interactivos (Curso y Periodo) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <Filter className="text-indigo-600" size={18} />
                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Filtros de Análisis Académico</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Evaluados: <strong className="text-slate-900">{stats.totalStudents} Estudiantes</strong></span>
                        <span>•</span>
                        <span>Calificaciones: <strong className="text-indigo-600">{stats.totalGradesRegistered} notas</strong></span>
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
                                🎓 Todos
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

                {selectedCourse && (
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500 font-semibold">
                            ¿Necesitas limpiar las notas de prueba del <strong>Curso {selectedCourse}</strong>?
                        </span>
                        <button
                            onClick={handleResetCourseGrades}
                            disabled={resettingGrades}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                            {resettingGrades ? <Loader2 size={12} className="animate-spin" /> : "Limpiar Notas de Prueba"}
                        </button>
                    </div>
                )}
            </div>

            {/* Tarjetas KPI de Métricas Académicas Clave */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Promedio General */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl"></div>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Promedio General</span>
                        <div className="p-2 bg-indigo-500/20 rounded-2xl text-indigo-300">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black">{stats.globalAverage} <span className="text-xs text-indigo-300 font-medium">/ 100 pts</span></div>
                        <p className="text-[10px] text-indigo-200 mt-1 font-medium">
                            {selectedCourse ? `Grado ${selectedCourse}` : 'Promedio global del plantel'}
                        </p>
                    </div>
                </div>

                {/* 2. Tasa de Aprobación */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tasa de Aprobación</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900">{stats.passingRate}%</div>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                            <div style={{ width: `${stats.passingRate}%` }} className="bg-emerald-500 h-full rounded-full transition-all duration-500"></div>
                        </div>
                    </div>
                </div>

                {/* 3. Cuadro de Excelencia */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excelente (Superior &ge;95)</span>
                        <div className="p-2 bg-amber-50 text-amber-500 rounded-2xl">
                            <Star size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900">{stats.excellentRate}%</div>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                            {performanceDistribution.superior} estudiantes en nivel Superior
                        </p>
                    </div>
                </div>

                {/* 4. Estudiantes en Riesgo */}
                <div className={`border rounded-3xl p-6 shadow-sm flex flex-col justify-between transition ${
                    stats.studentsAtRiskCount > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200/80'
                }`}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Alumnos en Riesgo</span>
                        <div className={`p-2 rounded-2xl ${stats.studentsAtRiskCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                            <AlertTriangle size={20} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className={`text-3xl font-black ${stats.studentsAtRiskCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {stats.studentsAtRiskCount} <span className="text-xs font-bold text-slate-400">alumnos</span>
                        </div>
                        <p className="text-[10px] text-rose-500 font-bold mt-1">
                            {stats.studentsAtRiskCount > 0 ? 'Tienen 1 o más materias perdidas (<75)' : 'Sin alertas de reprobación'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Layout Principal de Gráficos e Indicadores */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. Gráfico Comparativo por Cursos */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-2 border-b pb-4 border-slate-100">
                        <div>
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <GraduationCap className="text-indigo-600" size={20} /> Comparativo de Rendimiento por Cursos
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Promedio general por grado. Haz clic en una barra para filtrar las estadísticas.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full inline-block"></span> Aprobado (&ge;75)
                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block ml-2"></span> Reprobado (&lt;75)
                        </div>
                    </div>

                    {/* Gráfico de Barras Dinámico con Gradiente e Interacción */}
                    <div className="relative w-full h-80 border border-slate-100 rounded-2xl bg-slate-50/50 p-4 pt-8">
                        {courseAverages.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                                No hay datos de grados para mostrar.
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col justify-between relative">
                                {/* Línea de Meta Institucional (75 pts) */}
                                <div className="absolute inset-x-0 top-[25%] border-t-2 border-dashed border-emerald-500/50 pointer-events-none z-10 flex justify-end pr-2">
                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                        Meta Aprobatoria: 75 pts
                                    </span>
                                </div>

                                <div className="relative flex-1 flex items-end gap-2 sm:gap-4 pt-4 pb-2 px-2 overflow-x-auto scrollbar-none">
                                    {courseAverages.map(cObj => {
                                        const pct = Math.min(100, Math.max(0, cObj.average));
                                        const isPassing = cObj.average >= 75;
                                        const isSelected = selectedCourse === cObj.grade;
                                        const isActive = selectedCourse === "" || isSelected;

                                        return (
                                            <div 
                                                key={cObj.grade}
                                                onClick={() => setSelectedCourse(selectedCourse === cObj.grade ? "" : cObj.grade)}
                                                className="flex-1 min-w-[42px] flex flex-col items-center h-full justify-end group relative cursor-pointer"
                                            >
                                                {/* Tooltip Dinámico */}
                                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition duration-200 transform -translate-y-1 bg-slate-900 text-white text-[10px] p-2 rounded-xl shadow-xl z-30 whitespace-nowrap font-bold text-center">
                                                    <div>Grado {cObj.grade}</div>
                                                    <div className="text-indigo-300">Prom: {cObj.average} pts</div>
                                                    <div className="text-slate-400 font-medium">{cObj.studentCount} estudiantes</div>
                                                </div>

                                                {/* Valor sobre la barra */}
                                                <span className={`text-[10px] font-black mb-1 transition-transform ${
                                                    isSelected ? 'text-indigo-600 scale-125' : 'text-slate-600 group-hover:text-indigo-600'
                                                }`}>
                                                    {cObj.average}
                                                </span>

                                                {/* Elemento de la Barra */}
                                                <div 
                                                    style={{ height: `${pct * 0.72}%` }}
                                                    className={`w-full rounded-t-xl transition-all duration-300 ${
                                                        isPassing 
                                                            ? 'bg-gradient-to-t from-indigo-700 to-indigo-500' 
                                                            : 'bg-gradient-to-t from-rose-600 to-rose-400'
                                                    } ${isActive ? 'opacity-100' : 'opacity-30'} ${
                                                        isSelected ? 'ring-4 ring-indigo-600/30 scale-x-105' : 'hover:brightness-110'
                                                    }`}
                                                ></div>

                                                {/* Etiqueta del Curso */}
                                                <span className={`text-[10px] mt-2 block font-extrabold ${
                                                    isSelected ? 'text-indigo-600' : 'text-slate-500'
                                                }`}>
                                                    {cObj.grade}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Distribución de Nivel de Desempeño (MEN) */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
                    <div>
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Target className="text-indigo-600" size={20} /> Escala de Desempeño Escolar
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Distribución de estudiantes {selectedCourse ? `del Curso ${selectedCourse}` : 'del colegio'} por nivel.
                        </p>
                    </div>

                    {/* Barra de Distribución Porcentual Apilada */}
                    <div className="space-y-4">
                        {(() => {
                            const total = stats.totalStudents || 1;
                            const supPct = ((performanceDistribution.superior / total) * 100).toFixed(0);
                            const altoPct = ((performanceDistribution.alto / total) * 100).toFixed(0);
                            const basPct = ((performanceDistribution.basico / total) * 100).toFixed(0);
                            const bajPct = ((performanceDistribution.bajo / total) * 100).toFixed(0);

                            return (
                                <>
                                    <div className="w-full h-5 rounded-full overflow-hidden flex shadow-inner p-0.5 bg-slate-100">
                                        <div style={{ width: `${supPct}%` }} className="bg-emerald-500 h-full rounded-l-full transition-all" title={`Superior: ${supPct}%`}></div>
                                        <div style={{ width: `${altoPct}%` }} className="bg-indigo-600 h-full transition-all" title={`Alto: ${altoPct}%`}></div>
                                        <div style={{ width: `${basPct}%` }} className="bg-amber-500 h-full transition-all" title={`Básico: ${basPct}%`}></div>
                                        <div style={{ width: `${bajPct}%` }} className="bg-rose-500 h-full rounded-r-full transition-all" title={`Bajo: ${bajPct}%`}></div>
                                    </div>

                                    {/* Leyenda de Niveles */}
                                    <div className="space-y-2.5 pt-2 text-xs font-bold">
                                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                            <span className="flex items-center gap-2 text-emerald-800">
                                                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Superior (95-100)
                                            </span>
                                            <span className="text-slate-900 font-black">{performanceDistribution.superior} <span className="text-[10px] text-slate-400 font-medium">({supPct}%)</span></span>
                                        </div>

                                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                            <span className="flex items-center gap-2 text-indigo-800">
                                                <span className="w-3 h-3 bg-indigo-600 rounded-full"></span> Alto (80-94)
                                            </span>
                                            <span className="text-slate-900 font-black">{performanceDistribution.alto} <span className="text-[10px] text-slate-400 font-medium">({altoPct}%)</span></span>
                                        </div>

                                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                            <span className="flex items-center gap-2 text-amber-800">
                                                <span className="w-3 h-3 bg-amber-500 rounded-full"></span> Básico (75-79)
                                            </span>
                                            <span className="text-slate-900 font-black">{performanceDistribution.basico} <span className="text-[10px] text-slate-400 font-medium">({basPct}%)</span></span>
                                        </div>

                                        <div className="flex justify-between items-center bg-rose-50/50 border border-rose-100 p-2 rounded-xl">
                                            <span className="flex items-center gap-2 text-rose-700">
                                                <span className="w-3 h-3 bg-rose-500 rounded-full"></span> Bajo (&lt;75)
                                            </span>
                                            <span className="text-rose-700 font-black">{performanceDistribution.bajo} <span className="text-[10px] text-slate-400 font-medium">({bajPct}%)</span></span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Layout Secundario: Asignaturas Críticas + Podio Honor */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Rendimiento por Asignatura (Dificultad Académica) */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-start sm:items-center border-b pb-4 border-slate-100">
                        <div>
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <BookOpen className="text-indigo-600" size={20} /> Desempeño por Asignatura {selectedCourse && `- Curso ${selectedCourse}`}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Promedio acumulado por materia. Permite identificar las materias más críticas.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3.5">
                        {subjectAverages.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 font-bold">No hay asignaturas registradas.</div>
                        ) : (
                            subjectAverages.map(subj => {
                                const isPassing = subj.average >= 75;
                                const barColor = isPassing ? 'bg-indigo-600' : 'bg-rose-500';

                                return (
                                    <div key={subj.subject} className="space-y-1 bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span className="text-slate-800 font-bold truncate max-w-[200px] sm:max-w-xs">{subj.subject}</span>
                                            <div className="flex items-center gap-2">
                                                {subj.lowCount > 0 && (
                                                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                                        ⚠️ {subj.lowCount} perdidas
                                                    </span>
                                                )}
                                                <span className={`font-black text-xs ${isPassing ? 'text-indigo-650' : 'text-rose-600'}`}>
                                                    {subj.average} <span className="text-[9px] text-slate-400 font-normal">/100</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Progresión */}
                                        <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                                            <div 
                                                style={{ width: `${subj.average}%` }}
                                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Cuadro de Honor / Top 10 Estudiantes */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
                    <div>
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Award className="text-amber-500" size={20} /> Cuadro de Honor {selectedCourse ? `- Grado ${selectedCourse}` : 'Institucional'}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Los 10 mejores promedios generales.
                        </p>
                    </div>

                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                        {topStudents.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 font-bold">Sin registros disponibles.</div>
                        ) : (
                            topStudents.map((st, idx) => {
                                const rank = idx + 1;
                                const isTop3 = rank <= 3;

                                return (
                                    <div 
                                        key={st.id} 
                                        className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                                            isTop3 
                                                ? 'bg-amber-50/50 border-amber-200/80' 
                                                : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                rank === 1 ? 'bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30' :
                                                rank === 2 ? 'bg-slate-300 text-slate-900' :
                                                rank === 3 ? 'bg-amber-700 text-amber-50' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-900 truncate">{st.name}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Grado {st.grade}</p>
                                            </div>
                                        </div>

                                        <span className="text-xs font-black text-indigo-900 bg-white border border-indigo-100 px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                                            {st.average}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Módulo de Alerta Académica: Estudiantes con Materias Pérdidas */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4 border-slate-100">
                    <div>
                        <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
                            <ShieldAlert size={22} /> Alerta Académica: Alumnos con Asignaturas Reprobadas {selectedCourse && `- Curso ${selectedCourse}`}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Listado prioritario para coordinadores y directores de grupo de estudiantes en riesgo académico.
                        </p>
                    </div>

                    <Link 
                        to="/admin/consolidado-print"
                        className="text-xs font-extrabold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100"
                    >
                        Ver Consolidado Completo <ChevronRight size={14} />
                    </Link>
                </div>

                {studentsAtRiskList.length === 0 ? (
                    <div className="text-center py-10 bg-emerald-50/40 border border-emerald-200/60 rounded-2xl text-emerald-800 text-xs font-extrabold">
                        🎉 ¡Excelente! No se registran alumnos con materias reprobadas en {selectedCourse ? `el Curso ${selectedCourse}` : 'el colegio'}.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                                    <th className="p-3.5 pl-5">Código</th>
                                    <th className="p-3.5">Estudiante</th>
                                    <th className="p-3.5">Curso</th>
                                    <th className="p-3.5 text-center">Materias Pérdidas (&lt;75)</th>
                                    <th className="p-3.5 text-right pr-5">Promedio General</th>
                                    <th className="p-3.5 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {studentsAtRiskList.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50/60 transition">
                                        <td className="p-3.5 pl-5 font-mono text-slate-500 font-semibold">{student.id_code}</td>
                                        <td className="p-3.5 font-bold text-slate-900">{student.name}</td>
                                        <td className="p-3.5 font-bold text-slate-700 uppercase">Grado {student.grade}</td>
                                        <td className="p-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 font-black text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full text-xs">
                                                ⚠️ {student.failedSubjectsCount} materia(s)
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-right pr-5">
                                            <span className={`font-black text-xs px-2.5 py-1 rounded-xl ${
                                                student.average < 75 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-900'
                                            }`}>
                                                {student.average}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <Link 
                                                to={`/admin/boletin-print/${student.id}`}
                                                className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1"
                                            >
                                                <BookOpen size={12} /> Ver Boletín
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
