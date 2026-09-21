import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { Loader2, Award, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

import { getStudentForUser } from '../../lib/getStudentForUser';
import { getStudentPhoto, DEFAULT_STUDENT_PHOTO } from '../../lib/avatarHelper';

export default function GradesCard() {
    const { studentId } = useParams();
    const { currentUser, userRole } = useAuth();
    const [grades, setGrades] = useState([]);
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedGradeId, setExpandedGradeId] = useState(null);

    const toggleExpand = (id) => {
        setExpandedGradeId(expandedGradeId === id ? null : id);
    };

    useEffect(() => {
        async function loadGrades() {
            if (!currentUser) return;

            try {
                let studentData = null;
                const canViewAnyStudent = userRole === 'admin' || userRole === 'teacher';

                if (studentId && canViewAnyStudent) {
                    // Cargar estudiante por ID directamente (exclusivo para directivos / profesores)
                    const sDoc = await getDoc(doc(db, 'students', studentId));
                    if (sDoc.exists()) {
                        studentData = { id: sDoc.id, ...sDoc.data() };
                    }
                } else {
                    // Para padres y estudiantes: estrictamente su propio alumno vinculado (Protección de datos Ley 1581)
                    studentData = await getStudentForUser(db, currentUser);
                }

                if (!studentData) {
                    setLoading(false);
                    return;
                }

                setStudent(studentData);

                // 2. Obtener las calificaciones del estudiante
                const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentData.id));
                const gSnap = await getDocs(qGrades);
                setGrades(gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error al cargar calificaciones:", error);
            } finally {
                setLoading(false);
            }
        }

        loadGrades();
    }, [currentUser, studentId]);

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    if (!student) {
        return (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm max-w-xl mx-auto">
                <AlertCircle className="mx-auto text-yellow-500 mb-2" size={40} />
                <p className="text-gray-600 font-medium">No tienes ningún alumno asociado a tu cuenta.</p>
            </div>
        );
    }

    // Agrupar calificaciones por materia
    const gradesBySubject = grades.reduce((acc, current) => {
        const { subject } = current;
        if (!acc[subject]) {
            acc[subject] = [];
        }
        acc[subject].push(current);
        return acc;
    }, {});

    // Calcular promedio general
    const totalGrades = grades.map(g => Number(g.grade));
    const overallAverage = totalGrades.length > 0 
        ? (totalGrades.reduce((sum, g) => sum + g, 0) / totalGrades.length).toFixed(2)
        : null;

    return (
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            {/* Encabezado del Boletín */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-white/80 overflow-hidden bg-white shrink-0 shadow-md">
                        <img 
                            src={getStudentPhoto(student.photo_url)} 
                            alt="Student" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                        />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <h2 className="text-base sm:text-xl font-black truncate leading-tight">
                            {student.lastName && student.firstName 
                                ? `${student.lastName} ${student.firstName}` 
                                : student.name}
                        </h2>
                        <p className="text-blue-100 text-xs sm:text-sm font-medium mt-0.5 truncate">Curso: <strong className="text-white">{student.grade}</strong> | Boletín Oficial</p>
                    </div>
                </div>

                {overallAverage && (
                    <div className="w-full sm:w-auto bg-white/10 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl border border-white/20 flex sm:flex-col justify-between items-center text-center">
                        <p className="text-[10px] sm:text-xs text-blue-100 uppercase tracking-wider font-bold">Promedio General</p>
                        <p className="text-2xl sm:text-3xl font-black">{overallAverage}</p>
                    </div>
                )}
            </div>

            {/* Listado de Materias */}
            <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-black text-gray-800 px-1 flex items-center gap-2 text-left">
                    <BookOpen size={18} className="text-indigo-600 shrink-0" /> Rendimiento por Asignatura
                </h3>

                {Object.keys(gradesBySubject).length === 0 ? (
                    <div className="text-center py-10 sm:py-12 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 text-gray-500 text-xs sm:text-sm p-4">
                        Aún no se han registrado calificaciones para este periodo académico.
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        {Object.entries(gradesBySubject).map(([subject, subjectGrades]) => {
                            const totalPoints = subjectGrades.reduce((sum, g) => sum + Number(g.grade || 0), 0);
                            const maxPeriod = Math.max(...subjectGrades.map(g => Number(g.period) || 1), 1);
                            const expectedTarget = maxPeriod * 75;
                            const isPassingSoFar = totalPoints >= expectedTarget;
                            const remainingPeriods = Math.max(0, 4 - maxPeriod);
                            const progressPct = Math.min(100, Math.round((totalPoints / 300) * 100));

                            return (
                                <div key={subject} className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                                    {/* Encabezado de Materia y Barra hacia los 300 Puntos */}
                                    <div className="bg-slate-50/80 px-3.5 sm:px-5 py-3 sm:py-4 border-b space-y-2.5 text-left">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <h4 className="font-black text-slate-800 text-sm sm:text-base leading-tight">{subject}</h4>
                                                <p className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
                                                    Meta Anual: <strong className="text-slate-700">300 pts</strong> • Meta Periodo {maxPeriod}: <strong className="text-slate-700">{expectedTarget} pts</strong>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                                <span className={`text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-1 rounded-xl shadow-2xs border ${
                                                    isPassingSoFar 
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                                        : 'bg-rose-50 text-rose-800 border-rose-200'
                                                }`}>
                                                    {totalPoints} / 300 PUNTOS
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Progreso hacia los 300 Puntos */}
                                        <div className="space-y-1">
                                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        isPassingSoFar ? 'bg-indigo-600' : 'bg-rose-500'
                                                    }`}
                                                    style={{ width: `${progressPct}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-[8px] sm:text-[9px] font-bold text-slate-400 tracking-tight">
                                                <span>0 pts</span>
                                                <span>P1: 75</span>
                                                <span>P2: 150</span>
                                                <span>P3: 225</span>
                                                <span className="text-indigo-600 font-black">Meta: 300 pts</span>
                                            </div>
                                        </div>

                                        {/* Mensaje inteligente para la familia */}
                                        <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold flex items-start sm:items-center gap-2 leading-snug ${
                                            isPassingSoFar 
                                                ? 'bg-emerald-50/70 text-emerald-900 border border-emerald-100' 
                                                : 'bg-rose-50/70 text-rose-900 border border-rose-100'
                                        }`}>
                                            {remainingPeriods > 0 ? (
                                                isPassingSoFar ? (
                                                    <>
                                                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span>
                                                            ¡Excelente ritmo! Lleva <strong>{totalPoints} pts</strong> (+{totalPoints - expectedTarget} sobre la meta de {expectedTarget} pts a Periodo {maxPeriod}).
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span>
                                                            Lleva <strong>{totalPoints} pts</strong> (le faltan <strong>{expectedTarget - totalPoints} pts</strong> para alcanzar la meta de {expectedTarget} pts a Periodo {maxPeriod}).
                                                        </span>
                                                    </>
                                                )
                                            ) : (
                                                totalPoints >= 300 ? (
                                                    <>
                                                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span>🏆 <strong>Aprobó la Asignatura</strong> con un acumulado anual de {totalPoints} / 300 puntos (+{totalPoints - 300} pts).</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                                                        <span>❌ <strong>Reprobó la Asignatura</strong>: acumuló {totalPoints} pts (le faltaron {300 - totalPoints} pts para los 300 requeridos).</span>
                                                    </>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Calificaciones del periodo */}
                                    <div className="p-3 sm:p-5 divide-y divide-gray-100">
                                        {subjectGrades.map((gradeDoc) => {
                                            const isExpanded = expandedGradeId === gradeDoc.id;
                                            return (
                                                <div key={gradeDoc.id} className="py-2.5 sm:py-3.5 first:pt-0 last:pb-0">
                                                    <div 
                                                        onClick={() => toggleExpand(gradeDoc.id)}
                                                        className="flex justify-between items-start gap-2.5 text-xs sm:text-sm cursor-pointer hover:bg-slate-50/70 p-2 sm:p-2.5 rounded-xl transition-all touch-target"
                                                    >
                                                        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1 text-left">
                                                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                                <span className="font-bold text-gray-800">Periodo {gradeDoc.period || 1}</span>
                                                                <span className="text-[10px] sm:text-xs text-gray-400">
                                                                    {gradeDoc.created_at?.seconds 
                                                                        ? new Date(gradeDoc.created_at.seconds * 1000).toLocaleDateString()
                                                                        : 'Fecha reciente'}
                                                                </span>
                                                                <span className="text-[10px] text-indigo-600 font-bold select-none">
                                                                    {isExpanded ? '(Ocultar)' : '(Ver desglose)'}
                                                                </span>
                                                            </div>
                                                            {gradeDoc.comment && (
                                                                <p className="text-gray-500 italic text-[11px] sm:text-xs">
                                                                    &ldquo;{gradeDoc.comment}&rdquo;
                                                                </p>
                                                            )}
                                                        </div>

                                                        <span className={`font-black text-xs sm:text-sm px-2.5 py-1 rounded-xl shrink-0 ${
                                                            Number(gradeDoc.grade) >= 75 
                                                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60' 
                                                                : 'text-rose-700 bg-rose-50 border border-rose-200/60'
                                                        }`}>
                                                            {Number(gradeDoc.grade).toFixed(0)} / 100
                                                        </span>
                                                    </div>

                                                    {/* Desglose de componentes Mobile-First 5 cols fluidas */}
                                                    {isExpanded && (
                                                        <div className="mt-2 p-2.5 sm:p-3 bg-slate-50/80 rounded-2xl border border-slate-100/70 text-xs space-y-1.5 animate-fade-in shadow-inner-soft">
                                                            <p className="font-bold text-slate-500 uppercase tracking-wider text-[8.5px] sm:text-[9px] px-1 text-left">Desglose de Componentes (20 pts c/u):</p>
                                                            <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center">
                                                                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-100 shadow-2xs">
                                                                    <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold truncate">Prueba 1</p>
                                                                    <p className="text-xs sm:text-sm font-black text-slate-700 mt-0.5">{gradeDoc.components?.prueba1 !== undefined ? gradeDoc.components.prueba1 : '-'}</p>
                                                                    <span className="text-[7.5px] text-slate-400 font-medium">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-100 shadow-2xs">
                                                                    <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold truncate">Prueba 2</p>
                                                                    <p className="text-xs sm:text-sm font-black text-slate-700 mt-0.5">{gradeDoc.components?.prueba2 !== undefined ? gradeDoc.components.prueba2 : '-'}</p>
                                                                    <span className="text-[7.5px] text-slate-400 font-medium">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-100 shadow-2xs">
                                                                    <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold truncate">Guía</p>
                                                                    <p className="text-xs sm:text-sm font-black text-slate-700 mt-0.5">{gradeDoc.components?.guia !== undefined ? gradeDoc.components.guia : '-'}</p>
                                                                    <span className="text-[7.5px] text-slate-400 font-medium">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-100 shadow-2xs">
                                                                    <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold truncate">Ejercit.</p>
                                                                    <p className="text-xs sm:text-sm font-black text-slate-700 mt-0.5">{gradeDoc.components?.ejercitacion !== undefined ? gradeDoc.components.ejercitacion : '-'}</p>
                                                                    <span className="text-[7.5px] text-slate-400 font-medium">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-100 shadow-2xs">
                                                                    <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold truncate">Actitud.</p>
                                                                    <p className="text-xs sm:text-sm font-black text-slate-700 mt-0.5">{gradeDoc.components?.actitudinal !== undefined ? gradeDoc.components.actitudinal : '-'}</p>
                                                                    <span className="text-[7.5px] text-slate-400 font-medium">/ 20</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
