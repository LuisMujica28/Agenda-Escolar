import { Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function NewsCard({ news, onAcknowledge, currentUserId }) {
    const isHighPriority = news.priority === 'HIGH';
    const hasAck = news.read_by?.includes(currentUserId);

    return (
        <div className={twMerge(
            "bg-white rounded-lg p-5 mb-4 border-l-4 shadow-sm",
            isHighPriority ? "border-red-500" : "border-primary"
        )}>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-gray-800">{news.title}</h3>
                {isHighPriority && (
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-semibold">
                        <AlertCircle size={14} /> Importante
                    </span>
                )}
            </div>

            <p className="text-gray-600 mb-4 whitespace-pre-wrap text-sm leading-relaxed">{news.body}</p>

            <div className="flex justify-between items-center text-xs text-gray-400 border-t pt-3 mt-2">
                <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{new Date(news.created_at?.seconds * 1000).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                    {news.requires_acknowledgment && (
                        <button
                            onClick={() => !hasAck && onAcknowledge(news.id)}
                            disabled={hasAck}
                            className={clsx(
                                "flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors font-medium",
                                hasAck
                                    ? "bg-green-100 text-green-700 cursor-default"
                                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            )}
                        >
                            <CheckCircle size={14} />
                            {hasAck ? "Leído" : "Marcar como Leído"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
