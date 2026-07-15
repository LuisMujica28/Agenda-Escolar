import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Save, UserCheck, Award, FileText, ChevronLeft } from 'lucide-react';

export default function LogEntry() {
    const { studentId } = useParams();
    const [student, setStudent] = useState(null);
    const [activeTab, setActiveTab] = useState('observer'); // observer, attendance, grades
    const [loading, setLoading] = useState(false);
    
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // 1. Estados para Observador
    const [obsType, setObsType] = useState('NOTE'); // NOTE, ALERT, CONGRATS
    const [obsContent, setObsContent] = useState('');

    // 2. Estados para Asistencia
    const [attStatus, setAttStatus] = useState('PRESENT'); // PRESENT, ABSENT, LATE, EXCUSED
    const [attNote, setAttNote] = useState('');
    const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);

    // 3. Estados para Calificaciones
    const [gradeSubject, setGradeSubject] = useState('Matemáticas');
    const [gradePeriod, setGradePeriod] = useState('1');
    const [gradeComment, setGradeComment] = useState('');
    const [compActitudinal, setCompActitudinal] = useState('');
    const [compPrueba1, setCompPrueba1] = useState('');
    const [compEjercitacion, setCompEjercitacion] = useState('');
    const [compPrueba2, setCompPrueba2] = useState('');
    const [compGuia, setCompGuia] = useState('');

    const totalGrade = (Number(compActitudinal) || 0) + 
                         (Number(compPrueba1) || 0) + 
                         (Number(compEjercitacion) || 0) + 
                         (Number(compPrueba2) || 0) + 
                         (Number(compGuia) || 0);

    useEffect(() => {
        async function loadStudent() {
            try {
                const s = await getDoc(doc(db, 'students', studentId));
                if (s.exists()) setStudent({ id: s.id, ...s.data() });
            } catch (error) {
                console.error("Error al cargar datos del alumno:", error);
            }
        }
        loadStudent();
    }, [studentId]);

    // Guardar Observador
    async function handleSaveObserver(e) {
        e.preventDefault();
        if (!obsContent) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'observation_logs'), {
                student_id: studentId,
                author_id: currentUser.uid,
                type: obsType,
                content: obsContent,
                created_at: serverTimestamp(),
                read_by_parents: false
            });
            alert("Anotación guardada en el observador");
            setObsContent('');
            navigate('/teacher/search');
        } catch (error) {
            console.error(error);
            alert("Error al guardar anotación");
        } finally {
            setLoading(false);
        }
    }

    // Guardar Asistencia
    async function handleSaveAttendance(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const selectedDate = new Date(attDate + 'T12:00:00'); // Evitar desfase de zona horaria
            await addDoc(collection(db, 'attendance'), {
                student_id: studentId,
                teacher_id: currentUser.uid,
                status: attStatus,
                excuse_note: attStatus === 'PRESENT' ? '' : attNote,
                date: selectedDate,
                created_at: serverTimestamp()
            });
            alert("Asistencia registrada correctamente");
            setAttNote('');
            navigate('/teacher/search');
        } catch (error) {
            console.error(error);
            alert("Error al registrar asistencia");
        } finally {
            setLoading(false);
        }
    }

    // Guardar Calificaciones
    async function handleSaveGrades(e) {
        e.preventDefault();
        
        const actitudinal = Number(compActitudinal);
        const prueba1 = Number(compPrueba1);
        const ejercitacion = Number(compEjercitacion);
        const prueba2 = Number(compPrueba2);
        const guia = Number(compGuia);

        const validateScore = (val) => !isNaN(val) && val >= 0 && val <= 20;

        if (!validateScore(actitudinal) || !validateScore(prueba1) || !validateScore(ejercitacion) || !validateScore(prueba2) || !validateScore(guia)) {
            alert("Cada componente de la nota debe ser un número entre 0 y 20 puntos.");
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, 'grades'), {
                student_id: studentId,
                teacher_id: currentUser.uid,
                subject: gradeSubject,
                grade: totalGrade,
                components: {
                    actitudinal,
                    prueba1,
                    ejercitacion,
                    prueba2,
                    guia
                },
                period: Number(gradePeriod),
                comment: gradeComment,
                created_at: serverTimestamp()
            });
            alert(`Calificación registrada con éxito. Total: ${totalGrade} puntos.`);
            setCompActitudinal('');
            setCompPrueba1('');
            setCompEjercitacion('');
            setCompPrueba2('');
            setCompGuia('');
            setGradeComment('');
            navigate('/teacher/search');
        } catch (error) {
            console.error(error);
            alert("Error al registrar calificación");
        } finally {
            setLoading(false);
        }
    }

    if (!student) return <div className="p-8 text-center">Cargando alumno...</div>;

    return (
        <div className="max-w-lg mx-auto bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* Header del Alumno */}
            <div className="bg-gray-50 border-b p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/teacher/search')} 
                        className="text-gray-500 hover:text-gray-700 p-1 bg-white border rounded-lg shadow-sm transition"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">
                            {student.lastName && student.firstName 
                                ? `${student.lastName} ${student.firstName}` 
                                : student.name}
                        </h2>
                        <p className="text-xs text-gray-500">Curso: {student.grade} | Gestionar Historial</p>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                    <img src={student.photo_url} alt="student" className="w-full h-full object-cover" />
                </div>
            </div>

            {/* Pestañas de Gestión */}
            <div className="flex border-b text-sm font-semibold text-gray-500 bg-gray-50/50">
                <button
                    onClick={() => setActiveTab('observer')}
                    className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                        activeTab === 'observer' ? 'border-primary text-primary bg-white' : 'border-transparent hover:text-gray-700'
                    }`}
                >
                    <FileText size={16} /> Observador
                </button>
                <button
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                        activeTab === 'attendance' ? 'border-primary text-primary bg-white' : 'border-transparent hover:text-gray-700'
                    }`}
                >
                    <UserCheck size={16} /> Asistencia
                </button>
                <button
                    onClick={() => setActiveTab('grades')}
                    className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                        activeTab === 'grades' ? 'border-primary text-primary bg-white' : 'border-transparent hover:text-gray-700'
                    }`}
                >
                    <Award size={16} /> Notas
                </button>
            </div>

            {/* Contenido según pestaña */}
            <div className="p-6">
                
                {/* 1. Formulario del Observador */}
                {activeTab === 'observer' && (
                    <form onSubmit={handleSaveObserver} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Novedad</label>
                            <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                                {[
                                    { id: 'NOTE', label: 'Nota Informativa', color: 'bg-gray-100 peer-checked:bg-gray-200 text-gray-800' },
                                    { id: 'ALERT', label: 'Llamado de Atención', color: 'bg-red-50 peer-checked:bg-red-200 text-red-700 border-red-100' },
                                    { id: 'CONGRATS', label: 'Mérito Académico', color: 'bg-green-50 peer-checked:bg-green-200 text-green-700 border-green-100' },
                                ].map(opt => (
                                    <label key={opt.id} className="cursor-pointer">
                                        <input
                                            type="radio"
                                            name="type"
                                            value={opt.id}
                                            checked={obsType === opt.id}
                                            onChange={e => setObsType(e.target.value)}
                                            className="peer sr-only"
                                        />
                                        <div className={`text-center py-2.5 rounded-xl border transition ${opt.color} peer-checked:ring-2 peer-checked:ring-offset-1`}>
                                            {opt.label}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Descripción del Evento</label>
                            <textarea
                                className="w-full border rounded-xl p-3 h-32 outline-none focus:ring-2 focus:ring-primary text-sm"
                                placeholder="Escribe el reporte sobre la conducta, participación o situación del estudiante..."
                                value={obsContent}
                                onChange={e => setObsContent(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition text-sm disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : <><Save size={18} /> Guardar Novedad</>}
                        </button>
                    </form>
                )}

                {/* 2. Formulario de Asistencia */}
                {activeTab === 'attendance' && (
                    <form onSubmit={handleSaveAttendance} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={attDate}
                                    onChange={e => setAttDate(e.target.value)}
                                    required
                                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Estado de Asistencia</label>
                                <select
                                    value={attStatus}
                                    onChange={e => setAttStatus(e.target.value)}
                                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
                                >
                                    <option value="PRESENT">Presente</option>
                                    <option value="LATE">Llegada Tarde</option>
                                    <option value="ABSENT">Inasistencia</option>
                                    <option value="EXCUSED">Falta Justificada</option>
                                </select>
                            </div>
                        </div>

                        {attStatus !== 'PRESENT' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Observación / Justificación</label>
                                <textarea
                                    className="w-full border rounded-xl p-3 h-24 outline-none focus:ring-2 focus:ring-primary text-sm"
                                    placeholder="Indique la causa de la inasistencia o retraso si es conocida..."
                                    value={attNote}
                                    onChange={e => setAttNote(e.target.value)}
                                    required={attStatus === 'EXCUSED'}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition text-sm disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : <><Save size={18} /> Registrar Asistencia</>}
                        </button>
                    </form>
                )}

                {/* 3. Formulario de Calificaciones */}
                {activeTab === 'grades' && (
                    <form onSubmit={handleSaveGrades} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Asignatura</label>
                                <select
                                    value={gradeSubject}
                                    onChange={e => setGradeSubject(e.target.value)}
                                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
                                >
                                    <option value="Artes plásticas">Artes plásticas</option>
                                    <option value="C. Naturales (Biología)">C. Naturales (Biología)</option>
                                    <option value="C. Naturales (Física)">C. Naturales (Física)</option>
                                    <option value="C Naturales (Química)">C Naturales (Química)</option>
                                    <option value="C Sociales Filosofía">C Sociales Filosofía</option>
                                    <option value="C Políticas Económicas">C Políticas Económicas</option>
                                    <option value="Ed Ética y Valores">Ed Ética y Valores</option>
                                    <option value="Ed Física">Ed Física</option>
                                    <option value="Ed Religiosa y Moral">Ed Religiosa y Moral</option>
                                    <option value="Tecnología e Informática">Tecnología e Informática</option>
                                    <option value="Español y Literatura">Español y Literatura</option>
                                    <option value="Inglés">Inglés</option>
                                    <option value="Matemáticas">Matemáticas</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Periodo Escolar</label>
                                <select
                                    value={gradePeriod}
                                    onChange={e => setGradePeriod(e.target.value)}
                                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
                                >
                                    <option value="1">Periodo 1</option>
                                    <option value="2">Periodo 2</option>
                                    <option value="3">Periodo 3</option>
                                    <option value="4">Periodo 4</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Desglose de Calificación (Máx 20 pts c/u)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Prueba 1</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={compPrueba1}
                                        onChange={e => setCompPrueba1(e.target.value)}
                                        required
                                        className="w-full border rounded-xl p-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Prueba 2</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={compPrueba2}
                                        onChange={e => setCompPrueba2(e.target.value)}
                                        required
                                        className="w-full border rounded-xl p-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Guía</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={compGuia}
                                        onChange={e => setCompGuia(e.target.value)}
                                        required
                                        className="w-full border rounded-xl p-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Ejercitación</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={compEjercitacion}
                                        onChange={e => setCompEjercitacion(e.target.value)}
                                        required
                                        className="w-full border rounded-xl p-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Actitudinal</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={compActitudinal}
                                        onChange={e => setCompActitudinal(e.target.value)}
                                        required
                                        className="w-full border rounded-xl p-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0-20"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex justify-between items-center text-indigo-900">
                            <span className="text-xs font-bold uppercase tracking-wider">Total Acumulado:</span>
                            <div className="text-right">
                                <span className="text-2xl font-extrabold">{totalGrade}</span>
                                <span className="text-sm font-semibold text-indigo-400"> / 100</span>
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ml-3 ${
                                    totalGrade >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {totalGrade >= 75 ? 'Aprobado' : 'Reprobado'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Retroalimentación / Comentario</label>
                            <textarea
                                className="w-full border rounded-xl p-3 h-24 outline-none focus:ring-2 focus:ring-primary text-sm"
                                placeholder="Escribe un comentario sobre el desempeño en la actividad o examen..."
                                value={gradeComment}
                                onChange={e => setGradeComment(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition text-sm disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : <><Save size={18} /> Registrar Nota</>}
                        </button>
                    </form>
                )}

            </div>
        </div>
    );
}
