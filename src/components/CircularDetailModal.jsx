import { useState, useEffect } from 'react';
import { X, Printer, Download, FileCheck, Calendar, User, BookOpen, AlertCircle, Paperclip } from 'lucide-react';

export default function CircularDetailModal({ circular, onClose, currentUserId, onAcknowledge, previewOnly = false }) {
    const [logoError, setLogoError] = useState(false);
    const [formattedDate, setFormattedDate] = useState('Fecha no disponible');
    const [formattedDateTime, setFormattedDateTime] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [paperSize, setPaperSize] = useState('letter'); // 'letter' | 'legal'

    const isHighPriority = circular.priority === 'HIGH';
    const hasAck = circular.read_by?.includes(currentUserId);

    useEffect(() => {
        if (circular.created_at) {
            const seconds = circular.created_at.seconds;
            if (seconds) {
                const date = new Date(seconds * 1000);
                
                // Formato de fecha para arriba del texto: "24 de abril de 2026."
                const optionsDate = { day: 'numeric', month: 'long', year: 'numeric' };
                setFormattedDate(`${date.toLocaleDateString('es-ES', optionsDate)}.`);

                // Formato de fecha y hora para el pie de página
                const optionsDateTime = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
                setFormattedDateTime(date.toLocaleDateString('es-ES', optionsDateTime));
            } else {
                setFormattedDate(new Date().toLocaleDateString('es-ES'));
                setFormattedDateTime(new Date().toLocaleDateString('es-ES'));
            }
        } else {
            setFormattedDate('Reciente');
            setFormattedDateTime('Reciente');
        }
    }, [circular]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadAttachment = () => {
        setDownloading(true);
        setTimeout(() => {
            const fileName = circular.attachment_name || "adjunto_circular.txt";
            const isDoc = fileName.endsWith('.doc') || fileName.endsWith('.docx');
            
            let fileBlob;

            if (circular.attachment_data) {
                try {
                    const base64Data = circular.attachment_data;
                    const parts = base64Data.split(';base64,');
                    const contentType = parts[0].split(':')[1];
                    const raw = window.atob(parts[1]);
                    const rawLength = raw.length;
                    const uInt8Array = new Uint8Array(rawLength);
                    for (let i = 0; i < rawLength; ++i) {
                        uInt8Array[i] = raw.charCodeAt(i);
                    }
                    fileBlob = new Blob([uInt8Array], { type: contentType });
                } catch (err) {
                    console.error("Error decoding base64 attachment:", err);
                }
            }

            if (!fileBlob) {
                if (isDoc) {
                    // Generar un HTML formateado que Microsoft Word abre de forma nativa sin errores de corrupción
                    const docHtml = `
                    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                    <head>
                        <meta charset="utf-8">
                        <title>${circular.title}</title>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; }
                            h2 { color: #1b4332; }
                        </style>
                    </head>
                    <body>
                        <h2>INSTITUTO NUEVA AMÉRICA DE SUBA</h2>
                        <p><strong>Circular N° ${circular.circular_number || '36'} - Documento Adjunto Oficial</strong></p>
                        <hr/>
                        <p>Este archivo contiene los anexos oficiales correspondientes a la circular titulada: <strong>${circular.title}</strong>.</p>
                        <p>Contenido del comunicado:</p>
                        <blockquote>${circular.body}</blockquote>
                    </body>
                    </html>
                    `;
                    fileBlob = new Blob([docHtml], { type: 'application/msword' });
                } else if (fileName.endsWith('.pdf')) {
                    // Descargar un PDF simulado básico
                    const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 612 792 ] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 12 Tf 72 712 Td (Documento de Circular Escolar INAS - Adjunto) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000201 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF`;
                    fileBlob = new Blob([pdfContent], { type: 'application/pdf' });
                } else {
                    // Por defecto, texto plano
                    fileBlob = new Blob([`Archivo Adjunto Escolar: ${fileName}\n\nAsunto: ${circular.title}\nCuerpo:\n${circular.body}`], { type: 'text/plain' });
                }
            }

            const element = document.createElement("a");
            element.href = URL.createObjectURL(fileBlob);
            element.download = fileName;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            setDownloading(false);
        }, 1200);
    };

    const paperStyles = paperSize === 'letter'
        ? { width: '100%', maxWidth: '22cm', minHeight: '27cm', aspectRatio: '22/27' }
        : { width: '100%', maxWidth: '22cm', minHeight: '33cm', aspectRatio: '22/33' };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in">
            {/* Estilos dinámicos de impresión para forzar Carta u Oficio en la impresora física */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    .page-sheet, .page-sheet * {
                        visibility: visible !important;
                    }
                    .page-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 22cm !important;
                        height: ${paperSize === 'letter' ? '27cm' : '33cm'} !important;
                        margin: 0 !important;
                        padding: 1.5cm !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    @page {
                        size: 22cm ${paperSize === 'letter' ? '27cm' : '33cm'};
                        margin: 0;
                    }
                }
            `}} />

            <div className="bg-white rounded-3xl max-w-[24cm] w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
                
                {/* Cabecera de Controles */}
                <div className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-indigo-650" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Documento Oficial</span>
                        {isHighPriority && (
                            <span className="bg-rose-50 text-rose-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-rose-100 animate-pulse">
                                Urgente
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Selector de tamaño de papel físico */}
                        <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setPaperSize('letter')}
                                className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all ${
                                    paperSize === 'letter' 
                                        ? 'bg-white text-slate-800 shadow-sm border border-slate-300/20' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Carta
                            </button>
                            <button
                                onClick={() => setPaperSize('legal')}
                                className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all ${
                                    paperSize === 'legal' 
                                        ? 'bg-white text-slate-800 shadow-sm border border-slate-300/20' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Oficio
                            </button>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition"
                            title="Imprimir Circular"
                        >
                            <Printer size={16} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Contenedor Hoja Escolar (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/35 flex justify-center items-start overflow-x-hidden">
                    <div 
                        style={paperStyles}
                        className="page-sheet bg-white border border-slate-250 p-[1.5cm] rounded-sm shadow-md relative flex flex-col justify-between overflow-hidden mx-auto transition-all duration-200"
                    >
                        
                        {/* Marca de agua del Escudo de fondo */}
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex items-center justify-center select-none">
                            {logoError ? (
                                <svg viewBox="0 0 100 100" className="w-[10cm] h-[10cm] fill-indigo-900 text-indigo-950">
                                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3" />
                                    <path d="M50 15 L20 40 L30 75 L70 75 L80 40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                </svg>
                            ) : (
                                <img 
                                    src="/Escudo.png" 
                                    alt="Marca de agua" 
                                    className="w-[9cm] h-[9cm] object-contain" 
                                />
                            )}
                        </div>

                        {/* Contenido Superior */}
                        <div className="relative z-10">
                            {/* Logo y Encabezado Oficial Centrado */}
                            <div className="flex flex-col items-center text-center pb-5 border-b border-slate-200/80">
                                <div className="w-[1.8cm] h-[1.8cm] mb-3 flex items-center justify-center">
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
                                <div className="space-y-1">
                                    <h1 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase tracking-wide leading-tight">
                                        Instituto Nueva América de Suba
                                    </h1>
                                    <p className="text-[10px] sm:text-xs text-slate-700 font-extrabold italic max-w-lg leading-normal px-2">
                                        "Ciudadanos productivos desde la construcción de proyectos de vida con Calidad y responsabilidad ambiental"
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-mono tracking-wider pt-0.5 uppercase">
                                        {circular.circular_number || '36'}-D-CIR
                                    </p>
                                </div>
                            </div>

                            {/* Título de la Circular en Verde Oscuro e Itálica */}
                            <div className="mt-5 text-center px-2">
                                <h2 className="text-sm sm:text-base text-emerald-850 font-black italic font-serif leading-tight">
                                    Circular N° {circular.circular_number || '36'} ({formattedDateTime.split(' ')[0] || '18 de febrero de 2026'}) {circular.title}
                                </h2>
                            </div>

                            {/* Fecha alineada a la izquierda */}
                            <div className="mt-6 text-left">
                                <p className="text-[11px] font-bold text-slate-700 font-sans">
                                    {formattedDate}
                                </p>
                            </div>

                            {/* Cuerpo del Mensaje */}
                            <div className="mt-4">
                                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-serif text-justify">
                                    {circular.body}
                                </p>
                            </div>
                        </div>

                        {/* Pie de Página: Adjuntos o Acuse */}
                        <div className="mt-8 space-y-4 border-t pt-4 border-slate-100 relative z-10">
                            
                            {/* Mostrar si hay adjuntos */}
                            {circular.attachment_name && (
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 text-indigo-650 rounded-xl flex items-center justify-center shrink-0">
                                            <Paperclip size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-black text-slate-800">Archivo Adjunto Institucional</p>
                                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate max-w-xs sm:max-w-sm">
                                                {circular.attachment_name}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDownloadAttachment}
                                        disabled={downloading}
                                        className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-[10px] px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-650/15 flex items-center gap-1.5 active-press shrink-0"
                                    >
                                        <Download size={12} />
                                        {downloading ? 'Descargando...' : 'Descargar Archivo'}
                                    </button>
                                </div>
                            )}

                            {/* Estado del acuse de recibo */}
                            {circular.requires_acknowledgment && !previewOnly && (
                                <div className="flex justify-center pt-2">
                                    {hasAck ? (
                                        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs font-black w-full justify-center">
                                            <FileCheck size={18} className="text-emerald-600 shrink-0" />
                                            <span>✓ Confirmado: Has firmado de enterado en esta circular.</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => onAcknowledge(circular.id)}
                                            className="w-full bg-slate-900 hover:bg-slate-850 text-white font-black text-xs py-3.5 rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 active-press"
                                        >
                                            <FileCheck size={16} />
                                            Confirmar Lectura y Firmar Acuse de Recibo
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Firma de Autoridad */}
                            <div className="pt-6 flex flex-col items-center text-center">
                                <div className="border-t border-slate-300 w-44 mb-1.5"></div>
                                <span className="text-[9px] font-black text-slate-850 uppercase tracking-widest leading-none">Rectoría Académica</span>
                                <span className="text-[7.5px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">INAS</span>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
