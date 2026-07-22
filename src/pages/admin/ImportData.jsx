import { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, query, where, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, Table, BookOpen, Layers } from 'lucide-react';

export default function ImportData() {
    const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'grades'
    
    // Estados del Importador
    const [fileData, setFileData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [defaultPassword, setDefaultPassword] = useState('colegio2026');
    const [status, setStatus] = useState('idle'); // idle, loaded, importing, success, error
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [logs, setLogs] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');

    const addLog = (msg) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setFileData([]);
        setFileName('');
        setStatus('idle');
        setErrorMessage('');
        setLogs([]);
        setProgress({ current: 0, total: 0 });
    };

    // Parser manual de CSV robusto
    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0 || !lines[0].trim()) return [];

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
        setLogs([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = parseCSV(text);

                if (activeTab === 'courses') {
                    // Validar columnas para estudiantes
                    const requiredColumns = ['nombre', 'curso', 'codigo', 'email_padre', 'nombre_padre'];
                    const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
                    const missing = requiredColumns.filter(col => !rowKeys.includes(col));
                    if (missing.length > 0) {
                        throw new Error(`Faltan columnas en el CSV de Alumnos: ${missing.join(', ')}. Las columnas requeridas son: nombre, curso, codigo, email_padre, nombre_padre`);
                    }
                } else {
                    // Validar columnas para calificaciones
                    const requiredColumns = [
                        'codigo_estudiante', 'materia', 'periodo', 
                        'actitudinal', 'prueba_1', 'ejercitacion', 'prueba_2', 'guia'
                    ];
                    const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
                    const missing = requiredColumns.filter(col => !rowKeys.includes(col));
                    if (missing.length > 0) {
                        throw new Error(`Faltan columnas en el CSV de Notas: ${missing.join(', ')}. Las columnas requeridas son: codigo_estudiante, materia, periodo, actitudinal, prueba_1, ejercitacion, prueba_2, guia`);
                    }
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

    // Importación de alumnos y acudientes
    async function handleImportCourses() {
        if (fileData.length === 0) return;

        setStatus('importing');
        setLogs([]);
        setProgress({ current: 0, total: fileData.length });
        addLog(`Iniciando importación masiva de ${fileData.length} alumnos...`);

        try {
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
                addLog(`[${i + 1}/${fileData.length}] Procesando estudiante: ${row.nombre}...`);

                try {
                    const parentUid = await createParentUser(row.email_padre, defaultPassword, row.nombre_padre);

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
                        const docRef = await addDoc(studentsRef, {
                            name: row.nombre,
                            firstName: firstName.toUpperCase(),
                            lastName: lastName.toUpperCase(),
                            grade: row.curso,
                            id_code: row.codigo,
                            photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}`,
                            parent_uids: [parentUid]
                        });
                        studentId = docRef.id;
                        addLog(`Estudiante registrado: ${row.nombre} (Curso ${row.curso})`);
                    } else {
                        studentId = sSnap.docs[0].id;
                        await setDoc(doc(db, 'students', studentId), { 
                            parent_uids: [parentUid],
                            firstName: firstName.toUpperCase(),
                            lastName: lastName.toUpperCase()
                        }, { merge: true });
                        addLog(`Estudiante existente actualizado: ${row.nombre}`);
                    }

                    // Inicializar notas del estudiante
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

                    // Asegurar que el curso/grado exista en la colección de cursos
                    await setDoc(doc(db, 'courses', row.curso), { created_at: new Date() }, { merge: true });

                } catch (rowError) {
                    addLog(`⚠️ Error en fila ${i + 1} (${row.nombre}): ${rowError.message}`);
                }
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            addLog('¡Importación masiva de alumnos completada con éxito!');
            setStatus('success');
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
            setStatus('error');
            addLog(`Error crítico: ${error.message}`);
        }
    }

    // Importación de notas
    async function handleImportGrades() {
        if (fileData.length === 0) return;

        setStatus('importing');
        setLogs([]);
        setProgress({ current: 0, total: fileData.length });
        addLog(`Iniciando importación masiva de ${fileData.length} notas...`);

        try {
            const studentsRef = collection(db, 'students');
            const gradesRef = collection(db, 'grades');

            for (let i = 0; i < fileData.length; i++) {
                const row = fileData[i];
                addLog(`[${i + 1}/${fileData.length}] Procesando notas de: ${row.codigo_estudiante}...`);

                try {
                    const qStudent = query(studentsRef, where('id_code', '==', row.codigo_estudiante));
                    const sSnap = await getDocs(qStudent);

                    if (sSnap.empty) {
                        addLog(`⚠️ Estudiante no encontrado con código: ${row.codigo_estudiante}. Omitiendo.`);
                        setProgress(prev => ({ ...prev, current: i + 1 }));
                        continue;
                    }

                    const studentDoc = sSnap.docs[0];
                    const studentId = studentDoc.id;
                    const studentName = studentDoc.data().name;

                    const actitudinal = Number(row.actitudinal) || 0;
                    const prueba1 = Number(row.prueba_1) || 0;
                    const ejercitacion = Number(row.ejercitacion) || 0;
                    const prueba2 = Number(row.prueba_2) || 0;
                    const guia = Number(row.guia) || 0;
                    
                    const sum = actitudinal + prueba1 + ejercitacion + prueba2 + guia;
                    const periodNum = Number(row.periodo) || 1;

                    const qGrade = query(
                        gradesRef, 
                        where('student_id', '==', studentId),
                        where('subject', '==', row.materia),
                        where('period', '==', periodNum)
                    );
                    const gSnap = await getDocs(qGrade);

                    const gradeData = {
                        student_id: studentId,
                        teacher_id: auth.currentUser?.uid || 'system',
                        subject: row.materia,
                        grade: sum,
                        components: {
                            actitudinal,
                            prueba1,
                            ejercitacion,
                            prueba2,
                            guia
                        },
                        period: periodNum,
                        comment: row.comentario || '',
                        created_at: new Date()
                    };

                    if (gSnap.empty) {
                        await addDoc(gradesRef, gradeData);
                        addLog(`✅ Registrada nota para ${studentName} (${row.materia}): Total ${sum} puntos.`);
                    } else {
                        const gradeDocId = gSnap.docs[0].id;
                        await setDoc(doc(db, 'grades', gradeDocId), gradeData, { merge: true });
                        addLog(`🔄 Actualizada nota para ${studentName} (${row.materia}): Total ${sum} puntos.`);
                    }

                } catch (rowError) {
                    addLog(`⚠️ Error en fila ${i + 1}: ${rowError.message}`);
                }
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            addLog('¡Importación masiva de calificaciones completada con éxito!');
            setStatus('success');
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
            setStatus('error');
            addLog(`Error crítico: ${error.message}`);
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 mt-6 pb-12">
            
            {/* Cabecera */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-650 rounded-2xl flex items-center justify-center shrink-0">
                    <Layers size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-extrabold text-gray-800">Carga Masiva de Datos</h2>
                    <p className="text-xs text-gray-500 font-semibold leading-relaxed">Importa plantillas de cursos completos o listas de notas directamente desde Excel/CSV.</p>
                </div>
            </div>

            {/* Selector de Pestañas (Tabs) */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                    onClick={() => handleTabChange('courses')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl transition-all ${
                        activeTab === 'courses'
                            ? 'bg-white text-indigo-950 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Table size={15} /> Estudiantes y Cursos
                </button>
                <button
                    onClick={() => handleTabChange('grades')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl transition-all ${
                        activeTab === 'grades'
                            ? 'bg-white text-indigo-950 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <BookOpen size={15} /> Calificaciones y Notas
                </button>
            </div>

            {/* Contenedor Principal */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                
                {/* Explicación del Formato */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs text-slate-650 space-y-2">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-indigo-600" />
                        Estructura Requerida del Archivo CSV:
                    </p>
                    <p>Carga un archivo delimitado por comas (`.csv`). La primera línea debe contener exactamente estos encabezados:</p>
                    
                    {activeTab === 'courses' ? (
                        <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono mt-2 overflow-x-auto text-[10px] leading-relaxed">
                            nombre, curso, codigo, email_padre, nombre_padre<br/>
                            Juanito Perez, 10A, ST-1001, luisa@parent.com, Luisa Perez<br/>
                            Maria Garcia, 10B, ST-1002, pedro@parent.com, Pedro Garcia
                        </div>
                    ) : (
                        <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono mt-2 overflow-x-auto text-[10px] leading-relaxed">
                            codigo_estudiante, materia, periodo, prueba_1, prueba_2, guia, ejercitacion, actitudinal, comentario<br/>
                            ST-1001, Matemáticas, 1, 15, 14, 18, 16, 17, Muy buena participación.<br/>
                            ST-1002, Español, 1, 18, 19, 20, 18, 19, Felicitaciones.
                        </div>
                    )}
                </div>

                {/* Controles de Carga */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Seleccionar Plantilla CSV</span>
                        <label className="border border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50/50 hover:border-slate-350 transition active-press">
                            <Upload size={18} className="text-slate-400" />
                            <span className="text-xs text-slate-650 font-bold truncate max-w-[200px]">{fileName ? fileName : 'Seleccionar archivo CSV...'}</span>
                            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>

                    {activeTab === 'courses' && (
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Contraseña por defecto (Acudientes)</span>
                            <input
                                type="text"
                                value={defaultPassword}
                                onChange={e => setDefaultPassword(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-650 focus:bg-white transition"
                                placeholder="Escribe la clave de inicio de sesión..."
                            />
                        </div>
                    )}
                </div>

                {/* Errores */}
                {errorMessage && (
                    <div className="bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2.5 animate-shake">
                        <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Vista Previa */}
                {status === 'loaded' && fileData.length > 0 && (
                    <div className="space-y-4 pt-2">
                        
                        <div className="bg-indigo-50/40 border border-indigo-150 text-indigo-900 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
                            <span className="font-bold">Se cargaron {fileData.length} filas listas para importar.</span>
                            <button
                                onClick={activeTab === 'courses' ? handleImportCourses : handleImportGrades}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition active-press select-none"
                            >
                                Iniciar Procesamiento Masivo
                            </button>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vista Previa de Filas:</h3>
                            <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-60 shadow-sm bg-white">
                                <table className="w-full text-left border-collapse text-[10.5px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b sticky top-0 font-extrabold text-slate-600 select-none">
                                            {activeTab === 'courses' ? (
                                                <>
                                                    <th className="p-3">Nombre Estudiante</th>
                                                    <th className="p-3">Curso</th>
                                                    <th className="p-3">Código</th>
                                                    <th className="p-3">Correo Acudiente</th>
                                                    <th className="p-3">Nombre Acudiente</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="p-3">Código Alumno</th>
                                                    <th className="p-3">Materia</th>
                                                    <th className="p-3">Periodo</th>
                                                    <th className="p-3">Prueba 1</th>
                                                    <th className="p-3">Prueba 2</th>
                                                    <th className="p-3">Ejercitación</th>
                                                    <th className="p-3">Guías</th>
                                                    <th className="p-3">Actitudinal</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                                        {fileData.slice(0, 10).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                {activeTab === 'courses' ? (
                                                    <>
                                                        <td className="p-3 whitespace-nowrap">{row.nombre}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.curso}</td>
                                                        <td className="p-3 whitespace-nowrap font-mono">{row.codigo}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.email_padre}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.nombre_padre}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-3 whitespace-nowrap font-mono">{row.codigo_estudiante}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.materia}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.periodo}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.prueba_1}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.prueba_2}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.ejercitacion}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.guia}</td>
                                                        <td className="p-3 whitespace-nowrap">{row.actitudinal}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {fileData.length > 10 && (
                                <p className="text-[10px] text-slate-400 italic text-right mt-1.5 pr-2">Mostrando las primeras 10 filas de {fileData.length} registros...</p>
                            )}
                        </div>

                    </div>
                )}

                {/* Progreso e Importación Activa */}
                {(status === 'importing' || status === 'success') && (
                    <div className="space-y-4 border-t pt-5">
                        
                        {/* Estado e Icono */}
                        <div className="flex items-center gap-3">
                            {status === 'importing' ? (
                                <Loader2 className="animate-spin text-indigo-650 shrink-0" size={24} />
                            ) : (
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
                            )}
                            <div>
                                <h4 className="text-sm font-extrabold text-gray-800">
                                    {status === 'importing' ? 'Cargando datos a la nube...' : '¡Importación finalizada!'}
                                </h4>
                                <p className="text-[11px] text-slate-450 font-bold mt-0.5">
                                    Procesados {progress.current} de {progress.total} registros ({Math.round((progress.current / progress.total) * 100)}%).
                                </p>
                            </div>
                        </div>

                        {/* Barra de Progreso */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                                className="bg-indigo-600 h-full transition-all duration-200" 
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>

                        {/* Logs de Procesamiento */}
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Registros del sistema:</span>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-[10px] text-slate-300 h-40 overflow-y-auto space-y-1 select-text">
                                {logs.map((log, index) => (
                                    <div key={index} className="leading-relaxed border-b border-white/5 pb-1 last:border-b-0">{log}</div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}

            </div>

        </div>
    );
}
