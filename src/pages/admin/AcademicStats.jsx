import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, Loader2, TrendingUp, Award, Users, 
    BookOpen, AlertTriangle, Sparkles, BarChart2, CheckCircle2, Printer,
    Filter, Calendar, ShieldAlert, Target, GraduationCap, Flame, Star, ChevronRight,
    Medal, Crown, AlertCircle, FileText, Search, Trophy, Compass, Check, Download, Info, X, Clock
} from 'lucide-react';
import { getStudentPhoto, DEFAULT_STUDENT_PHOTO } from '../../lib/avatarHelper';

const SUBJECT_SHORT = {
    'Matemáticas': 'Mat',
    'Geometría': 'Geo',
    'Español y Literatura': 'Esp',
    'Inglés': 'Ing',
    'C. Naturales (Biología)': 'Bio',
    'C. Naturales (Física)': 'Fís',
    'C Naturales (Química)': 'Quím',
    'C Sociales Filosofía': 'Soc',
    'C Políticas Económicas': 'Pol',
    'Filosofía': 'Fil',
    'Ed Ética y Valores': 'Ética',
    'Ed Religiosa y Moral': 'Rel',
    'Ed Física': 'Ed.Fís',
    'Artes plásticas': 'Arte',
    'Tecnología e Informática': 'Tec'
};

const getSubjectShort = (name) => {
    if (!name) return '';
    if (SUBJECT_SHORT[name]) return SUBJECT_SHORT[name];
    const clean = name.trim();
    const lower = clean.toLowerCase();
    if (lower.includes('mate')) return 'Mat';
    if (lower.includes('geom')) return 'Geo';
    if (lower.includes('espa') || lower.includes('leng')) return 'Esp';
    if (lower.includes('ingl')) return 'Ing';
    if (lower.includes('bio')) return 'Bio';
    if (lower.includes('físi') || lower.includes('fisi')) return 'Fís';
    if (lower.includes('quím') || lower.includes('quim')) return 'Quím';
    if (lower.includes('soci')) return 'Soc';
    if (lower.includes('filo')) return 'Fil';
    if (lower.includes('polí') || lower.includes('poli')) return 'Pol';
    if (lower.includes('étic') || lower.includes('etic')) return 'Ética';
    if (lower.includes('reli')) return 'Rel';
    if (lower.includes('físi') || lower.includes('depor')) return 'Ed.Fís';
    if (lower.includes('arte') || lower.includes('artí')) return 'Arte';
    if (lower.includes('tec') || lower.includes('info')) return 'Tec';
    return clean.length > 5 ? clean.slice(0, 4) + '.' : clean;
};

// ==========================================
// COMPONENTES ORNAMENTALES PARA DIPLOMAS VIP
// ==========================================
function DiplomaCornerOrnament({ position }) {
    const transforms = {
        'top-left': 'top-2.5 left-2.5',
        'top-right': 'top-2.5 right-2.5 scale-x-[-1]',
        'bottom-left': 'bottom-2.5 left-2.5 scale-y-[-1]',
        'bottom-right': 'bottom-2.5 right-2.5 scale-x-[-1] scale-y-[-1]'
    }[position] || '';

    return (
        <svg 
            viewBox="0 0 70 70" 
            className={`w-10 h-10 text-[#c59b27] absolute ${transforms} pointer-events-none`}
            fill="none" 
            stroke="currentColor"
        >
            <path d="M 4 4 L 35 4 C 24 7 14 17 10 28 L 10 55" strokeWidth="2.5" />
            <path d="M 8 8 L 42 8 C 29 13 18 24 14 36 L 14 60" strokeWidth="1" strokeDasharray="3 2" />
            <path d="M 4 4 L 4 35 C 7 24 17 14 28 10 L 55 10" strokeWidth="2.5" />
            <path d="M 8 8 L 8 42 C 13 29 24 18 36 14 L 60 14" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="6" cy="6" r="3" fill="currentColor" />
            <circle cx="20" cy="20" r="2.5" fill="currentColor" />
            <path d="M 12 12 Q 24 12 28 24 Q 12 24 12 12 Z" fill="currentColor" fillOpacity="0.4" />
            <circle cx="38" cy="6" r="2" fill="currentColor" />
            <circle cx="6" cy="38" r="2" fill="currentColor" />
        </svg>
    );
}

function DiplomaFiligreeDivider() {
    return (
        <div className="flex items-center justify-center gap-2 my-1">
            <div className="h-[1.5px] bg-gradient-to-r from-transparent via-[#c59b27] to-transparent w-40"></div>
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#c59b27] shrink-0" fill="currentColor">
                <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" />
            </svg>
            <div className="h-[1.5px] bg-gradient-to-r from-transparent via-[#c59b27] to-transparent w-40"></div>
        </div>
    );
}

function DiplomaMedallion({ rankIndex }) {
    const medalConfig = [
        { outer: '#b8860b', inner: '#d4af37', text: '1°', bg: 'from-amber-400 via-yellow-100 to-amber-600', ribbon1: 'from-[#b8860b] to-[#991b1b]', ribbon2: 'from-[#b8860b] to-[#991b1b]' },
        { outer: '#71717a', inner: '#a1a1aa', text: '2°', bg: 'from-slate-200 via-white to-slate-400', ribbon1: 'from-[#71717a] to-[#1e3a8a]', ribbon2: 'from-[#71717a] to-[#1e3a8a]' },
        { outer: '#92400e', inner: '#b45309', text: '3°', bg: 'from-amber-600 via-amber-200 to-amber-800', ribbon1: 'from-[#92400e] to-[#065f46]', ribbon2: 'from-[#92400e] to-[#065f46]' }
    ][rankIndex] || { outer: '#b8860b', inner: '#d4af37', text: '1°', bg: 'from-amber-400 to-amber-600', ribbon1: 'from-[#b8860b] to-[#991b1b]', ribbon2: 'from-[#b8860b] to-[#991b1b]' };

    return (
        <div className="relative flex flex-col items-center">
            {/* Medalla circular ornamental con relieve */}
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-[#c59b27] bg-gradient-to-br ${medalConfig.bg}`}>
                {/* Dentado perimetral del sello */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-[#c59b27] pointer-events-none" fill="none">
                    <circle cx="50" cy="50" r="46" stroke="#b8860b" strokeWidth="2" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="41" stroke="#b8860b" strokeWidth="1" />
                    <path d="M 50 14 L 51 17 L 54 17 L 51.5 19 L 52.5 22 L 50 20 L 47.5 22 L 48.5 19 L 46 17 L 49 17 Z" fill="#b8860b" />
                </svg>

                {/* Contenido grabado */}
                <div className="text-center z-10 font-cinzel leading-none select-none">
                    <span className="text-[7.5px] font-black tracking-widest text-slate-900 block uppercase">EXCELENCIA</span>
                    <span className="text-xl font-black text-slate-950 block my-0.5 tracking-tight">{medalConfig.text}</span>
                    <span className="text-[7px] font-extrabold tracking-widest text-slate-800 block">2026</span>
                </div>
            </div>

            {/* Cintas de honor colgantes */}
            <div className="flex gap-1 -mt-2.5 z-0">
                <div className={`w-3.5 h-6 bg-gradient-to-b ${medalConfig.ribbon1} shadow-md transform -rotate-12 rounded-b-xs border-t border-amber-200`}></div>
                <div className={`w-3.5 h-6 bg-gradient-to-b ${medalConfig.ribbon2} shadow-md transform rotate-12 rounded-b-xs border-t border-amber-200`}></div>
            </div>
        </div>
    );
}

export default function AcademicStats() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Pestaña Activa: 'overview', 'year_projection', 'course_ranking', 'subject_ranking', 'global_ranking', 'honor_roll_print', 'diplomas_print'
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
        totalSubjects: 0,
        lostYearCount: 0,
        riskYearCount: 0
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

    // Proyección Predictiva de Fin de Año (Regla de 300 Puntos)
    const [yearLostStudents, setYearLostStudents] = useState([]);
    const [yearRiskStudents, setYearRiskStudents] = useState([]);
    const [yearProjectionSubTab, setYearProjectionSubTab] = useState('lost'); // 'lost', 'risk', 'all'
    const [yearProjectionSearch, setYearProjectionSearch] = useState('');
    const [yearCourseFilter, setYearCourseFilter] = useState('');
    const [yearLateFilter, setYearLateFilter] = useState('all'); // 'all', 'regular', 'late'

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
                            photo_url: ""
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
            const failedSubjectsList = [];

            Object.entries(s.subjectsMap).forEach(([subjName, subjObj]) => {
                const subjAvg = subjObj.count > 0 ? subjObj.sum / subjObj.count : 0;
                if (subjAvg > 0 && subjAvg < 75) {
                    failedCount++;
                    failedSubjectsList.push({
                        name: subjName,
                        avg: Math.round(subjAvg),
                        exactAvg: Number(subjAvg.toFixed(1)),
                        count: subjObj.count
                    });
                }
            });

            // Ordenar materias reprobadas de menor a mayor calificación
            failedSubjectsList.sort((a, b) => a.avg - b.avg);

            return {
                ...s,
                average: avg,
                failedSubjectsCount: failedCount,
                failedSubjectsList
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

        // -------------------------------------------------------------
        // PROYECCIÓN MATEMÁTICA DE FIN DE AÑO (REGLA INSTITUCIONAL DE 300 PUNTOS)
        // Se calcula con TODOS los periodos registrados en rawGrades (P1, P2, P3)
        // Restan como máximo 100 puntos en el Periodo 4.
        // -------------------------------------------------------------
        const fullYearStudentsMap = {};
        activeStudentsOnly.forEach(student => {
            fullYearStudentsMap[student.id] = {
                ...student,
                yearSubjects: {} // { [subjName]: { periods: { [period]: gradeVal } } }
            };
        });

        rawGrades.forEach(gDoc => {
            const sId = gDoc.student_id;
            const val = Number(gDoc.grade);
            const subj = gDoc.subject;
            const period = gDoc.period;

            if (isNaN(val) || val <= 0 || !subj) return;

            if (fullYearStudentsMap[sId]) {
                const sObj = fullYearStudentsMap[sId];
                if (!sObj.yearSubjects[subj]) {
                    sObj.yearSubjects[subj] = { periods: {} };
                }
                sObj.yearSubjects[subj].periods[period] = val;
            }
        });

        const calculatedYearLost = [];
        const calculatedYearRisk = [];

        Object.values(fullYearStudentsMap).forEach(st => {
            const lostSubjects = [];
            const criticalSubjects = [];
            const recoverableSubjects = [];
            const passedSubjects = [];

            let totalYearSum = 0;
            let totalYearCount = 0;

            Object.entries(st.yearSubjects).forEach(([subjName, subjData]) => {
                const pVals = Object.values(subjData.periods);
                const subjSum = pVals.reduce((acc, v) => acc + v, 0);
                const periodsCount = pVals.length;

                totalYearSum += subjSum;
                totalYearCount += periodsCount;

                // Regla institucional: Se aprueba la materia acumulando 300 puntos en 4 periodos.
                // Resta el Periodo 4 (máximo 100 puntos posibles a obtener).
                const needed = 300 - subjSum;

                if (needed > 100) {
                    // Matemáticamente imposible de aprobar, así saque 100 en P4:
                    lostSubjects.push({
                        name: subjName,
                        shortName: getSubjectShort(subjName),
                        sum: subjSum,
                        needed,
                        deficit: needed - 100, // Puntos que le faltan por debajo de 300 incluso con 100 en P4
                        periodsCount,
                        periods: subjData.periods
                    });
                } else if (needed > 90) {
                    // En riesgo crítico: Necesita entre 91 y 100 puntos en P4
                    criticalSubjects.push({
                        name: subjName,
                        shortName: getSubjectShort(subjName),
                        sum: subjSum,
                        needed,
                        periodsCount,
                        periods: subjData.periods
                    });
                } else if (needed <= 0) {
                    passedSubjects.push({
                        name: subjName,
                        shortName: getSubjectShort(subjName),
                        sum: subjSum,
                        needed: 0,
                        periodsCount,
                        periods: subjData.periods
                    });
                } else {
                    recoverableSubjects.push({
                        name: subjName,
                        shortName: getSubjectShort(subjName),
                        sum: subjSum,
                        needed,
                        periodsCount,
                        periods: subjData.periods
                    });
                }
            });

            if (Object.keys(st.yearSubjects).length === 0) return;

            // Ordenar asignaturas perdidas por mayor déficit
            lostSubjects.sort((a, b) => b.deficit - a.deficit);
            criticalSubjects.sort((a, b) => b.needed - a.needed);

            const lostCount = lostSubjects.length;
            const critCount = criticalSubjects.length;
            const studentYearAvg = totalYearCount > 0 ? Number((totalYearSum / totalYearCount).toFixed(1)) : 0;

            // Periodos evaluados para este estudiante
            const evaluatedPeriodsSet = new Set();
            Object.values(st.yearSubjects).forEach(subjData => {
                Object.keys(subjData.periods).forEach(p => evaluatedPeriodsSet.add(Number(p)));
            });
            const evaluatedPeriods = Array.from(evaluatedPeriodsSet).sort((a, b) => a - b);
            const totalPeriodsCount = evaluatedPeriods.length;
            const isLateEnrollment = totalPeriodsCount > 0 && totalPeriodsCount < 3;
            const missingPeriods = [1, 2, 3].filter(p => !evaluatedPeriods.includes(p));
            const periodsLabel = totalPeriodsCount === 1 
                ? `Solo Periodo ${evaluatedPeriods[0]}` 
                : `Solo Periodos ${evaluatedPeriods.join(' y ')}`;
            const periodsShortBadge = totalPeriodsCount === 1 
                ? `Solo P${evaluatedPeriods[0]}` 
                : `Solo P${evaluatedPeriods.join(' y P')}`;

            const studentEnhanced = {
                ...st,
                yearAverage: studentYearAvg,
                totalSubjectsEvaluated: Object.keys(st.yearSubjects).length,
                lostCount,
                critCount,
                lostSubjects,
                criticalSubjects,
                recoverableSubjects,
                passedSubjects,
                evaluatedPeriods,
                totalPeriodsCount,
                isLateEnrollment,
                missingPeriods,
                periodsLabel,
                periodsShortBadge
            };

            // 1. AÑO PERDIDO MATEMÁTICAMENTE: 2 o más asignaturas irrecuperables
            if (lostCount >= 2) {
                calculatedYearLost.push({
                    ...studentEnhanced,
                    diagnosisType: 'YEAR_LOST'
                });
            }
            // 2. RIESGO CRÍTICO DE PÉRDIDA DE AÑO (Opción A):
            // - Caso A1: 1 materia ya perdida Y 1+ críticas (>90 pts)
            // - Caso A2: 1 materia ya perdida (sin margen de error en P4)
            // - Caso B: 0 materias perdidas Y 2 o más materias necesitando más de 90 pts
            else if (lostCount === 1 || (lostCount === 0 && critCount >= 2)) {
                calculatedYearRisk.push({
                    ...studentEnhanced,
                    diagnosisType: 'YEAR_RISK',
                    riskScenario: lostCount === 1 
                        ? (critCount >= 1 ? '1_LOST_AND_CRITICAL' : '1_LOST_NO_MARGIN') 
                        : 'MULTIPLE_CRITICAL'
                });
            }
        });

        // Ordenar listas: por grado/curso, luego por cantidad de materias perdidas desc, luego alfabético
        calculatedYearLost.sort((a, b) => {
            const courseComp = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (courseComp !== 0) return courseComp;
            if (b.lostCount !== a.lostCount) return b.lostCount - a.lostCount;
            return a.name.localeCompare(b.name);
        });

        calculatedYearRisk.sort((a, b) => {
            const courseComp = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (courseComp !== 0) return courseComp;
            if (b.lostCount !== a.lostCount) return b.lostCount - a.lostCount;
            if (b.critCount !== a.critCount) return b.critCount - a.critCount;
            return a.name.localeCompare(b.name);
        });

        setYearLostStudents(calculatedYearLost);
        setYearRiskStudents(calculatedYearRisk);

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
            totalSubjects: subjectsArray.length,
            lostYearCount: calculatedYearLost.length,
            riskYearCount: calculatedYearRisk.length
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

    // Filtrado de listas de Proyección de Fin de Año
    const effectiveYearCourse = yearCourseFilter !== "" ? yearCourseFilter : (selectedCourse || "");

    const filteredLostYear = yearLostStudents.filter(st => {
        if (effectiveYearCourse && st.grade !== effectiveYearCourse) return false;
        if (yearLateFilter === 'regular' && st.isLateEnrollment) return false;
        if (yearLateFilter === 'late' && !st.isLateEnrollment) return false;
        if (yearProjectionSearch.trim()) {
            const q = yearProjectionSearch.toLowerCase().trim();
            const fullName = `${st.lastName || ''} ${st.firstName || ''} ${st.name || ''}`.toLowerCase();
            const code = (st.id_code || '').toLowerCase();
            if (!fullName.includes(q) && !code.includes(q)) return false;
        }
        return true;
    });

    const filteredRiskYear = yearRiskStudents.filter(st => {
        if (effectiveYearCourse && st.grade !== effectiveYearCourse) return false;
        if (yearLateFilter === 'regular' && st.isLateEnrollment) return false;
        if (yearLateFilter === 'late' && !st.isLateEnrollment) return false;
        if (yearProjectionSearch.trim()) {
            const q = yearProjectionSearch.toLowerCase().trim();
            const fullName = `${st.lastName || ''} ${st.firstName || ''} ${st.name || ''}`.toLowerCase();
            const code = (st.id_code || '').toLowerCase();
            if (!fullName.includes(q) && !code.includes(q)) return false;
        }
        return true;
    });

    const handleExportYearProjectionCSV = () => {
        const headers = [
            "Tipo Diagnóstico",
            "Grado",
            "Código ID",
            "Apellidos y Nombres",
            "Historial Periodos",
            "Cant. Materias Perdidas",
            "Detalle Materias Irrecuperables (Suma / Necesita / Déficit)",
            "Cant. Materias Críticas (>90)",
            "Detalle Materias Críticas (Suma / Necesita P4)",
            "Observación de Ingreso"
        ];

        const rows = [];
        if (yearProjectionSubTab === 'lost' || yearProjectionSubTab === 'all') {
            filteredLostYear.forEach(st => {
                const lostDetails = st.lostSubjects.map(s => `${s.name} [Suma:${s.sum} Necesita:${s.needed} Déficit:-${s.deficit}]`).join('; ');
                const critDetails = st.criticalSubjects.map(s => `${s.name} [Suma:${s.sum} Necesita:${s.needed}]`).join('; ');
                rows.push([
                    "AÑO PERDIDO MATEMÁTICO",
                    `Curso ${st.grade}`,
                    st.id_code,
                    st.lastName && st.firstName ? `"${st.lastName} ${st.firstName}"` : `"${st.name}"`,
                    st.isLateEnrollment ? `"${st.periodsShortBadge} (${st.totalPeriodsCount} periodos)"` : '"Completo (P1-P3)"',
                    st.lostCount,
                    `"${lostDetails}"`,
                    st.critCount,
                    `"${critDetails}"`,
                    st.isLateEnrollment ? `"Ingreso tardío: Falta P${st.missingPeriods.join(', P')} por homologar"` : '"Regular"'
                ]);
            });
        }
        if (yearProjectionSubTab === 'risk' || yearProjectionSubTab === 'all') {
            filteredRiskYear.forEach(st => {
                const lostDetails = st.lostSubjects.map(s => `${s.name} [Suma:${s.sum} Necesita:${s.needed} Déficit:-${s.deficit}]`).join('; ');
                const critDetails = st.criticalSubjects.map(s => `${s.name} [Suma:${s.sum} Necesita:${s.needed}]`).join('; ');
                rows.push([
                    st.riskScenario === '1_LOST_AND_CRITICAL' ? "RIESGO (1 Perdida + Crítica)" : st.riskScenario === '1_LOST_NO_MARGIN' ? "RIESGO (1 Materia Perdida)" : "RIESGO (2+ Críticas)",
                    `Curso ${st.grade}`,
                    st.id_code,
                    st.lastName && st.firstName ? `"${st.lastName} ${st.firstName}"` : `"${st.name}"`,
                    st.isLateEnrollment ? `"${st.periodsShortBadge} (${st.totalPeriodsCount} periodos)"` : '"Completo (P1-P3)"',
                    st.lostCount,
                    `"${lostDetails}"`,
                    st.critCount,
                    `"${critDetails}"`,
                    st.isLateEnrollment ? `"Ingreso tardío: Falta P${st.missingPeriods.join(', P')} por homologar"` : '"Regular"'
                ]);
            });
        }

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proyeccion_perdida_ano_2026_${effectiveYearCourse ? 'curso_' + effectiveYearCourse : 'general'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="w-full max-w-[1440px] mx-auto space-y-6 pb-12">
            
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
                    { 
                        id: 'year_projection', 
                        label: '🚨 Proyección Fin de Año (300 pts)', 
                        icon: ShieldAlert,
                        badge: yearLostStudents.length > 0 ? `${yearLostStudents.length} perdieron` : null,
                        badgeColor: 'bg-rose-600 text-white shadow-xs'
                    },
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
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tab.badgeColor || 'bg-rose-600 text-white'}`}>
                                    {tab.badge}
                                </span>
                            )}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* 1. Promedio General */}
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl"></div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">PROMEDIO GENERAL</p>
                                    <h3 className="text-3xl font-black text-white mt-1.5 tracking-tight">
                                        {stats.globalAverage || "0.0"} <span className="text-xs font-normal text-indigo-300">/100</span>
                                    </h3>
                                </div>
                                <div className="w-9 h-9 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                    <TrendingUp className="text-indigo-300" size={18} />
                                </div>
                            </div>
                            <p className="text-[10.5px] text-indigo-200/80 font-medium mt-3">
                                {selectedCourse ? `Grado ${selectedCourse}` : 'Institucional Completo'}
                            </p>
                        </div>

                        {/* 2. Tasa de Aprobación */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">APROBACIÓN GENERAL</p>
                                    <h3 className="text-3xl font-black text-slate-800 mt-1.5 tracking-tight">
                                        {stats.passingRate}%
                                    </h3>
                                </div>
                                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle2 size={18} />
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.passingRate}%` }}></div>
                            </div>
                        </div>

                        {/* 3. Nivel Excelente */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EXCELENCIA (≥95)</p>
                                    <h3 className="text-3xl font-black text-slate-800 mt-1.5 tracking-tight">
                                        {stats.excellentRate}%
                                    </h3>
                                </div>
                                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                                    <Star size={18} />
                                </div>
                            </div>
                            <p className="text-[10.5px] text-slate-400 font-semibold mt-3">
                                {performanceDistribution.superior} alumnos en Superior
                            </p>
                        </div>

                        {/* 4. Año Perdido Matemático (NUEVO) */}
                        <div 
                            onClick={() => {
                                setActiveTab('year_projection');
                                setYearProjectionSubTab('lost');
                            }}
                            className="bg-gradient-to-br from-rose-50 to-red-100/60 border border-rose-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-300 hover:shadow-md transition active-press"
                            title="Ver tabla de estudiantes con año perdido"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1">
                                        AÑO PERDIDO MATEMÁTICO
                                    </p>
                                    <h3 className="text-3xl font-black text-rose-700 mt-1.5 tracking-tight">
                                        {yearLostStudents.length} <span className="text-xs font-bold text-rose-500">alumnos</span>
                                    </h3>
                                </div>
                                <div className="w-9 h-9 rounded-2xl bg-rose-200/80 text-rose-700 flex items-center justify-center">
                                    <ShieldAlert size={18} />
                                </div>
                            </div>
                            <p className="text-[10.5px] text-rose-700 font-bold mt-3 flex items-center justify-between">
                                <span>≥ 2 materias irrecuperables</span>
                                <span className="underline font-black">Ver tabla →</span>
                            </p>
                        </div>

                        {/* 5. Riesgo Crítico de Año (NUEVO) */}
                        <div 
                            onClick={() => {
                                setActiveTab('year_projection');
                                setYearProjectionSubTab('risk');
                            }}
                            className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 hover:shadow-md transition active-press"
                            title="Ver tabla de estudiantes en riesgo crítico de pérdida"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                                        RIESGO CRÍTICO DE AÑO
                                    </p>
                                    <h3 className="text-3xl font-black text-amber-900 mt-1.5 tracking-tight">
                                        {yearRiskStudents.length} <span className="text-xs font-bold text-amber-700">alumnos</span>
                                    </h3>
                                </div>
                                <div className="w-9 h-9 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center">
                                    <AlertTriangle size={18} />
                                </div>
                            </div>
                            <p className="text-[10.5px] text-amber-800 font-bold mt-3 flex items-center justify-between">
                                <span>1 perdida ó 2+ críticas (&gt;90)</span>
                                <span className="underline font-black">Ver tabla →</span>
                            </p>
                        </div>
                    </div>

                    {/* Banner Ejecutivo de Proyección de Fin de Año (Fondo Esmerilado / Glassmorphism) */}
                    <div className="bg-white/80 backdrop-blur-2xl border border-white/90 shadow-xl shadow-slate-900/5 rounded-3xl p-6 relative overflow-hidden ring-1 ring-slate-200/60">
                        <div className="absolute -top-16 -right-16 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                            <div className="space-y-2 max-w-2xl">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="bg-rose-50 text-rose-700 border border-rose-200/80 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
                                        <ShieldAlert size={12} className="text-rose-600" /> Diagnóstico Predictivo Fin de Año
                                    </span>
                                    <span className="text-slate-500 text-xs font-bold">• Regla Institucional de 300 Puntos</span>
                                </div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                    Proyección de Aprobación & Pérdida de Año 2026
                                </h2>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Con base en las notas de los <strong className="text-slate-900 font-bold">Periodos 1, 2 y 3</strong>, restan máximo <strong className="text-slate-900 font-bold">100 puntos en el Periodo 4</strong>. Quienes acumulen menos de 200 puntos pierden la asignatura por imposibilidad matemática. Pierden el año quienes reprueben 2 o más asignaturas (&lt;300 pts).
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                                <button
                                    onClick={() => {
                                        setActiveTab('year_projection');
                                        setYearProjectionSubTab('lost');
                                    }}
                                    className="px-4 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2.5 transition active-press cursor-pointer border border-rose-500/20"
                                >
                                    <span className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-black">
                                        {yearLostStudents.length}
                                    </span>
                                    <span>Año Perdido Matemático</span>
                                    <ChevronRight size={15} />
                                </button>

                                <button
                                    onClick={() => {
                                        setActiveTab('year_projection');
                                        setYearProjectionSubTab('risk');
                                    }}
                                    className="px-4 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-2xl font-black text-xs shadow-lg shadow-amber-500/30 flex items-center gap-2.5 transition active-press cursor-pointer border border-amber-300/40"
                                >
                                    <span className="w-6 h-6 rounded-full bg-slate-950/15 flex items-center justify-center text-xs font-black">
                                        {yearRiskStudents.length}
                                    </span>
                                    <span>Riesgo Crítico de Pérdida</span>
                                    <ChevronRight size={15} />
                                </button>
                            </div>
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
                                        <div key={st.id} className="bg-white p-3.5 rounded-2xl border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs hover:border-amber-300 transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-full overflow-hidden bg-amber-50 border border-amber-200 shrink-0">
                                                    <img 
                                                        src={getStudentPhoto(st.photo_url)} 
                                                        alt={st.name} 
                                                        className="w-full h-full object-cover" 
                                                        onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-extrabold text-slate-800 block truncate">{st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}</span>
                                                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1.5 flex-wrap">
                                                        <span>{st.failedSubjectsCount > 0 ? `⚠️ ${st.failedSubjectsCount} materia en bajo (<75)` : '⚠️ Promedio en franja crítica (75-78 pts)'}</span>
                                                        <span>•</span>
                                                        <span className="text-slate-500 font-semibold">Grado {st.grade}</span>
                                                        <span className="text-slate-400 font-normal">({st.average} Prom. Gral)</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 shrink-0 max-w-full sm:max-w-[55%]">
                                                {st.failedSubjectsList && st.failedSubjectsList.length > 0 ? (
                                                    st.failedSubjectsList.map((fs, idx) => (
                                                        <span 
                                                            key={idx}
                                                            title={`${fs.name}: Promedio ${fs.avg} pts en ${fs.count} periodo(s)`}
                                                            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/90 text-amber-900 font-bold px-2.5 py-1 rounded-xl text-[11px] shadow-2xs transition cursor-default"
                                                        >
                                                            <span className="font-black text-amber-950">{getSubjectShort(fs.name)}</span>
                                                            <span className="text-amber-700 font-black">({fs.avg})</span>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl text-xs">
                                                        {st.average} Prom. Gral
                                                    </span>
                                                )}
                                            </div>
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
                                        <div key={st.id} className="bg-white p-3.5 rounded-2xl border border-rose-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs hover:border-rose-300 transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-full overflow-hidden bg-rose-50 border border-rose-200 shrink-0">
                                                    <img 
                                                        src={getStudentPhoto(st.photo_url)} 
                                                        alt={st.name} 
                                                        className="w-full h-full object-cover" 
                                                        onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-extrabold text-slate-800 block truncate">{st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}</span>
                                                    <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1.5 flex-wrap">
                                                        <span>⚠️ {st.failedSubjectsCount} materia(s) en bajo (&lt;75)</span>
                                                        <span>•</span>
                                                        <span className="text-slate-500 font-semibold">Grado {st.grade}</span>
                                                        <span className="text-slate-400 font-normal">({st.average} Prom. Gral)</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 shrink-0 max-w-full sm:max-w-[55%]">
                                                {st.failedSubjectsList && st.failedSubjectsList.length > 0 ? (
                                                    st.failedSubjectsList.map((fs, idx) => (
                                                        <span 
                                                            key={idx}
                                                            title={`${fs.name}: Promedio ${fs.avg} pts en ${fs.count} periodo(s)`}
                                                            className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/90 text-rose-800 font-bold px-2.5 py-1 rounded-xl text-[11px] shadow-2xs transition cursor-default"
                                                        >
                                                            <span className="font-black text-rose-900">{getSubjectShort(fs.name)}</span>
                                                            <span className="text-rose-600 font-black">({fs.avg})</span>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl text-xs">
                                                        {st.average} Prom. Gral
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA: PROYECCIÓN PREDICTIVA DE FIN DE AÑO (REGLA DE 300 PUNTOS) */}
            {activeTab === 'year_projection' && (
                <div className="space-y-6">
                    {/* Tarjeta de Encabezado y Reglas de Diagnóstico */}
                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-900/40 shadow-xl space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                    <ShieldAlert size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                                            Diagnóstico Predictivo 2026
                                        </span>
                                        <span className="text-xs text-indigo-200">• Cierre Periodo 3</span>
                                    </div>
                                    <h2 className="text-xl font-black text-white tracking-tight mt-1">
                                        Proyección Fin de Año: Pérdida Matemática & Riesgo Crítico (Regla 300 Puntos)
                                    </h2>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handleExportYearProjectionCSV}
                                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-2xl border border-white/15 transition flex items-center gap-2 active-press shadow-xs"
                                    title="Descargar listado completo en archivo Excel/CSV"
                                >
                                    <Download size={15} /> Exportar CSV
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl transition flex items-center gap-2 active-press shadow-md shadow-indigo-600/30"
                                    title="Imprimir informe para Consejo Académico"
                                >
                                    <Printer size={15} /> Imprimir Informe
                                </button>
                            </div>
                        </div>

                        {/* Fichas de Explicación de Reglas Institucionales */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
                                <div className="flex items-center gap-2 text-indigo-300 font-black text-[11px] uppercase tracking-wider">
                                    <span>🎯 Regla de Aprobación</span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    Se aprueba la materia acumulando <strong className="text-white">300 puntos</strong> entre los 4 periodos (promedio anual mínimo de 75.0).
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
                                <div className="flex items-center gap-2 text-rose-300 font-black text-[11px] uppercase tracking-wider">
                                    <span>❌ Pérdida de Año</span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    El estudiante pierde el año escolar si no alcanza los 300 puntos en <strong className="text-rose-300">2 o más asignaturas</strong>.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
                                <div className="flex items-center gap-2 text-rose-400 font-black text-[11px] uppercase tracking-wider">
                                    <span>🚫 Materia Irrecuperable</span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    Si suma &lt; 200 pts en P1..P3, le faltan <strong className="text-white">&gt; 100 pts</strong>. Es matemáticamente imposible aprobarla en P4 (máx 100).
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-1">
                                <div className="flex items-center gap-2 text-amber-300 font-black text-[11px] uppercase tracking-wider">
                                    <span>⚠️ Zona Crítica (&gt;90 pts)</span>
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    Asignatura donde el alumno necesita entre <strong className="text-amber-300">91 y 100 puntos en P4</strong> para alcanzar los 300 requeridos.
                                </p>
                            </div>
                        </div>

                        {/* Banner Informativo de Ingreso Tardío */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-200">
                            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-amber-300 block font-black">Casos Especiales de Ingreso Tardío:</strong>
                                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                                    Los estudiantes que ingresaron a mitad de año (registran notas únicamente de 1 o 2 periodos) presentan un déficit acumulativo natural por los periodos que no cursaron en la institución. Se identifican con el distintivo <strong className="text-amber-300">"Ingreso Tardío"</strong> para que las directivas y el Consejo Académico verifiquen su homologación o nivelación de notas antes de la toma de decisiones finales.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Filtros y Subpestañas */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Selector de Subpestaña */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setYearProjectionSubTab('lost')}
                                    className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition active-press border ${
                                        yearProjectionSubTab === 'lost'
                                            ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20'
                                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <ShieldAlert size={15} />
                                    <span>1. Año Perdido Matemático</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                        yearProjectionSubTab === 'lost' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                        {filteredLostYear.length}
                                    </span>
                                </button>

                                <button
                                    onClick={() => setYearProjectionSubTab('risk')}
                                    className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition active-press border ${
                                        yearProjectionSubTab === 'risk'
                                            ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <AlertTriangle size={15} />
                                    <span>2. Riesgo Crítico de Pérdida</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                        yearProjectionSubTab === 'risk' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-100 text-amber-900'
                                    }`}>
                                        {filteredRiskYear.length}
                                    </span>
                                </button>

                                <button
                                    onClick={() => setYearProjectionSubTab('all')}
                                    className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition active-press border ${
                                        yearProjectionSubTab === 'all'
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <span>📋 Vista Consolidada</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                        yearProjectionSubTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                                    }`}>
                                        {filteredLostYear.length + filteredRiskYear.length}
                                    </span>
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                {/* Filtro por Historial de Periodos */}
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs">
                                    <button
                                        onClick={() => setYearLateFilter('all')}
                                        className={`px-3 py-1.5 rounded-xl font-bold transition ${
                                            yearLateFilter === 'all'
                                                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setYearLateFilter('regular')}
                                        className={`px-3 py-1.5 rounded-xl font-bold transition ${
                                            yearLateFilter === 'regular'
                                                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                        title="Alumnos con 3 periodos completos"
                                    >
                                        3 Periodos
                                    </button>
                                    <button
                                        onClick={() => setYearLateFilter('late')}
                                        className={`px-3 py-1.5 rounded-xl font-black transition flex items-center gap-1.5 ${
                                            yearLateFilter === 'late'
                                                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                                : 'text-amber-800 hover:text-amber-950 font-bold'
                                        }`}
                                        title="Alumnos con notas de solo 1 o 2 periodos (ingreso tardío)"
                                    >
                                        <Clock size={12} />
                                        <span>Ingreso Tardío</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                            yearLateFilter === 'late' ? 'bg-slate-950 text-white' : 'bg-amber-200/80 text-amber-900'
                                        }`}>
                                            {(yearProjectionSubTab === 'lost' ? yearLostStudents : yearProjectionSubTab === 'risk' ? yearRiskStudents : [...yearLostStudents, ...yearRiskStudents]).filter(s => s.isLateEnrollment).length}
                                        </span>
                                    </button>
                                </div>

                                {/* Barra de Búsqueda Rápida */}
                                <div className="relative w-full sm:w-64">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={yearProjectionSearch}
                                        onChange={(e) => setYearProjectionSearch(e.target.value)}
                                        placeholder="Buscar estudiante o código..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-9 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                                    />
                                    {yearProjectionSearch && (
                                        <button 
                                            onClick={() => setYearProjectionSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Selector de Cursos en Pills */}
                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtrar por Curso / Salón</label>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                <button
                                    onClick={() => setYearCourseFilter("")}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                                        effectiveYearCourse === ""
                                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                    }`}
                                >
                                    🎓 Todos los Cursos ({
                                        yearProjectionSubTab === 'lost'
                                            ? `${yearLostStudents.length} perdidos`
                                            : yearProjectionSubTab === 'risk'
                                                ? `${yearRiskStudents.length} en riesgo`
                                                : `${yearLostStudents.length} perdidos • ${yearRiskStudents.length} en riesgo`
                                    })
                                </button>
                                {coursesList.map(c => {
                                    const lostInCourse = yearLostStudents.filter(s => s.grade === c).length;
                                    const riskInCourse = yearRiskStudents.filter(s => s.grade === c).length;
                                    const showLost = yearProjectionSubTab === 'lost' || yearProjectionSubTab === 'all';
                                    const showRisk = yearProjectionSubTab === 'risk' || yearProjectionSubTab === 'all';

                                    return (
                                        <button
                                            key={c}
                                            onClick={() => setYearCourseFilter(c)}
                                            className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition flex items-center gap-1.5 ${
                                                effectiveYearCourse === c
                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                            }`}
                                        >
                                            <span>Curso {c}</span>
                                            {showLost && lostInCourse > 0 && (
                                                <span 
                                                    title={`${lostInCourse} estudiante(s) con año perdido`}
                                                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-black ${
                                                        effectiveYearCourse === c ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
                                                    }`}
                                                >
                                                    {lostInCourse}
                                                </span>
                                            )}
                                            {showRisk && riskInCourse > 0 && (
                                                <span 
                                                    title={`${riskInCourse} estudiante(s) en riesgo crítico`}
                                                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-black ${
                                                        effectiveYearCourse === c ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900 border border-amber-300'
                                                    }`}
                                                >
                                                    {riskInCourse}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* TABLA 1: ESTUDIANTES QUE YA PERDIERON EL AÑO MATEMÁTICAMENTE */}
                    {(yearProjectionSubTab === 'lost' || yearProjectionSubTab === 'all') && (
                        <div className="bg-white rounded-3xl border border-rose-200/80 shadow-sm p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-rose-950 tracking-tight flex items-center gap-2">
                                        <ShieldAlert size={20} className="text-rose-600" />
                                        1. Estudiantes que Ya Perdieron el Año por Imposibilidad Matemática
                                    </h3>
                                    <p className="text-xs text-rose-700/90 mt-0.5">
                                        Tienen <strong>2 o más asignaturas irrecuperables</strong> (aún sacando 100 en el Periodo 4, no alcanzan los 300 puntos reglamentarios).
                                    </p>
                                </div>
                                <span className="px-3 py-1 bg-rose-100 border border-rose-200 text-rose-800 rounded-full font-black text-xs shrink-0 self-start sm:self-auto">
                                    {filteredLostYear.length} estudiantes
                                </span>
                            </div>

                            {filteredLostYear.length === 0 ? (
                                <div className="p-8 text-center bg-rose-50/40 rounded-2xl border border-rose-100 text-xs text-rose-700 font-bold">
                                    No hay estudiantes con pérdida de año matemática registrada para este filtro.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-rose-50/70 border-b border-rose-200 text-rose-900 font-black uppercase text-[10px] tracking-wider">
                                                <th className="p-3.5 text-center w-12">#</th>
                                                <th className="p-3.5">Estudiante</th>
                                                <th className="p-3.5 text-center">Grado</th>
                                                <th className="p-3.5 text-center">Materias Irrecuperables</th>
                                                <th className="p-3.5 min-w-[340px]">Detalle de Materias (Suma P1-P3 / Necesita P4 / Déficit)</th>
                                                <th className="p-3.5 text-center">Dictamen Final</th>
                                                <th className="p-3.5 text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rose-100/70">
                                            {filteredLostYear.map((st, idx) => (
                                                <tr key={st.id} className="hover:bg-rose-50/40 transition">
                                                    <td className="p-3.5 text-center font-black text-rose-900">
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-100 text-rose-800 text-xs font-black">
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-rose-50 border border-rose-200 shrink-0">
                                                                <img 
                                                                    src={getStudentPhoto(st.photo_url)} 
                                                                    alt={st.name} 
                                                                    className="w-full h-full object-cover" 
                                                                    onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="font-extrabold text-slate-900 block">
                                                                    {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                                                </span>
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] text-slate-400 font-mono">Código: {st.id_code}</span>
                                                                    {st.isLateEnrollment && (
                                                                        <span 
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-black shadow-2xs"
                                                                            title={`Historial incompleto: Solo tiene notas en ${st.periodsLabel}. Faltan notas de Periodo ${st.missingPeriods.join(', ')}.`}
                                                                        >
                                                                            <Clock size={10} className="text-amber-700" />
                                                                            Ingreso Tardío: {st.periodsShortBadge}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg text-xs">
                                                             Curso {st.grade}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="px-3 py-1 bg-rose-600 text-white font-black rounded-xl text-xs shadow-xs inline-flex items-center gap-1.5">
                                                            <ShieldAlert size={13} /> {st.lostCount} {st.lostCount === 1 ? 'materia' : 'materias'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {st.lostSubjects.map(ls => (
                                                                    <div 
                                                                        key={ls.name} 
                                                                        title={`${ls.name}: Suma ${ls.sum} pts en ${ls.periodsCount} periodos. Necesita ${ls.needed} pts para llegar a 300. Déficit de ${ls.deficit} pts incluso con 100.`}
                                                                        className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-950 px-2.5 py-1.5 rounded-xl text-xs shadow-2xs transition"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-rose-950">{ls.name}</span>
                                                                            <span className="text-[9.5px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded-md">
                                                                                Déficit: -{ls.deficit}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[10px] text-rose-700 flex items-center gap-1.5 mt-0.5">
                                                                            <span>Suma: <strong>{ls.sum} pts</strong></span>
                                                                            <span>•</span>
                                                                            <span>Necesita: <strong className="text-rose-900 font-black">{ls.needed} pts</strong> en P4</span>
                                                                        </div>
                                                                        {ls.periodsCount < 3 && (
                                                                            <div className="text-[9px] text-amber-800 font-bold bg-amber-100/70 px-1.5 py-0.5 rounded mt-1 border border-amber-200/80 inline-flex items-center gap-1">
                                                                                <AlertTriangle size={9} className="text-amber-600" />
                                                                                Suma de {ls.periodsCount} periodo(s): {Object.keys(ls.periods).sort().map(p => `P${p}`).join(', ')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {st.critCount > 0 && (
                                                                <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                                                                    <AlertTriangle size={11} /> Además registra {st.critCount} materia(s) en zona crítica (&gt;90 pts en P4)
                                                                </p>
                                                            )}
                                                            {st.isLateEnrollment && (
                                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-[10.5px] text-amber-900 flex items-start gap-2 mt-1">
                                                                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                                    <div>
                                                                        <span className="font-black text-amber-950">Atención - Ingreso Tardío / Historial Parcial:</span>
                                                                        <p className="text-[10px] text-amber-800/95 mt-0.5 leading-tight">
                                                                            Este alumno registra notas únicamente en <strong>{st.periodsLabel}</strong> (le falta calificar <strong>Periodo {st.missingPeriods.join(' y ')}</strong>). Su déficit matemático se debe a periodos no cursados; requiere homologación o nivelación institucional.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="space-y-1">
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl font-black text-[11px] bg-rose-600 text-white shadow-xs">
                                                                ❌ AÑO PERDIDO
                                                            </span>
                                                            {st.isLateEnrollment ? (
                                                                <div className="space-y-0.5">
                                                                    <span className="inline-block px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-950 rounded-md text-[9px] font-black uppercase">
                                                                        Historial Incompleto
                                                                    </span>
                                                                    <p className="text-[8.5px] text-amber-800 font-semibold">{st.periodsShortBadge}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-[9px] text-rose-700 font-bold">Irrecuperable</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <Link 
                                                            to={`/admin/boletin-print/${st.id}`}
                                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1 active-press"
                                                            title="Ver Boletín Académico"
                                                        >
                                                            <BookOpen size={12} /> Boletín
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TABLA 2: ESTUDIANTES EN RIESGO CRÍTICO DE PÉRDIDA DE AÑO */}
                    {(yearProjectionSubTab === 'risk' || yearProjectionSubTab === 'all') && (
                        <div className="bg-white rounded-3xl border border-amber-200/80 shadow-sm p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-amber-950 tracking-tight flex items-center gap-2">
                                        <AlertTriangle size={20} className="text-amber-500" />
                                        2. Estudiantes en Riesgo Crítico de Pérdida de Año Escolar
                                    </h3>
                                    <p className="text-xs text-amber-700/90 mt-0.5">
                                        Criterio pedagógico: <strong>1 materia ya perdida (sin margen de error en P4)</strong>, o <strong>0 perdidas y 2 o más necesitando &gt; 90 pts</strong> en Periodo 4.
                                    </p>
                                </div>
                                <span className="px-3 py-1 bg-amber-100 border border-amber-200 text-amber-900 rounded-full font-black text-xs shrink-0 self-start sm:self-auto">
                                    {filteredRiskYear.length} estudiantes
                                </span>
                            </div>

                            {filteredRiskYear.length === 0 ? (
                                <div className="p-8 text-center bg-amber-50/40 rounded-2xl border border-amber-100 text-xs text-amber-700 font-bold">
                                    No hay estudiantes en riesgo crítico de pérdida de año para este filtro.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-amber-50/70 border-b border-amber-200 text-amber-900 font-black uppercase text-[10px] tracking-wider">
                                                <th className="p-3.5 text-center w-12">#</th>
                                                <th className="p-3.5">Estudiante</th>
                                                <th className="p-3.5 text-center">Grado</th>
                                                <th className="p-3.5 text-center">Condición de Riesgo</th>
                                                <th className="p-3.5 min-w-[340px]">Detalle de Asignaturas en Riesgo (Periodo 4 Decisivo)</th>
                                                <th className="p-3.5 text-center">Dictamen</th>
                                                <th className="p-3.5 text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-amber-100/70">
                                            {filteredRiskYear.map((st, idx) => (
                                                <tr key={st.id} className="hover:bg-amber-50/40 transition">
                                                    <td className="p-3.5 text-center font-black text-amber-900">
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-black">
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-amber-50 border border-amber-200 shrink-0">
                                                                <img 
                                                                    src={getStudentPhoto(st.photo_url)} 
                                                                    alt={st.name} 
                                                                    className="w-full h-full object-cover" 
                                                                    onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="font-extrabold text-slate-900 block">
                                                                    {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                                                </span>
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] text-slate-400 font-mono">Código: {st.id_code}</span>
                                                                    {st.isLateEnrollment && (
                                                                        <span 
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-black shadow-2xs"
                                                                            title={`Historial incompleto: Solo tiene notas en ${st.periodsLabel}. Faltan notas de Periodo ${st.missingPeriods.join(', ')}.`}
                                                                        >
                                                                            <Clock size={10} className="text-amber-700" />
                                                                            Ingreso Tardío: {st.periodsShortBadge}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg text-xs">
                                                            Curso {st.grade}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {st.riskScenario === '1_LOST_AND_CRITICAL' ? (
                                                            <div className="space-y-1">
                                                                <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-xl text-[11px] shadow-xs inline-flex items-center gap-1">
                                                                    <AlertTriangle size={12} /> 1 Perdida + {st.critCount} Crítica{st.critCount > 1 ? 's' : ''}
                                                                </span>
                                                                <p className="text-[9.5px] text-amber-800 font-semibold">Si reprueba 1 más, pierde el año</p>
                                                            </div>
                                                        ) : st.riskScenario === '1_LOST_NO_MARGIN' ? (
                                                            <div className="space-y-1">
                                                                <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-xl text-[11px] shadow-xs inline-flex items-center gap-1">
                                                                    <AlertTriangle size={12} /> 1 Materia Ya Perdida
                                                                </span>
                                                                <p className="text-[9.5px] text-amber-800 font-semibold">Sin margen de error en P4</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                <span className="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 font-black rounded-xl text-[11px] shadow-2xs inline-flex items-center gap-1">
                                                                    <AlertCircle size={12} /> {st.critCount} Materias Críticas (&gt;90)
                                                                </span>
                                                                <p className="text-[9.5px] text-amber-800 font-semibold">Debe salvar al menos {st.critCount - 1}</p>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {/* Materia Ya Perdida (si aplica) */}
                                                                {st.lostSubjects.map(ls => (
                                                                    <div 
                                                                        key={ls.name} 
                                                                        className="bg-rose-50 border border-rose-200 text-rose-950 px-2.5 py-1 rounded-xl text-xs"
                                                                        title={`${ls.name}: Ya perdida (Suma ${ls.sum}, faltan ${ls.needed}, déficit -${ls.deficit})`}
                                                                    >
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-black text-rose-900">⚠️ {ls.name} (Ya Perdida): </span>
                                                                            <span className="text-rose-700 font-bold">Suma {ls.sum} • Déficit -{ls.deficit}</span>
                                                                        </div>
                                                                        {ls.periodsCount < 3 && (
                                                                            <div className="text-[9px] text-rose-800 font-bold bg-rose-100/70 px-1.5 py-0.2 rounded mt-0.5 border border-rose-200/80 inline-flex items-center gap-1">
                                                                                <AlertTriangle size={9} className="text-rose-600" />
                                                                                {ls.periodsCount} periodos ({Object.keys(ls.periods).sort().map(p => `P${p}`).join(', ')})
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {/* Materias Críticas que exigen > 90 en P4 */}
                                                                {st.criticalSubjects.map(cs => (
                                                                    <div 
                                                                        key={cs.name} 
                                                                        className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 px-2.5 py-1.5 rounded-xl text-xs shadow-2xs transition"
                                                                        title={`${cs.name}: Suma ${cs.sum} pts. Requiere ${cs.needed} pts en Periodo 4 para aprobar.`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-amber-950">{cs.name}</span>
                                                                            <span className="text-[9.5px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-md">
                                                                                Requiere {cs.needed} pts en P4
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[10px] text-amber-800 mt-0.5">
                                                                            Suma: <strong>{cs.sum} pts</strong> (Máx en P4: 100)
                                                                        </p>
                                                                        {cs.periodsCount < 3 && (
                                                                            <div className="text-[9px] text-amber-800 font-bold bg-amber-100/80 px-1.5 py-0.2 rounded mt-0.5 border border-amber-300/80 inline-flex items-center gap-1">
                                                                                <AlertTriangle size={9} className="text-amber-600" />
                                                                                {cs.periodsCount} periodos ({Object.keys(cs.periods).sort().map(p => `P${p}`).join(', ')})
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {/* Si no tiene materias críticas adicionales (>90), avisar de las restantes */}
                                                                {st.criticalSubjects.length === 0 && (
                                                                    <div className="bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                                                                        <span className="text-[11px] font-medium text-slate-600">
                                                                            Otras {st.recoverableSubjects.length} materias en rango regular (requieren ≤ 90 pts en P4). No puede descuidar ninguna.
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {st.isLateEnrollment && (
                                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-[10.5px] text-amber-900 flex items-start gap-2 mt-2">
                                                                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                                    <div>
                                                                        <span className="font-black text-amber-950">Atención - Ingreso Tardío / Historial Parcial:</span>
                                                                        <p className="text-[10px] text-amber-800/95 mt-0.5 leading-tight">
                                                                            Este alumno registra notas únicamente en <strong>{st.periodsLabel}</strong> (le falta calificar <strong>Periodo {st.missingPeriods.join(' y ')}</strong>). Su condición de riesgo se debe a periodos no cursados o pendientes de homologación institucional.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="space-y-1">
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl font-black text-[11px] bg-amber-500 text-slate-950 shadow-xs">
                                                                ⚠️ RIESGO CRÍTICO
                                                            </span>
                                                            {st.isLateEnrollment ? (
                                                                <div className="space-y-0.5">
                                                                    <span className="inline-block px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-950 rounded-md text-[9px] font-black uppercase">
                                                                        Historial Incompleto
                                                                    </span>
                                                                    <p className="text-[8.5px] text-amber-800 font-semibold">{st.periodsShortBadge}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-[9px] text-amber-800 font-bold">P4 Decisivo</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <Link 
                                                            to={`/admin/boletin-print/${st.id}`}
                                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1 active-press"
                                                            title="Ver Boletín Académico"
                                                        >
                                                            <BookOpen size={12} /> Boletín
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
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
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-50 border border-slate-200 shrink-0">
                                                    <img 
                                                        src={getStudentPhoto(st.photo_url)} 
                                                        alt={st.name} 
                                                        className="w-full h-full object-cover" 
                                                        onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                                    />
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
                                            src="/Escudo1.png" 
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
                                "El Rector y el Consejo Académico del Instituto Nueva América de Suba felicitan con orgullo a los estudiantes que han alcanzado la excelencia académica y disciplinaria en el Grado {targetCourseForPrint}."
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
                                <p className="font-black text-slate-800 uppercase">Rector / Dirección</p>
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
                <div className="space-y-8">
                    {/* Control de Selección de Curso e Impresión de Diplomas */}
                    <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-3xl flex flex-col xl:flex-row xl:items-center justify-between gap-5 shadow-2xl shadow-slate-950/20 relative overflow-hidden print:hidden">
                        <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
                                <Award size={26} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-black tracking-tight text-white font-sans">
                                        Diplomas de Excelencia Académica
                                    </h3>
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                                        Top 3 Oficial
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                                    Generador e impresión de diplomas protocolarios (1°, 2° y 3° Puesto) en formato de alta distinción para Izada de Bandera y cuadro de honor.
                                </p>
                            </div>
                        </div>

                        {/* Selector de Curso y Botón de Impresión */}
                        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
                            <span className="text-xs font-bold text-slate-400 mr-1">Seleccionar Grado:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {coursesList.map(crs => (
                                    <button
                                        key={crs}
                                        onClick={() => setPrintSelectedCourse(crs)}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition active-press ${
                                            targetCourseForPrint === crs
                                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/25 ring-2 ring-amber-300'
                                                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/80 hover:text-white'
                                        }`}
                                    >
                                        Curso {crs}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => window.print()}
                                className="ml-auto xl:ml-3 px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 active-press shrink-0"
                            >
                                <Printer size={16} /> Imprimir Diplomas PDF
                            </button>
                        </div>
                    </div>

                    {/* Generación de los 3 Diplomas de Excelencia por separado */}
                    {topThreeDiplomasPrint.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm">
                            <Award className="mx-auto text-slate-300 mb-3" size={40} />
                            <h4 className="text-base font-bold text-slate-800">No hay estudiantes evaluados en este curso</h4>
                            <p className="text-xs text-slate-500 mt-1">Selecciona otro grado en la barra superior para visualizar e imprimir sus diplomas de honor.</p>
                        </div>
                    ) : (
                        <div className="space-y-14 print:space-y-0">
                            {topThreeDiplomasPrint.map((st, idx) => {
                                const rankNames = [
                                    "PRIMER LUGAR DE EXCELENCIA ACADÉMICA", 
                                    "SEGUNDO LUGAR DE EXCELENCIA ACADÉMICA", 
                                    "TERCER LUGAR DE EXCELENCIA ACADÉMICA"
                                ];
                                const rankMedals = [
                                    "★ PRIMER PUESTO DE HONOR AL MÉRITO ★", 
                                    "★ SEGUNDO PUESTO DE HONOR AL MÉRITO ★", 
                                    "★ TERCER PUESTO DE HONOR AL MÉRITO ★"
                                ];

                                return (
                                    <div 
                                        key={st.id}
                                        className="w-[27.9cm] min-h-[21.6cm] h-[21.6cm] bg-[#fffdfa] p-[1.4cm] shadow-2xl mx-auto relative flex flex-col justify-between overflow-hidden text-slate-900 printable-diploma-page select-none rounded-2xl print:rounded-none border-[3px] border-[#0f172a]"
                                    >
                                        {/* Marco Ornamental Dorado y Guilloché */}
                                        <div className="absolute inset-[0.4cm] border-[2px] border-[#c59b27] pointer-events-none"></div>
                                        <div className="absolute inset-[0.55cm] border border-[#c59b27]/40 border-dashed pointer-events-none"></div>
                                        <div className="absolute inset-[0.75cm] border-[0.5px] border-[#0f172a]/20 pointer-events-none"></div>

                                        {/* Esquinas Ornamentales Victoriana/Académica */}
                                        <DiplomaCornerOrnament position="top-left" />
                                        <DiplomaCornerOrnament position="top-right" />
                                        <DiplomaCornerOrnament position="bottom-left" />
                                        <DiplomaCornerOrnament position="bottom-right" />

                                        {/* Marca de Agua Central del Escudo Institucional */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.038]">
                                            <img src="/Escudo1.png" alt="" className="w-[12.5cm] h-[12.5cm] object-contain filter grayscale" />
                                        </div>

                                        {/* Encabezado Protocolario */}
                                        <div className="relative z-10 flex items-center justify-between border-b border-[#c59b27]/40 pb-3">
                                            <div className="w-[2.5cm] h-[2.5cm] shrink-0 flex items-center justify-center">
                                                {!logoError ? (
                                                    <img 
                                                        src="/Escudo1.png" 
                                                        alt="Escudo Institución" 
                                                        className="w-full h-full object-contain filter drop-shadow-sm"
                                                        onError={() => setLogoError(true)}
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-full bg-slate-900 text-white font-cinzel font-black text-xs flex items-center justify-center border-2 border-[#c59b27]">INAS</div>
                                                )}
                                            </div>

                                            <div className="space-y-0.5 text-center flex-1 px-4">
                                                <p className="font-cinzel text-[9.5px] tracking-[0.28em] font-bold text-slate-500 uppercase">
                                                    REPÚBLICA DE COLOMBIA • SECRETARÍA DE EDUCACIÓN DE BOGOTÁ D.C.
                                                </p>
                                                <h2 className="font-cinzel text-2xl font-black tracking-[0.16em] text-[#0f172a] uppercase leading-tight">
                                                    INSTITUTO NUEVA AMÉRICA DE SUBA
                                                </h2>
                                                <p className="font-serif italic text-[10.5px] text-slate-600 tracking-wide">
                                                    Reconocimiento Oficial de Estudios según Resolución No. 11-0164 de la Secretaría de Educación
                                                </p>
                                                <div className="pt-0.5">
                                                    <span className="font-cinzel text-[9px] font-black tracking-[0.2em] text-[#92400e] bg-amber-50 px-3.5 py-0.5 rounded-full border border-amber-300/80 inline-block uppercase">
                                                        AÑO LECTIVO 2026 • GRADO {targetCourseForPrint}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="w-[2.5cm] h-[2.5cm] shrink-0 flex items-center justify-center">
                                                <DiplomaMedallion rankIndex={idx} />
                                            </div>
                                        </div>

                                        {/* Cuerpo Principal del Diploma */}
                                        <div className="relative z-10 text-center space-y-3 my-auto">
                                            {/* Título de Concesión */}
                                            <div className="space-y-0.5">
                                                <span className="font-cinzel text-[9.5px] tracking-[0.32em] font-bold text-amber-900 uppercase block">
                                                    EL CONSEJO DIRECTIVO Y EL COMITÉ DE EVALUACIÓN ACADÉMICA
                                                </span>
                                                <span className="font-cinzel text-[10.5px] tracking-[0.24em] font-extrabold text-slate-700 uppercase block">
                                                    CONFIEREN EL PRESENTE
                                                </span>
                                                <h1 className="font-cinzel text-[26px] font-black tracking-[0.06em] text-[#0f172a] uppercase leading-none mt-1">
                                                    DIPLOMA DE EXCELENCIA ACADÉMICA
                                                </h1>
                                                <DiplomaFiligreeDivider />
                                            </div>

                                            {/* Destinatario de Honor */}
                                            <div className="space-y-1">
                                                <p className="font-serif italic text-[12px] text-slate-600">
                                                    Otorgado con el más alto mérito, reconocimiento y honor a:
                                                </p>
                                                <h3 className="font-playfair text-[29px] font-black text-[#0f172a] tracking-wide uppercase leading-tight">
                                                    {st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name}
                                                </h3>
                                                <div className="w-56 h-[1.5px] bg-gradient-to-r from-transparent via-[#c59b27] to-transparent mx-auto"></div>
                                                <p className="font-cinzel text-[10px] font-bold text-slate-500 tracking-[0.14em]">
                                                    CÓDIGO ESTUDIANTIL: {st.id_code || st.id}
                                                </p>
                                            </div>

                                            {/* Texto del Laudo Académico */}
                                            <div className="max-w-3xl mx-auto px-6 font-serif text-[12px] leading-[1.65] text-slate-800 text-center">
                                                Por haber obtenido el <strong className="font-bold text-[#0f172a] uppercase">{rankNames[idx]}</strong> con un promedio sobresaliente de <strong className="font-bold text-[#0f172a] underline decoration-[#c59b27] underline-offset-2 text-[13px]">{st.average} puntos</strong> en el <strong className="font-bold text-[#0f172a]">Grado {targetCourseForPrint}</strong> durante el presente año lectivo. Su consagrada disciplina, constancia, excelencia intelectual y testimonio ético enaltecen el buen nombre del <em>Instituto Nueva América de Suba</em>.
                                            </div>

                                            {/* Cinta de Honor al Mérito */}
                                            <div className="pt-0.5">
                                                <span className="font-cinzel text-[10px] font-black tracking-[0.24em] uppercase text-[#78350f] py-1 px-6 border-y border-[#c59b27]/60 bg-gradient-to-r from-transparent via-amber-50/90 to-transparent inline-block">
                                                    {rankMedals[idx]}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Firmas Oficiales y Folio Institucional */}
                                        <div className="pt-6 grid grid-cols-3 items-end text-center relative z-10 border-t border-slate-300/80 mx-4">
                                            <div>
                                                <div className="border-t-[1.5px] border-slate-900 w-44 mx-auto mb-1.5"></div>
                                                <p className="font-cinzel text-[10.5px] font-black text-slate-900 uppercase tracking-wider">EL RECTOR</p>
                                                <p className="font-serif italic text-[9.5px] text-slate-500">Instituto Nueva América de Suba</p>
                                            </div>

                                            <div className="pb-1 text-center font-cinzel text-[8.5px] text-slate-500 tracking-wider space-y-0.5 uppercase">
                                                <p>Bogotá D.C. • Colombia</p>
                                                <p className="text-[8px] text-slate-400 font-semibold tracking-widest">Folio de Honor No. INAS-2026-{targetCourseForPrint}-0{idx + 1}</p>
                                            </div>

                                            <div>
                                                <div className="border-t-[1.5px] border-slate-900 w-44 mx-auto mb-1.5"></div>
                                                <p className="font-cinzel text-[10.5px] font-black text-slate-900 uppercase tracking-wider">COORDINACIÓN ACADÉMICA</p>
                                                <p className="font-serif italic text-[9.5px] text-slate-500">Consejo Académico e Investigaciones</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
