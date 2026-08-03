import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Search, GraduationCap, Users, UserX, UserCheck, UserMinus } from 'lucide-react';

export default function StudentSearch() {
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [statusFilter, setStatusFilter] = useState('activo'); // 'all', 'activo', 'retirado'
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        async function loadStudents() {
            setLoading(true);
            try {
                const snap = await getDocs(collection(db, 'students'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setStudents(list);

                // Cargar cursos de la colección 'courses'
                const cSnap = await getDocs(collection(db, 'courses'));
                let uniqueCourses = [];
                if (!cSnap.empty) {
                    uniqueCourses = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                } else {
                    const listGrades = list.map(s => s.grade).filter(Boolean);
                    uniqueCourses = Array.from(new Set(listGrades));
                    for (const c of uniqueCourses) {
                        await setDoc(doc(db, 'courses', c), { created_at: new Date() });
                    }
                    uniqueCourses.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                }
                
                setCourses(uniqueCourses);
                if (uniqueCourses.length > 0) {
                    setSelectedCourse(uniqueCourses[0]); // Seleccionar el primero por defecto
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        }
        loadStudents();
    }, []);

    const handleToggleStatus = async (e, student) => {
        e.stopPropagation();
        const currentStatus = student.status === 'retirado' ? 'retirado' : 'activo';
        const newStatus = currentStatus === 'retirado' ? 'activo' : 'retirado';
        
        const displayName = student.lastName && student.firstName ? `${student.lastName} ${student.firstName}` : student.name;
        const confirmMsg = newStatus === 'retirado' 
            ? `¿Confirmas marcar a ${displayName} como RETIRADO?\n\nSus notas y boletines permanecerán 100% intactos para certificados, pero no aparecerá en estadísticas institucionales ni rankings.`
            : `¿Confirmas REACTIVAR a ${displayName} como Alumno Activo?`;

        if (window.confirm(confirmMsg)) {
            try {
                await updateDoc(doc(db, 'students', student.id), { status: newStatus });
                setStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: newStatus } : s));
            } catch (err) {
                console.error("Error al cambiar estado:", err);
                alert("Error al actualizar el estado en Firestore.");
            }
        }
    };

    // Filtrar por curso seleccionado y término de búsqueda
    const courseStudents = students.filter(s => s.grade === selectedCourse);
    
    const filtered = courseStudents
        .filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.id_code.toLowerCase().includes(searchTerm.toLowerCase());
            
            const isRetirado = s.status === 'retirado';
            if (statusFilter === 'activo') return matchesSearch && !isRetirado;
            if (statusFilter === 'retirado') return matchesSearch && isRetirado;
            return matchesSearch;
        })
        .sort((a, b) => {
            const getSortKey = (student) => {
                if (student.lastName && student.firstName) {
                    return `${student.lastName} ${student.firstName}`;
                }
                const name = student.name || '';
                const words = name.trim().split(/\s+/);
                if (words.length <= 1) return name;
                if (words.length === 2) return `${words[1]} ${words[0]}`;
                const apellidos = words.slice(-2).join(' ');
                const nombres = words.slice(0, -2).join(' ');
                return `${apellidos} ${nombres}`;
            };
            return getSortKey(a).localeCompare(getSortKey(b));
        });

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="border-b pb-4">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                    <GraduationCap className="text-indigo-600" size={28} /> Búsqueda y Registro de Alumnos
                </h2>
                <p className="text-xs text-gray-500 mt-1">Selecciona un curso para ver sus estudiantes, registrar novedades o marcar estado (Activo / Retirado).</p>
            </div>

            {/* Selector de Cursos (Tabs) */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cursos Disponibles</label>
                <div className="flex flex-wrap gap-2">
                    {courses.map(course => {
                        const count = students.filter(s => s.grade === course && s.status !== 'retirado').length;
                        const isSelected = selectedCourse === course;
                        return (
                            <button
                                key={course}
                                onClick={() => {
                                    setSelectedCourse(course);
                                    setSearchTerm('');
                                }}
                                className={`px-4 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 border shadow-sm ${
                                    isSelected
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-600/10'
                                        : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-600'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-600'} shrink-0`}></span>
                                Curso {course}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Buscador por Nombre y Listado */}
            {selectedCourse && (
                <div className="space-y-4 pt-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder={`Buscar estudiante en curso ${selectedCourse}...`}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none shadow-sm text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                        </div>

                        {/* Filtro de Estado: Activos / Retirados / Todos */}
                        <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200/60 shrink-0 text-xs font-bold">
                            <button
                                onClick={() => setStatusFilter('activo')}
                                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'activo' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                🟢 Activos ({courseStudents.filter(s => s.status !== 'retirado').length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('retirado')}
                                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'retirado' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                🔴 Retirados ({courseStudents.filter(s => s.status === 'retirado').length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-xl transition ${statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Todos ({courseStudents.length})
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <p className="text-sm text-gray-500">Cargando listado oficial...</p>
                        ) : filtered.map(student => {
                            const isRetirado = student.status === 'retirado';
                            return (
                                <div
                                    key={student.id}
                                    onClick={() => navigate(`/teacher/log/${student.id}`)}
                                    className={`p-4 rounded-2xl border shadow-sm hover:shadow-md transition cursor-pointer flex justify-between items-center group relative ${
                                        isRetirado ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-gray-100 hover:border-indigo-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl overflow-hidden border flex items-center justify-center shrink-0 ${
                                            isRetirado ? 'bg-rose-100 border-rose-200' : 'bg-indigo-50 border-indigo-100/50'
                                        }`}>
                                            {student.photo_url ? (
                                                <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className={`font-extrabold text-sm ${isRetirado ? 'text-rose-600' : 'text-indigo-600'}`}>
                                                    {student.name.charAt(0)}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-800 group-hover:text-indigo-600 transition text-sm">
                                                    {student.lastName && student.firstName 
                                                        ? `${student.lastName} ${student.firstName}` 
                                                        : student.name}
                                                </p>
                                                {isRetirado && (
                                                    <span className="text-[9px] bg-rose-100 text-rose-700 font-extrabold px-2 py-0.5 rounded-full border border-rose-200">
                                                        RETIRADO
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-mono text-gray-400 mt-0.5">{student.id_code}</p>
                                        </div>
                                                                  <div className="flex items-center gap-2">
                                        <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition">
                                            Gestionar
                                        </span>
                                    </div>         </div>
                                </div>
                            );
                        })}

                        {!loading && filtered.length === 0 && (
                            <div className="col-span-full text-center text-gray-500 py-10 bg-white rounded-2xl border border-dashed">
                                No se encontraron alumnos {statusFilter === 'retirado' ? 'retirados' : 'activos'} en este curso.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
