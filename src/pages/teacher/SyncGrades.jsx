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
    const [courses, setCourses] = useState(['1001', '101', '201', '301', '401', '501', '601', '701', '801', '901', '1002', '1003']);
    const [selectedCourse, setSelectedCourse] = useState('1001');
    const [selectedSubject, setSelectedSubject] = useState('Matemáticas');
    const [selectedPeriod, setSelectedPeriod] = useState('1');

    // Control de Pestañas (planilla: Planilla Web, csv: Importación Excel/CSV)
    const [activeTab, setActiveTab] = useState('planilla');

    // Datos de la planilla editable
    const [gridData, setGridData] = useState([]);
    const [loadingGrid, setLoadingGrid] = useState(false);
    const [savingGrid, setSavingGrid] = useState(false);

    // Estados del cargador de Excel/CSV
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
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
        'Geometría',
        'Inglés',
        'Matemáticas'
    ];

    const addCsvLog = (msg) => {
        setCsvLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    // Cargar cursos
    useEffect(() => {
        async function loadCourses() {
            try {
                const snap = await getDocs(collection(db, 'students'));
                const studentGrades = snap.docs.map(d => d.data().grade).filter(Boolean);
                let uniqueFromStudents = Array.from(new Set(studentGrades)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                const cSnap = await getDocs(collection(db, 'courses'));
                let uniqueFromCourses = [];
                if (!cSnap.empty) {
                    uniqueFromCourses = cSnap.docs.map(doc => doc.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                }

                const allCourses = Array.from(new Set([...uniqueFromStudents, ...uniqueFromCourses])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                if (allCourses.length === 0) {
                    allCourses.push('101', '201', '301', '401', '501', '601', '701', '801', '901', '1001', '1002', '1003');
                }

                setCourses(allCourses);
                const initialCourse = uniqueFromStudents.length > 0 ? uniqueFromStudents[0] : allCourses[0];
                setSelectedCourse(initialCourse);
            } catch (e) {
                console.error("Error al cargar cursos:", e);
                const fallback = ['1001', '101', '201', '301', '401', '501'];
                setCourses(fallback);
                setSelectedCourse('1001');
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
            setSelectedFile(null);
            try {
                // 1. Cargar alumnos del curso
                const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
                const sSnap = await getDocs(qStudents);
                
                let studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== 'retirado').sort((a, b) => {
                    const nameA = a.lastName && a.firstName ? `${a.lastName} ${a.firstName}` : (a.name || '');
                    const nameB = b.lastName && b.firstName ? `${b.lastName} ${b.firstName}` : (b.name || '');
                    return nameA.localeCompare(nameB);
                });

                if (studentList.length === 0) {
                    // Generar lista de estudiantes modelo para este curso para que la pantalla NUNCA aparezca en blanco
                    studentList = [
                        { id: `demo-s1-${selectedCourse}`, id_code: `ST-${selectedCourse}-001`, name: 'ARIZA VALENZUELA BRANDON THOMAS', firstName: 'BRANDON THOMAS', lastName: 'ARIZA VALENZUELA', grade: selectedCourse },
                        { id: `demo-s2-${selectedCourse}`, id_code: `ST-${selectedCourse}-002`, name: 'BARRERA PARRA GABRIEL JERONIMO', firstName: 'GABRIEL JERONIMO', lastName: 'BARRERA PARRA', grade: selectedCourse },
                        { id: `demo-s3-${selectedCourse}`, id_code: `ST-${selectedCourse}-003`, name: 'CARDENAS AYALA EILYN THAMARA', firstName: 'EILYN THAMARA', lastName: 'CARDENAS AYALA', grade: selectedCourse },
                        { id: `demo-s4-${selectedCourse}`, id_code: `ST-${selectedCourse}-004`, name: 'CASTIBLANCO VELANDIA JULIETA', firstName: 'JULIETA', lastName: 'CASTIBLANCO VELANDIA', grade: selectedCourse },
                        { id: `demo-s5-${selectedCourse}`, id_code: `ST-${selectedCourse}-005`, name: 'DUENAS ROJAS SAMANTHA', firstName: 'SAMANTHA', lastName: 'DUENAS ROJAS', grade: selectedCourse }
                    ];
                }

                // 2. Cargar calificaciones de TODOS los periodos de la materia seleccionada
                const qGradesAll = query(
                    collection(db, 'grades'),
                    where('subject', '==', selectedSubject)
                );
                const gSnapAll = await getDocs(qGradesAll);
                const gradesMap = {};
                const historyMap = {};

                gSnapAll.docs.forEach(doc => {
                    const gData = doc.data();
                    if (!historyMap[gData.student_id]) historyMap[gData.student_id] = {};
                    if (gData.grade > 0) {
                        historyMap[gData.student_id][gData.period] = gData.grade;
                    }

                    if (Number(gData.period) === Number(selectedPeriod)) {
                        gradesMap[gData.student_id] = { docId: doc.id, ...gData };
                    }
                });

                // 3. Cruzar datos para armar la grilla (dejando en blanco si no tiene nota)
                const gridRows = studentList.map(student => {
                    const record = gradesMap[student.id];
                    const comp = record?.components || {};
                    
                    const p1 = comp.prueba1 !== undefined && comp.prueba1 !== null ? comp.prueba1 : '';
                    const p2 = comp.prueba2 !== undefined && comp.prueba2 !== null ? comp.prueba2 : '';
                    const guia = comp.guia !== undefined && comp.guia !== null ? comp.guia : '';
                    const ejer = comp.ejercitacion !== undefined && comp.ejercitacion !== null ? comp.ejercitacion : '';
                    const act = comp.actitudinal !== undefined && comp.actitudinal !== null ? comp.actitudinal : '';
                    
                    const p1Num = p1 === '' ? 0 : Number(p1);
                    const p2Num = p2 === '' ? 0 : Number(p2);
                    const guiaNum = guia === '' ? 0 : Number(guia);
                    const ejerNum = ejer === '' ? 0 : Number(ejer);
                    const actNum = act === '' ? 0 : Number(act);

                    const compSum = p1Num + p2Num + guiaNum + ejerNum + actNum;
                    const hasComps = (p1 !== '' && p1 > 0) || (p2 !== '' && p2 > 0) || (guia !== '' && guia > 0) || (ejer !== '' && ejer > 0) || (act !== '' && act > 0);

                    let def = '-';
                    if (hasComps && compSum > 0) {
                        def = compSum;
                    } else if (record && record.grade > 0) {
                        def = record.grade;
                    }

                    const history = historyMap[student.id] || {};

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
                        history: {
                            1: history[1] || null,
                            2: history[2] || null,
                            3: history[3] || null,
                            4: history[4] || null
                        },
                        comment: (record?.comment && !record.comment.startsWith('Desempeño:') && !record.comment.startsWith('Registro ') && !record.comment.startsWith('Nota inicial')) ? record.comment : '',
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

    // Descargar plantilla Excel dinámica con los nombres reales de los alumnos de ese curso
    const handleDownloadExcel = async () => {
        if (!selectedCourse) return;
        setDownloadingTemplate(true);
        try {
            const XLSX = await import('xlsx');
            const utils = XLSX.utils || XLSX.default?.utils || XLSX;
            const writeFile = XLSX.writeFile || XLSX.default?.writeFile || XLSX;

            // Obtener estudiantes reales ordenados no retirados
            const qStudents = query(collection(db, 'students'), where('grade', '==', selectedCourse));
            const sSnap = await getDocs(qStudents);
            
            const rawList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.status !== 'retirado');
            const studentList = rawList.sort((a, b) => {
                const nameA = a.lastName && a.firstName ? `${a.lastName} ${a.firstName}` : (a.name || '');
                const nameB = b.lastName && b.firstName ? `${b.lastName} ${b.firstName}` : (b.name || '');
                return nameA.localeCompare(nameB);
            });

            // Construir filas de Excel
            const excelRows = (studentList.length > 0 ? studentList : [{ id_code: 'ST-101', name: 'ESTUDIANTE DEMO' }]).map((s, idx) => {
                const gridRow = gridData.find(g => g.studentId === s.id);
                const formattedName = s.lastName && s.firstName ? `${s.lastName} ${s.firstName}` : (s.name || '');

                return {
                    "NO.": idx + 1,
                    "CÓDIGO": s.id_code || `ST-${idx+1}`,
                    "NOMBRE ESTUDIANTE": formattedName.toUpperCase(),
                    "PRUEBA 1 (20%)": gridRow ? (gridRow.prueba1 ?? '') : '',
                    "PRUEBA 2 (20%)": gridRow ? (gridRow.prueba2 ?? '') : '',
                    "GUÍA (20%)": gridRow ? (gridRow.guia ?? '') : '',
                    "EJERCITACIÓN (20%)": gridRow ? (gridRow.ejercitacion ?? '') : '',
                    "ACTITUDINAL (20%)": gridRow ? (gridRow.actitudinal ?? '') : '',
                    "DEFINITIVA": gridRow ? (gridRow.definitiva ?? '') : '',
                    "OBSERVACIONES": gridRow ? (gridRow.comment ?? '') : ''
                };
            });

            const ws = utils.json_to_sheet(excelRows);
            
            // Ajustar anchos de columnas
            ws['!cols'] = [
                { wch: 6 },   // NO.
                { wch: 14 },  // CÓDIGO
                { wch: 36 },  // NOMBRE
                { wch: 16 },  // PRUEBA 1
                { wch: 16 },  // PRUEBA 2
                { wch: 16 },  // GUÍA
                { wch: 18 },  // EJERCITACIÓN
                { wch: 18 },  // ACTITUDINAL
                { wch: 14 },  // DEFINITIVA
                { wch: 38 }   // OBSERVACIONES
            ];

            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, `Curso ${selectedCourse}`);
            
            const fileNameClean = `Planilla_${selectedSubject.replace(/\s+/g, '_')}_Curso_${selectedCourse}_P${selectedPeriod}.xlsx`;
            writeFile(wb, fileNameClean);
        } catch (e) {
            console.error("Error al generar planilla Excel:", e);
            alert("Error al descargar planilla Excel: " + e.message);
        } finally {
            setDownloadingTemplate(false);
        }
    };

    // Controlar el cambio de archivo Excel o CSV seleccionado
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setFileName(file.name);
        setCsvStatus('loaded');
        setCsvErrorMessage('');
        setCsvLogs([]);
    };

    // Normalizador de nombres inteligente (independiente del orden de palabras, espacios o tildes)
    const normalizeName = (name) => {
        if (!name) return "";
        return String(name).toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remover tildes
            .replace(/[^a-z0-9\s]/g, "")     // remover caracteres especiales
            .split(/\s+/)                    // dividir en palabras
            .filter(Boolean)                 // remover vacíos
            .sort()                          // ordenar palabras alfabéticamente
            .join("");                       // unir en un solo bloque
    };

    // Importar el archivo Excel / CSV y cargarlo en la cuadrícula editable en vivo
    const handleImportExcel = async () => {
        if (!selectedFile) return;

        setSyncingCSV(true);
        setCsvStatus('syncing');
        setCsvLogs([]);
        setCsvErrorMessage('');
        addCsvLog("Procesando la planilla de Excel/CSV cargada...");

        try {
            const XLSX = await import('xlsx');
            const read = XLSX.read || XLSX.default?.read || XLSX;
            const utils = XLSX.utils || XLSX.default?.utils || XLSX;

            const data = await selectedFile.arrayBuffer();
            const workbook = read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = utils.sheet_to_json(worksheet, { defval: '' });

            if (rows.length === 0) {
                throw new Error("El archivo no contiene filas o datos válidos.");
            }

            addCsvLog(`Detectados ${rows.length} registros en el archivo Excel.`);
            setCsvProgress({ current: 0, total: rows.length });

            // Crear mapa de estudiantes normalizados
            const gridMap = {};
            gridData.forEach(row => {
                gridMap[normalizeName(row.name)] = row.studentId;
                if (row.id_code) {
                    gridMap[normalizeName(row.id_code)] = row.studentId;
                }
            });

            let updatedCount = 0;
            let errorCount = 0;

            const updatedGrid = gridData.map(row => ({ ...row }));

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                
                const rawName = row['NOMBRE ESTUDIANTE'] || row['nombre_estudiante'] || row['Nombre'] || row['Estudiante'] || '';
                const rawCode = row['CÓDIGO'] || row['codigo_estudiante'] || row['Código'] || '';

                const studentName = String(rawName).trim();
                const studentCode = String(rawCode).trim();

                if (!studentName && !studentCode) continue;

                addCsvLog(`[${i + 1}/${rows.length}] Procesando alumno: "${studentName || studentCode}"...`);

                // 1. Buscar por código o por nombre normalizado
                let targetStudentId = gridMap[normalizeName(studentCode)] || gridMap[normalizeName(studentName)];

                if (!targetStudentId) {
                    addCsvLog(`⚠️ Omitido: El estudiante "${studentName || studentCode}" no fue encontrado en el curso ${selectedCourse}.`);
                    errorCount++;
                    setCsvProgress(prev => ({ ...prev, current: i + 1 }));
                    continue;
                }

                // 2. Extraer notas (Excel oficial o CSV antiguo)
                const p1Val = row['PRUEBA 1 (20%)'] !== undefined && row['PRUEBA 1 (20%)'] !== '' ? row['PRUEBA 1 (20%)'] : row['prueba_1'];
                const p2Val = row['PRUEBA 2 (20%)'] !== undefined && row['PRUEBA 2 (20%)'] !== '' ? row['PRUEBA 2 (20%)'] : row['prueba_2'];
                const guiaVal = row['GUÍA (20%)'] !== undefined && row['GUÍA (20%)'] !== '' ? row['GUÍA (20%)'] : row['guia'];
                const ejerVal = row['EJERCITACIÓN (20%)'] !== undefined && row['EJERCITACIÓN (20%)'] !== '' ? row['EJERCITACIÓN (20%)'] : row['ejercitacion'];
                const actVal = row['ACTITUDINAL (20%)'] !== undefined && row['ACTITUDINAL (20%)'] !== '' ? row['ACTITUDINAL (20%)'] : row['actitudinal'];
                const commentVal = row['OBSERVACIONES'] !== undefined ? row['OBSERVACIONES'] : row['comentario'];

                const limits = { prueba1: 20, prueba2: 20, guia: 20, ejercitacion: 20, actitudinal: 20 };
                const p1 = Math.min(limits.prueba1, Math.max(0, Number(p1Val) || 0));
                const p2 = Math.min(limits.prueba2, Math.max(0, Number(p2Val) || 0));
                const guia = Math.min(limits.guia, Math.max(0, Number(guiaVal) || 0));
                const ejer = Math.min(limits.ejercitacion, Math.max(0, Number(ejerVal) || 0));
                const act = Math.min(limits.actitudinal, Math.max(0, Number(actVal) || 0));
                const def = Math.round(p1 + p2 + guia + ejer + act);

                // 3. Actualizar en el estado local de la grilla web
                const idx = updatedGrid.findIndex(r => r.studentId === targetStudentId);
                if (idx !== -1) {
                    updatedGrid[idx].prueba1 = p1;
                    updatedGrid[idx].prueba2 = p2;
                    updatedGrid[idx].guia = guia;
                    updatedGrid[idx].ejercitacion = ejer;
                    updatedGrid[idx].actitudinal = act;
                    updatedGrid[idx].definitiva = def;
                    if (commentVal !== undefined && commentVal !== null) {
                        const cleanComm = String(commentVal).trim();
                        if (!cleanComm.startsWith('Desempeño:') && !cleanComm.startsWith('Registro ') && !cleanComm.startsWith('Nota inicial')) {
                            updatedGrid[idx].comment = cleanComm;
                        }
                    }
                    updatedCount++;
                    addCsvLog(`✅ Sincronizadas notas de "${updatedGrid[idx].name}": Definitiva ${def} pts.`);
                }

                setCsvProgress(prev => ({ ...prev, current: i + 1 }));
            }

            setGridData(updatedGrid);
            addCsvLog(`🎉 Proceso finalizado con éxito. Se cargaron notas para ${updatedCount} estudiantes.`);
            addCsvLog(`💡 IMPORTANTE: Ve a la pestaña "Digitación Directa (Web)" y presiona "Guardar Planilla" para consolidar los cambios en la base de datos.`);
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
                    onClick={handleDownloadExcel}
                    disabled={downloadingTemplate || loadingGrid}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-100/50 disabled:opacity-50"
                >
                    {downloadingTemplate ? (
                        <><Loader2 className="animate-spin" size={14} /> Generando...</>
                    ) : (
                        <><Download size={14} /> Descargar Planilla Excel</>
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
                    <FileSpreadsheet size={14} /> 📥 Descargar / 📤 Cargar Planilla Excel
                </button>
            </div>

            {/* Contenido Dinámico */}
            {activeTab === 'planilla' ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <Table size={16} className="text-indigo-600" /> Planilla {selectedSubject} - Curso {selectedCourse}
                            </h3>
                            <p className="text-[10px] text-gray-400 font-semibold">Usa las cajas de texto para escribir y presiona "Guardar Planilla" al finalizar.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownloadExcel}
                                disabled={downloadingTemplate || loadingGrid}
                                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {downloadingTemplate ? (
                                    <><Loader2 className="animate-spin" size={14} /> Generando Excel...</>
                                ) : (
                                    <><Download size={14} /> Descargar Planilla Excel</>
                                )}
                            </button>

                            {gridData.length > 0 && (
                                <button
                                    onClick={handleSaveGrid}
                                    disabled={savingGrid || loadingGrid}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {savingGrid ? (
                                        <><Loader2 className="animate-spin" size={14} /> Guardando...</>
                                    ) : (
                                        'Guardar Planilla'
                                    )}
                                </button>
                            )}
                        </div>
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
                                        <tr className="bg-slate-50 border-b border-gray-150 text-gray-500 font-extrabold text-[10px] uppercase tracking-wider">
                                            <th className="p-3 text-center w-12">No.</th>
                                            <th className="p-3">Nombre Estudiante</th>
                                            <th className="p-3 text-center w-24">Prueba 1 (20%)</th>
                                            <th className="p-3 text-center w-24">Prueba 2 (20%)</th>
                                            <th className="p-3 text-center w-24">Guía (20%)</th>
                                            <th className="p-3 text-center w-24">Ejercitación (20%)</th>
                                            <th className="p-3 text-center w-24">Actitudinal (20%)</th>
                                            
                                            {/* Columnas dinámicas de Definitivas ordenadas cronológicamente (P1, P2, P3, P4, PROM ACUM) */}
                                            {/* P1 Column Header */}
                                            <th className={`p-3 text-center w-20 font-black border-l ${
                                                selectedPeriod === '1' 
                                                    ? 'bg-indigo-100/70 text-indigo-950 border-indigo-200' 
                                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}>
                                                P1
                                            </th>
                                            
                                            {/* P2 Column Header */}
                                            {Number(selectedPeriod) >= 2 && (
                                                <th className={`p-3 text-center w-20 font-black border-l ${
                                                    selectedPeriod === '2' 
                                                        ? 'bg-indigo-100/70 text-indigo-950 border-indigo-200' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    P2
                                                </th>
                                            )}

                                            {/* P3 Column Header */}
                                            {Number(selectedPeriod) >= 3 && (
                                                <th className={`p-3 text-center w-20 font-black border-l ${
                                                    selectedPeriod === '3' 
                                                        ? 'bg-indigo-100/70 text-indigo-950 border-indigo-200' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    P3
                                                </th>
                                            )}

                                            {/* P4 Column Header */}
                                            {Number(selectedPeriod) >= 4 && (
                                                <th className={`p-3 text-center w-20 font-black border-l ${
                                                    selectedPeriod === '4' 
                                                        ? 'bg-indigo-100/70 text-indigo-950 border-indigo-200' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    P4
                                                </th>
                                            )}

                                            {/* Promedio Acumulado Header */}
                                            {Number(selectedPeriod) >= 2 && (
                                                <th className="p-3 text-center w-24 bg-amber-100/70 text-amber-950 font-black border-l border-amber-200">
                                                    PROM. ACUM.
                                                </th>
                                            )}

                                            <th className="p-3 border-l border-slate-200">Observaciones (Opcional)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-650">
                                        {gridData.map((row, idx) => {
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

                                                    {/* CELDA P1 */}
                                                    <td className={`p-3 text-center font-extrabold font-mono border-l ${
                                                        selectedPeriod === '1'
                                                            ? 'bg-indigo-50/20 text-sm border-indigo-100'
                                                            : 'bg-slate-50/50 text-xs border-slate-200'
                                                    }`}>
                                                        {selectedPeriod === '1' ? (
                                                            row.definitiva !== '-' ? (
                                                                <span className={`px-2 py-1 rounded-lg text-xs font-black inline-block ${
                                                                    Number(row.definitiva) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                                    Number(row.definitiva) >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                                                }`}>
                                                                    {row.definitiva}
                                                                </span>
                                                            ) : <span className="text-gray-400 font-normal">-</span>
                                                        ) : (
                                                            row.history && row.history[1] ? (
                                                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                                                    row.history[1] >= 80 ? 'text-emerald-700 bg-emerald-50' :
                                                                    row.history[1] >= 75 ? 'text-blue-700 bg-blue-50' : 'text-rose-700 bg-rose-50'
                                                                }`}>
                                                                    {row.history[1]}
                                                                </span>
                                                            ) : <span className="text-slate-300 font-normal">-</span>
                                                        )}
                                                    </td>

                                                    {/* CELDA P2 (si estamos en P2, P3, P4) */}
                                                    {Number(selectedPeriod) >= 2 && (
                                                        <td className={`p-3 text-center font-extrabold font-mono border-l ${
                                                            selectedPeriod === '2'
                                                                ? 'bg-indigo-50/20 text-sm border-indigo-100'
                                                                : 'bg-slate-50/50 text-xs border-slate-200'
                                                        }`}>
                                                            {selectedPeriod === '2' ? (
                                                                row.definitiva !== '-' ? (
                                                                    <span className={`px-2 py-1 rounded-lg text-xs font-black inline-block ${
                                                                        Number(row.definitiva) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                                        Number(row.definitiva) >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                                                    }`}>
                                                                        {row.definitiva}
                                                                    </span>
                                                                ) : <span className="text-gray-400 font-normal">-</span>
                                                            ) : (
                                                                row.history && row.history[2] ? (
                                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                                                        row.history[2] >= 80 ? 'text-emerald-700 bg-emerald-50' :
                                                                        row.history[2] >= 75 ? 'text-blue-700 bg-blue-50' : 'text-rose-700 bg-rose-50'
                                                                    }`}>
                                                                        {row.history[2]}
                                                                    </span>
                                                                ) : <span className="text-slate-300 font-normal">-</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* CELDA P3 (si estamos en P3, P4) */}
                                                    {Number(selectedPeriod) >= 3 && (
                                                        <td className={`p-3 text-center font-extrabold font-mono border-l ${
                                                            selectedPeriod === '3'
                                                                ? 'bg-indigo-50/20 text-sm border-indigo-100'
                                                                : 'bg-slate-50/50 text-xs border-slate-200'
                                                        }`}>
                                                            {selectedPeriod === '3' ? (
                                                                row.definitiva !== '-' ? (
                                                                    <span className={`px-2 py-1 rounded-lg text-xs font-black inline-block ${
                                                                        Number(row.definitiva) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                                        Number(row.definitiva) >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                                                    }`}>
                                                                        {row.definitiva}
                                                                    </span>
                                                                ) : <span className="text-gray-400 font-normal">-</span>
                                                            ) : (
                                                                row.history && row.history[3] ? (
                                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                                                        row.history[3] >= 80 ? 'text-emerald-700 bg-emerald-50' :
                                                                        row.history[3] >= 75 ? 'text-blue-700 bg-blue-50' : 'text-rose-700 bg-rose-50'
                                                                    }`}>
                                                                        {row.history[3]}
                                                                    </span>
                                                                ) : <span className="text-slate-300 font-normal">-</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* CELDA P4 (si estamos en P4) */}
                                                    {Number(selectedPeriod) >= 4 && (
                                                        <td className={`p-3 text-center font-extrabold font-mono border-l ${
                                                            selectedPeriod === '4'
                                                                ? 'bg-indigo-50/20 text-sm border-indigo-100'
                                                                : 'bg-slate-50/50 text-xs border-slate-200'
                                                        }`}>
                                                            {selectedPeriod === '4' ? (
                                                                row.definitiva !== '-' ? (
                                                                    <span className={`px-2 py-1 rounded-lg text-xs font-black inline-block ${
                                                                        Number(row.definitiva) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                                        Number(row.definitiva) >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                                                    }`}>
                                                                        {row.definitiva}
                                                                    </span>
                                                                ) : <span className="text-gray-400 font-normal">-</span>
                                                            ) : (
                                                                row.history && row.history[4] ? (
                                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                                                        row.history[4] >= 80 ? 'text-emerald-700 bg-emerald-50' :
                                                                        row.history[4] >= 75 ? 'text-blue-700 bg-blue-50' : 'text-rose-700 bg-rose-50'
                                                                    }`}>
                                                                        {row.history[4]}
                                                                    </span>
                                                                ) : <span className="text-slate-300 font-normal">-</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* CELDA PROMEDIO ACUMULADO */}
                                                    {Number(selectedPeriod) >= 2 && (() => {
                                                        const curP = Number(selectedPeriod);
                                                        const validScores = [];

                                                        for (let p = 1; p <= curP; p++) {
                                                            if (p === curP) {
                                                                if (row.definitiva !== '-' && Number(row.definitiva) > 0) {
                                                                    validScores.push(Number(row.definitiva));
                                                                }
                                                            } else {
                                                                if (row.history && row.history[p] && Number(row.history[p]) > 0) {
                                                                    validScores.push(Number(row.history[p]));
                                                                }
                                                            }
                                                        }

                                                        const avgVal = validScores.length > 0 
                                                            ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
                                                            : '-';

                                                        return (
                                                            <td className="p-3 text-center font-black font-mono text-amber-900 bg-amber-50/40 border-l border-amber-200">
                                                                {avgVal !== '-' ? (
                                                                    <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-100/80 text-amber-900 border border-amber-200">
                                                                        {avgVal}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-amber-300 font-normal">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })()}

                                                    <td className="p-3 border-l border-slate-200">
                                                        <input 
                                                            id={`input-${idx}-5`}
                                                            type="text"
                                                            className="w-full border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                                                            placeholder="Comentario sobre el desempeño..."
                                                            value={row.comment || ''}
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
                                <Upload size={16} className="text-indigo-600" /> Cargar Planilla Excel (.xlsx / .csv)
                            </h3>

                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center hover:border-indigo-500 transition relative group bg-indigo-50/10">
                                    <input 
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                        disabled={syncingCSV || loadingGrid}
                                    />
                                    <div className="space-y-2">
                                        <FileSpreadsheet className="mx-auto text-indigo-500 group-hover:scale-110 transition-transform" size={36} />
                                        <div className="text-xs font-bold text-gray-700">
                                            {fileName ? fileName : 'Seleccionar Planilla Excel (.xlsx)'}
                                        </div>
                                        <p className="text-[10px] text-gray-400">Admite archivos oficiales de Excel (.xlsx, .xls) o CSV.</p>
                                    </div>
                                </div>

                                {csvStatus === 'loaded' && (
                                    <button
                                        onClick={handleImportExcel}
                                        disabled={syncingCSV}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/10 transition flex items-center justify-center gap-1.5"
                                    >
                                        {syncingCSV ? (
                                            <><Loader2 className="animate-spin" size={14} /> Procesando Excel...</>
                                        ) : (
                                            <><Upload size={14} /> Cargar Notas a la Tabla Web</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Consola de logs del CSV/Excel */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-1.5">
                                <RefreshCw size={16} className="text-indigo-600" /> Historial de Carga Excel
                            </h3>

                            {csvStatus === 'idle' && (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                    <Info className="text-indigo-300" size={36} />
                                    <div className="space-y-1 max-w-sm">
                                        <h4 className="text-xs font-bold text-gray-700">Listo para procesar</h4>
                                        <p className="text-[10px] text-gray-400 font-semibold leading-normal">
                                            Descarga la planilla Excel oficial con el botón superior, ingresa las notas en Excel y cárgala aquí para sincronizar automáticamente.
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
