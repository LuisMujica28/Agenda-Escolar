import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Mail, Send, Inbox, MessageSquare, AlertCircle } from 'lucide-react';

export default function MessagingPage() {
    const { currentUser, userRole } = useAuth();
    const [messages, setMessages] = useState([]);
    const [recipientList, setRecipientList] = useState([]);
    
    // UI state
    const [activeTab, setActiveTab] = useState('inbox'); // inbox, sent, compose
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    
    // Form state
    const [recipientId, setRecipientId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        async function loadMessagingData() {
            if (!currentUser) return;
            setLoading(true);
            try {
                // 1. Cargar Mensajes (donde el usuario es remitente o destinatario)
                const qMsg = query(
                    collection(db, 'messages'),
                    where(activeTab === 'inbox' ? 'receiver_id' : 'sender_id', '==', currentUser.uid)
                );
                const mSnap = await getDocs(qMsg);
                const msgList = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                msgList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                setMessages(msgList);

                // 2. Cargar lista de posibles destinatarios
                // Si soy padre, cargo profesores y administradores
                // Si soy profesor, cargo padres e interesados
                const targetRoles = userRole === 'parent' ? ['teacher', 'admin'] : ['parent', 'admin'];
                const qUsers = query(collection(db, 'users'), where('role', 'in', targetRoles));
                const uSnap = await getDocs(qUsers);
                setRecipientList(uSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error al cargar mensajería:", error);
            } finally {
                setLoading(false);
            }
        }

        loadMessagingData();
    }, [currentUser, activeTab, userRole]);

    async function handleSendMessage(e) {
        e.preventDefault();
        if (!recipientId || !subject || !body) return;

        setSending(true);
        setErrorMessage('');
        setSuccessMessage('');

        const selectedRecipient = recipientList.find(r => r.id === recipientId);

        try {
            await addDoc(collection(db, 'messages'), {
                sender_id: currentUser.uid,
                sender_name: currentUser.displayName || currentUser.email.split('@')[0],
                sender_role: userRole,
                receiver_id: recipientId,
                receiver_name: selectedRecipient?.name || selectedRecipient?.email || 'Destinatario',
                subject,
                body,
                created_at: serverTimestamp(),
                read: false
            });

            setSuccessMessage('¡Mensaje enviado con éxito!');
            setSubject('');
            setBody('');
            setRecipientId('');
            setTimeout(() => {
                setActiveTab('sent');
                setSuccessMessage('');
            }, 1500);
        } catch (error) {
            console.error("Error al enviar mensaje:", error);
            setErrorMessage('No se pudo enviar el mensaje.');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[550px]">
            {/* Sidebar de navegación interna */}
            <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r p-4 flex flex-row md:flex-col gap-2 shrink-0">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        activeTab === 'inbox' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Inbox size={18} /> Bandeja de Entrada
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        activeTab === 'sent' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Send size={18} /> Mensajes Enviados
                </button>
                <button
                    onClick={() => setActiveTab('compose')}
                    className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        activeTab === 'compose' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Send size={18} /> Redactar Mensaje
                </button>
            </div>

            {/* Contenedor principal de mensajes */}
            <div className="flex-1 p-6 flex flex-col">
                {activeTab === 'compose' ? (
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Mail className="text-primary" /> Redactar Nuevo Mensaje
                        </h2>

                        {successMessage && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-4 text-sm font-semibold">{successMessage}</div>}
                        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-4 text-sm font-semibold">{errorMessage}</div>}

                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Destinatario</label>
                                <select
                                    value={recipientId}
                                    onChange={e => setRecipientId(e.target.value)}
                                    required
                                    className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
                                >
                                    <option value="">Selecciona una persona...</option>
                                    {recipientList.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} ({r.role === 'teacher' ? 'Profesor' : r.role === 'admin' ? 'Administrador' : 'Padre/Madre'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Asunto</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="Ej: Justificación de inasistencia"
                                    required
                                    className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mensaje</label>
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Escribe tu mensaje aquí..."
                                    required
                                    className="w-full border rounded-xl p-3 text-sm h-40 focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={sending}
                                className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                            >
                                {sending ? 'Enviando...' : <><Send size={18} /> Enviar Mensaje</>}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col">
                        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <MessageSquare className="text-primary" /> 
                            {activeTab === 'inbox' ? 'Bandeja de Entrada' : 'Mensajes Enviados'}
                        </h2>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
                        ) : messages.length === 0 ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-gray-400 py-10">
                                <Inbox size={48} className="text-gray-300 mb-2" />
                                <p className="text-sm font-medium">No hay mensajes en esta bandeja.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-grow max-h-[400px] overflow-y-auto pr-1">
                                {messages.map((msg) => (
                                    <div key={msg.id} className="border rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-sm">{msg.subject}</h4>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {activeTab === 'inbox' 
                                                        ? `De: ${msg.sender_name} (${msg.sender_role === 'teacher' ? 'Profesor' : 'Administrador'})`
                                                        : `Para: ${msg.receiver_name}`}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-gray-400">
                                                {msg.created_at?.seconds 
                                                    ? new Date(msg.created_at.seconds * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                                    : 'Ahora'}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-xs leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                                            {msg.body}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
