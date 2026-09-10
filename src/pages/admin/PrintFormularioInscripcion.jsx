import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Loader2, ArrowLeft, Printer, FileText, UserCheck, Search, FileCode, Filter, 
    RefreshCw, CheckCircle2, Clock, FileCheck2, Check, X, ShieldAlert, Camera, 
    Upload, Image as ImageIcon, UserPlus, Users, Phone, Calendar, Bookmark, 
    Tag, AlertCircle, Sparkles, ExternalLink, HelpCircle, User, CheckCircle,
    Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import { isValidStudentPhoto } from '../../lib/avatarHelper';

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

    // Modo de vista: 'matriculados' | 'aspirantes'
    const [activeTabMode, setActiveTabMode] = useState('matriculados');

    // Listado de Aspirantes / Visitantes
    const [aspirantsList, setAspirantsList] = useState([]);
    const [selectedAspirantId, setSelectedAspirantId] = useState('');
    const [aspirantStatusFilter, setAspirantStatusFilter] = useState('ALL'); // 'ALL' | 'ENTREGADO' | 'RADICADO' | 'MATRICULADO' | 'ARCHIVADO'
    const [aspirantSearchQuery, setAspirantSearchQuery] = useState('');
    const [isAspirantsListCollapsed, setIsAspirantsListCollapsed] = useState(false);

    // Modal Confirmación de Eliminación de Aspirante
    const [aspirantToDelete, setAspirantToDelete] = useState(null);
    const [deletingAspirant, setDeletingAspirant] = useState(false);

    // Modal Nuevo Formulario Aspirante
    const [showNewAspirantModal, setShowNewAspirantModal] = useState(false);
    const [newAspContact, setNewAspContact] = useState('');
    const [newAspStudentName, setNewAspStudentName] = useState('');
    const [newAspPhone, setNewAspPhone] = useState('');
    const [newAspEmail, setNewAspEmail] = useState('');
    const [newAspGrade, setNewAspGrade] = useState('TRANSICION');
    const [newAspNotes, setNewAspNotes] = useState('');
    const [savingAspirant, setSavingAspirant] = useState(false);

    // Modal Oficializar Matrícula
    const [showMatricularModal, setShowMatricularModal] = useState(false);
    const [aspirantToMatricular, setAspirantToMatricular] = useState(null);
    const [matFirstName, setMatFirstName] = useState('');
    const [matLastName, setMatLastName] = useState('');
    const [matGrade, setMatGrade] = useState('');
    const [matParentName, setMatParentName] = useState('');
    const [matParentPhone, setMatParentPhone] = useState('');
    const [processingMatricula, setProcessingMatricula] = useState(false);

    // Estado del formulario editable (para afinar datos antes de imprimir)
    const [formData, setFormData] = useState({
        formNumber: '001',
        photo_url: '',
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
                    st.masterFolio = st.folioNumber ? String(st.folioNumber).padStart(3, '0') : String(idx + 1).padStart(3, '0');
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

        async function fetchAspirants() {
            try {
                const snap = await getDocs(collection(db, 'aspirants'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => {
                    const numA = a.codeNumber || parseInt(String(a.formCode || '').replace(/\D/g, ''), 10) || 0;
                    const numB = b.codeNumber || parseInt(String(b.formCode || '').replace(/\D/g, ''), 10) || 0;
                    return numB - numA;
                });
                setAspirantsList(list);
            } catch (err) {
                console.error("Error al cargar aspirantes:", err);
            }
        }

        fetchStudents();
        fetchAspirants();
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
            photo_url: isValidStudentPhoto(s.photo_url) ? s.photo_url : '',
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

    // Función para procesar y optimizar foto del estudiante directamente
    const handleFormPhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 480;

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

                setFormData(prev => ({ ...prev, photo_url: optimizedDataUrl }));

                if (selectedStudentId) {
                    try {
                        await updateDoc(doc(db, 'students', selectedStudentId), {
                            photo_url: optimizedDataUrl
                        });
                        setStudentsList(prev => prev.map(st => st.id === selectedStudentId ? { ...st, photo_url: optimizedDataUrl } : st));
                        alert("¡Foto actualizada en el perfil del estudiante y en el formulario con éxito!");
                    } catch (err) {
                        console.error("Error guardando foto en Firestore:", err);
                    }
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Función para activar modo formulario en blanco
    const handleSetBlankMode = () => {
        setIsBlankMode(true);
        setSelectedStudentId('');
        setFormData(prev => ({
            ...prev,
            formNumber: '001',
            photo_url: '',
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

    // Calcular siguiente código de aspirante (ASP-001, ASP-002, etc.)
    const calculateNextAspirantCode = () => {
        const maxNum = aspirantsList.reduce((max, a) => {
            const num = a.codeNumber || parseInt(String(a.formCode || '').replace(/\D/g, ''), 10) || 0;
            return Math.max(max, num);
        }, 0);
        const nextNum = maxNum + 1;
        return {
            codeNumber: nextNum,
            formCode: `ASP-${String(nextNum).padStart(3, '0')}`
        };
    };

    // Cargar los datos de un aspirante en el formulario
    const loadAspirantIntoForm = (asp) => {
        setIsBlankMode(true);
        setSelectedStudentId('');
        setSelectedAspirantId(asp.id);

        const nameParts = (asp.studentName || '').trim().split(/\s+/);
        let pAp = '', sAp = '', nom = '';
        if (nameParts.length === 1) nom = nameParts[0];
        else if (nameParts.length === 2) { pAp = nameParts[0]; nom = nameParts[1]; }
        else if (nameParts.length >= 3) { pAp = nameParts[0]; sAp = nameParts[1]; nom = nameParts.slice(2).join(' '); }

        setFormData(prev => ({
            ...prev,
            formNumber: asp.formCode || 'ASP-001',
            photo_url: '',
            primerApellido: pAp.toUpperCase(),
            segundoApellido: sAp.toUpperCase(),
            nombres: nom.toUpperCase(),
            cursoIngresa: asp.gradeInterest || '',
            tipoIngreso: 'NUEVO',
            acudienteNombre: asp.contactName || '',
            acudienteCelular: asp.phone || '',
            acudienteEmail: asp.email || '',
            padreCelular: asp.phone || '',
            madreCelular: asp.phone || '',
            rh: '',
            identificacion: '',
            tipoDoc: 'T.I',
            ciudadDoc: 'Bogotá D.C.',
            lugarNacimiento: 'Bogotá D.C.',
            fechaDia: '', fechaMes: '', fechaAno: '', edad: '', sexo: '',
            direccion: '', barrio: '', telefonoFijo: '', eps: '', celularEstudiante: ''
        }));
    };

    const handleSelectAspirant = (aspId) => {
        if (!aspId) return;
        const found = aspirantsList.find(a => a.id === aspId);
        if (found) {
            loadAspirantIntoForm(found);
        }
    };

    // Crear formulario para nuevo aspirante
    const handleCreateAspirantForm = async (e) => {
        if (e) e.preventDefault();
        setSavingAspirant(true);
        try {
            const nextCodeInfo = calculateNextAspirantCode();
            const docData = {
                formCode: nextCodeInfo.formCode,
                codeNumber: nextCodeInfo.codeNumber,
                contactName: newAspContact.trim() || 'Aspirante / Interesado',
                studentName: newAspStudentName.trim() || '',
                phone: newAspPhone.trim() || '',
                email: newAspEmail.trim() || '',
                gradeInterest: newAspGrade || 'TRANSICION',
                notes: newAspNotes.trim() || '',
                status: 'ENTREGADO', // ENTREGADO | RADICADO | MATRICULADO | ARCHIVADO
                deliveryDate: new Date().toISOString().split('T')[0],
                created_at: new Date()
            };

            const docRef = await addDoc(collection(db, 'aspirants'), docData);
            const createdItem = { id: docRef.id, ...docData };

            setAspirantsList(prev => [createdItem, ...prev]);
            setSelectedAspirantId(docRef.id);
            setActiveTabMode('aspirantes');

            // Cargar en el formulario
            loadAspirantIntoForm(createdItem);

            // Limpiar modal
            setNewAspContact('');
            setNewAspStudentName('');
            setNewAspPhone('');
            setNewAspEmail('');
            setNewAspNotes('');
            setShowNewAspirantModal(false);

            alert(`✅ ¡Formulario ${nextCodeInfo.formCode} asignado y registrado con éxito!\n\nSe ha preparado en pantalla con su código único oficial para imprimir.`);
        } catch (err) {
            console.error("Error creando formulario de aspirante:", err);
            alert("Hubo un error al registrar el formulario.");
        } finally {
            setSavingAspirant(false);
        }
    };

    // Actualizar estado de formulario de aspirante
    const handleUpdateAspirantStatus = async (aspirantId, newStatus) => {
        try {
            await updateDoc(doc(db, 'aspirants', aspirantId), { status: newStatus });
            setAspirantsList(prev => prev.map(a => a.id === aspirantId ? { ...a, status: newStatus } : a));
        } catch (err) {
            console.error("Error actualizando estado de aspirante:", err);
            alert("Error al actualizar el estado.");
        }
    };

    // Confirmar y ejecutar eliminación de formulario de aspirante
    const handleConfirmDeleteAspirant = async () => {
        if (!aspirantToDelete) return;
        setDeletingAspirant(true);
        try {
            await deleteDoc(doc(db, 'aspirants', aspirantToDelete.id));
            const updated = aspirantsList.filter(a => a.id !== aspirantToDelete.id);
            setAspirantsList(updated);

            if (selectedAspirantId === aspirantToDelete.id) {
                if (updated.length > 0) {
                    handleSelectAspirant(updated[0].id);
                } else {
                    setSelectedAspirantId('');
                    handleSetBlankMode();
                }
            }
            setAspirantToDelete(null);
        } catch (err) {
            console.error("Error al eliminar aspirante:", err);
            alert("Hubo un error al intentar eliminar el formulario.");
        } finally {
            setDeletingAspirant(false);
        }
    };

    // Abrir modal de oficializar matrícula
    const handleOpenMatricularModal = (asp) => {
        setAspirantToMatricular(asp);
        const nameParts = (asp.studentName || '').trim().split(/\s+/);
        if (nameParts.length >= 2) {
            setMatLastName(nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' '));
            setMatFirstName(nameParts.slice(Math.ceil(nameParts.length / 2)).join(' '));
        } else {
            setMatFirstName(asp.studentName || '');
            setMatLastName('');
        }
        setMatGrade(asp.gradeInterest || '101');
        setMatParentName(asp.contactName || '');
        setMatParentPhone(asp.phone || '');
        setShowMatricularModal(true);
    };

    // Confirmar conversión de aspirante a estudiante oficial
    const handleConfirmMatricula = async (e) => {
        if (e) e.preventDefault();
        if (!matFirstName.trim() || !matLastName.trim() || !matGrade) {
            alert("Por favor completa nombres, apellidos y curso del nuevo estudiante.");
            return;
        }
        setProcessingMatricula(true);
        try {
            // Calcular consecutivo de folio general para alumnos oficiales
            const maxExistingFolio = studentsList.reduce((max, s) => {
                const num = parseInt(s.folioNumber || s.masterFolio || '0', 10);
                return isNaN(num) ? max : Math.max(max, num);
            }, studentsList.length);
            const nextFolioNumber = String(maxExistingFolio + 1).padStart(3, '0');

            // Generar código único de estudiante
            const sameGradeCount = studentsList.filter(s => s.grade === matGrade).length;
            const studentCode = `ST-${matGrade}-${String(sameGradeCount + 1).padStart(3, '0')}`;
            const fullName = `${matFirstName.trim()} ${matLastName.trim()}`.toUpperCase();

            // Crear alumno oficial en la colección 'students'
            const newStudentRef = await addDoc(collection(db, 'students'), {
                name: fullName,
                firstName: matFirstName.trim().toUpperCase(),
                lastName: matLastName.trim().toUpperCase(),
                grade: matGrade,
                id_code: studentCode,
                folioNumber: nextFolioNumber,
                photo_url: '',
                nombre_padre: matParentName.trim() || '',
                telefono_padre: matParentPhone.trim() || '',
                parent_uids: [],
                form2027Status: 'ENTREGADO',
                formularioOrigen: aspirantToMatricular?.formCode || '',
                created_at: new Date()
            });

            // Actualizar estado del aspirante a MATRICULADO
            if (aspirantToMatricular?.id) {
                await updateDoc(doc(db, 'aspirants', aspirantToMatricular.id), {
                    status: 'MATRICULADO',
                    student_id: newStudentRef.id,
                    matriculado_fecha: new Date().toISOString()
                });
                setAspirantsList(prev => prev.map(a => a.id === aspirantToMatricular.id ? { ...a, status: 'MATRICULADO', student_id: newStudentRef.id } : a));
            }

            // Agregar a la lista local de estudiantes
            const newStudentObj = {
                id: newStudentRef.id,
                name: fullName,
                firstName: matFirstName.trim().toUpperCase(),
                lastName: matLastName.trim().toUpperCase(),
                grade: matGrade,
                id_code: studentCode,
                folioNumber: nextFolioNumber,
                masterFolio: nextFolioNumber,
                form2027Status: 'ENTREGADO'
            };
            setStudentsList(prev => [...prev, newStudentObj]);

            setShowMatricularModal(false);
            alert(`🎉 ¡Matrícula Oficializada con Éxito!\n\nEl estudiante ${fullName} ha sido incorporado a la lista oficial en Grado ${matGrade} con el Folio N° ${nextFolioNumber} y Código ${studentCode}.`);

            // Cambiar a vista oficial y seleccionar el nuevo alumno
            setActiveTabMode('matriculados');
            setIsBlankMode(false);
            setSelectedStudentId(newStudentRef.id);
        } catch (err) {
            console.error("Error oficializando matrícula:", err);
            alert("Error al oficializar la matrícula.");
        } finally {
            setProcessingMatricula(false);
        }
    };

    // Filtrar lista de aspirantes
    const filteredAspirants = aspirantsList.filter(asp => {
        const query = (aspirantSearchQuery || '').toLowerCase().trim();
        const matchesSearch = !query || 
            (asp.formCode || '').toLowerCase().includes(query) ||
            (asp.contactName || '').toLowerCase().includes(query) ||
            (asp.studentName || '').toLowerCase().includes(query) ||
            (asp.phone || '').includes(query) ||
            (asp.gradeInterest || '').toLowerCase().includes(query);

        if (aspirantStatusFilter === 'ALL') return matchesSearch;
        return matchesSearch && asp.status === aspirantStatusFilter;
    });

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
                @media screen {
                    .printable-page-container {
                        width: 100%;
                        max-width: 100%;
                        overflow-x: auto;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding-bottom: 24px;
                    }
                }
            `}</style>

            {/* Panel de Controles y Selector Inteligente (Pantalla - Ancho completo max-w-6xl) */}
            <div className="max-w-6xl w-full bg-white rounded-3xl p-5 mb-6 flex flex-col space-y-3 shadow-xl border border-slate-700/10 no-print">
                {/* Encabezado y Selector Primario de Modo */}
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
                                Radicación oficial, control de aspirantes e impresión formato Carta.
                            </p>
                        </div>
                    </div>

                    {/* Botonera de Acciones Superiores */}
                    <div className="flex items-center flex-wrap gap-2">
                        {/* Botón Destacado: Entregar Formulario a Aspirante */}
                        <button 
                            onClick={() => setShowNewAspirantModal(true)}
                            className="font-black px-3.5 py-2 rounded-2xl transition text-xs flex items-center gap-1.5 shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-600/20"
                            title="Asignar código único ASP-xxx a un nuevo aspirante que viene a preguntar"
                        >
                            <UserPlus size={15} /> + Formulario Aspirante (ASP)
                        </button>

                        {/* Botón Adjuntar / Cambiar Foto */}
                        <button 
                            type="button"
                            onClick={() => document.getElementById('form-photo-upload-input')?.click()}
                            disabled={isBlankMode}
                            className="font-bold px-3.5 py-2 rounded-2xl transition text-xs flex items-center gap-1.5 shrink-0 border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-2xs disabled:opacity-40"
                            title="Subir o cambiar foto 3x4 del estudiante"
                        >
                            <Camera size={15} /> {isValidStudentPhoto(formData.photo_url) ? 'Cambiar Foto 3x4' : 'Adjuntar Foto 3x4'}
                        </button>

                        {/* Botón Imprimir en Blanco */}
                        <button 
                            onClick={handleSetBlankMode}
                            className={`font-bold px-4 py-2 rounded-2xl transition text-xs flex items-center gap-1.5 shrink-0 border ${
                                isBlankMode && activeTabMode === 'matriculados'
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

                {/* Pestañas de Navegación: Alumnos Oficiales vs Aspirantes */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <button
                        onClick={() => {
                            setActiveTabMode('matriculados');
                            setIsBlankMode(false);
                            if (studentsList.length > 0 && !selectedStudentId) {
                                setSelectedStudentId(studentsList[0].id);
                            }
                        }}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
                            activeTabMode === 'matriculados'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                        }`}
                    >
                        <Users size={14} /> Estudiantes Oficiales ({studentsList.length})
                    </button>
                    <button
                        onClick={() => {
                            setActiveTabMode('aspirantes');
                            setIsBlankMode(true);
                            if (aspirantsList.length > 0 && !selectedAspirantId) {
                                setSelectedAspirantId(aspirantsList[0].id);
                                loadAspirantIntoForm(aspirantsList[0]);
                            }
                        }}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
                            activeTabMode === 'aspirantes'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                                : 'bg-purple-50/70 hover:bg-purple-100/70 text-purple-700 border border-purple-200/60'
                        }`}
                    >
                        <FileCode size={14} /> Control de Aspirantes ({aspirantsList.length})
                    </button>
                </div>

                {/* VISTA 1: ALUMNOS MATRICULADOS OFICIALES */}
                {activeTabMode === 'matriculados' && (
                    <>
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

                        {/* CONTROL Y SEGUIMIENTO DE ENTREGAS */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col md:flex-row justify-between items-center gap-3">
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
                    </>
                )}

                {/* VISTA 2: CONTROL DE ASPIRANTES / PROSPECTOS */}
                {activeTabMode === 'aspirantes' && (
                    <div className="space-y-3 pt-1">
                        {/* Filtros de Estado & Buscador de Aspirantes */}
                        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2">
                            {/* Filtros de Estado Rápidos en Pastillas */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                                <button
                                    onClick={() => setAspirantStatusFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                        aspirantStatusFilter === 'ALL'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                >
                                    Todos ({aspirantsList.length})
                                </button>
                                <button
                                    onClick={() => setAspirantStatusFilter('ENTREGADO')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                        aspirantStatusFilter === 'ENTREGADO'
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}
                                >
                                    🟡 Entregados ({aspirantsList.filter(a => a.status === 'ENTREGADO').length})
                                </button>
                                <button
                                    onClick={() => setAspirantStatusFilter('RADICADO')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                        aspirantStatusFilter === 'RADICADO'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}
                                >
                                    🔵 Radicados ({aspirantsList.filter(a => a.status === 'RADICADO').length})
                                </button>
                                <button
                                    onClick={() => setAspirantStatusFilter('MATRICULADO')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                        aspirantStatusFilter === 'MATRICULADO'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                >
                                    🟢 Matriculados ({aspirantsList.filter(a => a.status === 'MATRICULADO').length})
                                </button>
                                <button
                                    onClick={() => setAspirantStatusFilter('ARCHIVADO')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                        aspirantStatusFilter === 'ARCHIVADO'
                                            ? 'bg-slate-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                >
                                    ⚪ Archivados ({aspirantsList.filter(a => a.status === 'ARCHIVADO').length})
                                </button>
                            </div>

                            {/* Buscador de Aspirantes */}
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 md:w-72">
                                <Search size={14} className="text-slate-400 shrink-0" />
                                <input 
                                    type="text"
                                    placeholder="Buscar código ASP, familia, tel..."
                                    value={aspirantSearchQuery}
                                    onChange={(e) => setAspirantSearchQuery(e.target.value)}
                                    className="bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none w-full"
                                />
                                {aspirantSearchQuery && (
                                    <button 
                                        onClick={() => setAspirantSearchQuery('')}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Barra Informativa con botón de Plegar / Desplegar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-2xl px-3.5 py-2 shadow-2xs">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                                <span className="font-black text-purple-700 flex items-center gap-1">
                                    <FileText size={14} /> Formulario cargado en hoja:
                                </span>
                                {(() => {
                                    const activeAsp = aspirantsList.find(a => a.id === selectedAspirantId);
                                    if (!activeAsp) return <span className="text-slate-500 italic">Ninguno seleccionado (haz clic en uno abajo)</span>;
                                    return (
                                        <span className="font-extrabold text-purple-950 bg-white border border-purple-300 px-2.5 py-0.5 rounded-lg shadow-2xs">
                                            [{activeAsp.formCode}] {activeAsp.contactName} {activeAsp.studentName ? `(${activeAsp.studentName})` : ''} - Grado {activeAsp.gradeInterest}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-500 hidden md:inline">
                                    {filteredAspirants.length} de {aspirantsList.length} registro(s)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsAspirantsListCollapsed(!isAspirantsListCollapsed)}
                                    className="px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs"
                                    title={isAspirantsListCollapsed ? "Desplegar lista de aspirantes" : "Ocultar lista para ver el formulario completo"}
                                >
                                    {isAspirantsListCollapsed ? (
                                        <>
                                            <ChevronDown size={14} /> Ver Lista ({aspirantsList.length})
                                        </>
                                    ) : (
                                        <>
                                            <ChevronUp size={14} /> Ocultar Lista (Ver Hoja)
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* LISTADO COMPLETO DE FORMULARIOS DE ASPIRANTES (Colapsable) */}
                        {!isAspirantsListCollapsed && (
                        <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                            {filteredAspirants.length === 0 ? (
                                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                                    <p className="text-xs font-bold text-slate-600">No se encontraron formularios de aspirantes con los filtros actuales.</p>
                                    <button 
                                        onClick={() => { setAspirantStatusFilter('ALL'); setAspirantSearchQuery(''); }} 
                                        className="mt-2 text-xs font-bold text-indigo-600 underline"
                                    >
                                        Restablecer filtros
                                    </button>
                                </div>
                            ) : (
                                filteredAspirants.map(asp => {
                                    const isSelected = asp.id === selectedAspirantId;
                                    return (
                                        <div 
                                            key={asp.id}
                                            onClick={() => handleSelectAspirant(asp.id)}
                                            className={`rounded-2xl p-3 border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-400/40 shadow-sm'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                                            }`}
                                        >
                                            {/* Bloque Izquierdo: Código, Fecha y Datos */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="flex flex-col items-center shrink-0">
                                                    <span className={`font-black text-xs px-2.5 py-1 rounded-xl shadow-xs ${
                                                        isSelected ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800 border border-purple-200'
                                                    }`}>
                                                        {asp.formCode}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        {asp.deliveryDate || 'Sin fecha'}
                                                    </span>
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-xs font-black text-slate-900 truncate">
                                                            {asp.contactName}
                                                        </h4>
                                                        {asp.studentName && (
                                                            <span className="text-[11px] text-purple-800 bg-purple-100/70 px-2 py-0.5 rounded-md font-bold truncate">
                                                                Aspirante: {asp.studentName}
                                                            </span>
                                                        )}
                                                        {isSelected && (
                                                            <span className="text-[10px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                                                <Check size={10} /> En Hoja
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-3 mt-1 flex-wrap">
                                                        <span>Curso de Interés: <strong className="text-slate-800 font-bold">Grado {asp.gradeInterest || 'N/A'}</strong></span>
                                                        {asp.phone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone size={11} className="text-slate-400" /> <strong className="text-slate-800">{asp.phone}</strong>
                                                            </span>
                                                        )}
                                                        {asp.notes && (
                                                            <span className="text-slate-600 italic truncate max-w-xs" title={asp.notes}>
                                                                Nota: {asp.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bloque Derecho: Estado & Acciones */}
                                            <div 
                                                className="flex items-center gap-2 flex-wrap shrink-0 self-end md:self-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {/* Selector de Estado */}
                                                <select
                                                    value={asp.status || 'ENTREGADO'}
                                                    onChange={(e) => handleUpdateAspirantStatus(asp.id, e.target.value)}
                                                    className="bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer hover:border-purple-300"
                                                >
                                                    <option value="ENTREGADO">🟡 Entregado (Pendiente)</option>
                                                    <option value="RADICADO">🔵 Radicado (Devuelto)</option>
                                                    <option value="ARCHIVADO">⚪ Archivado (No volvió)</option>
                                                    {asp.status === 'MATRICULADO' && (
                                                        <option value="MATRICULADO">🟢 Matriculado Oficial</option>
                                                    )}
                                                </select>

                                                {/* Botón Ver / Cargar en Hoja */}
                                                <button
                                                    onClick={() => handleSelectAspirant(asp.id)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shrink-0 ${
                                                        isSelected
                                                            ? 'bg-purple-600 text-white shadow-2xs'
                                                            : 'bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 border border-slate-200'
                                                    }`}
                                                    title="Cargar los datos de este aspirante en el formulario para imprimir"
                                                >
                                                    <FileText size={13} /> {isSelected ? 'Cargado' : 'Cargar en Hoja'}
                                                </button>

                                                {/* Botón Matricular */}
                                                {asp.status !== 'MATRICULADO' ? (
                                                    <button
                                                        onClick={() => handleOpenMatricularModal(asp)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl transition shadow-2xs flex items-center gap-1 shrink-0"
                                                        title="Convertir este aspirante en estudiante oficial de la institución"
                                                    >
                                                        <CheckCircle2 size={13} /> Oficializar Matrícula
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl flex items-center gap-1">
                                                        <CheckCircle size={12} /> Alumno Matriculado
                                                    </span>
                                                )}

                                                {/* Botón Eliminar con Modal de Confirmación */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAspirantToDelete(asp);
                                                    }}
                                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition shrink-0"
                                                    title="Eliminar este formulario de aspirante"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        )}
                    </div>
                )}
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

                            {/* Foto Obligatoria (3x4 cm) */}
                            <div className="flex flex-col items-end gap-1">
                                <div 
                                    className="w-[2.4cm] h-[3.1cm] border border-black flex items-center justify-center text-center p-0.5 text-[11px] font-serif leading-tight bg-slate-50/50 overflow-hidden relative group cursor-pointer"
                                    title={isBlankMode ? "Espacio oficial de fotografía 3x4 cm" : "Clic para cambiar o subir foto 3x4 cm"}
                                    onClick={() => !isBlankMode && document.getElementById('form-photo-upload-input')?.click()}
                                >
                                    {!isBlankMode && isValidStudentPhoto(formData.photo_url) ? (
                                        <img 
                                            src={formData.photo_url} 
                                            alt="Foto del Estudiante" 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-800">
                                            <span className="text-[10px] font-serif font-bold leading-tight">Foto<br />Obligatoria</span>
                                            <span className="text-[8px] font-sans text-slate-500 mt-0.5">3 x 4 cm</span>
                                        </div>
                                    )}
                                    {!isBlankMode && (
                                        <div className="absolute inset-0 bg-indigo-900/60 text-white flex flex-col items-center justify-center text-[8px] font-bold opacity-0 group-hover:opacity-100 transition no-print">
                                            <Camera size={14} className="mb-0.5" />
                                            Cambiar
                                        </div>
                                    )}
                                </div>
                                <input 
                                    id="form-photo-upload-input" 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleFormPhotoChange} 
                                />
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

            {/* MODAL 1: NUEVO FORMULARIO PARA ASPIRANTE (ASP-xxx) */}
            {showNewAspirantModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                                    <UserPlus size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">Entregar Formulario a Aspirante</h3>
                                    <p className="text-[10px] text-slate-500">Genera código único sin registrar al alumno oficial todavía.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowNewAspirantModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-lg"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-900">Código Asignado al Formulario:</span>
                            <span className="text-sm font-black px-3 py-1 rounded-xl bg-purple-600 text-white shadow-xs">
                                {calculateNextAspirantCode().formCode}
                            </span>
                        </div>

                        <form onSubmit={handleCreateAspirantForm} className="space-y-3 text-left">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Nombre del Acudiente / Familia <span className="text-purple-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Familia Rodríguez, Pedro Gómez (Papá)"
                                    value={newAspContact}
                                    onChange={(e) => setNewAspContact(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Nombre del Aspirante (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Santiago Rodríguez"
                                        value={newAspStudentName}
                                        onChange={(e) => setNewAspStudentName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Curso de Interés <span className="text-purple-600">*</span>
                                    </label>
                                    <select
                                        value={newAspGrade}
                                        onChange={(e) => setNewAspGrade(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="TRANSICION">Transición (Preescolar)</option>
                                        {uniqueCourses.filter(c => c !== 'TRANSICION').map(c => (
                                            <option key={c} value={c}>Grado {c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Teléfono / Celular (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 312 345 6789"
                                        value={newAspPhone}
                                        onChange={(e) => setNewAspPhone(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Correo Electrónico (Opcional)
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="correo@ejemplo.com"
                                        value={newAspEmail}
                                        onChange={(e) => setNewAspEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Observaciones / Motivo de Consulta
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Ej: Viene por recomendación familiar, traslado por vivienda..."
                                    value={newAspNotes}
                                    onChange={(e) => setNewAspNotes(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowNewAspirantModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingAspirant}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-xl text-xs font-black transition shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                                >
                                    {savingAspirant ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                                    Guardar y Preparar Formulario
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: OFICIALIZAR MATRÍCULA DE ASPIRANTE */}
            {showMatricularModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                    <CheckCircle2 size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">Oficializar Matrícula</h3>
                                    <p className="text-[10px] text-slate-500">Convierte al aspirante [{aspirantToMatricular?.formCode}] en alumno oficial.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowMatricularModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-lg"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                🎓 Formulario Origen: <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg font-black">{aspirantToMatricular?.formCode}</span>
                            </p>
                            <p className="text-[11px] text-emerald-700">
                                Al confirmar, se creará el estudiante en la base de datos oficial y se le asignará el siguiente consecutivo de folio general.
                            </p>
                        </div>

                        <form onSubmit={handleConfirmMatricula} className="space-y-3 text-left">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Nombres del Alumno <span className="text-emerald-600">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: SANTIAGO"
                                        value={matFirstName}
                                        onChange={(e) => setMatFirstName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Apellidos del Alumno <span className="text-emerald-600">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: RODRÍGUEZ GÓMEZ"
                                        value={matLastName}
                                        onChange={(e) => setMatLastName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Curso a Matricular <span className="text-emerald-600">*</span>
                                    </label>
                                    <select
                                        value={matGrade}
                                        onChange={(e) => setMatGrade(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                                    >
                                        <option value="TRANSICION">Transición</option>
                                        {uniqueCourses.filter(c => c !== 'TRANSICION').map(c => (
                                            <option key={c} value={c}>Grado {c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Teléfono Acudiente
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 312 345 6789"
                                        value={matParentPhone}
                                        onChange={(e) => setMatParentPhone(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Nombre del Acudiente Principal
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pedro Gómez"
                                    value={matParentName}
                                    onChange={(e) => setMatParentName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowMatricularModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processingMatricula}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-black transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                                >
                                    {processingMatricula ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Confirmar Matrícula Oficial
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: CONFIRMACIÓN DE ELIMINACIÓN DE FORMULARIO ASP */}
            {aspirantToDelete && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
                        {/* Ícono de Alerta */}
                        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                            <Trash2 size={24} />
                        </div>

                        <div>
                            <h3 className="text-base font-black text-slate-800">
                                ¿Eliminar Formulario?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Estás a punto de eliminar permanentemente el formulario de aspirante:
                            </p>
                        </div>

                        {/* Ficha resumen del registro */}
                        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3 text-left space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-black text-xs px-2.5 py-0.5 rounded-lg bg-rose-600 text-white shadow-2xs">
                                    {aspirantToDelete.formCode}
                                </span>
                                <span className="text-[10px] font-bold text-slate-600">
                                    Grado {aspirantToDelete.gradeInterest}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 pt-1">
                                Contacto: {aspirantToDelete.contactName}
                            </p>
                            {aspirantToDelete.studentName && (
                                <p className="text-[11px] text-slate-600">
                                    Aspirante: <strong>{aspirantToDelete.studentName}</strong>
                                </p>
                            )}
                            {aspirantToDelete.phone && (
                                <p className="text-[10px] text-slate-500">
                                    Tel: {aspirantToDelete.phone}
                                </p>
                            )}
                        </div>

                        <p className="text-[11px] text-rose-600 font-medium bg-rose-50/40 p-2 rounded-xl border border-rose-100">
                            ⚠️ Esta acción no se puede deshacer y borrará el registro de la base de datos.
                        </p>

                        {/* Botones de acción claros y seguros */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setAspirantToDelete(null)}
                                disabled={deletingAspirant}
                                className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteAspirant}
                                disabled={deletingAspirant}
                                className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5"
                            >
                                {deletingAspirant ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
