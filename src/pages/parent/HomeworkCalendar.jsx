import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, ClipboardList, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function HomeworkCalendar() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [student, setStudent] = useState(null);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Cargar las tareas completadas locales de localStorage
        const stored = localStorage.getItem(`completed_tasks_${currentUser?.uid}`);
        if (stored) {
            setCompletedTasks(JSON.parse(stored));
        }
    }, [currentUser]);

    useEffect(() => {
        async function loadHomework() {
            if (!currentUser) return;

            try {
                // 1. Obtener estudiante para saber su curso/grado (ej. "9A")
                const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                const sSnap = await getDocs(qStudent);

                if (sSnap.empty) {
                    setLoading(false);
                    return;
                }

                const studentDoc = sSnap.docs[0];
                const studentData = studentDoc.data();
                setStudent({ id: studentDoc.id, ...studentData });

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
        <div className="max-w-2xl mx-auto">
            {/* Cabecera */}
            <div className="bg-white border rounded-2xl p-5 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                        <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Tareas de {student.name}</h2>
                        <p className="text-sm text-gray-500">Curso: {student.grade} | Control Académico</p>
                    </div>
                </div>

                <div className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                    {completedTasks.length} de {tasks.length} completadas
                </div>
            </div>

            {/* Listado de tareas */}
            <h3 className="text-lg font-bold text-gray-800 mb-4 px-1 flex items-center gap-2">
                <ClipboardList size={20} className="text-primary" /> Deberes y Actividades Pendientes
            </h3>

            {tasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-500">
                    ¡Excelente! No hay tareas registradas para el grado {student.grade}.
                </div>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => {
                        const isCompleted = completedTasks.includes(task.id);
                        const dueDate = new Date(task.due_date);
                        const isOverdue = !isCompleted && dueDate < new Date().setHours(0,0,0,0);

                        return (
                            <div 
                                key={task.id} 
                                className={`bg-white rounded-2xl border p-5 shadow-sm transition hover:shadow-md flex flex-col sm:flex-row gap-4 justify-between items-start ${
                                    isCompleted ? 'border-green-200 bg-green-50/10' : isOverdue ? 'border-red-200 bg-red-50/10' : 'border-gray-100'
                                }`}
                            >
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                            {task.subject}
                                        </span>
                                        {isCompleted ? (
                                            <span className="text-xs font-semibold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                <CheckCircle2 size={12} /> Completada
                                            </span>
                                        ) : isOverdue ? (
                                            <span className="text-xs font-semibold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertCircle size={12} /> Vencida
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                                <Clock size={12} /> Pendiente
                                            </span>
                                        )}
                                    </div>

                                    <h4 className={`text-base font-bold text-gray-800 ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                                        {task.title}
                                    </h4>
                                    
                                    <p className={`text-sm leading-relaxed ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {task.description}
                                    </p>

                                    <p className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                                        Entrega: {dueDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>

                                <button
                                    onClick={() => toggleComplete(task.id)}
                                    className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                        isCompleted 
                                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                >
                                    <CheckCircle2 size={16} />
                                    {isCompleted ? 'Marcar Pendiente' : 'Marcar Completada'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
