import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, FileText, UserCheck, Search, FileCode, Filter, RefreshCw, CheckCircle2, Clock, FileCheck2, Check, X, ShieldAlert } from 'lucide-react';

export default function PrintFormularioInscripcion() {
    const { studentId } = useParams();
    const navigate = useNavigate();

    const [studentsList, setStudentsList] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(studentId || '');
    const [selectedCourse, setSelectedCourse] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ENTREGADO' | 'PENDIENTE'
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [logoError, setLogoError] = useState(false);
    const [isBlankMode, setIsBlankMode] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Estado del formulario editable (para afinar datos antes de imprimir)
    const [formData, setFormData] = useState({
        formNumber: '001',
        rh: '',
        cursoIngresa: '',
        tipoIngreso: '', // ANTIGUO | NUEVO | REPITENTE
        primerApellido: '',
        segundoApellido: '',
        nombres: '',
        identificacion: '',
        tipoDoc: 'T.I',
        ciudadDoc: 'Bogotá D.C.',
        lugarNacimiento: 'Bogotá D.C.',
        fechaDia: '',
        fechaMes: '',
        fechaAno: '',
        edad: '',
        sexo: '',
        direccion: '',
        barrio: '',
        telefonoFijo: '',
        eps: '',
        celularEstudiante: '',

        // Familiares
        padreNombre: '',
        padreCc: '',
        padreOcupacion: '',
        padreCelular: '',
        padreEmail: '',

        madreNombre: '',
        madreCc: '',
        madreOcupacion: '',
        madreCelular: '',
        madreEmail: '',

        acudienteNombre: '',
        acudienteParentesco: '',
        acudienteTelefono: '',

        familiarCasaNombre: '',
        familiarCasaParentesco: '',
        familiarCasaTelefono: '',

        // Responsable tributario
        respPrimerApellido: '',
        respSegundoApellido: '',
        respNombres: '',
        respIdentificacion: '',
        respCiudad: 'Bogotá D.C.',
        respEmail: '',
        respCelular: '',
        respParentesco: '',

        // Historial académico (filas)
        historial: {
            preescolar: { ano: '', inst: '' },
            primero: { ano: '', inst: '' },
            segundo: { ano: '', inst: '' },
            tercero: { ano: '', inst: '' },
            cuarto: { ano: '', inst: '' },
            quinto: { ano: '', inst: '' },
            sexto: { ano: '', inst: '' },
            septimo: { ano: '', inst: '' },
            octavo: { ano: '', inst: '' },
            noveno: { ano: '', inst: '' },
            decimo: { ano: '', inst: '' },
            once: { ano: '', inst: '' },
        }
    });

    // Cargar listado completo de estudiantes
    useEffect(() => {
        async function fetchStudents() {
            try {
                setLoading(true);
                const snap = await getDocs(collection(db, 'students'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Ordenar por apellidos/nombres y asignar folio consecutivo único a cada alumno
                list.sort((a, b) => {
                    const nameA = a.lastName ? `${a.lastName} ${a.firstName || ''}` : (a.name || '');
                    const nameB = b.lastName ? `${b.lastName} ${b.firstName || ''}` : (b.name || '');
                    return nameA.localeCompare(nameB);
                });

                list.forEach((st, idx) => {
                    st.masterFolio = String(idx + 1).padStart(3, '0');
                });

                setStudentsList(list);

                if (studentId) {
                    setSelectedStudentId(studentId);
                } else if (list.length > 0 && !selectedStudentId) {
                    setSelectedStudentId(list[0].id);
                }
            } catch (err) {
                console.error("Error al cargar estudiantes:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchStudents();
    }, [studentId]);

    // Normalizador de texto (elimina acentos y convierte a minúsculas)
    const normalizeText = (text) => (text || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    // Cursos únicos
    const uniqueCourses = Array.from(new Set(studentsList.map(s => s.grade).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    // Estudiantes por curso seleccionado
    const courseStudents = studentsList.filter(s => selectedCourse === 'ALL' || String(s.grade) === String(selectedCourse));
    const deliveredCount = courseStudents.filter(s => s.form2027Status === 'ENTREGADO').length;
    const pendingCount = courseStudents.length - deliveredCount;
    const percentDelivered = courseStudents.length > 0 ? Math.round((deliveredCount / courseStudents.length) * 100) : 0;

    // Estudiantes filtrados por curso, estado de entrega y búsqueda inteligente
    const filteredStudents = studentsList.filter(s => {
        const matchesCourse = selectedCourse === 'ALL' || String(s.grade) === String(selectedCourse);
        if (!matchesCourse) return false;

        const isDelivered = s.form2027Status === 'ENTREGADO';
        const matchesStatus = statusFilter === 'ALL' 
            || (statusFilter === 'ENTREGADO' && isDelivered)
            || (statusFilter === 'PENDIENTE' && !isDelivered);
        if (!matchesStatus) return false;

        if (!searchQuery.trim()) return true;

        const normQuery = normalizeText(searchQuery);
        const normFull = normalizeText(`${s.lastName || ''} ${s.secondLastName || ''} ${s.firstName || ''} ${s.name || ''} ${s.id_code || ''} ${s.documentNumber || ''}`);

        return normFull.includes(normQuery);
    });

    // Cambiar estado de entrega en Firestore (1-Click toggle)
    const handleToggleDeliveryStatus = async (stId) => {
        const currentSt = studentsList.find(s => s.id === stId);
        if (!currentSt) return;

        const newStatus = currentSt.form2027Status === 'ENTREGADO' ? 'PENDIENTE' : 'ENTREGADO';
        const newDeliveredAt = newStatus === 'ENTREGADO' ? new Date().toISOString() : null;

        // Actualización optimista local
        setStudentsList(prev => prev.map(s => s.id === stId ? { ...s, form2027Status: newStatus, form2027DeliveredAt: newDeliveredAt } : s));

        try {
            setUpdatingStatus(true);
            await updateDoc(doc(db, 'students', stId), {
                form2027Status: newStatus,
                form2027DeliveredAt: newDeliveredAt
            });
        } catch (err) {
            console.error("Error al actualizar estado de entrega:", err);
        } finally {
            setUpdatingStatus(false);
        }
    };

    // Autoseleccionar el primer estudiante coincidente al buscar por texto
    useEffect(() => {
        if (searchQuery.trim() && filteredStudents.length > 0) {
            const isCurrentInFiltered = filteredStudents.some(s => s.id === selectedStudentId);
            if (!isCurrentInFiltered) {
                setSelectedStudentId(filteredStudents[0].id);
                setIsBlankMode(false);
            }
        }
    }, [searchQuery, selectedCourse]);

    // Al cambiar de estudiante, autocompletar formulario
    useEffect(() => {
        if (isBlankMode || !selectedStudentId || studentsList.length === 0) return;

        const sIdx = studentsList.findIndex(item => item.id === selectedStudentId);
        const s = studentsList[sIdx];
        if (!s) return;

        // Descomponer nombres y apellidos
        let pApellido = s.lastName || '';
        let sApellido = s.secondLastName || '';
        let nom = s.firstName || '';

        // Si lastName contiene ambos apellidos (ej: "MONTERO REAL")
        if (pApellido && !sApellido) {
            const parts = pApellido.trim().split(/\s+/);
            if (parts.length >= 2) {
                pApellido = parts[0];
                sApellido = parts.slice(1).join(' ');
            }
        }

        // Si no hay apellidos estructurados, descomponer de s.name
        if (!pApellido && s.name) {
            const parts = s.name.trim().split(/\s+/);
            if (parts.length >= 4) {
                pApellido = parts[0];
                sApellido = parts[1];
                nom = parts.slice(2).join(' ');
            } else if (parts.length === 3) {
                pApellido = parts[0];
                sApellido = parts[1];
                nom = parts[2];
            } else if (parts.length === 2) {
                pApellido = parts[0];
                nom = parts[1];
            } else {
                nom = s.name;
            }
        }

        // Número de formulario único consecutivo e inmutable por estudiante (001, 002, 003...)
        const autoFormNum = s.folioNumber ? String(s.folioNumber).padStart(3, '0') : (s.masterFolio || String(sIdx + 1).padStart(3, '0'));

        setFormData(prev => ({
            ...prev,
            formNumber: autoFormNum,
            primerApellido: pApellido.toUpperCase(),
            segundoApellido: sApellido.toUpperCase(),
            nombres: nom.toUpperCase(),

            rh: '',
            cursoIngresa: '',
            tipoIngreso: '',
            identificacion: '',
            tipoDoc: 'T.I',
            ciudadDoc: '',
            lugarNacimiento: '',
            fechaDia: '',
            fechaMes: '',
            fechaAno: '',
            edad: '',
            sexo: '',
            direccion: '',
            barrio: '',
            telefonoFijo: '',
            eps: '',
            celularEstudiante: '',

            // Padres y Familiares
            padreNombre: '',
            padreCc: '',
            padreOcupacion: '',
            padreCelular: '',
            padreEmail: '',

            madreNombre: '',
            madreCc: '',
            madreOcupacion: '',
            madreCelular: '',
            madreEmail: '',

            acudienteNombre: '',
            acudienteParentesco: '',
            acudienteTelefono: '',

            familiarCasaNombre: '',
            familiarCasaParentesco: '',
            familiarCasaTelefono: '',

            // Responsable
            respPrimerApellido: '',
            respSegundoApellido: '',
            respNombres: '',
            respIdentificacion: '',
            respCiudad: '',
            respEmail: '',
            respCelular: '',
            respParentesco: '',

            historial: {
                preescolar: { ano: '', inst: '' },
                primero: { ano: '', inst: '' },
                segundo: { ano: '', inst: '' },
                tercero: { ano: '', inst: '' },
                cuarto: { ano: '', inst: '' },
                quinto: { ano: '', inst: '' },
                sexto: { ano: '', inst: '' },
                septimo: { ano: '', inst: '' },
                octavo: { ano: '', inst: '' },
                noveno: { ano: '', inst: '' },
                decimo: { ano: '', inst: '' },
                once: { ano: '', inst: '' },
            }
        }));
    }, [selectedStudentId, studentsList, isBlankMode]);

    // Función para activar modo formulario en blanco
    const handleSetBlankMode = () => {
        setIsBlankMode(true);
        setSelectedStudentId('');
        setFormData(prev => ({
            ...prev,
            formNumber: '001',
            primerApellido: '',
            segundoApellido: '',
            nombres: '',
            rh: '',
            cursoIngresa: '',
            tipoIngreso: '',
            identificacion: '',
            ciudadDoc: 'Bogotá D.C.',
            lugarNacimiento: 'Bogotá D.C.',
            fechaDia: '',
            fechaMes: '',
            fechaAno: '',
            edad: '',
            sexo: '',
            direccion: '',
            barrio: '',
            telefonoFijo: '',
            eps: '',
            celularEstudiante: ''
        }));
    };

    const handleSelectStudent = (id) => {
        setIsBlankMode(false);
        setSelectedStudentId(id);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleHistorialChange = (nivel, field, value) => {
        setFormData(prev => ({
            ...prev,
            historial: {
                ...prev.historial,
                [nivel]: {
                    ...prev.historial[nivel],
                    [field]: value
                }
            }
        }));
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 text-slate-800">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-sm font-bold tracking-wide animate-pulse text-slate-700">
                    Cargando Formulario Oficial de Inscripción...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center select-none overflow-y-auto no-print-bg">
            {/* Estilos específicos de impresión (Formato Carta / Letter: 21,6 cm x 27,9 cm) */}
            <style>{`
                @media print {
                    header, sidebar, aside, nav, .no-print {
                        display: none !important;
                    }
                    body, html {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        width: 21.6cm !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print-bg {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    @page {
                        size: 21.6cm 27.9cm;
                        margin: 0;
                    }
                    .printable-page-container {
                        gap: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .printable-page {
                        position: relative !important;
                        width: 21.6cm !important;
                        height: 27.9cm !important;
                        max-height: 27.9cm !important;
                        box-sizing: border-box !important;
                        padding: 0.8cm 1cm !important;
                        margin: 0 auto !important;
                        background: white !important;
                        color: black !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        overflow: hidden !important;
                    }
                    .printable-page:last-of-type, .printable-page:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                        page-break-inside: avoid !important;
                    }
                    input, select, textarea {
                        border: none !important;
                        outline: none !important;
                        background: transparent !important;
                        appearance: none !important;
                        -webkit-appearance: none !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>

            {/* Panel de Controles y Selector Inteligente (Pantalla - Ancho completo max-w-6xl) */}
            <div className="max-w-6xl w-full bg-white rounded-3xl p-5 mb-6 flex flex-col space-y-3 shadow-xl border border-slate-700/10 no-print">
                <div className="flex flex-col md:flex-row justify-between items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate('/')} 
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-2xl transition"
                            title="Volver al Tablero"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <FileText size={16} className="text-indigo-600" /> Formulario de Inscripción 2027
                            </h2>
                            <p className="text-[10px] text-gray-500">
                                Dimensiones oficiales de impresión: 21,6 cm x 27,9 cm (Carta / Letter)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Botón Imprimir en Blanco */}
                        <button 
                            onClick={handleSetBlankMode}
                            className={`font-bold px-4 py-2 rounded-2xl transition text-xs flex items-center gap-1.5 shrink-0 border ${
                                isBlankMode 
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20' 
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Imprimir formulario en blanco sin datos de estudiante"
                        >
                            <FileCode size={15} /> Formulario en Blanco
                        </button>

                        <button 
                            onClick={handlePrint}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-2xl transition text-xs shadow-md shadow-indigo-600/15 flex items-center gap-2 shrink-0"
                        >
                            <Printer size={16} /> Imprimir / PDF
                        </button>
                    </div>
                </div>

                {/* Filtros Inteligentes y Selector de Alumno */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* Filtro por Curso */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <Filter size={14} className="text-slate-400 shrink-0" />
                        <select 
                            value={selectedCourse} 
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full cursor-pointer"
                        >
                            <option value="ALL">🎓 Todos los Cursos</option>
                            {uniqueCourses.map(c => (
                                <option key={c} value={c}>Grado {c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Buscador Inteligente por Texto */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input 
                            type="text"
                            placeholder="Buscar alumno o código..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none w-full"
                        />
                    </div>

                    {/* Desplegable de Estudiantes Filtrados con Código y N° Folio */}
                    <div className="flex items-center gap-1.5 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-1.5">
                        <UserCheck size={14} className="text-indigo-600 shrink-0" />
                        <select 
                            value={selectedStudentId}
                            onChange={(e) => handleSelectStudent(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full truncate cursor-pointer"
                        >
                            <option value="">-- {filteredStudents.length} Estudiante(s) --</option>
                            {filteredStudents.map(st => {
                                const isDel = st.form2027Status === 'ENTREGADO';
                                const codeInfo = st.id_code ? ` | Cód: ${st.id_code}` : (st.documentNumber ? ` | Doc: ${st.documentNumber}` : '');
                                const folioInfo = st.masterFolio ? `[N° ${st.masterFolio}] ` : '';
                                return (
                                    <option key={st.id} value={st.id}>
                                        {isDel ? '✅' : '⏳'} {folioInfo}{st.lastName ? `${st.lastName} ${st.firstName || ''}` : st.name} ({st.grade ? `Grado ${st.grade}` : 'Sin grado'}{codeInfo})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {/* CONTROL Y SEGUIMIENTO DE ENTREGAS (Filtros de Estado & Marcar Entregado) */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col md:flex-row justify-between items-center gap-3">
                    {/* Filtros por Estado de Entrega */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
                            <FileCheck2 size={13} className="text-indigo-600" /> Entrega:
                        </span>
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                            <button
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                    statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                Todos ({courseStudents.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('ENTREGADO')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                    statusFilter === 'ENTREGADO' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                            >
                                <Check size={12} /> Entregados ({deliveredCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('PENDIENTE')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                    statusFilter === 'PENDIENTE' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-50'
                                }`}
                            >
                                <Clock size={12} /> Pendientes ({pendingCount})
                            </button>
                        </div>
                    </div>

                    {/* Barra de Progreso de Entregas por Curso */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex flex-col text-right shrink-0">
                            <span className="text-[10px] font-bold text-slate-500">
                                Avance {selectedCourse === 'ALL' ? 'General' : `Grado ${selectedCourse}`}:
                            </span>
                            <span className="text-xs font-black text-slate-800">
                                {deliveredCount} / {courseStudents.length} ({percentDelivered}%)
                            </span>
                        </div>
                        <div className="w-28 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${percentDelivered}%` }}
                            />
                        </div>
                    </div>

                    {/* Botón de Acción 1-Clic para el Estudiante Seleccionado */}
                    {selectedStudentId && !isBlankMode && (
                        <div className="shrink-0">
                            {(() => {
                                const currentSt = studentsList.find(s => s.id === selectedStudentId);
                                const isDel = currentSt?.form2027Status === 'ENTREGADO';
                                return (
                                    <button
                                        onClick={() => handleToggleDeliveryStatus(selectedStudentId)}
                                        disabled={updatingStatus}
                                        className={`font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm ${
                                            isDel
                                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                        }`}
                                        title={isDel ? "Clic para marcar como pendiente" : "Clic para registrar entrega del formulario"}
                                    >
                                        {updatingStatus ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : isDel ? (
                                            <>
                                                <CheckCircle2 size={14} className="text-emerald-600" />
                                                <span>✅ ENTREGADO</span>
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={14} />
                                                <span>⏳ MARCAR COMO ENTREGADO</span>
                                            </>
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* DOCUMENTO HOJA 1 & HOJA 2 */}
            <div className="printable-page-container flex flex-col items-center gap-8 w-full">

                {/* HOJA 1 (21,6 cm x 27,9 cm) */}
                <div className="printable-page w-[21.6cm] h-[27.9cm] bg-white p-[0.8cm] border border-slate-300 shadow-2xl relative flex flex-col justify-between overflow-hidden text-black font-sans text-[11px] leading-snug">
                    
                    <div>
                        {/* Encabezado Institucional */}
                        <div className="flex items-start justify-between gap-2 border-b border-black pb-2">
                            {/* Logo */}
                            <div className="w-[2.2cm] h-[2.2cm] shrink-0 flex items-center justify-center pt-1">
                                {logoError ? (
                                    <div className="border border-black p-1 text-[8px] font-bold text-center">ESCUDO INAS</div>
                                ) : (
                                    <img 
                                        src="/Escudo1.png" 
                                        alt="Escudo Instituto Nueva América" 
                                        className="w-full h-full object-contain"
                                        onError={() => setLogoError(true)} 
                                    />
                                )}
                            </div>

                            {/* Titulación Central */}
                            <div className="flex-1 text-center leading-tight">
                                <h1 style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '16pt', fontWeight: 'bold' }} className="tracking-wide uppercase">
                                    INSTITUTO NUEVA AMERICA DE SUBA
                                </h1>
                                <p style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt' }} className="font-semibold mt-0.5">
                                    Nit. 900.030.860-0 Inscripción No. 5056 Licencia No. 03775 de Noviembre de 1989
                                </p>
                                <p style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt' }}>
                                    Resolución de Aprobación No. 4275 de Octubre de 1994
                                </p>
                                <p style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt' }}>
                                    Ratificación Licencia de Funcionamiento No. 110042 de Marzo de 2014
                                </p>

                                <div className="mt-2 text-center">
                                    <h2 className="text-[14px] font-extrabold tracking-widest text-blue-800 uppercase">
                                        FORMULARIO DE INSCRIPCIÓN
                                    </h2>
                                    <h3 className="text-[14px] font-extrabold text-blue-800">
                                        2027
                                    </h3>
                                </div>
                            </div>

                            {/* Foto Obligatoria & No. Folio */}
                            <div className="flex flex-col items-end gap-1">
                                <div className="w-[2.4cm] h-[3.1cm] border border-black flex items-center justify-center text-center p-1 text-[11px] font-serif leading-tight bg-slate-50/50">
                                    Foto<br />Obligatoria
                                </div>
                            </div>
                        </div>

                        {/* Número Folio */}
                        <div className="flex justify-between items-center mt-1 font-bold text-red-600 text-[12px]">
                            <span>No. <input type="text" value={formData.formNumber} onChange={(e) => handleInputChange('formNumber', e.target.value)} className="w-16 border-b border-red-400 text-red-600 font-bold text-[12px] px-1 focus:outline-none" /></span>
                        </div>

                        {/* 1. DATOS PERSONALES */}
                        <div className="mt-1">
                            <div className="flex justify-between items-center mb-1">
                                <h3 style={{ fontSize: '12pt' }} className="font-extrabold text-blue-800 uppercase">
                                    1. DATOS PERSONALES
                                </h3>
                                <div className="flex items-center gap-1 text-[11px]">
                                    <span style={{ fontSize: '11pt' }} className="font-bold">RH</span>
                                    <input 
                                        type="text" 
                                        value={formData.rh} 
                                        onChange={(e) => handleInputChange('rh', e.target.value)}
                                        className="w-10 border border-black text-center font-bold px-0.5 uppercase" 
                                        style={{ fontSize: '9pt' }}
                                    />
                                </div>
                            </div>

                            {/* Tabla Datos Personales */}
                            <table className="w-full border-collapse border border-black" style={{ fontSize: '8pt' }}>
                                <tbody>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1 w-[35%]">
                                            <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>CURSO AL QUE INGRESA: </span>
                                            <input 
                                                type="text" 
                                                value={formData.cursoIngresa} 
                                                onChange={(e) => handleInputChange('cursoIngresa', e.target.value)}
                                                className="ml-1 w-24 font-bold text-slate-900 border-b border-dotted border-slate-400 focus:outline-none"
                                                style={{ fontSize: '9pt' }}
                                            />
                                        </td>
                                        <td className="border-r border-black p-1 text-center">
                                            <label className="cursor-pointer inline-flex items-center gap-1" style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                                ANTIGUO
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.tipoIngreso === 'ANTIGUO'} 
                                                    onChange={() => handleInputChange('tipoIngreso', 'ANTIGUO')}
                                                    className="w-3.5 h-3.5 accent-blue-800"
                                                />
                                            </label>
                                        </td>
                                        <td className="border-r border-black p-1 text-center">
                                            <label className="cursor-pointer inline-flex items-center gap-1" style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                                NUEVO
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.tipoIngreso === 'NUEVO'} 
                                                    onChange={() => handleInputChange('tipoIngreso', 'NUEVO')}
                                                    className="w-3.5 h-3.5 accent-blue-800"
                                                />
                                            </label>
                                        </td>
                                        <td className="p-1 text-center">
                                            <label className="cursor-pointer inline-flex items-center gap-1" style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                                REPITENTE
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.tipoIngreso === 'REPITENTE'} 
                                                    onChange={() => handleInputChange('tipoIngreso', 'REPITENTE')}
                                                    className="w-3.5 h-3.5 accent-blue-800"
                                                />
                                            </label>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1 w-[33%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Primer Apellido</span>
                                            <input type="text" value={formData.primerApellido} onChange={(e) => handleInputChange('primerApellido', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1 w-[33%]" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Segundo Apellido</span>
                                            <input type="text" value={formData.segundoApellido} onChange={(e) => handleInputChange('segundoApellido', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1 w-[34%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Nombres</span>
                                            <input type="text" value={formData.nombres} onChange={(e) => handleInputChange('nombres', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1" colSpan="3">
                                            <span style={{ fontSize: '8pt' }} className="inline-block">Identificación: CC. T.I NIP No.</span>
                                            <input type="text" value={formData.identificacion} onChange={(e) => handleInputChange('identificacion', e.target.value)} className="ml-2 font-mono font-bold w-48 focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Ciudad</span>
                                            <input type="text" value={formData.ciudadDoc} onChange={(e) => handleInputChange('ciudadDoc', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Lugar de Nacimiento</span>
                                            <input type="text" value={formData.lugarNacimiento} onChange={(e) => handleInputChange('lugarNacimiento', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1" colSpan="2">
                                            <div className="flex items-center gap-1" style={{ fontSize: '8pt' }}>
                                                <span>Fecha</span>
                                                <span>Día:</span>
                                                <input type="text" value={formData.fechaDia} onChange={(e) => handleInputChange('fechaDia', e.target.value)} className="w-6 border-b border-black text-center font-bold" style={{ fontSize: '8.5pt' }} />
                                                <span>Mes:</span>
                                                <input type="text" value={formData.fechaMes} onChange={(e) => handleInputChange('fechaMes', e.target.value)} className="w-6 border-b border-black text-center font-bold" style={{ fontSize: '8.5pt' }} />
                                                <span>Año:</span>
                                                <input type="text" value={formData.fechaAno} onChange={(e) => handleInputChange('fechaAno', e.target.value)} className="w-10 border-b border-black text-center font-bold" style={{ fontSize: '8.5pt' }} />
                                            </div>
                                        </td>
                                        <td className="p-1">
                                            <div className="flex items-center justify-between" style={{ fontSize: '8pt' }}>
                                                <span>Edad: <input type="text" value={formData.edad} onChange={(e) => handleInputChange('edad', e.target.value)} className="w-8 font-bold border-b border-black text-center" style={{ fontSize: '8.5pt' }} /></span>
                                                <span>Sexo: <input type="text" value={formData.sexo} onChange={(e) => handleInputChange('sexo', e.target.value)} className="w-12 font-bold border-b border-black text-center uppercase" style={{ fontSize: '8.5pt' }} /></span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Dirección de Residencia:</span>
                                            <input type="text" value={formData.direccion} onChange={(e) => handleInputChange('direccion', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Barrio</span>
                                            <input type="text" value={formData.barrio} onChange={(e) => handleInputChange('barrio', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Teléfono fijo</span>
                                            <input type="text" value={formData.telefonoFijo} onChange={(e) => handleInputChange('telefonoFijo', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-black p-1" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">E.P.S a la cual se encuentra afiliado</span>
                                            <input type="text" value={formData.eps} onChange={(e) => handleInputChange('eps', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">No. Celular del estudiante:</span>
                                            <input type="text" value={formData.celularEstudiante} onChange={(e) => handleInputChange('celularEstudiante', e.target.value)} className="w-full font-bold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 2. DATOS FAMILIARES */}
                        <div className="mt-2">
                            <h3 style={{ fontSize: '12pt' }} className="font-extrabold text-blue-800 uppercase mb-1">
                                2. DATOS FAMILIARES
                            </h3>

                            <table className="w-full border-collapse border border-black" style={{ fontSize: '8pt' }}>
                                <tbody>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1 w-[70%]" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Nombres y Apellidos del Padre</span>
                                            <input type="text" value={formData.padreNombre} onChange={(e) => handleInputChange('padreNombre', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1 w-[30%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">C.C.</span>
                                            <input type="text" value={formData.padreCc} onChange={(e) => handleInputChange('padreCc', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1 w-[40%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Ocupación:</span>
                                            <input type="text" value={formData.padreOcupacion} onChange={(e) => handleInputChange('padreOcupacion', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1 w-[30%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Celular:</span>
                                            <input type="text" value={formData.padreCelular} onChange={(e) => handleInputChange('padreCelular', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1 w-[30%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Email:</span>
                                            <input type="text" value={formData.padreEmail} onChange={(e) => handleInputChange('padreEmail', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Nombres y Apellidos de la Madre</span>
                                            <input type="text" value={formData.madreNombre} onChange={(e) => handleInputChange('madreNombre', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">C.C.</span>
                                            <input type="text" value={formData.madreCc} onChange={(e) => handleInputChange('madreCc', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Ocupación:</span>
                                            <input type="text" value={formData.madreOcupacion} onChange={(e) => handleInputChange('madreOcupacion', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Celular:</span>
                                            <input type="text" value={formData.madreCelular} onChange={(e) => handleInputChange('madreCelular', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Email:</span>
                                            <input type="text" value={formData.madreEmail} onChange={(e) => handleInputChange('madreEmail', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Nombres y Apellidos del acudiente</span>
                                            <input type="text" value={formData.acudienteNombre} onChange={(e) => handleInputChange('acudienteNombre', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Parentesco</span>
                                            <input type="text" value={formData.acudienteParentesco} onChange={(e) => handleInputChange('acudienteParentesco', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Teléfono:</span>
                                            <input type="text" value={formData.acudienteTelefono} onChange={(e) => handleInputChange('acudienteTelefono', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Nombres y Apellidos de un familiar que viva en casa propia</span>
                                            <input type="text" value={formData.familiarCasaNombre} onChange={(e) => handleInputChange('familiarCasaNombre', e.target.value)} className="w-full font-semibold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Parentesco:</span>
                                            <input type="text" value={formData.familiarCasaParentesco} onChange={(e) => handleInputChange('familiarCasaParentesco', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Teléfono:</span>
                                            <input type="text" value={formData.familiarCasaTelefono} onChange={(e) => handleInputChange('familiarCasaTelefono', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 3. HISTORIAL ACADÉMICO */}
                        <div className="mt-2">
                            <h3 style={{ fontSize: '12pt' }} className="font-extrabold text-blue-800 uppercase mb-1">
                                3. HISTORIAL ACADÉMICO
                            </h3>

                            <table className="w-full border-collapse border border-black text-center" style={{ fontSize: '8pt' }}>
                                <thead>
                                    <tr className="bg-slate-100 font-extrabold text-blue-800 border-b border-black">
                                        <th className="border-r border-black py-0.5 px-1 w-[18%] text-left">NIVEL</th>
                                        <th className="border-r border-black py-0.5 px-1 w-[12%]">Año</th>
                                        <th className="border-r border-black py-0.5 px-1 w-[20%] text-left">INSTITUCIÓN</th>
                                        <th className="border-r border-black py-0.5 px-1 w-[18%] text-left">NIVEL</th>
                                        <th className="border-r border-black py-0.5 px-1 w-[12%]">Año</th>
                                        <th className="py-0.5 px-1 w-[20%] text-left">INSTITUCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { leftKey: 'preescolar', leftLabel: 'Preescolar', rightKey: 'sexto', rightLabel: 'Sexto' },
                                        { leftKey: 'primero', leftLabel: 'Primero', rightKey: 'septimo', rightLabel: 'Séptimo' },
                                        { leftKey: 'segundo', leftLabel: 'Segundo', rightKey: 'octavo', rightLabel: 'Octavo' },
                                        { leftKey: 'tercero', leftLabel: 'Tercero', rightKey: 'noveno', rightLabel: 'Noveno' },
                                        { leftKey: 'cuarto', leftLabel: 'Cuarto', rightKey: 'decimo', rightLabel: 'Décimo' },
                                        { leftKey: 'quinto', leftLabel: 'Quinto', rightKey: 'once', rightLabel: 'Once' },
                                    ].map((row, idx) => (
                                        <tr key={idx} className="border-b border-black">
                                            <td className="border-r border-black py-0.5 px-1 text-left font-bold">{row.leftLabel}</td>
                                            <td className="border-r border-black py-0.5 px-1">
                                                <input type="text" value={formData.historial[row.leftKey].ano} onChange={(e) => handleHistorialChange(row.leftKey, 'ano', e.target.value)} className="w-full text-center focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                            </td>
                                            <td className="border-r border-black py-0.5 px-1 text-left">
                                                <input type="text" value={formData.historial[row.leftKey].inst} onChange={(e) => handleHistorialChange(row.leftKey, 'inst', e.target.value)} className="w-full focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                            </td>
                                            <td className="border-r border-black py-0.5 px-1 text-left font-bold">{row.rightLabel}</td>
                                            <td className="border-r border-black py-0.5 px-1">
                                                <input type="text" value={formData.historial[row.rightKey].ano} onChange={(e) => handleHistorialChange(row.rightKey, 'ano', e.target.value)} className="w-full text-center focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                            </td>
                                            <td className="py-0.5 px-1 text-left">
                                                <input type="text" value={formData.historial[row.rightKey].inst} onChange={(e) => handleHistorialChange(row.rightKey, 'inst', e.target.value)} className="w-full focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Nota de Costo por Pérdida */}
                        <div className="mt-1.5 font-semibold text-black leading-tight flex items-start gap-1" style={{ fontSize: '8pt' }}>
                            <span>•</span>
                            <p>El daño o perdida de este documento tiene un costo de $20.000 que se deberán pagar en la secretaria del colegio.</p>
                        </div>
                    </div>

                    {/* Recuadro Legal Protección de Datos (Pie de Página 1) */}
                    <div className="border border-blue-900 p-2 leading-tight text-blue-950 text-justify rounded-sm" style={{ fontSize: '8pt' }}>
                        En cumplimiento de lo dispuesto en la Ley 1581/2012 de Protección de Datos, le informamos que sus datos personales recogidos mediante este formulario, serán incorporados en la base de ALUMNOS Y FAMILIARES, datos titularidad del INSTITUTO NUEVA AMERICA DE SUBA SAS para la tramitación de admisión en este centro educativo y para su posterior gestión en caso de ser admitido, así como para otras funciones asociadas a la educación, fines comerciales y operativos exclusivamente relacionados con la actividad del colegio. Su aceptación, implica que usted presta su consentimiento expreso para llevar a cabo el citado tratamiento y para su uso con las finalidades expuestas. Así mismo, le informamos que podrá ejercitar sus derechos de conocer, actualizar, rectificar, suprimir y revocar su autorización al tratamiento de los datos personales recogidos en este formulario, dirigiéndose a la Calle 136 No 95B85
                    </div>
                </div>

                {/* HOJA 2 (21,6 cm x 27,9 cm) */}
                <div className="printable-page w-[21.6cm] h-[27.9cm] bg-white p-[0.8cm] border border-slate-300 shadow-2xl relative flex flex-col justify-between overflow-hidden text-black font-sans text-[11px] leading-snug">
                    
                    <div>
                        {/* Marco Legal Inicial */}
                        <div className="text-justify leading-snug space-y-1.5" style={{ fontSize: '8pt' }}>
                            <p className="font-bold">
                                El Consejo Directivo se ampara en las leyes y normas nacionales y departamentales; además, de las estipuladas en el Manual de Convivencia Escolar y de lo Conceptuado por la Corte Constitucional cuando declara que:
                            </p>
                            <p className="italic">
                                “Al momento de matricularse una persona en un Centro Educativo celebra por ese acto un Contrato de Naturaleza Civil; un contrato es un acuerdo de voluntades para crear obligaciones”. (ST- 612/92).
                            </p>
                            <p className="italic">
                                “La exigibilidad de esas reglas mínimas al alumno resulta acorde con sus propios derechos y perfectamente legítima cuando se encuentran consignadas en el Manual de Convivencia Escolar que él y sus acudientes, firman al momento de establecer la vinculación educativa. Nadie obliga al aspirante a suscribir ese documento, así como a integrar el plantel, pero lo que sí se le puede exigir, inclusive mediante razonables razones es que cumpla sus cláusulas una vez han entrado en Vigor, en este orden de ideas, concedida la oportunidad de estudio, el comportamiento del estudiante si reiteradamente incumple pautas mínimas y denota desinterés o grave indisciplina puede ser tomado en cuenta como motivo de exclusión”. (SC- 555/94).
                            </p>
                        </div>

                        {/* RESPONSABLE TRIBUTARIO */}
                        <div className="mt-4">
                            <h3 style={{ fontSize: '11pt' }} className="font-bold text-center uppercase tracking-wide mb-1 border-b border-black pb-0.5">
                                RESPONSABLE TRIBUTARIO
                            </h3>

                            <table className="w-full border-collapse border border-black" style={{ fontSize: '8pt' }}>
                                <tbody>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1 w-[33%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Primer Apellido</span>
                                            <input type="text" value={formData.respPrimerApellido} onChange={(e) => handleInputChange('respPrimerApellido', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1 w-[33%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Segundo Apellido</span>
                                            <input type="text" value={formData.respSegundoApellido} onChange={(e) => handleInputChange('respSegundoApellido', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1 w-[34%]">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Nombres</span>
                                            <input type="text" value={formData.respNombres} onChange={(e) => handleInputChange('respNombres', e.target.value)} className="w-full font-bold uppercase focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-black">
                                        <td className="border-r border-black p-1" colSpan="2">
                                            <span style={{ fontSize: '8pt' }} className="inline-block">Identificación I CC. T.I NIP No.</span>
                                            <input type="text" value={formData.respIdentificacion} onChange={(e) => handleInputChange('respIdentificacion', e.target.value)} className="ml-2 font-mono font-bold w-48 focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Ciudad</span>
                                            <input type="text" value={formData.respCiudad} onChange={(e) => handleInputChange('respCiudad', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Correo electrónico para facturación electrónica:</span>
                                            <input type="text" value={formData.respEmail} onChange={(e) => handleInputChange('respEmail', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="border-r border-black p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Celular:</span>
                                            <input type="text" value={formData.respCelular} onChange={(e) => handleInputChange('respCelular', e.target.value)} className="w-full font-bold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                        <td className="p-1">
                                            <span style={{ fontSize: '8pt' }} className="block text-gray-700">Parentesco estudiante</span>
                                            <input type="text" value={formData.respParentesco} onChange={(e) => handleInputChange('respParentesco', e.target.value)} className="w-full font-semibold focus:outline-none" style={{ fontSize: '8.5pt' }} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <p style={{ fontSize: '8.5pt' }} className="font-semibold text-blue-700 text-center mt-1">
                                La persona que quede adscrita en este documento no se podrá modificar a lo largo del año académico.s
                            </p>
                        </div>

                        {/* COMPROMISOS DE LOS PADRES DE FAMILIA */}
                        <div className="mt-4">
                            <h3 style={{ fontSize: '11pt' }} className="font-bold uppercase tracking-wide mb-1 border-b border-black pb-0.5">
                                COMPROMISOS DE LOS PADRES DE FAMILIA.
                            </h3>

                            <div className="text-justify leading-relaxed space-y-2" style={{ fontSize: '8pt' }}>
                                <p>
                                    La vinculación directa de la familia a la Institución es indispensable para lograr la educación y formación integral de los hijos, por consiguiente y también dando cumplimiento a la ley 1098 de infancia y adolescencia, los padres deben cumplir las siguientes obligaciones.
                                </p>
                                <p>
                                    Asistir de manera obligatoria, responsable y fiel a las citaciones, talleres escuela de padres y actos social sativos, con el fin de controlar en forma permanente al(a) estudiante y así garantizar su desarrollo armónico e integral
                                </p>
                                <p>
                                    No se recibirán trabajos, tareas, elementos escolares durante la jornada, se debe prever con anterioridad y es responsabilidad de los padres velar por el cumplimiento de los recursos necesarios para presentar actividades académicas.
                                </p>
                                <p className="font-bold">
                                    Por tanto al diligenciar y firmar el presente documento se ACEPTAN las normas established en el MANUAL DE CONVIVENCIA POR PARTE DE MADRE, PADRE / ACUDIENTE, Y ESTUDIANTE.
                                </p>
                                <p className="font-semibold italic">
                                    En constancia firma Padre, Madre o Acudiente y Estudiante.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* FIRMAS PIE DE PÁGINA 2 */}
                    <div className="mt-12 pb-6 grid grid-cols-2 gap-12 text-center" style={{ fontSize: '8pt' }}>
                        <div className="flex flex-col items-center">
                            <div className="border-t border-black w-full mb-1"></div>
                            <span className="font-bold uppercase">ESTUDIANTE T.I NUIP NIP.</span>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className="border-t border-black w-full mb-1"></div>
                            <span className="font-bold uppercase">RESPONSABLE CC.</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
