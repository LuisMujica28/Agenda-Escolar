import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, query, where, writeBatch } from 'firebase/firestore';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function stripAccents(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function toTitleCase(str) {
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
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
    'XCS': 'Ed Ética y Valores'
};

async function runFullTeacherImport() {
    console.log("=================================================");
    console.log("🚀 INICIANDO IMPORTACIÓN MULTI-PROFESOR -> FIREBASE");
    console.log("=================================================\n");

    const rawData = fs.readFileSync('all_teacher_dbf_data.json', 'utf-8');
    const dbfData = JSON.parse(rawData);

    const alumplan = dbfData.alumplan || [];
    const pareval = dbfData.pareval || [];

    console.log(`📊 Leídas ${alumplan.length} filas consolidadas de ALUMPLAN.DBF / LUISMT2.DBF`);
    console.log(`📋 Leídas ${pareval.length} filas de evaluaciones parciales (pareval.dbf)`);

    // 1. Indexar evaluaciones parciales (pareval)
    // Key: "701_ESP_2_AGUDELO HURTADO MARIAM CAMILA" -> components
    const parevalMap = new Map();
    pareval.forEach(p => {
        const rawCourse = (p.PARCURSO || '').replace(/^U0?/, '');
        const course = parseInt(rawCourse, 10).toString();
        const mat = (p.PARMAT || '').trim().toUpperCase();
        const per = (p.PARPER || '').trim();
        const name = stripAccents(p.PARNOMAL || '');

        if (!course || !mat || !per || !name) return;

        const key = `${course}_${mat}_${per}_${name}`;
        parevalMap.set(key, {
            prueba1: Number(p.PA1) || 0,
            prueba2: Number(p.PA2) || 0,
            guia: Number(p.PA3) || 0,
            ejercitacion: Number(p.PA4) || 0,
            actitudinal: Number(p.PA5) || 0,
            teacher: (p.PAPROF || '').trim()
        });
    });

    console.log(`📌 Indizadas ${parevalMap.size} claves parciales en parevalMap.`);

    // 2. Cargar/crear mapa de estudiantes en Firestore
    const studentsSnap = await getDocs(collection(db, 'students'));
    const existingStudentsMap = new Map();

    studentsSnap.docs.forEach(d => {
        const s = d.data();
        const fullNorm = stripAccents(s.name || `${s.lastName} ${s.firstName}`);
        const gradeStr = String(s.grade);

        existingStudentsMap.set(`${gradeStr}_${fullNorm}`, { id: d.id, ...s });
        existingStudentsMap.set(fullNorm, { id: d.id, ...s });
    });

    console.log(`👥 Estudiantes existentes en Firestore: ${studentsSnap.size}`);

    // Crear o recuperar mapa de estudiantes a partir del archivo general
    const studentDocIdMap = new Map();
    const studentCounters = {};

    for (const r of alumplan) {
        const rawGrade = (r.ALUGRA || '') + (r.ALUPAR || '');
        const rawName = (r.ALUNOM || '').trim();
        if (!rawGrade || !rawName) continue;

        const grade = parseInt(rawGrade, 10).toString();
        const fullNorm = stripAccents(rawName);
        const key = `${grade}_${fullNorm}`;

        if (studentDocIdMap.has(key)) continue;

        let studentId;
        const match = existingStudentsMap.get(key) || existingStudentsMap.get(fullNorm);

        if (match) {
            studentId = match.id;
        } else {
            // Crear nuevo estudiante si no existe
            const { firstName, lastName } = splitName(fullNorm);
            const titleName = toTitleCase(`${firstName} ${lastName}`);

            if (!studentCounters[grade]) studentCounters[grade] = 1;
            const countStr = String(studentCounters[grade]).padStart(3, '0');
            studentCounters[grade]++;
            const idCode = `ST-${grade}-${countStr}`;

            const newDocRef = await addDoc(collection(db, 'students'), {
                name: titleName,
                firstName: firstName.toUpperCase(),
                lastName: lastName.toUpperCase(),
                grade: grade,
                id_code: idCode,
                photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firstName)}`,
                parent_uids: [],
                created_at: new Date()
            });

            studentId = newDocRef.id;
            existingStudentsMap.set(key, { id: studentId, grade, name: titleName });
        }

        studentDocIdMap.set(key, studentId);
    }

    console.log(`✅ ${studentDocIdMap.size} Estudiantes validados en el mapa.`);

    // 3. Procesar Calificaciones (Batch Write)
    console.log("\n📝 Guardando Calificaciones de todos los docentes en Firestore...");

    const gradesToUpsert = new Map(); // key: "studentId_subject_period" -> gradeObject

    for (const r of alumplan) {
        const rawGrade = (r.ALUGRA || '') + (r.ALUPAR || '');
        const rawName = (r.ALUNOM || '').trim();
        if (!rawGrade || !rawName) continue;

        const grade = parseInt(rawGrade, 10).toString();
        const fullNorm = stripAccents(rawName);
        const key = `${grade}_${fullNorm}`;

        const studentId = studentDocIdMap.get(key);
        if (!studentId) continue;

        const matCode = (r.ALUMAT || '').trim().toUpperCase();
        if (!matCode) continue;

        const mappedSubject = subjectMap[matCode] || matCode;
        const teacherCode = (r.ALUPROF || 'DOCENTE').trim();

        // Procesar Periodos 1 y 2
        const periodsToProcess = [
            { periodNum: 1, scoreVal: r.ALUPT1, evalLevel: r.ALUCO1 },
            { periodNum: 2, scoreVal: r.ALUPT2, evalLevel: r.ALUCO2 }
        ];

        for (const p of periodsToProcess) {
            const scoreNum = Number(p.scoreVal);
            if (isNaN(scoreNum) || p.scoreVal === '' || scoreNum <= 0) continue;

            const gradeKey = `${studentId}_${mappedSubject}_${p.periodNum}`;

            // Buscar componentes parciales en parevalMap
            const parKey = `${grade}_${matCode}_${p.periodNum}_${fullNorm}`;
            let parData = parevalMap.get(parKey);

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
                const scaleVal = Math.round(scoreNum / 5);
                components = {
                    prueba1: scaleVal,
                    prueba2: scaleVal,
                    guia: scaleVal,
                    ejercitacion: scaleVal,
                    actitudinal: scaleVal
                };
            }

            const commentStr = p.evalLevel ? `Desempeño: ${p.evalLevel}` : '';

            gradesToUpsert.set(gradeKey, {
                student_id: studentId,
                teacher_id: teacherCode,
                subject: mappedSubject,
                period: p.periodNum,
                grade: scoreNum,
                components,
                comment: commentStr,
                created_at: new Date()
            });
        }
    }

    console.log(`📦 Preparadas ${gradesToUpsert.size} calificaciones únicas para guardar en Firestore.`);

    // Limpiar notas anteriores para asegurar reemplazo limpio
    console.log("🧹 Limpiando calificaciones anteriores...");
    const oldGradesSnap = await getDocs(collection(db, 'grades'));
    const oldDocs = oldGradesSnap.docs;
    const PURGE_BATCH = 400;
    for (let i = 0; i < oldDocs.length; i += PURGE_BATCH) {
        const batch = writeBatch(db);
        oldDocs.slice(i, i + PURGE_BATCH).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    console.log(`✅ ${oldDocs.length} calificaciones antiguas eliminadas.`);

    // 4. Ejecutar Batch Writes en bloques de 400 documentos
    const allGradeEntries = Array.from(gradesToUpsert.entries());
    const BATCH_SIZE = 400;
    let writtenCount = 0;

    for (let i = 0; i < allGradeEntries.length; i += BATCH_SIZE) {
        const chunk = allGradeEntries.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const [gKey, gObj] of chunk) {
            const docRef = doc(collection(db, 'grades'));
            batch.set(docRef, gObj);
            writtenCount++;
        }

        await batch.commit();
        console.log(`  └─ Guardado lote ${Math.floor(i / BATCH_SIZE) + 1} (${writtenCount}/${allGradeEntries.length} notas)...`);
    }

    console.log(`\n🎉 IMPORTACIÓN MULTI-DOCENTE FINALIZADA CON ÉXITO!`);
    console.log(`- Calificaciones insertadas: ${writtenCount}`);
}

runFullTeacherImport().then(() => process.exit(0)).catch(err => {
    console.error("❌ Error en importación:", err);
    process.exit(1);
});
