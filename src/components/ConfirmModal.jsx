import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, X, CheckCircle2 } from 'lucide-react';

export default function ConfirmModal({
    isOpen,
    title = "¿Estás seguro?",
    message = "Esta acción no se puede deshacer.",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    confirmVariant = "danger", // 'danger' | 'warning' | 'primary' | 'success'
    onConfirm,
    onCancel,
    isLoading = false,
    details = null
}) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-rose-100 text-rose-600',
            confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25',
            border: 'border-rose-200',
            Icon: Trash2
        },
        warning: {
            iconBg: 'bg-amber-100 text-amber-600',
            confirmBtn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25',
            border: 'border-amber-200',
            Icon: AlertTriangle
        },
        primary: {
            iconBg: 'bg-indigo-100 text-indigo-600',
            confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25',
            border: 'border-indigo-200',
            Icon: HelpCircle
        },
        success: {
            iconBg: 'bg-emerald-100 text-emerald-600',
            confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25',
            border: 'border-emerald-200',
            Icon: CheckCircle2
        }
    };

    const style = variantStyles[confirmVariant] || variantStyles.danger;
    const IconComponent = style.Icon;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-in fade-in duration-150">
            <div className={`bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border ${style.border} space-y-4 animate-in zoom-in-95 duration-200 text-center`}>
                <div className={`w-12 h-12 ${style.iconBg} rounded-2xl flex items-center justify-center mx-auto shadow-inner`}>
                    <IconComponent size={24} />
                </div>

                <div>
                    <h3 className="text-base font-black text-slate-800">
                        {title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed">
                        {message}
                    </p>
                </div>

                {details && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left text-xs space-y-1">
                        {details}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`w-full py-2.5 rounded-xl text-xs font-black transition shadow-md flex items-center justify-center gap-1.5 ${style.confirmBtn}`}
                    >
                        {isLoading ? 'Procesando...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
