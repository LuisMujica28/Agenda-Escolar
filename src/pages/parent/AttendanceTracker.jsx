import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Calendar, CheckCircle2, AlertTriangle, Clock, Ban } from 'lucide-react';
import { getStudentForUser } from '../../lib/getStudentForUser';
import { getStudentPhoto, DEFAULT_STUDENT_PHOTO } from '../../lib/avatarHelper';

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
                const studentData = await getStudentForUser(db, currentUser);

                if (!studentData) {
                    setLoading(false);
                    return;
                }

                setStudent(studentData);

                // 2. Obtener historial de asistencia ordenado por fecha descendente
                const qAttendance = query(
                    collection(db, 'attendance'),
                    where('student_id', '==', studentData.id)
                );
                const aSnap = await getDocs(qAttendance);
                
                // Firestore client-side sort handling all date structures
                const records = aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const getSortTime = (r) => {
                    if (r.date?.seconds) return r.date.seconds * 1000;
                    if (r.date instanceof Date) return r.date.getTime();
                    if (r.date_str) return new Date(r.date_str + 'T12:00:00').getTime();
                    if (r.created_at?.seconds) return r.created_at.seconds * 1000;
                    return 0;
                };
                records.sort((a, b) => getSortTime(b) - getSortTime(a));
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

    const formatRecordDate = (record) => {
        let d = null;
        if (record.date?.seconds) {
            d = new Date(record.date.seconds * 1000);
        } else if (record.date instanceof Date) {
            d = record.date;
        } else if (typeof record.date === 'string' && record.date) {
            d = new Date(record.date.includes('T') ? record.date : record.date + 'T12:00:00');
        } else if (record.date_str) {
            d = new Date(record.date_str + 'T12:00:00');
        } else if (record.created_at?.seconds) {
            d = new Date(record.created_at.seconds * 1000);
        }

        if (!d || isNaN(d.getTime())) {
            return record.date_str || 'Fecha no registrada';
        }

        const dateFormatted = d.toLocaleDateString('es-CO', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        return dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            {/* Header del estudiante */}
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
                            {student.lastName && student.firstName 
                                ? `${student.lastName} ${student.firstName}` 
                                : student.name}
                        </h2>
                        <p className="text-xs text-gray-500 truncate mt-0.5">Curso: <strong className="text-gray-700">{student.grade}</strong> | Control de Asistencia</p>
                    </div>
                </div>

                <div className="w-full sm:w-auto flex sm:flex-col items-center justify-between sm:text-right bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none border border-slate-100 sm:border-0 shrink-0">
                    <span className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider">Tasa de Asistencia</span>
                    <p className="text-xl sm:text-2xl font-black text-indigo-600 leading-tight">{attendanceRate}%</p>
                </div>
            </div>

            {/* Cuadrículas de Estadísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs text-center">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase mb-0.5">Presentes</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-600">{presents}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs text-center">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase mb-0.5">Tardes</p>
                    <p className="text-xl sm:text-2xl font-black text-amber-600">{lates}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs text-center">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase mb-0.5">Faltas</p>
                    <p className="text-xl sm:text-2xl font-black text-rose-600">{absences}</p>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs text-center">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase mb-0.5">Justificadas</p>
                    <p className="text-xl sm:text-2xl font-black text-blue-600">{excused}</p>
                </div>
            </div>

            {/* Listado de Historial */}
            <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-black text-gray-800 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                    <span className="flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-600 shrink-0" /> Historial de Novedades
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-gray-400">
                        {absences + lates + excused} novedad(es) registrada(s)
                    </span>
                </h3>

                {attendance.filter(r => r.status !== 'PRESENT').length === 0 ? (
                    <div className="text-center py-10 sm:py-12 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6">
                        <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                        <h4 className="font-bold text-gray-800 text-sm sm:text-base">¡Sin novedades de inasistencia!</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">El estudiante se encuentra al día y no presenta reportes de faltas o retardos.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                        {attendance
                            .filter(r => r.status !== 'PRESENT')
                            .map((record) => {
                                const config = statusConfig[record.status] || { label: record.status, bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: null };
                                
                                return (
                                    <div key={record.id} className="p-3 sm:p-4 hover:bg-gray-50/50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-3 text-left">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-gray-800 text-xs sm:text-sm">
                                                    {formatRecordDate(record)}
                                                </span>
                                                {record.time_str && (
                                                    <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {record.time_str}
                                                    </span>
                                                )}
                                            </div>
                                            {record.excuse_note && (
                                                <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded-xl border border-dashed border-gray-200 mt-1">
                                                    Motivo: &ldquo;{record.excuse_note}&rdquo;
                                                </p>
                                            )}
                                        </div>

                                        <div className={`px-2.5 py-1 rounded-xl border text-[11px] sm:text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-2xs ${config.bg}`}>
                                            {config.icon}
                                            {config.label}
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
