import { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
    collection, getDocs, doc, setDoc, addDoc, query, where, serverTimestamp, updateDoc 
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
    UserCheck, UserX, Clock, Calendar, CheckCircle2, AlertTriangle, 
    Mail, Phone, MessageSquare, Send, RefreshCw, Filter, Printer, 
    Check, Ban, Loader2, Sparkles, ExternalLink, ShieldCheck, Users, 
    ChevronRight, ArrowRight, Search, Info
} from 'lucide-react';

export default function DailyAttendance() {
    const { currentUser, userRole } = useAuth();

    // Pestaña principal: 'roll-call' (Pase de lista) o 'daily-summary' (Consolidado de hoy)
    const [mainTab, setMainTab] = useState('roll-call');

    // Estados de datos
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estado del pase de lista actual para el curso y fecha seleccionada
    // Map: studentId -> { status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED', note: '', existingId: null, notified: false }
    const [attendanceMap, setAttendanceMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    // Opciones de notificación
    const [sendEmailNotification, setSendEmailNotification] = useState(true);
    const [sendMessageNotification, setSendMessageNotification] = useState(true);
    const [createObserverEntry, setCreateObserverEntry] = useState(false);

    // Modal de confirmación / resultados de envío
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [resultData, setResultData] = useState(null);

    // Historial global de inasistencias del día para el consolidado
    const [dailyGlobalRecords, setDailyGlobalRecords] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryFilterCourse, setSummaryFilterCourse] = useState('ALL');
    const [summaryFilterStatus, setSummaryFilterStatus] = useState('ALL');

    // 1. Cargar lista general de estudiantes y cursos
    useEffect(() => {
        async function loadInitialData() {
            setLoading(true);
            try {
                const sSnap = await getDocs(collection(db, 'students'));
                const studentList = sSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(s => s.status !== 'retirado');

                setStudents(studentList);

                // Cursos
                const cSnap = await getDocs(collection(db, 'courses'));
                let uniqueCourses = [];
                if (!cSnap.empty) {
                    uniqueCourses = cSnap.docs.map(d => d.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                } else {
                    const setC = new Set(studentList.map(s => s.grade).filter(Boolean));
                    uniqueCourses = Array.from(setC).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                }

                setCourses(uniqueCourses);
                if (uniqueCourses.length > 0 && !selectedCourse) {
                    setSelectedCourse(uniqueCourses[0]);
                }
            } catch (err) {
                console.error("Error al cargar estudiantes y cursos:", err);
            } finally {
                setLoading(false);
            }
        }
        loadInitialData();
    }, []);

    // 2. Cargar registros de asistencia existentes para el curso y fecha seleccionados
    useEffect(() => {
        async function loadCourseAttendance() {
            if (!selectedCourse || !selectedDate) return;
            
            try {
                const qAtt = query(
                    collection(db, 'attendance'),
                    where('student_grade', '==', selectedCourse),
                    where('date_str', '==', selectedDate)
                );
                const aSnap = await getDocs(qAtt);
                
                const existingMap = {};
                aSnap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    existingMap[data.student_id] = {
                        status: data.status || 'PRESENT',
                        note: data.excuse_note || '',
                        existingId: docSnap.id,
                        notified: data.notified_email || false
                    };
                });

                // Para los estudiantes del curso que no tienen registro aún, pre-poblar como PRESENT
                const courseStudents = students.filter(s => s.grade === selectedCourse);
                const fullMap = {};
                courseStudents.forEach(st => {
                    if (existingMap[st.id]) {
                        fullMap[st.id] = existingMap[st.id];
                    } else {
                        fullMap[st.id] = {
                            status: 'PRESENT',
                            note: '',
                            existingId: null,
                            notified: false
                        };
                    }
                });

                setAttendanceMap(fullMap);
            } catch (err) {
                console.error("Error al consultar asistencia del curso:", err);
            }
        }

        if (students.length > 0) {
            loadCourseAttendance();
        }
    }, [selectedCourse, selectedDate, students]);

    // 3. Cargar Consolidado Global de Inasistencias de la fecha
    const loadDailySummary = async () => {
        setLoadingSummary(true);
        try {
            const qAll = query(
                collection(db, 'attendance'),
                where('date_str', '==', selectedDate)
            );
            const snap = await getDocs(qAll);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Unir con datos del estudiante para enriquecer (nombre de acudiente, teléfono, email)
            const enriched = list.map(rec => {
                const st = students.find(s => s.id === rec.student_id);
                return {
                    ...rec,
                    studentData: st || null,
                    parentEmail: rec.parent_email || st?.email_padre || st?.email || '',
                    parentPhone: rec.parent_phone || st?.telefono_acudiente || st?.telefono || '',
                    parentName: rec.parent_name || st?.nombre_padre || 'Acudiente'
                };
            });

            enriched.sort((a, b) => (a.student_grade || '').localeCompare(b.student_grade || '', undefined, { numeric: true }));
            setDailyGlobalRecords(enriched);
        } catch (err) {
            console.error("Error al cargar resumen global del día:", err);
        } finally {
            setLoadingSummary(false);
        }
    };

    useEffect(() => {
        if (mainTab === 'daily-summary') {
            loadDailySummary();
        }
    }, [mainTab, selectedDate, students]);

    // Helper de ordenamiento de estudiantes
    const getSortName = (st) => {
        if (st.lastName && st.firstName) return `${st.lastName} ${st.firstName}`;
        const parts = (st.name || '').trim().split(/\s+/);
        if (parts.length <= 1) return st.name || '';
        if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
        const ape = parts.slice(-2).join(' ');
        const nom = parts.slice(0, -2).join(' ');
        return `${ape} ${nom}`;
    };

    // Estudiantes filtrados del curso seleccionado
    const courseStudents = useMemo(() => {
        return students
            .filter(s => s.grade === selectedCourse)
            .filter(s => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (s.name || '').toLowerCase().includes(q) || 
                       (s.id_code || '').toLowerCase().includes(q) ||
                       (s.firstName || '').toLowerCase().includes(q) ||
                       (s.lastName || '').toLowerCase().includes(q);
            })
            .sort((a, b) => getSortName(a).localeCompare(getSortName(b)));
    }, [students, selectedCourse, searchQuery]);

    // Contadores del curso actual
    const currentCounts = useMemo(() => {
        let total = courseStudents.length;
        let present = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;

        courseStudents.forEach(st => {
            const item = attendanceMap[st.id];
            const stStatus = item?.status || 'PRESENT';
            if (stStatus === 'PRESENT') present++;
            else if (stStatus === 'ABSENT') absent++;
            else if (stStatus === 'LATE') late++;
            else if (stStatus === 'EXCUSED') excused++;
        });

        return { total, present, absent, late, excused };
    }, [courseStudents, attendanceMap]);

    // Manejador para cambiar el estado de un estudiante
    const handleStatusChange = (studentId, newStatus) => {
        setAttendanceMap(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                status: newStatus
            }
        }));
    };

    // Manejador para cambiar nota rápida de inasistencia/retardo
    const handleNoteChange = (studentId, note) => {
        setAttendanceMap(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                note
            }
        }));
    };

    // Marcar todos como presentes
    const handleMarkAllPresent = () => {
        const updated = { ...attendanceMap };
        courseStudents.forEach(st => {
            updated[st.id] = {
                ...(updated[st.id] || {}),
                status: 'PRESENT',
                note: ''
            };
        });
        setAttendanceMap(updated);
    };

    // Guardar Asistencia y Despachar Notificaciones por Correo y Mensajes
    const handleSaveAndNotify = async () => {
        if (!selectedCourse || courseStudents.length === 0) return;

        setSaving(true);
        const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Docente';
        const formattedDate = selectedDate; // YYYY-MM-DD
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const selectedDateTime = new Date(formattedDate + 'T12:00:00');

        const emailPayloadRecords = [];
        const savedRecords = [];
        let createdMessagesCount = 0;

        try {
            for (const st of courseStudents) {
                const item = attendanceMap[st.id] || { status: 'PRESENT', note: '' };
                const currentStatus = item.status || 'PRESENT';
                const note = item.note || '';

                const displayName = st.lastName && st.firstName ? `${st.firstName} ${st.lastName}` : st.name;
                const parentEmail = st.email_padre || st.email || '';
                const parentName = st.nombre_padre || `Acudiente de ${displayName}`;
                const parentPhone = st.telefono_acudiente || st.telefono || '';
                const parentUids = Array.isArray(st.parent_uids) ? st.parent_uids : [];

                const attendanceDocData = {
                    student_id: st.id,
                    student_name: displayName,
                    student_grade: selectedCourse,
                    student_id_code: st.id_code || '',
                    teacher_id: currentUser?.uid || 'system',
                    teacher_name: authorName,
                    status: currentStatus,
                    excuse_note: note,
                    date: selectedDateTime,
                    date_str: formattedDate,
                    time_str: timeNow,
                    parent_email: parentEmail,
                    parent_phone: parentPhone,
                    parent_name: parentName,
                    notified_email: (currentStatus === 'ABSENT' || currentStatus === 'LATE') && sendEmailNotification,
                    updated_at: serverTimestamp()
                };

                // Guardar / Actualizar en colección 'attendance'
                if (item.existingId) {
                    await updateDoc(doc(db, 'attendance', item.existingId), attendanceDocData);
                } else {
                    const newRef = await addDoc(collection(db, 'attendance'), {
                        ...attendanceDocData,
                        created_at: serverTimestamp()
                    });
                    item.existingId = newRef.id;
                }

                savedRecords.push({ student: displayName, status: currentStatus });

                // Si es inasistencia o llegada tarde, preparar notificación
                if (currentStatus === 'ABSENT' || currentStatus === 'LATE') {
                    // 1. Añadir a cola de correo electrónico
                    if (sendEmailNotification && parentEmail) {
                        emailPayloadRecords.push({
                            student_id: st.id,
                            student_name: displayName,
                            student_grade: selectedCourse,
                            parent_name: parentName,
                            parent_email: parentEmail,
                            status: currentStatus,
                            date_str: formattedDate,
                            time_str: timeNow,
                            notes: note
                        });
                    }

                    // 2. Crear mensaje en el Buzón de la Agenda Virtual para los padres
                    if (sendMessageNotification) {
                        const isAbsent = currentStatus === 'ABSENT';
                        const subject = isAbsent 
                            ? `🚨 [Inasistencia] Reporte de Falta: ${displayName} (${selectedCourse})`
                            : `⏰ [Llegada Tarde] Reporte de Retardo: ${displayName} (${selectedCourse})`;

                        const bodyText = `Estimado(a) Acudiente:\n\nLe informamos que en el llamado a lista de hoy (${formattedDate} - ${timeNow}), se registró una novedad respecto a ${displayName} (${selectedCourse}):\n\n📌 Novedad: ${isAbsent ? 'INASISTENCIA A LA JORNADA ESCOLAR' : 'LLEGADA TARDE / RETARDO'}\n${note ? `📝 Nota del docente: ${note}\n` : ''}\nPor favor ingrese a la sección de Asistencia de la Agenda Virtual o comuníquese con la institución para radicar la respectiva justificación si aplica.\n\nAtentamente,\n${authorName} - Instituto Nueva América de Suba (INAS)`;

                        await addDoc(collection(db, 'messages'), {
                            sender_id: currentUser?.uid || 'system',
                            sender_name: authorName,
                            sender_role: userRole || 'teacher',
                            receiver_id: parentUids.length > 0 ? parentUids[0] : 'ALL_PARENTS',
                            receiver_name: parentName,
                            target_type: 'STUDENT',
                            target_students: [st.id],
                            target_parent_uids: parentUids,
                            subject,
                            body: bodyText,
                            category: 'Asistencia',
                            priority: 'Alta',
                            created_at: serverTimestamp(),
                            read: false,
                            read_at: null,
                            read_by: []
                        });
                        createdMessagesCount++;
                    }

                    // 3. Crear anotación en el Observador si la opción está activa
                    if (createObserverEntry && currentStatus === 'ABSENT') {
                        await addDoc(collection(db, 'observation_logs'), {
                            student_id: st.id,
                            student_name: displayName,
                            student_grade: selectedCourse,
                            student_id_code: st.id_code || '',
                            author_id: currentUser?.uid || 'system',
                            author_name: authorName,
                            author_role: userRole || 'teacher',
                            type: 'NOTE',
                            category_id: 'TIPO_1',
                            category_name: 'Falta Leve / Asistencia',
                            severity: 'Baja',
                            article: 'Art. 12 Num. 1 - Puntualidad e Ingreso al Plantel',
                            preset_id: 'inasistencia_diaria',
                            title: `Inasistencia no justificada a clases - ${formattedDate}`,
                            content: `El estudiante no se presentó a la jornada escolar del día ${formattedDate}. ${note ? `Observación: ${note}` : ''}`,
                            action_taken: 'Notificación enviada a los padres de familia.',
                            created_at: serverTimestamp(),
                            requires_parent_signature: true,
                            parent_signed: false
                        });
                    }
                }
            }

            // 4. Disparar endpoint de correos en el backend
            let emailResults = null;
            if (emailPayloadRecords.length > 0) {
                try {
                    const res = await fetch('/api/attendance/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sender_name: authorName,
                            records: emailPayloadRecords
                        })
                    });
                    emailResults = await res.json();
                } catch (emailErr) {
                    console.error("Error al conectar con endpoint de correos:", emailErr);
                }
            }

            // Mostrar resultado en modal
            setResultData({
                course: selectedCourse,
                date: formattedDate,
                totalStudents: courseStudents.length,
                absentCount: currentCounts.absent,
                lateCount: currentCounts.late,
                emailCount: emailPayloadRecords.length,
                emailResults,
                messagesCount: createdMessagesCount
            });
            setResultModalOpen(true);

        } catch (error) {
            console.error("Error al guardar asistencia:", error);
            alert("Error al guardar asistencia: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Cambiar estado desde el consolidado global (ej. el estudiante llegó más tarde, justificar, o desmarcar falta)
    const handleUpdateGlobalRecordStatus = async (recordId, newStatus, customNote = null) => {
        try {
            const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const updatePayload = {
                status: newStatus,
                updated_at: serverTimestamp()
            };
            if (customNote !== null) {
                updatePayload.excuse_note = customNote;
            }
            if (newStatus === 'LATE') {
                updatePayload.time_str = timeNow;
                if (!customNote) updatePayload.excuse_note = `Ingreso tarde registrado a las ${timeNow}`;
            }
            if (newStatus === 'PRESENT') {
                updatePayload.excuse_note = '';
            }

            await updateDoc(doc(db, 'attendance', recordId), updatePayload);
            setDailyGlobalRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updatePayload } : r));
        } catch (e) {
            console.error("Error al actualizar estado:", e);
            alert("Error al actualizar el estado de asistencia.");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Cargando listas escolares...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-[1440px] mx-auto pb-16">
            
            {/* ENCABEZADO PRINCIPAL */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div>
                        <div className="flex items-center gap-2.5 mb-2">
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1.5">
                                <Sparkles size={13} className="text-indigo-400" />
                                INAS • Control Escolar
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-bold">
                                Alertas en Tiempo Real
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Pase de Lista Diario
                        </h1>
                        <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                            Marca las inasistencias y retardos salón por salón. El sistema despacha automáticamente correos institucionales y mensajes a los acudientes.
                        </p>
                    </div>

                    {/* Selector de Fecha */}
                    <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur border border-slate-700/80 p-2.5 rounded-2xl self-start md:self-auto">
                        <Calendar size={18} className="text-indigo-400 shrink-0 ml-1" />
                        <div className="flex flex-col">
                            <label className="text-[10px] uppercase font-bold text-slate-400 leading-none">Fecha de Control</label>
                            <input 
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer mt-0.5"
                            />
                        </div>
                    </div>
                </div>

                {/* Pestañas de Vista: Pase de Lista vs Consolidado del Día */}
                <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80">
                    <button
                        type="button"
                        onClick={() => setMainTab('roll-call')}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            mainTab === 'roll-call'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <UserCheck size={16} />
                        Pase de Lista por Salón
                    </button>
                    <button
                        type="button"
                        onClick={() => setMainTab('daily-summary')}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            mainTab === 'daily-summary'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <ShieldCheck size={16} />
                        Consolidado General de Inasistencias de Hoy
                    </button>
                </div>
            </div>

            {/* VISTA 1: PASE DE LISTA POR SALÓN */}
            {mainTab === 'roll-call' && (
                <div className="space-y-6">
                    
                    {/* BARRA DE SELECCIÓN DE CURSOS RÁPIDOS */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <Users size={14} className="text-indigo-500" />
                                Selecciona el Salón a Controlar:
                            </span>
                            <span className="text-xs text-slate-400">
                                {courses.length} salones disponibles
                            </span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {courses.map(courseName => {
                                const isSelected = selectedCourse === courseName;
                                const countInCourse = students.filter(s => s.grade === courseName).length;
                                return (
                                    <button
                                        key={courseName}
                                        type="button"
                                        onClick={() => setSelectedCourse(courseName)}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                                            isSelected 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25 scale-[1.02]' 
                                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span>Curso {courseName}</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {countInCourse}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* TARJETA DE ESTADÍSTICAS & ACCIONES DEL CURSO */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 font-extrabold">
                                <Users size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-slate-400">Total Alumnos</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white leading-tight">{currentCounts.total}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm flex items-center gap-3 bg-emerald-50/20">
                            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-extrabold">
                                <UserCheck size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Presentes</p>
                                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 leading-tight">{currentCounts.present}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 shadow-sm flex items-center gap-3 bg-rose-50/20">
                            <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 font-extrabold">
                                <UserX size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400">Inasistencias</p>
                                <p className="text-xl font-black text-rose-700 dark:text-rose-300 leading-tight">{currentCounts.absent}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 shadow-sm flex items-center gap-3 bg-amber-50/20">
                            <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 font-extrabold">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">Llegadas Tarde</p>
                                <p className="text-xl font-black text-amber-700 dark:text-amber-300 leading-tight">{currentCounts.late}</p>
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE HERRAMIENTAS RÁPIDAS: BÚSQUEDA Y ACCIÓN MASIVA */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                            <input 
                                type="text"
                                placeholder="Filtrar por nombre o código..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={handleMarkAllPresent}
                                className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 w-full sm:w-auto justify-center cursor-pointer"
                            >
                                <CheckCircle2 size={15} />
                                Marcar Todos Presentes
                            </button>
                        </div>
                    </div>

                    {/* LISTA INTERACTIVA DE ESTUDIANTES */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                        <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg">
                                    Lista de Estudiantes - Grado {selectedCourse}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Toca el botón correspondiente para registrar el estado de cada estudiante
                                </p>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                {courseStudents.length} Alumnos
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {courseStudents.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    <Users size={36} className="mx-auto mb-2 opacity-50" />
                                    <p className="font-medium">No se encontraron estudiantes para este curso o filtro.</p>
                                </div>
                            ) : (
                                courseStudents.map((student, idx) => {
                                    const item = attendanceMap[student.id] || { status: 'PRESENT', note: '' };
                                    const currentStatus = item.status || 'PRESENT';
                                    const displayName = student.lastName && student.firstName 
                                        ? `${student.lastName} ${student.firstName}` 
                                        : student.name;
                                    const parentEmail = student.email_padre || student.email || '';
                                    const parentPhone = student.telefono_acudiente || student.telefono || '';
                                    const parentName = student.nombre_padre || 'Acudiente';

                                    const isAbsent = currentStatus === 'ABSENT';
                                    const isLate = currentStatus === 'LATE';
                                    const isExcused = currentStatus === 'EXCUSED';

                                    return (
                                        <div 
                                            key={student.id} 
                                            className={`p-4 sm:p-5 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                                                isAbsent 
                                                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-l-4 border-rose-500' 
                                                    : isLate 
                                                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-l-4 border-amber-500'
                                                    : isExcused
                                                    ? 'bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-blue-500'
                                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                                            }`}
                                        >
                                            {/* Datos del estudiante y acudiente */}
                                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                                <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                                                    isAbsent ? 'bg-rose-200 text-rose-800' : isLate ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                    {idx + 1}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
                                                            {displayName}
                                                        </h4>
                                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                            {student.id_code || 'SIN CÓDIGO'}
                                                        </span>
                                                    </div>

                                                    {/* Datos de contacto de los padres */}
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <span className="flex items-center gap-1 font-medium">
                                                            <Mail size={12} className={parentEmail ? 'text-indigo-500' : 'text-slate-300'} />
                                                            {parentEmail ? (
                                                                <span className="truncate max-w-[200px]" title={parentEmail}>{parentEmail}</span>
                                                            ) : (
                                                                <span className="text-amber-500 text-[11px] font-semibold">Sin correo registrado</span>
                                                            )}
                                                        </span>

                                                        {parentPhone && (
                                                            <span className="flex items-center gap-1 font-medium">
                                                                <Phone size={12} className="text-emerald-500" />
                                                                <span>{parentPhone}</span>
                                                                <a 
                                                                    href={`tel:${parentPhone}`} 
                                                                    className="text-[10px] text-emerald-600 underline font-bold ml-1 hover:text-emerald-700"
                                                                    title="Llamar al acudiente"
                                                                >
                                                                    Llamar
                                                                </a>
                                                                <a 
                                                                    href={`https://wa.me/57${parentPhone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(parentName)},%20le%20escribimos%20del%20Instituto%20Nueva%20América%20de%20Suba%20respecto%20a%20la%20asistencia%20de%20${encodeURIComponent(displayName)}.`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-200"
                                                                    title="Escribir por WhatsApp"
                                                                >
                                                                    WhatsApp
                                                                </a>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Campo de Nota Rápida si no está Presente */}
                                                    {(isAbsent || isLate || isExcused) && (
                                                        <div className="mt-2.5 max-w-lg">
                                                            <input 
                                                                type="text"
                                                                placeholder={isAbsent ? "Motivo de inasistencia (opcional)..." : "Hora de ingreso / motivo del retardo..."}
                                                                value={item.note || ''}
                                                                onChange={(e) => handleNoteChange(student.id, e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* BOTONES TÁCTILES DE ESTADO */}
                                            <div className="flex items-center gap-1.5 sm:gap-2 self-end lg:self-center shrink-0 w-full sm:w-auto justify-between sm:justify-end mt-2 lg:mt-0">
                                                {/* Presente */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(student.id, 'PRESENT')}
                                                    className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all flex-1 sm:flex-initial justify-center cursor-pointer ${
                                                        currentStatus === 'PRESENT'
                                                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-600 ring-offset-1'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600'
                                                    }`}
                                                >
                                                    <Check size={14} />
                                                    Presente
                                                </button>

                                                {/* Inasistencia */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(student.id, 'ABSENT')}
                                                    className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all flex-1 sm:flex-initial justify-center cursor-pointer ${
                                                        isAbsent
                                                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-600 ring-offset-1'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
                                                    }`}
                                                >
                                                    <Ban size={14} />
                                                    Falta
                                                </button>

                                                {/* Llegada Tarde */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(student.id, 'LATE')}
                                                    className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all flex-1 sm:flex-initial justify-center cursor-pointer ${
                                                        isLate
                                                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-500 ring-offset-1'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
                                                    }`}
                                                >
                                                    <Clock size={14} />
                                                    Tarde
                                                </button>

                                                {/* Justificada */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(student.id, 'EXCUSED')}
                                                    className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all flex-1 sm:flex-initial justify-center cursor-pointer ${
                                                        isExcused
                                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600 ring-offset-1'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600'
                                                    }`}
                                                >
                                                    <ShieldCheck size={14} />
                                                    Excusa
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* BARRA FLOTANTE / INFERIOR DE ACCIÓN Y GUARDADO */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 sticky bottom-4 z-20">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                    {currentCounts.absent + currentCounts.late} novedad(es) para notificar
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-2 sm:pt-0 sm:pl-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={sendEmailNotification}
                                        onChange={(e) => setSendEmailNotification(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                    <Mail size={14} className="text-indigo-500" />
                                    Enviar Correo a Padres
                                </label>

                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={sendMessageNotification}
                                        onChange={(e) => setSendMessageNotification(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                    <MessageSquare size={14} className="text-emerald-500" />
                                    Buzón de Mensajes
                                </label>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveAndNotify}
                            disabled={saving || courseStudents.length === 0}
                            className="w-full md:w-auto px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Guardando y enviando correos...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    <span>Guardar Asistencia y Notificar a Hogares</span>
                                </>
                            )}
                        </button>
                    </div>

                </div>
            )}

            {/* VISTA 2: CONSOLIDADO GENERAL DE INASISTENCIAS DE HOY */}
            {mainTab === 'daily-summary' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-indigo-600" />
                                    Resumen General de Ausencias del Plantel
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Todos los estudiantes ausentes o con retardo reportados en la fecha {selectedDate}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={loadDailySummary}
                                    className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                                    title="Actualizar datos"
                                >
                                    <RefreshCw size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Printer size={15} />
                                    Imprimir Reporte
                                </button>
                            </div>
                        </div>

                        {/* Filtros de Curso y Estado */}
                        <div className="flex flex-wrap items-center gap-3 pt-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">Filtrar por Curso:</span>
                                <select
                                    value={summaryFilterCourse}
                                    onChange={(e) => setSummaryFilterCourse(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                                >
                                    <option value="ALL">Todos los Cursos</option>
                                    {courses.map(c => <option key={c} value={c}>Curso {c}</option>)}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">Filtrar por Estado:</span>
                                <select
                                    value={summaryFilterStatus}
                                    onChange={(e) => setSummaryFilterStatus(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                                >
                                    <option value="ALL">Todas las Novedades</option>
                                    <option value="ABSENT">Solo Inasistencias (Faltas)</option>
                                    <option value="LATE">Solo Llegadas Tarde</option>
                                    <option value="EXCUSED">Solo Justificadas</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* TABLA CONSOLIDADA */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                        {loadingSummary ? (
                            <div className="py-16 text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                                <p className="text-xs text-slate-500 font-semibold">Generando consolidado...</p>
                            </div>
                        ) : dailyGlobalRecords.length === 0 ? (
                            <div className="py-16 text-center text-slate-400">
                                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-2 opacity-80" />
                                <h4 className="font-bold text-slate-700 dark:text-slate-300">¡Sin inasistencias reportadas!</h4>
                                <p className="text-xs text-slate-500 mt-1">No se registran ausencias para la fecha {selectedDate}.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            <th className="p-4">Estudiante</th>
                                            <th className="p-4">Curso</th>
                                            <th className="p-4">Estado</th>
                                            <th className="p-4">Contacto Acudiente</th>
                                            <th className="p-4">Docente / Reporte</th>
                                            <th className="p-4 text-center">Acciones Rápidas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                        {dailyGlobalRecords
                                            .filter(r => summaryFilterCourse === 'ALL' || r.student_grade === summaryFilterCourse)
                                            .filter(r => summaryFilterStatus === 'ALL' || r.status === summaryFilterStatus)
                                            .filter(r => r.status !== 'PRESENT')
                                            .map((record) => {
                                                const isAbsent = record.status === 'ABSENT';
                                                const isLate = record.status === 'LATE';
                                                const isExcused = record.status === 'EXCUSED';

                                                return (
                                                    <tr key={record.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-800 dark:text-white">
                                                                {record.student_name}
                                                            </div>
                                                            <div className="text-xs text-slate-400 font-mono">
                                                                {record.student_id_code || '---'}
                                                            </div>
                                                        </td>

                                                        <td className="p-4">
                                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                                                                Grado {record.student_grade}
                                                            </span>
                                                        </td>

                                                        <td className="p-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1 ${
                                                                isAbsent 
                                                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                                                                    : isLate 
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                            }`}>
                                                                {isAbsent && <Ban size={12} />}
                                                                {isLate && <Clock size={12} />}
                                                                {isExcused && <ShieldCheck size={12} />}
                                                                {isAbsent ? 'Inasistencia' : isLate ? 'Llegada Tarde' : 'Justificada'}
                                                            </span>
                                                            {record.excuse_note && (
                                                                <p className="text-[11px] text-slate-500 mt-1 italic max-w-xs truncate">
                                                                    "{record.excuse_note}"
                                                                </p>
                                                            )}
                                                        </td>

                                                        <td className="p-4">
                                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {record.parentName}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                                                {record.parentEmail || 'Sin email'}
                                                            </div>
                                                            {record.parentPhone && (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <a 
                                                                        href={`tel:${record.parentPhone}`} 
                                                                        className="text-[10px] text-emerald-600 underline font-bold"
                                                                    >
                                                                        {record.parentPhone}
                                                                    </a>
                                                                    <a 
                                                                        href={`https://wa.me/57${record.parentPhone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(record.parentName)},%20le%20escribimos%20del%20Instituto%20Nueva%20América%20de%20Suba%20respecto%20a%20la%20asistencia%20de%20${encodeURIComponent(record.student_name)}.`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold"
                                                                    >
                                                                        WA
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="p-4 text-xs text-slate-500">
                                                            <div>{record.teacher_name || 'Coordinación'}</div>
                                                            <div className="text-[10px] text-slate-400">{record.time_str || ''}</div>
                                                        </td>

                                                        <td className="p-4 text-center">
                                                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                                                                {/* Si está ausente */}
                                                                {isAbsent && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'PRESENT')}
                                                                            className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="El estudiante llegó a clases: desmarcar falta y poner Presente"
                                                                        >
                                                                            <UserCheck size={12} />
                                                                            Llegó (Presente)
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'LATE')}
                                                                            className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="El estudiante llegó con retraso: registrar Llegada Tarde"
                                                                        >
                                                                            <Clock size={12} />
                                                                            Llegó Tarde
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'EXCUSED')}
                                                                            className="px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="Marcar como justificada por excusa médica"
                                                                        >
                                                                            <ShieldCheck size={12} />
                                                                            Justificar
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {/* Si llegó tarde */}
                                                                {isLate && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'PRESENT')}
                                                                            className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="Desmarcar retardo y dejar Presente a tiempo"
                                                                        >
                                                                            <UserCheck size={12} />
                                                                            Puntual (Presente)
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'EXCUSED')}
                                                                            className="px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="Justificar retardo"
                                                                        >
                                                                            <ShieldCheck size={12} />
                                                                            Justificar
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {/* Si está justificada */}
                                                                {isExcused && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'PRESENT')}
                                                                            className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                            title="Marcar como presente en clase"
                                                                        >
                                                                            <UserCheck size={12} />
                                                                            Presente
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateGlobalRecordStatus(record.id, 'ABSENT')}
                                                                            className="px-2 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[11px] font-bold hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                        >
                                                                            <Ban size={12} />
                                                                            Revertir a Falta
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE RESULTADO / CONFIRMACIÓN DE ENVÍO */}
            {resultModalOpen && resultData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4 font-black">
                            <CheckCircle2 size={32} />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 dark:text-white text-center">
                            ¡Pase de Lista Guardado con Éxito!
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
                            Salón: Grado {resultData.course} | Fecha: {resultData.date}
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 my-5 space-y-2 text-xs border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-slate-500">Estudiantes evaluados:</span>
                                <strong className="text-slate-800 dark:text-white font-extrabold">{resultData.totalStudents}</strong>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-rose-600 font-bold">Inasistencias reportadas:</span>
                                <strong className="text-rose-600 font-extrabold">{resultData.absentCount}</strong>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-amber-600 font-bold">Llegadas tarde:</span>
                                <strong className="text-amber-600 font-extrabold">{resultData.lateCount}</strong>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-indigo-600 font-bold">Correos despachados:</span>
                                <strong className="text-indigo-600 font-extrabold">
                                    {resultData.emailCount} correos {resultData.emailResults?.isSimulated ? '(Simulación Activa)' : '(Enviados)'}
                                </strong>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-emerald-600 font-bold">Mensajes en Agenda Virtual:</span>
                                <strong className="text-emerald-600 font-extrabold">{resultData.messagesCount} alertas creadas</strong>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setResultModalOpen(false)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/25 transition-colors text-sm cursor-pointer"
                            >
                                Continuar con otro salón
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
