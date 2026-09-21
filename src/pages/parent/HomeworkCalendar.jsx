import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, ClipboardList, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getStudentForUser } from '../../lib/getStudentForUser';
import { getStudentPhoto, DEFAULT_STUDENT_PHOTO } from '../../lib/avatarHelper';

export default function HomeworkCalendar() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [student, setStudent] = useState(null);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Cargar tareas completadas guardadas localmente para el usuario
    useEffect(() => {
        if (!currentUser) return;
        const storedCompleted = localStorage.getItem(`completed_tasks_${currentUser.uid}`);
        if (storedCompleted) {
            try {
                setCompletedTasks(JSON.parse(storedCompleted));
            } catch (e) {
                console.error("Error reading completed tasks from localStorage:", e);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        async function loadHomework() {
            if (!currentUser) return;

            try {
                // 1. Obtener estudiante para saber su curso/grado
                const studentData = await getStudentForUser(db, currentUser);

                if (!studentData) {
                    setLoading(false);
                    return;
                }

                setStudent(studentData);

                // 2. Obtener tareas para el grado del estudiante
                const qTasks = query(
                    collection(db, 'tasks'),
                    where('class_grade', '==', studentData.grade)
                );
                const tSnap = await getDocs(qTasks);
                const list = tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Ordenar por fecha de entrega
                list.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                setTasks(list);
            } catch (error) {
                console.error("Error al cargar tareas:", error);
            } finally {
                setLoading(false);
            }
        }

        loadHomework();
    }, [currentUser]);

    const toggleComplete = (taskId) => {
        let updated;
        if (completedTasks.includes(taskId)) {
            updated = completedTasks.filter(id => id !== taskId);
        } else {
            updated = [...completedTasks, taskId];
        }
        setCompletedTasks(updated);
        localStorage.setItem(`completed_tasks_${currentUser.uid}`, JSON.stringify(updated));
    };

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

    return (
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            {/* Cabecera */}
            <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0 shadow-2xs">
                        <img 
                            src={getStudentPhoto(student.photo_url)} 
                            alt="Student" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                        />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <h2 className="text-base sm:text-lg font-black text-gray-800 truncate leading-tight">
                            Tareas de {student.lastName && student.firstName ? `${student.firstName} ${student.lastName}` : student.name}
                        </h2>
                        <p className="text-xs text-gray-500 truncate mt-0.5">Curso: <strong className="text-gray-700">{student.grade}</strong> | Agenda Escolar</p>
                    </div>
                </div>

                <div className="text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl sm:rounded-full w-full sm:w-auto text-center border border-slate-200/60 shrink-0">
                    {completedTasks.length} de {tasks.length} completadas
                </div>
            </div>

            {/* Listado de tareas */}
            <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-black text-gray-800 px-1 flex items-center gap-2 text-left">
                    <ClipboardList size={18} className="text-indigo-600 shrink-0" /> Deberes y Actividades Pendientes
                </h3>

                {tasks.length === 0 ? (
                    <div className="text-center py-10 sm:py-12 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 text-gray-500 text-xs sm:text-sm p-4">
                        ¡Excelente! No hay tareas registradas para el grado {student.grade}.
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        {tasks.map((task) => {
                            const isCompleted = completedTasks.includes(task.id);
                            const dueDate = new Date(task.due_date);
                            const isOverdue = !isCompleted && dueDate < new Date().setHours(0,0,0,0);

                            return (
                                <div 
                                    key={task.id} 
                                    className={`bg-white rounded-2xl sm:rounded-3xl border p-4 sm:p-5 shadow-sm transition hover:shadow-md flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start text-left ${
                                        isCompleted ? 'border-emerald-200 bg-emerald-50/20' : isOverdue ? 'border-rose-200 bg-rose-50/20' : 'border-gray-100'
                                    }`}
                                >
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                                {task.subject}
                                            </span>
                                            {isCompleted ? (
                                                <span className="text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> Completada
                                                </span>
                                            ) : isOverdue ? (
                                                <span className="text-[10px] sm:text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <AlertCircle size={12} /> Vencida
                                                </span>
                                            ) : (
                                                <span className="text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Clock size={12} /> Pendiente
                                                </span>
                                            )}
                                        </div>

                                        <h4 className={`text-sm sm:text-base font-black text-gray-800 leading-snug ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                                            {task.title}
                                        </h4>
                                        
                                        <p className={`text-xs sm:text-sm leading-relaxed ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {task.description}
                                        </p>

                                        <p className="text-[11px] sm:text-xs text-gray-500 font-semibold flex items-center gap-1.5 pt-0.5">
                                            <Clock size={12} className="text-gray-400 shrink-0" />
                                            Entrega: {dueDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => toggleComplete(task.id)}
                                        className={`w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[42px] touch-target active-press ${
                                            isCompleted 
                                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200' 
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                        }`}
                                    >
                                        <CheckCircle2 size={15} />
                                        {isCompleted ? 'Marcar Pendiente' : 'Marcar Completada'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
