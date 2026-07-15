import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, query, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, BookOpen, RefreshCw, AlertCircle, CheckCircle2, Download, Upload, Info, Table, FileSpreadsheet } from 'lucide-react';

export default function SyncGrades() {
    const { currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    // Filtros
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('Matemáticas');
    const [selectedPeriod, setSelectedPeriod] = useState('1');

    // Control de Pestañas (planilla: Planilla Web, csv: Importación CSV)
    const [activeTab, setActiveTab] = useState('planilla');

    // Datos de la planilla editable
    const [gridData, setGridData] = useState([]);
    const [loadingGrid, setLoadingGrid] = useState(false);
    const [savingGrid, setSavingGrid] = useState(false);

    // Estados del cargador de CSV
    const [fileText, setFileText] = useState('');
    const [fileName, setFileName] = useState('');
    const [syncingCSV, setSyncingCSV] = useState(false);
    const [csvLogs, setCsvLogs] = useState([]);
    const [csvStatus, setCsvStatus] = useState('idle'); // idle, loaded, success, error
    const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0 });
    const [csvErrorMessage, setCsvErrorMessage] = useState('');

    const subjects = [
        'Artes plásticas',
        'C. Naturales (Biología)',
        'C. Naturales (Física)',
        'C Naturales (Química)',
        'C Sociales Filosofía',
        'C Políticas Económicas',
        'Ed Ética y Valores',
        'Ed Física',
        'Ed Religiosa y Moral',
        'Tecnología e Informática',
        'Español y Literatura',
        'Inglés',
        'Matemáticas'
    ];

    const addCsvLog = (msg) => {
        setCsvLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    // Redirigir si no es profesor ni administrador
    useEffect(() => {
        if (userRole && userRole !== 'teacher' && userRole !== 'admin') {
            navigate('/');
        }
    }, [userRole, navigate]);

    // Cargar cursos
    useEffect(() => {
        async function loadCourses() {
            try {
                const cSnap = await getDocs(collection(db, 'courses'));
                let unique = [];
                if (!cSnap.empty) {
                    unique = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                } else {
                    const snap = await getDocs(collection(db, 'students'));
                    const list = snap.docs.map(d => d.data().grade).filter(Boolean);
                    unique = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                }
                setCourses(unique);
                if (unique.length > 0) {
                    setSelectedCourse(unique[0]);
                }
            } catch (e) {
                console.error("Error al cargar cursos:", e);
            }
        }
        loadCourses();
    }, []);

    // Cargar los alumnos del curso seleccionado y sus calificaciones de la base de datos
    useEffect(() => {
        if (!selectedCourse || !selectedSubject || !selectedPeriod) return;

        async function loadPlanilla() {
            setLoadingGrid(true);
            setGridData([]);
            setCsvStatus('idle');
            setFileName('');
            setFileText('');
            try {
                // 1. Cargar alumnos del curso
                const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
                const sSnap = await getDocs(qStudents);
                
                const studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
                    const nameA = a.lastName && a.firstName ? `${a.lastName} ${a.firstName}` : (a.name || '');
                    const nameB = b.lastName && b.firstName ? `${b.lastName} ${b.firstName}` : (b.name || '');
                    return nameA.localeCompare(nameB);
                });

                if (studentList.length === 0) {
                    setGridData([]);
                    setLoadingGrid(false);
                    return;
                }

                // 2. Cargar calificaciones existentes en Firestore
                const qGrades = query(
                    collection(db, 'grades'),
                    where('subject', '==', selectedSubject),
                    where('period', '==', Number(selectedPeriod))
                );
                const gSnap = await getDocs(qGrades);
                const gradesMap = {};
                gSnap.docs.forEach(doc => {
                    const gData = doc.data();
                    gradesMap[gData.student_id] = { docId: doc.id, ...gData };
                });

                // 3. Cruzar datos para armar la grilla (dejando en blanco si no tiene nota)
                const gridRows = studentList.map(student => {
                    const record = gradesMap[student.id];
                    const comp = record?.components || {};
                    
                    const p1 = comp.prueba1 !== undefined ? comp.prueba1 : '';
                    const p2 = comp.prueba2 !== undefined ? comp.prueba2 : '';
                    const guia = comp.guia !== undefined ? comp.guia : '';
                    const ejer = comp.ejercitacion !== undefined ? comp.ejercitacion : '';
                    const act = comp.actitudinal !== undefined ? comp.actitudinal : '';
                    
                    const p1Num = p1 === '' ? 0 : Number(p1);
                    const p2Num = p2 === '' ? 0 : Number(p2);
                    const guiaNum = guia === '' ? 0 : Number(guia);
                    const ejerNum = ejer === '' ? 0 : Number(ejer);
                    const actNum = act === '' ? 0 : Number(act);
                    const def = p1Num + p2Num + guiaNum + ejerNum + actNum;

                    return {
                        studentId: student.id,
                        name: student.lastName && student.firstName ? `${student.lastName} ${student.firstName}` : (student.name || ''),
                        id_code: student.id_code || 'S/C',
                        prueba1: p1,
                        prueba2: p2,
                        guia: guia,
                        ejercitacion: ejer,
                        actitudinal: act,
                        definitiva: def,
                        comment: record?.comment || '',
                        gradeDocId: record?.docId || null
                    };
                });

                setGridData(gridRows);
            } catch (err) {
                console.error("Error al cargar la planilla académica:", err);
            } finally {
                setLoadingGrid(false);
            }
        }

        loadPlanilla();
    }, [selectedCourse, selectedSubject, selectedPeriod]);

    // Validador de nota individual
    const isValidScore = (val) => {
        if (val === '' || val === undefined || val === null) return true;
        const num = Number(val);
        return !isNaN(num) && num >= 0 && num <= 20;
    };

    // Manejar cambios manuales en las celdas de la planilla web
    const handleCellChange = (studentId, field, value) => {
        setGridData(prev => prev.map(row => {
            if (row.studentId !== studentId) return row;

            const updatedRow = { ...row };
            if (field === 'comment') {
                updatedRow.comment = value;
            } else {
                if (value === '') {
                    updatedRow[field] = '';
                } else {
                    // Convertir a entero redondeado (restringido a enteros únicamente)
                    const parsed = Math.round(Number(value));
                    updatedRow[field] = isNaN(parsed) ? value : parsed;
                }
            }

            // Calcular definitiva tratando las celdas en blanco como 0 en la suma
            const p1 = updatedRow.prueba1 === '' ? 0 : Number(updatedRow.prueba1);
            const p2 = updatedRow.prueba2 === '' ? 0 : Number(updatedRow.prueba2);
            const guia = updatedRow.guia === '' ? 0 : Number(updatedRow.guia);
            const ejer = updatedRow.ejercitacion === '' ? 0 : Number(updatedRow.ejercitacion);
            const act = updatedRow.actitudinal === '' ? 0 : Number(updatedRow.actitudinal);
            
            const hasError = !isValidScore(updatedRow.prueba1) || 
                             !isValidScore(updatedRow.prueba2) || 
                             !isValidScore(updatedRow.guia) || 
                             !isValidScore(updatedRow.ejercitacion) || 
                             !isValidScore(updatedRow.actitudinal);

            updatedRow.definitiva = hasError ? 'Error' : (p1 + p2 + guia + ejer + act);
            return updatedRow;
        }));
    };

    // Navegación con teclado tipo Excel (Flechas direccionales y Enter)
    const handleKeyDown = (e, rowIndex, colIndex) => {
        const rowCount = gridData.length;
        const colCount = 6; // 0:prueba1, 1:prueba2, 2:guia, 3:ejercitacion, 4:actitudinal, 5:comment
        
        let targetRow = rowIndex;
        let targetCol = colIndex;

        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            targetRow = Math.min(rowCount - 1, rowIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            targetRow = Math.max(0, rowIndex - 1);
        } else if (e.key === 'ArrowRight') {
            // Mover a la derecha si está al final del texto o si es numérico
            if (colIndex < colCount - 1 && (e.target.type === 'number' || e.target.selectionEnd === e.target.value.length)) {
                targetCol = colIndex + 1;
            }
        } else if (e.key === 'ArrowLeft') {
            // Mover a la izquierda si está al inicio del texto o si es numérico
            if (colIndex > 0 && (e.target.type === 'number' || e.target.selectionStart === 0)) {
                targetCol = colIndex - 1;
            }
        } else {
            return; // No hacer nada con otras teclas
        }

        const targetId = `input-${targetRow}-${targetCol}`;
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.focus();
            // Auto-seleccionar texto para sobrescribir más rápido
            setTimeout(() => {
                if (targetElement.select) targetElement.select();
            }, 0);
        }
    };

    // Guardar los cambios de la planilla web en bloque (Batch Write)
    const handleSaveGrid = async () => {
        if (gridData.length === 0) return;

        // Validar que no haya ningún error antes de guardar
        const hasAnyError = gridData.some(row => 
            !isValidScore(row.prueba1) || 
            !isValidScore(row.prueba2) || 
            !isValidScore(row.guia) || 
            !isValidScore(row.ejercitacion) || 
            !isValidScore(row.actitudinal)
        );

        if (hasAnyError) {
            alert("No se puede guardar la planilla. Hay notas con valores inválidos (mayores a 20 o menores a 0). Por favor corrígelas.");
            return;
        }

        setSavingGrid(true);

        try {
            // MOCK MODE para usuarios fake
            if (currentUser.uid.startsWith('fake-')) {
                await new Promise(resolve => setTimeout(resolve, 1200));
                alert("Planilla guardada con éxito (Modo Simulación).");
                setSavingGrid(false);
                return;
            }

            const batch = writeBatch(db);
            const gradesRef = collection(db, 'grades');

            gridData.forEach(row => {
                let docRef;
                if (row.gradeDocId) {
                    docRef = doc(db, 'grades', row.gradeDocId);
                } else {
                    docRef = doc(gradesRef); // Generar ID automático para nuevas notas
                }

                batch.set(docRef, {
                    student_id: row.studentId,
                    teacher_id: currentUser.uid,
                    subject: selectedSubject,
                    period: Number(selectedPeriod),
                    grade: row.definitiva === 'Error' ? 0 : row.definitiva,
                    components: {
                        prueba1: row.prueba1 === '' ? 0 : Number(row.prueba1),
                        prueba2: row.prueba2 === '' ? 0 : Number(row.prueba2),
                        guia: row.guia === '' ? 0 : Number(row.guia),
                        ejercitacion: row.ejercitacion === '' ? 0 : Number(row.ejercitacion),
                        actitudinal: row.actitudinal === '' ? 0 : Number(row.actitudinal)
                    },
                    comment: row.comment,
                    created_at: new Date()
                }, { merge: true });
            });

            await batch.commit();
            alert("¡Planilla académica guardada exitosamente en el servidor!");

            // Recargar para obtener los IDs de documentos recién creados
            const qGrades = query(
                collection(db, 'grades'),
                where('subject', '==', selectedSubject),
                where('period', '==', Number(selectedPeriod))
            );
            const gSnap = await getDocs(qGrades);
            const gradesMap = {};
            gSnap.docs.forEach(doc => {
                gradesMap[doc.data().student_id] = doc.id;
            });

            setGridData(prev => prev.map(row => ({
                ...row,
                gradeDocId: gradesMap[row.studentId] || row.gradeDocId
            })));

        } catch (e) {
            console.error("Error al guardar planilla:", e);
            alert("Error al guardar la planilla: " + e.message);
        } finally {
            setSavingGrid(false);
        }
    };

    // Descargar plantilla dinámica con los nombres reales de los alumnos de ese curso
    const handleDownloadTemplate = async () => {
        if (!selectedCourse) return;
        setDownloadingTemplate(true);
        try {
            // Obtener estudiantes reales ordenados
            const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
            const sSnap = await getDocs(qStudents);
            
            const studentList = sSnap.docs.map(doc => doc.data()).sort((a, b) => {
                const nameA = a.lastName && a.firstName ? `${a.lastName} ${a.firstName}` : (a.name || '');
                const nameB = b.lastName && b.firstName ? `${b.lastName} ${b.firstName}` : (b.name || '');
                return nameA.localeCompare(nameB);
            });

            // Encabezados oficiales requeridos
            const headers = "nombre_estudiante,materia,periodo,prueba_1,prueba_2,guia,ejercitacion,actitudinal,comentario\n";
            let csvContent = headers;

            if (studentList.length > 0) {
                studentList.forEach(s => {
                    const formattedName = s.lastName && s.firstName ? `${s.lastName} ${s.firstName}` : (s.name || '');
                    csvContent += `"${formattedName.toUpperCase()}",${selectedSubject},${selectedPeriod},,,,,,\n`;
                });
            } else {
                csvContent += `"Steven Alvarez Baron",${selectedSubject},${selectedPeriod},,,,,,\n`;
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `Planilla_Notas_${selectedCourse}_${selectedSubject.replace(/\s+/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Error al generar plantilla:", e);
            alert("Error al descargar plantilla: " + e.message);
        } finally {
            setDownloadingTemplate(false);
        }
    };

    // Controlar el cambio de archivo CSV seleccionado
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        setCsvStatus('idle');
        setCsvErrorMessage('');
        setCsvLogs([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            setFileText(event.target.result);
            setCsvStatus('loaded');
        };
        reader.readAsText(file, 'UTF-8');
    };

    // Normalizador de nombres inteligente (independiente del orden de palabras, espacios o tildes)
    const normalizeName = (name) => {
        if (!name) return "";
        return name.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remover tildes
            .replace(/[^a-z0-9\s]/g, "")     // remover caracteres especiales
            .split(/\s+/)                    // dividir en palabras
            .filter(Boolean)                 // remover vacíos
            .sort()                          // ordenar palabras alfabéticamente
            .join("");                       // unir en un solo bloque
    };

    // Parser de CSV manual
    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0 || !lines[0].trim()) return [];

        const normalizeHeader = (str) => str.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/_+/g, "_")
            .trim();

        const headers = lines[0].split(/[;,]/).map(h => normalizeHeader(h.trim()));
        
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

    // Importar el archivo CSV y cargarlo en la cuadrícula editable en vivo
    const handleImportCSV = async () => {
        if (!fileText) return;

        setSyncingCSV(true);
        setCsvStatus('syncing');
        setCsvLogs([]);
        setCsvErrorMessage('');
        addCsvLog("Iniciando procesamiento del archivo cargado...");

        try {
            const rows = parseCSV(fileText);
            if (rows.length === 0) {
                throw new Error("El archivo está vacío o no tiene el formato correcto.");
            }

            // Validar columnas obligatorias
            const requiredColumns = [
                'nombre_estudiante', 'materia', 'periodo', 
                'prueba_1', 'prueba_2', 'guia', 'ejercitacion', 'actitudinal'
            ];
            const rowKeys = Object.keys(rows[0]);
            const missing = requiredColumns.filter(col => !rowKeys.includes(col));

            if (missing.length > 0) {
                throw new Error(`Columnas obligatorias faltantes en el archivo: ${missing.join(', ')}.`);
            }

            addCsvLog(`Detectados ${rows.length} registros en el archivo.`);
            setCsvProgress({ current: 0, total: rows.length });

            // Crear mapa de nombres normalizados de la cuadrícula actual
            const gridMap = {};
            gridData.forEach(row => {
                gridMap[normalizeName(row.name)] = row.studentId;
            });

            let updatedCount = 0;
            let errorCount = 0;

            const updatedGrid = gridData.map(row => ({ ...row }));

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const sheetStudentName = row.nombre_estudiante.trim();
                const subjectName = row.materia.trim();
                const periodNum = Number(row.periodo) || 1;

                addCsvLog(`[${i + 1}/${rows.length}] Cruzando alumno: "${sheetStudentName}"...`);

                // 1. Validar materia y periodo seleccionados
                if (subjectName.toUpperCase() !== selectedSubject.toUpperCase()) {
                    addCsvLog(`⚠️ Omitido: Materia '${subjectName}' no coincide con '${selectedSubject}'.`);
                    errorCount++;
                    setCsvProgress(prev => ({ ...prev, current: i + 1 }));
                    continue;
                }
                if (periodNum !== Number(selectedPeriod)) {
                    addCsvLog(`⚠️ Omitido: Periodo ${periodNum} no coincide con periodo activo ${selectedPeriod}.`);
                    errorCount++;
                    setCsvProgress(prev => ({ ...prev, current: i + 1 }));
                    continue;
                }

                // 2. Buscar por nombre normalizado
                const normName = normalizeName(sheetStudentName);
                const targetStudentId = gridMap[normName];

                if (!targetStudentId) {
                    addCsvLog(`❌ Omitido: El estudiante "${sheetStudentName}" no pertenece al curso ${selectedCourse}.`);
                    errorCount++;
                    setCsvProgress(prev => ({ ...prev, current: i + 1 }));
                    continue;
                }

                // 3. Extraer y validar notas (cada una sobre 20 pts)
                const limits = { prueba1: 20, prueba2: 20, guia: 20, ejercitacion: 20, actitudinal: 20 };
                const p1 = Math.min(limits.prueba1, Math.max(0, Number(row.prueba_1) || 0));
                const p2 = Math.min(limits.prueba2, Math.max(0, Number(row.prueba_2) || 0));
                const guia = Math.min(limits.guia, Math.max(0, Number(row.guia) || 0));
                const ejer = Math.min(limits.ejercitacion, Math.max(0, Number(row.ejercitacion) || 0));
                const act = Math.min(limits.actitudinal, Math.max(0, Number(row.actitudinal) || 0));
                const def = p1 + p2 + guia + ejer + act;

                // 4. Actualizar en el estado local de la grilla
                const idx = updatedGrid.findIndex(r => r.studentId === targetStudentId);
                if (idx !== -1) {
                    updatedGrid[idx].prueba1 = p1;
                    updatedGrid[idx].prueba2 = p2;
                    updatedGrid[idx].guia = guia;
                    updatedGrid[idx].ejercitacion = ejer;
                    updatedGrid[idx].actitudinal = act;
                    updatedGrid[idx].definitiva = def;
                    updatedGrid[idx].comment = row.comentario || '';
                    updatedCount++;
                    addCsvLog(`✅ Cruzado con éxito: ${updatedGrid[idx].name} -> Total ${def} pts.`);
                }

                setCsvProgress(prev => ({ ...prev, current: i + 1 }));
            }

            setGridData(updatedGrid);
            addCsvLog(`Proceso finalizado. Sincronizados: ${updatedCount} alumnos. Omitidos: ${errorCount}.`);
            addCsvLog(`💡 RECUERDA: Revisa las notas cargadas en la tabla y presiona el botón "Guardar Planilla" para consolidarlas en el servidor.`);
            setCsvStatus('success');

        } catch (error) {
            console.error(error);
            setCsvErrorMessage(error.message);
            setCsvStatus('error');
            addCsvLog(`❌ Error crítico: ${error.message}`);
        } finally {
            setSyncingCSV(false);
        }
    };

    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Encabezado */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <BookOpen className="text-indigo-600" size={24} /> Planilla Escolar de Calificaciones
                    </h2>
                    <p className="text-xs text-gray-400 font-semibold">Digita calificaciones directamente o impórtalas usando tus planillas de Excel/CSV.</p>
                </div>
                <button
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate || loadingGrid}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-100/50 disabled:opacity-50"
                >
                    {downloadingTemplate ? (
                        <><Loader2 className="animate-spin" size={14} /> Generando...</>
                    ) : (
                        <><Download size={14} /> Descargar Plantilla del Curso</>
                    )}
                </button>
            </div>

            {/* Filtros de Selección */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Curso / Grado</label>
                    <select
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/50 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                        value={selectedCourse}
                        onChange={e => setSelectedCourse(e.target.value)}
                        disabled={savingGrid || syncingCSV}
                    >
                        {courses.map(c => (
                            <option key={c} value={c}>Curso {c}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Materia / Asignatura</label>
                    <select
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/50 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                        value={selectedSubject}
                        onChange={e => setSelectedSubject(e.target.value)}
                        disabled={savingGrid || syncingCSV}
                    >
                        {subjects.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Periodo Académico</label>
                    <select
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/50 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                        value={selectedPeriod}
                        onChange={e => setSelectedPeriod(e.target.value)}
                        disabled={savingGrid || syncingCSV}
                    >
                        <option value="1">Periodo 1</option>
                        <option value="2">Periodo 2</option>
                        <option value="3">Periodo 3</option>
                        <option value="4">Periodo 4</option>
                    </select>
                </div>
            </div>

            {/* Pestañas de Alternancia */}
            <div className="flex border-b border-gray-100 gap-2">
                <button
                    onClick={() => setActiveTab('planilla')}
                    className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'planilla' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-gray-400 hover:text-gray-650'
                    }`}
                >
                    <Table size={14} /> Digitación Directa (Web)
                </button>
                <button
                    onClick={() => setActiveTab('csv')}
                    className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'csv' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-gray-400 hover:text-gray-650'
                    }`}
                >
                    <FileSpreadsheet size={14} /> Importar Archivo CSV
                </button>
            </div>

            {/* Contenido Dinámico */}
            {activeTab === 'planilla' ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-4 p-6">
                    <div className="flex justify-between items-center border-b pb-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <Table size={16} className="text-indigo-600" /> Planilla {selectedSubject} - Curso {selectedCourse}
                            </h3>
                            <p className="text-[10px] text-gray-400 font-semibold">Usa las cajas de texto para escribir y presiona "Guardar Planilla" al finalizar.</p>
                        </div>
                        {gridData.length > 0 && (
                            <button
                                onClick={handleSaveGrid}
                                disabled={savingGrid || loadingGrid}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {savingGrid ? (
                                    <><Loader2 className="animate-spin" size={14} /> Guardando...</>
                                ) : (
                                    'Guardar Planilla'
                                )}
                            </button>
                        )}
                    </div>

                    {loadingGrid ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="animate-spin text-indigo-600" size={32} />
                            <p className="text-xs font-semibold text-gray-400">Cargando alumnos de la base de datos...</p>
                        </div>
                    ) : gridData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                            <AlertCircle className="text-gray-300" size={40} />
                            <h4 className="text-xs font-bold text-gray-500">No hay alumnos en el curso</h4>
                            <p className="text-[10px] text-gray-400 max-w-xs font-semibold leading-normal">
                                Crea o traslada estudiantes al Curso {selectedCourse} en el panel de administrador para poder calificarlos.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Tabla Scrollable */}
                            <div className="overflow-x-auto border border-gray-150 rounded-2xl">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-gray-150 text-gray-400 font-extrabold text-[10px] uppercase tracking-wider">
                                            <th className="p-3 text-center w-12">No.</th>
                                            <th className="p-3">Nombre Estudiante</th>
                                            <th className="p-3 text-center w-24">Prueba 1 (20%)</th>
                                            <th className="p-3 text-center w-24">Prueba 2 (20%)</th>
                                            <th className="p-3 text-center w-24">Guía (20%)</th>
                                            <th className="p-3 text-center w-24">Ejercitación (20%)</th>
                                            <th className="p-3 text-center w-24">Actitudinal (20%)</th>
                                            <th className="p-3 text-center w-24 bg-indigo-50/20 text-indigo-600 font-black">Definitiva</th>
                                            <th className="p-3">Observaciones (Opcional)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-650">
                                        {gridData.map((row, idx) => {
                                            const isPassing = row.definitiva >= 75;
                                            return (
                                                <tr key={row.studentId} className="hover:bg-slate-50/40 transition">
                                                    <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="space-y-0.5">
                                                            <div className="font-extrabold text-gray-800">{row.name}</div>
                                                            <div className="text-[9px] text-gray-400 font-mono">{row.id_code}</div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            id={`input-${idx}-0`}
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            step="1"
                                                            className={`w-16 border rounded-lg p-1.5 text-center focus:ring-1 outline-none font-mono transition ${
                                                                isValidScore(row.prueba1) 
                                                                    ? 'border-gray-200 focus:ring-indigo-650 focus:border-indigo-650' 
                                                                    : 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500 font-bold'
                                                            }`}
                                                            value={row.prueba1 ?? ''}
                                                            onChange={e => handleCellChange(row.studentId, 'prueba1', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx, 0)}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            id={`input-${idx}-1`}
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            step="1"
                                                            className={`w-16 border rounded-lg p-1.5 text-center focus:ring-1 outline-none font-mono transition ${
                                                                isValidScore(row.prueba2) 
                                                                    ? 'border-gray-200 focus:ring-indigo-650 focus:border-indigo-650' 
                                                                    : 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500 font-bold'
                                                            }`}
                                                            value={row.prueba2 ?? ''}
                                                            onChange={e => handleCellChange(row.studentId, 'prueba2', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx, 1)}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            id={`input-${idx}-2`}
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            step="1"
                                                            className={`w-16 border rounded-lg p-1.5 text-center focus:ring-1 outline-none font-mono transition ${
                                                                isValidScore(row.guia) 
                                                                    ? 'border-gray-200 focus:ring-indigo-650 focus:border-indigo-650' 
                                                                    : 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500 font-bold'
                                                            }`}
                                                            value={row.guia ?? ''}
                                                            onChange={e => handleCellChange(row.studentId, 'guia', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx, 2)}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            id={`input-${idx}-3`}
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            step="1"
                                                            className={`w-16 border rounded-lg p-1.5 text-center focus:ring-1 outline-none font-mono transition ${
                                                                isValidScore(row.ejercitacion) 
                                                                    ? 'border-gray-200 focus:ring-indigo-650 focus:border-indigo-650' 
                                                                    : 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500 font-bold'
                                                            }`}
                                                            value={row.ejercitacion ?? ''}
                                                            onChange={e => handleCellChange(row.studentId, 'ejercitacion', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx, 3)}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            id={`input-${idx}-4`}
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            step="1"
                                                            className={`w-16 border rounded-lg p-1.5 text-center focus:ring-1 outline-none font-mono transition ${
                                                                isValidScore(row.actitudinal) 
                                                                    ? 'border-gray-200 focus:ring-indigo-650 focus:border-indigo-650' 
                                                                    : 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500 font-bold'
                                                            }`}
                                                            value={row.actitudinal ?? ''}
                                                            onChange={e => handleCellChange(row.studentId, 'actitudinal', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx, 4)}
                                                        />
                                                    </td>
                                                    <td className={`p-3 text-center font-extrabold bg-indigo-50/10 font-mono text-sm border-x transition-colors duration-250 ${
                                                        row.definitiva === 'Error'
                                                            ? 'text-rose-600 bg-rose-50 animate-pulse'
                                                            : row.definitiva >= 75 ? 'text-emerald-600' : 'text-rose-600'
                                                    }`}>
                                                        {row.definitiva === 'Error' ? '⚠️ Error' : row.definitiva}
                                                    </td>
                                                    <td className="p-3">
                                                        <input 
                                                            id={`input-${idx}-5`}
                                                            type="text"
                                                            className="w-full border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                                                            placeholder="Comentario sobre el desempeño..."
                                                            value={row.comment}
                                                            onChange={e => handleCellChange(row.studentId, 'comment', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx, 5)}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Selector de Archivo */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-1.5">
                                <Upload size={16} className="text-indigo-600" /> Cargar Archivo CSV
                            </h3>

                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-indigo-500 transition relative group bg-gray-50/20">
                                    <input 
                                        type="file"
                                        accept=".csv"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                        disabled={syncingCSV || loadingGrid}
                                    />
                                    <div className="space-y-2">
                                        <FileSpreadsheet className="mx-auto text-gray-400 group-hover:scale-110 transition-transform" size={32} />
                                        <div className="text-xs font-bold text-gray-600">
                                            {fileName ? fileName : 'Seleccionar Planilla CSV'}
                                        </div>
                                        <p className="text-[10px] text-gray-400">Solo archivos en formato .csv delimitados por comas o punto y coma.</p>
                                    </div>
                                </div>

                                {csvStatus === 'loaded' && (
                                    <button
                                        onClick={handleImportCSV}
                                        disabled={syncingCSV}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/10 transition flex items-center justify-center gap-1.5"
                                    >
                                        {syncingCSV ? (
                                            <><Loader2 className="animate-spin" size={14} /> Importando...</>
                                        ) : (
                                            <><Upload size={14} /> Importar Calificaciones</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Consola de logs del CSV */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-1.5">
                                <RefreshCw size={16} className="text-indigo-600" /> Historial de Carga
                            </h3>

                            {csvStatus === 'idle' && (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                    <Info className="text-indigo-300" size={36} />
                                    <div className="space-y-1 max-w-sm">
                                        <h4 className="text-xs font-bold text-gray-700">Listo para procesar</h4>
                                        <p className="text-[10px] text-gray-400 font-semibold leading-normal">
                                            Selecciona tu archivo de notas CSV en la barra de la izquierda y haz clic en "Importar Calificaciones" para procesarlas.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {csvStatus === 'syncing' && (
                                <div className="space-y-3 py-4">
                                    <div className="flex justify-between items-center text-xs text-gray-600 font-bold">
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="animate-spin text-indigo-600" size={14} /> Procesando filas...
                                        </span>
                                        <span>{csvProgress.current} / {csvProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-indigo-650 h-full transition-all duration-300" 
                                            style={{ width: `${csvProgress.total > 0 ? (csvProgress.current / csvProgress.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {csvStatus === 'success' && (
                                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                                    <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-emerald-800">Cruce de Notas Completo</h4>
                                        <p className="text-[10px] text-emerald-600 font-semibold leading-normal">
                                            Las notas se han cargado en la tabla web con éxito. **Por favor ve a la pestaña "Digitación Directa (Web)" y presiona el botón "Guardar Planilla"** para consolidar los cambios en el servidor escolar.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {csvStatus === 'error' && (
                                <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-rose-800">Error en el archivo</h4>
                                        <p className="text-[10px] text-rose-600 font-semibold leading-normal">
                                            {csvErrorMessage}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Consola terminal */}
                            {(csvLogs.length > 0 || syncingCSV) && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Terminal del Cruce</label>
                                    <div className="bg-slate-900 rounded-2xl p-4 h-64 overflow-y-auto font-mono text-[9px] text-slate-300 space-y-1 shadow-inner leading-normal">
                                        {csvLogs.map((log, idx) => (
                                            <div key={idx} className={
                                                log.includes('✅') ? 'text-emerald-400' :
                                                log.includes('⚠️') ? 'text-amber-400' :
                                                log.includes('❌') ? 'text-rose-400' : 'text-slate-300'
                                            }>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
