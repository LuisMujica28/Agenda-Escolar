import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { Loader2, QrCode, ShieldCheck, Copy, Check, Printer } from 'lucide-react';
import { getStudentForUser } from '../../lib/getStudentForUser';
import { getStudentPhoto, DEFAULT_STUDENT_PHOTO } from '../../lib/avatarHelper';

export default function DigitalID() {
    const { currentUser } = useAuth();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function loadStudent() {
            if (!currentUser) return;

            // Modo Demo
            if (currentUser.uid.startsWith('fake-')) {
                setStudent({
                    name: "Juanito Pérez",
                    grade: "9A",
                    id_code: "ST-2023-001",
                    photo_url: ""
                });
                setLoading(false);
                return;
            }

            try {
                const activeStudent = await getStudentForUser(db, currentUser);

                if (activeStudent) {
                    setStudent({
                        name: activeStudent.name || `${activeStudent.firstName || ''} ${activeStudent.lastName || ''}`,
                        firstName: activeStudent.firstName || '',
                        lastName: activeStudent.lastName || '',
                        grade: activeStudent.grade,
                        id_code: activeStudent.id_code || activeStudent.code || 'ST-N/A',
                        photo_url: activeStudent.photo_url || ""
                    });
                } else {
                    setStudent({
                        name: "Alumno no asignado",
                        grade: "N/A",
                        id_code: "ST-N/A",
                        photo_url: ""
                    });
                }
            } catch (error) {
                console.error("Error al cargar carnet:", error);
            } finally {
                setLoading(false);
            }
        }

        loadStudent();
    }, [currentUser]);

    const handleCopyCode = () => {
        if (!student?.id_code) return;
        navigator.clipboard.writeText(student.id_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-600 w-8 h-8" />
                <p className="text-xs font-bold text-gray-400">Generando carnet estudiantil digital...</p>
            </div>
        );
    }

    const displayName = student?.lastName && student?.firstName 
        ? `${student.firstName} ${student.lastName}` 
        : student?.name || 'Estudiante';

    return (
        <div className="max-w-sm mx-auto space-y-4 py-2 sm:py-6 animate-fade-in">
            {/* Tarjeta de Carnet Estilo Credencial Digital */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/80 relative text-left">
                {/* Cabecera Institucional Azul */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 px-5 pt-5 pb-14 text-white relative">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md border border-white/40 ring-1 ring-indigo-500/30">
                                <img src="/Escudo1.png" alt="Escudo INAS" className="w-full h-full object-contain" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-200 truncate leading-tight">
                                    INSTITUTO NUEVA AMÉRICA DE SUBA
                                </p>
                                <p className="text-[11px] font-black tracking-tight text-white">
                                    Carnet Estudiantil Digital
                                </p>
                            </div>
                        </div>

                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Activo
                        </span>
                    </div>
                </div>

                {/* Contenido del Carnet */}
                <div className="px-5 pb-6 pt-0 relative text-center -mt-10">
                    {/* Foto del Alumno */}
                    <div className="w-24 h-24 mx-auto rounded-3xl border-4 border-white shadow-lg bg-white overflow-hidden mb-3 relative group">
                        <img 
                            src={getStudentPhoto(student?.photo_url)} 
                            alt={displayName} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                        />
                    </div>

                    <h2 className="text-lg sm:text-xl font-black text-gray-800 tracking-tight leading-tight">
                        {displayName}
                    </h2>
                    <p className="text-xs font-bold text-indigo-600 mt-0.5">
                        Curso: {student?.grade} • Año Escolar 2026
                    </p>

                    {/* Código QR Oficial */}
                    <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                        <div className="w-32 h-32 p-2 bg-white rounded-xl shadow-inner border border-slate-200/60 flex items-center justify-center">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(student?.id_code || 'INAS')}`} 
                                alt="QR Code" 
                                className="w-full h-full object-contain"
                            />
                        </div>

                        {/* Código de Estudiante con botón de copiar */}
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                {student?.id_code || 'ST-N/A'}
                            </span>
                            <button
                                onClick={handleCopyCode}
                                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 transition active-press touch-target"
                                title="Copiar código"
                            >
                                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Footer del Carnet */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1">
                            <ShieldCheck size={13} className="text-emerald-600" /> Oficial INAS
                        </span>
                        <span>Vigencia: Dic 2026</span>
                    </div>
                </div>
            </div>

            {/* Acciones para el Padre / Estudiante */}
            <div className="flex gap-2">
                <button
                    onClick={handleCopyCode}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs min-h-[42px] touch-target active-press"
                >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copied ? 'Código Copiado' : 'Copiar Código'}
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15 min-h-[42px] touch-target active-press"
                >
                    <Printer size={14} /> Imprimir / PDF
                </button>
            </div>
        </div>
    );
}

