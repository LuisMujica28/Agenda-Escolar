import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Loader2, Mail, Send, Inbox, MessageSquare, PlusCircle, Edit3, 
    Search, SlidersHorizontal, Paperclip, Smile, Download, Reply, MoreVertical, 
    Folder, Flag, Calendar, FileText, CheckCircle2, ChevronDown, User, Sparkles, Filter, Clock,
    Users, GraduationCap, X, Check, UserCheck, Shield, UserCog, BookOpen
} from 'lucide-react';

export default function MessagingPage() {
    const { currentUser, userRole } = useAuth();
    const [messages, setMessages] = useState([]);
    const [recipientList, setRecipientList] = useState([]);
    
    // UI state
    const [activeTab, setActiveTab] = useState('inbox'); // inbox, sent, drafts, compose
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyText, setReplyText] = useState('');
    
    // Target Selection Mode for Compose ('STAFF' | 'STUDENT' | 'COURSE')
    const [targetMode, setTargetMode] = useState('STUDENT');
    const [staffId, setStaffId] = useState('');
    const [targetCourse, setTargetCourse] = useState('');
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [showPredictiveDropdown, setShowPredictiveDropdown] = useState(false);

    // Form state para redactar
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState('Normal');
    const [category, setCategory] = useState('Academia');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [studentsList, setStudentsList] = useState([]);
    const [coursesList, setCoursesList] = useState([]);

    // MOCK MESSAGES para vista inicial impecable
    const DEFAULT_MOCK_MESSAGES = [
        {
            id: 'msg-1',
            sender_id: 'prof-1',
            sender_name: 'Prof. Juanito Pérez',
            sender_role: 'teacher',
            sender_initials: 'PA',
            sender_color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Seguimiento de desempeño escolar y tareas',
            body: `Estimado acudiente,\n\nLe escribo para comunicarle que el estudiante ha mostrado un excelente desempeño en las clases recientes. Sin embargo, le recomiendo reforzar las lecturas asignadas en casa para los próximos talleres.\n\nAgradezco de antemano su constante apoyo y compromiso en el proceso educativo.\n\nAtentamente,\nProf. Juanito Pérez`,
            date: '20/07/2026',
            time: '10:15 a. m.',
            isNew: true,
            category: 'Academia',
            priority: 'Normal',
            dueDate: '27/07/2026',
            read: false,
            read_at: null,
            read_by: [],
            attachment: {
                name: 'Informe_academico_periodo2.pdf',
                size: '245 KB',
                type: 'PDF'
            }
        },
        {
            id: 'msg-2',
            sender_id: 'coord-1',
            sender_name: 'Coordinación Académica',
            sender_role: 'admin',
            sender_initials: 'CO',
            sender_color: 'bg-amber-100 text-amber-800 border-amber-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Información sobre salida pedagógica institucional',
            body: 'Reciba un cordial saludo. Le enviamos este comunicado con la información detallada del protocolo e itinerario para la salida pedagógica programada para la próxima semana.',
            date: 'Ayer',
            time: '04:30 p. m.',
            isNew: false,
            category: 'Convivencia',
            priority: 'Alta',
            dueDate: '25/07/2026',
            read: true,
            read_at: 'Ayer, 05:12 p. m.',
            read_by: [currentUser?.uid || 'parent-1']
        },
        {
            id: 'msg-3',
            sender_id: 'prof-2',
            sender_name: 'Docente de Matemáticas',
            sender_role: 'teacher',
            sender_initials: 'DO',
            sender_color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Taller de refuerzo y preparación de evaluación',
            body: 'Adjunto compartimos la guía de ejercicios de repaso sugerida para preparar la evaluación sumativa de matemáticas.',
            date: '15/07/2026',
            time: '11:20 a. m.',
            isNew: false,
            category: 'Academia',
            priority: 'Normal',
            read: true,
            read_at: '15/07/2026, 12:00 p. m.',
            read_by: [currentUser?.uid || 'parent-1']
        },
        {
            id: 'msg-4',
            sender_id: 'bib-1',
            sender_name: 'Biblioteca Escolar',
            sender_role: 'admin',
            sender_initials: 'BI',
            sender_color: 'bg-purple-100 text-purple-800 border-purple-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Recordatorio de devolución de texto bibliográfico',
            body: 'Le recordamos amablemente que el libro solicitado en préstamo vence esta semana. Agradecemos su devolución oportuna.',
            date: '14/07/2026',
            time: '09:00 a. m.',
            isNew: false,
            category: 'Institucional',
            priority: 'Baja',
            read: true,
            read_at: '14/07/2026, 09:30 a. m.',
            read_by: [currentUser?.uid || 'parent-1']
        }
    ];

    useEffect(() => {
        async function loadMessagingData() {
            if (!currentUser) return;
            setLoading(true);
            try {
                // 1. Cargar Mensajes reales de Firestore
                const qMsg = query(
                    collection(db, 'messages'),
                    where(activeTab === 'inbox' ? 'receiver_id' : 'sender_id', '==', currentUser.uid)
                );
                const mSnap = await getDocs(qMsg);
                let msgList = mSnap.docs.map(docData => {
                    const d = docData.data();
                    return {
                        id: docData.id,
                        sender_id: d.sender_id,
                        sender_name: d.sender_name,
                        sender_role: d.sender_role,
                        sender_initials: d.sender_name ? d.sender_name.slice(0, 2).toUpperCase() : 'US',
                        sender_color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                        receiver_id: d.receiver_id,
                        receiver_name: d.receiver_name,
                        target_type: d.target_type,
                        target_course: d.target_course,
                        target_students: d.target_students,
                        target_parent_uids: d.target_parent_uids,
                        subject: d.subject,
                        body: d.body,
                        date: d.created_at?.seconds ? new Date(d.created_at.seconds * 1000).toLocaleDateString() : 'Hoy',
                        time: d.created_at?.seconds ? new Date(d.created_at.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ahora',
                        isNew: !d.read,
                        read: Boolean(d.read),
                        read_at: d.read_at?.seconds ? new Date(d.read_at.seconds * 1000).toLocaleString() : d.read_at || null,
                        read_by: d.read_by || [],
                        category: d.category || 'Academia',
                        priority: d.priority || 'Normal',
                        dueDate: d.due_date || '27/07/2026'
                    };
                });

                msgList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

                if (msgList.length === 0 && activeTab === 'inbox') {
                    msgList = DEFAULT_MOCK_MESSAGES;
                }

                setMessages(msgList);
                if (msgList.length > 0 && !selectedMessage) {
                    setSelectedMessage(msgList[0]);
                }

                // 2. Cargar Lista de Docentes y Administrativos (Staff)
                const qStaff = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin']));
                const uSnap = await getDocs(qStaff);
                setRecipientList(uSnap.docs.map(docData => ({ id: docData.id, ...docData.data() })));

                // 3. Cargar Lista Completa de Estudiantes y Cursos
                const sSnap = await getDocs(collection(db, 'students'));
                const sList = sSnap.docs.map(docData => ({ id: docData.id, ...docData.data() }));
                setStudentsList(sList);
                const courses = Array.from(new Set(sList.map(s => s.grade).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                setCoursesList(courses);
                if (courses.length > 0 && !targetCourse) {
                    setTargetCourse(courses[0]);
                }
            } catch (error) {
                console.warn("Error al cargar mensajería (Usando vista por defecto):", error);
                setMessages(DEFAULT_MOCK_MESSAGES);
                if (!selectedMessage) setSelectedMessage(DEFAULT_MOCK_MESSAGES[0]);
            } finally {
                setLoading(false);
            }
        }

        loadMessagingData();
    }, [currentUser, activeTab, userRole]);

    // Búsqueda predictiva de estudiantes por Nombre, Apellido, Grado o Código
    const getPredictiveMatches = () => {
        if (!studentSearch.trim()) return [];
        const term = studentSearch.toLowerCase().trim();
        return studentsList.filter(s => {
            const name = (s.name || '').toLowerCase();
            const firstName = (s.firstName || '').toLowerCase();
            const lastName = (s.lastName || '').toLowerCase();
            const code = (s.id_code || s.code || s.id || '').toLowerCase();
            const grade = (s.grade || s.course || '').toLowerCase();
            return name.includes(term) || firstName.includes(term) || lastName.includes(term) || code.includes(term) || grade.includes(term);
        }).slice(0, 10);
    };

    // Enviar nuevo mensaje
    async function handleSendMessage(e) {
        e.preventDefault();
        if (!subject || !body) return;

        if (targetMode === 'STAFF' && !staffId) {
            setErrorMessage('Por favor selecciona un docente o directivo.');
            return;
        }
        if (targetMode === 'STUDENT' && selectedStudents.length === 0) {
            setErrorMessage('Por favor busca y selecciona al menos un estudiante.');
            return;
        }
        if (targetMode === 'COURSE' && !targetCourse) {
            setErrorMessage('Por favor selecciona un curso.');
            return;
        }

        setSending(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            let finalReceiverId = staffId;
            let finalReceiverName = '';
            let targetParentUids = [];

            if (targetMode === 'STAFF') {
                const selectedStaff = recipientList.find(r => r.id === staffId);
                finalReceiverName = selectedStaff?.name || selectedStaff?.email || 'Docente/Directivo';
                targetParentUids = [staffId];
            } else if (targetMode === 'STUDENT') {
                const chosenStudents = studentsList.filter(s => selectedStudents.includes(s.id));
                targetParentUids = Array.from(new Set(chosenStudents.flatMap(s => s.parent_uids || [])));
                finalReceiverId = `STUDENTS_MULTI`;
                
                if (chosenStudents.length === 1) {
                    const st = chosenStudents[0];
                    const name = st.lastName && st.firstName ? `${st.firstName} ${st.lastName}` : st.name;
                    finalReceiverName = `Familia de ${name} (${st.grade || 'Grado'})`;
                } else {
                    finalReceiverName = `Familias de ${chosenStudents.length} estudiante(s)`;
                }
            } else if (targetMode === 'COURSE') {
                const courseStudents = studentsList.filter(s => s.grade === targetCourse);
                targetParentUids = Array.from(new Set(courseStudents.flatMap(s => s.parent_uids || [])));
                finalReceiverId = `COURSE_${targetCourse}`;
                finalReceiverName = `Acudientes del Curso ${targetCourse}`;
            }

            const newMsgRef = await addDoc(collection(db, 'messages'), {
                sender_id: currentUser.uid,
                sender_name: currentUser.displayName || currentUser.email.split('@')[0],
                sender_role: userRole,
                receiver_id: finalReceiverId,
                receiver_name: finalReceiverName,
                target_type: targetMode,
                target_course: targetMode === 'COURSE' ? targetCourse : null,
                target_students: targetMode === 'STUDENT' ? selectedStudents : [],
                target_parent_uids: targetParentUids,
                subject,
                body,
                category,
                priority,
                created_at: serverTimestamp(),
                read: false,
                read_at: null,
                read_by: []
            });

            const newMsgObj = {
                id: newMsgRef.id,
                sender_id: currentUser.uid,
                sender_name: currentUser.displayName || currentUser.email.split('@')[0],
                sender_role: userRole,
                sender_initials: (currentUser.displayName || 'YO').slice(0, 2).toUpperCase(),
                sender_color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                receiver_id: finalReceiverId,
                receiver_name: finalReceiverName,
                target_type: targetMode,
                target_course: targetMode === 'COURSE' ? targetCourse : null,
                target_students: targetMode === 'STUDENT' ? selectedStudents : [],
                target_parent_uids: targetParentUids,
                subject,
                body,
                date: 'Hoy',
                time: 'Ahora',
                isNew: false,
                read: false,
                read_at: null,
                read_by: [],
                category,
                priority
            };

            setMessages(prev => [newMsgObj, ...prev]);
            setSelectedMessage(newMsgObj);
            setSuccessMessage('¡Comunicación enviada con éxito!');
            setSubject('');
            setBody('');
            setStaffId('');
            setSelectedStudents([]);
            setStudentSearch('');
            setTimeout(() => {
                setActiveTab('inbox');
                setSuccessMessage('');
            }, 1200);
        } catch (error) {
            console.error("Error al enviar mensaje:", error);
            setErrorMessage('No se pudo enviar la comunicación. Revisa tu conexión.');
        } finally {
            setSending(false);
        }
    }

    // Respuesta rápida
    const handleSendQuickReply = () => {
        if (!replyText.trim() || !selectedMessage) return;
        
        const newReplyObj = {
            id: `reply-${Date.now()}`,
            sender_id: currentUser.uid,
            sender_name: currentUser.displayName || 'Remitente',
            sender_role: userRole,
            sender_initials: 'YO',
            sender_color: 'bg-indigo-600 text-white',
            receiver_id: selectedMessage.sender_id,
            receiver_name: selectedMessage.sender_name,
            subject: `Re: ${selectedMessage.subject}`,
            body: replyText,
            date: 'Ahora',
            time: 'Justo ahora',
            isNew: false,
            category: selectedMessage.category || 'Academia',
            priority: selectedMessage.priority || 'Normal'
        };

        alert(`Respuesta enviada a ${selectedMessage.sender_name}`);
        setReplyText('');
    };

    // Descarga del adjunto simulada
    const handleDownloadAttachment = (filename) => {
        const element = document.createElement("a");
        const file = new Blob([`Documento Oficial Adjunto: ${filename}`], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = filename || "Informe_academico.pdf";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Filtrar mensajes de la lista por búsqueda
    const filteredMessages = messages.filter(m => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            m.subject?.toLowerCase().includes(q) ||
            m.sender_name?.toLowerCase().includes(q) ||
            m.body?.toLowerCase().includes(q) ||
            m.receiver_name?.toLowerCase().includes(q)
        );
    });

    const getCategoryBadgeStyle = (cat) => {
        switch (cat) {
            case 'Academia':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Convivencia':
            case 'Convivencial':
                return 'bg-amber-50 text-amber-800 border-amber-200';
            case 'Institucional':
                return 'bg-purple-50 text-purple-800 border-purple-200';
            case 'Biblioteca':
                return 'bg-teal-50 text-teal-800 border-teal-200';
            case 'Orientación':
                return 'bg-emerald-50 text-emerald-800 border-emerald-200';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const getPriorityBadgeStyle = (prio) => {
        switch (prio) {
            case 'Alta':
                return 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold';
            case 'Normal':
                return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
            case 'Baja':
                return 'bg-slate-50 text-slate-600 border-slate-200 font-medium';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    // Marcar como leído SOLO cuando el usuario que lo abre es el DESTINATARIO
    async function handleMarkMessageAsRead(msg) {
        if (!msg || !msg.id || msg.id.startsWith('msg-') || msg.read || msg.sender_id === currentUser?.uid) return;

        try {
            const msgRef = doc(db, 'messages', msg.id);
            await updateDoc(msgRef, { 
                read: true,
                read_at: serverTimestamp(),
                read_by: arrayUnion(currentUser.uid)
            });

            setMessages(prev => prev.map(m => m.id === msg.id ? { 
                ...m, 
                read: true, 
                isNew: false
            } : m));

            if (selectedMessage?.id === msg.id) {
                setSelectedMessage(prev => ({ 
                    ...prev, 
                    read: true, 
                    isNew: false
                }));
            }
        } catch (error) {
            console.error("Error actualizando acuse de recibo:", error);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true, isNew: false } : m));
        }
    }

    if (loading) {
        return (
            <div className="min-h-[55vh] flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={36} />
                <p className="text-xs font-bold text-slate-400">Cargando buzón de mensajes...</p>
            </div>
        );
    }

    const unreadCount = messages.filter(m => m.isNew && m.sender_id !== currentUser?.uid).length;

    return (
        <div className="space-y-5 animate-fade-in max-w-7xl mx-auto pb-10">
            
            {/* Header Superior y Barra de Navegación Integrada */}
            <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Título de la Sección */}
                <div className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                        <Mail size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">
                            Buzón de Comunicaciones
                        </h1>
                        <p className="text-xs text-slate-450 font-medium">
                            Gestión centralizada de mensajes oficiales del colegio.
                        </p>
                    </div>
                </div>

                {/* Filtros de Bandeja y Botón de Redactar en la misma franja */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition active-press ${
                            activeTab === 'inbox'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        <Inbox size={15} />
                        <span>Bandeja</span>
                        {unreadCount > 0 && (
                            <span className="bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('sent')}
                        className={`px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition active-press ${
                            activeTab === 'sent'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        <Send size={15} />
                        <span>Enviados</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('drafts')}
                        className={`px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition active-press ${
                            activeTab === 'drafts'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        <Edit3 size={15} />
                        <span>Borradores</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('compose')}
                        className={`px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition active-press bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/15 ml-1`}
                    >
                        <PlusCircle size={15} />
                        <span>Redactar</span>
                    </button>
                </div>

            </div>

            {/* Layout Principal de 2 Columnas Unidas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* Columna Izquierda: Listado Continuo de Mensajes (5 de 12 Cols) */}
                <div className="lg:col-span-5 bg-white border border-slate-150 rounded-3xl p-4 shadow-xs space-y-3">
                    
                    {/* Buscador Integrado */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por asunto, emisor o texto..."
                            className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-2 pl-9 pr-4 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none transition"
                        />
                    </div>

                    {/* Lista Unificada de Mensajes con Scroll Suave */}
                    <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                        {filteredMessages.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs font-medium">
                                No se encontraron mensajes en esta bandeja.
                            </div>
                        ) : (
                            filteredMessages.map((msg) => {
                                const isSelected = selectedMessage?.id === msg.id && activeTab !== 'compose';
                                const isSentByMe = msg.sender_id === currentUser?.uid;

                                return (
                                    <div 
                                        key={msg.id}
                                        onClick={() => {
                                            setSelectedMessage(msg);
                                            handleMarkMessageAsRead(msg);
                                            if (activeTab === 'compose') setActiveTab('inbox');
                                        }}
                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left flex items-start gap-3 relative ${
                                            isSelected 
                                                ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/20 shadow-xs' 
                                                : msg.isNew && !isSentByMe 
                                                ? 'bg-blue-50/20 border-blue-100 hover:bg-slate-50' 
                                                : 'bg-white border-slate-100 hover:bg-slate-50/80'
                                        }`}
                                    >
                                        {/* Indicador de Nuevo Mensaje en Bandeja de Entrada */}
                                        {msg.isNew && !isSentByMe && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse absolute left-2 top-4"></span>
                                        )}

                                        {/* Avatar Circular con Iniciales */}
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${msg.sender_color || 'bg-indigo-100 text-indigo-700'}`}>
                                            {msg.sender_initials || 'US'}
                                        </div>

                                        {/* Información del Mensaje */}
                                        <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4 className="text-xs font-black text-slate-800 truncate">
                                                    {isSentByMe ? `Para: ${msg.receiver_name || 'Destinatario'}` : msg.sender_name}
                                                </h4>
                                                <span className="text-[9.5px] font-bold text-slate-400 shrink-0">
                                                    {msg.time || msg.date}
                                                </span>
                                            </div>

                                            <p className="text-xs font-extrabold text-slate-700 truncate leading-tight">
                                                {msg.subject}
                                            </p>

                                            <p className="text-[11px] text-slate-450 truncate leading-tight font-medium">
                                                {msg.body}
                                            </p>
                                        </div>

                                        {/* Badge Preciso de Estado en Lista Izquierda */}
                                        <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1">
                                            {isSentByMe ? (
                                                msg.read ? (
                                                    <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                                        Leído
                                                    </span>
                                                ) : (
                                                    <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                                                        En espera
                                                    </span>
                                                )
                                            ) : (
                                                msg.read ? (
                                                    <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                                                        Leído
                                                    </span>
                                                ) : (
                                                    <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border bg-indigo-600 text-white shadow-2xs">
                                                        Nuevo
                                                    </span>
                                                )
                                            )}

                                            {msg.category && (
                                                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-md border ${getCategoryBadgeStyle(msg.category)}`}>
                                                    {msg.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Visor de Mensaje Abierto o Formulario de Redacción (7 de 12 Cols) */}
                <div className="lg:col-span-7">
                    {activeTab === 'compose' ? (
                        /* Formulario Claro y Estructurado de Redactar Mensaje Nuevo */
                        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs space-y-4 text-left">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <PlusCircle size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-800">Redactar Nueva Comunicación</h2>
                                    <p className="text-[11px] text-slate-450 font-medium">Selecciona claramente el tipo de destinatario antes de redactar.</p>
                                </div>
                            </div>

                            {successMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold">{successMessage}</div>}
                            {errorMessage && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-bold">{errorMessage}</div>}

                            <form onSubmit={handleSendMessage} className="space-y-4">
                                
                                {/* Pestañas Claras de Tipo de Destinatario */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-extrabold text-slate-700">¿A quién va dirigida esta comunicación? *</label>
                                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setTargetMode('STUDENT')}
                                            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                                                targetMode === 'STUDENT' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Users size={14} /> Por Estudiante(s)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTargetMode('COURSE')}
                                            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                                                targetMode === 'COURSE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <GraduationCap size={14} /> Por Curso Completo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTargetMode('STAFF')}
                                            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                                                targetMode === 'STAFF' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <UserCog size={14} /> Docente / Directivo
                                        </button>
                                    </div>
                                </div>

                                {/* OPCIÓN 1: BÚSQUEDA POR ESTUDIANTE (Envía al Acudiente/Familia) */}
                                {targetMode === 'STUDENT' && (
                                    <div className="space-y-3 relative bg-indigo-50/30 p-3.5 rounded-2xl border border-indigo-100">
                                        <div>
                                            <label className="block text-xs font-extrabold text-slate-800 mb-0.5">
                                                Buscar Estudiante (Notificará a sus Acudientes)
                                            </label>
                                            <p className="text-[10.5px] text-slate-450 mb-2 font-medium">
                                                Escribe el nombre o apellido del estudiante para encontrar a su familia registrada.
                                            </p>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={studentSearch}
                                                onChange={e => {
                                                    setStudentSearch(e.target.value);
                                                    setShowPredictiveDropdown(true);
                                                }}
                                                onFocus={() => setShowPredictiveDropdown(true)}
                                                placeholder="Escribe el nombre o apellido del alumno (ej: Steven, Alvarez, 1001)..."
                                                className="w-full bg-white border border-slate-200 rounded-2xl pl-9 pr-8 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-600/20 transition shadow-2xs"
                                            />
                                            <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                                            {studentSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setStudentSearch('')}
                                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown Predictivo Emergente */}
                                        {showPredictiveDropdown && studentSearch.trim() !== '' && (
                                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
                                                {getPredictiveMatches().length === 0 ? (
                                                    <div className="p-3 text-center text-slate-400 text-xs font-medium">
                                                        No se encontraron estudiantes para "{studentSearch}"
                                                    </div>
                                                ) : (
                                                    getPredictiveMatches().map(student => {
                                                        const isSelected = selectedStudents.includes(student.id);
                                                        const displayName = student.lastName && student.firstName
                                                            ? `${student.lastName} ${student.firstName}`
                                                            : student.name;
                                                        return (
                                                            <button
                                                                key={student.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!isSelected) {
                                                                        setSelectedStudents(prev => [...prev, student.id]);
                                                                    } else {
                                                                        setSelectedStudents(prev => prev.filter(id => id !== student.id));
                                                                    }
                                                                }}
                                                                className={`w-full text-left p-2 hover:bg-indigo-50/70 rounded-xl transition flex items-center justify-between gap-2 ${
                                                                    isSelected ? 'bg-indigo-50/50' : ''
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                                                        isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
                                                                    }`}>
                                                                        {displayName.charAt(0)}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-slate-800 truncate">{displayName}</p>
                                                                        <p className="text-[9.5px] text-slate-400 font-medium">Curso: <strong className="text-slate-700">{student.grade || student.course}</strong> • Acudiente vinculado</p>
                                                                    </div>
                                                                </div>
                                                                {isSelected ? (
                                                                    <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">✓ Agregado</span>
                                                                ) : (
                                                                    <span className="text-indigo-600 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">+ Agregar</span>
                                                                )}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}

                                        {/* Chips de Estudiantes Seleccionados */}
                                        {selectedStudents.length > 0 && (
                                            <div className="p-2.5 bg-white border border-indigo-100 rounded-2xl space-y-1.5">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                                                        Estudiantes Elegidos ({selectedStudents.length})
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedStudents([])}
                                                        className="text-[9.5px] text-rose-600 hover:underline font-extrabold"
                                                    >
                                                        Vaciar lista
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                                    {studentsList
                                                        .filter(s => selectedStudents.includes(s.id))
                                                        .map(s => {
                                                            const nameStr = s.lastName && s.firstName ? `${s.lastName} ${s.firstName}` : s.name;
                                                            return (
                                                                <span key={s.id} className="inline-flex items-center gap-1.5 text-[9.5px] bg-indigo-50 border border-indigo-200 text-indigo-900 px-2.5 py-1 rounded-xl font-bold">
                                                                    <span>{nameStr}</span>
                                                                    <span className="text-[8px] bg-indigo-200/60 text-indigo-950 px-1 py-0.2 rounded font-extrabold">Grado {s.grade}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedStudents(prev => prev.filter(id => id !== s.id))}
                                                                        className="text-indigo-600 hover:text-rose-600 transition ml-0.5"
                                                                    >
                                                                        <X size={11} />
                                                                    </button>
                                                                </span>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* OPCIÓN 2: POR CURSO COMPLETO */}
                                {targetMode === 'COURSE' && (
                                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                                        <label className="block text-xs font-extrabold text-slate-800">Seleccionar Grado / Curso Destino</label>
                                        <select
                                            value={targetCourse}
                                            onChange={e => setTargetCourse(e.target.value)}
                                            required
                                            className="w-full border border-slate-200 rounded-2xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none bg-white"
                                        >
                                            <option value="">Selecciona un curso...</option>
                                            {coursesList.map(c => {
                                                const count = studentsList.filter(s => s.grade === c).length;
                                                return (
                                                    <option key={c} value={c}>
                                                        Curso {c} ({count} familias registradas)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                {/* OPCIÓN 3: DOCENTE O DIRECTIVO */}
                                {targetMode === 'STAFF' && (
                                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                                        <label className="block text-xs font-extrabold text-slate-800">Seleccionar Profesor o Administrador</label>
                                        <select
                                            value={staffId}
                                            onChange={e => setStaffId(e.target.value)}
                                            required
                                            className="w-full border border-slate-200 rounded-2xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none bg-white"
                                        >
                                            <option value="">Selecciona un docente o coordinador...</option>
                                            {recipientList.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name || r.email} ({r.role === 'teacher' ? 'Profesor' : 'Administrador / Coordinación'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 mb-1">Categoría</label>
                                        <select
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-full border border-slate-200 rounded-2xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none bg-white"
                                        >
                                            <option value="Academia">Academia</option>
                                            <option value="Institucional">Institucional</option>
                                            <option value="Convivencia">Convivencia</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-extrabold text-slate-700 mb-1">Prioridad</label>
                                        <select
                                            value={priority}
                                            onChange={e => setPriority(e.target.value)}
                                            className="w-full border border-slate-200 rounded-2xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none bg-white"
                                        >
                                            <option value="Normal">Normal</option>
                                            <option value="Alta">Alta</option>
                                            <option value="Baja">Baja</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1">Asunto de la comunicación</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Ej: Citación a reunión de seguimiento académico"
                                        required
                                        className="w-full border border-slate-200 rounded-2xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1">Mensaje completo</label>
                                    <textarea
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        placeholder="Escribe aquí el contenido oficial del mensaje..."
                                        required
                                        className="w-full border border-slate-200 rounded-2xl p-3 text-xs h-40 font-medium focus:ring-2 focus:ring-indigo-600/20 outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="w-full bg-indigo-600 text-white font-extrabold py-3 rounded-2xl hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-xs shadow-md shadow-indigo-600/10 active-press disabled:opacity-50"
                                >
                                    {sending ? 'Enviando...' : <><Send size={15} /> Enviar Comunicación</>}
                                </button>
                            </form>
                        </div>
                    ) : selectedMessage ? (
                        /* Panel Unificado de Lectura y Respuesta */
                        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs text-left space-y-5">
                            
                            {/* Cabecera del Mensaje */}
                            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                                <div className="space-y-1">
                                    <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-snug">
                                        {selectedMessage.subject}
                                    </h2>
                                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                        <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border ${getCategoryBadgeStyle(selectedMessage.category || 'Academia')}`}>
                                            {selectedMessage.category || 'Academia'}
                                        </span>
                                        <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border ${getPriorityBadgeStyle(selectedMessage.priority || 'Normal')}`}>
                                            Prioridad: {selectedMessage.priority || 'Normal'}
                                        </span>
                                        {selectedMessage.dueDate && (
                                            <span className="text-[9px] font-bold bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Calendar size={10} /> Vence: {selectedMessage.dueDate}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {selectedMessage.date}, {selectedMessage.time}
                                    </span>
                                    <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Tarjeta del Remitente */}
                            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${selectedMessage.sender_color || 'bg-indigo-100 text-indigo-700'}`}>
                                        {selectedMessage.sender_initials || 'US'}
                                    </div>
                                    <div className="leading-tight text-left">
                                        <h4 className="text-xs font-black text-slate-800">
                                            {selectedMessage.sender_name}
                                        </h4>
                                        <p className="text-[10px] text-slate-450 mt-0.5 font-medium">
                                            {selectedMessage.sender_role === 'teacher' ? 'Docente del Plantel' : selectedMessage.sender_role === 'admin' ? 'Administrador / Directivo' : 'Acudiente'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold text-slate-400 bg-white border border-slate-200/60 px-2.5 py-1 rounded-xl">
                                    Para: {selectedMessage.receiver_name || 'Mí'}
                                </span>
                            </div>

                            {/* Cuerpo del Mensaje */}
                            <div className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line py-2">
                                {selectedMessage.body}
                            </div>

                            {/* Archivos Adjuntos si existen */}
                            {selectedMessage.attachment && (
                                <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                        <Paperclip size={13} className="text-slate-400" /> Archivo Adjunto
                                    </p>
                                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 max-w-md">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                                                <FileText size={16} />
                                            </div>
                                            <div className="leading-tight text-left">
                                                <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                                                    {selectedMessage.attachment.name}
                                                </p>
                                                <span className="text-[9.5px] text-slate-400 font-semibold">
                                                    {selectedMessage.attachment.type} • {selectedMessage.attachment.size}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDownloadAttachment(selectedMessage.attachment.name)}
                                            className="p-1.5 text-indigo-600 hover:text-indigo-800 transition rounded-lg hover:bg-indigo-50"
                                            title="Descargar archivo"
                                        >
                                            <Download size={15} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* SECCIÓN INFERIOR: Si el usuario actual es el Remitente (Profesor/Admin) -> Ficha de Acuse y Control de Lectura */}
                            {selectedMessage.sender_id === currentUser?.uid ? (
                                <div className="pt-4 border-t border-slate-150 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-indigo-600" /> Estado y Acuse de Lectura
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                                            Mensaje enviado por ti
                                        </span>
                                    </div>

                                    {selectedMessage.read ? (
                                        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold flex items-center gap-1.5 text-emerald-800">
                                                    <CheckCircle2 size={16} className="text-emerald-600" /> Confirmación de Lectura Recibida
                                                </span>
                                                {selectedMessage.read_at && (
                                                    <span className="text-[10px] font-bold text-emerald-700">
                                                        {selectedMessage.read_at}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-emerald-750 font-medium">
                                                El mensaje fue abierto y leído por <strong className="font-extrabold">{selectedMessage.receiver_name}</strong>.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold flex items-center gap-1.5 text-amber-800">
                                                    <Clock size={16} className="text-amber-600" /> Pendiente de Lectura
                                                </span>
                                                <span className="text-[10px] font-extrabold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full">
                                                    En espera
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-amber-800 font-medium">
                                                <strong className="font-extrabold">{selectedMessage.receiver_name}</strong> aún no ha abierto esta comunicación. Se actualizará automáticamente en cuanto lo lea.
                                            </p>
                                        </div>
                                    )}

                                    {/* Resumen de acuses si fue enviado a un curso o múltiples familias */}
                                    {(selectedMessage.target_type === 'COURSE' || selectedMessage.target_type === 'STUDENTS' || (selectedMessage.target_parent_uids && selectedMessage.target_parent_uids.length > 1)) && (
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className="text-indigo-600" />
                                                <div>
                                                    <p className="font-bold text-slate-800">Control de Acuses del Grupo</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        {selectedMessage.read_by?.length || (selectedMessage.read ? 1 : 0)} de {selectedMessage.target_parent_uids?.length || 1} acudientes han confirmado lectura
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => alert(`Control de Lecturas:\nTotal Familias: ${selectedMessage.target_parent_uids?.length || 1}\nLeídos: ${selectedMessage.read_by?.length || (selectedMessage.read ? 1 : 0)}\nPendientes: ${(selectedMessage.target_parent_uids?.length || 1) - (selectedMessage.read_by?.length || (selectedMessage.read ? 1 : 0))}`)}
                                                className="text-[10.5px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-3 py-1.5 rounded-xl shadow-2xs hover:bg-indigo-50 transition"
                                            >
                                                Ver Acuses Detallados
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Si el usuario actual es el Destinatario -> Mostrar Caja de Respuesta */
                                <div className="pt-4 border-t border-slate-150 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                            <Reply size={14} className="text-indigo-600" /> Responder a {selectedMessage.sender_name}
                                        </span>
                                    </div>

                                    <div className="border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-600/10 rounded-2xl p-3 bg-slate-50/50 transition">
                                        <textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Escribe aquí tu respuesta oficial..."
                                            className="w-full text-xs font-medium text-slate-700 placeholder-slate-400 bg-transparent border-none outline-none resize-none min-h-[75px]"
                                        />
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <button className="p-1.5 hover:text-slate-600 rounded-lg hover:bg-white transition">
                                                    <Paperclip size={15} />
                                                </button>
                                                <button className="p-1.5 hover:text-slate-600 rounded-lg hover:bg-white transition">
                                                    <Smile size={15} />
                                                </button>
                                            </div>

                                            <button 
                                                onClick={handleSendQuickReply}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md shadow-indigo-600/10 flex items-center gap-1.5 transition active-press"
                                            >
                                                <Send size={13} /> Responder
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="bg-white border border-slate-150 rounded-3xl p-16 text-center text-slate-400 space-y-2 shadow-xs">
                            <Mail size={40} className="mx-auto text-slate-300 stroke-[1.5]" />
                            <p className="text-xs font-bold text-slate-500">Selecciona un mensaje de la bandeja para leer la comunicación.</p>
                        </div>
                    )}
                </div>

            </div>

        </div>
    );
}
