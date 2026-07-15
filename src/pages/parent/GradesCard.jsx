import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { Loader2, Award, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function GradesCard() {
    const { studentId } = useParams();
    const { currentUser } = useAuth();
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

                if (studentId) {
                    // Cargar estudiante por ID directamente (para administrador / profesor)
                    const sDoc = await getDoc(doc(db, 'students', studentId));
                    if (sDoc.exists()) {
                        studentData = { id: sDoc.id, ...sDoc.data() };
                    }
                } else {
                    // 1. Obtener el estudiante del padre
                    const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                    const sSnap = await getDocs(qStudent);

                    if (!sSnap.empty) {
                        const studentDoc = sSnap.docs[0];
                        studentData = { id: studentDoc.id, ...studentDoc.data() };
                    }
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
        <div className="max-w-2xl mx-auto">
            {/* Encabezado del Boletín */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-white shrink-0">
                        <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">
                            {student.lastName && student.firstName 
                                ? `${student.lastName} ${student.firstName}` 
                                : student.name}
                        </h2>
                        <p className="text-blue-100 text-sm font-medium">Curso: {student.grade} | Boletín de Calificaciones</p>
                    </div>
                </div>

                {overallAverage && (
                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20 text-center">
                        <p className="text-xs text-blue-100 uppercase tracking-wider font-semibold">Promedio General</p>
                        <p className="text-3xl font-extrabold">{overallAverage}</p>
                    </div>
                )}
            </div>

            {/* Listado de Materias */}
            <h3 className="text-lg font-bold text-gray-800 mb-4 px-1 flex items-center gap-2">
                <BookOpen size={20} className="text-primary" /> Rendimiento por Asignatura
            </h3>
            {Object.keys(gradesBySubject).length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-500">
                    Aún no se han registrado calificaciones para este periodo académico.
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(gradesBySubject).map(([subject, subjectGrades]) => {
                        const subjectAverage = (subjectGrades.reduce((sum, g) => sum + Number(g.grade), 0) / subjectGrades.length).toFixed(1);
                        const isPassing = Number(subjectAverage) >= 75;

                        return (
                            <div key={subject} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                                {/* Título de materia y promedio de materia */}
                                <div className="bg-gray-50 px-5 py-4 border-b flex justify-between items-center">
                                    <h4 className="font-bold text-gray-800 text-base">{subject}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500">Promedio de materia:</span>
                                        <span className={`text-sm font-extrabold px-3 py-0.5 rounded-full ${
                                            isPassing ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {subjectAverage} / 100
                                        </span>
                                    </div>
                                </div>

                                {/* Calificaciones del periodo */}
                                <div className="p-5 divide-y divide-gray-100">
                                    {subjectGrades.map((gradeDoc) => {
                                        const isExpanded = expandedGradeId === gradeDoc.id;
                                        return (
                                            <div key={gradeDoc.id} className="py-3.5 first:pt-0 last:pb-0">
                                                <div 
                                                    onClick={() => toggleExpand(gradeDoc.id)}
                                                    className="flex justify-between items-start gap-4 text-sm cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-all"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-700">Periodo {gradeDoc.period || 1}</span>
                                                            <span className="text-xs text-gray-400">
                                                                {gradeDoc.created_at?.seconds 
                                                                    ? new Date(gradeDoc.created_at.seconds * 1000).toLocaleDateString()
                                                                    : 'Fecha no registrada'}
                                                            </span>
                                                            <span className="text-[10px] text-indigo-600 font-bold hover:underline select-none">
                                                                {isExpanded ? '(Ocultar detalle)' : '(Ver detalle)'}
                                                            </span>
                                                        </div>
                                                        {gradeDoc.comment && (
                                                            <p className="text-gray-500 italic text-xs">
                                                                &ldquo;{gradeDoc.comment}&rdquo;
                                                            </p>
                                                        )}
                                                    </div>

                                                    <span className={`font-bold text-sm px-2.5 py-0.5 rounded-full ${
                                                        Number(gradeDoc.grade) >= 75 
                                                            ? 'text-green-700 bg-green-50' 
                                                            : 'text-red-700 bg-red-50'
                                                    }`}>
                                                        {Number(gradeDoc.grade).toFixed(0)} / 100
                                                    </span>
                                                </div>

                                                {/* Desglose de componentes */}
                                                {isExpanded && (
                                                    <div className="mt-2.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-100/50 text-xs space-y-2 animate-fade-in shadow-inner-soft">
                                                        <p className="font-bold text-slate-500 uppercase tracking-wider text-[9px] mb-1.5 px-1">Desglose de Componentes:</p>
                                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] text-slate-400 font-bold">Prueba 1 (20%)</p>
                                                                <p className="text-sm font-extrabold text-slate-700 mt-0.5">{gradeDoc.components?.prueba1 !== undefined ? gradeDoc.components.prueba1 : 'N/A'}</p>
                                                                <span className="text-[8px] text-slate-400">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] text-slate-400 font-bold">Prueba 2 (20%)</p>
                                                                <p className="text-sm font-extrabold text-slate-700 mt-0.5">{gradeDoc.components?.prueba2 !== undefined ? gradeDoc.components.prueba2 : 'N/A'}</p>
                                                                <span className="text-[8px] text-slate-400">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] text-slate-400 font-bold">Guía (20%)</p>
                                                                <p className="text-sm font-extrabold text-slate-700 mt-0.5">{gradeDoc.components?.guia !== undefined ? gradeDoc.components.guia : 'N/A'}</p>
                                                                <span className="text-[8px] text-slate-400">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] text-slate-400 font-bold">Ejercitación (20%)</p>
                                                                <p className="text-sm font-extrabold text-slate-700 mt-0.5">{gradeDoc.components?.ejercitacion !== undefined ? gradeDoc.components.ejercitacion : 'N/A'}</p>
                                                                <span className="text-[8px] text-slate-400">/ 20</span>
                                                                </div>
                                                                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] text-slate-400 font-bold">Actitudinal (20%)</p>
                                                                <p className="text-sm font-extrabold text-slate-700 mt-0.5">{gradeDoc.components?.actitudinal !== undefined ? gradeDoc.components.actitudinal : 'N/A'}</p>
                                                                <span className="text-[8px] text-slate-400">/ 20</span>
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
    );
}
