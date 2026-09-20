const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, writeBatch, addDoc } = require('firebase/firestore');
require('dotenv').config();

function stripAccents(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function toTitleCase(str) {
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function splitName(fullName) {
    const words = fullName.trim().split(/\s+/);
    if (words.length === 2) {
        return { firstName: words[1], lastName: words[0] };
    } else if (words.length === 3) {
        return { firstName: words[2], lastName: `${words[0]} ${words[1]}` };
    } else if (words.length >= 4) {
        return { firstName: words.slice(2).join(' '), lastName: `${words[0]} ${words[1]}` };
    }
    return { firstName: fullName, lastName: '' };
}

function parseDBF(buffer) {
    const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    if (bytes.length < 32) return [];

    const numRecords = dataView.getUint32(4, true);
    const headerLen = dataView.getUint16(8, true);
    const recordLen = dataView.getUint16(10, true);

    const fields = [];
    let offset = 32;
    const decoder = new TextDecoder('windows-1252');

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
        if (deleteFlag === 0x2A) {
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
}

const subjectMap = {
    'MAT': 'Matemáticas',
    'GEO': 'Geometría',
    'FIS': 'C. Naturales (Física)',
    'FIC': 'C. Naturales (Física)',
    'BIO': 'C. Naturales (Biología)',
    'CIE': 'C. Naturales (Biología)',
    'YUD': 'C. Naturales (Biología)',
    'QUI': 'C Naturales (Química)',
    'ESP': 'Español y Literatura',
    'ING': 'Inglés',
    'ART': 'Artes plásticas',
    'EAR': 'Artes plásticas',
    'EFI': 'Ed Física',
    'ETI': 'Ed Ética y Valores',
    'REL': 'Ed Religiosa y Moral',
    'SOC': 'C Sociales Filosofía',
    'FIL': 'C Sociales Filosofía',
    'POL': 'C Políticas Económicas',
    'TEC': 'Tecnología e Informática',
    'XCS': 'Ed Ética y Valores'
};

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const isDryRun = process.argv.includes('--dry-run');

async function importPeriod3Grades() {
    console.log("=================================================================");
    console.log(`🚀 IMPORTADOR DE CALIFICACIONES - 3° PERIODO ${isDryRun ? '(MODO SIMULACIÓN / DRY-RUN)' : '(MODO ESCRITURA REAL)'}`);
    console.log("=================================================================\n");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    await signInWithEmailAndPassword(auth, 'admin@colegio.com', 'colegio123');
    console.log("🔒 Autenticado exitosamente como Administrador en Firebase.");

    const baseDir = path.join(process.cwd(), 'Notas 3° Periodo', 'Archivo notas 3 periodo');
    if (!fs.existsSync(baseDir)) {
        throw new Error(`No se encontró la carpeta: ${baseDir}`);
    }

    const teacherFolders = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());
    console.log(`📂 Carpetas de profesores encontradas en 3° Periodo (${teacherFolders.length}):`);
    console.log(`   ${teacherFolders.join(', ')}\n`);

    // 1. Cargar estudiantes de Firestore
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`👥 Estudiantes registrados en Firestore: ${studentsSnap.size}`);

    const studentMap = new Map();
    const studentsList = [];

    studentsSnap.docs.forEach(d => {
        const s = { id: d.id, ...d.data() };
        studentsList.push(s);

        const normName = stripAccents(s.name || `${s.lastName || ''} ${s.firstName || ''}`);
        const gradeStr = String(parseInt(s.grade, 10));
        const words = normName.split(/\s+/).filter(Boolean).sort().join('_');

        studentMap.set(`${gradeStr}_${normName}`, s.id);
        studentMap.set(normName, s.id);
        studentMap.set(`${gradeStr}_${words}`, s.id);
        studentMap.set(words, s.id);
    });

    // 2. Extraer todas las evaluaciones parciales pareval para Periodo 3
    // Key: `${course}_${mat}_${normName}` -> components
    const parevalMap = new Map();
    let totalParevalRows = 0;

    for (const t of teacherFolders) {
        const subDirs = fs.readdirSync(path.join(baseDir, t)).filter(s => fs.statSync(path.join(baseDir, t, s)).isDirectory());
        const innerDir = subDirs.length > 0 ? path.join(baseDir, t, subDirs[0]) : path.join(baseDir, t);
        const parevalPath = path.join(innerDir, 'pareval.dbf');
        if (!fs.existsSync(parevalPath)) continue;

        const pRecs = parseDBF(fs.readFileSync(parevalPath));
        pRecs.forEach(p => {
            if (p.PARPER !== '3') return;
            totalParevalRows++;

            const rawCourse = (p.PARCURSO || '').replace(/^U0?/, '');
            const course = String(parseInt(rawCourse, 10));
            const mat = (p.PARMAT || '').trim().toUpperCase();
            const normName = stripAccents(p.PARNOMAL || '');
            const words = normName.split(/\s+/).filter(Boolean).sort().join('_');

            const pData = {
                prueba1: Number(p.PA1) || 0,
                prueba2: Number(p.PA2) || 0,
                guia: Number(p.PA3) || 0,
                ejercitacion: Number(p.PA4) || 0,
                actitudinal: Number(p.PA5) || 0,
                teacher: (p.PAPROF || '').trim()
            };

            parevalMap.set(`${course}_${mat}_${normName}`, pData);
            parevalMap.set(`${course}_${mat}_${words}`, pData);
        });
    }
    console.log(`📋 Parciales de 3° Periodo extraídas de pareval.dbf: ${totalParevalRows} registros.`);

    // 3. Procesar alumplan.dbf de todos los profesores
    const gradesToUpsert = new Map(); // key: `${studentId}_${subject}_3` -> gradeDoc
    const newStudentsToCreate = new Map(); // key: normName -> { grade, name, ... }

    let countAlumplanP3 = 0;

    for (const t of teacherFolders) {
        const subDirs = fs.readdirSync(path.join(baseDir, t)).filter(s => fs.statSync(path.join(baseDir, t, s)).isDirectory());
        const innerDir = subDirs.length > 0 ? path.join(baseDir, t, subDirs[0]) : path.join(baseDir, t);
        const alumplanPath = path.join(innerDir, 'alumplan.dbf');
        if (!fs.existsSync(alumplanPath)) continue;

        const aRecs = parseDBF(fs.readFileSync(alumplanPath));
        aRecs.forEach(r => {
            const p3Score = Number(r.ALUPT3);
            if (isNaN(p3Score) || p3Score <= 0) return;

            countAlumplanP3++;

            const rawGrade = (r.ALUGRA || '') + (r.ALUPAR || '');
            const course = String(parseInt(rawGrade, 10));
            const rawName = (r.ALUNOM || '').trim();
            const normName = stripAccents(rawName);
            const words = normName.split(/\s+/).filter(Boolean).sort().join('_');

            const matCode = (r.ALUMAT || '').trim().toUpperCase();
            const subject = subjectMap[matCode] || matCode;
            const teacherCode = (r.ALUPROF || t).trim();
            const evalLevel = (r.ALUCO3 || '').trim();

            let studentId = studentMap.get(`${course}_${normName}`) ||
                            studentMap.get(`${course}_${words}`) ||
                            studentMap.get(normName) ||
                            studentMap.get(words);

            if (!studentId) {
                if (!newStudentsToCreate.has(normName)) {
                    newStudentsToCreate.set(normName, {
                        grade: course,
                        rawName: rawName,
                        normName: normName
                    });
                }
            }

            // Buscar parciales
            const parKey1 = `${course}_${matCode}_${normName}`;
            const parKey2 = `${course}_${matCode}_${words}`;
            const parData = parevalMap.get(parKey1) || parevalMap.get(parKey2);

            let components;
            if (parData) {
                components = {
                    prueba1: parData.prueba1,
                    prueba2: parData.prueba2,
                    guia: parData.guia,
                    ejercitacion: parData.ejercitacion,
                    actitudinal: parData.actitudinal
                };
            } else {
                const scaleVal = Math.round(p3Score / 5);
                components = {
                    prueba1: scaleVal,
                    prueba2: scaleVal,
                    guia: scaleVal,
                    ejercitacion: scaleVal,
                    actitudinal: scaleVal
                };
            }

            const comment = evalLevel ? `Desempeño: ${evalLevel}` : '';

            // Clave temporal de calificación
            const tempKey = `${course}_${normName}_${subject}_3`;
            gradesToUpsert.set(tempKey, {
                course,
                normName,
                studentId, // Puede ser asignado luego si es nuevo
                teacher_id: teacherCode,
                subject,
                period: 3,
                grade: p3Score,
                components,
                comment,
                created_at: new Date()
            });
        });
    }

    console.log(`📊 Notas de 3° Periodo identificadas en alumplan: ${countAlumplanP3}`);
    console.log(`✨ Calificaciones consolidadas listas para subir: ${gradesToUpsert.size}`);

    // 4. Si hay estudiantes nuevos, crearlos en Firestore
    if (newStudentsToCreate.size > 0) {
        console.log(`\n🆕 Estudiantes nuevos detectados en 3° Periodo (${newStudentsToCreate.size}):`);
        for (const [normName, info] of newStudentsToCreate.entries()) {
            console.log(`   - [Curso ${info.grade}] ${info.rawName}`);
            
            if (!isDryRun) {
                const { firstName, lastName } = splitName(normName);
                const titleName = toTitleCase(`${firstName} ${lastName}`);
                
                // Generar id_code
                const courseStudents = studentsList.filter(s => String(s.grade) === info.grade);
                const nextSeq = String(courseStudents.length + 1).padStart(3, '0');
                const idCode = `ST-${info.grade}-${nextSeq}`;

                const docRef = await addDoc(collection(db, 'students'), {
                    name: titleName,
                    firstName: firstName.toUpperCase(),
                    lastName: lastName.toUpperCase(),
                    grade: info.grade,
                    id_code: idCode,
                    photo_url: '',
                    parent_uids: [],
                    created_at: new Date()
                });

                const createdId = docRef.id;
                console.log(`     -> Creado en Firestore con ID: ${createdId}, Código: ${idCode}`);
                
                studentMap.set(`${info.grade}_${normName}`, createdId);
                studentMap.set(normName, createdId);
                studentsList.push({ id: createdId, grade: info.grade, name: titleName });
            } else {
                studentMap.set(normName, `simulated-id-${normName}`);
            }
        }
    }

    // 5. Vincular studentId a todas las notas
    let readyToSaveCount = 0;
    const finalGradesList = [];

    gradesToUpsert.forEach((g) => {
        const sid = g.studentId || studentMap.get(`${g.course}_${g.normName}`) || studentMap.get(g.normName);
        if (sid) {
            finalGradesList.push({
                student_id: sid,
                teacher_id: g.teacher_id,
                subject: g.subject,
                period: 3,
                grade: g.grade,
                components: g.components,
                comment: g.comment,
                created_at: g.created_at
            });
            readyToSaveCount++;
        } else {
            console.warn(`⚠️ No se pudo asignar student_id a nota: ${g.normName} - ${g.subject}`);
        }
    });

    console.log(`\n📦 Total de calificaciones finales listas para guardar: ${readyToSaveCount}`);

    if (isDryRun) {
        console.log("\n✅ SIMULACIÓN EXITOSA. Ninguna escritura fue realizada en Firestore.");
        console.log("   Para ejecutar la subida real, ejecuta el comando sin '--dry-run'.");
        process.exit(0);
    }

    // 6. Escritura real por lotes en Firestore
    console.log("\n🚀 Escribiendo calificaciones en Firestore en lotes de 400...");
    const BATCH_SIZE = 400;
    const totalBatches = Math.ceil(finalGradesList.length / BATCH_SIZE);

    for (let bIdx = 0; bIdx < totalBatches; bIdx++) {
        const batch = writeBatch(db);
        const chunk = finalGradesList.slice(bIdx * BATCH_SIZE, (bIdx + 1) * BATCH_SIZE);

        chunk.forEach(gradeData => {
            const newDocRef = doc(collection(db, 'grades'));
            batch.set(newDocRef, gradeData);
        });

        await batch.commit();
        console.log(`   [${bIdx + 1}/${totalBatches}] Lote guardado: ${chunk.length} notas escritas.`);
    }

    console.log("\n🎉 ¡IMPORTACIÓN DE 3° PERIODO COMPLETADA CON ÉXITO TOTAL!");
    process.exit(0);
}

importPeriod3Grades().catch(err => {
    console.error("❌ ERROR DURANTE LA IMPORTACIÓN:", err);
    process.exit(1);
});
