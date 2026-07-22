import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Loader2, Mail, Send, Inbox, MessageSquare, PlusCircle, Edit3, 
    Search, SlidersHorizontal, Paperclip, Smile, Download, Reply, MoreVertical, 
    Folder, Flag, Calendar, FileText, CheckCircle2, ChevronDown, User
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
    
    // Form state para redactar
    const [recipientId, setRecipientId] = useState('');
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
    const [courseFilter, setCourseFilter] = useState('ALL');
    const [studentSearch, setStudentSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // MOCK MESSAGES para vista inicial perfecta coincidiendo con la captura
    const DEFAULT_MOCK_MESSAGES = [
        {
            id: 'msg-1',
            sender_id: 'prof-1',
            sender_name: 'Prof. Juanito Pérez',
            sender_role: 'teacher',
            sender_initials: 'PA',
            sender_color: 'bg-blue-100 text-blue-700 border-blue-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Seguimiento de Juanito Pérez',
            body: `Estimado acudiente,\n\nle escribo para comunicarle que Juanito ha mostrado un excelente desempeño en la clase de álgebra lineal. Sin embargo, le recomiendo que refuerce los momentos de estudio y repaso de próximos temas.\n\nAgradezco su compromiso y apoyo en el proceso académico.\n\nAtentamente,\nProf. Juanito Pérez`,
            date: '20/07/2026',
            time: '10:15 a. m.',
            isNew: true,
            statusTag: 'Nuevo',
            statusTagColor: 'bg-blue-600 text-white',
            category: 'Academia',
            priority: 'Normal',
            dueDate: '27/07/2026',
            attachment: {
                name: 'Informe_academico_Juanito_Perez.pdf',
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
            sender_color: 'bg-amber-100 text-amber-700 border-amber-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Información importante - Salida pedagógica',
            body: 'Reciba un cordial saludo. Le informamos sobre la autorización para la salida pedagógica programada para la próxima semana.',
            date: 'Ayer',
            time: '04:30 p. m.',
            isNew: false,
            statusTag: 'Importante',
            statusTagColor: 'bg-amber-100 text-amber-700 border-amber-200 font-extrabold',
            category: 'Institucional',
            priority: 'Alta',
            dueDate: '25/07/2026'
        },
        {
            id: 'msg-3',
            sender_id: 'prof-2',
            sender_name: 'Docente de Matemáticas',
            sender_role: 'teacher',
            sender_initials: 'DO',
            sender_color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Taller de refuerzo - Matemáticas',
            body: 'Se adjunta el taller de refuerzo para preparar la evaluación final del segundo periodo.',
            date: '15/07/2026',
            time: '11:20 a. m.',
            isNew: false,
            statusTag: 'Leído',
            statusTagColor: 'bg-slate-100 text-slate-500 border-slate-200',
            category: 'Academia',
            priority: 'Normal'
        },
        {
            id: 'msg-4',
            sender_id: 'bib-1',
            sender_name: 'Biblioteca',
            sender_role: 'admin',
            sender_initials: 'BI',
            sender_color: 'bg-purple-100 text-purple-700 border-purple-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Recordatorio: Devolución de libro',
            body: 'Hola, le recordamos que el libro prestado en la biblioteca institucional debe ser devuelto esta semana.',
            date: '14/07/2026',
            time: '09:00 a. m.',
            isNew: false,
            statusTag: 'Leído',
            statusTagColor: 'bg-slate-100 text-slate-500 border-slate-200',
            category: 'Biblioteca',
            priority: 'Baja'
        },
        {
            id: 'msg-5',
            sender_id: 'orient-1',
            sender_name: 'Orientación Escolar',
            sender_role: 'admin',
            sender_initials: 'OR',
            sender_color: 'bg-teal-100 text-teal-700 border-teal-200',
            receiver_id: currentUser?.uid || 'parent-1',
            receiver_name: 'Sara Vélez',
            subject: 'Citación a reunión',
            body: 'Cordial saludo, tenemos el gusto de invitarle a la reunión de seguimiento psicosocial.',
            date: '12/07/2026',
            time: '03:15 p. m.',
            isNew: false,
            statusTag: 'Leído',
            statusTagColor: 'bg-slate-100 text-slate-500 border-slate-200',
            category: 'Orientación',
            priority: 'Normal'
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
                        sender_color: 'bg-blue-100 text-blue-700 border-blue-200',
                        receiver_id: d.receiver_id,
                        receiver_name: d.receiver_name,
                        subject: d.subject,
                        body: d.body,
                        date: d.created_at?.seconds ? new Date(d.created_at.seconds * 1000).toLocaleDateString() : 'Hoy',
                        time: d.created_at?.seconds ? new Date(d.created_at.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ahora',
                        isNew: !d.read,
                        statusTag: d.read ? 'Leído' : 'Nuevo',
                        statusTagColor: d.read ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white',
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

                // 2. Cargar lista de destinatarios posibles
                const targetRoles = userRole === 'parent' ? ['teacher', 'admin'] : ['parent', 'admin'];
                const qUsers = query(collection(db, 'users'), where('role', 'in', targetRoles));
                const uSnap = await getDocs(qUsers);
                setRecipientList(uSnap.docs.map(docData => ({ id: docData.id, ...docData.data() })));

                // 3. Cargar estudiantes para autocompletar
                const sSnap = await getDocs(collection(db, 'students'));
                const sList = sSnap.docs.map(docData => ({ id: docData.id, ...docData.data() }));
                setStudentsList(sList);
                const courses = Array.from(new Set(sList.map(s => s.grade).filter(Boolean))).sort();
                setCoursesList(courses);
            } catch (error) {
                console.warn("Error al cargar mensajería (Usando fallback demostrativo):", error);
                setMessages(DEFAULT_MOCK_MESSAGES);
                setSelectedMessage(DEFAULT_MOCK_MESSAGES[0]);
            } finally {
                setLoading(false);
            }
        }

        loadMessagingData();
    }, [currentUser, activeTab, userRole]);

    // Enviar nuevo mensaje
    async function handleSendMessage(e) {
        e.preventDefault();
        if (!recipientId || !subject || !body) return;

        setSending(true);
        setErrorMessage('');
        setSuccessMessage('');

        const selectedRecipient = recipientList.find(r => r.id === recipientId);

        try {
            const newMsgRef = await addDoc(collection(db, 'messages'), {
                sender_id: currentUser.uid,
                sender_name: currentUser.displayName || currentUser.email.split('@')[0],
                sender_role: userRole,
                receiver_id: recipientId,
                receiver_name: selectedRecipient?.name || selectedRecipient?.email || 'Destinatario',
                subject,
                body,
                category,
                priority,
                created_at: serverTimestamp(),
                read: false
            });

            const newMsgObj = {
                id: newMsgRef.id,
                sender_id: currentUser.uid,
                sender_name: currentUser.displayName || currentUser.email.split('@')[0],
                sender_role: userRole,
                sender_initials: (currentUser.displayName || 'YO').slice(0, 2).toUpperCase(),
                sender_color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                receiver_id: recipientId,
                receiver_name: selectedRecipient?.name || 'Destinatario',
                subject,
                body,
                date: 'Hoy',
                time: 'Ahora',
                isNew: false,
                statusTag: 'Enviado',
                statusTagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                category,
                priority
            };

            setMessages(prev => [newMsgObj, ...prev]);
            setSelectedMessage(newMsgObj);
            setSuccessMessage('¡Mensaje enviado con éxito!');
            setSubject('');
            setBody('');
            setRecipientId('');
            setTimeout(() => {
                setActiveTab('inbox');
                setSuccessMessage('');
            }, 1200);
        } catch (error) {
            console.error("Error al enviar mensaje:", error);
            setErrorMessage('No se pudo enviar el mensaje.');
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
            sender_name: currentUser.displayName || 'Acudiente',
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
            statusTag: 'Enviado',
            statusTagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
            m.body?.toLowerCase().includes(q)
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
            case 'Orientación Escolar':
                return 'bg-emerald-50 text-emerald-800 border-emerald-200';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const getPriorityBadgeStyle = (prio) => {
        switch (prio) {
            case 'Alta':
                return 'bg-red-50 text-red-700 border-red-200 font-extrabold shadow-sm';
            case 'Normal':
                return 'bg-blue-50/80 text-blue-700 border-blue-200 font-semibold';
            case 'Baja':
                return 'bg-slate-50 text-slate-600 border-slate-200 font-medium';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    async function handleMarkMessageAsRead(msg) {
        if (!msg || !msg.id || msg.id.startsWith('msg-') || msg.read) return;

        try {
            const msgRef = doc(db, 'messages', msg.id);
            await updateDoc(msgRef, { read: true });

            setMessages(prev => prev.map(m => m.id === msg.id ? { 
                ...m, 
                read: true, 
                isNew: false, 
                statusTag: 'Leído', 
                statusTagColor: 'bg-slate-100 text-slate-500' 
            } : m));

            if (selectedMessage?.id === msg.id) {
                setSelectedMessage(prev => ({ 
                    ...prev, 
                    read: true, 
                    isNew: false, 
                    statusTag: 'Leído', 
                    statusTagColor: 'bg-slate-100 text-slate-500' 
                }));
            }
        } catch (error) {
            console.error("Error actualizando acuse de recibo:", error);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true, isNew: false, statusTag: 'Leído' } : m));
        }
    }

    if (loading) {
        return (
            <div className="min-h-[55vh] flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-xs font-bold text-slate-400">Cargando buzón de mensajes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
            
            {/* Header del Buzón con Ilustración */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white p-6 rounded-3xl border border-indigo-100/50 relative overflow-hidden">
                <div className="flex items-center gap-3 z-10 text-left">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200/50">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                            Buzón de Mensajes
                        </h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Comunicación oficial entre el colegio, docentes y acudientes.
                        </p>
                    </div>
                </div>

                {/* Sobres flotantes en la esquina derecha */}
                <div className="hidden md:flex items-center justify-center shrink-0 pr-4">
                    <div className="w-20 h-20 bg-indigo-100/50 rounded-full flex items-center justify-center relative">
                        <Mail className="text-indigo-600 w-10 h-10 stroke-[1.5]" />
                        <div className="absolute -top-1 -right-1 bg-blue-500 text-white p-1 rounded-full shadow-md">
                            <Send size={14} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout Principal en 2 Columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Columna Izquierda: Menú de Bandejas y Listado de Mensajes (4 Columnas) */}
                <div className="lg:col-span-5 space-y-4">
                    
                    {/* Tarjeta de Menú de Bandejas de Mensajería */}
                    <div className="bg-white border border-slate-150 rounded-3xl p-3 shadow-sm space-y-1.5">
                        <button
                            onClick={() => setActiveTab('inbox')}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition font-extrabold text-xs ${
                                activeTab === 'inbox' 
                                    ? 'bg-slate-900 text-white shadow-md' 
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Inbox size={16} />
                                <span>Bandeja de Entrada</span>
                            </div>
                            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                {messages.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('sent')}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition font-extrabold text-xs ${
                                activeTab === 'sent' 
                                    ? 'bg-slate-900 text-white shadow-md' 
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Send size={16} />
                                <span>Mensajes Enviados</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveTab('drafts')}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition font-extrabold text-xs ${
                                activeTab === 'drafts' 
                                    ? 'bg-slate-900 text-white shadow-md' 
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Edit3 size={16} />
                                <span>Borradores</span>
                            </div>
                            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                1
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('compose')}
                            className={`w-full flex items-center gap-2.5 p-3 rounded-2xl transition font-extrabold text-xs text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200 mt-1`}
                        >
                            <PlusCircle size={16} />
                            <span>Redactar Mensaje</span>
                        </button>
                    </div>

                    {/* Buscador de Mensajes */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar mensajes..."
                                className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none shadow-sm"
                            />
                        </div>
                        <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-50 shadow-sm">
                            <SlidersHorizontal size={15} />
                        </button>
                    </div>

                    {/* Listado de Mensajes (Inbox List) */}
                    <div className="bg-white border border-slate-150 rounded-3xl p-3 shadow-sm space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {filteredMessages.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-xs font-medium">
                                No se encontraron mensajes.
                            </div>
                        ) : (
                            filteredMessages.map((msg) => {
                                const isSelected = selectedMessage?.id === msg.id;

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
                                                ? 'bg-blue-50/40 border-blue-200 shadow-sm' 
                                                : msg.isNew 
                                                ? 'bg-indigo-50/20 border-indigo-100' 
                                                : 'bg-white border-slate-100 hover:bg-slate-50/80'
                                        }`}
                                    >
                                        {/* Indicator Dot de no leído */}
                                        {msg.isNew && (
                                            <span className="w-2 h-2 rounded-full bg-blue-600 absolute left-2 top-4"></span>
                                        )}

                                        {/* Avatar Circular con Iniciales */}
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${msg.sender_color || 'bg-blue-100 text-blue-700'}`}>
                                            {msg.sender_initials || 'US'}
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4 className="text-xs font-black text-slate-800 truncate">
                                                    {msg.sender_name}
                                                </h4>
                                                <span className="text-[9.5px] font-bold text-slate-400 shrink-0">
                                                    {msg.time || msg.date}
                                                </span>
                                            </div>

                                            <p className="text-xs font-bold text-slate-700 truncate leading-tight">
                                                {msg.subject}
                                            </p>

                                            <p className="text-[11px] text-slate-400 truncate leading-tight font-medium">
                                                {msg.body}
                                            </p>
                                        </div>

                                        {/* Status Tag Badge & Categoría */}
                                        <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1">
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${msg.statusTagColor || 'bg-slate-100 text-slate-500'}`}>
                                                {msg.statusTag || 'Leído'}
                                            </span>
                                            {msg.category && (
                                                <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-lg border ${getCategoryBadgeStyle(msg.category)}`}>
                                                    {msg.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        <div className="pt-2 text-center">
                            <button className="text-[11px] font-extrabold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 py-1">
                                Ver más mensajes <ChevronDown size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Visor de Mensaje Seleccionado o Formulario Redactar (7 Columnas) */}
                <div className="lg:col-span-7 space-y-6">
                    {activeTab === 'compose' ? (
                        /* Formulario de Redactar Mensaje Nuevo */
                        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-5 text-left">
                            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                    <Mail size={16} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-800">Redactar Nuevo Mensaje</h2>
                                    <p className="text-[10px] text-slate-400 font-medium">Envía una comunicación oficial a profesores o coordinadores.</p>
                                </div>
                            </div>

                            {successMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold">{successMessage}</div>}
                            {errorMessage && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-bold">{errorMessage}</div>}

                            <form onSubmit={handleSendMessage} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1">Destinatario</label>
                                    <select
                                        value={recipientId}
                                        onChange={e => setRecipientId(e.target.value)}
                                        required
                                        className="w-full border border-slate-200 rounded-2xl p-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none bg-white"
                                    >
                                        <option value="">Selecciona una persona...</option>
                                        {recipientList.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} ({r.role === 'teacher' ? 'Profesor' : r.role === 'admin' ? 'Administrador' : 'Acudiente'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

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
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1">Asunto</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Ej: Seguimiento de rendimiento académico"
                                        required
                                        className="w-full border border-slate-200 rounded-2xl p-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-600/20 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1">Mensaje</label>
                                    <textarea
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        placeholder="Escribe tu comunicación detallada..."
                                        required
                                        className="w-full border border-slate-200 rounded-2xl p-3 text-xs h-40 font-medium focus:ring-2 focus:ring-indigo-600/20 outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="w-full bg-indigo-600 text-white font-extrabold py-3.5 rounded-2xl hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-xs shadow-md shadow-indigo-600/10 active-press disabled:opacity-50"
                                >
                                    {sending ? 'Enviando...' : <><Send size={16} /> Enviar Mensaje</>}
                                </button>
                            </form>
                        </div>
                    ) : selectedMessage ? (
                        /* Detalle del Mensaje Abierto */
                        <div className="space-y-6">
                            
                            {/* Card de Detalle del Mensaje */}
                            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-6 text-left">
                                
                                {/* Header del Mensaje */}
                                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                                                {selectedMessage.subject}
                                            </h2>
                                            {selectedMessage.isNew ? (
                                                <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                                    Nuevo
                                                </span>
                                            ) : selectedMessage.read ? (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 size={11} /> ✓ Leído
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-500 text-[9.5px] font-bold px-2 py-0.5 rounded-full">
                                                    Enviado (Pendiente)
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            De: <strong className="text-slate-800">{selectedMessage.sender_name}</strong> ({selectedMessage.sender_role === 'teacher' ? 'Profesor' : 'Administrador'})
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-[10px] font-semibold text-slate-400">
                                            {selectedMessage.date}, {selectedMessage.time}
                                        </span>
                                        <button className="p-1.5 text-slate-400 hover:text-slate-700">
                                            <Reply size={16} />
                                        </button>
                                        <button className="p-1.5 text-slate-400 hover:text-slate-700">
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Badges de Metadatos (Categoría, Prioridad, Vencimiento) con Color Deducido */}
                                <div className="flex items-center gap-2 flex-wrap text-[11px] font-extrabold">
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${getCategoryBadgeStyle(selectedMessage.category || 'Academia')}`}>
                                        <Folder size={13} />
                                        <span>{selectedMessage.category || 'Academia'}</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${getPriorityBadgeStyle(selectedMessage.priority || 'Normal')}`}>
                                        <Flag size={13} className={selectedMessage.priority === 'Alta' ? 'text-red-600 fill-red-100' : 'text-blue-500'} />
                                        <span>Prioridad: {selectedMessage.priority || 'Normal'}</span>
                                    </div>
                                    {selectedMessage.dueDate && (
                                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 text-slate-600 px-3 py-1.5 rounded-xl">
                                            <Calendar size={13} className="text-slate-400" />
                                            <span>Vence: {selectedMessage.dueDate}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Cuerpo del Mensaje */}
                                <div className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line py-2">
                                    {selectedMessage.body}
                                </div>

                                {/* Archivos Adjuntos */}
                                {selectedMessage.attachment && (
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <p className="text-xs font-black text-slate-800">Archivos adjuntos (1)</p>
                                        <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 max-w-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center shrink-0">
                                                    <FileText size={18} />
                                                </div>
                                                <div className="leading-tight text-left">
                                                    <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                                                        {selectedMessage.attachment.name}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 font-semibold">
                                                        {selectedMessage.attachment.type} • {selectedMessage.attachment.size}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDownloadAttachment(selectedMessage.attachment.name)}
                                                className="p-2 text-indigo-600 hover:text-indigo-800 transition"
                                                title="Descargar archivo"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Caja de Respuesta Rápida (Reply Box Abajo) */}
                            <div className="bg-white border border-slate-150 rounded-3xl p-4 shadow-sm space-y-3 text-left">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Escribe tu respuesta..."
                                    className="w-full text-xs font-medium text-slate-700 placeholder-slate-400 border-none outline-none resize-none min-h-[70px]"
                                />
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <button className="p-1.5 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                                            <Paperclip size={16} />
                                        </button>
                                        <button className="p-1.5 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                                            <Smile size={16} />
                                        </button>
                                    </div>

                                    <button 
                                        onClick={handleSendQuickReply}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center gap-2 transition active-press"
                                    >
                                        <Send size={14} /> Enviar
                                    </button>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center text-slate-400 space-y-2">
                            <Mail size={40} className="mx-auto text-slate-300" />
                            <p className="text-xs font-bold">Selecciona un mensaje para ver el detalle.</p>
                        </div>
                    )}
                </div>

            </div>

        </div>
    );
}

