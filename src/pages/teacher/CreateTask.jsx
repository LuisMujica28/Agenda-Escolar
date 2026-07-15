import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Save } from 'lucide-react';

const SUBJECTS = [
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

export default function CreateTask() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [grade, setGrade] = useState('601'); // Default grade fallback
    const [grades, setGrades] = useState(['601', '602', '701', '801', '802', '901', '1001', '1101']); // Available grades
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadGrades() {
            try {
                const cSnap = await getDocs(collection(db, 'courses'));
                let uniqueGrades = [];
                if (!cSnap.empty) {
                    uniqueGrades = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                } else {
                    const snap = await getDocs(collection(db, 'students'));
                    const list = snap.docs.map(d => d.data().grade).filter(Boolean);
                    uniqueGrades = Array.from(new Set(list));
                    for (const c of uniqueGrades) {
                        await setDoc(doc(db, 'courses', c), { created_at: new Date() });
                    }
                    uniqueGrades.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                }
                setGrades(uniqueGrades);
                if (uniqueGrades.length > 0 && !uniqueGrades.includes(grade)) {
                    setGrade(uniqueGrades[0]);
                }
            } catch (e) {
                console.error("Error al cargar grados de los alumnos:", e);
            }
        }
        loadGrades();
    }, []);
    
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        if (!title || !description || !subject || !dueDate) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'tasks'), {
                title,
                description,
                subject,
                class_grade: grade,
                due_date: dueDate,
                teacher_id: currentUser.uid,
                created_at: serverTimestamp()
            });

            alert('Tarea publicada con éxito para el curso ' + grade);
            navigate('/');
        } catch (error) {
            console.error("Error al publicar tarea:", error);
            alert("No se pudo publicar la tarea.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border shadow-sm mt-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-3">
                <ClipboardList className="text-primary" size={28} />
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Publicar Nueva Tarea</h2>
                    <p className="text-xs text-gray-500">Asignar actividades para los cursos escolares</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Título de la Tarea</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ej: Taller de Álgebra Lineal"
                        required
                        className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Asignatura</label>
                        <select
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            required
                            className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
                        >
                            {SUBJECTS.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Grado / Curso</label>
                        <select
                            value={grade}
                            onChange={e => setGrade(e.target.value)}
                            className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
                        >
                            {grades.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Fecha Límite de Entrega</label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        required
                        className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Descripción / Indicaciones</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Escribe detalladamente las instrucciones y los materiales necesarios..."
                        required
                        className="w-full border rounded-xl p-2.5 text-sm h-32 focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                    {loading ? 'Publicando...' : <><Save size={18} /> Publicar Tarea</>}
                </button>
            </form>
        </div>
    );
}
