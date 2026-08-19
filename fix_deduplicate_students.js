import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

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

function normalizeNameWords(nameStr) {
    if (!nameStr) return '';
    return nameStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().trim().split(/\s+/).sort().join('_');
}

async function deduplicateStudents() {
    console.log("=================================================");
    console.log("🧹 DEPURANDO Y DEDUPLICANDO ESTUDIANTES EN FIREBASE");
    console.log("=================================================\n");

    const sSnap = await getDocs(collection(db, 'students'));
    const gSnap = await getDocs(collection(db, 'grades'));

    const allStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allGrades = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`📋 Estudiantes actuales en Firestore: ${allStudents.length}`);
    console.log(`📝 Calificaciones actuales en Firestore: ${allGrades.length}`);

    // Mapear calificaciones por student_id
    const gradesByStudent = {};
    allGrades.forEach(g => {
        if (!gradesByStudent[g.student_id]) gradesByStudent[g.student_id] = [];
        gradesByStudent[g.student_id].push(g);
    });

    // Agrupar estudiantes por (grade + palabras del nombre ordenadas)
    const groups = {};
    allStudents.forEach(st => {
        const fullName = st.name || `${st.lastName || ''} ${st.firstName || ''}`;
        const wordsKey = normalizeNameWords(fullName);
        const gradeKey = String(st.grade || '');
        const key = `${gradeKey}_${wordsKey}`;

        if (!groups[key]) groups[key] = [];
        groups[key].push({
            ...st,
            gradesCount: (gradesByStudent[st.id] || []).length
        });
    });

    const duplicateGroups = Object.entries(groups).filter(([_, list]) => list.length > 1);
    console.log(`⚠️ Se encontraron ${duplicateGroups.length} grupos de estudiantes duplicados.`);

    let deletedDocsCount = 0;
    let reassignedGradesCount = 0;

    const BATCH_SIZE = 400;
    let batch = writeBatch(db);
    let batchOpCount = 0;

    for (const [key, studentList] of duplicateGroups) {
        // Ordenar estudiantes dentro del grupo: primero el que tiene MÁS calificaciones
        studentList.sort((a, b) => b.gradesCount - a.gradesCount);

        const keeper = studentList[0]; // Conservamos el primero
        const dupesToDelete = studentList.slice(1); // Eliminamos los duplicados restantes

        for (const dupe of dupesToDelete) {
            // Si el duplicado tenía alguna calificación suelta, la reasignamos al principal
            const dupeGrades = gradesByStudent[dupe.id] || [];
            for (const g of dupeGrades) {
                const gRef = doc(db, 'grades', g.id);
                batch.update(gRef, { student_id: keeper.id });
                reassignedGradesCount++;
                batchOpCount++;

                if (batchOpCount >= BATCH_SIZE) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchOpCount = 0;
                }
            }

            // Eliminar documento de estudiante duplicado
            const dupeRef = doc(db, 'students', dupe.id);
            batch.delete(dupeRef);
            deletedDocsCount++;
            batchOpCount++;

            if (batchOpCount >= BATCH_SIZE) {
                await batch.commit();
                batch = writeBatch(db);
                batchOpCount = 0;
            }
        }
    }

    if (batchOpCount > 0) {
        await batch.commit();
    }

    console.log(`\n✅ LIMPIEZA FINALIZADA CON ÉXITO:`);
    console.log(`- Documentos de estudiantes duplicados eliminados: ${deletedDocsCount}`);
    console.log(`- Calificaciones reasignadas al perfil principal: ${reassignedGradesCount}`);

    const finalSnap = await getDocs(collection(db, 'students'));
    console.log(`🎉 Estudiantes únicos restantes en Firestore: ${finalSnap.size}`);
}

deduplicateStudents().then(() => process.exit(0)).catch(err => {
    console.error("❌ Error en deduplicación:", err);
    process.exit(1);
});
