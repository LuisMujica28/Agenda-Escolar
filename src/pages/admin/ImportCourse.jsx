import { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, Table } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ImportCourse() {
    const [fileData, setFileData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [defaultPassword, setDefaultPassword] = useState('colegio2026');
    const [status, setStatus] = useState('idle'); // idle, loaded, importing, success, error
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [logs, setLogs] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const addLog = (msg) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    // Parser manual robusto de CSV
    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0 || !lines[0].trim()) return [];

        // Leer encabezados y normalizarlos (quitar tildes, minúsculas, espacios)
        const normalize = (str) => str.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/_+/g, "_")
            .trim();

        const headers = lines[0].split(/[;,]/).map(h => normalize(h.trim()));
        
        const parsedRows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Dividir por comas o punto y coma respetando comillas
            const values = [];
            let inQuotes = false;
            let currentValue = '';

            for (let charIdx = 0; charIdx < line.length; charIdx++) {
                const char = line[charIdx];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if ((char === ',' || char === ';') && !inQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue.trim());

            // Crear objeto mapeado por encabezados
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });
            parsedRows.push(row);
        }
        return parsedRows;
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        setStatus('idle');
        setFileData([]);
        setErrorMessage('');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = parseCSV(text);

                // Validar columnas mínimas requeridas
                const requiredColumns = ['nombre', 'curso', 'codigo', 'email_padre', 'nombre_padre'];
                const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
                const missing = requiredColumns.filter(col => !rowKeys.includes(col));

                if (missing.length > 0) {
                    throw new Error(`Faltan columnas requeridas en el CSV: ${missing.join(', ')}. Las columnas válidas deben ser: nombre, curso, codigo, email_padre, nombre_padre`);
                }

                setFileData(rows);
                setStatus('loaded');
            } catch (err) {
                console.error(err);
                setErrorMessage(err.message);
                setStatus('error');
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    async function handleImport() {
        if (fileData.length === 0) return;

        setStatus('importing');
        setLogs([]);
        setProgress({ current: 0, total: fileData.length });
        addLog(`Iniciando importación masiva de ${fileData.length} registros...`);

        try {
            // Helper para crear cuenta de acudiente
            async function createParentUser(email, password, name) {
                let uid;
                try {
                    const credential = await createUserWithEmailAndPassword(auth, email, password);
                    uid = credential.user.uid;
                    addLog(`Cuenta creada: ${email}. UID: ${uid}`);
                } catch (error) {
                    if (error.code === 'auth/email-already-in-use') {
                        addLog(`La cuenta ya existe para: ${email}. Vinculando...`);
                        const credential = await signInWithEmailAndPassword(auth, email, password);
                        uid = credential.user.uid;
                    } else {
                        throw error;
                    }
                }

                // Guardar perfil de usuario
                await setDoc(doc(db, 'users', uid), {
                    email,
                    role: 'parent',
                    name,
                    created_at: new Date()
                });

                await signOut(auth);
                return uid;
            }

            const studentsRef = collection(db, 'students');

            for (let i = 0; i < fileData.length; i++) {
                const row = fileData[i];
                addLog(`[${i + 1}/${fileData.length}] Procesando: ${row.nombre}...`);

                try {
                    // 1. Crear el acudiente
                    const parentUid = await createParentUser(row.email_padre, defaultPassword, row.nombre_padre);

                    // 2. Comprobar si el alumno ya existe por su código
                    const qStudent = query(studentsRef, where('id_code', '==', row.codigo));
                    const sSnap = await getDocs(qStudent);

                    let studentId;
                    const words = row.nombre.trim().split(/\s+/);
                    let firstName = row.nombre;
                    let lastName = '';
                    if (words.length === 2) {
                        firstName = words[0];
                        lastName = words[1];
                    } else if (words.length >= 3) {
                        firstName = words.slice(0, -2).join(' ');
                        lastName = words.slice(-2).join(' ');
                    }

                    if (sSnap.empty) {
                        const avatarSeed = firstName;
                        const docRef = await addDoc(studentsRef, {
                            name: row.nombre,
                            firstName: firstName.toUpperCase(),
                            lastName: lastName.toUpperCase(),
                            grade: row.curso,
                            id_code: row.codigo,
                            photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
                            parent_uids: [parentUid]
                        });
                        studentId = docRef.id;
                        addLog(`Estudiante registrado: ${row.nombre} (Curso ${row.curso})`);
                    } else {
                        studentId = sSnap.docs[0].id;
                        // Asegurar vinculación del padre y apellidos
                        await setDoc(doc(db, 'students', studentId), { 
                            parent_uids: [parentUid],
                            firstName: firstName.toUpperCase(),
                            lastName: lastName.toUpperCase()
                        }, { merge: true });
                        addLog(`Estudiante ya existía, vinculación y nombres actualizados: ${row.nombre}`);
                    }

                    // 3. Crear asistencia y nota inicial (opcional para que no se vea vacío)
                    const gradesRef = collection(db, 'grades');
                    const qGrades = query(gradesRef, where('student_id', '==', studentId));
                    const gSnap = await getDocs(qGrades);
                    if (gSnap.empty) {
                        await addDoc(gradesRef, {
                            student_id: studentId,
                            teacher_id: auth.currentUser?.uid || 'system',
                            subject: 'Matemáticas',
                            grade: 4.0,
                            period: 1,
                            comment: 'Registro inicial del curso.',
                            created_at: new Date()
                        });
                    }

                    const attendanceRef = collection(db, 'attendance');
                    const qAtt = query(attendanceRef, where('student_id', '==', studentId));
                    const aSnap = await getDocs(qAtt);
                    if (aSnap.empty) {
                        await addDoc(attendanceRef, {
                            student_id: studentId,
                            teacher_id: auth.currentUser?.uid || 'system',
                            status: 'PRESENT',
                            excuse_note: '',
                            date: new Date(),
                            created_at: new Date()
                        });
                    }

                } catch (rowError) {
                    addLog(`⚠️ Error en fila ${i + 1} (${row.nombre}): ${rowError.message}`);
                }
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            addLog('¡Importación masiva completada con éxito!');
            setStatus('success');
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
            setStatus('error');
            addLog(`Error crítico: ${error.message}`);
        }
    }

    return (
        <div className="max-w-3xl mx-auto mt-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex items-center gap-3 border-b pb-4 mb-6">
                    <Table className="text-primary" size={28} />
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Importación Masiva de Alumnos</h2>
                        <p className="text-xs text-gray-500">Sube un archivo CSV desde Excel para registrar todo un curso sin escribir código</p>
                    </div>
                </div>

                {/* Explicación de Plantilla */}
                <div className="bg-gray-50 border rounded-xl p-4 mb-6 text-xs text-gray-600">
                    <p className="font-bold mb-2 text-gray-700">Formato del Archivo CSV:</p>
                    El archivo debe guardarse como **CSV delimitado por comas o punto y coma** y contener exactamente estos encabezados en la primera fila:
                    <div className="bg-gray-900 text-gray-300 p-3 rounded font-mono mt-2 overflow-x-auto">
                        nombre, curso, codigo, email_padre, nombre_padre<br/>
                        Carlos Lopez, 10A, ST-10-050, carlos.padre@test.com, Carlos Lopez Padre<br/>
                        Camila Gomez, 10A, ST-10-051, camila.madre@test.com, Maria Gomez Madre
                    </div>
                </div>

                {/* Controles de Carga */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div className="flex flex-col">
                            <label className="text-sm font-bold text-gray-700 mb-1">Contraseña por Defecto para los Padres</label>
                            <input
                                type="text"
                                value={defaultPassword}
                                onChange={e => setDefaultPassword(e.target.value)}
                                className="border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                                required
                            />
                        </div>
                        
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700 mb-1">Seleccionar Archivo</span>
                            <label className="border-2 border-dashed border-gray-300 rounded-xl p-2 flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition">
                                <Upload size={18} className="text-gray-400" />
                                <span className="text-xs text-gray-600 font-semibold">{fileName ? fileName : 'Seleccionar CSV...'}</span>
                                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {status === 'loaded' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex items-center justify-between text-xs">
                                <span>Se detectaron <strong>{fileData.length} estudiantes</strong> listos para importar.</span>
                                <button
                                    onClick={handleImport}
                                    className="bg-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition"
                                >
                                    Iniciar Importación
                                </button>
                            </div>

                            {/* Previsualización */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-2">Vista Previa de Datos:</h3>
                                <div className="border rounded-xl overflow-hidden max-h-60 overflow-y-auto text-[11px] shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b sticky top-0 font-bold text-gray-600">
                                                <th className="p-2">Código</th>
                                                <th className="p-2">Estudiante</th>
                                                <th className="p-2">Curso</th>
                                                <th className="p-2">Padre</th>
                                                <th className="p-2">Email Acudiente</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {fileData.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="p-2 font-mono text-gray-500">{row.codigo}</td>
                                                    <td className="p-2 font-bold text-gray-800">{row.nombre}</td>
                                                    <td className="p-2 text-gray-600">{row.curso}</td>
                                                    <td className="p-2 text-gray-600">{row.nombre_padre}</td>
                                                    <td className="p-2 text-gray-500">{row.email_padre}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'importing' && (
                        <div className="space-y-4 bg-gray-50 p-4 border rounded-xl">
                            <div className="flex justify-between text-xs font-semibold text-gray-600">
                                <span>Creando cuentas y registros en la base de datos...</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div 
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs animate-pulse">
                                <Loader2 className="animate-spin" size={16} /> Procesando registros en Firebase. Por favor espera.
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 flex items-start gap-3">
                                <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">¡Carga Masiva Exitosa!</p>
                                    <p className="text-sm">Se han cargado los estudiantes del archivo CSV. Los padres ya pueden entrar con los correos del listado y la contraseña <strong>{defaultPassword}</strong>.</p>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/')}
                                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm shadow"
                            >
                                Ir al Inicio <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Error en la validación o carga</p>
                                <p className="text-xs">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    {/* Bitácora en vivo */}
                    {logs.length > 0 && (
                        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-gray-900 text-gray-300 p-4 font-mono text-[10px] max-h-48 overflow-y-auto space-y-1">
                            <p className="text-gray-500 font-bold mb-2 border-b border-gray-800 pb-1">REGISTRO DE IMPORTACIÓN:</p>
                            {logs.map((log, i) => (
                                <p key={i}>{log}</p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
