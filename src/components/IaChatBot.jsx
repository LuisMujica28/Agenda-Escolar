import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, MessageSquare, X, Send, Bot, Loader2, RefreshCw } from 'lucide-react';

export default function IaChatBot() {
    const { currentUser, userRole } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { 
            role: 'assistant', 
            content: '¡Hola! Soy Hermes, el asistente de IA del colegio INAS. ¿En qué puedo ayudarte hoy?' 
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [showBadge, setShowBadge] = useState(true);

    const chatEndRef = useRef(null);

    // Sugerencias personalizadas según el rol
    const getSuggestions = () => {
        if (userRole === 'parent') {
            return [
                '¿Cuál es el horario escolar?',
                '¿Cómo son los uniformes oficiales?',
                '¿Cómo justifico una inasistencia?',
                '¿Cuál es la nota mínima para aprobar?'
            ];
        }
        return [
            'Ayúdame a redactar una circular urgente',
            '¿Qué es una falta leve según el manual?',
            'Plantilla de citación para acudientes',
            'Horario de atención a padres'
        ];
    };

    // Auto-scroll al final de los mensajes
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Ocultar badge al abrir por primera vez
    useEffect(() => {
        if (isOpen) setShowBadge(false);
    }, [isOpen]);

    const handleSendMessage = async (text) => {
        if (!text.trim()) return;

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);
        setInputValue('');
        setLoading(true);

        try {
            const response = await fetch('/api/ia/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: newMessages,
                    role: userRole
                }),
            });

            const data = await response.json();
            if (response.ok && data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            } else {
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: data.error || 'Ocurrió un problema de comunicación con Hermes. Inténtalo de nuevo.' 
                }]);
            }
        } catch (error) {
            console.error("Error al hablar con el chatbot:", error);
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'No se pudo establecer conexión con el servidor de la IA. Asegúrate de tener el backend corriendo.' 
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleResetChat = () => {
        setMessages([
            { 
                role: 'assistant', 
                content: 'Historial reiniciado. Hola, soy Hermes, el asistente de IA. ¿En qué te colaboro?' 
            }
        ]);
    };

    if (!currentUser) return null;

    return (
        <div className="fixed bottom-6 right-6 z-40 font-sans no-print">
            {/* Botón Flotante de IA */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-650 via-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/35 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 relative group`}
            >
                {isOpen ? <X size={24} /> : <Bot size={26} className="animate-pulse" />}
                
                {showBadge && !isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white animate-bounce">
                        1
                    </span>
                )}
                
                {/* Tooltip */}
                {!isOpen && (
                    <span className="absolute right-16 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none whitespace-nowrap">
                        Pregúntale a Hermes (IA) ✨
                    </span>
                )}
            </button>

            {/* Ventana de Chat */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[350px] sm:w-[400px] h-[500px] bg-white/95 backdrop-blur-md rounded-3xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                    {/* Header */}
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md border border-indigo-500/30">
                                <Sparkles size={18} className="text-white animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider leading-none">Hermes IA</h3>
                                <span className="text-[9px] text-emerald-400 font-extrabold flex items-center gap-1 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    En línea y listo
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={handleResetChat}
                                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
                                title="Reiniciar chat"
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Mensajes */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                        {messages.map((msg, idx) => {
                            const isAI = msg.role === 'assistant';
                            return (
                                <div 
                                    key={idx} 
                                    className={`flex items-end gap-2.5 ${isAI ? 'justify-start' : 'justify-end'}`}
                                >
                                    {isAI && (
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-inner-soft">
                                            <Bot size={14} className="text-indigo-650" />
                                        </div>
                                    )}
                                    <div className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed whitespace-pre-wrap ${
                                        isAI 
                                            ? 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-bl-none' 
                                            : 'bg-indigo-600 text-white rounded-br-none font-medium shadow-md shadow-indigo-600/10'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {loading && (
                            <div className="flex items-end gap-2.5 justify-start">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                    <Loader2 className="animate-spin text-indigo-650" size={14} />
                                </div>
                                <div className="bg-white text-slate-400 italic text-[11px] p-3 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm">
                                    Hermes está redactando...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Sugerencias Rápidas */}
                    {messages.length === 1 && (
                        <div className="p-3 bg-white border-t border-slate-100 space-y-1.5 shrink-0">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">Preguntas Frecuentes:</p>
                            <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto">
                                {getSuggestions().map((sug, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSendMessage(sug)}
                                        className="text-[10px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-650 border border-slate-200/60 rounded-xl px-2.5 py-1 text-slate-600 transition-all font-semibold active:scale-95 text-left"
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Entrada de Texto */}
                    <form 
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage(inputValue);
                        }}
                        className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
                    >
                        <input
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            placeholder="Haz una pregunta o pide redactar algo..."
                            disabled={loading}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-700"
                        />
                        <button
                            type="submit"
                            disabled={loading || !inputValue.trim()}
                            className="bg-indigo-600 hover:bg-indigo-750 text-white p-2.5 rounded-xl transition shadow-md shadow-indigo-600/15 disabled:opacity-50"
                        >
                            <Send size={14} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
