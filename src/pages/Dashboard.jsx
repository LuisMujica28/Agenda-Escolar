import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, deleteDoc, addDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Loader2, BookOpen, Calendar as CalendarIcon, ClipboardList, 
    MessageSquare, User, FileText, Award, Star, Bell, 
    ChevronRight, CheckCircle2, AlertTriangle, TrendingUp,
    Users, PlusCircle, ShieldAlert, ArrowRight, Sparkles, Upload, Table, Printer, Trash2, Edit, Edit2, X, BarChart2, Send, UserMinus, UserCheck, RefreshCw, Zap, Camera, Image as ImageIcon
} from 'lucide-react';
import { MOCK_NEWS, MOCK_STUDENTS, MOCK_LOGS, MOCK_PARENTS } from '../lib/mockData';
import { getStudentForUser } from '../lib/getStudentForUser';
import { getStudentPhoto, isValidStudentPhoto, DEFAULT_STUDENT_PHOTO } from '../lib/avatarHelper';
import CircularDetailModal from '../components/CircularDetailModal';
import CircularReadersModal from '../components/CircularReadersModal';
import QuickObservationModal from '../components/QuickObservationModal';
import ConfirmModal from '../components/ConfirmModal';

export default function Dashboard() {
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    // Common States
    const [loading, setLoading] = useState(true);
    const [showQuickObsModal, setShowQuickObsModal] = useState(false);
    const [circulars, setCirculars] = useState([]);
    const [readCirculars, setReadCirculars] = useState([]);
    const [selectedCircular, setSelectedCircular] = useState(null);
    const [parents, setParents] = useState([]);
    const [readersModalCircular, setReadersModalCircular] = useState(null);
    const [studentsList, setStudentsList] = useState([]);

    // Modal states for circulars list
    const [showCircularsModal, setShowCircularsModal] = useState(false);
    const [allCirculars, setAllCirculars] = useState([]);
    const [loadingAllCirculars, setLoadingAllCirculars] = useState(false);

    // Modal de Confirmación seguro (reemplaza window.confirm)
    const [confirmModalConfig, setConfirmModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        confirmVariant: 'danger',
        onConfirm: null,
        details: null
    });

    const showConfirm = ({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', confirmVariant = 'danger', details = null, onConfirm }) => {
        setConfirmModalConfig({
            isOpen: true,
            title,
            message,
            confirmText,
            cancelText,
            confirmVariant,
            details,
            onConfirm: async () => {
                setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
                if (onConfirm) await onConfirm();
            }
        });
    };

    // State for interactive mini calendar
    const [calendarDate, setCalendarDate] = useState(new Date(2026, 6, 1));

    const handlePrevMonth = () => {
        setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const getCalendarDays = () => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = startOffset - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
        }

        const today = new Date();
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            days.push({ day: d, isCurrentMonth: true, isToday });
        }

        const remaining = (7 - (days.length % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, isCurrentMonth: false });
        }

        return days;
    };

    useEffect(() => {
        if (currentUser) {
            try {
                const stored = JSON.parse(localStorage.getItem(`read_circulars_${currentUser.uid}`)) || [];
                setReadCirculars(stored);
            } catch {
                setReadCirculars([]);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        async function fetchStudents() {
            try {
                const sSnap = await getDocs(collection(db, 'students'));
                const list = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (list.length > 0) {
                    setStudentsList(list);
                } else {
                    setStudentsList(MOCK_STUDENTS);
                }
            } catch (error) {
                console.warn("Error loading students for acuse mapping:", error);
                setStudentsList(MOCK_STUDENTS);
            }
        }
        if (currentUser && (userRole === 'admin' || userRole === 'teacher')) {
            fetchStudents();
        }
    }, [currentUser, userRole]);

    useEffect(() => {
        async function loadParents() {
            try {
                const q = query(collection(db, 'users'), where('role', '==', 'parent'));
                const querySnapshot = await getDocs(q);
                const parentsData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
                if (parentsData.length > 0) {
                    setParents(parentsData);
                } else {
                    setParents(MOCK_PARENTS);
                }
            } catch (error) {
                console.warn("Error loading parents from Firestore, using MOCK_PARENTS:", error);
                setParents(MOCK_PARENTS);
            }
        }
        if (currentUser) {
            loadParents();
        }
    }, [currentUser]);

    const handleMarkAsRead = async (id) => {
        if (!currentUser) return;
        
        // 1. Actualización local rápida
        const updated = [...readCirculars, id];
        setReadCirculars(updated);
        localStorage.setItem(`read_circulars_${currentUser.uid}`, JSON.stringify(updated));

        // 2. Persistir en la base de datos real
        try {
            const circularRef = doc(db, "circulars", id);
            await updateDoc(circularRef, {
                read_by: arrayUnion(currentUser.uid)
            });
            console.log(`✅ Acuse guardado en Firestore de la circular: ${id}`);
        } catch (error) {
            console.warn("No se pudo guardar la firma en Firestore (Modo Demo Fallback):", error);
            
            // Si Firestore falla, guardamos en demo_circular_reads
            const demoReads = JSON.parse(localStorage.getItem('demo_circular_reads') || '{}');
            const currentReads = demoReads[id] || [];
            if (!currentReads.includes(currentUser.uid)) {
                demoReads[id] = [...currentReads, currentUser.uid];
                localStorage.setItem('demo_circular_reads', JSON.stringify(demoReads));
            }
        }
    };

    // Parent Dashboard States
    const [student, setStudent] = useState(null);
    const [gradesAverage, setGradesAverage] = useState(null);
    const [attendanceRate, setAttendanceRate] = useState(null);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [latestLogs, setLatestLogs] = useState([]);

    // Teacher Dashboard States
    const [totalStudentsCount, setTotalStudentsCount] = useState(0);
    const [myTasksCount, setMyTasksCount] = useState(0);

    // Admin Dashboard States
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    const [adminStudents, setAdminStudents] = useState([]);
    const [adminGrades, setAdminGrades] = useState([]);
    const [adminCourses, setAdminCourses] = useState([]);
    const [selectedAdminCourse, setSelectedAdminCourse] = useState('');
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [circularNumber, setCircularNumber] = useState(36);
    const [currentTime, setCurrentTime] = useState('');
    const [importPlanillasCount, setImportPlanillasCount] = useState(12);
    const [recentActivitiesList, setRecentActivitiesList] = useState([]);

    const formatRelativeTime = (created_at) => {
        if (!created_at) return 'Reciente';
        const date = created_at?.seconds ? new Date(created_at.seconds * 1000) : new Date(created_at);
        if (isNaN(date.getTime())) return 'Reciente';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        return `Hace ${diffDays} d`;
    };

    // Admin Student Manage States
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    const [studentFirstName, setStudentFirstName] = useState('');
    const [studentLastName, setStudentLastName] = useState('');
    const [studentGrade, setStudentGrade] = useState('');
    const [studentCode, setStudentCode] = useState('');
    const [studentPhotoUrl, setStudentPhotoUrl] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [parentName, setParentName] = useState('');
    const [addingStudent, setAddingStudent] = useState(false);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editingStudentId, setEditingStudentId] = useState(null);

    // Procesar y comprimir foto seleccionada para guardado directo
    const handleStudentPhotoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
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
                setStudentPhotoUrl(optimizedDataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Iniciar edición de estudiante
    const handleStartEdit = async (student) => {
        setIsEditMode(true);
        setEditingStudentId(student.id);
        setStudentFirstName(student.firstName || student.name || '');
        setStudentLastName(student.lastName || '');
        setStudentGrade(student.grade || '');
        setStudentCode(student.id_code || '');
        setStudentPhotoUrl(isValidStudentPhoto(student.photo_url) ? student.photo_url : '');
        
        // Cargar datos de acudiente desde estudiante o desde colección 'users'
        let foundEmail = student.email_padre || student.email || '';
        let foundName = student.nombre_padre || '';

        if (student.parent_uids && student.parent_uids.length > 0) {
            try {
                const pDoc = await getDoc(doc(db, 'users', student.parent_uids[0]));
                if (pDoc.exists()) {
                    const uData = pDoc.data();
                    if (uData.email) foundEmail = uData.email;
                    if (uData.name) foundName = uData.name;
                }
            } catch (e) {
                console.error("Error al cargar datos del acudiente:", e);
            }
        }

        setParentEmail(foundEmail);
        setParentName(foundName);
        setShowAddStudentModal(true);
    };

    // Crear o modificar estudiante y acudiente
    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!studentFirstName.trim() || !studentLastName.trim() || !studentGrade.trim() || !studentCode.trim()) {
            alert("Por favor completa los campos requeridos del estudiante (Nombres, Apellidos, Curso y Código).");
            return;
        }

        setAddingStudent(true);
        try {
            let parentUid = null;
            const cleanParentEmail = parentEmail.trim();
            const cleanParentName = parentName.trim();
            const hasParentEmail = Boolean(cleanParentEmail && cleanParentEmail.includes('@'));

            if (hasParentEmail) {
                parentUid = 'fake-parent-' + Date.now();
                
                // Si estamos editando y ya tiene un acudiente asociado, usamos ese UID
                if (isEditMode) {
                    const currentStud = adminStudents.find(s => s.id === editingStudentId);
                    if (currentStud && currentStud.parent_uids && currentStud.parent_uids.length > 0) {
                        parentUid = currentStud.parent_uids[0];
                    }
                }

                // Si es Firebase real y no modo demo, y es un acudiente nuevo (no editando uno existente en auth)
                if (currentUser && !currentUser.uid.startsWith('fake-') && (!isEditMode || !parentUid.startsWith('fake-'))) {
                    const { initializeApp, deleteApp } = await import('firebase/app');
                    const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');
                    
                    const firebaseConfig = {
                        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                        appId: import.meta.env.VITE_FIREBASE_APP_ID
                    };
                    
                    try {
                        // Solo crear cuenta de Auth si no existe ya
                        const tempApp = initializeApp(firebaseConfig, 'TempApp_' + Date.now());
                        const tempAuth = getAuth(tempApp);
                        const cred = await createUserWithEmailAndPassword(tempAuth, cleanParentEmail, 'colegio2026');
                        parentUid = cred.user.uid;
                        await deleteApp(tempApp);
                    } catch (authError) {
                        if (authError.code === 'auth/email-already-in-use') {
                            const qUser = query(collection(db, 'users'), where('email', '==', cleanParentEmail));
                            const uSnap = await getDocs(qUser);
                            if (!uSnap.empty) {
                                parentUid = uSnap.docs[0].id;
                            }
                        } else if (isEditMode) {
                            console.log("No se pudo crear en Auth, usando UID actual de edición");
                        } else {
                            throw authError;
                        }
                    }
                }

                // Guardar o actualizar perfil del acudiente en Firestore
                await setDoc(doc(db, 'users', parentUid), {
                    email: cleanParentEmail,
                    role: 'parent',
                    name: cleanParentName || `Acudiente de ${studentFirstName.trim()} ${studentLastName.trim()}`,
                    created_at: new Date()
                }, { merge: true });
            } else if (isEditMode) {
                // Mantener acudiente actual si existía y no se modificó nada en blanco
                const currentStud = adminStudents.find(s => s.id === editingStudentId);
                if (currentStud && currentStud.parent_uids && currentStud.parent_uids.length > 0) {
                    parentUid = currentStud.parent_uids[0];
                }
            }

            const fullName = `${studentFirstName.trim()} ${studentLastName.trim()}`;
            const existingPhoto = adminStudents.find(s => s.id === editingStudentId)?.photo_url;
            const cleanExisting = isValidStudentPhoto(existingPhoto) ? existingPhoto : '';
            const effectivePhoto = isValidStudentPhoto(studentPhotoUrl) ? studentPhotoUrl : (isEditMode ? cleanExisting : '');

            // Calcular el siguiente número consecutivo de folio inmutable
            const maxExistingFolio = adminStudents.reduce((max, s) => {
                const num = parseInt(s.folioNumber || s.masterFolio || '0', 10);
                return isNaN(num) ? max : Math.max(max, num);
            }, adminStudents.length);
            const nextFolioNumber = String(maxExistingFolio + 1).padStart(3, '0');
            const existingFolio = adminStudents.find(s => s.id === editingStudentId)?.folioNumber;

            const studentDataToSave = {
                name: fullName.toUpperCase(),
                firstName: studentFirstName.trim().toUpperCase(),
                lastName: studentLastName.trim().toUpperCase(),
                grade: studentGrade.toUpperCase(),
                id_code: studentCode.trim().toUpperCase(),
                folioNumber: isEditMode ? (existingFolio || nextFolioNumber) : nextFolioNumber,
                photo_url: effectivePhoto,
                email_padre: cleanParentEmail,
                email: cleanParentEmail,
                nombre_padre: cleanParentName || (cleanParentEmail ? `Acudiente de ${fullName}` : ''),
                parent_uids: parentUid ? [parentUid] : (isEditMode ? (adminStudents.find(s => s.id === editingStudentId)?.parent_uids || []) : [])
            };

            if (isEditMode) {
                // Actualizar estudiante existente
                await setDoc(doc(db, 'students', editingStudentId), studentDataToSave, { merge: true });

                alert(`Estudiante ${fullName} modificado con éxito.`);
            } else {
                // Crear estudiante nuevo
                const studentDoc = await addDoc(collection(db, 'students'), {
                    ...studentDataToSave,
                    created_at: new Date()
                });

                // Crear calificación inicial para que no esté vacío
                await addDoc(collection(db, 'grades'), {
                    student_id: studentDoc.id,
                    teacher_id: currentUser.uid,
                    subject: 'Matemáticas',
                    grade: 75,
                    components: {
                        actitudinal: 15,
                        prueba1: 15,
                        ejercitacion: 15,
                        prueba2: 15,
                        guia: 15
                    },
                    period: 1,
                    comment: 'Registro de estudiante nuevo.',
                    created_at: new Date()
                });

                // Crear curso en la colección courses si no existiera
                await setDoc(doc(db, 'courses', studentGrade.toUpperCase()), { created_at: new Date() }, { merge: true });

                alert(`Estudiante ${fullName} registrado con éxito.`);
            }
            
            // Limpiar formulario y cerrar
            setStudentFirstName('');
            setStudentLastName('');
            setStudentGrade('');
            setStudentCode('');
            setStudentPhotoUrl('');
            setParentEmail('');
            setParentName('');
            setShowAddStudentModal(false);
            setIsEditMode(false);
            setEditingStudentId(null);

            // Recargar listado de estudiantes
            const sSnap = await getDocs(collection(db, 'students'));
            const studentsList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAdminStudents(studentsList);
            setTotalStudentsCount(studentsList.length);

            // Recargar cursos
            const cSnap = await getDocs(collection(db, 'courses'));
            let coursesList = [];
            if (!cSnap.empty) {
                coursesList = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            }
            setAdminCourses(coursesList);

        } catch (err) {
            console.error(err);
            alert("Error al guardar estudiante: " + err.message);
        } finally {
            setAddingStudent(false);
        }
    };

    const handleDeleteStudent = (studentId, studentName) => {
        showConfirm({
            title: "¿Eliminar Estudiante?",
            message: `¿Estás seguro de que deseas eliminar permanentemente a ${studentName}?\n\nEsta acción borrará al alumno y todas sus calificaciones del sistema.`,
            confirmText: "Sí, Eliminar Alumno",
            confirmVariant: "danger",
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'students', studentId));

                    const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentId));
                    const gSnap = await getDocs(qGrades);
                    for (const gradeDoc of gSnap.docs) {
                        await deleteDoc(doc(db, 'grades', gradeDoc.id));
                    }

                    const sSnap = await getDocs(collection(db, 'students'));
                    const studentsList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setAdminStudents(studentsList);
                    setTotalStudentsCount(studentsList.length);
                } catch (err) {
                    console.error("Error al eliminar estudiante:", err);
                    alert("Error al eliminar estudiante: " + err.message);
                }
            }
        });
    };

    const handleToggleStudentStatus = (student) => {
        const isRetirado = student.status === 'retirado';
        const newStatus = isRetirado ? 'activo' : 'retirado';
        const displayName = student.lastName && student.firstName ? `${student.lastName} ${student.firstName}` : student.name;

        showConfirm({
            title: isRetirado ? "¿Reactivar Estudiante?" : "¿Marcar como Retirado?",
            message: isRetirado
                ? `¿Confirmas REACTIVAR a ${displayName} como Alumno Activo?`
                : `¿Confirmas marcar a ${displayName} como RETIRADO?\n\nSus notas y boletines permanecerán 100% intactos para expedir certificados o boletines, pero NO aparecerá en estadísticas académicas ni rankings.`,
            confirmText: isRetirado ? "Sí, Reactivar" : "Sí, Marcar Retirado",
            confirmVariant: isRetirado ? "success" : "warning",
            onConfirm: async () => {
                try {
                    await updateDoc(doc(db, 'students', student.id), { status: newStatus });
                    setAdminStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: newStatus } : s));
                } catch (err) {
                    console.error("Error al cambiar estado del estudiante:", err);
                    alert("Error al actualizar el estado del estudiante.");
                }
            }
        });
    };

    const handleCreateCourse = async () => {
        const newCourseName = window.prompt("Ingresa el nombre del nuevo curso (ej: 1002 o 1102):");
        if (!newCourseName || !newCourseName.trim()) return;

        const nameClean = newCourseName.trim().toUpperCase();

        try {
            await setDoc(doc(db, 'courses', nameClean), { created_at: new Date() });
            alert(`Curso ${nameClean} creado con éxito.`);
            
            // Recargar datos
            const cSnap = await getDocs(collection(db, 'courses'));
            const coursesList = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            setAdminCourses(coursesList);
            setSelectedAdminCourse(nameClean);
        } catch (err) {
            console.error("Error al crear curso:", err);
            alert("Error al crear curso: " + err.message);
        }
    };

    const handleDeleteCourse = (courseName) => {
        showConfirm({
            title: "⚠️ ADVERTENCIA CRÍTICA",
            message: `¿Estás completamente seguro de que deseas eliminar permanentemente el Curso ${courseName}?\n\nEsta acción borrará el curso de la lista y eliminará permanentemente a TODOS los estudiantes de este curso junto con sus calificaciones.`,
            confirmText: "Sí, Eliminar Curso y Alumnos",
            confirmVariant: "danger",
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'courses', courseName));

                    const qStudents = query(collection(db, 'students'), where('grade', '==', courseName));
                    const sSnap = await getDocs(qStudents);
                    for (const studentDoc of sSnap.docs) {
                        const studentId = studentDoc.id;
                        const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentId));
                        const gSnap = await getDocs(qGrades);
                        for (const gradeDoc of gSnap.docs) {
                            await deleteDoc(doc(db, 'grades', gradeDoc.id));
                        }
                        await deleteDoc(doc(db, 'students', studentId));
                    }

                    // Recargar listados
                    const cSnap = await getDocs(collection(db, 'courses'));
                    let coursesList = [];
                    if (!cSnap.empty) {
                        coursesList = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    } else {
                        const allStSnap = await getDocs(collection(db, 'students'));
                        const dynamicCourses = Array.from(new Set(allStSnap.docs.map(d => d.data().grade).filter(Boolean)));
                        coursesList = dynamicCourses.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    }
                    setAdminCourses(coursesList);
                    if (coursesList.length > 0) {
                        setSelectedAdminCourse(coursesList[0]);
                    }

                    const stSnap = await getDocs(collection(db, 'students'));
                    const updatedStudents = stSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setAdminStudents(updatedStudents);
                    setTotalStudentsCount(updatedStudents.length);
                } catch (err) {
                    console.error("Error al eliminar curso:", err);
                    alert("Error al eliminar curso: " + err.message);
                }
            }
        });
    };

    const mergeDemoReads = (circs) => {
        const demoReads = JSON.parse(localStorage.getItem('demo_circular_reads') || '{}');
        return circs.map(c => {
            const localReads = demoReads[c.id] || [];
            const merged = Array.from(new Set([...(c.read_by || []), ...localReads]));
            return { ...c, read_by: merged };
        });
    };

    const handleBulkReassignCourse = async (currentCourse) => {
        const studentsInCourse = adminStudents.filter(s => s.grade === currentCourse);
        if (studentsInCourse.length === 0) {
            // Si el curso no tiene alumnos pero la pestaña existe, ofrecemos eliminar el curso vacío
            showConfirm({
                title: "¿Eliminar Curso Vacío?",
                message: `El curso "${currentCourse}" no tiene estudiantes asignados.\n¿Deseas eliminar la pestaña "${currentCourse}"?`,
                confirmText: "Sí, Eliminar",
                confirmVariant: "danger",
                onConfirm: async () => {
                    handleDeleteCourse(currentCourse);
                }
            });
            return;
        }

        const newCourse = prompt(
            `Vas a mover ${studentsInCourse.length} estudiantes del curso "${currentCourse}".\n\nIngresa el nombre del nuevo curso destino (ejemplo: 1001):`,
            '1001'
        );

        if (!newCourse || !newCourse.trim() || newCourse.trim() === currentCourse) {
            return;
        }

        const targetCourse = newCourse.trim().toUpperCase();

        showConfirm({
            title: "¿Reasignar Curso en Lote?",
            message: `¿Confirmas cambiar el curso de ${studentsInCourse.length} estudiantes de "${currentCourse}" a "${targetCourse}"?`,
            confirmText: "Sí, Reasignar",
            confirmVariant: "primary",
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const { doc, updateDoc, setDoc, deleteDoc } = await import('firebase/firestore');

                    for (const s of studentsInCourse) {
                        if (!s.id.startsWith('st-')) {
                            await updateDoc(doc(db, 'students', s.id), {
                                grade: targetCourse
                            });
                        }
                    }

                    // 1. Crear/Asegurar el curso destino en Firestore
                    await setDoc(doc(db, 'courses', targetCourse), { created_at: new Date() }, { merge: true });

                    // 2. Si el curso actual ya quedó sin alumnos, eliminarlo de la lista de cursos
                    const remainingInOld = adminStudents.filter(s => s.grade === currentCourse && s.id.startsWith('st-'));
                    if (remainingInOld.length === 0) {
                        await deleteDoc(doc(db, 'courses', currentCourse));
                    }

                    // 3. Recargar cursos desde Firestore
                    const cSnap = await getDocs(collection(db, 'courses'));
                    const coursesList = cSnap.docs.map(d => d.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    setAdminCourses(coursesList);
                    setSelectedAdminCourse(targetCourse);

                    // 4. Recargar estudiantes
                    const sSnap = await getDocs(collection(db, 'students'));
                    const sList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAdminStudents(sList);
                    setTotalStudentsCount(sList.length);

                    alert(`¡Éxito! Se han reasignado los ${studentsInCourse.length} estudiantes a "${targetCourse}".`);
                } catch (err) {
                    console.error("Error al reasignar curso en lote:", err);
                    alert("Ocurrió un error al reasignar el curso.");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleOpenCircularsModal = async () => {
        setShowCircularsModal(true);
        setLoadingAllCirculars(true);
        try {
            let loadedCircs = [];
            if (currentUser.uid.startsWith('fake-')) {
                const storedNews = localStorage.getItem('demo_circulars');
                if (storedNews) {
                    loadedCircs = mergeDemoReads(JSON.parse(storedNews));
                } else {
                    loadedCircs = mergeDemoReads(MOCK_NEWS);
                }
            } else {
                const q = query(collection(db, 'circulars'), orderBy('created_at', 'desc'));
                const snap = await getDocs(q);
                loadedCircs = mergeDemoReads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }

            if (userRole === 'parent') {
                let activeStudent = student;
                if (!activeStudent) {
                    activeStudent = await getStudentForUser(db, currentUser);
                }
                loadedCircs = loadedCircs.filter(c => {
                    if (!c.target_type) return true;
                    if (c.target_type === 'ALL') return true;
                    if (c.target_type === 'COURSE' && activeStudent && c.target_course === activeStudent.grade) return true;
                    if (c.target_type === 'STUDENTS' && activeStudent && c.target_students?.includes(activeStudent.id)) return true;
                    if (c.target_parent_uids?.includes(currentUser.uid)) return true;
                    return false;
                });
            }
            setAllCirculars(loadedCircs);
        } catch (error) {
            console.error("Error loading circulars:", error);
        } finally {
            setLoadingAllCirculars(false);
        }
    };

    const handleDeleteCircular = (circularId) => {
        showConfirm({
            title: "¿Eliminar Circular?",
            message: "¿Está seguro de que desea eliminar esta circular institucional?\n\nEsta acción no se puede deshacer.",
            confirmText: "Sí, Eliminar Circular",
            confirmVariant: "danger",
            onConfirm: async () => {
                try {
                    if (currentUser.uid.startsWith('fake-')) {
                        const updated = allCirculars.filter(c => c.id !== circularId);
                        setAllCirculars(updated);
                        localStorage.setItem('demo_circulars', JSON.stringify(updated));
                        setCirculars(updated.slice(0, 3));
                    } else {
                        await deleteDoc(doc(db, 'circulars', circularId));
                        setAllCirculars(prev => prev.filter(c => c.id !== circularId));
                        setCirculars(prev => prev.filter(c => c.id !== circularId));
                    }
                } catch (error) {
                    console.error("Error deleting circular:", error);
                    alert("No se pudo eliminar la circular. Intente nuevamente.");
                }
            }
        });
    };

    useEffect(() => {
        if (!currentUser || !userRole) return;

        async function loadDashboardData() {
            setLoading(true);
            try {
                // 1. Cargar Circulares/Anuncios (común para todos)
                let loadedCircs = [];
                if (currentUser.uid.startsWith('fake-')) {
                    const storedNews = localStorage.getItem('demo_circulars');
                    if (storedNews) {
                        loadedCircs = mergeDemoReads(JSON.parse(storedNews));
                    } else {
                        loadedCircs = mergeDemoReads(MOCK_NEWS);
                    }
                } else {
                    const qCirc = query(collection(db, 'circulars'), orderBy('created_at', 'desc'));
                    const circSnap = await getDocs(qCirc);
                    loadedCircs = mergeDemoReads(circSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                }

                if (userRole === 'parent') {
                    const activeStudent = await getStudentForUser(db, currentUser);
                    loadedCircs = loadedCircs.filter(c => {
                        if (!c.target_type) return true;
                        if (c.target_type === 'ALL') return true;
                        if (c.target_type === 'COURSE' && activeStudent && c.target_course === activeStudent.grade) return true;
                        if (c.target_type === 'STUDENTS' && activeStudent && c.target_students?.includes(activeStudent.id)) return true;
                        if (c.target_parent_uids?.includes(currentUser.uid)) return true;
                        return false;
                    });
                }
                setCirculars(loadedCircs.slice(0, 3));

                // 2. Cargar datos específicos por Rol
                if (userRole === 'parent') {
                    if (currentUser.uid.startsWith('fake-')) {
                        // Mock Parent Data
                        setStudent(MOCK_STUDENTS[0]);
                        setGradesAverage(4.35);
                        setAttendanceRate(95);
                        setPendingTasks([
                            { id: 't-1', title: 'Taller de Álgebra', subject: 'Matemáticas', due_date: '2026-07-15' },
                            { id: 't-2', title: 'Lectura de Antígona', subject: 'Español y Literatura', due_date: '2026-07-18' }
                        ]);
                        setLatestLogs(MOCK_LOGS.slice(0, 2));
                    } else {
                        // Cargar estudiante real
                        const targetStudentData = await getStudentForUser(db, currentUser);

                        if (targetStudentData) {
                            const studentData = targetStudentData;
                            setStudent(studentData);

                            // Cargar notas para promedio
                            const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentData.id));
                            const gSnap = await getDocs(qGrades);
                            const gradesList = gSnap.docs.map(d => Number(d.data().grade));
                            if (gradesList.length > 0) {
                                const avg = (gradesList.reduce((sum, g) => sum + g, 0) / gradesList.length).toFixed(2);
                                setGradesAverage(avg);
                            }

                            // Cargar asistencia para tasa
                            const qAtt = query(collection(db, 'attendance'), where('student_id', '==', studentData.id));
                            const aSnap = await getDocs(qAtt);
                            const attList = aSnap.docs.map(d => d.data().status);
                            if (attList.length > 0) {
                                const presents = attList.filter(s => s === 'PRESENT' || s === 'LATE').length;
                                const rate = ((presents / attList.length) * 100).toFixed(0);
                                setAttendanceRate(rate);
                            }

                            // Cargar tareas pendientes del grado del estudiante
                            const qTasks = query(collection(db, 'tasks'), where('class_grade', '==', studentData.grade));
                            const tSnap = await getDocs(qTasks);
                            const tasksList = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                            
                            // Filtrar las tareas completadas locales de localStorage
                            const storedCompleted = localStorage.getItem(`completed_tasks_${currentUser.uid}`);
                            const completedIds = storedCompleted ? JSON.parse(storedCompleted) : [];
                            const pending = tasksList.filter(t => !completedIds.includes(t.id));
                            
                            // Ordenar por fecha límite y limitar a 3
                            pending.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                            setPendingTasks(pending.slice(0, 3));

                            // Cargar logs recientes
                            const qLogs = query(collection(db, 'observation_logs'), where('student_id', '==', studentData.id));
                            const lSnap = await getDocs(qLogs);
                            const logsList = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                            logsList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                            setLatestLogs(logsList.slice(0, 2));
                        }
                    }
                } else if (userRole === 'teacher') {
                    const sSnap = await getDocs(collection(db, 'students'));
                    setTotalStudentsCount(sSnap.size);

                    const qTasks = query(collection(db, 'tasks'), where('teacher_id', '==', currentUser.uid));
                    const tSnap = await getDocs(qTasks);
                    setMyTasksCount(tSnap.size);
                } else if (userRole === 'admin') {
                    const sSnap = await getDocs(collection(db, 'students'));
                    const studentsList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setTotalStudentsCount(sSnap.size);
                    setAdminStudents(studentsList);

                    const uSnap = await getDocs(collection(db, 'users'));
                    setTotalUsersCount(uSnap.size);

                    const gSnap = await getDocs(collection(db, 'grades'));
                    const gradesList = gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setAdminGrades(gradesList);

                    // Obtener cursos de la colección 'courses'
                    const cSnap = await getDocs(collection(db, 'courses'));
                    let coursesList = [];
                    if (!cSnap.empty) {
                        coursesList = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    } else {
                        const list = studentsList.map(s => s.grade).filter(Boolean);
                        const unique = Array.from(new Set(list));
                        for (const c of unique) {
                            await setDoc(doc(db, 'courses', c), { created_at: new Date() });
                        }
                        coursesList = unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    }
                    setAdminCourses(coursesList);
                    if (coursesList.length > 0 && !selectedAdminCourse) {
                        setSelectedAdminCourse(coursesList[0]);
                    }

                    // 5. Cargar Actividades Recientes en tiempo real de Firestore
                    try {
                        const actList = [];
                        const qAudit = query(collection(db, 'audit_logs'), orderBy('created_at', 'desc'), limit(5));
                        const auditSnap = await getDocs(qAudit);
                        if (!auditSnap.empty) {
                            auditSnap.docs.forEach(doc => {
                                const data = doc.data();
                                actList.push({ id: doc.id, ...data });
                            });
                        }

                        if (actList.length < 5) {
                            // Circulares enviadas recientemente
                            const qCircs = query(collection(db, 'circulars'), orderBy('created_at', 'desc'), limit(3));
                            const cSnap = await getDocs(qCircs);
                            cSnap.docs.forEach(doc => {
                                const d = doc.data();
                                if (!actList.some(a => a.subtitle === d.title || a.title?.includes(d.title))) {
                                    actList.push({
                                        id: doc.id,
                                        title: `Circular #${d.circular_number || 'Oficial'} publicada`,
                                        subtitle: d.title || (d.target_course ? `Curso ${d.target_course}` : 'Toda la institución'),
                                        created_at: d.created_at || new Date(),
                                        iconType: 'send',
                                        colorClass: 'bg-blue-50 border-blue-100 text-blue-600'
                                    });
                                }
                            });

                            // Estudiantes agregados recientemente
                            const qStuds = query(collection(db, 'students'), limit(3));
                            const sSnap = await getDocs(qStuds);
                            sSnap.docs.forEach(doc => {
                                const d = doc.data();
                                const sName = d.lastName && d.firstName ? `${d.lastName} ${d.firstName}` : (d.name || 'Estudiante');
                                if (!actList.some(a => a.subtitle?.includes(sName))) {
                                    actList.push({
                                        id: doc.id,
                                        title: `Nuevo estudiante registrado`,
                                        subtitle: `${sName} (${d.grade || 'General'})`,
                                        created_at: d.created_at || new Date(),
                                        iconType: 'user',
                                        colorClass: 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                    });
                                }
                            });
                        }

                        actList.sort((a, b) => {
                            const timeA = a.created_at?.seconds ? a.created_at.seconds * 1000 : new Date(a.created_at || 0).getTime();
                            const timeB = b.created_at?.seconds ? b.created_at.seconds * 1000 : new Date(b.created_at || 0).getTime();
                            return timeB - timeA;
                        });

                        setRecentActivitiesList(actList.slice(0, 5));
                    } catch (actErr) {
                        console.warn("Error al cargar actividades en vivo:", actErr);
                    }
                }

            } catch (e) {
                console.error("Error al cargar tablero:", e);
            } finally {
                setLoading(false);
            }
        }
        loadDashboardData();
    }, [currentUser, userRole]);

    // Cargar número de circular de Firestore
    useEffect(() => {
        if (currentUser && userRole === 'admin') {
            async function fetchCircularNumber() {
                try {
                    const docSnap = await getDocs(collection(db, 'config'));
                    const configDoc = docSnap.docs.find(d => d.id === 'circulars');
                    if (configDoc && configDoc.data().current_number) {
                        setCircularNumber(configDoc.data().current_number);
                    } else {
                        await setDoc(doc(db, 'config', 'circulars'), { current_number: 36 });
                        setCircularNumber(36);
                    }
                } catch (e) {
                    console.warn("Error al cargar número de circular, usando 36:", e);
                    setCircularNumber(36);
                }
            }
            fetchCircularNumber();
        }
    }, [currentUser, userRole]);

    // Reloj dinámico de fecha y hora
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const formatOptions = {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            };
            const timeStr = now.toLocaleDateString('es-ES', formatOptions).replace(' a las', '');
            setCurrentTime(timeStr);
        };
        updateClock();
        const timer = setInterval(updateClock, 60000);
        return () => clearInterval(timer);
    }, []);

    const handleChangeCircularNumber = async () => {
        const input = window.prompt("Ingresa el nuevo número consecutivo para las circulares:", circularNumber);
        if (!input) return;
        const num = parseInt(input, 10);
        if (isNaN(num)) {
            alert("Por favor ingresa un número válido.");
            return;
        }
        try {
            await setDoc(doc(db, 'config', 'circulars'), { current_number: num });
            setCircularNumber(num);
            alert(`Consecutivo de circular actualizado a N° ${num}`);
        } catch (e) {
            console.error("Error al actualizar número de circular:", e);
            alert("No se pudo guardar el cambio en la base de datos.");
        }
    };

    // Auto-generar código del alumno sugerido (Solución 1: Basado en Año de Ingreso)
    useEffect(() => {
        if (showAddStudentModal && !isEditMode) {
            const currentYear = new Date().getFullYear();
            const prefix = `ST-${currentYear}-`;
            
            let maxNum = 0;
            adminStudents.forEach(s => {
                if (s.id_code && s.id_code.toUpperCase().startsWith(prefix)) {
                    const parts = s.id_code.split('-');
                    const numPart = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(numPart) && numPart > maxNum) {
                        maxNum = numPart;
                    }
                }
            });
            
            const nextNum = maxNum + 1;
            const paddedNum = String(nextNum).padStart(3, '0');
            setStudentCode(`${prefix}${paddedNum}`);
        }
    }, [showAddStudentModal, isEditMode, adminStudents]);

    const calendarMonthName = calendarDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const formattedCalendarMonthTitle = calendarMonthName.charAt(0).toUpperCase() + calendarMonthName.slice(1);
    const calendarDaysList = getCalendarDays();

    if (loading || !userRole) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-sm font-semibold text-gray-500 animate-pulse">Cargando perfil y datos del estudiante...</p>
            </div>
        );
    }

    return (
        <>
            <div className="w-full space-y-8 animate-fade-in">
            {/* Banner de Bienvenida Premium */}
            <div 
                className="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-500/10"
                style={{
                    backgroundImage: 'linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.4)), url("/dashboard_welcome_bg.png")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            >
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-indigo-100 flex items-center gap-1.5 w-fit border border-white/10 mb-3">
                            <Sparkles size={12} /> Portal Oficial INAS
                        </span>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                            {userRole === 'parent' ? `¡Hola, ${currentUser.displayName || 'Acudiente'}!` : `Bienvenido al Panel de Control`}
                        </h1>
                        <p className="text-indigo-100/90 text-sm mt-1.5 max-w-xl font-medium">
                            {userRole === 'parent' && student 
                                ? `Aquí tienes el resumen del rendimiento, asistencia y tareas de tu hijo(a) ${student.name}.`
                                : userRole === 'teacher'
                                ? `Accede rápidamente al buscador de alumnos, crea nuevas tareas y anota observaciones.`
                                : `Gestiona comunicados e importa listas oficiales del plantel de forma masiva.`}
                        </p>
                    </div>

                    {userRole === 'parent' && student && (
                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shadow-sm">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white/95 border-2 border-indigo-400 shrink-0 shadow-inner">
                                <img 
                                    src={getStudentPhoto(student.photo_url)} 
                                    alt="Estudiante" 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-indigo-200 font-bold uppercase leading-none">Estudiante</p>
                                <p className="text-sm font-bold mt-1 text-white leading-tight">{student.name}</p>
                                <span className="inline-block bg-indigo-500/40 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 border border-indigo-400/25">
                                    Curso: {student.grade}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Renderizar según Rol */}
            {userRole === 'parent' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Columna Principal (Anuncios y Tareas) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tablón de Anuncios */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex justify-between items-center pb-2">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Bell className="text-indigo-600" size={20} /> Tablón de Anuncios
                                </h2>
                                <Link to="/" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-0.5">
                                    Ver todos <ChevronRight size={14} />
                                </Link>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {circulars.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-4 text-center">No hay comunicados recientes.</p>
                                ) : (
                                    circulars.map(c => {
                                        const isRead = readCirculars.includes(c.id);
                                        return (
                                            <div 
                                                key={c.id} 
                                                onClick={() => setSelectedCircular(c)}
                                                className={`py-4 px-2 first:pt-0 last:pb-0 border-b last:border-b-0 cursor-pointer hover:bg-slate-50/50 rounded-2xl transition-all ${
                                                    isRead ? 'opacity-55' : 'opacity-100'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-1 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {!isRead && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse shrink-0"></span>
                                                            )}
                                                            <h3 className="text-sm font-bold text-gray-800">
                                                                {c.title}
                                                            </h3>
                                                            {c.priority === 'HIGH' && (
                                                                <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-100 shrink-0">
                                                                    Urgente
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 line-clamp-3 mt-1 leading-relaxed">{c.body}</p>
                                                    </div>

                                                    {!isRead && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkAsRead(c.id);
                                                            }}
                                                            className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition shrink-0 border border-indigo-100/50 shadow-sm"
                                                        >
                                                            Marcar como leído
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[10px] text-gray-400 font-semibold">
                                                        {c.created_at?.seconds 
                                                            ? new Date(c.created_at.seconds * 1000).toLocaleDateString()
                                                            : 'Reciente'}
                                                    </span>
                                                    {isRead && (
                                                        <span className="text-[10px] text-green-600 font-extrabold flex items-center gap-0.5">
                                                            ✓ Leído
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Tareas Pendientes */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex justify-between items-center pb-2">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <ClipboardList className="text-indigo-600" size={20} /> Agenda de Tareas Pendientes
                                </h2>
                                <Link to="/parent/tasks" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-0.5">
                                    Ver agenda completa <ChevronRight size={14} />
                                </Link>
                            </div>

                            <div className="space-y-3">
                                {pendingTasks.length === 0 ? (
                                    <div className="text-center py-6 bg-green-50/50 border border-dashed border-green-200 rounded-2xl p-4">
                                        <CheckCircle2 className="mx-auto text-green-500 mb-1.5" size={24} />
                                        <p className="text-xs font-bold text-green-800">¡Todo al día!</p>
                                        <p className="text-[10px] text-green-600 mt-0.5">No hay tareas pendientes para {student.name}.</p>
                                    </div>
                                ) : (
                                    pendingTasks.map(t => (
                                        <div key={t.id} className="border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/5 p-4 rounded-2xl flex items-center justify-between gap-4 transition shadow-inner">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                                    {t.subject}
                                                </span>
                                                <h4 className="text-sm font-bold text-gray-800">{t.title}</h4>
                                                <p className="text-[10px] text-gray-400 font-semibold">
                                                    Fecha límite: {new Date(t.due_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                            <Link 
                                                to="/parent/tasks"
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl transition shadow-md shrink-0"
                                            >
                                                <ChevronRight size={16} />
                                            </Link>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Columna Lateral (Estadísticas y Resumen) */}
                    <div className="space-y-6">
                        {/* Resumen Académico Rápido */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 pb-1">
                                <TrendingUp className="text-indigo-600" size={20} /> Resumen Académico
                            </h2>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Calificaciones */}
                                <div className="bg-indigo-50/30 border border-indigo-100/50 p-4 rounded-2xl text-center flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Promedio Notas</p>
                                        <p className="text-3xl font-extrabold text-indigo-700 mt-2">{gradesAverage || 'N/A'}</p>
                                    </div>
                                    <Link to="/parent/grades" className="text-[10px] font-bold text-indigo-600 hover:underline mt-2 flex items-center justify-center gap-0.5">
                                        Ver Boletín <ChevronRight size={10} />
                                    </Link>
                                </div>

                                {/* Asistencia */}
                                <div className="bg-emerald-50/30 border border-emerald-100/50 p-4 rounded-2xl text-center flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Asistencia</p>
                                        <p className="text-3xl font-extrabold text-emerald-700 mt-2">{attendanceRate ? `${attendanceRate}%` : 'N/A'}</p>
                                    </div>
                                    <Link to="/parent/attendance" className="text-[10px] font-bold text-emerald-600 hover:underline mt-2 flex items-center justify-center gap-0.5">
                                        Ver Historial <ChevronRight size={10} />
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Observador Escolar Rápido */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex justify-between items-center pb-1">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <FileText className="text-indigo-600" size={20} /> Novedades Observador
                                </h2>
                                <Link to="/parent/observer" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-0.5">
                                    Historial <ChevronRight size={14} />
                                </Link>
                            </div>

                            <div className="space-y-3">
                                {latestLogs.length === 0 ? (
                                    <p className="text-xs text-gray-500 py-2 text-center">Sin novedades en el observador.</p>
                                ) : (
                                    latestLogs.map(log => {
                                        const typeColors = {
                                            'NOTE': 'bg-gray-100 text-gray-700 border-gray-200',
                                            'ALERT': 'bg-red-50 text-red-700 border-red-100',
                                            'CONGRATS': 'bg-green-50 text-green-700 border-green-100'
                                        };
                                        return (
                                            <div key={log.id || Math.random()} className={`p-3 rounded-2xl border text-xs leading-relaxed ${typeColors[log.type]}`}>
                                                <p className="font-semibold line-clamp-2">{log.content}</p>
                                                <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                                                    {log.created_at?.seconds 
                                                        ? new Date(log.created_at.seconds * 1000).toLocaleDateString()
                                                        : 'Reciente'}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Carnet Digital Mini */}
                        <div className="bg-gradient-to-br from-indigo-900 to-indigo-850 rounded-3xl p-5 text-white shadow-lg space-y-4 relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <User size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs text-indigo-200 font-bold uppercase">Carnet de Estudiante</h4>
                                    <p className="text-sm font-bold leading-tight">{student.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/10 pt-4">
                                <div className="text-left">
                                    <p className="text-[9px] text-indigo-300 uppercase font-bold">Código</p>
                                    <p className="text-xs font-mono font-bold">{student.id_code}</p>
                                </div>
                                <Link 
                                    to="/parent/id" 
                                    className="bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                >
                                    Ver Carnet <ChevronRight size={12} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel de Control para Profesores */}
            {userRole === 'teacher' && (
                <div className="space-y-6">
                    {/* Tarjetas de Estadísticas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                <Users size={24} />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Estudiantes del Plantel</p>
                                <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{totalStudentsCount}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                <ClipboardList size={24} />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Mis Tareas Publicadas</p>
                                <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{myTasksCount}</p>
                            </div>
                        </div>

                        <div 
                            onClick={handleOpenCircularsModal}
                            className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 flex items-center gap-4 cursor-pointer hover-elevate active-press hover:bg-slate-50/50 shadow-sm"
                        >
                            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                                <Bell size={24} />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Anuncios en el Tablón</p>
                                <p className="text-2xl font-extrabold text-gray-800 mt-0.5">{circulars.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Acciones Rápidas del Profesor */}
                    <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
                        <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={20} /> Acciones Rápidas del Docente
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                            <Link 
                                to="/teacher/daily-attendance" 
                                className="bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-md shadow-indigo-600/25 hover-elevate active-press transition"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <UserCheck className="text-white group-hover:scale-110 transition-transform" size={26} />
                                    <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-black">Nuevo</span>
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black text-white leading-tight">📋 Pase de Lista</h4>
                                    <p className="text-[10px] text-indigo-100 mt-1 leading-tight font-medium">Llama lista salón por salón y notifica inasistencias por correo.</p>
                                </div>
                            </Link>

                            <button 
                                onClick={() => setShowQuickObsModal(true)} 
                                className="bg-[#D99458] hover:bg-[#C57E3F] text-white p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-md shadow-[#D99458]/25 hover-elevate active-press transition"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Zap className="text-white group-hover:scale-110 transition-transform" size={26} />
                                    <span className="text-[9px] bg-black/20 text-white px-2 py-0.5 rounded-full font-black">1 Toque</span>
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black text-white leading-tight">⚡ Anotación Rápida</h4>
                                    <p className="text-[10px] text-[#FAF4EC] mt-1 leading-tight font-medium">Registra retardos, faltas del manual o méritos y notifica a padres.</p>
                                </div>
                            </button>

                            <Link 
                                to="/teacher/search" 
                                className="bg-white border border-[#A7B7C6]/30 p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-xs hover-elevate active-press hover:border-[#5E7892] transition"
                            >
                                <Users className="text-[#5E7892] group-hover:scale-110 transition-transform" size={26} />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">Buscar Alumno</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">Registra comportamiento, asistencia o notas para cualquier alumno.</p>
                                </div>
                            </Link>

                            <Link 
                                to="/teacher/create-task" 
                                className="bg-white border border-[#BDCFAA]/40 p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-xs hover-elevate active-press hover:border-[#8E9E83] transition"
                            >
                                <ClipboardList className="text-[#8E9E83] group-hover:scale-110 transition-transform" size={26} />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">Crear Nueva Tarea</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">Asigna tareas escolares directamente a cualquier curso (como el 1001).</p>
                                </div>
                            </Link>

                            <Link 
                                to="/teacher/sync-grades" 
                                className="bg-white border border-[#A7B7C6]/30 p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-xs hover-elevate active-press hover:border-[#5E7892] transition"
                            >
                                <BookOpen className="text-[#5E7892] group-hover:scale-110 transition-transform" size={26} />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">Sincronizar Notas</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">Carga calificaciones directamente desde planillas de Google Sheets.</p>
                                </div>
                            </Link>

                            <Link 
                                to="/messages" 
                                className="bg-white border border-[#D99458]/30 p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-xs hover-elevate active-press hover:border-[#D99458] transition"
                            >
                                <MessageSquare className="text-[#D99458] group-hover:scale-110 transition-transform" size={26} />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">Buzón de Mensajes</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">Responde inquietudes e intercambia mensajes con acudientes.</p>
                                </div>
                            </Link>

                            <Link 
                                to="/admin/stats" 
                                className="bg-white border border-slate-200/70 p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between min-h-[140px] sm:h-36 group shadow-xs hover-elevate active-press hover:border-[#5E7892] transition"
                            >
                                <BarChart2 className="text-[#5E7892] group-hover:scale-110 transition-transform" size={26} />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">Estadísticas</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">Analiza promedios, rendimientos y alertas académicas de cursos.</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel de Control para Administradores */}
            {userRole === 'admin' && (
                <div className="space-y-6">

                    {/* Saludo y Métricas Rápidas */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-[#A7B7C6]/40 shadow-md shadow-slate-900/5">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl animate-bounce">👋</span>
                            <div className="text-left">
                                <h3 className="text-base font-black text-slate-800 leading-tight">¡Buenos días, Administrador!</h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Aquí tienes un resumen de lo más importante hoy.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 w-full lg:w-auto shrink-0">
                            {/* Card 1: Alumnos Totales */}
                            <div className="bg-[#FAF8F4] hover:bg-white border border-slate-200/80 p-2.5 rounded-2xl shadow-2xs transition flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#5E7892]/15 text-[#5E7892] flex items-center justify-center shrink-0">
                                    <Users size={16} />
                                </div>
                                <div className="leading-tight text-left min-w-0">
                                    <p className="text-xs font-black text-slate-800">{totalStudentsCount}</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5 truncate">Alumnos totales</p>
                                </div>
                            </div>

                            {/* Card 2: Cuentas Registradas */}
                            <div className="bg-[#FAF8F4] hover:bg-white border border-slate-200/80 p-2.5 rounded-2xl shadow-2xs transition flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#8E9E83]/20 text-[#8E9E83] flex items-center justify-center shrink-0">
                                    <Users size={16} />
                                </div>
                                <div className="leading-tight text-left min-w-0">
                                    <p className="text-xs font-black text-slate-800">{totalUsersCount}</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5 truncate">Cuentas reg.</p>
                                </div>
                            </div>

                            {/* Card 3: Circulares Publicadas */}
                            <div 
                                onClick={handleOpenCircularsModal}
                                className="bg-[#FAF8F4] hover:bg-white border border-slate-200/80 p-2.5 rounded-2xl shadow-2xs cursor-pointer hover:border-[#D99458] transition active-press flex items-center gap-2.5"
                                title="Ver historial de circulares"
                            >
                                <div className="w-8 h-8 rounded-xl bg-[#D99458]/20 text-[#D99458] flex items-center justify-center shrink-0">
                                    <Bell size={16} />
                                </div>
                                <div className="leading-tight text-left min-w-0">
                                    <p className="text-xs font-black text-slate-800">{circulars.length}</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5 truncate">Circulares pub.</p>
                                </div>
                            </div>

                            {/* Card 4: Planillas Importadas */}
                            <div 
                                onClick={() => navigate('/teacher/sync-grades')}
                                className="bg-[#FAF8F4] hover:bg-white border border-slate-200/80 p-2.5 rounded-2xl shadow-2xs cursor-pointer hover:border-[#5E7892] transition active-press flex items-center gap-2.5"
                                title="Ir a Planilla Digital"
                            >
                                <div className="w-8 h-8 rounded-xl bg-[#5E7892]/15 text-[#5E7892] flex items-center justify-center shrink-0">
                                    <FileText size={16} />
                                </div>
                                <div className="leading-tight text-left min-w-0">
                                    <p className="text-xs font-black text-slate-800">{importPlanillasCount}</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5 truncate">Planillas imp.</p>
                                </div>
                            </div>

                            {/* Card 5: Reloj / Fecha */}
                            <div className="bg-[#FAF8F4] hover:bg-white border border-slate-200/80 p-2.5 rounded-2xl shadow-2xs transition flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#F3EFDF] text-[#5E7892] flex items-center justify-center shrink-0">
                                    <CalendarIcon size={16} />
                                </div>
                                <div className="leading-tight text-left min-w-0">
                                    <p className="text-[9px] text-slate-700 font-black whitespace-nowrap leading-tight">
                                        {currentTime.split(' de ')[0] || 'Hoy'}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                        {currentTime.split(' a la')[1] || currentTime.split(' ').slice(-2).join(' ') || ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección de 3 Columnas */}
                    {/* Sección de 3 Columnas: Alto Contraste Ejecutivo (Stripe / Linear) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Columna 1: Accesos Rápidos */}
                        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-md hover:shadow-lg transition-all border border-white/80 flex flex-col gap-4.5">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                                        <Sparkles size={15} />
                                    </span>
                                    Accesos rápidos
                                </h3>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    5 acciones
                                </span>
                            </div>

                            <div className="flex flex-col gap-2.5 flex-1 justify-center">
                                {/* Nueva Circular */}
                                <Link 
                                    to="/admin/new-circular"
                                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-[#5E7892]/60 border-l-4 border-l-[#5E7892] shadow-2xs hover:shadow-sm hover-elevate active-press transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#1e293b] to-[#5E7892] text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-slate-900/20 group-hover:scale-105 transition-transform">
                                            <Send size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-900 group-hover:text-[#5E7892] transition-colors">Nueva Circular</p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Redacta y publica una nueva circular</p>
                                        </div>
                                    </div>
                                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 group-hover:bg-[#5E7892] group-hover:border-[#5E7892] group-hover:text-white flex items-center justify-center transition-all text-slate-400">
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>

                                {/* Importar CSV */}
                                <Link 
                                    to="/admin/import"
                                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-[#6E8063]/60 border-l-4 border-l-[#8E9E83] shadow-2xs hover:shadow-sm hover-elevate active-press transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#3c4835] to-[#8E9E83] text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-slate-900/20 group-hover:scale-105 transition-transform">
                                            <Upload size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-900 group-hover:text-[#6E8063] transition-colors">Importar CSV</p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Carga estudiantes desde un archivo</p>
                                        </div>
                                    </div>
                                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 group-hover:bg-[#8E9E83] group-hover:border-[#8E9E83] group-hover:text-white flex items-center justify-center transition-all text-slate-400">
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>

                                {/* Planilla Digital de Notas */}
                                <Link 
                                    to="/teacher/sync-grades"
                                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-[#4A6076]/60 border-l-4 border-l-[#4A6076] shadow-2xs hover:shadow-sm hover-elevate active-press transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#1a232c] to-[#4A6076] text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-slate-900/20 group-hover:scale-105 transition-transform">
                                            <ClipboardList size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-900 group-hover:text-[#4A6076] transition-colors">Planilla Digital de Notas</p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Importa o gestiona las calificaciones</p>
                                        </div>
                                    </div>
                                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 group-hover:bg-[#4A6076] group-hover:border-[#4A6076] group-hover:text-white flex items-center justify-center transition-all text-slate-400">
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>

                                {/* Planilla de Control */}
                                <Link 
                                    to="/planilla-print"
                                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-[#D99458]/60 border-l-4 border-l-[#D99458] shadow-2xs hover:shadow-sm hover-elevate active-press transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#944c16] to-[#D99458] text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-slate-900/20 group-hover:scale-105 transition-transform">
                                            <Printer size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-900 group-hover:text-[#D99458] transition-colors">Planilla de Control</p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Genera e imprime asistencias</p>
                                        </div>
                                    </div>
                                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 group-hover:bg-[#D99458] group-hover:border-[#D99458] group-hover:text-white flex items-center justify-center transition-all text-slate-400">
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>

                                {/* Estadísticas Académicas */}
                                <Link 
                                    to="/admin/stats"
                                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-[#1E3A8A]/60 border-l-4 border-l-[#1E3A8A] shadow-2xs hover:shadow-sm hover-elevate active-press transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#0f172a] to-[#1E3A8A] text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-slate-900/20 group-hover:scale-105 transition-transform">
                                            <BarChart2 size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-900 group-hover:text-[#1E3A8A] transition-colors">Estadísticas Académicas</p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Métricas de rendimiento institucional</p>
                                        </div>
                                    </div>
                                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 group-hover:bg-[#1E3A8A] group-hover:border-[#1E3A8A] group-hover:text-white flex items-center justify-center transition-all text-slate-400">
                                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Columna 2: Actividad Reciente */}
                        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-md hover:shadow-lg transition-all border border-white/80 flex flex-col gap-4.5">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-lg bg-[#5E7892]/15 text-[#5E7892] flex items-center justify-center">
                                        <MessageSquare size={16} />
                                    </span>
                                    Actividad reciente
                                </h3>
                                <button 
                                    onClick={handleOpenCircularsModal}
                                    className="text-[10px] font-black text-[#5E7892] hover:text-white px-2.5 py-1 rounded-full bg-[#5E7892]/10 hover:bg-[#5E7892] border border-[#5E7892]/20 transition"
                                >
                                    Ver todo
                                </button>
                            </div>
                            
                            <div className="flex-1 flex flex-col gap-2.5 justify-start pr-1 overflow-y-auto max-h-[350px]">
                                {recentActivitiesList.length === 0 ? (
                                    <p className="text-xs text-slate-400 font-semibold italic text-center py-8">
                                        Sin actividades recientes en el sistema.
                                    </p>
                                ) : (
                                    recentActivitiesList.map((act) => {
                                        const colorClass = act.colorClass || (
                                            act.iconType === 'send' || act.type === 'circular' ? 'bg-[#5E7892]/15 border-[#5E7892]/30 text-[#5E7892]' :
                                            act.iconType === 'upload' || act.type === 'import' ? 'bg-[#8E9E83]/15 border-[#8E9E83]/30 text-[#6E8063]' :
                                            act.iconType === 'user' || act.type === 'student' ? 'bg-[#8E9E83]/15 border-[#8E9E83]/30 text-[#6E8063]' :
                                            act.iconType === 'clipboard' || act.type === 'grade' ? 'bg-[#5E7892]/15 border-[#5E7892]/30 text-[#5E7892]' :
                                            'bg-[#D99458]/15 border-[#D99458]/40 text-[#D99458]'
                                        );

                                        const renderIcon = () => {
                                            if (act.iconType === 'send' || act.type === 'circular') return <Send size={14} />;
                                            if (act.iconType === 'upload' || act.type === 'import') return <Upload size={14} />;
                                            if (act.iconType === 'clipboard' || act.type === 'grade') return <ClipboardList size={14} />;
                                            if (act.iconType === 'user' || act.type === 'student') return <Users size={14} />;
                                            return <Printer size={14} />;
                                        };

                                        return (
                                            <div key={act.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-slate-300 transition hover:shadow-xs text-left group">
                                                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colorClass}`}>
                                                    {renderIcon()}
                                                </div>
                                                <div className="leading-tight min-w-0 flex-1">
                                                    <h5 className="text-xs font-black text-slate-800 truncate group-hover:text-[#5E7892] transition-colors">{act.title}</h5>
                                                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">{act.subtitle}</p>
                                                </div>
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600 shrink-0 shadow-2xs">
                                                    {formatRelativeTime(act.created_at)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Columna 3: Próximos eventos (Widget Ejecutivo Dark Mode - Linear / Stripe) */}
                        <div className="bg-gradient-to-b from-[#1a232c] via-[#1f2937] to-[#0f172a] rounded-3xl p-6 shadow-xl shadow-slate-900/15 border border-slate-700/60 flex flex-col gap-4.5 relative overflow-hidden text-white">
                            {/* Resplandor ambiental de fondo */}
                            <div className="absolute -top-16 -right-16 w-44 h-44 bg-[#5E7892]/25 rounded-full blur-3xl pointer-events-none"></div>

                            <div className="flex justify-between items-center pb-3 border-b border-white/10 relative z-10">
                                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/10 shadow-xs">
                                        <CalendarIcon size={16} />
                                    </span>
                                    Próximos eventos
                                </h3>
                                <button className="text-[10px] font-black text-slate-300 hover:text-white px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition">
                                    Ver calendario
                                </button>
                            </div>
                            
                            {/* Mini Calendario Estético Dark */}
                            <div className="flex-grow flex flex-col justify-between gap-3 relative z-10">
                                <div className="p-3.5 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-inner transition-all">
                                    <div className="flex justify-between items-center mb-2.5 px-1">
                                        <button 
                                            onClick={handlePrevMonth}
                                            className="text-xs font-black text-slate-300 hover:text-white p-1 px-2.5 rounded-lg hover:bg-white/20 bg-white/10 border border-white/10 shadow-xs transition active-press"
                                            title="Mes anterior"
                                        >
                                            &lt;
                                        </button>
                                        <span className="text-xs font-black text-white capitalize bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/15 shadow-xs">
                                            {formattedCalendarMonthTitle}
                                        </span>
                                        <button 
                                            onClick={handleNextMonth}
                                            className="text-xs font-black text-slate-300 hover:text-white p-1 px-2.5 rounded-lg hover:bg-white/20 bg-white/10 border border-white/10 shadow-xs transition active-press"
                                            title="Mes siguiente"
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 mb-1.5 bg-white/5 rounded-lg py-1 border border-white/5">
                                        <span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
                                        {calendarDaysList.map((item, idx) => (
                                            <span 
                                                key={idx}
                                                className={`flex items-center justify-center w-6 h-6 mx-auto rounded-lg transition ${
                                                    !item.isCurrentMonth
                                                        ? 'text-slate-600'
                                                        : item.isToday
                                                        ? 'bg-[#5E7892] text-white font-black shadow-md shadow-[#5E7892]/40 ring-2 ring-[#A7B7C6]/40'
                                                        : 'text-slate-200 font-bold hover:bg-white/15 hover:text-white'
                                                }`}
                                            >
                                                {item.day}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Tarjeta de Próximo Evento Destacado Dark Glass */}
                                <div className="bg-white/10 backdrop-blur-md border border-white/15 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-md">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5E7892] to-[#4A6076] text-white flex flex-col items-center justify-center shrink-0 shadow-md border border-white/20">
                                            <span className="text-xs font-black leading-none">21</span>
                                            <span className="text-[8px] uppercase font-bold tracking-wider leading-none mt-0.5">JUL</span>
                                        </div>
                                        <div className="text-left leading-tight min-w-0">
                                            <h5 className="text-xs font-black text-white truncate">Reunión de Consejo Académico</h5>
                                            <p className="text-[10px] text-slate-300 font-medium mt-0.5">8:00 a.m. • Sala de Juntas</p>
                                        </div>
                                    </div>
                                    <span className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-slate-200 shrink-0">
                                        <Users size={13} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel de Control Académico General */}
                    <div className="bg-white/95 backdrop-blur-md border border-white/80 rounded-3xl p-6 shadow-md shadow-slate-900/5 space-y-6">
                        <div className="border-b pb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Table className="text-indigo-600" size={22} /> Control Académico General
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">Monitorea el listado de alumnos, sus promedios por materia y accede al boletín oficial.</p>
                        </div>

                        {/* Selector de Curso de Admin */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Cursos Disponibles</label>
                            <div className="flex flex-wrap gap-2">
                                {adminCourses.map(course => {
                                    const count = adminStudents.filter(s => s.grade === course).length;
                                    const isSelected = selectedAdminCourse === course;
                                    return (
                                        <button
                                            key={course}
                                            onClick={() => {
                                                setSelectedAdminCourse(course);
                                                setAdminSearchTerm('');
                                            }}
                                            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 border shadow-sm active-press ${
                                                isSelected
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-600/10'
                                                    : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-600'
                                            }`}
                                        >
                                            Curso {course}
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {count} alumnos
                                            </span>
                                        </button>
                                    );
                                })}
                                
                                <button
                                    onClick={handleCreateCourse}
                                    className="px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-650 font-bold text-xs border border-indigo-100/50 shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                                >
                                    <PlusCircle size={14} /> Crear Curso
                                </button>
                            </div>
                        </div>

                        {selectedAdminCourse && (
                            <div className="space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <input
                                            type="text"
                                            placeholder={`Buscar alumno en curso ${selectedAdminCourse}...`}
                                            className="max-w-md w-full pl-4 pr-4 py-2.5 border border-gray-100 bg-gray-50/50 rounded-2xl focus:ring-2 focus:ring-indigo-600/20 outline-none text-xs"
                                            value={adminSearchTerm}
                                            onChange={e => setAdminSearchTerm(e.target.value)}
                                        />
                                        <button
                                            onClick={() => {
                                                setIsEditMode(false);
                                                setStudentFirstName('');
                                                setStudentLastName('');
                                                setStudentGrade(selectedAdminCourse);
                                                setStudentCode('');
                                                setParentEmail('');
                                                setParentName('');
                                                setShowAddStudentModal(true);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-indigo-600/10 flex items-center gap-1.5 shrink-0 transition"
                                        >
                                            <PlusCircle size={15} /> Registrar Alumno
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCourse(selectedAdminCourse)}
                                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shrink-0 transition border border-rose-100/50 shadow-sm"
                                        >
                                            <Trash2 size={15} className="text-rose-500" /> Eliminar Curso
                                        </button>
                                        <button
                                            onClick={() => handleBulkReassignCourse(selectedAdminCourse)}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shrink-0 transition border border-indigo-100/50 shadow-sm"
                                            title="Reasignar todos los estudiantes de este curso a otro curso masivamente"
                                        >
                                            <RefreshCw size={15} className="text-indigo-600" /> Reasignar Curso Masivo
                                        </button>
                                        <Link
                                            to="/admin/boletin-print"
                                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md flex items-center gap-1.5 shrink-0 transition"
                                        >
                                            <BookOpen size={14} /> Boletines Masivos
                                        </Link>
                                        <Link
                                            to="/planilla-print"
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-2xl text-xs border border-slate-200 shadow-sm flex items-center gap-1.5 shrink-0 transition"
                                        >
                                            <Printer size={14} /> Planillas Masivas
                                        </Link>
                                        <Link
                                            to="/admin/consolidado-print"
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-amber-500/10 flex items-center gap-1.5 shrink-0 transition"
                                        >
                                            <Award size={14} /> Consolidado & Ranking
                                        </Link>
                                    </div>
                                    <div className="text-xs text-gray-400 font-semibold">
                                        Mostrando {
                                            adminStudents
                                                .filter(s => s.grade === selectedAdminCourse)
                                                .filter(s => s.name.toLowerCase().includes(adminSearchTerm.toLowerCase())).length
                                        } de {adminStudents.filter(s => s.grade === selectedAdminCourse).length} estudiantes
                                    </div>
                                </div>

                                <div className="space-y-3">
                                     {adminStudents
                                         .filter(s => s.grade === selectedAdminCourse)
                                         .filter(s => s.name.toLowerCase().includes(adminSearchTerm.toLowerCase()))
                                         .sort((a, b) => {
                                              const getSortKey = (student) => {
                                                  if (student.lastName && student.firstName) {
                                                      return `${student.lastName} ${student.firstName}`;
                                                  }
                                                  const name = student.name || '';
                                                  const words = name.trim().split(/\s+/);
                                                  if (words.length <= 1) return name;
                                                  if (words.length === 2) return `${words[1]} ${words[0]}`;
                                                  const apellidos = words.slice(-2).join(' ');
                                                  const nombres = words.slice(0, -2).join(' ');
                                                  return `${apellidos} ${nombres}`;
                                              };
                                              return getSortKey(a).localeCompare(getSortKey(b));
                                          })
                                         .map(student => {
                                            // Buscar notas de este estudiante
                                            const studentGrades = adminGrades.filter(g => g.student_id === student.id);
                                            
                                            return (
                                                <div 
                                                    key={student.id} 
                                                    className={`border rounded-2xl p-4 hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
                                                        student.status === 'retirado' ? 'bg-rose-50/20 border-rose-200' : 'bg-white border-gray-100 hover:border-indigo-100'
                                                    }`}
                                                >
                                                    {/* Perfil del Estudiante */}
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className={`w-10 h-10 rounded-xl overflow-hidden border flex items-center justify-center shrink-0 ${
                                                            student.status === 'retirado' ? 'bg-rose-100 border-rose-200' : 'bg-slate-50 border-slate-200'
                                                        }`}>
                                                            <img 
                                                                src={getStudentPhoto(student.photo_url)} 
                                                                alt={student.name} 
                                                                className="w-full h-full object-cover" 
                                                                onError={(e) => { e.currentTarget.src = DEFAULT_STUDENT_PHOTO; }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-xs font-extrabold text-gray-800 leading-tight">
                                                                    {student.lastName && student.firstName 
                                                                        ? `${student.lastName} ${student.firstName}` 
                                                                        : student.name}
                                                                </h4>
                                                                {student.status === 'retirado' && (
                                                                    <span className="text-[9px] bg-rose-100 text-rose-700 font-black px-2 py-0.5 rounded-full border border-rose-200">
                                                                        RETIRADO
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-gray-400 font-mono font-medium block mt-0.5">{student.id_code}</span>
                                                        </div>
                                                    </div>

                                                    {/* Notas por Materia */}
                                                    <div className="flex-1 flex flex-wrap gap-2 md:justify-center">
                                                        {studentGrades.filter(g => Number(g.grade) > 0).length === 0 ? (
                                                            <span className="text-[10px] text-gray-400 font-semibold italic bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                                                Sin notas registradas
                                                            </span>
                                                        ) : (
                                                            studentGrades
                                                                .filter(g => Number(g.grade) > 0)
                                                                .sort((a, b) => a.subject.localeCompare(b.subject) || (Number(a.period) || 1) - (Number(b.period) || 1))
                                                                .map(gradeDoc => {
                                                                    const gradeValue = Number(gradeDoc.grade);
                                                                    const isPassing = gradeValue >= 75;
                                                                    const periodLabel = gradeDoc.period ? `P${gradeDoc.period}` : 'P1';
                                                                    return (
                                                                        <div 
                                                                            key={gradeDoc.id}
                                                                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all shadow-sm ${
                                                                                isPassing 
                                                                                    ? 'bg-emerald-50/40 text-emerald-700 border-emerald-100/55' 
                                                                                    : 'bg-rose-50/40 text-rose-700 border-rose-100/55'
                                                                            }`}
                                                                        >
                                                                            <span className="text-gray-400 font-medium">{gradeDoc.subject} ({periodLabel}):</span>
                                                                            <span className="font-extrabold">{gradeValue}</span>
                                                                        </div>
                                                                    );
                                                                })
                                                        )}
                                                    </div>

                                                    {/* Acción de Boletín y Cambio de Estado */}
                                                    <div className="shrink-0 flex items-center justify-end gap-2">
                                                        <Link 
                                                            to={`/admin/boletin/${student.id}`}
                                                            className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition flex items-center gap-1 shrink-0"
                                                        >
                                                            <BookOpen size={12} /> Ver Boletín
                                                        </Link>
                                                        <Link 
                                                            to={`/admin/boletin-print/${student.id}`}
                                                            className="text-[10px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition shadow-md shadow-indigo-600/10 flex items-center gap-1 shrink-0"
                                                        >
                                                            <Printer size={12} /> Imprimir Oficio
                                                        </Link>
                                                        
                                                        {/* Botón de Cambiar Estado (Activo / Retirado) - Exclusivo Administrador */}
                                                        {userRole === 'admin' && (
                                                            <button 
                                                                onClick={() => handleToggleStudentStatus(student)}
                                                                className={`text-[10px] font-extrabold p-2 rounded-xl border transition shrink-0 ${
                                                                    student.status === 'retirado'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                                                                }`}
                                                                title={student.status === 'retirado' ? "Reactivar Alumno Activo" : "Marcar Alumno como Retirado"}
                                                            >
                                                                {student.status === 'retirado' ? <UserCheck size={13} /> : <UserMinus size={13} />}
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={() => handleStartEdit(student)}
                                                            className="text-[10px] font-extrabold text-amber-600 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 p-2 rounded-xl transition shrink-0"
                                                            title="Modificar Estudiante"
                                                        >
                                                            <Edit size={13} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteStudent(student.id, student.name)}
                                                            className="text-[10px] font-extrabold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 p-2 rounded-xl transition shrink-0"
                                                            title="Eliminar Estudiante"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            </div>

            {/* Modal de Registro de Nuevo Estudiante */}
            {showAddStudentModal && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowAddStudentModal(false); }}
                >
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-4 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                {isEditMode ? (
                                    <><Edit className="text-indigo-650" size={20} /> Modificar Estudiante</>
                                ) : (
                                    <><PlusCircle className="text-indigo-650" size={20} /> Registrar Nuevo Estudiante</>
                                )}
                            </h3>
                            <button 
                                onClick={() => setShowAddStudentModal(false)}
                                className="text-gray-400 hover:text-gray-650 font-bold text-xl leading-none p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleAddStudent} className="space-y-4">
                            {/* Subir / Cambiar Foto del Estudiante (Perfil y Formulario 3x4) */}
                            <div className="flex items-center gap-4 p-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl">
                                <div className="relative group shrink-0">
                                    <div className="w-16 h-20 rounded-xl bg-white border-2 border-indigo-200 overflow-hidden shadow-xs flex items-center justify-center">
                                        {isValidStudentPhoto(studentPhotoUrl) ? (
                                            <img src={studentPhotoUrl} alt="Foto Estudiante" className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={DEFAULT_STUDENT_PHOTO} alt="Foto Estudiante" className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('modal-student-photo-input')?.click()}
                                        className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-full shadow-md transition active-press"
                                        title="Seleccionar foto"
                                    >
                                        <Camera size={12} />
                                    </button>
                                </div>

                                <div className="flex-1 space-y-1 text-left">
                                    <label className="text-xs font-black text-slate-800 block">
                                        Foto del Estudiante
                                    </label>
                                    <p className="text-[10px] text-slate-500 leading-tight font-medium">
                                        Visible en el perfil, carnet y formulario 3x4 cm.
                                    </p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('modal-student-photo-input')?.click()}
                                            className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                                        >
                                            <Upload size={12} /> {studentPhotoUrl ? 'Cambiar Foto' : 'Subir Foto'}
                                        </button>
                                        {studentPhotoUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setStudentPhotoUrl('')}
                                                className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition"
                                                title="Quitar foto"
                                            >
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        id="modal-student-photo-input" 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleStudentPhotoFileChange} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombres</label>
                                    <input 
                                        type="text"
                                        required
                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                                        placeholder="Ej: SARA ISABELLA"
                                        value={studentFirstName}
                                        onChange={e => setStudentFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Apellidos</label>
                                    <input 
                                        type="text"
                                        required
                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                                        placeholder="Ej: BULLA MOYANO"
                                        value={studentLastName}
                                        onChange={e => setStudentLastName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Curso / Grado</label>
                                    <input 
                                        type="text"
                                        required
                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none bg-gray-50/50"
                                        placeholder="Ej: 1101"
                                        value={studentGrade}
                                        onChange={e => setStudentGrade(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Código Alumno</label>
                                    <input 
                                        type="text"
                                        required
                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                                        placeholder="Ej: ST-1101-032"
                                        value={studentCode}
                                        onChange={e => setStudentCode(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-3 space-y-3">
                                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Datos del Acudiente / Padre</span>
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre del Acudiente (Opcional)</label>
                                    <input 
                                        type="text"
                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                                        placeholder="Ej: Liliana Moyano"
                                        value={parentName}
                                        onChange={e => setParentName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Email del Acudiente (Opcional)</label>
                                    <input 
                                        type="email"
                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                                        placeholder="acudiente@ejemplo.com"
                                        value={parentEmail}
                                        onChange={e => setParentEmail(e.target.value)}
                                    />
                                </div>
                                <span className="text-[9px] text-gray-400 block italic leading-snug">
                                    * Nota: Si usa Firebase real, se creará una cuenta de acceso con contraseña predeterminada: <strong>colegio2026</strong>
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 border-t pt-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowAddStudentModal(false)}
                                    className="px-4 py-2 border rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-bold transition"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={addingStudent}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 flex items-center gap-1.5 transition disabled:opacity-50"
                                >
                                    {addingStudent ? (
                                        <><Loader2 className="animate-spin" size={14} /> Guardando...</>
                                    ) : (
                                        isEditMode ? 'Guardar Cambios' : 'Registrar Estudiante'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para ver y gestionar Circulares Enviadas */}
            {showCircularsModal && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowCircularsModal(false); }}
                >
                    <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col gap-4 animate-scale-in max-h-[85vh]">
                        <div className="flex justify-between items-center border-b pb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 bg-indigo-50 text-indigo-650 rounded-xl flex items-center justify-center">
                                    <Bell size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Circulares Publicadas</h3>
                                    <p className="text-[10px] text-gray-400">Historial completo de comunicados institucionales y anuncios</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowCircularsModal(false)}
                                className="text-gray-400 hover:text-gray-650 hover:bg-slate-100 p-1.5 rounded-full transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                            {loadingAllCirculars ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                    <Loader2 className="animate-spin text-indigo-600" size={28} />
                                    <span className="text-xs font-semibold">Cargando comunicados...</span>
                                </div>
                            ) : allCirculars.length === 0 ? (
                                <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-xs text-gray-500 italic">No hay circulares publicadas en el sistema.</p>
                                    {(userRole === 'admin' || userRole === 'teacher') && (
                                        <button
                                            onClick={() => {
                                                setShowCircularsModal(false);
                                                navigate(userRole === 'admin' ? '/admin/new-circular' : '/teacher/create-task');
                                            }}
                                            className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm"
                                        >
                                            <PlusCircle size={14} /> Publicar nueva circular
                                        </button>
                                    )}
                                </div>
                            ) : (
                                allCirculars.map(c => {
                                    const dateVal = c.created_at?.seconds 
                                        ? new Date(c.created_at.seconds * 1000) 
                                        : c.created_at 
                                            ? new Date(c.created_at) 
                                            : new Date();
                                    const isHigh = c.priority === 'HIGH';
                                    const readCount = c.read_by?.length || 0;

                                    return (
                                        <div key={c.id} className={`p-4 rounded-2xl border transition-all ${
                                            isHigh ? 'bg-red-50/20 border-red-150' : 'bg-slate-50/30 border-slate-200'
                                        }`}>
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-1 flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-xs font-bold text-gray-800 uppercase truncate">
                                                            {c.title}
                                                        </h4>
                                                        {isHigh && (
                                                            <span className="bg-red-50 text-red-600 text-[8px] px-1.5 py-0.5 rounded-full font-extrabold border border-red-100 shrink-0 uppercase tracking-wide">
                                                                Urgente
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 font-medium shrink-0">
                                                        Publicado: {dateVal.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                
                                                <button
                                                    onClick={() => handleDeleteCircular(c.id)}
                                                    className="text-gray-400 hover:text-red-650 hover:bg-red-50 p-1.5 rounded-full transition shrink-0"
                                                    title="Eliminar circular"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            
                                            <p className="text-[11px] text-gray-650 mt-2 whitespace-pre-wrap leading-relaxed">
                                                {c.body}
                                            </p>

                                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-dashed border-slate-200">
                                                 <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                                     <CheckCircle2 className="text-emerald-500" size={12} />
                                                     <span>Confirmación: Leído por {readCount} {readCount === 1 ? 'usuario' : 'usuarios'}</span>
                                                 </div>
                                                 <button
                                                     onClick={() => setReadersModalCircular(c)}
                                                     className="text-[9px] text-indigo-650 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-indigo-100/50 transition select-none active-press shadow-sm"
                                                 >
                                                     Ver Detalle de Acuses
                                                 </button>
                                             </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex justify-end border-t pt-3 shrink-0">
                            <button
                                onClick={() => setShowCircularsModal(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedCircular && (
                <CircularDetailModal
                    circular={selectedCircular}
                    onClose={() => setSelectedCircular(null)}
                    currentUserId={currentUser.uid}
                    onAcknowledge={(id) => {
                        handleMarkAsRead(id);
                        setSelectedCircular(prev => prev ? { ...prev, read_by: [...(prev.read_by || []), currentUser.uid] } : null);
                    }}
                />
            )}

            {readersModalCircular && (
                <CircularReadersModal
                    circular={readersModalCircular}
                    parentsList={parents}
                    studentsList={studentsList}
                    onClose={() => setReadersModalCircular(null)}
                />
            )}

            <QuickObservationModal
                isOpen={showQuickObsModal}
                onClose={() => setShowQuickObsModal(false)}
            />

            {/* Modal de Confirmación Universal */}
            <ConfirmModal
                {...confirmModalConfig}
                onCancel={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </>
    );
}
