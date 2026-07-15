import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Calendar, CheckCircle2, AlertTriangle, Clock, Ban } from 'lucide-react';

export default function AttendanceTracker() {
    const { currentUser } = useAuth();
    const [attendance, setAttendance] = useState([]);
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAttendance() {
            if (!currentUser) return;

            try {
                // 1. Obtener estudiante
                const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                const sSnap = await getDocs(qStudent);

                if (sSnap.empty) {
                    setLoading(false);
                    return;
                }

                const studentDoc = sSnap.docs[0];
                setStudent({ id: studentDoc.id, ...studentDoc.data() });

                // 2. Obtener historial de asistencia ordenado por fecha descendente
                const qAttendance = query(
                    collection(db, 'attendance'),
                    where('student_id', '==', studentDoc.id)
                );
                const aSnap = await getDocs(qAttendance);
                
                // Firestore client-side sort since composite index might be needed for where + orderBy
                const records = aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                records.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
                setAttendance(records);
            } catch (error) {
                console.error("Error al cargar asistencia:", error);
            } finally {
                setLoading(false);
            }
        }

        loadAttendance();
    }, [currentUser]);

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    if (!student) {
        return (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm max-w-xl mx-auto">
                <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={40} />
                <p className="text-gray-600 font-medium">No tienes ningún alumno asociado a tu cuenta.</p>
            </div>
        );
    }

    // Estadísticas
    const totalDays = attendance.length;
    const presents = attendance.filter(r => r.status === 'PRESENT').length;
    const lates = attendance.filter(r => r.status === 'LATE').length;
    const absences = attendance.filter(r => r.status === 'ABSENT').length;
    const excused = attendance.filter(r => r.status === 'EXCUSED').length;

    // Porcentaje de Asistencia (Presentes + Tardes cuentan como asistencia)
    const attendanceRate = totalDays > 0 
        ? (((presents + lates) / totalDays) * 100).toFixed(0)
        : 100;

    const statusConfig = {
        'PRESENT': { label: 'Presente', bg: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 size={16} className="text-green-600" /> },
        'LATE': { label: 'Llegada Tarde', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock size={16} className="text-yellow-600" /> },
        'ABSENT': { label: 'Inasistencia', bg: 'bg-red-100 text-red-800 border-red-200', icon: <Ban size={16} className="text-red-600" /> },
        'EXCUSED': { label: 'Falta Justificada', bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Calendar size={16} className="text-blue-600" /> }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header del estudiante */}
            <div className="bg-white border rounded-2xl p-5 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                        <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">
                            {student.lastName && student.firstName 
                                ? `${student.lastName} ${student.firstName}` 
                                : student.name}
                        </h2>
                        <p className="text-sm text-gray-500">Curso: {student.grade} | Control de Asistencia</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="text-right">
                        <span className="text-xs text-gray-400 font-semibold uppercase">Tasa de Asistencia</span>
                        <p className="text-2xl font-extrabold text-primary">{attendanceRate}%</p>
                    </div>
                </div>
            </div>

            {/* Cuadrículas de Estadísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Presentes</p>
                    <p className="text-xl font-extrabold text-green-600">{presents}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Tardes</p>
                    <p className="text-xl font-extrabold text-yellow-600">{lates}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Faltas</p>
                    <p className="text-xl font-extrabold text-red-600">{absences}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Justificadas</p>
                    <p className="text-xl font-extrabold text-blue-600">{excused}</p>
                </div>
            </div>

            {/* Listado de Historial */}
            <h3 className="text-lg font-bold text-gray-800 mb-4 px-1 flex items-center gap-2">
                <Calendar size={20} className="text-primary" /> Historial de Novedades
            </h3>

            {attendance.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-500">
                    No se registran novedades de asistencia en la plataforma.
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                    {attendance.map((record) => {
                        const config = statusConfig[record.status] || { label: record.status, bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: null };
                        
                        return (
                            <div key={record.id} className="p-4 sm:px-6 hover:bg-gray-50/50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-800">
                                            {record.date?.seconds 
                                                ? new Date(record.date.seconds * 1000).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                                : 'Fecha desconocida'}
                                        </span>
                                    </div>
                                    {record.excuse_note && (
                                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border border-dashed border-gray-200 mt-1">
                                            Motivo: &ldquo;{record.excuse_note}&rdquo;
                                        </p>
                                    )}
                                </div>

                                <div className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${config.bg}`}>
                                    {config.icon}
                                    {config.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
