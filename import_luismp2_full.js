import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, query, where, writeBatch } from 'firebase/firestore';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

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

async function runFullImport() {
    console.log("=========================================");
    console.log("🚀 INICIANDO IMPORTACIÓN AUTOMÁTICA LUISMP2 -> FIREBASE");
    console.log("=========================================\n");

    const rawOutput = execSync('python dump_dbf.py', { maxBuffer: 15 * 1024 * 1024 }).toString();
    const dbfData = JSON.parse(rawOutput);

    const luismt2 = dbfData.luismt2 || [];
    const pareval = dbfData.pareval || [];

    console.log(`📊 Leídas ${luismt2.length} filas consolidadas de LUISMT2.DBF`);
    console.log(`📋 Leídas ${pareval.length} filas de evaluaciones parciales (pareval.dbf)`);

    // 1. Obtener cursos únicos y crearlos en Firestore
    const courseCodes = new Set();
    luismt2.forEach(r => {
        if (r.ALUGRA && r.ALUPAR) {
            const code = parseInt(r.ALUGRA + r.ALUPAR, 10).toString();
            courseCodes.add(code);
        }
    });

    console.log(`\n📚 1. Guardando Cursos (${courseCodes.size}):`, Array.from(courseCodes));
    for (const cCode of courseCodes) {
        await setDoc(doc(db, 'courses', cCode), { created_at: new Date() }, { merge: true });
    }

    // 2. Indexar notas parciales por (Curso, Materia, Periodo, Estudiante)
    const parevalMap = new Map(); // key: "701_GEO_2_NOMBRE" -> { pa1, pa2, pa3, pa4, pa5 }
    pareval.forEach(p => {
        const rawCourse = p.PARCURSO.replace(/^U0?/, ''); // e.g. "U0701" -> "701"
        const course = parseInt(rawCourse, 10).toString();
        const mat = p.PARMAT.trim();
        const per = p.PARPER.trim();
        const name = p.PARNOMAL.trim().toUpperCase();

        const key = `${course}_${mat}_${per}_${name}`;
        parevalMap.set(key, {
            prueba1: Number(p.PA1) || 0,
            prueba2: Number(p.PA2) || 0,
            guia: Number(p.PA3) || 0,
            ejercitacion: Number(p.PA4) || 0,
            actitudinal: Number(p.PA5) || 0
        });
    });

    // 3. Crear / Mapear Estudiantes en Firestore
    const studentsSnap = await getDocs(collection(db, 'students'));
    const existingStudentsMap = new Map();
    studentsSnap.docs.forEach(d => {
        const s = d.data();
        const fullUpper = (s.name || `${s.lastName} ${s.firstName}`).toUpperCase();
        existingStudentsMap.set(`${s.grade}_${fullUpper}`, { id: d.id, ...s });
        existingStudentsMap.set(fullUpper, { id: d.id, ...s });
    });

    // Mapeo de materias DBF -> Firestore
    const subjectMap = {
        'MAT': 'Matemáticas',
        'FIS': 'C. Naturales (Física)',
        'FIC': 'C. Naturales (Física)',
        'GEO': 'Matemáticas',
        'XCS': 'Ed Ética y Valores'
    };

    // Colección de estudiantes a registrar/obtener ID
    const studentDocIdMap = new Map(); // key: "701_AGUDELO HURTADO MARIAM CAMILA" -> studentDocId
    const studentCounters = {};

    console.log("\n👥 2. Procesando y Registrando Estudiantes...");
    for (const r of luismt2) {
        const rawGrade = r.ALUGRA + r.ALUPAR;
        if (!rawGrade || !r.ALUNOM.trim()) continue;

        const grade = parseInt(rawGrade, 10).toString();
        const fullUpper = r.ALUNOM.trim().toUpperCase();
        const key = `${grade}_${fullUpper}`;

        if (studentDocIdMap.has(key)) continue;

        let studentId;
        const match = existingStudentsMap.get(key) || existingStudentsMap.get(fullUpper);

        if (match) {
            studentId = match.id;
        } else {
            // Crear nuevo estudiante
            const { firstName, lastName } = splitName(fullUpper);
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
        }

        studentDocIdMap.set(key, studentId);
    }

    console.log(`✅ ${studentDocIdMap.size} Estudiantes listos en Firestore.`);

    // 4. Importar Calificaciones
    console.log("\n📝 3. Registrando Calificaciones en Firestore...");

    // Cargar notas existentes para evitar duplicados masivos
    const existingGradesSnap = await getDocs(collection(db, 'grades'));
    const existingGradesSet = new Set();
    existingGradesSnap.docs.forEach(d => {
        const g = d.data();
        existingGradesSet.add(`${g.student_id}_${g.subject}_${g.period}`);
    });

    let importedGradesCount = 0;

    for (const r of luismt2) {
        const rawGrade = r.ALUGRA + r.ALUPAR;
        const nameUpper = r.ALUNOM.trim().toUpperCase();
        if (!rawGrade || !nameUpper) continue;

        const grade = parseInt(rawGrade, 10).toString();
        const key = `${grade}_${nameUpper}`;
        const studentId = studentDocIdMap.get(key);
        if (!studentId) continue;

        const matCode = r.ALUMAT.trim();
        const mappedSubject = subjectMap[matCode] || matCode;

        // Procesar Periodo 1 y Periodo 2 (si tienen datos)
        const periodsToProcess = [
            { periodNum: 1, scoreVal: r.ALUPT1, evalLevel: r.ALUCO1 },
            { periodNum: 2, scoreVal: r.ALUPT2, evalLevel: r.ALUCO2 }
        ];

        for (const p of periodsToProcess) {
            const scoreNum = Number(p.scoreVal);
            if (isNaN(scoreNum) || p.scoreVal === '' || scoreNum <= 0) continue;

            const gradeKey = `${studentId}_${mappedSubject}_${p.periodNum}`;
            
            // Buscar componentes parciales en pareval
            const parKey = `${grade}_${matCode}_${p.periodNum}_${nameUpper}`;
            let components = parevalMap.get(parKey);

            if (!components) {
                // Si no hay datos en pareval, distribuimos equitativamente sobre 20
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

            // Buscar si ya existe la nota para actualizar o crear
            const qGrade = query(
                collection(db, 'grades'),
                where('student_id', '==', studentId),
                where('subject', '==', mappedSubject),
                where('period', '==', p.periodNum)
            );
            const gSnap = await getDocs(qGrade);

            if (!gSnap.empty) {
                // Actualizar
                const gradeDocRef = doc(db, 'grades', gSnap.docs[0].id);
                await setDoc(gradeDocRef, {
                    grade: scoreNum,
                    components,
                    comment: commentStr,
                    teacher_id: 'LUISM'
                }, { merge: true });
            } else {
                // Crear nueva
                await addDoc(collection(db, 'grades'), {
                    student_id: studentId,
                    teacher_id: 'LUISM',
                    subject: mappedSubject,
                    period: p.periodNum,
                    grade: scoreNum,
                    components,
                    comment: commentStr,
                    created_at: new Date()
                });
            }

            importedGradesCount++;
        }
    }

    console.log(`\n🎉 IMPORTACIÓN FINALIZADA EXITOSAMENTE!`);
    console.log(`- Estudiantes totales: ${studentDocIdMap.size}`);
    console.log(`- Calificaciones registradas/actualizadas: ${importedGradesCount}`);
}

runFullImport().then(() => process.exit(0)).catch(err => {
    console.error("❌ Error en importación:", err);
    process.exit(1);
});
