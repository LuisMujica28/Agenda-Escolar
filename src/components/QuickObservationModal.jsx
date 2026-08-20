import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
    X, Search, Zap, CheckCircle2, AlertTriangle, ShieldAlert, Star, 
    Clock, Users, User, ArrowRight, Loader2, Sparkles, Send, BellRing, Filter, Check
} from 'lucide-react';
import { CONVIVENCIA_CATEGORIES, CONVIVENCIA_PRESETS } from '../lib/convivenciaCatalog';

export default function QuickObservationModal({ isOpen, onClose, initialStudentId = null, onSuccess }) {
    const { currentUser, userRole } = useAuth();

    // Estado del selector de estudiantes
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
    const [searchStudent, setSearchStudent] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Estado de la falta / novedad
    const [activeCategoryTab, setActiveCategoryTab] = useState('TIPO_1'); // TIPO_1, TIPO_2, TIPO_3, RECONOCIMIENTO
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [customArticle, setCustomArticle] = useState('Art. 12 Num. 1 - Puntualidad e Ingreso al Plantel');
    const [customTitle, setCustomTitle] = useState('');
    const [customContent, setCustomContent] = useState('');
    const [additionalTeacherNotes, setAdditionalTeacherNotes] = useState('');
    const [actionTaken, setActionTaken] = useState('');
    const [notifyParents, setNotifyParents] = useState(true);

    // Estado de guardado y feedback
    const [saving, setSaving] = useState(false);
    const [successState, setSuccessState] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        async function fetchStudents() {
            setLoadingStudents(true);
            try {
                const snap = await getDocs(collection(db, 'students'));
                const list = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(s => s.status !== 'retirado');

                setStudents(list);

                const cSet = new Set(list.map(s => s.grade).filter(Boolean));
                const sortedCourses = Array.from(cSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                setCourses(sortedCourses);

                if (initialStudentId) {
                    setSelectedStudentIds([initialStudentId]);
                    const currentSt = list.find(s => s.id === initialStudentId);
                    if (currentSt && currentSt.grade) {
                        setSelectedCourseFilter(currentSt.grade);
                    }
                }
            } catch (err) {
                console.error("Error al cargar estudiantes en modal rápido:", err);
            } finally {
                setLoadingStudents(false);
            }
        }

        fetchStudents();
    }, [isOpen, initialStudentId]);

    // Al seleccionar un preset de falta
    const handleSelectPreset = (preset) => {
        setSelectedPreset(preset);
        if (preset.category) {
            setActiveCategoryTab(preset.category);
        }
        setCustomArticle(preset.article || '');
        setCustomTitle(preset.title);
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCustomContent(preset.getTemplate(timeNow));
        setActionTaken(preset.suggestedAction || '');
        setAdditionalTeacherNotes('');
    };

    // Alternar selección de un estudiante
    const toggleStudentSelection = (studentId) => {
        setSelectedStudentIds(prev => {
            if (prev.includes(studentId)) {
                return prev.filter(id => id !== studentId);
            } else {
                return [...prev, studentId];
            }
        });
    };

    // Seleccionar todos los del curso actual filtrado
    const handleSelectAllCurrentFilter = () => {
        const filteredList = getFilteredStudents();
        const allIds = filteredList.map(s => s.id);
        const allSelected = allIds.every(id => selectedStudentIds.includes(id));

        if (allSelected) {
            setSelectedStudentIds(prev => prev.filter(id => !allIds.includes(id)));
        } else {
            setSelectedStudentIds(prev => Array.from(new Set([...prev, ...allIds])));
        }
    };

    // Filtrar estudiantes por curso y término de búsqueda
    const getFilteredStudents = () => {
        return students.filter(s => {
            const matchesCourse = selectedCourseFilter === 'ALL' || s.grade === selectedCourseFilter;
            const term = searchStudent.toLowerCase().trim();
            const fullName = `${s.lastName || ''} ${s.firstName || ''} ${s.name || ''}`.toLowerCase();
            const code = (s.id_code || '').toLowerCase();
            const matchesSearch = !term || fullName.includes(term) || code.includes(term);
            return matchesCourse && matchesSearch;
        }).sort((a, b) => {
            const nameA = a.lastName && a.firstName ? `${a.lastName} ${a.firstName}` : (a.name || '');
            const nameB = b.lastName && b.firstName ? `${b.lastName} ${b.firstName}` : (b.name || '');
            return nameA.localeCompare(nameB);
        });
    };

    // Guardar la observación y despachar notificaciones a los padres
    const handleSaveAndNotify = async (e) => {
        e.preventDefault();
        if (selectedStudentIds.length === 0) {
            setErrorMessage('Debes seleccionar al menos un estudiante.');
            return;
        }
        if (!customTitle.trim() || !customContent.trim()) {
            setErrorMessage('Por favor especifica el título y la descripción de la falta u observación.');
            return;
        }

        setSaving(true);
        setErrorMessage('');

        try {
            // Deducción precisa de la categoría (Preset -> Texto -> Tab)
            let effectiveCat = selectedPreset?.category || activeCategoryTab;
            const lowerTitle = customTitle.toLowerCase();
            if (lowerTitle.includes('reconocimiento') || lowerTitle.includes('mérito') || lowerTitle.includes('felicitación') || lowerTitle.includes('superación') || lowerTitle.includes('excelencia')) {
                effectiveCat = 'RECONOCIMIENTO';
            } else if (lowerTitle.includes('gravísima') || lowerTitle.includes('tipo iii') || lowerTitle.includes('agresión') || lowerTitle.includes('acoso')) {
                effectiveCat = 'TIPO_3';
            } else if (lowerTitle.includes('grave') || lowerTitle.includes('tipo ii') || lowerTitle.includes('evasión') || lowerTitle.includes('fraude')) {
                effectiveCat = 'TIPO_2';
            }

            const categoryObj = CONVIVENCIA_CATEGORIES[effectiveCat] || CONVIVENCIA_CATEGORIES.TIPO_1;
            const chosenStudents = students.filter(s => selectedStudentIds.includes(s.id));
            const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Docente / Directivo';

            // Contenido compuesto con observaciones adicionales si existen
            const finalFullContent = additionalTeacherNotes.trim() 
                ? `${customContent.trim()}\n\n📌 Observaciones adicionales del docente: ${additionalTeacherNotes.trim()}`
                : customContent.trim();

            for (const st of chosenStudents) {
                const displayName = st.lastName && st.firstName ? `${st.firstName} ${st.lastName}` : st.name;

                const isCongrats = effectiveCat === 'RECONOCIMIENTO';
                const isAlert = effectiveCat === 'TIPO_3' || effectiveCat === 'TIPO_2';

                // 1. Guardar en 'observation_logs' (Hoja de vida digital del alumno)
                const obsLogRef = await addDoc(collection(db, 'observation_logs'), {
                    student_id: st.id,
                    student_name: displayName,
                    student_grade: st.grade,
                    student_id_code: st.id_code || '',
                    author_id: currentUser?.uid || 'system',
                    author_name: authorName,
                    author_email: currentUser?.email || '',
                    author_role: userRole || 'teacher',
                    type: isCongrats ? 'CONGRATS' : isAlert ? 'ALERT' : 'NOTE',
                    category_id: effectiveCat,
                    category_name: categoryObj.name,
                    severity: categoryObj.severity,
                    article: customArticle.trim() || selectedPreset?.article || '',
                    preset_id: selectedPreset?.id || 'manual',
                    title: customTitle.trim(),
                    content: finalFullContent,
                    action_taken: actionTaken.trim(),
                    created_at: serverTimestamp(),
                    requires_parent_signature: true,
                    parent_signed: false,
                    parent_signed_at: null,
                    parent_signed_by: null
                });

                // 2. Si está activado notificar a padres, enviar a 'messages' con prioridad
                if (notifyParents) {
                    const parentUids = st.parent_uids && st.parent_uids.length > 0 ? st.parent_uids : [];
                    const isHighPrio = activeCategoryTab === 'TIPO_2' || activeCategoryTab === 'TIPO_3';

                    const messageBody = `Estimado(a) Acudiente:\n\nSe ha registrado una novedad en el observador oficial de ${displayName} (${st.grade}):\n\n📌 Categoría: ${categoryObj.name}\n📜 Artículo: ${customArticle.trim() || 'Manual de Convivencia'}\n📋 Asunto: ${customTitle}\n📝 Descripción: ${finalFullContent}\n${actionTaken ? `🎯 Medida / Compromiso: ${actionTaken}\n` : ''}\nPor favor ingrese al módulo de 'Observador del Alumno' en la plataforma para firmar digitalmente el acuse de recibo de esta comunicación.\n\nAtentamente,\n${authorName} - Instituto Nueva América de Suba (INAS)`;

                    await addDoc(collection(db, 'messages'), {
                        sender_id: currentUser?.uid || 'staff',
                        sender_name: authorName,
                        sender_role: userRole || 'teacher',
                        receiver_id: parentUids.length > 0 ? parentUids[0] : 'ALL_PARENTS',
                        receiver_name: `Familia de ${displayName}`,
                        target_type: 'STUDENT',
                        target_students: [st.id],
                        target_parent_uids: parentUids,
                        subject: `[Observador Escolar] ${categoryObj.shortName}: ${customTitle} - ${displayName}`,
                        body: messageBody,
                        category: 'Convivencia',
                        priority: isHighPrio ? 'Alta' : 'Normal',
                        related_observation_id: obsLogRef.id,
                        created_at: serverTimestamp(),
                        read: false,
                        read_at: null,
                        read_by: []
                    });
                }
            }

            setSuccessState(true);
            if (onSuccess) onSuccess();

            setTimeout(() => {
                setSuccessState(false);
                setSelectedPreset(null);
                setCustomTitle('');
                setCustomContent('');
                setActionTaken('');
                setSelectedStudentIds([]);
                onClose();
            }, 1400);

        } catch (err) {
            console.error("Error al registrar observación rápida:", err);
            setErrorMessage("Ocurrió un error al guardar la novedad: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const filteredStudents = getFilteredStudents();
    const currentCategory = CONVIVENCIA_CATEGORIES[activeCategoryTab] || CONVIVENCIA_CATEGORIES.TIPO_1;
    const presetsForCategory = CONVIVENCIA_PRESETS.filter(p => p.category === activeCategoryTab);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-xs animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
                
                {/* Header del Modal */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
                            <Zap size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black tracking-tight">
                                    Registro Rápido de Faltas y Observador
                                </h2>
                                <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    Manual INAS
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                                Diligencia en 3 clics y notifica automáticamente a la familia.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 rounded-2xl hover:bg-slate-800 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Mensaje de Éxito Emergente */}
                {successState && (
                    <div className="p-6 bg-emerald-50 border-b border-emerald-200 text-emerald-900 flex flex-col items-center justify-center gap-2 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center animate-bounce">
                            <CheckCircle2 size={28} />
                        </div>
                        <h3 className="text-base font-black">¡Anotación Guardada y Notificada con Éxito!</h3>
                        <p className="text-xs text-emerald-700 font-medium">
                            Se registró en el observador de {selectedStudentIds.length} estudiante(s) y se despachó el mensaje a los padres.
                        </p>
                    </div>
                )}

                {/* Contenido Principal con 2 Columnas Divididas */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* Columna Izquierda: Selección de Estudiante(s) (5 de 12) */}
                    <div className="lg:col-span-5 flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-slate-200 pb-5 lg:pb-0 lg:pr-5">
                        
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Users size={15} className="text-indigo-600" />
                                1. Seleccionar Estudiante(s)
                            </label>
                            <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                {selectedStudentIds.length} elegido(s)
                            </span>
                        </div>

                        {/* Buscador y Filtro por Curso */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchStudent}
                                    onChange={e => setSearchStudent(e.target.value)}
                                    placeholder="Buscar por apellido o nombre..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <select
                                    value={selectedCourseFilter}
                                    onChange={e => setSelectedCourseFilter(e.target.value)}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                >
                                    <option value="ALL">Todos los Cursos</option>
                                    {courses.map(c => (
                                        <option key={c} value={c}>Curso {c}</option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={handleSelectAllCurrentFilter}
                                    className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-xl transition shrink-0"
                                >
                                    {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))
                                        ? 'Desmarcar lista'
                                        : 'Marcar lista'}
                                </button>
                            </div>
                        </div>

                        {/* Lista Scrollable de Estudiantes */}
                        <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-2xl p-1 bg-slate-50/50">
                            {loadingStudents ? (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                                    <span className="text-xs font-bold">Cargando listado oficial...</span>
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                                    No se encontraron estudiantes para este filtro.
                                </div>
                            ) : (
                                filteredStudents.map(st => {
                                    const isSelected = selectedStudentIds.includes(st.id);
                                    const displayName = st.lastName && st.firstName ? `${st.lastName} ${st.firstName}` : st.name;

                                    return (
                                        <div
                                            key={st.id}
                                            onClick={() => toggleStudentSelection(st.id)}
                                            className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                                                isSelected
                                                    ? 'bg-indigo-50 border-indigo-300 shadow-2xs'
                                                    : 'bg-white border-slate-200/80 hover:bg-slate-100/70'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 transition ${
                                                    isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-transparent'
                                                }`}>
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                                                        {displayName}
                                                    </p>
                                                    <span className="text-[9.5px] font-semibold text-slate-400">
                                                        Curso <strong className="text-slate-600">{st.grade}</strong> {st.id_code ? `• ${st.id_code}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-md">
                                                    Elegido
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>

                    {/* Columna Derecha: Catálogo de Faltas y Editor Rápido (7 de 12) */}
                    <div className="lg:col-span-7 flex flex-col gap-4">
                        
                        {/* Selector de Nivel de Falta */}
                        <div>
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-2">
                                2. Tipo de Situación / Falta (Manual de Convivencia)
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryTab('TIPO_1')}
                                    className={`py-2 px-2 rounded-xl text-[11px] font-black transition text-center ${
                                        activeCategoryTab === 'TIPO_1' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    🟢 Tipo I (Leve)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryTab('TIPO_2')}
                                    className={`py-2 px-2 rounded-xl text-[11px] font-black transition text-center ${
                                        activeCategoryTab === 'TIPO_2' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    🟡 Tipo II (Grave)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryTab('TIPO_3')}
                                    className={`py-2 px-2 rounded-xl text-[11px] font-black transition text-center ${
                                        activeCategoryTab === 'TIPO_3' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    🔴 Tipo III (Gravísima)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryTab('RECONOCIMIENTO')}
                                    className={`py-2 px-2 rounded-xl text-[11px] font-black transition text-center ${
                                        activeCategoryTab === 'RECONOCIMIENTO' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    ⭐ Mérito / Elogio
                                </button>
                            </div>
                        </div>

                        {/* Botones de Presets de 1 Toque */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-slate-500">
                                    Toca una opción predefinida para autocompletar:
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {presetsForCategory.map(preset => {
                                    const isCurrent = selectedPreset?.id === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => handleSelectPreset(preset)}
                                            className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 active-press ${
                                                isCurrent 
                                                    ? `${currentCategory.pillColor} shadow-sm ring-2 ring-indigo-500/30 font-black` 
                                                    : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200 shadow-2xs'
                                            }`}
                                        >
                                            <span>{preset.shortTitle}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Editor de Título, Artículo y Descripción de la Novedad */}
                        <div className="space-y-2.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-left">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-8">
                                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                                        Título / Asunto de la Novedad *
                                    </label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={e => setCustomTitle(e.target.value)}
                                        placeholder="Ej: Retardo al ingreso de la jornada escolar..."
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                    />
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="block text-[11px] font-black text-indigo-900 mb-1 flex items-center gap-1">
                                        <span>📜 Artículo Oficial</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customArticle}
                                        onChange={e => setCustomArticle(e.target.value)}
                                        placeholder="Ej: Art. 12 Num. 1..."
                                        className="w-full bg-indigo-50/60 border border-indigo-200 rounded-xl px-2.5 py-2 text-xs font-bold text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-black text-slate-700">
                                        Descripción Pedagógica / Hechos (Editable) *
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        Puedes modificar o escribir libremente
                                    </span>
                                </div>
                                <textarea
                                    value={customContent}
                                    onChange={e => setCustomContent(e.target.value)}
                                    placeholder="Detalla los hechos ocurridos de manera clara y formativa..."
                                    rows={3}
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                />
                            </div>

                            {/* Campo para Anexar Comentario Adicional Rápido sin borrar la plantilla */}
                            <div className="bg-amber-50/60 border border-amber-200/70 p-2.5 rounded-xl space-y-1.5">
                                <label className="block text-[10.5px] font-black text-amber-950 flex items-center justify-between">
                                    <span>➕ Anexar Detalle Adicional del Docente (Opcional):</span>
                                    <span className="text-[9.5px] text-amber-700 font-normal">Se sumará al mensaje</span>
                                </label>
                                <input
                                    type="text"
                                    value={additionalTeacherNotes}
                                    onChange={e => setAdditionalTeacherNotes(e.target.value)}
                                    placeholder="Ej: Llegó 25 min tarde por congestión vehicular / No trajo la excusa firmada..."
                                    className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    🎯 Compromiso Pedagógico / Medida Sugerida
                                </label>
                                <input
                                    type="text"
                                    value={actionTaken}
                                    onChange={e => setActionTaken(e.target.value)}
                                    placeholder="Ej: Llamado de atención formativo, compromiso de puntualidad en agenda..."
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/20"
                                />
                            </div>
                        </div>

                        {/* Opciones de Notificación */}
                        <div className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 p-3 rounded-2xl">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notifyParents}
                                    onChange={e => setNotifyParents(e.target.checked)}
                                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <div className="text-left">
                                    <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1">
                                        <BellRing size={13} className="text-indigo-600" /> Notificar a los Padres Inmediatamente
                                    </p>
                                    <p className="text-[10px] text-indigo-700 font-medium">
                                        Envía el comunicado al buzón del acudiente y solicita firma digital de enterado.
                                    </p>
                                </div>
                            </label>
                        </div>

                        {errorMessage && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700">
                                {errorMessage}
                            </div>
                        )}

                        {/* Botón de Envío Rápido */}
                        <button
                            type="button"
                            onClick={handleSaveAndNotify}
                            disabled={saving || selectedStudentIds.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-600/15 disabled:opacity-50 active-press"
                        >
                            {saving ? (
                                <><Loader2 className="animate-spin" size={18} /> Guardando y Despachando...</>
                            ) : (
                                <><Send size={16} /> Guardar Anotación ({selectedStudentIds.length} Alumnos) <ArrowRight size={16} /></>
                            )}
                        </button>

                    </div>

                </div>

            </div>
        </div>
    );
}
