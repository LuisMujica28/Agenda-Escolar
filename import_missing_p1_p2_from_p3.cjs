const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');
require('dotenv').config();

function stripAccents(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
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
    'INF': 'Tecnología e Informática',
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

function distributeScore(score) {
    const base = Math.floor(score / 5);
    const remainder = score % 5;
    return {
        prueba1: base + (remainder > 0 ? 1 : 0),
        prueba2: base + (remainder > 1 ? 1 : 0),
        guia: base + (remainder > 2 ? 1 : 0),
        ejercitacion: base + (remainder > 3 ? 1 : 0),
        actitudinal: base
    };
}

async function importMissingP1AndP2() {
    console.log("=================================================================");
    console.log("🚀 IMPORTANDO NOTAS FALTANTES DE PERIODO 1 Y 2 DESDE CARPETA P3");
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
    console.log(`📂 Carpetas de profesores encontradas en 3° Periodo (${teacherFolders.length}): ${teacherFolders.join(', ')}\n`);

    // 1. Cargar mapa de estudiantes en Firestore
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`👥 Estudiantes registrados en Firestore: ${studentsSnap.size}`);

    const studentMap = new Map();
    studentsSnap.docs.forEach(d => {
        const s = { id: d.id, ...d.data() };
        const normName = stripAccents(s.name || ((s.lastName || '') + ' ' + (s.firstName || '')));
        const gradeStr = String(parseInt(s.grade, 10));
        const words = normName.split(/\s+/).filter(Boolean).sort().join('_');

        studentMap.set(`${gradeStr}_${normName}`, s.id);
        studentMap.set(normName, s.id);
        studentMap.set(`${gradeStr}_${words}`, s.id);
        studentMap.set(words, s.id);
    });

    // 2. Cargar todas las notas existentes en Firestore
    const gradesSnap = await getDocs(collection(db, 'grades'));
    const existingGrades = new Set();
    gradesSnap.docs.forEach(d => {
        const g = d.data();
        existingGrades.add(`${g.student_id}_${g.subject}_${g.period}`);
    });
    console.log(`📋 Calificaciones actualmente en Firestore: ${existingGrades.size}`);

    // 3. Indexar evaluaciones parciales pareval.dbf para periodos 1 y 2
    const parevalMap = new Map();
    let totalParevalP1P2 = 0;

    for (const t of teacherFolders) {
        const subDirs = fs.readdirSync(path.join(baseDir, t)).filter(s => fs.statSync(path.join(baseDir, t, s)).isDirectory());
        const innerDir = subDirs.length > 0 ? path.join(baseDir, t, subDirs[0]) : path.join(baseDir, t);
        const parevalPath = path.join(innerDir, 'pareval.dbf');
        if (!fs.existsSync(parevalPath)) continue;

        const pRecs = parseDBF(fs.readFileSync(parevalPath));
        pRecs.forEach(p => {
            const per = (p.PARPER || '').trim();
            if (per !== '1' && per !== '2') return;

            totalParevalP1P2++;
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

            parevalMap.set(`${course}_${mat}_${normName}_${per}`, pData);
            parevalMap.set(`${course}_${mat}_${words}_${per}`, pData);
            parevalMap.set(`${normName}_${mat}_${per}`, pData);
        });
    }
    console.log(`📌 Evaluaciones parciales P1/P2 indexadas desde pareval.dbf: ${totalParevalP1P2}`);

    // 4. Buscar notas faltantes de P1 y P2 en alumplan.dbf
    const gradesToInsert = [];
    const summaryByGroup = {};

    for (const t of teacherFolders) {
        const subDirs = fs.readdirSync(path.join(baseDir, t)).filter(s => fs.statSync(path.join(baseDir, t, s)).isDirectory());
        const innerDir = subDirs.length > 0 ? path.join(baseDir, t, subDirs[0]) : path.join(baseDir, t);
        const alumplanPath = path.join(innerDir, 'alumplan.dbf');
        if (!fs.existsSync(alumplanPath)) continue;

        const aRecs = parseDBF(fs.readFileSync(alumplanPath));
        aRecs.forEach(r => {
            const rawGrade = (r.ALUGRA || '') + (r.ALUPAR || '');
            const course = String(parseInt(rawGrade, 10));
            const rawName = (r.ALUNOM || '').trim();
            const normName = stripAccents(rawName);
            const words = normName.split(/\s+/).filter(Boolean).sort().join('_');

            const studentId = studentMap.get(`${course}_${normName}`) ||
                              studentMap.get(`${course}_${words}`) ||
                              studentMap.get(normName) ||
                              studentMap.get(words);

            if (!studentId) return;

            const matCode = (r.ALUMAT || '').trim().toUpperCase();
            const subject = subjectMap[matCode] || matCode;
            const teacherId = (r.ALUPROF || t).trim().toUpperCase();

            // Evaluar Periodo 1
            const p1Score = Number(r.ALUPT1);
            if (p1Score > 0 && !existingGrades.has(`${studentId}_${subject}_1`)) {
                let comp = parevalMap.get(`${course}_${matCode}_${normName}_1`) ||
                           parevalMap.get(`${course}_${matCode}_${words}_1`) ||
                           parevalMap.get(`${normName}_${matCode}_1`);

                if (!comp) {
                    comp = distributeScore(p1Score);
                } else {
                    comp = {
                        prueba1: comp.prueba1,
                        prueba2: comp.prueba2,
                        guia: comp.guia,
                        ejercitacion: comp.ejercitacion,
                        actitudinal: comp.actitudinal
                    };
                }

                const docObj = {
                    student_id: studentId,
                    teacher_id: teacherId,
                    subject: subject,
                    period: 1,
                    grade: p1Score,
                    components: comp,
                    comment: r.ALUCO1 ? `Desempeño: ${r.ALUCO1.trim()}` : '',
                    created_at: new Date()
                };

                gradesToInsert.push(docObj);
                existingGrades.add(`${studentId}_${subject}_1`); // Evitar duplicar en misma corrida

                const grpKey = `${teacherId} | Curso ${course} | ${subject} | P1`;
                summaryByGroup[grpKey] = (summaryByGroup[grpKey] || 0) + 1;
            }

            // Evaluar Periodo 2
            const p2Score = Number(r.ALUPT2);
            if (p2Score > 0 && !existingGrades.has(`${studentId}_${subject}_2`)) {
                let comp = parevalMap.get(`${course}_${matCode}_${normName}_2`) ||
                           parevalMap.get(`${course}_${matCode}_${words}_2`) ||
                           parevalMap.get(`${normName}_${matCode}_2`);

                if (!comp) {
                    comp = distributeScore(p2Score);
                } else {
                    comp = {
                        prueba1: comp.prueba1,
                        prueba2: comp.prueba2,
                        guia: comp.guia,
                        ejercitacion: comp.ejercitacion,
                        actitudinal: comp.actitudinal
                    };
                }

                const docObj = {
                    student_id: studentId,
                    teacher_id: teacherId,
                    subject: subject,
                    period: 2,
                    grade: p2Score,
                    components: comp,
                    comment: r.ALUCO2 ? `Desempeño: ${r.ALUCO2.trim()}` : '',
                    created_at: new Date()
                };

                gradesToInsert.push(docObj);
                existingGrades.add(`${studentId}_${subject}_2`);

                const grpKey = `${teacherId} | Curso ${course} | ${subject} | P2`;
                summaryByGroup[grpKey] = (summaryByGroup[grpKey] || 0) + 1;
            }
        });
    }

    console.log(`\n✨ Calificaciones faltantes identificadas para insertar: ${gradesToInsert.length}`);
    console.table(Object.entries(summaryByGroup).map(([grupo, cantidad]) => ({ grupo, cantidad })));

    if (gradesToInsert.length === 0) {
        console.log("No hay calificaciones faltantes por insertar. Todo está al día.");
        return;
    }

    // 5. Insertar en lotes de 400 documentos
    const BATCH_SIZE = 400;
    let written = 0;

    for (let i = 0; i < gradesToInsert.length; i += BATCH_SIZE) {
        const chunk = gradesToInsert.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const g of chunk) {
            const docRef = doc(collection(db, 'grades'));
            batch.set(docRef, g);
            written++;
        }

        await batch.commit();
        console.log(`  └─ Guardado lote ${Math.floor(i / BATCH_SIZE) + 1} (${written}/${gradesToInsert.length} notas)...`);
    }

    console.log(`\n🎉 IMPORTACIÓN COMPLETADA: ${written} calificaciones de P1 y P2 guardadas exitosamente en Firestore!`);
}

importMissingP1AndP2().then(() => process.exit(0)).catch(err => {
    console.error("❌ Error en importación:", err);
    process.exit(1);
});
