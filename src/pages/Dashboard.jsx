import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, deleteDoc, addDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Loader2, BookOpen, Calendar as CalendarIcon, ClipboardList, 
    MessageSquare, User, FileText, Award, Star, Bell, 
    ChevronRight, CheckCircle2, AlertTriangle, TrendingUp,
    Users, PlusCircle, ShieldAlert, ArrowRight, Sparkles, Upload, Table, Printer, Trash2, Edit, Edit2, X, BarChart2, Send
} from 'lucide-react';
import { MOCK_NEWS, MOCK_STUDENTS, MOCK_LOGS, MOCK_PARENTS } from '../lib/mockData';
import CircularDetailModal from '../components/CircularDetailModal';
import CircularReadersModal from '../components/CircularReadersModal';

export default function Dashboard() {
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    // Common States
    const [loading, setLoading] = useState(true);
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

    // Admin Student Manage States
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    const [studentFirstName, setStudentFirstName] = useState('');
    const [studentLastName, setStudentLastName] = useState('');
    const [studentGrade, setStudentGrade] = useState('');
    const [studentCode, setStudentCode] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [parentName, setParentName] = useState('');
    const [addingStudent, setAddingStudent] = useState(false);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editingStudentId, setEditingStudentId] = useState(null);

    // Iniciar edición de estudiante
    const handleStartEdit = async (student) => {
        setIsEditMode(true);
        setEditingStudentId(student.id);
        setStudentFirstName(student.firstName || student.name || '');
        setStudentLastName(student.lastName || '');
        setStudentGrade(student.grade || '');
        setStudentCode(student.id_code || '');
        
        // Cargar datos de acudiente
        setParentEmail('');
        setParentName('');
        if (student.parent_uids && student.parent_uids.length > 0) {
            try {
                const pDoc = await getDoc(doc(db, 'users', student.parent_uids[0]));
                if (pDoc.exists()) {
                    setParentEmail(pDoc.data().email || '');
                    setParentName(pDoc.data().name || '');
                }
            } catch (e) {
                console.error("Error al cargar datos del acudiente:", e);
            }
        }
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
            const hasParentInfo = parentEmail.trim() && parentName.trim();

            if (hasParentInfo) {
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
                        const cred = await createUserWithEmailAndPassword(tempAuth, parentEmail.trim(), 'colegio2026');
                        parentUid = cred.user.uid;
                        await deleteApp(tempApp);
                    } catch (authError) {
                        if (authError.code === 'auth/email-already-in-use') {
                            const qUser = query(collection(db, 'users'), where('email', '==', parentEmail.trim()));
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
                    email: parentEmail.trim(),
                    role: 'parent',
                    name: parentName.trim(),
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
            const avatarSeed = studentFirstName.trim();

            if (isEditMode) {
                // Actualizar estudiante existente
                await setDoc(doc(db, 'students', editingStudentId), {
                    name: fullName.toUpperCase(),
                    firstName: studentFirstName.trim().toUpperCase(),
                    lastName: studentLastName.trim().toUpperCase(),
                    grade: studentGrade.toUpperCase(),
                    id_code: studentCode.trim().toUpperCase(),
                    parent_uids: parentUid ? [parentUid] : []
                }, { merge: true });

                alert(`Estudiante ${fullName} modificado con éxito.`);
            } else {
                // Crear estudiante nuevo
                const studentDoc = await addDoc(collection(db, 'students'), {
                    name: fullName.toUpperCase(),
                    firstName: studentFirstName.trim().toUpperCase(),
                    lastName: studentLastName.trim().toUpperCase(),
                    grade: studentGrade.toUpperCase(),
                    id_code: studentCode.trim().toUpperCase(),
                    photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
                    parent_uids: parentUid ? [parentUid] : []
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

    const handleDeleteStudent = async (studentId, studentName) => {
        const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${studentName}? Esta acción borrará al alumno y sus calificaciones.`);
        if (!confirmDelete) return;

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
            alert(`Estudiante ${studentName} eliminado correctamente.`);
        } catch (err) {
            console.error("Error al eliminar estudiante:", err);
            alert("Error al eliminar estudiante: " + err.message);
        }
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

    const handleDeleteCourse = async (courseName) => {
        const confirmDelete = window.confirm(`⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás completamente seguro de que deseas eliminar permanentemente el Curso ${courseName}?\n\nEsta acción borrará el curso de la lista y eliminará permanentemente a TODOS los estudiantes de este curso junto con sus calificaciones.`);
        if (!confirmDelete) return;

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

            alert(`Curso ${courseName} y todos sus datos relacionados han sido eliminados.`);

            // Recargar listados
            const cSnap = await getDocs(collection(db, 'courses'));
            let coursesList = [];
            if (!cSnap.empty) {
                coursesList = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            }
            setAdminCourses(coursesList);

            const studSnap = await getDocs(collection(db, 'students'));
            const studentsList = studSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAdminStudents(studentsList);
            setTotalStudentsCount(studentsList.length);

            if (coursesList.length > 0) {
                setSelectedAdminCourse(coursesList[0]);
            } else {
                setSelectedAdminCourse('');
            }
        } catch (err) {
            console.error("Error al eliminar curso:", err);
            alert("Error al eliminar curso: " + err.message);
        }
    };

    const mergeDemoReads = (circs) => {
        const demoReads = JSON.parse(localStorage.getItem('demo_circular_reads') || '{}');
        return circs.map(c => {
            const localReads = demoReads[c.id] || [];
            const merged = Array.from(new Set([...(c.read_by || []), ...localReads]));
            return { ...c, read_by: merged };
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
                    const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                    const sSnap = await getDocs(qStudent);
                    if (!sSnap.empty) {
                        activeStudent = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
                    }
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

    const handleDeleteCircular = async (circularId) => {
        if (!window.confirm('¿Está seguro de que desea eliminar esta circular? Esta acción no se puede deshacer.')) {
            return;
        }
        
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
    };

    useEffect(() => {
        if (!currentUser) return;

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
                    let activeStudent = null;
                    if (currentUser.uid.startsWith('fake-')) {
                        activeStudent = MOCK_STUDENTS[0];
                    } else {
                        const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                        const sSnap = await getDocs(qStudent);
                        if (!sSnap.empty) {
                            activeStudent = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
                        }
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
                        const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                        const sSnap = await getDocs(qStudent);

                        let targetStudentDoc = null;
                        if (!sSnap.empty) {
                            targetStudentDoc = sSnap.docs[0];
                        } else {
                            // Fallback para cuentas de prueba o padres sin estudiante vinculado explícito
                            const allStudentsSnap = await getDocs(collection(db, 'students'));
                            if (!allStudentsSnap.empty) {
                                targetStudentDoc = allStudentsSnap.docs[0];
                            }
                        }

                        if (targetStudentDoc) {
                            const studentDoc = targetStudentDoc;
                            const studentData = { id: studentDoc.id, ...studentDoc.data() };
                            setStudent(studentData);

                            // Cargar notas para promedio
                            const qGrades = query(collection(db, 'grades'), where('student_id', '==', studentDoc.id));
                            const gSnap = await getDocs(qGrades);
                            const gradesList = gSnap.docs.map(d => Number(d.data().grade));
                            if (gradesList.length > 0) {
                                const avg = (gradesList.reduce((sum, g) => sum + g, 0) / gradesList.length).toFixed(2);
                                setGradesAverage(avg);
                            }

                            // Cargar asistencia para tasa
                            const qAtt = query(collection(db, 'attendance'), where('student_id', '==', studentDoc.id));
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
                            const qLogs = query(collection(db, 'observation_logs'), where('student_id', '==', studentDoc.id));
                            const lSnap = await getDocs(qLogs);
                            const logsList = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                            logsList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                            setLatestLogs(logsList.slice(0, 2));
                        }
                    }
                } else if (userRole === 'teacher') {
                    if (currentUser.uid.startsWith('fake-')) {
                        setTotalStudentsCount(35);
                        setMyTasksCount(4);
                    } else {
                        // Total de estudiantes
                        const sSnap = await getDocs(collection(db, 'students'));
                        setTotalStudentsCount(sSnap.size);

                        // Tareas creadas por este profesor
                        const qTasks = query(collection(db, 'tasks'), where('teacher_id', '==', currentUser.uid));
                        const tSnap = await getDocs(qTasks);
                        setMyTasksCount(tSnap.size);
                    }
                } else if (userRole === 'admin') {
                    if (currentUser.uid.startsWith('fake-')) {
                        setTotalStudentsCount(35);
                        setTotalUsersCount(40);
                    } else {
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
                            // Inicializar/Sembrar colección courses si está vacía
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

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-sm font-semibold text-gray-500 animate-pulse">Cargando panel escolar institucional...</p>
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
                                <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
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
            {userRole === 'parent' && student && (
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Estudiantes del Plantel</p>
                                <p className="text-2xl font-extrabold text-gray-800 mt-1">{totalStudentsCount}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                <ClipboardList size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mis Tareas Publicadas</p>
                                <p className="text-2xl font-extrabold text-gray-800 mt-1">{myTasksCount}</p>
                            </div>
                        </div>

                        <div 
                            onClick={handleOpenCircularsModal}
                            className="bg-white border border-gray-100 rounded-3xl p-6 flex items-center gap-4 cursor-pointer hover-elevate active-press hover:bg-slate-50/50"
                        >
                            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                                <Bell size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Anuncios en el Tablón</p>
                                <p className="text-2xl font-extrabold text-gray-800 mt-1">{circulars.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Acciones Rápidas del Profesor */}
                    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={20} /> Acciones Rápidas del Docente
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            <Link 
                                to="/teacher/search" 
                                className="bg-indigo-50/20 border border-indigo-100/50 p-5 rounded-2xl text-left flex flex-col justify-between h-36 group shadow-inner hover-elevate active-press hover:bg-indigo-50/70"
                            >
                                <Users className="text-indigo-600 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800">Buscar Alumno</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Registra comportamiento, asistencia o notas para cualquier alumno.</p>
                                </div>
                            </Link>

                            <Link 
                                to="/teacher/create-task" 
                                className="bg-emerald-50/20 border border-emerald-100/50 p-5 rounded-2xl text-left flex flex-col justify-between h-36 group shadow-inner hover-elevate active-press hover:bg-emerald-50/70"
                            >
                                <ClipboardList className="text-emerald-600 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800">Crear Nueva Tarea</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Asigna tareas escolares directamente a cualquier curso (como el 1001).</p>
                                </div>
                            </Link>

                            <Link 
                                to="/teacher/sync-grades" 
                                className="bg-violet-50/20 border border-violet-100/50 p-5 rounded-2xl text-left flex flex-col justify-between h-36 group shadow-inner hover-elevate active-press hover:bg-violet-50/70"
                            >
                                <BookOpen className="text-violet-600 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800">Sincronizar Notas</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Carga calificaciones directamente desde planillas de Google Sheets.</p>
                                </div>
                            </Link>

                            <Link 
                                to="/messages" 
                                className="bg-amber-50/20 border border-amber-100/50 p-5 rounded-2xl text-left flex flex-col justify-between h-36 group shadow-inner hover-elevate active-press hover:bg-amber-50/70"
                            >
                                <MessageSquare className="text-amber-500 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800">Buzón de Mensajes</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Responde inquietudes e intercambia mensajes con acudientes.</p>
                                </div>
                            </Link>

                            <Link 
                                to="/admin/stats" 
                                className="bg-blue-50/20 border border-blue-100/50 p-5 rounded-2xl text-left flex flex-col justify-between h-36 group shadow-inner hover-elevate active-press hover:bg-blue-50/70"
                            >
                                <BarChart2 className="text-blue-600 group-hover:scale-110 transition-transform" size={28} />
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800">Estadísticas</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Analiza promedios, rendimientos y alertas académicas de cursos.</p>
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
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl animate-bounce">👋</span>
                            <div className="text-left">
                                <h3 className="text-base font-black text-slate-800 leading-tight">¡Buenos días, Administrador!</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Aquí tienes un resumen de lo más importante hoy.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto shrink-0">
                            {/* Card 1: Circulares Pendientes */}
                            <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-650 flex items-center justify-center shrink-0">
                                    <Sparkles size={16} />
                                </div>
                                <div className="leading-tight text-left">
                                    <p className="text-xs font-black text-slate-700">2</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5">Circulares pendientes</p>
                                </div>
                            </div>
                            {/* Card 2: Eventos Programados */}
                            <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-650 flex items-center justify-center shrink-0">
                                    <CalendarIcon size={16} />
                                </div>
                                <div className="leading-tight text-left">
                                    <p className="text-xs font-black text-slate-700">1</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5">Evento programado</p>
                                </div>
                            </div>
                            {/* Card 3: Alumnos Totales */}
                            <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Users size={16} />
                                </div>
                                <div className="leading-tight text-left">
                                    <p className="text-xs font-black text-slate-700">{totalStudentsCount}</p>
                                    <p className="text-[9px] text-slate-400 font-bold leading-none mt-0.5">Alumnos totales</p>
                                </div>
                            </div>
                            {/* Card 4: Reloj */}
                            <div className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                    <CalendarIcon size={16} />
                                </div>
                                <div className="leading-tight text-left">
                                    <p className="text-[9px] text-slate-500 font-extrabold whitespace-nowrap leading-tight">
                                        {currentTime.split(' de ')[0] || 'Hoy'}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                        {currentTime.split(' a la')[1] || currentTime.split(' ').slice(-2).join(' ') || ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tarjetas Analíticas con Mini-Gráficos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Card 1: Alumnos Totales */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ALUMNOS TOTALES</p>
                                    <p className="text-3xl font-black text-slate-800 tracking-tight">{totalStudentsCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Users size={20} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1 z-10">
                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    +8% vs. mes anterior
                                </span>
                                {/* Sparkline SVG */}
                                <svg className="w-24 h-8 text-blue-550 shrink-0" viewBox="0 0 100 30" fill="none">
                                    <path d="M0 25 C 20 20, 40 28, 60 15 C 80 5, 90 10, 100 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M0 25 C 20 20, 40 28, 60 15 C 80 5, 90 10, 100 2 L 100 30 L 0 30 Z" fill="currentColor" fillOpacity="0.05" />
                                </svg>
                            </div>
                        </div>

                        {/* Card 2: Cuentas Registradas */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CUENTAS REGISTRADAS</p>
                                    <p className="text-3xl font-black text-slate-800 tracking-tight">{totalUsersCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Users size={20} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1 z-10">
                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    +12% vs. mes anterior
                                </span>
                                {/* Sparkline SVG */}
                                <svg className="w-24 h-8 text-emerald-550 shrink-0" viewBox="0 0 100 30" fill="none">
                                    <path d="M0 22 C 20 25, 40 12, 60 18 C 80 8, 90 5, 100 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M0 22 C 20 25, 40 12, 60 18 C 80 8, 90 5, 100 2 L 100 30 L 0 30 Z" fill="currentColor" fillOpacity="0.05" />
                                </svg>
                            </div>
                        </div>

                        {/* Card 3: Circulares Publicadas */}
                        <div 
                            onClick={handleOpenCircularsModal}
                            className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden cursor-pointer hover:shadow-md hover:border-orange-200 transition active-press"
                            title="Haz clic para ver el historial y acuses de circulares publicadas"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CIRCULARES PUBLICADAS</p>
                                    <p className="text-3xl font-black text-slate-800 tracking-tight">{circulars.length}</p>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                                    <Bell size={20} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1 z-10">
                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    +50% vs. mes anterior
                                </span>
                                {/* Sparkline SVG */}
                                <svg className="w-24 h-8 text-orange-500 shrink-0" viewBox="0 0 100 30" fill="none">
                                    <path d="M0 28 C 20 22, 40 26, 60 14 C 80 18, 90 10, 100 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M0 28 C 20 22, 40 26, 60 14 C 80 18, 90 10, 100 2 L 100 30 L 0 30 Z" fill="currentColor" fillOpacity="0.05" />
                                </svg>
                            </div>
                        </div>

                        {/* Card 4: Planillas Importadas */}
                        <div 
                            onClick={() => navigate('/teacher/sync-grades')}
                            className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden cursor-pointer hover:shadow-md hover:border-purple-200 transition active-press"
                            title="Haz clic para acceder a la Planilla Digital de Notas"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PLANILLAS IMPORTADAS</p>
                                    <p className="text-3xl font-black text-slate-800 tracking-tight">{importPlanillasCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-650 flex items-center justify-center shrink-0">
                                    <FileText size={20} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1 z-10">
                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    +20% vs. mes anterior
                                </span>
                                {/* Sparkline SVG */}
                                <svg className="w-24 h-8 text-purple-550 shrink-0" viewBox="0 0 100 30" fill="none">
                                    <path d="M0 24 C 20 20, 40 28, 60 12 C 80 15, 90 5, 100 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M0 24 C 20 20, 40 28, 60 12 C 80 15, 90 5, 100 2 L 100 30 L 0 30 Z" fill="currentColor" fillOpacity="0.05" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Sección de 3 Columnas */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Columna 1: Accesos Rápidos */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                            <h3 className="text-base font-black text-slate-800 tracking-tight pb-1 border-b border-slate-100 flex items-center gap-2">
                                <Sparkles size={18} className="text-indigo-600" /> Accesos rápidos
                            </h3>
                            <div className="flex flex-col gap-3 flex-1 justify-center">
                                {/* Nueva Circular */}
                                <Link 
                                    to="/admin/new-circular"
                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/20 hover:bg-indigo-50/40 border border-indigo-150/45 transition active-press group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-indigo-650 text-white rounded-xl flex items-center justify-center shrink-0">
                                            <Send size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-700">Nueva Circular</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Redacta y publica una nueva circular</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                                </Link>

                                {/* Importar CSV */}
                                <Link 
                                    to="/admin/import"
                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-150/45 transition active-press group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-emerald-650 text-white rounded-xl flex items-center justify-center shrink-0">
                                            <Upload size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-700">Importar CSV</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Carga estudiantes desde un archivo</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                                </Link>

                                {/* Planilla Digital de Notas */}
                                <Link 
                                    to="/teacher/sync-grades"
                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/20 hover:bg-purple-50/40 border border-purple-150/45 transition active-press group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-purple-650 text-white rounded-xl flex items-center justify-center shrink-0">
                                            <ClipboardList size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-700">Planilla Digital de Notas</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Importa o gestiona las calificaciones</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-purple-600 group-hover:translate-x-0.5 transition-transform" />
                                </Link>

                                {/* Planilla de Control */}
                                <Link 
                                    to="/planilla-print"
                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-orange-50/20 hover:bg-orange-50/40 border border-orange-150/45 transition active-press group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-orange-500 text-white rounded-xl flex items-center justify-center shrink-0">
                                            <Printer size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-700">Planilla de Control</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Genera e imprime asistencias</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-orange-550 group-hover:translate-x-0.5 transition-transform" />
                                </Link>

                                {/* Estadísticas Académicas */}
                                <Link 
                                    to="/admin/stats"
                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/20 hover:bg-blue-50/40 border border-blue-150/45 transition active-press group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0">
                                            <BarChart2 size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <p className="text-xs font-black text-slate-700">Estadísticas Académicas</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Analiza datos y rendimientos</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                        </div>

                        {/* Columna 2: Actividad Reciente */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                                <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    <MessageSquare size={18} className="text-indigo-600" /> Actividad reciente
                                </h3>
                                <button 
                                    onClick={handleOpenCircularsModal}
                                    className="text-[10px] font-black text-indigo-600 hover:underline hover:text-indigo-850"
                                >
                                    Ver todo
                                </button>
                            </div>
                            
                            <div className="flex-1 flex flex-col gap-4 justify-center pr-1 overflow-y-auto max-h-[340px]">
                                {/* Log 1 */}
                                <div className="flex gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <Send size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <h5 className="text-xs font-black text-slate-700">Circular #{circularNumber} publicada</h5>
                                        <p className="text-[9px] text-slate-450 mt-0.5">Reunión de Padres de Familia</p>
                                        <span className="text-[8px] text-slate-400 font-bold mt-1 block">Hace 5 min</span>
                                    </div>
                                </div>

                                {/* Log 2 */}
                                <div className="flex gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <Upload size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <h5 className="text-xs font-black text-slate-700">Archivo de estudiantes importado</h5>
                                        <p className="text-[9px] text-slate-450 mt-0.5">grado_1001.csv</p>
                                        <span className="text-[8px] text-slate-400 font-bold mt-1 block">Hace 25 min</span>
                                    </div>
                                </div>

                                {/* Log 3 */}
                                <div className="flex gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                        <ClipboardList size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <h5 className="text-xs font-black text-slate-700">Notas de grado 1001 actualizadas</h5>
                                        <p className="text-[9px] text-slate-450 mt-0.5">Matemáticas - Primer periodo</p>
                                        <span className="text-[8px] text-slate-400 font-bold mt-1 block">Hace 1 hora</span>
                                    </div>
                                </div>

                                {/* Log 4 */}
                                <div className="flex gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center shrink-0">
                                        <Printer size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <h5 className="text-xs font-black text-slate-700">Planilla de control generada</h5>
                                        <p className="text-[9px] text-slate-450 mt-0.5">Asistencia general - 19/07/2026</p>
                                        <span className="text-[8px] text-slate-400 font-bold mt-1 block">Hace 2 horas</span>
                                    </div>
                                </div>

                                {/* Log 5 */}
                                <div className="flex gap-3 text-left">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <Users size={14} />
                                    </div>
                                    <div className="leading-tight">
                                        <h5 className="text-xs font-black text-slate-700">Nuevo usuario registrado</h5>
                                        <p className="text-[9px] text-slate-450 mt-0.5">Docente: Juan Pérez</p>
                                        <span className="text-[8px] text-slate-400 font-bold mt-1 block">Hace 3 horas</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Columna 3: Próximos eventos (Calendario) */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                                <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    <CalendarIcon size={18} className="text-indigo-650" /> Próximos eventos
                                </h3>
                                <button className="text-[10px] font-black text-indigo-600 hover:underline hover:text-indigo-800">
                                    Ver calendario
                                </button>
                            </div>
                            
                            {/* Mini Calendario Estético Interactivo */}
                            <div className="flex-grow flex flex-col justify-between gap-3 text-slate-700">
                                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <button 
                                            onClick={handlePrevMonth}
                                            className="text-xs font-black text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition"
                                            title="Mes anterior"
                                        >
                                            &lt;
                                        </button>
                                        <span className="text-xs font-black text-slate-800 capitalize">
                                            {formattedCalendarMonthTitle}
                                        </span>
                                        <button 
                                            onClick={handleNextMonth}
                                            className="text-xs font-black text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition"
                                            title="Mes siguiente"
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 mb-1">
                                        <span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
                                        {calendarDaysList.map((item, idx) => (
                                            <span 
                                                key={idx}
                                                className={`flex items-center justify-center w-5 h-5 mx-auto rounded-lg transition ${
                                                    !item.isCurrentMonth
                                                        ? 'text-slate-300'
                                                        : item.isToday
                                                        ? 'bg-indigo-600 text-white font-black shadow-sm shadow-indigo-600/20'
                                                        : 'text-slate-700 hover:bg-slate-200/50'
                                                }`}
                                            >
                                                {item.day}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Evento abajo */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/20 border border-indigo-100/40 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex flex-col items-center justify-center shrink-0 font-black">
                                            <span className="text-[11px] leading-none">21</span>
                                            <span className="text-[7.5px] uppercase leading-none mt-0.5">JUL</span>
                                        </div>
                                        <div className="leading-tight text-left">
                                            <h6 className="text-xs font-black text-slate-800">Reunión de Consejo Académico</h6>
                                            <p className="text-[9px] text-slate-450 mt-0.5">8:00 a.m. - Sala de Juntas</p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                        <Users size={14} />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Panel de Control Académico General */}
                    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
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
                                                    className="border border-gray-100 rounded-2xl p-4 hover:border-indigo-100 hover:bg-indigo-50/5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm bg-white"
                                                >
                                                    {/* Perfil del Estudiante */}
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100/50 flex items-center justify-center">
                                                            {student.photo_url ? (
                                                                <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-indigo-600 font-extrabold text-sm">{student.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-extrabold text-gray-800 leading-tight">
                                                                {student.lastName && student.firstName 
                                                                    ? `${student.lastName} ${student.firstName}` 
                                                                    : student.name}
                                                            </h4>
                                                            <span className="text-[10px] text-gray-400 font-mono font-medium block mt-0.5">{student.id_code}</span>
                                                        </div>
                                                    </div>

                                                    {/* Notas por Materia */}
                                                    <div className="flex-1 flex flex-wrap gap-2 md:justify-center">
                                                        {studentGrades.length === 0 ? (
                                                            <span className="text-[10px] text-gray-400 font-semibold italic bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                                                Sin notas registradas
                                                            </span>
                                                        ) : (
                                                            studentGrades.map(gradeDoc => {
                                                                const gradeValue = Number(gradeDoc.grade);
                                                                const isPassing = gradeValue >= 75;
                                                                return (
                                                                    <div 
                                                                        key={gradeDoc.id}
                                                                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all shadow-sm ${
                                                                            isPassing 
                                                                                ? 'bg-emerald-50/40 text-emerald-700 border-emerald-100/55' 
                                                                                : 'bg-rose-50/40 text-rose-700 border-rose-100/55'
                                                                        }`}
                                                                    >
                                                                        <span className="text-gray-400 font-medium">{gradeDoc.subject}:</span>
                                                                        <span className="font-extrabold">{gradeValue}</span>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>

                                                    {/* Acción de Boletín */}
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
        </>
    );
}
