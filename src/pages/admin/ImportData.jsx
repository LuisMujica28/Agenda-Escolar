import { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, query, where, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, Table, BookOpen, Layers, Database, FolderPlus } from 'lucide-react';

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

    // Parser nativo de archivos DBF (FoxPro / dBase) en navegador
    const parseDBF = (arrayBuffer) => {
        const dataView = new DataView(arrayBuffer);
        const bytes = new Uint8Array(arrayBuffer);
        if (bytes.length < 32) return [];

        const numRecords = dataView.getUint32(4, true);
        const headerLen = dataView.getUint16(8, true);
        const recordLen = dataView.getUint16(10, true);

        const fields = [];
        let offset = 32;
        const decoder = new TextDecoder('iso-8859-1');

        while (offset < headerLen && bytes[offset] !== 0x0D) {
            if (offset + 32 > bytes.length) break;
            const fieldBytes = bytes.subarray(offset, offset + 11);
            let fieldName = '';
            for (let b of fieldBytes) {
                if (b === 0) break;
                fieldName += String.fromCharCode(b);
            }
            const type = String.fromCharCode(bytes[offset + 11]);
            const length = bytes[offset + 16];
            fields.push({ name: fieldName.trim(), type, length });
            offset += 32;
        }

        const records = [];
        let recOffset = headerLen;

        for (let i = 0; i < numRecords; i++) {
            if (recOffset + recordLen > bytes.length) break;
            const deleteFlag = bytes[recOffset];
            if (deleteFlag === 0x2A) { // eliminado
                recOffset += recordLen;
                continue;
            }

            const record = {};
            let fieldOffset = recOffset + 1;
            for (const field of fields) {
                const rawVal = bytes.subarray(fieldOffset, fieldOffset + field.length);
                record[field.name] = decoder.decode(rawVal).trim();
                fieldOffset += field.length;
            }
            records.push(record);
            recOffset += recordLen;
        }

        return records;
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

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setStatus('idle');
        setFileData([]);
        setErrorMessage('');
        setLogs([]);

        if (files.length === 1 && files[0].name.toLowerCase().endsWith('.csv')) {
            // Manejador CSV único
            const file = files[0];
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target.result;
                    const rows = parseCSV(text);
                    setFileData(rows);
                    setStatus('loaded');
                } catch (err) {
                    setErrorMessage(err.message);
                    setStatus('error');
                }
            };
            reader.readAsText(file, 'UTF-8');
            return;
        }

        // Si son múltiples archivos o carpetas con .dbf
        const dbfFiles = files.filter(f => f.name.toLowerCase().endsWith('.dbf'));
        if (dbfFiles.length === 0) {
            setErrorMessage('No se encontraron archivos .dbf ni .csv válidos en la selección.');
            setStatus('error');
            return;
        }

        setFileName(files.length > 1 ? `Carpeta con ${dbfFiles.length} archivos DBF` : dbfFiles[0].name);

        try {
            // Leer todos los archivos DBF en paralelo
            const parsedDBFs = {};
            for (const file of dbfFiles) {
                const arrayBuffer = await file.arrayBuffer();
                const baseName = file.name.toLowerCase();
                parsedDBFs[baseName] = parseDBF(arrayBuffer);
            }

            // Buscar pareval.dbf si existe en la carpeta para obtener las 5 parciales exactas
            const parevalRecords = parsedDBFs['pareval.dbf'] || [];
            const parevalMap = new Map();
            parevalRecords.forEach(p => {
                const rawCourse = (p.PARCURSO || '').replace(/^U0?/, '');
                const course = rawCourse ? String(parseInt(rawCourse, 10)) : '';
                const mat = (p.PARMAT || '').trim();
                const per = (p.PARPER || '').trim();
                const name = (p.PARNOMAL || '').trim().toUpperCase();

                const key = `${course}_${mat}_${per}_${name}`;
                parevalMap.set(key, {
                    prueba1: Number(p.PA1) || 0,
                    prueba2: Number(p.PA2) || 0,
                    guia: Number(p.PA3) || 0,
                    ejercitacion: Number(p.PA4) || 0,
                    actitudinal: Number(p.PA5) || 0
                });
            });

            // Buscar LUISMT2.DBF o cualquier *MT*.DBF de consolidado
            let masterKey = Object.keys(parsedDBFs).find(k => k.includes('mt2') || k.includes('mt'));
            if (!masterKey && Object.keys(parsedDBFs).length > 0) {
                masterKey = Object.keys(parsedDBFs)[0];
            }

            const masterRecords = parsedDBFs[masterKey] || [];
            const subjectMap = {
                'MAT': 'Matemáticas',
                'FIS': 'C. Naturales (Física)',
                'FIC': 'C. Naturales (Física)',
                'GEO': 'Geometría',
                'XCS': 'Ed Ética y Valores'
            };

            let mappedRows = [];

            if (activeTab === 'courses') {
                const uniqueMap = new Map();
                masterRecords.forEach((r, idx) => {
                    const name = r.ALUNOM || r.NOMALU || r.NOMBRE || '';
                    if (!name) return;
                    
                    const rawGrade = (r.ALUGRA || '') + (r.ALUPAR || '');
                    const grade = rawGrade ? String(parseInt(rawGrade, 10)) : (r.CURSO || '1001');
                    const key = `${grade}_${name.toUpperCase()}`;
                    
                    if (uniqueMap.has(key)) return;

                    const words = name.trim().split(/\s+/);
                    const cleanName = words.slice(0, 2).join('').toLowerCase().replace(/[^a-z]/g, '');
                    const code = r.ALUCOD || r.CODIGO || `ST-${grade}-${String(uniqueMap.size + 1).padStart(3, '0')}`;
                    const parentEmail = `padre.${cleanName || 'estudiante'}@inas.edu.co`;
                    const parentName = `Acudiente de ${name}`;

                    const rowObj = {
                        nombre: name,
                        curso: grade,
                        codigo: code,
                        email_padre: parentEmail,
                        nombre_padre: parentName
                    };
                    uniqueMap.set(key, rowObj);
                    mappedRows.push(rowObj);
                });
            } else {
                const groupedMap = new Map();

                function getOrCreateGroup(studentName, course, matCode) {
                    const subject = subjectMap[matCode] || matCode;
                    const key1 = `${course}_${matCode}_1_${studentName.toUpperCase()}`;
                    const key2 = `${course}_${matCode}_2_${studentName.toUpperCase()}`;
                    if (!groupedMap.has(key1)) {
                        groupedMap.set(key1, { studentName, course, matCode, subject, period: 1, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, total: 0, evalLevel: '' });
                    }
                    if (!groupedMap.has(key2)) {
                        groupedMap.set(key2, { studentName, course, matCode, subject, period: 2, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, total: 0, evalLevel: '' });
                    }
                    return { p1Rec: groupedMap.get(key1), p2Rec: groupedMap.get(key2) };
                }

                // 1. Cargar datos de pareval (Parciales P2)
                parevalMap.forEach((par, key) => {
                    const parts = key.split('_');
                    if (parts.length >= 4) {
                        const [grade, matCode, pNum, ...nameParts] = parts;
                        const studentName = nameParts.join('_');
                        const { p2Rec } = getOrCreateGroup(studentName, grade, matCode);
                        p2Rec.p1 = par.prueba1;
                        p2Rec.p2 = par.prueba2;
                        p2Rec.p3 = par.guia;
                        p2Rec.p4 = par.ejercitacion;
                        p2Rec.p5 = par.actitudinal;
                    }
                });

                // 2. Cargar datos de LUISMT2
                masterRecords.forEach((r) => {
                    const name = (r.ALUNOM || r.NOMALU || r.NOMBRE || '').trim();
                    const rawGrade = (r.ALUGRA || '') + (r.ALUPAR || '');
                    if (!name || !rawGrade) return;

                    const grade = String(parseInt(rawGrade, 10));
                    const matCode = (r.ALUMAT || r.MATERIA || 'MAT').trim();
                    const indicator = (r.ALUCO1 || '').trim().toLowerCase();
                    const pt1 = Number(r.ALUPT1 || r.P1) || 0;
                    const pt2 = Number(r.ALUPT2 || r.P2) || 0;
                    const evalLevel = r.ALUCO1 || '';

                    const { p1Rec, p2Rec } = getOrCreateGroup(name, grade, matCode);

                    if (indicator === 'pa1' && p2Rec.p1 === 0) p2Rec.p1 = pt1;
                    else if (indicator === 'pa2' && p2Rec.p2 === 0) p2Rec.p2 = pt1;
                    else if (indicator === 'pa3' && p2Rec.p3 === 0) p2Rec.p3 = pt1;
                    else if (indicator === 'pa4' && p2Rec.p4 === 0) p2Rec.p4 = pt1;
                    else if (indicator === 'pa5' && p2Rec.p5 === 0) p2Rec.p5 = pt1;

                    if (pt2 > 0) p2Rec.total = pt2;

                    if (pt1 > 0 && !indicator.startsWith('pa')) {
                        p1Rec.total = pt1;
                        if (evalLevel) p1Rec.evalLevel = evalLevel;
                    }
                });

                // 3. Generar filas mapeadas finales
                groupedMap.forEach((rec) => {
                    let p1 = rec.p1, p2 = rec.p2, p3 = rec.p3, p4 = rec.p4, p5 = rec.p5;
                    let sum = p1 + p2 + p3 + p4 + p5;

                    if (sum === 0 && rec.total > 0) {
                        sum = rec.total;
                        const base = Math.floor(sum / 5);
                        let rem = sum % 5;
                        p1 = base + (rem-- > 0 ? 1 : 0);
                        p2 = base + (rem-- > 0 ? 1 : 0);
                        p3 = base + (rem-- > 0 ? 1 : 0);
                        p4 = base + (rem-- > 0 ? 1 : 0);
                        p5 = base + (rem-- > 0 ? 1 : 0);
                    }

                    if (sum > 0) {
                        mappedRows.push({
                            codigo_estudiante: rec.studentName,
                            materia: rec.subject,
                            periodo: rec.period,
                            prueba_1: p1,
                            prueba_2: p2,
                            guia: p3,
                            ejercitacion: p4,
                            actitudinal: p5,
                            comentario: ''
                        });
                    }
                });
            }

            if (mappedRows.length === 0) {
                throw new Error('No se pudieron extraer registros válidos de los archivos DBF cargados.');
            }

            setFileData(mappedRows);
            setStatus('loaded');
            addLog(`📁 Carpeta/Archivos DBF cargados exitosamente (${dbfFiles.length} archivos procesados). Se generaron ${mappedRows.length} filas con desglose exacto de parciales.`);
        } catch (err) {
            console.error(err);
            setErrorMessage(err.message);
            setStatus('error');
        }
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

                    let rawName = (row.nombre || '').trim();
                    let rawLastName = (row['last_name_[required]'] || row.last_name || row.apellidos || '').trim();
                    let rawFirstName = (row['first_name_[required]'] || row.first_name || row.nombres || '').trim();

                    let firstName = rawFirstName;
                    let lastName = '';
                    let secondLastName = '';

                    if (rawLastName) {
                        const parts = rawLastName.split(/\s+/);
                        lastName = parts[0] || '';
                        secondLastName = parts.slice(1).join(' ') || '';
                    }

                    if (!lastName && rawName) {
                        const words = rawName.split(/\s+/);
                        if (words.length >= 4) {
                            lastName = words[0];
                            secondLastName = words[1];
                            firstName = words.slice(2).join(' ');
                        } else if (words.length === 3) {
                            lastName = words[0];
                            secondLastName = words[1];
                            firstName = words[2];
                        } else if (words.length === 2) {
                            lastName = words[0];
                            firstName = words[1];
                        } else {
                            firstName = rawName;
                        }
                    }

                    if (sSnap.empty) {
                        const docRef = await addDoc(studentsRef, {
                            name: rawName || `${firstName} ${lastName} ${secondLastName}`.trim(),
                            firstName: firstName.toUpperCase(),
                            lastName: lastName.toUpperCase(),
                            secondLastName: secondLastName.toUpperCase(),
                            grade: row.curso,
                            id_code: row.codigo,
                            photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firstName)}`,
                            parent_uids: [parentUid]
                        });
                        studentId = docRef.id;
                        addLog(`Estudiante registrado: ${row.nombre} (Curso ${row.curso})`);
                    } else {
                        studentId = sSnap.docs[0].id;
                        await updateDoc(doc(db, 'students', studentId), {
                            firstName: firstName.toUpperCase(),
                            lastName: lastName.toUpperCase(),
                            secondLastName: secondLastName.toUpperCase(),
                            grade: row.curso,
                            parent_uids: [parentUid]
                        });
                        addLog(`Estudiante actualizado con curso ${row.curso} y acudiente: ${row.nombre}`);
                    }

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
                            comment: '',
                            created_at: new Date()
                        });
                    }

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

            // Cargar e indizar estudiantes en memoria con normalización insensible a mayúsculas/tildes
            const sSnapAll = await getDocs(studentsRef);
            const normalizeStr = (str) => {
                if (!str) return '';
                return str.toUpperCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^A-Z0-9]/g, "")
                    .trim();
            };

            const studentIndex = new Map();
            sSnapAll.docs.forEach(d => {
                const s = { id: d.id, ...d.data() };
                if (s.id_code) studentIndex.set(normalizeStr(s.id_code), s.id);

                const fullName = s.name || `${s.lastName} ${s.firstName}`;
                studentIndex.set(normalizeStr(fullName), s.id);

                const reverseName = `${s.lastName} ${s.firstName}`;
                studentIndex.set(normalizeStr(reverseName), s.id);

                const directName = `${s.firstName} ${s.lastName}`;
                studentIndex.set(normalizeStr(directName), s.id);

                if (s.grade && fullName) {
                    studentIndex.set(normalizeStr(`${s.grade}_${fullName}`), s.id);
                    studentIndex.set(normalizeStr(`${s.grade}_${reverseName}`), s.id);
                    studentIndex.set(normalizeStr(`${s.grade}_${directName}`), s.id);
                }
            });

            for (let i = 0; i < fileData.length; i++) {
                const row = fileData[i];
                addLog(`[${i + 1}/${fileData.length}] Procesando notas de: ${row.codigo_estudiante}...`);

                try {
                    const studentId = studentIndex.get(normalizeStr(row.codigo_estudiante));

                    if (!studentId) {
                        addLog(`⚠️ Estudiante no encontrado (${row.codigo_estudiante}). Omitiendo.`);
                        setProgress(prev => ({ ...prev, current: i + 1 }));
                        continue;
                    }

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
                        comment: row.comentario || '',
                        created_at: new Date()
                    };

                    if (gSnap.empty) {
                        await addDoc(gradesRef, gradeData);
                        addLog(`Nota creada: ${row.materia} (Per ${periodNum}) -> ${sum}`);
                    } else {
                        await updateDoc(doc(db, 'grades', gSnap.docs[0].id), gradeData);
                        addLog(`Nota actualizada: ${row.materia} (Per ${periodNum}) -> ${sum}`);
                    }

                } catch (rowError) {
                    addLog(`⚠️ Error en fila ${i + 1}: ${rowError.message}`);
                }
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            addLog('¡Importación de calificaciones completada exitosamente!');
            setStatus('success');
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
            setStatus('error');
            addLog(`Error crítico: ${error.message}`);
        }
    }

    return (
        <div className="max-w-[98%] xl:max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-150">
                            Módulo de Administración
                        </span>
                    </div>
                    <h1 className="text-xl font-extrabold text-slate-800 tracking-tight mt-2">
                        Importación Masiva de Datos
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        Carga alumnos, acudientes y calificaciones desde carpetas **FoxPro (.DBF)** o planillas **CSV**.
                    </p>
                </div>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                    <button
                        onClick={() => handleTabChange('courses')}
                        className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'courses' 
                                ? 'bg-white text-indigo-650 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={16} />
                        1. Alumnos y Cursos
                    </button>
                    <button
                        onClick={() => handleTabChange('grades')}
                        className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'grades' 
                                ? 'bg-white text-indigo-650 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Table size={16} />
                        2. Calificaciones
                    </button>
                </div>
            </div>

            {/* Formulario Principal */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-150 space-y-6">
                
                {/* Formatos Aceptados Badge */}
                <div className="bg-indigo-50/60 border border-indigo-150 rounded-2xl p-4 flex items-start gap-3">
                    <Database className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                    <div className="text-xs text-indigo-950 font-semibold space-y-1">
                        <p className="font-extrabold text-indigo-900">Soporte para carpetas de FoxPro (.DBF) y plantillas CSV</p>
                        <p className="text-indigo-800/80">
                            La secretaria puede seleccionar la <strong>carpeta completa del profesor/sistema</strong> (que incluye <code>LUISMT2.DBF</code>, <code>pareval.dbf</code>, etc.) o archivos sueltos. El sistema cruzará automáticamente las parciales y las notas consolidadas.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Opción A: Cargar Carpeta Completa DBF */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <FolderPlus size={12} /> Opción Recomendada: Subir Carpeta DBF Completa
                        </span>
                        <label className="border-2 border-dashed border-indigo-300 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-indigo-50/60 hover:border-indigo-500 transition active-press bg-indigo-50/20">
                            <FolderPlus size={20} className="text-indigo-600 shrink-0" />
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-indigo-900 font-extrabold truncate max-w-[220px]">
                                    {fileName && fileName.includes('Carpeta') ? fileName : 'Seleccionar Carpeta del Profesor...'}
                                </span>
                                <span className="text-[10px] text-indigo-700/80 font-bold">Carga `pareval.dbf` + `LUISMT2.DBF` juntos</span>
                            </div>
                            <input 
                                type="file" 
                                webkitdirectory="true" 
                                directory="true" 
                                multiple 
                                onChange={handleFileChange} 
                                className="hidden" 
                            />
                        </label>
                    </div>

                    {/* Opción B: Cargar Archivo Único CSV o DBF */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Upload size={12} /> Opción Secundaria: Subir Archivo Único (CSV o DBF)
                        </span>
                        <label className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50/50 hover:border-slate-350 transition active-press">
                            <Upload size={18} className="text-slate-400 shrink-0" />
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-slate-650 font-bold truncate max-w-[200px]">
                                    {fileName && !fileName.includes('Carpeta') ? fileName : 'Seleccionar archivo suelto...'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">Archivos `.csv` o `.dbf` individuales</span>
                            </div>
                            <input 
                                type="file" 
                                accept=".csv, .dbf, .DBF" 
                                multiple 
                                onChange={handleFileChange} 
                                className="hidden" 
                            />
                        </label>
                    </div>

                </div>

                {activeTab === 'courses' && (
                    <div className="flex flex-col max-w-xs">
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
                        
                        <div className="bg-emerald-50/60 border border-emerald-150 text-emerald-900 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
                            <span className="font-bold">✓ {fileData.length} registros listos para procesar con parciales exactas.</span>
                            <button
                                onClick={activeTab === 'courses' ? handleImportCourses : handleImportGrades}
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition active-press select-none"
                            >
                                Iniciar Procesamiento Masivo
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Vista Previa de Filas a Importar ({activeTab === 'courses' ? 'Modo: Alumnos y Cursos' : 'Modo: Calificaciones'}):
                                </h3>
                                {activeTab === 'courses' && (
                                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        💡 Si deseas importar Notas, cambia a la pestaña "2. Calificaciones" arriba.
                                    </span>
                                )}
                            </div>
                            <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-[520px] shadow-sm bg-white">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-100/90 border-b sticky top-0 font-extrabold text-slate-700 select-none shadow-xs">
                                            {activeTab === 'courses' ? (
                                                <>
                                                    <th className="px-4 py-3 min-w-[180px]">Nombre Estudiante</th>
                                                    <th className="px-3 py-3 text-center">Curso</th>
                                                    <th className="px-3 py-3 min-w-[100px]">Código</th>
                                                    <th className="px-4 py-3 min-w-[200px]">Correo Acudiente</th>
                                                    <th className="px-4 py-3 min-w-[200px]">Nombre Acudiente</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="px-4 py-3 min-w-[200px]">Código / Nombre Alumno</th>
                                                    <th className="px-4 py-3 min-w-[140px]">Materia</th>
                                                    <th className="px-3 py-3 text-center">Periodo</th>
                                                    <th className="px-3 py-3 text-center">Prueba 1</th>
                                                    <th className="px-3 py-3 text-center">Prueba 2</th>
                                                    <th className="px-3 py-3 text-center">Ejercitación</th>
                                                    <th className="px-3 py-3 text-center">Guías</th>
                                                    <th className="px-3 py-3 text-center">Actitudinal</th>
                                                    <th className="px-4 py-3 text-center bg-indigo-100/80 text-indigo-950 font-black">Definitiva</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                                        {fileData.slice(0, 20).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition">
                                                {activeTab === 'courses' ? (
                                                    <>
                                                        <td className="px-4 py-3 whitespace-nowrap font-extrabold text-slate-800">{row.nombre}</td>
                                                        <td className="px-3 py-3 text-center whitespace-nowrap">{row.curso}</td>
                                                        <td className="px-3 py-3 whitespace-nowrap font-mono text-indigo-650">{row.codigo}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500">{row.email_padre}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{row.nombre_padre}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-3 whitespace-nowrap font-extrabold text-slate-800">{row.codigo_estudiante}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-indigo-700 font-bold">{row.materia}</td>
                                                        <td className="px-3 py-3 text-center font-bold">{row.periodo}</td>
                                                        <td className="px-3 py-3 text-center font-mono">{row.prueba_1}</td>
                                                        <td className="px-3 py-3 text-center font-mono">{row.prueba_2}</td>
                                                        <td className="px-3 py-3 text-center font-mono">{row.ejercitacion}</td>
                                                        <td className="px-3 py-3 text-center font-mono">{row.guia}</td>
                                                        <td className="px-3 py-3 text-center font-mono">{row.actitudinal}</td>
                                                        <td className="px-4 py-3 text-center font-mono font-black bg-indigo-50/70 text-indigo-900">
                                                            {(Number(row.prueba_1) || 0) + (Number(row.prueba_2) || 0) + (Number(row.ejercitacion) || 0) + (Number(row.guia) || 0) + (Number(row.actitudinal) || 0)}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {fileData.length > 20 && (
                                <p className="text-[10px] text-slate-400 italic text-right mt-1.5 pr-2">Mostrando las primeras 20 filas de {fileData.length} registros...</p>
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
