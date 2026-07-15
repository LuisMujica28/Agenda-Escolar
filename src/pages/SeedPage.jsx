import { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { Loader2, Database, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const DECIMO_STUDENTS = [
    { firstName: "STEVEN", lastName: "ALVAREZ BARON", email: "salvarezb@inas.edu.co", id_code: "ST-1001-001" },
    { firstName: "SARA ISABELLA", lastName: "BULLA MOYANO", email: "sisabellabm@inas.edu.co", id_code: "ST-1001-002" },
    { firstName: "SANTIAGO", lastName: "CASTRO MOLINA", email: "scastro@inas.edu.co", id_code: "ST-1001-003" },
    { firstName: "LAURA ISABELLA", lastName: "CASTRO MORA", email: "lauracastro@inas.edu.co", id_code: "ST-1001-004" },
    { firstName: "NICOLAS", lastName: "CORTES GARCIA", email: "ncortes@inas.edu.co", id_code: "ST-1001-005" },
    { firstName: "MICHELLE STEFANY", lastName: "CRUZ NOVOA", email: "mscruz@inas.edu.co", id_code: "ST-1001-006" },
    { firstName: "DAVID FELIPE", lastName: "DIAZ ACOSTA", email: "dadiaza@inas.edu.co", id_code: "ST-1001-007" },
    { firstName: "AVRIL ANDREA", lastName: "FIGUERA MEDINA", email: "avrilf@inas.edu.co", id_code: "ST-1001-008" },
    { firstName: "JUAN DIEGO", lastName: "GUACHETA AGUDELO", email: "jdguacheta@inas.edu.co", id_code: "ST-1001-009" },
    { firstName: "JULIAN ANDRES", lastName: "INFANTE RAMIREZ", email: "jinfanter@inas.edu.co", id_code: "ST-1001-010" },
    { firstName: "SANTIAGO", lastName: "JAIMES NARVAEZ", email: "sjaimes@inas.edu.co", id_code: "ST-1001-011" },
    { firstName: "ESTEBAN", lastName: "JULIO HERNANDEZ", email: "estebanjulio@inas.edu.co", id_code: "ST-1001-012" },
    { firstName: "SAMUEL", lastName: "LINARES GOMEZ", email: "slinares@inas.edu.co", id_code: "ST-1001-013" },
    { firstName: "DANNA VALENTINA", lastName: "MAMANCHE DIAZ", email: "dannamamanche@inas.edu.co", id_code: "ST-1001-014" },
    { firstName: "JUAN ESTEBAN", lastName: "MARTINEZ GIL", email: "jemartinez@inas.edu.co", id_code: "ST-1001-015" },
    { firstName: "ISABELLA", lastName: "MENDOZA PARRADO", email: "imendoza@inas.edu.co", id_code: "ST-1001-016" },
    { firstName: "SARA VALENTINA", lastName: "MONROY TRIANA", email: "savamonroyt@inas.edu.co", id_code: "ST-1001-017" },
    { firstName: "JUAN SEBASTIAN", lastName: "MONTEALEGRE FERNANDEZ", email: "jsmontealegre@inas.edu.co", id_code: "ST-1001-018" },
    { firstName: "SANTIAGO", lastName: "MORENO BERMUDEZ", email: "smoreno@inas.edu.co", id_code: "ST-1001-019" },
    { firstName: "SAMUEL DAVID", lastName: "MORENO LIEVANO", email: "sdmoreno@inas.edu.co", id_code: "ST-1001-020" },
    { firstName: "SOFIA", lastName: "MOYA CORTES", email: "smoya@inas.edu.co", id_code: "ST-1001-021" },
    { firstName: "MARIA PAULA", lastName: "OLIVEROS SASTOQUE", email: "mpoliveross@inas.edu.co", id_code: "ST-1001-022" },
    { firstName: "JOAN MANUEL", lastName: "OVALLE RODRIGUEZ", email: "jmovalle@inas.edu.co", id_code: "ST-1001-023" },
    { firstName: "BRIAN ESTEBAN", lastName: "PINILLA MERCADO", email: "bepinilla@inas.edu.co", id_code: "ST-1001-024" },
    { firstName: "JAVIER SANTIAGO", lastName: "QUIÑONEZ ALFONSO", email: "jsquinonesal@inas.edu.co", id_code: "ST-1001-025" },
    { firstName: "ANGELA SOFIA", lastName: "REY VELASQUEZ", email: "areyvelasquez@inas.edu.co", id_code: "ST-1001-026" },
    { firstName: "VALENTINA", lastName: "RODRIGUEZ LOPEZ", email: "vrodriguez4@inas.edu.co", id_code: "ST-1001-027" },
    { firstName: "TOMAS FELIPE", lastName: "TOVAR NEIRA", email: "tfelipetn@inas.edu.co", id_code: "ST-1001-028" },
    { firstName: "MARIANNE JULIETA", lastName: "VACA ROJAS", email: "mjvaca@inas.edu.co", id_code: "ST-1001-029" },
    { firstName: "LINA MARIA", lastName: "VARGAS JOYA", email: "lmvargas@inas.edu.co", id_code: "ST-1001-030" },
    { firstName: "SOFIA ISABEL", lastName: "VELASQUEZ CENTENO", email: "sivelasquez@inas.edu.co", id_code: "ST-1001-031" },
    { firstName: "JUAN DAVID", lastName: "VELASQUEZ GONZALEZ", email: "jdavidvg@inas.edu.co", id_code: "ST-1001-032" },
    { firstName: "KAREN SOFIA", lastName: "VELASQUEZ MORENO", email: "ksvelasquezm@inas.edu.co", id_code: "ST-1001-033" },
    { firstName: "MARIANA", lastName: "YAYA ROMERO", email: "myayar@inas.edu.co", id_code: "ST-1001-034" },
];

const ONCE_STUDENTS = [
    { firstName: "DANA GABRIELA", lastName: "SEGURA CARDENAS", email: "dgsegura@inas.edu.co", id_code: "ST-1101-001" },
    { firstName: "DAVID ERNESTO", lastName: "CARRASCAL MEDINA", email: "dcarrascalm@inas.edu.co", id_code: "ST-1101-002" },
    { firstName: "DAVID SANTIAGO", lastName: "ROBAYO RODRIGUEZ", email: "dsrobayo@inas.edu.co", id_code: "ST-1101-003" },
    { firstName: "DIEGO ALEJANDRO", lastName: "LOZANO CASTAÑEDA", email: "dalozano@inas.edu.co", id_code: "ST-1101-004" },
    { firstName: "EDDY SANTIAGO", lastName: "OLIVEROS CARDENAS", email: "esoliveros@inas.edu.co", id_code: "ST-1101-005" },
    { firstName: "ISABELLA", lastName: "CORDOBA CASTILLO", email: "icordobac@inas.edu.co", id_code: "ST-1101-006" },
    { firstName: "ISABELLA", lastName: "GARCIA BELLO", email: "igarciab@inas.edu.co", id_code: "ST-1101-007" },
    { firstName: "ISABELLA", lastName: "LATORRE RIBON", email: "ilatorre@inas.edu.co", id_code: "ST-1101-008" },
    { firstName: "JOEL SANTIAGO", lastName: "ROMERO BETANCOURT", email: "jsantiagorb@inas.edu.co", id_code: "ST-1101-009" },
    { firstName: "JOHAN FELIPE", lastName: "ARANGO BECERRA", email: "jfarangob@inas.edu.co", id_code: "ST-1101-010" },
    { firstName: "JUAN JOSE", lastName: "SOLANO PARRADO", email: "jjsolanop@inas.edu.co", id_code: "ST-1101-011" },
    { firstName: "JULIANA", lastName: "CASTAÑEDA GARCIA", email: "jcastanedag@inas.edu.co", id_code: "ST-1101-012" },
    { firstName: "JULIANA", lastName: "MACANA BASTO", email: "julianamacana@inas.edu.co", id_code: "ST-1101-013" },
    { firstName: "KAREN SOFIA", lastName: "MATALLANA ROMERO", email: "ksmatallana@inas.edu.co", id_code: "ST-1101-014" },
    { firstName: "ANDRES FELIPE", lastName: "TEJEDOR CHAPARRO", email: "aftejedorc@inas.edu.co", id_code: "ST-1101-015" },
    { firstName: "KAROLL MICHELL", lastName: "SIERRA ORTEGA", email: "kmsierrao@inas.edu.co", id_code: "ST-1101-016" },
    { firstName: "KAROLL SAMANTA", lastName: "SUAREZ OVALLE", email: "karollsso@inas.edu.co", id_code: "ST-1101-017" },
    { firstName: "LUISA FERNANDA", lastName: "FORERO MELO", email: "lfforero@inas.edu.co", id_code: "ST-1101-018" },
    { firstName: "MANUELA VALERIA", lastName: "RODRIGUEZ GIL", email: "manuelamrg@inas.edu.co", id_code: "ST-1101-019" },
    { firstName: "MARIA ALEJANDRA", lastName: "SALCEDO SALGADO", email: "msalcedos@inas.edu.co", id_code: "ST-1101-020" },
    { firstName: "MARIA CAMILA", lastName: "BOGOYA SALAMANCA", email: "mcamilabs@inas.edu.co", id_code: "ST-1101-021" },
    { firstName: "NICOLAS SANTIAGO", lastName: "GOMEZ GUTIERREZ", email: "nsantiagog@inas.edu.co", id_code: "ST-1101-022" },
    { firstName: "NICOLLE ALEJANDRA", lastName: "ROZO BECERRA", email: "nalejandrarb@inas.edu.co", id_code: "ST-1101-023" },
    { firstName: "PAULA NICOL", lastName: "MOLINA MORENO", email: "pnmolina@inas.edu.co", id_code: "ST-1101-024" },
    { firstName: "PAULA SOFIA", lastName: "MENJURA ÑUSTES", email: "psmenjura@inas.edu.co", id_code: "ST-1101-025" },
    { firstName: "SAMUEL", lastName: "CARDENAS HERNANDEZ", email: "scardenas@inas.edu.co", id_code: "ST-1101-026" },
    { firstName: "SAMUEL DAVID", lastName: "ARAQUE MARTÍNEZ", email: "saraque@inas.edu.co", id_code: "ST-1101-027" },
    { firstName: "SANTIAGO", lastName: "PUENTES PUENTES", email: "spuentesp@inas.edu.co", id_code: "ST-1101-028" },
    { firstName: "SANTIAGO ANDRES", lastName: "VILLALOBOS YEPES", email: "sandresvy@inas.edu.co", id_code: "ST-1101-029" },
    { firstName: "SOFIA", lastName: "PINILLA CORDERO", email: "spinilla@inas.edu.co", id_code: "ST-1101-030" },
    { firstName: "VALERIA ANDREA", lastName: "MONTENEGRO PAEZ", email: "vandreamp@inas.edu.co", id_code: "ST-1101-031" },
];

export default function SeedPage() {
    const [status, setStatus] = useState('idle'); // idle, seeding, success, error
    const [logs, setLogs] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const navigate = useNavigate();

    const addLog = (msg) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    async function handleSeed() {
        setStatus('seeding');
        setLogs([]);
        setErrorMessage('');
        setProgress({ current: 0, total: DECIMO_STUDENTS.length + ONCE_STUDENTS.length + 3 }); // Total 1001 y 1101 + base
        addLog('Iniciando proceso de importación institucional...');

        try {
            // CLEANUP: Eliminar alumnos de grado '10A' y sus relaciones para evitar duplicados
            addLog('Limpiando registros antiguos del grado 10A...');
            const q10A = query(collection(db, 'students'), where('grade', '==', '10A'));
            const snap10A = await getDocs(q10A);
            for (const doc10A of snap10A.docs) {
                await deleteDoc(doc(db, 'students', doc10A.id));
                addLog(`Eliminado alumno duplicado 10A: ${doc10A.data().name}`);
                
                // Eliminar notas
                const qGrades10A = query(collection(db, 'grades'), where('student_id', '==', doc10A.id));
                const snapGrades = await getDocs(qGrades10A);
                for (const gDoc of snapGrades.docs) {
                    await deleteDoc(doc(db, 'grades', gDoc.id));
                }

                // Eliminar asistencia
                const qAttendance = query(collection(db, 'attendance'), where('student_id', '==', doc10A.id));
                const snapAtt = await getDocs(qAttendance);
                for (const aDoc of snapAtt.docs) {
                    await deleteDoc(doc(db, 'attendance', aDoc.id));
                }
                
                // Eliminar observador
                const qObserver = query(collection(db, 'observer'), where('student_id', '==', doc10A.id));
                const snapObs = await getDocs(qObserver);
                for (const oDoc of snapObs.docs) {
                    await deleteDoc(doc(db, 'observer', oDoc.id));
                }
            }

            // CLEANUP: Eliminar cuentas de padres obsoletas (ej: @colegio.com) para evitar duplicados en destinatarios
            addLog('Limpiando cuentas de padres obsoletas de la base de datos...');
            const qUsers = query(collection(db, 'users'));
            const snapUsers = await getDocs(qUsers);
            for (const uDoc of snapUsers.docs) {
                const email = uDoc.data().email || '';
                if (email.endsWith('@colegio.com') && 
                    email !== 'admin@colegio.com' && 
                    email !== 'profe@colegio.com' && 
                    email !== 'padre@colegio.com') {
                    await deleteDoc(doc(db, 'users', uDoc.id));
                    addLog(`Eliminado usuario obsoleto: ${email}`);
                }
            }

            // Helper para crear u obtener usuario y asignarle rol
            async function getOrCreateUser(email, password, role, name) {
                let uid;
                try {
                    const credential = await createUserWithEmailAndPassword(auth, email, password);
                    uid = credential.user.uid;
                } catch (error) {
                    if (error.code === 'auth/email-already-in-use') {
                        const credential = await signInWithEmailAndPassword(auth, email, password);
                        uid = credential.user.uid;
                    } else {
                        throw error;
                    }
                }

                // Guardar en la colección 'users' de Firestore
                await setDoc(doc(db, 'users', uid), {
                    email,
                    role,
                    name,
                    created_at: new Date()
                });
                
                // Desconectar al usuario para que no interfiera con los siguientes
                await signOut(auth);
                return uid;
            }

            // 1. Crear usuarios base de prueba
            addLog('Creando cuentas de sistema básicas (Admin y Profesor)...');
            const adminUid = await getOrCreateUser('admin@colegio.com', 'colegio123', 'admin', 'Administrador Agenda');
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            
            const teacherUid = await getOrCreateUser('profe@colegio.com', 'colegio123', 'teacher', 'Profesor Martínez');
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));

            const parentUid = await getOrCreateUser('padre@colegio.com', 'colegio123', 'parent', 'Padre de Familia');
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));

            // 2. Crear alumnos base (Juanito y Maria)
            addLog('Configurando alumnos de prueba...');
            const studentsRef = collection(db, 'students');
            const existingStudents = await getDocs(studentsRef);
            if (existingStudents.empty) {
                await addDoc(studentsRef, {
                    name: 'Juanito Pérez',
                    firstName: 'Juanito',
                    lastName: 'Pérez',
                    grade: '901',
                    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juanito',
                    parent_uids: [parentUid],
                    id_code: 'ST-2026-001'
                });

                await addDoc(studentsRef, {
                    name: 'María García',
                    firstName: 'María',
                    lastName: 'García',
                    grade: '1001',
                    photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
                    parent_uids: [], 
                    id_code: 'ST-2026-002'
                });
            }

            // 2.5 Crear cursos oficiales de bachillerato en Firebase
            addLog('Inicializando cursos oficiales de Bachillerato...');
            const officialCourses = ['601', '602', '701', '801', '802', '901', '1001', '1101'];
            for (const courseId of officialCourses) {
                await setDoc(doc(db, 'courses', courseId), {
                    created_at: new Date()
                }, { merge: true });
            }
            addLog('Cursos oficiales de Bachillerato inicializados.');

            // 3. Crear Estudiantes y Cuentas de Padres en Bucle Asíncrono
            const gradesToSeed = [
                { students: DECIMO_STUDENTS, gradeName: '1001' },
                { students: ONCE_STUDENTS, gradeName: '1101' }
            ];

            for (const gradeGroup of gradesToSeed) {
                addLog(`Iniciando importación masiva de estudiantes de Grado ${gradeGroup.gradeName}...`);
                for (let i = 0; i < gradeGroup.students.length; i++) {
                    const item = gradeGroup.students[i];
                    const fullName = `${item.firstName} ${item.lastName}`;
                    addLog(`[${i+1}/${gradeGroup.students.length}] Registrando a ${fullName} (${gradeGroup.gradeName})...`);
                    try {
                        // a. Crear cuenta de padre
                        const parentId = await getOrCreateUser(item.email, 'colegio123', 'parent', `Acudiente de ${fullName}`);
                        
                        // b. Verificar si el estudiante ya está creado
                        const qStudent = query(studentsRef, where('id_code', '==', item.id_code));
                        const sSnap = await getDocs(qStudent);
                        
                        let sDocId;
                        if (sSnap.empty) {
                            const avatarSeed = item.firstName;
                            const sDoc = await addDoc(studentsRef, {
                                name: fullName,
                                firstName: item.firstName,
                                lastName: item.lastName,
                                grade: gradeGroup.gradeName,
                                photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
                                parent_uids: [parentId],
                                id_code: item.id_code
                            });
                            sDocId = sDoc.id;
                        } else {
                            sDocId = sSnap.docs[0].id;
                            // Actualizar vinculación de padre y apellidos por si acaso
                            await setDoc(doc(db, 'students', sDocId), { 
                                parent_uids: [parentId], 
                                grade: gradeGroup.gradeName,
                                firstName: item.firstName,
                                lastName: item.lastName
                            }, { merge: true });
                        }

                        // c. Añadir una calificación y asistencia inicial a cada alumno para que no esté vacío
                        const gradesRef = collection(db, 'grades');
                        const qGrades = query(gradesRef, where('student_id', '==', sDocId));
                        const gSnap = await getDocs(qGrades);
                        if (gSnap.empty) {
                            const actitudinal = Math.floor(Math.random() * (20 - 13 + 1)) + 13;
                            const prueba1 = Math.floor(Math.random() * (20 - 12 + 1)) + 12;
                            const ejercitacion = Math.floor(Math.random() * (20 - 13 + 1)) + 13;
                            const prueba2 = Math.floor(Math.random() * (20 - 12 + 1)) + 12;
                            const guia = Math.floor(Math.random() * (20 - 13 + 1)) + 13;
                            const sum = actitudinal + prueba1 + ejercitacion + prueba2 + guia;

                            await addDoc(gradesRef, {
                                student_id: sDocId,
                                teacher_id: teacherUid,
                                subject: 'Español y Literatura',
                                grade: sum,
                                components: {
                                    actitudinal,
                                    prueba1,
                                    ejercitacion,
                                    prueba2,
                                    guia
                                },
                                period: 1,
                                comment: 'Buen inicio de periodo académico.',
                                created_at: new Date()
                            });
                        }

                        const attendanceRef = collection(db, 'attendance');
                        const qAtt = query(attendanceRef, where('student_id', '==', sDocId));
                        const aSnap = await getDocs(qAtt);
                        if (aSnap.empty) {
                            await addDoc(attendanceRef, {
                                student_id: sDocId,
                                teacher_id: teacherUid,
                                status: 'PRESENT',
                                excuse_note: '',
                                date: new Date(),
                                created_at: new Date()
                            });
                        }

                    } catch (err) {
                        addLog(`⚠️ Error al registrar estudiante ${item.name}: ${err.message}`);
                    }
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                }
            }

            // 4. Crear Circulares de Prueba
            addLog('Configurando comunicados de rectoría...');
            const circularsRef = collection(db, 'circulars');
            const existingCirculars = await getDocs(circularsRef);
            if (existingCirculars.empty) {
                await addDoc(circularsRef, {
                    title: 'Reunión de Padres - Grado 1001',
                    body: 'Estimados acudientes del grado 1001, les invitamos a la primera reunión informativa del año este viernes a las 7:00 AM en sus respectivos salones de clase.',
                    priority: 'HIGH',
                    created_at: new Date(),
                    author_id: adminUid,
                    requires_acknowledgment: true,
                    audience: 'ALL',
                    read_by: []
                });
            }

            // 5. Tareas de Prueba
            addLog('Creando tareas académicas de prueba...');
            const tasksRef = collection(db, 'tasks');
            
            // Tarea para 1001
            const qTasks1001 = query(tasksRef, where('class_grade', '==', '1001'));
            const t1001Snap = await getDocs(qTasks1001);
            if (t1001Snap.empty) {
                await addDoc(tasksRef, {
                    title: 'Ensayo Crítico sobre la Literatura Clásica',
                    subject: 'Español y Literatura',
                    description: 'Escribir un ensayo de 3 páginas analizando la influencia de la mitología griega en la tragedia de Antígona.',
                    due_date: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
                    class_grade: '1001',
                    teacher_id: teacherUid,
                    created_at: new Date()
                });
            }

            // Tarea para 1101
            const qTasks1101 = query(tasksRef, where('class_grade', '==', '1101'));
            const t1101Snap = await getDocs(qTasks1101);
            if (t1101Snap.empty) {
                await addDoc(tasksRef, {
                    title: 'Taller Evaluativo de Límites Matemáticos',
                    subject: 'Matemáticas',
                    description: 'Desarrollar los 15 ejercicios propuestos de límites indeterminados de la guía cargada en plataforma.',
                    due_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
                    class_grade: '1101',
                    teacher_id: teacherUid,
                    created_at: new Date()
                });
            }

            addLog('¡Base de datos, grado 1001 y grado 1101 inicializados correctamente!');
            setStatus('success');
        } catch (error) {
            console.error(error);
            addLog(`Error fatal: ${error.message}`);
            setErrorMessage(error.message);
            setStatus('error');
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <Database className="text-primary animate-pulse" size={36} />
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                            Inicializar Base de Datos <Sparkles size={20} className="text-yellow-500" />
                        </h1>
                        <p className="text-sm text-gray-500">Carga del listado oficial del curso 1001 en Firebase</p>
                    </div>
                </div>

                {status === 'idle' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 text-sm leading-relaxed">
                            <p className="font-bold mb-1">Carga Masiva de 1001:</p>
                            Se registrarán **34 estudiantes** oficiales del curso 1001 y se crearán cuentas de acceso para sus padres/acudientes usando sus correos institucionales:
                            <div className="bg-white/70 p-2 rounded font-mono text-xs mt-2 border border-blue-100">
                                <strong>Usuario:</strong> correo institucional del listado (ej: salvarezb@inas.edu.co)<br/>
                                <strong>Contraseña por defecto:</strong> colegio123
                            </div>
                        </div>
                        <button
                            onClick={handleSeed}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm shadow-md"
                        >
                            Comenzar Importación de Alumnos y Padres
                        </button>
                    </div>
                )}

                {status === 'seeding' && (
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm font-semibold text-gray-600 mb-1">
                            <span>Registrando usuarios en Firebase...</span>
                            <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                            <div 
                                className="bg-primary h-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <div className="flex items-center justify-center gap-3 py-2 text-primary font-medium text-sm animate-pulse">
                            <Loader2 className="animate-spin" /> Esto puede tomar unos 20 segundos. Por favor no cierres la ventana.
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-6">
                        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">¡Carga Masiva Exitosa!</p>
                                <p className="text-sm">Se han importado los 34 estudiantes de 1001 y sus respectivos accesos de acudientes en Firebase.</p>
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Cuentas de Padres Listas para Probar:</h3>
                            <div className="border rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-inner text-xs">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b sticky top-0">
                                            <th className="p-2.5 font-bold text-gray-600">Alumno (1001)</th>
                                            <th className="p-2.5 font-bold text-gray-600">Usuario de Padre</th>
                                            <th className="p-2.5 font-bold text-gray-600">Contraseña</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {DECIMO_STUDENTS.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="p-2.5 font-medium text-gray-800">{item.name}</td>
                                                <td className="p-2.5 text-gray-600 font-mono select-all bg-gray-50/50">{item.email}</td>
                                                <td className="p-2.5 text-gray-500 font-mono">colegio123</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm shadow"
                        >
                            Ir al Inicio de Sesión <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Error al sembrar la base de datos</p>
                            <p className="text-sm whitespace-pre-wrap">{errorMessage}</p>
                        </div>
                    </div>
                )}

                {/* Log de Consola en Pantalla */}
                {logs.length > 0 && (
                    <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden bg-gray-900 text-gray-300 p-4 font-mono text-[10px] max-h-48 overflow-y-auto space-y-1">
                        <p className="text-gray-500 font-bold mb-2 border-b border-gray-800 pb-1">BITÁCORA DE CARGA MASIVA:</p>
                        {logs.map((log, i) => (
                            <p key={i}>{log}</p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
