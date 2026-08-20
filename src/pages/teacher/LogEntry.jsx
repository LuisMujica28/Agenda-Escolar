import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Save, UserCheck, Award, FileText, ChevronLeft, Zap, CheckCircle2, 
    AlertTriangle, ShieldAlert, Star, BellRing, Clock, User, Check, Send
} from 'lucide-react';
import { CONVIVENCIA_CATEGORIES, CONVIVENCIA_PRESETS } from '../../lib/convivenciaCatalog';

export default function LogEntry() {
    const { studentId } = useParams();
    const [student, setStudent] = useState(null);
    const [activeTab, setActiveTab] = useState('observer'); // observer, attendance, grades
    const [loading, setLoading] = useState(false);
    
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    // 1. Estados para Observador Rápido
    const [categoryTab, setCategoryTab] = useState('TIPO_1');
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [obsArticle, setObsArticle] = useState('Art. 12 Num. 1 - Puntualidad e Ingreso al Plantel');
    const [obsTitle, setObsTitle] = useState('');
    const [obsContent, setObsContent] = useState('');
    const [obsAdditionalNotes, setObsAdditionalNotes] = useState('');
    const [actionTaken, setActionTaken] = useState('');
    const [notifyParents, setNotifyParents] = useState(true);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

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

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const q = query(collection(db, 'observation_logs'), where('student_id', '==', studentId));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
            setHistoryLogs(list);
        } catch (e) {
            console.error("Error loading observer history:", e);
        } finally {
            setLoadingHistory(false);
        }
    };

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
        loadHistory();
    }, [studentId]);

    const handleSelectPreset = (preset) => {
        setSelectedPreset(preset);
        if (preset.category) {
            setCategoryTab(preset.category);
        }
        setObsArticle(preset.article || '');
        setObsTitle(preset.title);
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setObsContent(preset.getTemplate(timeNow));
        setActionTaken(preset.suggestedAction || '');
        setObsAdditionalNotes('');
    };

    // Guardar Observador con Notificación Instantánea
    async function handleSaveObserver(e) {
        e.preventDefault();
        if (!obsContent.trim() || !obsTitle.trim()) return;
        setLoading(true);
        try {
            let effectiveCat = selectedPreset?.category || categoryTab;
            const lowerTitle = obsTitle.toLowerCase();
            if (lowerTitle.includes('reconocimiento') || lowerTitle.includes('mérito') || lowerTitle.includes('felicitación') || lowerTitle.includes('superación') || lowerTitle.includes('excelencia')) {
                effectiveCat = 'RECONOCIMIENTO';
            } else if (lowerTitle.includes('gravísima') || lowerTitle.includes('tipo iii') || lowerTitle.includes('agresión') || lowerTitle.includes('acoso')) {
                effectiveCat = 'TIPO_3';
            } else if (lowerTitle.includes('grave') || lowerTitle.includes('tipo ii') || lowerTitle.includes('evasión') || lowerTitle.includes('fraude')) {
                effectiveCat = 'TIPO_2';
            }

            const categoryObj = CONVIVENCIA_CATEGORIES[effectiveCat] || CONVIVENCIA_CATEGORIES.TIPO_1;
            const displayName = student.lastName && student.firstName ? `${student.firstName} ${student.lastName}` : student.name;
            const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Docente';

            const isCongrats = effectiveCat === 'RECONOCIMIENTO';
            const isAlert = effectiveCat === 'TIPO_3' || effectiveCat === 'TIPO_2';

            const finalContent = obsAdditionalNotes.trim()
                ? `${obsContent.trim()}\n\n📌 Observaciones adicionales del docente: ${obsAdditionalNotes.trim()}`
                : obsContent.trim();

            const obsRef = await addDoc(collection(db, 'observation_logs'), {
                student_id: studentId,
                student_name: displayName,
                student_grade: student.grade || '',
                student_id_code: student.id_code || '',
                author_id: currentUser.uid,
                author_name: authorName,
                author_email: currentUser.email || '',
                author_role: userRole || 'teacher',
                type: isCongrats ? 'CONGRATS' : isAlert ? 'ALERT' : 'NOTE',
                category_id: effectiveCat,
                category_name: categoryObj.name,
                severity: categoryObj.severity,
                article: obsArticle.trim() || selectedPreset?.article || '',
                preset_id: selectedPreset?.id || 'manual',
                title: obsTitle.trim(),
                content: finalContent,
                action_taken: actionTaken.trim(),
                created_at: serverTimestamp(),
                requires_parent_signature: true,
                parent_signed: false,
                parent_signed_at: null,
                parent_signed_by: null
            });

            if (notifyParents) {
                const parentUids = student.parent_uids && student.parent_uids.length > 0 ? student.parent_uids : [];
                const isHighPrio = categoryTab === 'TIPO_2' || categoryTab === 'TIPO_3';

                const messageBody = `Estimado(a) Acudiente:\n\nSe ha registrado una novedad en el observador oficial de ${displayName} (${student.grade}):\n\n📌 Categoría: ${categoryObj.name}\n📜 Artículo: ${obsArticle.trim() || 'Manual de Convivencia'}\n📋 Asunto: ${obsTitle}\n📝 Descripción: ${finalContent}\n${actionTaken ? `🎯 Medida / Compromiso: ${actionTaken}\n` : ''}\nPor favor ingrese a la plataforma para firmar digitalmente el acuse de recibo de esta comunicación.\n\nAtentamente,\n${authorName} - Instituto Nueva América de Suba (INAS)`;

                await addDoc(collection(db, 'messages'), {
                    sender_id: currentUser.uid,
                    sender_name: authorName,
                    sender_role: userRole || 'teacher',
                    receiver_id: parentUids.length > 0 ? parentUids[0] : 'ALL_PARENTS',
                    receiver_name: `Familia de ${displayName}`,
                    target_type: 'STUDENT',
                    target_students: [studentId],
                    target_parent_uids: parentUids,
                    subject: `[Observador Escolar] ${categoryObj.shortName}: ${obsTitle} - ${displayName}`,
                    body: messageBody,
                    category: 'Convivencia',
                    priority: isHighPrio ? 'Alta' : 'Normal',
                    related_observation_id: obsRef.id,
                    created_at: serverTimestamp(),
                    read: false,
                    read_at: null,
                    read_by: []
                });
            }

            alert("Anotación guardada en el observador y notificada a los padres.");
            setObsTitle('');
            setObsContent('');
            setActionTaken('');
            setSelectedPreset(null);
            loadHistory();
        } catch (error) {
            console.error(error);
            alert("Error al guardar anotación: " + error.message);
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
                
                {/* 1. Formulario del Observador y Presets de Convivencia */}
                {activeTab === 'observer' && (
                    <div className="space-y-6">
                        <form onSubmit={handleSaveObserver} className="space-y-4">
                            {/* Selector de Categoría de Falta */}
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                                    Tipo de Situación (Manual de Convivencia)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setCategoryTab('TIPO_1')}
                                        className={`py-2 px-1.5 rounded-xl text-[10.5px] font-black transition text-center ${
                                            categoryTab === 'TIPO_1' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        🟢 Tipo I (Leve)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryTab('TIPO_2')}
                                        className={`py-2 px-1.5 rounded-xl text-[10.5px] font-black transition text-center ${
                                            categoryTab === 'TIPO_2' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        🟡 Tipo II (Grave)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryTab('TIPO_3')}
                                        className={`py-2 px-1.5 rounded-xl text-[10.5px] font-black transition text-center ${
                                            categoryTab === 'TIPO_3' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        🔴 Tipo III (Gravísima)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryTab('RECONOCIMIENTO')}
                                        className={`py-2 px-1.5 rounded-xl text-[10.5px] font-black transition text-center ${
                                            categoryTab === 'RECONOCIMIENTO' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        ⭐ Reconocimiento
                                    </button>
                                </div>
                            </div>

                            {/* Botones de Presets de 1 Toque */}
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                                    Opciones rápidas de 1 toque:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {CONVIVENCIA_PRESETS.filter(p => p.category === categoryTab).map(preset => {
                                        const isCurrent = selectedPreset?.id === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handleSelectPreset(preset)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                                                    isCurrent 
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                                                }`}
                                            >
                                                {preset.shortTitle}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-left">
                                <div className="sm:col-span-8">
                                    <label className="block text-xs font-black text-slate-700 mb-1">Título / Asunto *</label>
                                    <input
                                        type="text"
                                        value={obsTitle}
                                        onChange={e => setObsTitle(e.target.value)}
                                        placeholder="Ej: Retardo al ingreso de la jornada escolar..."
                                        required
                                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                    />
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="block text-xs font-black text-indigo-900 mb-1 flex items-center gap-1">
                                        <span>📜 Artículo Oficial</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={obsArticle}
                                        onChange={e => setObsArticle(e.target.value)}
                                        placeholder="Ej: Art. 12 Num. 1..."
                                        className="w-full bg-indigo-50/60 border border-indigo-200 rounded-xl p-2.5 text-xs font-bold text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                    />
                                </div>
                            </div>

                            <div className="text-left">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-black text-slate-700">Descripción de los Hechos (Editable) *</label>
                                    <span className="text-[10px] text-slate-400 font-semibold">Puedes modificar el texto libremente</span>
                                </div>
                                <textarea
                                    className="w-full border border-slate-200 rounded-xl p-3 h-24 outline-none focus:ring-2 focus:ring-indigo-600/20 text-xs font-medium text-slate-700"
                                    placeholder="Escribe el reporte sobre la conducta, participación o situación del estudiante..."
                                    value={obsContent}
                                    onChange={e => setObsContent(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Campo de Anexo Rápido */}
                            <div className="bg-amber-50/60 border border-amber-200/70 p-2.5 rounded-xl text-left space-y-1">
                                <label className="block text-[10.5px] font-black text-amber-950 flex items-center justify-between">
                                    <span>➕ Anexar Detalle Adicional del Docente (Opcional):</span>
                                    <span className="text-[9.5px] text-amber-700 font-normal">Se agregará al reporte</span>
                                </label>
                                <input
                                    type="text"
                                    value={obsAdditionalNotes}
                                    onChange={e => setObsAdditionalNotes(e.target.value)}
                                    placeholder="Ej: Llegó 25 min tarde por congestión vehicular / No trajo la excusa firmada..."
                                    className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                            </div>

                            <div className="text-left">
                                <label className="block text-xs font-black text-slate-700 mb-1">🎯 Medida Pedagógica / Compromiso</label>
                                <input
                                    type="text"
                                    value={actionTaken}
                                    onChange={e => setActionTaken(e.target.value)}
                                    placeholder="Ej: Llamado de atención formativo, citación a acudiente..."
                                    className="w-full border border-slate-200 rounded-xl p-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                />
                            </div>

                            <label className="flex items-center gap-2 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notifyParents}
                                    onChange={e => setNotifyParents(e.target.checked)}
                                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1">
                                    <BellRing size={13} className="text-indigo-600" /> Notificar a los padres de inmediato (Acuse de recibo)
                                </span>
                            </label>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition text-sm disabled:opacity-50 shadow-md shadow-indigo-600/10 active-press"
                            >
                                {loading ? 'Guardando y Notificando...' : <><Send size={16} /> Guardar Anotación y Notificar</>}
                            </button>
                        </form>

                        {/* Historial de Anotaciones en la Hoja de Vida */}
                        <div className="border-t pt-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>Hoja de Vida / Observador ({historyLogs.length})</span>
                                    {loadingHistory && <span className="text-[10px] text-indigo-600 font-normal">Cargando...</span>}
                                </h3>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                    Visible para docentes y directivos
                                </span>
                            </div>

                            {historyLogs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed">
                                    El estudiante no tiene anotaciones registradas aún en su observador.
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                    {historyLogs.map(log => {
                                        const dateStr = log.created_at?.seconds 
                                            ? new Date(log.created_at.seconds * 1000).toLocaleDateString() + ' • ' + new Date(log.created_at.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Fecha no disp.';

                                        const signedDateStr = log.parent_signed_at?.seconds
                                            ? new Date(log.parent_signed_at.seconds * 1000).toLocaleDateString() + ' a las ' + new Date(log.parent_signed_at.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : '';
                                        
                                        const isCongrats = log.type === 'CONGRATS' || log.severity === 'POSITIVO' || (log.category_id === 'RECONOCIMIENTO');
                                        const isGravisima = log.severity === 'GRAVISIMA' || log.category_id === 'TIPO_3';
                                        const isGrave = log.severity === 'GRAVE' || log.category_id === 'TIPO_2';

                                        const badgeStyle = isCongrats
                                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                                            : isGravisima
                                            ? 'bg-rose-100 text-rose-900 border-rose-300 font-black'
                                            : isGrave
                                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                                            : 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black';

                                        const badgeLabel = isCongrats
                                            ? '⭐ Reconocimiento y Mérito'
                                            : isGravisima
                                            ? '🔴 Falta Gravísima (Tipo III)'
                                            : isGrave
                                            ? '🟡 Falta Grave (Tipo II)'
                                            : '🟢 Falta Leve (Tipo I)';

                                        return (
                                            <div key={log.id} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2 text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-[9.5px] px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
                                                        {badgeLabel}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{dateStr}</span>
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-xs font-black text-slate-800 leading-tight">
                                                        {log.title || 'Anotación Escolar'}
                                                    </h4>
                                                    {log.article && (
                                                        <span className="text-[9px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            📜 {log.article}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                                    {log.content}
                                                </p>

                                                {log.action_taken && (
                                                    <div className="text-[10.5px] font-semibold text-indigo-900 bg-indigo-50/80 border border-indigo-150 p-2 rounded-xl">
                                                        🎯 <strong>Medida / Compromiso:</strong> {log.action_taken}
                                                    </div>
                                                )}

                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-[10.5px]">
                                                    <span className="text-slate-500">
                                                        Registrado por: <strong className="text-slate-800">{log.author_name || 'Docente'}</strong>
                                                    </span>
                                                    {log.parent_signed ? (
                                                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-black flex items-center gap-1">
                                                            <CheckCircle2 size={12} /> Firmado (Acuse Recibido {signedDateStr ? `el ${signedDateStr}` : ''})
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg font-black flex items-center gap-1">
                                                            ⏳ Pendiente de firma del Acudiente
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
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
                                    <option value="Geometría">Geometría</option>
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
