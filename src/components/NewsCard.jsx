import { useState } from 'react';
import { Calendar, CheckCircle, AlertCircle, Eye, Paperclip } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CircularDetailModal from './CircularDetailModal';

export default function NewsCard({ news, onAcknowledge, currentUserId }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const isHighPriority = news.priority === 'HIGH';
    const hasAck = news.read_by?.includes(currentUserId);

    return (
        <>
            <div 
                onClick={() => setIsModalOpen(true)}
                className={twMerge(
                    "bg-white rounded-3xl p-5 mb-4 border-l-4 shadow-md border border-slate-100/80 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] select-none",
                    isHighPriority ? "border-rose-500" : "border-indigo-600"
                )}
            >
                <div className="flex justify-between items-start mb-2 gap-4">
                    <h3 className="text-sm font-black text-slate-800 tracking-tight leading-snug">{news.title}</h3>
                    <div className="flex gap-1.5 items-center shrink-0">
                        {isHighPriority && (
                            <span className="bg-rose-50 text-rose-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-100">
                                <AlertCircle size={10} /> Urgente
                            </span>
                        )}
                        {news.attachment_name && (
                            <span className="bg-indigo-50 text-indigo-650 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-100">
                                <Paperclip size={10} /> Adjunto
                            </span>
                        )}
                    </div>
                </div>

                <p className="text-xs text-slate-500 mb-4 whitespace-pre-wrap leading-relaxed line-clamp-2">
                    {news.body}
                </p>

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold border-t pt-3 mt-2">
                    <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        <span>
                            {news.created_at?.seconds 
                                ? new Date(news.created_at.seconds * 1000).toLocaleDateString()
                                : 'Reciente'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {news.requires_acknowledgment && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // Evitar abrir el modal al dar clic al botón
                                    if (!hasAck) onAcknowledge(news.id);
                                }}
                                disabled={hasAck}
                                className={clsx(
                                    "flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all font-bold text-[9px] uppercase tracking-wider shadow-sm",
                                    hasAck
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-default"
                                        : "bg-indigo-600 text-white hover:bg-indigo-750 active-press"
                                )}
                            >
                                <CheckCircle size={11} />
                                {hasAck ? "Leído" : "Firmar"}
                            </button>
                        )}
                        <span className="text-indigo-600 hover:text-indigo-850 flex items-center gap-1 font-bold">
                            <Eye size={12} /> Leer completo
                        </span>
                    </div>
                </div>
            </div>

            {/* Modal de Detalle Completo de Circular */}
            {isModalOpen && (
                <CircularDetailModal
                    circular={news}
                    onClose={() => setIsModalOpen(false)}
                    currentUserId={currentUserId}
                    onAcknowledge={(id) => {
                        onAcknowledge(id);
                    }}
                />
            )}
        </>
    );
}
