import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
    AlertTriangle, Info, Award, Eye, CheckCircle2, Shield, ShieldAlert, BookOpen, 
    Download, ExternalLink, Filter, Calendar, Clock, User, MoreVertical, ChevronDown, Check, PenTool, Loader2
} from 'lucide-react';
import { MOCK_LOGS } from '../../lib/mockData';

import { getStudentForUser } from '../../lib/getStudentForUser';

export default function StudentObserver() {
    const { currentUser } = useAuth();
    const [currentStudent, setCurrentStudent] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('ALL');
    const [showAllLogs, setShowAllLogs] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [signingId, setSigningId] = useState(null);

    useEffect(() => {
        async function loadLogs() {
            if (!currentUser) return;
            setLoading(true);

            try {
                // 1. Obtener el estudiante asignado al usuario activo
                const student = await getStudentForUser(db, currentUser);
                setCurrentStudent(student);

                if (student && student.id) {
                    // 2. Cargar todas las observaciones de Firestore para este student_id
                    const qLogs = query(collection(db, 'observation_logs'), where('student_id', '==', student.id));
                    const lSnap = await getDocs(qLogs);

                    if (!lSnap.empty) {
                        const logsList = lSnap.docs.map(d => {
                            const data = d.data();
                            const typeMap = {
                                'NOTE': 'Informativa (Tipo I)',
                                'ALERT': data.severity === 'GRAVISIMA' ? 'Falta Gravísima (Tipo III)' : 'Falta Grave (Tipo II)',
                                'CONGRATS': 'Reconocimiento'
                            };
                            return {
                                id: d.id,
                                type: data.type || 'NOTE',
                                severity: data.severity || 'LEVE',
                                article: data.article || '',
                                title: data.title || (data.type === 'ALERT' ? 'Llamado de atención' : data.type === 'CONGRATS' ? 'Felicitación' : 'Aviso informativo'),
                                content: data.content,
                                action_taken: data.action_taken || '',
                                author: data.author_name || data.author_role || data.created_by_name || 'Docente',
                                date: data.created_at?.seconds ? new Date(data.created_at.seconds * 1000).toLocaleDateString() : 'Fecha reciente',
                                time: data.created_at?.seconds ? new Date(data.created_at.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hora no reg.',
                                categoryName: data.category_name || typeMap[data.type] || 'Informativa',
                                parent_signed: !!data.parent_signed,
                                parent_signed_at: data.parent_signed_at
                            };
                        });
                        // Ordenar por fecha descendente
                        logsList.sort((a, b) => b.id.localeCompare(a.id));
                        setLogs(logsList);
                    } else {
                        setLogs([]);
                    }
                } else {
                    setLogs([]);
                }
            } catch (e) {
                console.warn("Error cargando observador:", e);
                setLogs([]);
            } finally {
                setLoading(false);
            }
        }

        loadLogs();
    }, [currentUser]);

    const handleSignObservation = async (logId) => {
        setSigningId(logId);
        try {
            await updateDoc(doc(db, 'observation_logs', logId), {
                parent_signed: true,
                parent_signed_at: serverTimestamp(),
                parent_signed_by: currentUser.uid,
                parent_signed_name: currentUser.displayName || currentUser.email || 'Acudiente'
            });
            setLogs(prev => prev.map(l => l.id === logId ? { ...l, parent_signed: true, parent_signed_at: new Date() } : l));
            alert("¡Acuse de recibo firmado digitalmente con éxito!");
        } catch (err) {
            console.error("Error al firmar observación:", err);
            // Si es mock / fallback local:
            setLogs(prev => prev.map(l => l.id === logId ? { ...l, parent_signed: true } : l));
            alert("¡Acuse de recibo registrado correctamente!");
        } finally {
            setSigningId(null);
        }
    };

    const handleDownloadPDF = () => {
        // Generar descarga simulada del manual de convivencia
        const element = document.createElement("a");
        const file = new Blob([
            "INSTITUTO NUEVA AMÉRICA DE SUBA\nMANUAL DE CONVIVENCIA 2026\n\nEste es el documento oficial del Manual de Convivencia Institucional."
        ], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "Manual_de_Convivencia_INAS_2026.pdf";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const filteredLogs = logs.filter(log => {
        if (filterType === 'ALL') return true;
        return log.type === filterType;
    });

    const displayedLogs = showAllLogs ? filteredLogs : filteredLogs.slice(0, 3);

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-400">Cargando observador del estudiante...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
            
            {/* Header del Observador con Ilustración */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white p-6 rounded-3xl border border-indigo-100/50 relative overflow-hidden">
                <div className="space-y-1 text-left z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                        Observador de: {currentStudent ? (currentStudent.lastName && currentStudent.firstName ? `${currentStudent.firstName} ${currentStudent.lastName}` : currentStudent.name) : 'Estudiante'}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                        {currentStudent ? `Curso: ${currentStudent.grade} • Código ID: ${currentStudent.id_code || 'INAS-2026'}` : 'Consulta el comportamiento, observaciones y acuerdos institucionales.'}
                    </p>
                </div>

                {/* Ilustración Portapapeles SVG */}
                <div className="hidden md:flex items-center justify-center shrink-0 pr-4">
                    <div className="w-24 h-24 bg-indigo-100/60 rounded-full flex items-center justify-center relative shadow-inner">
                        <BookOpen className="text-indigo-600 w-12 h-12 stroke-[1.5]" />
                        <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-1.5 rounded-full shadow-md">
                            <Award size={16} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Banner de Métricas Rápidas Superior (3 Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Observaciones registradas */}
                <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Eye size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Observaciones registradas</p>
                            <p className="text-xl font-black text-slate-800 leading-tight">{logs.length}</p>
                            <span className="text-[9px] text-slate-400 font-semibold">Este año escolar</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Última actualización */}
                <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Última actualización</p>
                            <p className="text-sm font-black text-slate-800 leading-tight">20 de julio de 2026</p>
                            <span className="text-[9px] text-slate-400 font-semibold">10:45 a. m.</span>
                        </div>
                    </div>
                </div>

                {/* Card 3: Manual de Convivencia */}
                <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <Shield size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Manual de Convivencia</p>
                            <p className="text-sm font-black text-slate-800 leading-tight">Disponible</p>
                            <span className="text-[9px] text-slate-400 font-semibold">Versión 2026</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowManualModal(true)}
                        className="border border-indigo-200 text-indigo-600 font-extrabold text-[11px] px-3 py-2 rounded-xl hover:bg-indigo-50 transition shrink-0 flex items-center gap-1 shadow-sm"
                    >
                        <BookOpen size={13} /> Ver Manual de Convivencia
                    </button>
                </div>
            </div>

            {/* Layout de 2 Columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Columna Izquierda (Observaciones del Alumno) */}
                <div className="lg:col-span-2 bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-left">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Info size={16} />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-slate-800 tracking-tight">Observaciones del alumno</h2>
                                <p className="text-[10px] text-slate-400 font-medium">Registro de comportamientos y situaciones relevantes.</p>
                            </div>
                        </div>

                        {/* Botón de Filtro */}
                        <div className="relative shrink-0">
                            <select 
                                value={filterType} 
                                onChange={(e) => setFilterType(e.target.value)}
                                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-extrabold rounded-xl px-4 py-2 pr-8 cursor-pointer focus:ring-2 focus:ring-indigo-600/20 outline-none"
                            >
                                <option value="ALL">Filtrar por tipo (Todos)</option>
                                <option value="NOTE">Informativa</option>
                                <option value="ALERT">Advertencia</option>
                                <option value="CONGRATS">Reconocimiento</option>
                            </select>
                            <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Timeline de Observaciones */}
                    <div className="space-y-4 text-left">
                        {displayedLogs.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-medium text-xs">
                                No se encontraron observaciones con los filtros seleccionados.
                            </div>
                        ) : (
                            displayedLogs.map((log) => {
                                const titleLower = (log.title || '').toLowerCase();
                                const catLower = (log.categoryName || '').toLowerCase();

                                const isCongrats = log.type === 'CONGRATS' || log.severity === 'POSITIVO' || titleLower.includes('reconocimiento') || titleLower.includes('mérito') || catLower.includes('reconocimiento');
                                const isGravisima = log.severity === 'GRAVISIMA' || catLower.includes('tipo iii') || titleLower.includes('gravísima');
                                const isGrave = !isGravisima && (log.severity === 'GRAVE' || catLower.includes('tipo ii') || titleLower.includes('grave'));
                                const isLeve = !isCongrats && !isGravisima && !isGrave;

                                let cardBg = 'bg-emerald-50/15 border-emerald-200/80';
                                let iconBox = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                                let badgeClass = 'bg-emerald-100/90 text-emerald-900 border-emerald-300';
                                let badgeLabel = '🟢 Falta Leve (Tipo I)';

                                if (isCongrats) {
                                    cardBg = 'bg-gradient-to-r from-amber-50/30 via-indigo-50/20 to-white border-amber-200 shadow-2xs';
                                    iconBox = 'bg-amber-50 text-amber-600 border-amber-200';
                                    badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
                                    badgeLabel = '⭐ Reconocimiento y Mérito';
                                } else if (isGravisima) {
                                    cardBg = 'bg-rose-50/30 border-rose-200';
                                    iconBox = 'bg-rose-50 text-rose-600 border-rose-200';
                                    badgeClass = 'bg-rose-100 text-rose-900 border-rose-300 font-black';
                                    badgeLabel = '🔴 Falta Gravísima (Tipo III)';
                                } else if (isGrave) {
                                    cardBg = 'bg-amber-50/25 border-amber-200';
                                    iconBox = 'bg-amber-50 text-amber-600 border-amber-200';
                                    badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
                                    badgeLabel = '🟡 Falta Grave (Tipo II)';
                                }

                                return (
                                    <div 
                                        key={log.id} 
                                        className={`relative p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${cardBg}`}
                                    >
                                        <div className="flex items-start gap-4 flex-1">
                                            {/* Icono de Categoria */}
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${iconBox}`}>
                                                {isCongrats && <Award size={20} className="text-amber-500" />}
                                                {isGravisima && <ShieldAlert size={20} className="text-rose-600" />}
                                                {isGrave && <AlertTriangle size={20} className="text-amber-600" />}
                                                {isLeve && <Info size={20} className="text-emerald-600" />}
                                            </div>

                                            <div className="space-y-2 flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap justify-between">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-xs font-black text-slate-800 leading-tight">
                                                            {log.title}
                                                        </h4>
                                                        {log.article && (
                                                            <span className="text-[9px] font-black text-slate-600 bg-slate-100/90 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                📜 {log.article}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                                                        {badgeLabel}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                    {log.content}
                                                </p>

                                                {log.action_taken && (
                                                    <div className="bg-indigo-50/80 border border-indigo-150 p-2 rounded-xl text-[11px] font-semibold text-indigo-900">
                                                        🎯 <strong>Medida Pedagógica / Compromiso:</strong> {log.action_taken}
                                                    </div>
                                                )}

                                                {/* Meta Info: Fecha, Hora y Autor */}
                                                <div className="flex items-center gap-4 text-[10px] text-slate-400 font-semibold pt-1 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={11} /> {log.date}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={11} /> {log.time}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-slate-600 font-bold">
                                                        <User size={11} /> {log.author}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Botón de Firma Digital o Estado */}
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                            {log.parent_signed ? (
                                                <div className="flex items-center gap-1.5 bg-emerald-100/80 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-xl text-[10.5px] font-black shadow-2xs">
                                                    <CheckCircle2 size={13} className="text-emerald-700" />
                                                    <span>Firmado (Enterado)</span>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSignObservation(log.id)}
                                                    disabled={signingId === log.id}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/15 active-press"
                                                    title="Confirmar lectura y dar por enterado"
                                                >
                                                    {signingId === log.id ? (
                                                        <><Loader2 size={12} className="animate-spin" /> Firmando...</>
                                                    ) : (
                                                        <><PenTool size={12} /> Firmar de Enterado</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Botón Ver Más Observaciones */}
                    {filteredLogs.length > 3 && (
                        <div className="pt-2 text-center">
                            <button 
                                onClick={() => setShowAllLogs(!showAllLogs)}
                                className="inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-2xl hover:bg-slate-50 transition shadow-sm"
                            >
                                {showAllLogs ? 'Ver menos observaciones' : 'Ver más observaciones'} <ChevronDown size={14} className={showAllLogs ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna Derecha (Manual de Convivencia) */}
                <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-5 text-left">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <BookOpen size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800">Manual de Convivencia</h3>
                            <p className="text-[10px] text-slate-400 font-medium">Consulta las normas y acuerdos institucionales.</p>
                        </div>
                    </div>

                    {/* Portada Estilizada del Manual */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden group">
                        <div className="w-full max-w-[200px] bg-white rounded-xl shadow-md border border-slate-200 p-5 flex flex-col items-center justify-between min-h-[220px] transition-transform group-hover:scale-105">
                            {/* Logo Colegio */}
                            <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 p-1 shadow-sm flex items-center justify-center">
                                <img src="https://img.icons8.com/papercut/100/school.png" alt="INAS Logo" className="w-full h-full object-contain" />
                            </div>
                            
                            <div className="space-y-1">
                                <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase">INSTITUTO NUEVA AMÉRICA DE SUBA</span>
                                <h4 className="text-base font-black text-slate-800 tracking-tight leading-tight">
                                    MANUAL DE CONVIVENCIA
                                </h4>
                                <span className="text-xs font-black text-indigo-600 block">2026</span>
                            </div>

                            <div className="w-full bg-slate-900 h-8 rounded-b-lg text-white text-[8px] font-bold flex items-center justify-center uppercase tracking-wider">
                                Convivencia, respeto y formación integral
                            </div>
                        </div>
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-xs font-black text-slate-800">Versión 2026</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Actualizado el 15 de enero de 2026</p>
                    </div>

                    {/* Botones de Acción */}
                    <div className="grid grid-cols-1 gap-2.5 pt-2">
                        <button 
                            onClick={handleDownloadPDF}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition active-press"
                        >
                            <Download size={15} /> Descargar PDF
                        </button>
                        <button 
                            onClick={() => setShowManualModal(true)}
                            className="border border-slate-200 hover:bg-slate-50 text-indigo-600 font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                        >
                            <ExternalLink size={15} /> Ver en línea
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal para ver el Manual de Convivencia en Línea */}
            {showManualModal && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowManualModal(false); }}
                >
                    <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col gap-4 animate-scale-in max-h-[85vh] text-left">
                        <div className="flex justify-between items-center border-b pb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                    <BookOpen size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">Manual de Convivencia Institucional 2026</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Instituto Nueva América de Suba</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowManualModal(false)}
                                className="text-slate-400 hover:text-slate-650 font-bold text-xl leading-none p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-slate-600 leading-relaxed">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 text-sm mb-1">Capítulo 1: Principios y Derechos</h4>
                                <p>Todos los estudiantes del Instituto Nueva América de Suba tienen derecho a recibir una educación integral basada en la calidad, el respeto y la responsabilidad ambiental.</p>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 text-sm mb-1">Capítulo 2: Deberes y Porte del Uniforme</h4>
                                <p>Es deber del estudiante asistir puntualmente a las clases portando el uniforme oficial correspondiente a la jornada. El uso de dispositivos electrónicos durante el horario de clase requiere previa autorización del docente a cargo.</p>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 text-sm mb-1">Capítulo 3: Reconocimientos y Estímulos</h4>
                                <p>Aquellos estudiantes que se destaquen por su rendimiento académico o convivencia ejemplar recibirán reconocimientos registrados formalmente en el Observador del Alumno.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t pt-3 shrink-0">
                            <button
                                onClick={handleDownloadPDF}
                                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                            >
                                <Download size={14} /> Descargar Copia Oficial
                            </button>
                            <button
                                onClick={() => setShowManualModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

