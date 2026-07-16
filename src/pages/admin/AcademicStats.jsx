import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Loader2, TrendingUp, Award, Users, 
    BookOpen, AlertTriangle, Sparkles, BarChart2, CheckCircle2 
} from 'lucide-react';

export default function AcademicStats() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Filter state
    const [selectedCourse, setSelectedCourse] = useState("");
    const [coursesList, setCoursesList] = useState([]);

    // Raw datasets
    const [rawStudents, setRawStudents] = useState([]);
    const [rawGrades, setRawGrades] = useState([]);

    // Computed Stats for display (filtered or global)
    const [stats, setStats] = useState({
        globalAverage: 0,
        passingRate: 0,
        excellentRate: 0,
        studentsAtRiskCount: 0,
        totalStudents: 0
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

    // 1. Initial Data Fetch
    useEffect(() => {
        if (!currentUser) return;

        async function fetchAcademicData() {
            setLoading(true);
            try {
                let studentsData = [];
                let gradesData = [];

                const isDemo = currentUser.uid.startsWith('fake-');

                if (!isDemo) {
                    // Fetch real firestore collections
                    const sSnap = await getDocs(collection(db, 'students'));
                    const gSnap = await getDocs(collection(db, 'grades'));

                    studentsData = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    gradesData = gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }

                // Fallback to high-quality generated dataset if database is empty or isDemo
                if (studentsData.length === 0 || gradesData.length === 0) {
                    const courses = ['601', '602', '701', '702', '801', '802', '901', '902', '1001', '1002', '1101', '1102'];
                    const subjects = ['Matemáticas', 'Español', 'Inglés', 'C. Naturales (Biología)', 'Sociales', 'Física', 'Química'];
                    const firstNames = ['Juan', 'María', 'Carlos', 'Sofía', 'Andrés', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Felipe', 'Lucía', 'Diego', 'Paula', 'Nicolás', 'Gabriela', 'Alejandro'];
                    const lastNames = ['Pérez', 'García', 'López', 'Rodríguez', 'Gómez', 'Martínez', 'Sánchez', 'Díaz', 'Hernández', 'Álvarez', 'Torres', 'Ramírez', 'Ruiz', 'Castro', 'Morales', 'Suárez'];

                    // Generate ~80 students
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

                        // Generate random grades per student across subjects
                        subjects.forEach(subject => {
                            // Grade logic skewed to realistic averages
                            let baseGrade = 60 + Math.floor(Math.random() * 38); // 60 to 98
                            if (Math.random() < 0.1) baseGrade = 40 + Math.floor(Math.random() * 25); // Some lower grades

                            gradesData.push({
                                id: `g-mock-${sId}-${subject}`,
                                student_id: sId,
                                subject,
                                grade: baseGrade,
                                period: 1 + Math.floor(Math.random() * 3)
                            });
                        });
                    }
                }

                // Populate raw states
                setRawStudents(studentsData);
                setRawGrades(gradesData);

                // Populate courses list
                const coursesFound = [...new Set(studentsData.map(s => s.grade))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                setCoursesList(coursesFound);

            } catch (err) {
                console.error("Error computing analytics:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAcademicData();
    }, [currentUser]);

    const handleResetCourseGrades = async () => {
        if (!selectedCourse) return;
        const confirmReset = window.confirm(`⚠️ ATENCIÓN ⚠️\n\n¿Estás seguro de que deseas eliminar permanentemente TODAS las calificaciones de los estudiantes del Curso ${selectedCourse}?\n\nEsta acción borrará las notas de todas las asignaturas (incluyendo Español e Inglés iniciales de prueba) y te permitirá ingresar notas desde cero.`);
        if (!confirmReset) return;

        setResettingGrades(true);
        try {
            // 1. Obtener alumnos del curso seleccionado
            const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
            const sSnap = await getDocs(qStudents);
            const studentIds = sSnap.docs.map(doc => doc.id);

            if (studentIds.length === 0) {
                alert("No hay estudiantes registrados en este curso.");
                setResettingGrades(false);
                return;
            }

            // 2. Obtener y borrar calificaciones de estos estudiantes
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

            alert(`Se eliminaron con éxito ${deletedCount} calificaciones del Curso ${selectedCourse}. Ahora puedes digitar las notas desde cero.`);

            // Recargar datos locales
            const sSnapAll = await getDocs(collection(db, 'students'));
            const gSnapAll = await getDocs(collection(db, 'grades'));
            setRawStudents(sSnapAll.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setRawGrades(gSnapAll.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error("Error al restablecer calificaciones:", error);
            alert("Ocurrió un error al eliminar las calificaciones: " + error.message);
        } finally {
            setResettingGrades(false);
        }
    };

    // 2. Calculations Effect (runs on data load or when course filter changes)
    useEffect(() => {
        if (rawStudents.length === 0) return;

        // Map students to sum calculations
        const studentsMap = {};
        rawStudents.forEach(student => {
            studentsMap[student.id] = {
                ...student,
                gradesSum: 0,
                gradesCount: 0
            };
        });

        // Accumulate grades calculations
        const overallSubjectStats = {};
        const filteredSubjectStats = {};
        const courseStats = {};

        rawGrades.forEach(gradeDoc => {
            const studentId = gradeDoc.student_id;
            const gradeVal = Number(gradeDoc.grade);
            const subject = gradeDoc.subject;

            if (studentsMap[studentId]) {
                studentsMap[studentId].gradesSum += gradeVal;
                studentsMap[studentId].gradesCount += 1;
            }

            // Subject calculations (global reference)
            if (!overallSubjectStats[subject]) {
                overallSubjectStats[subject] = { sum: 0, count: 0 };
            }
            overallSubjectStats[subject].sum += gradeVal;
            overallSubjectStats[subject].count += 1;
        });

        // Compute student averages
        const analyzedStudents = Object.values(studentsMap).map(s => {
            const avg = s.gradesCount > 0 ? Number((s.gradesSum / s.gradesCount).toFixed(2)) : 0;
            return {
                ...s,
                average: avg
            };
        }).filter(s => s.gradesCount > 0);

        // Course comparative averages (always computed over all students to render the full comparative course chart)
        analyzedStudents.forEach(s => {
            const gradeName = s.grade;
            if (!courseStats[gradeName]) {
                courseStats[gradeName] = { sum: 0, count: 0 };
            }
            courseStats[gradeName].sum += s.average;
            courseStats[gradeName].count += 1;
        });

        const coursesArray = Object.entries(courseStats).map(([grade, stats]) => ({
            grade,
            average: Number((stats.sum / stats.count).toFixed(2)),
            studentCount: stats.count
        })).sort((a, b) => a.grade.localeCompare(b, undefined, { numeric: true }));

        setCourseAverages(coursesArray);

        // Filter students by selected course for specific panel reports
        const finalStudentsToAnalyze = selectedCourse 
            ? analyzedStudents.filter(s => s.grade === selectedCourse) 
            : analyzedStudents;

        const finalStudentIds = new Set(finalStudentsToAnalyze.map(s => s.id));

        // Compute filtered subject averages
        rawGrades.forEach(gradeDoc => {
            if (finalStudentIds.has(gradeDoc.student_id)) {
                const gradeVal = Number(gradeDoc.grade);
                const subject = gradeDoc.subject;
                if (!filteredSubjectStats[subject]) {
                    filteredSubjectStats[subject] = { sum: 0, count: 0 };
                }
                filteredSubjectStats[subject].sum += gradeVal;
                filteredSubjectStats[subject].count += 1;
            }
        });

        const subjectsArray = Object.entries(
            selectedCourse ? filteredSubjectStats : overallSubjectStats
        ).map(([subject, stats]) => ({
            subject,
            average: Number((stats.sum / stats.count).toFixed(2))
        })).sort((a, b) => b.average - a.average);

        setSubjectAverages(subjectsArray);

        // Calculate specific stats variables for current scope (filtered or global)
        const totalStudents = finalStudentsToAnalyze.length;
        let globalSum = 0;
        let passingCount = 0;
        let excellentCount = 0;
        let riskCount = 0;

        const distribution = { superior: 0, alto: 0, basico: 0, bajo: 0 };
        const riskList = [];

        finalStudentsToAnalyze.forEach(s => {
            globalSum += s.average;
            if (s.average >= 75) passingCount++;
            if (s.average >= 95) excellentCount++;
            if (s.average < 75) {
                riskCount++;
                riskList.push(s);
            }

            // Distribution logic
            if (s.average >= 95) distribution.superior++;
            else if (s.average >= 80) distribution.alto++;
            else if (s.average >= 75) distribution.basico++;
            else distribution.bajo++;
        });

        const globalAverage = totalStudents > 0 ? Number((globalSum / totalStudents).toFixed(2)) : 0;
        const passingRate = totalStudents > 0 ? Number(((passingCount / totalStudents) * 100).toFixed(1)) : 0;
        const excellentRate = totalStudents > 0 ? Number(((excellentCount / totalStudents) * 100).toFixed(1)) : 0;

        const sortedStudents = [...finalStudentsToAnalyze].sort((a, b) => b.average - a.average);
        const honorRoll = sortedStudents.slice(0, 5);

        // Update states
        setStats({
            globalAverage,
            passingRate,
            excellentRate,
            studentsAtRiskCount: riskCount,
            totalStudents
        });
        setPerformanceDistribution(distribution);
        setTopStudents(honorRoll);
        setStudentsAtRiskList(riskList.sort((a, b) => a.average - b.average).slice(0, 10));

    }, [rawStudents, rawGrades, selectedCourse]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col justify-center items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
                <p className="text-sm text-gray-500 font-semibold">Generando reportes estadísticos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-650 hover:underline mb-2 tracking-wide uppercase"
                    >
                        <ArrowLeft size={14} /> Volver al Tablero
                    </button>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                        <BarChart2 className="text-indigo-650" size={28} /> Estadísticas y Análisis Académico
                    </h1>
                    <p className="text-xs text-gray-400 font-bold tracking-wide mt-1 uppercase">Institución Educativa Nueva América de Suba (INAS)</p>
                </div>
            </div>

            {/* Filter pills */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Seleccionar Curso de Análisis</label>
                    {selectedCourse && (
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-lg uppercase">
                            Analizando Curso {selectedCourse}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCourse("")}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs border shadow-sm transition active-press ${
                            selectedCourse === ""
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white hover:bg-slate-50 border-slate-100 text-slate-600"
                        }`}
                    >
                        Todos los Cursos
                    </button>
                    {coursesList.map(course => (
                        <button
                            key={course}
                            onClick={() => setSelectedCourse(course)}
                            className={`px-3.5 py-2 rounded-xl font-bold text-xs border shadow-sm transition active-press ${
                                selectedCourse === course
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "bg-white hover:bg-slate-50 border-slate-100 text-slate-600"
                            }`}
                        >
                            Curso {course}
                        </button>
                    ))}
                </div>
                {selectedCourse && (
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
                        <p className="text-[11px] text-gray-400 font-semibold leading-normal">
                            ¿Las calificaciones del Curso {selectedCourse} contienen notas ficticias del cargador inicial? Puedes limpiarlas para empezar desde cero con tus notas reales.
                        </p>
                        <button
                            onClick={handleResetCourseGrades}
                            disabled={resettingGrades}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100/50 rounded-xl font-bold text-xs transition active-press flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                            {resettingGrades ? (
                                <><Loader2 size={12} className="animate-spin" /> Limpiando...</>
                            ) : (
                                "Limpiar Notas de Prueba"
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Metrics cards row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Promedio General */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover-elevate">
                    <div className="w-11 h-11 bg-indigo-50 text-indigo-650 rounded-xl flex items-center justify-center shrink-0">
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Promedio {selectedCourse ? 'del Curso' : 'General'}</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{stats.globalAverage} <span className="text-xs text-gray-400 font-normal">/100</span></p>
                    </div>
                </div>

                {/* Tasa de Aprobación */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover-elevate">
                    <div className="w-11 h-11 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tasa de Aprobación</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{stats.passingRate}%</p>
                    </div>
                </div>

                {/* Alumnos Excelente */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover-elevate">
                    <div className="w-11 h-11 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                        <Award size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Desempeño Excelente</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{stats.excellentRate}%</p>
                    </div>
                </div>

                {/* Alumnos en Riesgo */}
                <div className={`border rounded-2xl p-5 shadow-sm flex items-center gap-4 hover-elevate transition ${
                    stats.studentsAtRiskCount > 0 
                        ? 'bg-rose-50/20 border-rose-100/50' 
                        : 'bg-white border-slate-100'
                }`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        stats.studentsAtRiskCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-gray-50 text-gray-400'
                    }`}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Alumnos en Riesgo</p>
                        <p className={`text-2xl font-extrabold mt-0.5 ${stats.studentsAtRiskCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {stats.studentsAtRiskCount} <span className="text-xs text-gray-400 font-normal">estudiantes</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Graphs Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Comparativo de Cursos (Bar Chart SVG) */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Users className="text-indigo-650" size={18} /> Rendimiento Comparado por Cursos
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">Comparación de calificaciones promedio finales entre grados. {selectedCourse && 'Tu curso seleccionado está resaltado.'}</p>
                    </div>

                    {/* SVG Chart Wrapper */}
                    <div className="relative w-full h-72 border border-slate-100 rounded-xl bg-slate-50/30 p-4">
                        {courseAverages.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Sin datos de grados registrados.</div>
                        ) : (
                            <div className="w-full h-full flex flex-col justify-between">
                                {/* Grid Lines & Bars */}
                                <div className="relative flex-1 flex items-end gap-1.5 sm:gap-3.5 pt-6 pb-2 px-2 overflow-x-auto min-w-0 scrollbar-none">
                                    {/* Horizontal Guidelines */}
                                    <div className="absolute inset-x-0 top-1/4 border-t border-slate-100/80 pointer-events-none"></div>
                                    <div className="absolute inset-x-0 top-2/4 border-t border-slate-100/80 pointer-events-none"></div>
                                    <div className="absolute inset-x-0 top-3/4 border-t border-slate-100/80 pointer-events-none"></div>
                                    
                                    {courseAverages.map(course => {
                                        // Calculate percentage height
                                        const pct = (course.average / 100) * 100;
                                        // Color logic
                                        const isPassing = course.average >= 75;
                                        const barColor = isPassing ? 'bg-indigo-600' : 'bg-rose-500';
                                        
                                        // Highlighting selected course logic
                                        const isSelected = selectedCourse === course.grade;
                                        const isActiveBar = selectedCourse === "" || isSelected;

                                        return (
                                            <div 
                                                key={course.grade} 
                                                onClick={() => setSelectedCourse(course.grade === selectedCourse ? "" : course.grade)}
                                                className="flex-1 min-w-[36px] flex flex-col items-center h-full justify-end group relative cursor-pointer"
                                            >
                                                {/* Tooltip on hover */}
                                                <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 pointer-events-none transition duration-150 transform -translate-y-1 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap font-bold text-center">
                                                    Prom: {course.average}<br/>
                                                    {course.studentCount} Alum.
                                                </div>

                                                {/* Numerical Average Value indicator */}
                                                <span className={`text-[10px] font-bold mb-1 transition-colors ${
                                                    isSelected ? 'text-indigo-600 scale-110' : 'text-gray-500 group-hover:text-indigo-650'
                                                }`}>
                                                    {course.average.toFixed(0)}
                                                </span>
                                                
                                                {/* Bar element */}
                                                <div 
                                                    style={{ height: `${pct * 0.75}%` }} 
                                                    className={`w-full rounded-t-md transition-all duration-350 group-hover:scale-x-[1.03] group-hover:brightness-105 ${barColor} shadow-inner-soft ${
                                                        isActiveBar ? 'opacity-100' : 'opacity-30'
                                                    } ${isSelected ? 'ring-2 ring-indigo-600 ring-offset-2' : ''}`}
                                                ></div>

                                                {/* Label */}
                                                <span className={`text-[10px] tracking-wide mt-2 block ${
                                                    isSelected ? 'font-extrabold text-indigo-600' : 'font-semibold text-gray-400'
                                                }`}>{course.grade}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Distribución de Desempeños y Podio Honor */}
                <div className="space-y-6">
                    {/* Honor Roll */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Award className="text-amber-500" size={18} /> {selectedCourse ? `Cuadro de Honor - Curso ${selectedCourse}` : 'Podio de Excelencia Académica'}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Top 5 estudiantes con mejor promedio {selectedCourse ? 'de este curso' : 'del plantel'}.</p>
                        </div>

                        <div className="space-y-3.5">
                            {topStudents.length === 0 ? (
                                <div className="text-center py-6 text-xs text-gray-400">Sin datos de estudiantes.</div>
                            ) : (
                                topStudents.map((student, idx) => {
                                    const medals = [
                                        { icon: '🥇', bg: 'bg-amber-50 border-amber-100 text-amber-600' },
                                        { icon: '🥈', bg: 'bg-slate-50 border-slate-100 text-slate-500' },
                                        { icon: '🥉', bg: 'bg-orange-50 border-orange-100 text-orange-600' }
                                    ];
                                    const style = medals[idx] || { icon: `${idx + 1}.`, bg: 'bg-gray-50/50 border-gray-100/50 text-gray-500' };

                                    return (
                                        <div key={student.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100/50 hover:bg-slate-50/50 transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-7 h-7 rounded-lg border font-bold text-xs flex items-center justify-center shrink-0 ${style.bg}`}>
                                                    {style.icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{student.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Curso {student.grade}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-extrabold text-indigo-655 bg-indigo-50/70 border border-indigo-100/50 px-2 py-0.5 rounded-lg shrink-0">
                                                {student.average}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Level Distribution & Subject performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Distribución de Desempeños por Rangos */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Sparkles className="text-indigo-650" size={18} /> Rango de Desempeños {selectedCourse && `- Curso ${selectedCourse}`}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">Distribución de estudiantes del {selectedCourse ? 'curso' : 'plantel'} por escala nacional.</p>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div className="space-y-4">
                        {(() => {
                            const total = stats.totalStudents || 1;
                            const supPct = ((performanceDistribution.superior / total) * 100).toFixed(0);
                            const altoPct = ((performanceDistribution.alto / total) * 100).toFixed(0);
                            const basPct = ((performanceDistribution.basico / total) * 100).toFixed(0);
                            const bajPct = ((performanceDistribution.bajo / total) * 100).toFixed(0);

                            return (
                                <>
                                    {/* Visual Bar */}
                                    <div className="w-full h-4 rounded-full overflow-hidden flex shadow-inner">
                                        <div style={{ width: `${supPct}%` }} className="bg-emerald-500 h-full hover:opacity-90 transition-opacity" title={`Superior: ${supPct}%`}></div>
                                        <div style={{ width: `${altoPct}%` }} className="bg-indigo-600 h-full hover:opacity-90 transition-opacity" title={`Alto: ${altoPct}%`}></div>
                                        <div style={{ width: `${basPct}%` }} className="bg-amber-500 h-full hover:opacity-90 transition-opacity" title={`Básico: ${basPct}%`}></div>
                                        <div style={{ width: `${bajPct}%` }} className="bg-rose-500 h-full hover:opacity-90 transition-opacity" title={`Bajo: ${bajPct}%`}></div>
                                    </div>

                                    {/* Description list */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] leading-tight font-semibold">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></span>
                                            <span>Superior ({supPct}%): <strong>{performanceDistribution.superior}</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full shrink-0"></span>
                                            <span>Alto ({altoPct}%): <strong>{performanceDistribution.alto}</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full shrink-0"></span>
                                            <span>Básico ({basPct}%): <strong>{performanceDistribution.basico}</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0"></span>
                                            <span>Bajo ({bajPct}%): <strong>{performanceDistribution.bajo}</strong></span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Rendimiento por Asignatura (Horizontal Bar Comparison) */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <BookOpen className="text-indigo-650" size={18} /> Promedio por Asignatura {selectedCourse && `- Curso ${selectedCourse}`}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">Identificación de materias críticas en el {selectedCourse ? 'curso' : 'colegio'}.</p>
                    </div>

                    <div className="space-y-3 pt-1">
                        {subjectAverages.length === 0 ? (
                            <div className="text-center py-8 text-xs text-gray-400">Sin datos de materias.</div>
                        ) : (
                            subjectAverages.map(subject => {
                                const isPassing = subject.average >= 75;
                                const barColor = isPassing ? 'bg-indigo-600' : 'bg-rose-500';
                                
                                return (
                                    <div key={subject.subject} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-700 truncate">{subject.subject}</span>
                                            <span className={isPassing ? 'text-indigo-600' : 'text-rose-600'}>{subject.average.toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">/100</span></span>
                                        </div>
                                        
                                        {/* Progress track bar */}
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                style={{ width: `${subject.average}%` }} 
                                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Risk Management / Alert List */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                    <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                        <AlertTriangle size={20} /> Alerta Académica: Estudiantes con Rendimiento Crítico {selectedCourse && `- Curso ${selectedCourse}`}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Alumnos con promedio inferior a la nota aprobatoria (75/100) en el {selectedCourse ? 'curso' : 'plantel'}.</p>
                </div>

                {studentsAtRiskList.length === 0 ? (
                    <div className="text-center py-8 bg-green-50/20 border border-green-100/50 rounded-xl text-green-700 text-xs font-semibold">
                        🎉 ¡Excelente! No se registran alumnos con promedio inferior a 75 en {selectedCourse ? `el Curso ${selectedCourse}` : 'la institución'}.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                    <th className="p-3.5 pl-5">Código</th>
                                    <th className="p-3.5">Estudiante</th>
                                    <th className="p-3.5">Curso</th>
                                    <th className="p-3.5 text-right pr-5">Promedio Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {studentsAtRiskList.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50/40 transition">
                                        <td className="p-3.5 pl-5 font-mono text-gray-500">{student.id_code}</td>
                                        <td className="p-3.5 font-bold text-slate-800">{student.name}</td>
                                        <td className="p-3.5 font-bold text-slate-600 uppercase">Grado {student.grade}</td>
                                        <td className="p-3.5 text-right pr-5">
                                            <span className="font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                                                {student.average}
                                            </span>
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
