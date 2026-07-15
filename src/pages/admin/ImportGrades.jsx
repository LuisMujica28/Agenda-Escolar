import { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ImportGrades() {
    const [fileData, setFileData] = useState([]);
    const [fileName, setFileName] = useState('');
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

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = parseCSV(text);

                // Validar columnas requeridas
                const requiredColumns = [
                    'codigo_estudiante', 'materia', 'periodo', 
                    'actitudinal', 'prueba_1', 'ejercitacion', 'prueba_2', 'guia'
                ];
                const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
                const missing = requiredColumns.filter(col => !rowKeys.includes(col));

                if (missing.length > 0) {
                    throw new Error(`Faltan columnas requeridas en el CSV: ${missing.join(', ')}. Recuerde usar exactamente estos encabezados.`);
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
        addLog(`Iniciando importación de calificaciones para ${fileData.length} registros...`);

        try {
            const studentsRef = collection(db, 'students');
            const gradesRef = collection(db, 'grades');

            for (let i = 0; i < fileData.length; i++) {
                const row = fileData[i];
                addLog(`[${i + 1}/${fileData.length}] Procesando: Alumno ${row.codigo_estudiante} - Materia: ${row.materia}...`);

                try {
                    // 1. Buscar el estudiante por su código
                    const qStudent = query(studentsRef, where('id_code', '==', row.codigo_estudiante));
                    const sSnap = await getDocs(qStudent);

                    if (sSnap.empty) {
                        addLog(`⚠️ Alumno no encontrado con código: ${row.codigo_estudiante}. Omitiendo registro.`);
                        setProgress(prev => ({ ...prev, current: i + 1 }));
                        continue;
                    }

                    const studentDoc = sSnap.docs[0];
                    const studentId = studentDoc.id;
                    const studentName = studentDoc.data().name;

                    // 2. Extraer notas y calcular total
                    const actitudinal = Number(row.actitudinal) || 0;
                    const prueba1 = Number(row.prueba_1) || 0;
                    const ejercitacion = Number(row.ejercitacion) || 0;
                    const prueba2 = Number(row.prueba_2) || 0;
                    const guia = Number(row.guia) || 0;
                    
                    const sum = actitudinal + prueba1 + ejercitacion + prueba2 + guia;
                    const periodNum = Number(row.periodo) || 1;

                    // 3. Comprobar si ya existe calificación para esta materia, periodo y alumno
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
                        addLog(`✅ Registrada nota de ${studentName} (${row.materia}): Total ${sum} puntos.`);
                    } else {
                        const gradeDocId = gSnap.docs[0].id;
                        await setDoc(doc(db, 'grades', gradeDocId), gradeData, { merge: true });
                        addLog(`🔄 Actualizada nota de ${studentName} (${row.materia}): Total ${sum} puntos.`);
                    }

                } catch (rowError) {
                    addLog(`⚠️ Error en fila ${i + 1}: ${rowError.message}`);
                }
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            addLog('¡Importación de calificaciones completada con éxito!');
            setStatus('success');
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
            setStatus('error');
            addLog(`Error crítico: ${error.message}`);
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <BookOpen size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Importación Masiva de Calificaciones</h2>
                        <p className="text-xs text-gray-500">Sube las notas desglosadas por componentes desde una hoja de cálculo</p>
                    </div>
                </div>

                {/* Explicación del Formato */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
                    <p className="font-bold text-slate-700">Formato del Archivo CSV:</p>
                    <p>El archivo debe guardarse en formato **CSV** delimitado por comas y contener exactamente estos encabezados en la primera fila (con notas de 0 a 20 puntos por componente):</p>
                    <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono mt-2 overflow-x-auto text-[10px]">
                        codigo_estudiante, materia, periodo, prueba_1, prueba_2, guia, ejercitacion, actitudinal, comentario<br/>
                        ST-1001-001, Matemáticas, 1, 15, 16, 18, 17, 18, Excelente desempeño.<br/>
                        ST-1001-002, Matemáticas, 1, 18, 17, 20, 19, 19, Felicitaciones por tu esfuerzo.
                    </div>
                </div>

                {/* Controles de Carga */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Seleccionar Archivo</span>
                        <label className="border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50/50 transition">
                            <Upload size={18} className="text-gray-400" />
                            <span className="text-xs text-gray-600 font-semibold">{fileName ? fileName : 'Seleccionar archivo CSV...'}</span>
                            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>
                </div>

                {status === 'loaded' && (
                    <div className="space-y-4">
                        <div className="bg-indigo-50/40 border border-indigo-100/50 text-indigo-900 rounded-2xl p-4 flex items-center justify-between text-xs">
                            <span>Se detectaron <strong>{fileData.length} registros</strong> de calificaciones listos para procesar.</span>
                            <button
                                onClick={handleImport}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition"
                            >
                                Iniciar Carga Masiva
                            </button>
                        </div>

                        {/* Previsualización */}
                        <div>
                            <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Vista Previa de Notas:</h3>
                            <div className="border rounded-2xl overflow-hidden max-h-60 overflow-y-auto text-[11px] shadow-sm bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b sticky top-0 font-bold text-slate-600">
                                            <th className="p-2.5">Código Estudiante</th>
                                            <th className="p-2.5">Materia</th>
                                            <th className="p-2.5">Periodo</th>
                                            <th className="p-2.5">Prueba 1</th>
                                            <th className="p-2.5">Prueba 2</th>
                                            <th className="p-2.5">Guía</th>
                                            <th className="p-2.5">Ejercitación</th>
                                            <th className="p-2.5">Actitudinal</th>
                                            <th className="p-2.5">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {fileData.map((row, i) => {
                                            const total = (Number(row.actitudinal) || 0) + 
                                                          (Number(row.prueba_1) || 0) + 
                                                          (Number(row.ejercitacion) || 0) + 
                                                          (Number(row.prueba_2) || 0) + 
                                                          (Number(row.guia) || 0);
                                            return (
                                                <tr key={i} className="hover:bg-slate-50/50">
                                                    <td className="p-2.5 font-mono text-gray-500">{row.codigo_estudiante}</td>
                                                    <td className="p-2.5 font-bold text-gray-800">{row.materia}</td>
                                                    <td className="p-2.5 text-gray-600">{row.periodo}</td>
                                                    <td className="p-2.5 text-gray-600">{row.prueba_1}</td>
                                                    <td className="p-2.5 text-gray-600">{row.prueba_2}</td>
                                                    <td className="p-2.5 text-gray-600">{row.guia}</td>
                                                    <td className="p-2.5 text-gray-600">{row.ejercitacion}</td>
                                                    <td className="p-2.5 text-gray-600">{row.actitudinal}</td>
                                                    <td className="p-2.5 font-extrabold text-indigo-600 bg-indigo-50/10">{total}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'importing' && (
                    <div className="space-y-4 bg-slate-50 p-5 border rounded-2xl">
                        <div className="flex justify-between text-xs font-semibold text-gray-600">
                            <span>Escribiendo registros en la base de datos...</span>
                            <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-indigo-600 h-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs animate-pulse">
                            <Loader2 className="animate-spin" size={16} /> Procesando registros en Firebase. Por favor espera.
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-4 flex items-start gap-3">
                            <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">¡Carga de Notas Exitosa!</p>
                                <p className="text-sm">Se han importado todas las calificaciones desglosadas al boletín escolar digital.</p>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm shadow"
                        >
                            Ir al Tablero Principal <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Error en la validación o carga</p>
                            <p className="text-xs">{errorMessage}</p>
                        </div>
                    </div>
                )}

                {/* Bitácora de Carga */}
                {logs.length > 0 && (
                    <div className="mt-4 border border-gray-150 rounded-2xl overflow-hidden bg-slate-900 text-slate-300 p-4 font-mono text-[9px] max-h-48 overflow-y-auto space-y-1">
                        <p className="text-slate-500 font-bold mb-2 border-b border-slate-800 pb-1 uppercase tracking-wider">Registro de Carga de Notas:</p>
                        {logs.map((log, i) => (
                            <p key={i}>{log}</p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
