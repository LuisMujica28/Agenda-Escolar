import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    Bold, Italic, Underline, List, ListOrdered, Link2, HelpCircle, 
    FileText, AlertTriangle, Users, UploadCloud, Printer, ArrowLeft,
    Check, Eye, Lightbulb, Send, FileCheck, RefreshCw, Sparkles, X, Lock
} from 'lucide-react';
import CircularDetailModal from '../../components/CircularDetailModal';
import { MOCK_STUDENTS } from '../../lib/mockData';

export default function CreateCircular() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Form States
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState('NORMAL');
    const [reqAck, setReqAck] = useState(false);
    const [circularNumber, setCircularNumber] = useState(36);
    const [isEditingNumber, setIsEditingNumber] = useState(false);
    const [tempNumber, setTempNumber] = useState(36);
    
    // Segmentación de Audiencias States
    const [targetType, setTargetType] = useState('ALL'); // 'ALL' | 'COURSE' | 'STUDENTS'
    const [targetCourse, setTargetCourse] = useState('');
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [studentsList, setStudentsList] = useState([]);
    const [coursesList, setCoursesList] = useState([]);
    const [studentSearch, setStudentSearch] = useState('');

    useEffect(() => {
        async function loadTargetData() {
            try {
                const sSnap = await getDocs(collection(db, 'students'));
                const list = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (list.length > 0) {
                    setStudentsList(list);
                    const courses = Array.from(new Set(list.map(s => s.grade).filter(Boolean))).sort();
                    setCoursesList(courses);
                    if (courses.length > 0) setTargetCourse(courses[0]);
                } else {
                    setStudentsList(MOCK_STUDENTS);
                    setCoursesList(['9A', '10A', '10B', '11A', '11B']);
                    setTargetCourse('9A');
                }
            } catch (error) {
                console.warn("Error loading data for circular targeting:", error);
                setStudentsList(MOCK_STUDENTS);
                setCoursesList(['9A', '10A', '10B', '11A', '11B']);
                setTargetCourse('9A');
            }
        }
        loadTargetData();
    }, []);
    
    // UI & Adjuntos States
    const [attachedFile, setAttachedFile] = useState(null);
    const [attachedFileData, setAttachedFileData] = useState(null);
    const [showOfficialPreview, setShowOfficialPreview] = useState(false);
    const [loading, setLoading] = useState(false);
    const [logoError, setLogoError] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => {
            setNotification({ show: false, message: '', type: 'success' });
        }, 4000);
    };

    // Actualizar fecha y hora actual en la vista previa
    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            
            // Fecha formateada: 20 de julio de 2026
            const optionsDate = { day: 'numeric', month: 'long', year: 'numeric' };
            setCurrentDate(now.toLocaleDateString('es-ES', optionsDate));

            // Hora formateada: 10:30 a.m.
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
            hours = hours % 12;
            hours = hours ? hours : 12; // el número 0 debe ser 12
            setCurrentTime(`${hours}:${minutes} ${ampm}`);
        };

        updateDateTime();
        const interval = setInterval(updateDateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    // Formatear texto del textarea al presionar un botón del toolbar
    const handleFormatText = (tag) => {
        const textarea = document.getElementById('circular-body');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        
        let replacement = '';
        if (tag === 'bold') replacement = `**${selectedText || 'texto'}**`;
        else if (tag === 'italic') replacement = `*${selectedText || 'texto'}*`;
        else if (tag === 'underline') replacement = `__${selectedText || 'texto'}__`;
        else if (tag === 'ul') replacement = `\n- ${selectedText || 'ítem'}`;
        else if (tag === 'ol') replacement = `\n1. ${selectedText || 'ítem'}`;
        else if (tag === 'link') replacement = `[${selectedText || 'texto del enlace'}](url)`;
        else if (tag === 'help') {
            showNotification("Consejo: Utiliza marcas de estilo como **negrita** o *cursiva* para resaltar información clave.", "success");
            return;
        }

        const newText = text.substring(0, start) + replacement + text.substring(end);
        setBody(newText);

        // Volver a dar foco
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 2, start + replacement.length - 2);
        }, 50);
    };

    // Manejar subida de archivo real codificado en Base64
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 700 * 1024) {
                showNotification("El archivo supera el límite de 700 KB para almacenamiento en base de datos.", "error");
                return;
            }
            setAttachedFile(file);

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                setAttachedFileData(reader.result);
            };
            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                showNotification("Error al procesar el archivo adjunto.", "error");
            };
        }
    };

    // Publicar circular en Firestore
    async function handleSubmit(e) {
        e.preventDefault();
        if (!title || !body) return;

        setLoading(true);
        try {
            let targetParentUids = [];
            if (targetType === 'ALL') {
                targetParentUids = ['ALL'];
            } else if (targetType === 'COURSE') {
                const courseStudents = studentsList.filter(s => s.grade === targetCourse);
                targetParentUids = Array.from(new Set(courseStudents.flatMap(s => s.parent_uids || [])));
            } else if (targetType === 'STUDENTS') {
                const chosenStudents = studentsList.filter(s => selectedStudents.includes(s.id));
                targetParentUids = Array.from(new Set(chosenStudents.flatMap(s => s.parent_uids || [])));
            }

            await addDoc(collection(db, "circulars"), {
                title,
                body,
                priority,
                requires_acknowledgment: reqAck,
                circular_number: Number(circularNumber),
                author_id: currentUser?.uid || 'anonymous',
                author_name: currentUser?.displayName || currentUser?.email || 'Administrador',
                created_at: serverTimestamp(),
                audience: targetType,
                target_type: targetType,
                target_course: targetType === 'COURSE' ? targetCourse : null,
                target_students: targetType === 'STUDENTS' ? selectedStudents : [],
                target_parent_uids: targetParentUids,
                read_by: [],
                attachment_name: attachedFile ? attachedFile.name : null,
                attachment_data: attachedFileData || null
            });
            
            showNotification("¡Circular publicada con éxito! Redirigiendo...", "success");
            setTimeout(() => {
                navigate('/'); // Volver al inicio
            }, 1500);
        } catch (error) {
            console.error("Error creando circular:", error);
            showNotification("Error al publicar la circular. Verifica la conexión.", "error");
        }
        setLoading(false);
    }

    const handleSaveBorrador = () => {
        showNotification("Borrador guardado en la memoria local.", "success");
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12 relative">
            {/* Notificación Flotante */}
            {notification.show && (
                <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-slide-in-right ${
                    notification.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
                        : 'bg-rose-50 border-rose-250 text-rose-800'
                }`}>
                    {notification.type === 'success' ? <Check size={18} className="text-emerald-650" /> : <AlertTriangle size={18} className="text-rose-650" />}
                    <span className="text-xs font-bold">{notification.message}</span>
                </div>
            )}
            {/* Encabezado Fijo Sugerido (Plantilla) */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-[1.2cm] h-[1.2cm] shrink-0 flex items-center justify-center">
                        {logoError ? (
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-indigo-900 text-indigo-950">
                                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3" />
                                <path d="M50 15 L20 40 L30 75 L70 75 L80 40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
                            </svg>
                        ) : (
                            <img 
                                src="/Escudo.png" 
                                alt="Escudo INAS" 
                                className="w-full h-full object-contain" 
                                onError={() => setLogoError(true)} 
                            />
                        )}
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-900 tracking-wider uppercase leading-none">
                            Instituto Nueva América de Suba
                        </h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                            Publicar Circular • Gestión de Comunicados Escolares
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-center shrink-0 flex items-center gap-3">
                        <div className="text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider leading-none">CIRCULAR N°</span>
                            {isEditingNumber ? (
                                <input
                                    type="number"
                                    value={tempNumber}
                                    onChange={e => setTempNumber(e.target.value)}
                                    className="w-16 border rounded px-1.5 py-0.5 text-xs font-black text-slate-800 focus:outline-none"
                                    onBlur={() => {
                                        setCircularNumber(tempNumber);
                                        setIsEditingNumber(false);
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            setCircularNumber(tempNumber);
                                            setIsEditingNumber(false);
                                        }
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <span className="text-lg font-black text-slate-800">{circularNumber}</span>
                            )}
                        </div>
                        {!isEditingNumber && (
                            <button 
                                onClick={() => {
                                    setTempNumber(circularNumber);
                                    setIsEditingNumber(true);
                                }}
                                className="text-[10px] text-indigo-600 font-extrabold hover:underline block bg-indigo-50 px-2 py-1 rounded-lg transition"
                            >
                                Cambiar
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={() => navigate('/')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-2xl transition shadow-sm"
                        title="Volver"
                    >
                        <ArrowLeft size={18} />
                    </button>
                </div>
            </div>

            {/* Layout principal en 2 columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Columna Editor (2/3 de ancho) */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
                    
                    {/* Caja Principal del Editor */}
                    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
                        <div className="flex items-center gap-3 border-b pb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center shrink-0">
                                <Send size={20} className="transform -rotate-12" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-slate-900 leading-tight">Redactar Nueva Circular</h2>
                                <p className="text-[11px] text-gray-400">Completa el formulario para enviar la notificación a toda la institución.</p>
                            </div>
                        </div>

                        {/* Campo Título */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Título de la circular *</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-3.5 text-slate-400"><FileText size={16} /></span>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ej: Reunión de Padres de Familia"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-bold text-slate-800 transition"
                                    required
                                />
                            </div>
                        </div>

                        {/* Campo Contenido con Toolbar */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contenido de la circular *</label>
                            
                            <div className="border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 transition">
                                {/* Toolbar de Formato */}
                                <div className="bg-slate-50 border-b border-gray-200 px-3 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatText('bold')}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                                            title="Negrita"
                                        >
                                            <Bold size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatText('italic')}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                                            title="Cursiva"
                                        >
                                            <Italic size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatText('underline')}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                                            title="Subrayado"
                                        >
                                            <Underline size={14} />
                                        </button>
                                        <div className="h-4 w-px bg-gray-200 mx-1"></div>
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatText('ul')}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                                            title="Lista Desordenada"
                                        >
                                            <List size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatText('ol')}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                                            title="Lista Ordenada"
                                        >
                                            <ListOrdered size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatText('link')}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
                                            title="Insertar Enlace"
                                        >
                                            <Link2 size={14} />
                                        </button>
                                    </div>

                                    <button 
                                        type="button" 
                                        onClick={() => handleFormatText('help')}
                                        className="p-1.5 text-slate-400 hover:text-indigo-650 rounded-lg hover:bg-slate-250/60 transition"
                                        title="Ayuda de formato"
                                    >
                                        <HelpCircle size={14} />
                                    </button>
                                </div>

                                {/* Textarea */}
                                <textarea
                                    id="circular-body"
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Escribe el mensaje de tu circular aquí..."
                                    maxLength="2000"
                                    className="w-full p-4 h-48 outline-none border-none text-xs leading-relaxed text-slate-700 resize-none bg-white"
                                    required
                                />

                                {/* Contador de Caracteres */}
                                <div className="bg-slate-50 border-t border-gray-100 px-4 py-2 flex justify-end text-[10px] text-gray-400 font-bold">
                                    {body.length} / 2000
                                </div>
                            </div>
                        </div>

                        {/* Audiencia / Enviar a */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-semibold">Enviar Circular a:</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setTargetType('ALL')}
                                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                                        targetType === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Toda la Institución
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetType('COURSE')}
                                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                                        targetType === 'COURSE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Por Curso
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetType('STUDENTS')}
                                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                                        targetType === 'STUDENTS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Estudiantes Específicos
                                </button>
                            </div>

                            {/* Selector de Curso */}
                            {targetType === 'COURSE' && (
                                <div className="space-y-1.5 animate-fade-in bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Seleccionar Curso / Grado</label>
                                    <select
                                        value={targetCourse}
                                        onChange={e => setTargetCourse(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-650 transition"
                                    >
                                        {coursesList.map(c => (
                                            <option key={c} value={c}>Curso {c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Selector de Estudiantes Múltiple */}
                            {targetType === 'STUDENTS' && (
                                <div className="space-y-3 animate-fade-in bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Buscar Estudiante</label>
                                        <input
                                            type="text"
                                            value={studentSearch}
                                            onChange={e => setStudentSearch(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-650 transition"
                                            placeholder="Escribe el nombre del estudiante..."
                                        />
                                    </div>

                                    {/* Resultados de Búsqueda Scrollable */}
                                    <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto p-2 bg-white divide-y divide-slate-50 space-y-1 shadow-inner">
                                        {studentsList
                                            .filter(s => s.name?.toLowerCase().includes(studentSearch.toLowerCase()))
                                            .map(student => {
                                                const isSelected = selectedStudents.includes(student.id);
                                                return (
                                                    <label key={student.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-[11px] transition">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    if (isSelected) {
                                                                        setSelectedStudents(prev => prev.filter(id => id !== student.id));
                                                                    } else {
                                                                        setSelectedStudents(prev => [...prev, student.id]);
                                                                    }
                                                                }}
                                                                className="rounded border-gray-300 text-indigo-650 focus:ring-indigo-500"
                                                            />
                                                            <span className="font-bold text-slate-700">{student.name}</span>
                                                        </div>
                                                        <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded font-extrabold text-slate-500 border">Curso {student.grade}</span>
                                                    </label>
                                                );
                                            })}
                                    </div>

                                    {/* Estudiantes Seleccionados (Tags) */}
                                    {selectedStudents.length > 0 && (
                                        <div className="space-y-1.5 border-t pt-2 mt-2">
                                            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Destinatarios Seleccionados ({selectedStudents.length})</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {studentsList
                                                    .filter(s => selectedStudents.includes(s.id))
                                                    .map(s => (
                                                        <span key={s.id} className="inline-flex items-center gap-1 text-[8.5px] bg-indigo-50 border border-indigo-150 text-indigo-800 px-2 py-0.5 rounded-lg font-bold">
                                                            {s.name} ({s.grade})
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedStudents(prev => prev.filter(id => id !== s.id))}
                                                                className="text-indigo-500 hover:text-indigo-850 hover:bg-indigo-100 p-0.5 rounded transition"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </span>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Opciones Adicionales */}
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Opciones adicionales</label>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Tarjeta Alta Prioridad */}
                                <div 
                                    onClick={() => setPriority(priority === 'HIGH' ? 'NORMAL' : 'HIGH')}
                                    className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all select-none active-press ${
                                        priority === 'HIGH' 
                                            ? 'bg-rose-50/50 border-rose-200 text-rose-800' 
                                            : 'bg-white border-slate-100 hover:bg-slate-50/50 text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                            priority === 'HIGH' ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'
                                        }`}>
                                            <AlertTriangle size={18} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-black">Alta prioridad</p>
                                            <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">Marca la circular como urgente</p>
                                        </div>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={priority === 'HIGH'} 
                                        onChange={() => {}} 
                                        className="rounded border-gray-300 text-rose-600 focus:ring-rose-500" 
                                    />
                                </div>

                                {/* Tarjeta Acuse de Recibo */}
                                <div 
                                    onClick={() => setReqAck(!reqAck)}
                                    className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all select-none active-press ${
                                        reqAck 
                                            ? 'bg-indigo-50/40 border-indigo-200 text-indigo-850' 
                                            : 'bg-white border-slate-100 hover:bg-slate-50/50 text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                            reqAck ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'
                                        }`}>
                                            <FileCheck size={18} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-black">Requiere acuse de recibo</p>
                                            <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">Los acudientes deberán firmar de leído</p>
                                        </div>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={reqAck} 
                                        onChange={() => {}}
                                        className="rounded border-gray-300 text-indigo-650 focus:ring-indigo-500" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Adjuntos */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-semibold">Adjuntos (opcional)</label>
                            
                            <div className="border-2 border-dashed border-indigo-100 hover:border-indigo-400/50 rounded-2xl p-6 text-center transition bg-slate-50/20 relative group">
                                <input 
                                    type="file" 
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.jpg,.png"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="space-y-1.5 pointer-events-none">
                                    <UploadCloud className="mx-auto text-indigo-300 group-hover:scale-105 transition-transform" size={28} />
                                    <p className="text-xs font-extrabold text-slate-600">
                                        {attachedFile ? attachedFile.name : 'Arrastra archivos aquí o haz clic para seleccionar'}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-medium">PDF, DOC, DOCX, JPG, PNG (Máx. 10MB)</p>
                                </div>
                            </div>
                            
                            {attachedFile && (
                                <div className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-700">
                                    <span className="truncate max-w-xs">📎 {attachedFile.name}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setAttachedFile(null)}
                                        className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Banner Informativo */}
                        <div className="bg-indigo-50/30 border border-indigo-100/50 p-3.5 rounded-2xl flex items-center gap-3 text-indigo-700 text-xs font-bold shadow-inner-soft">
                            <Users size={18} className="text-indigo-650 shrink-0" />
                            <span>La circular será visible para toda la comunidad educativa.</span>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex justify-end gap-3 pt-2 border-t">
                            <button
                                type="button"
                                onClick={handleSaveBorrador}
                                className="px-5 py-3 border border-gray-250 bg-white hover:bg-slate-50/50 rounded-2xl text-xs font-black text-slate-600 transition flex items-center gap-1.5 active-press shadow-sm"
                            >
                                <FileText size={14} /> Guardar borrador
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-3 bg-slate-900 hover:bg-slate-850 text-white rounded-2xl text-xs font-black shadow-md shadow-slate-900/10 transition flex items-center gap-1.5 active-press disabled:opacity-50"
                            >
                                {loading ? (
                                    <>Publicando...</>
                                ) : (
                                    <><Send size={14} className="transform -rotate-12" /> Publicar Circular</>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Columna Derecha (Consejos & Vista Previa) */}
                <div className="space-y-6">
                    
                    {/* Consejos para una buena circular */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-3.5">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-1 border-b">
                            <Lightbulb size={16} className="text-indigo-650" /> Consejos para una buena circular
                        </h3>
                        <ul className="space-y-2 text-xs font-semibold text-slate-600">
                            <li className="flex items-start gap-2.5">
                                <Check size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Usa un título claro y específico</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Check size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Incluye la información más importante primero</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Check size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Sé breve y directo</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Check size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Revisa la ortografía antes de publicar</span>
                            </li>
                        </ul>
                    </div>

                    {/* Tarjeta de Vista Previa */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                        <div className="flex justify-between items-center pb-1 border-b">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <Eye size={16} className="text-indigo-650" /> Vista previa
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowOfficialPreview(true)}
                                className="text-[9px] text-indigo-650 hover:text-indigo-850 font-extrabold uppercase tracking-wider px-2.5 py-1 bg-indigo-50/50 hover:bg-indigo-100 rounded-lg transition-all flex items-center gap-1 active-press border border-indigo-150"
                                title="Ver Vista Previa Oficial tipo PDF"
                            >
                                <Eye size={11} /> Ver en PDF (Carta/Oficio)
                            </button>
                        </div>

                        {/* Hoja oficial simulada de la circular */}
                        <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm space-y-4 text-left font-serif min-h-[300px] relative flex flex-col justify-between">
                            <div>
                                {/* Logo institucional en la vista previa */}
                                <div className="flex items-center gap-2.5 pb-2.5 border-b border-dashed">
                                    <div className="w-8 h-8 rounded bg-white flex items-center justify-center shrink-0 border shadow-sm">
                                        <img src="/Escudo.png" alt="Logo" className="w-6 h-6 object-contain" />
                                    </div>
                                    <div className="font-sans">
                                        <h4 className="text-[9px] font-black uppercase tracking-wide text-slate-900 leading-none">Instituto Nueva América</h4>
                                        <span className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-wide">De Suba</span>
                                    </div>
                                </div>

                                <div className="space-y-3 mt-3">
                                    {/* Número de Circular */}
                                    <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                                        Circular N° {circularNumber}
                                    </div>

                                    {/* Título en vivo */}
                                    <h4 className="text-xs font-bold text-slate-800 font-sans leading-tight">
                                        {title || 'Título de la circular'}
                                    </h4>

                                    {/* Contenido en vivo */}
                                    <p className="text-[10px] text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                                        {body || 'Aquí se mostrará el contenido de la circular...'}
                                    </p>
                                </div>
                            </div>

                            {/* Metadatos pie de página */}
                            <div className="pt-3 border-t border-dashed flex justify-between items-center text-[7.5px] font-sans font-extrabold text-slate-400 uppercase tracking-wide">
                                <span>Fecha: {currentDate}</span>
                                <span>Hora: {currentTime}</span>
                            </div>
                        </div>
                    </div>

                    {/* Ilustración de Comunicación Escolar (SVG Inline Premium) */}
                    <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-3xl p-5 shadow-sm text-center space-y-4 relative overflow-hidden flex flex-col items-center">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-2xl"></div>
                        
                        <div className="w-28 h-28 shrink-0">
                            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
                                {/* Fondo circular */}
                                <circle cx="100" cy="100" r="80" fill="#e0e7ff" opacity="0.6" />
                                <circle cx="100" cy="100" r="60" fill="#c7d2fe" opacity="0.4" />
                                
                                {/* Buzón de cartas */}
                                <rect x="70" y="80" width="60" height="50" rx="6" fill="#2563eb" />
                                <path d="M70 80 L100 105 L130 80 Z" fill="#1d4ed8" />
                                
                                {/* Carta flotante */}
                                <g transform="translate(10, -10) rotate(-10)">
                                    <rect x="75" y="45" width="45" height="30" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                                    <line x1="82" y1="55" x2="113" y2="55" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="82" y1="63" x2="105" y2="63" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                                </g>

                                {/* Avión de Papel volando */}
                                <g transform="translate(110, 70) rotate(15)">
                                    <path d="M0 0 L40 -15 L15 15 Z" fill="#4f46e5" />
                                    <path d="M15 15 L18 28 L24 18 Z" fill="#312e81" />
                                    <path d="M40 -15 L15 15 L10 5 Z" fill="#6366f1" />
                                </g>

                                {/* Nubes de fondo */}
                                <path d="M35 125 A 15 15 0 0 1 65 125 A 20 20 0 0 1 95 125 L35 125 Z" fill="#ffffff" opacity="0.8" />
                                <path d="M115 135 A 12 12 0 0 1 139 135 A 16 16 0 0 1 163 135 L115 135 Z" fill="#ffffff" opacity="0.8" />
                            </svg>
                        </div>
                        
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-black text-slate-800 leading-tight">La comunicación clara</h4>
                            <p className="text-[10px] text-slate-500 font-semibold leading-normal">fortalece nuestra comunidad</p>
                        </div>
                    </div>
                </div>

            </div>

            {showOfficialPreview && (
                <CircularDetailModal
                    circular={{
                        title: title || 'Título de la Circular',
                        body: body || 'Cuerpo del comunicado...',
                        priority,
                        circular_number: Number(circularNumber) || 36,
                        created_at: { seconds: Date.now() / 1000 },
                        author_name: currentUser?.displayName || currentUser?.email || 'Administrador',
                        attachment_name: attachedFile ? attachedFile.name : null,
                        attachment_data: attachedFileData || null,
                        requires_acknowledgment: reqAck
                    }}
                    onClose={() => setShowOfficialPreview(false)}
                    currentUserId={currentUser?.uid}
                    previewOnly={true}
                />
            )}
        </div>
    );
}
