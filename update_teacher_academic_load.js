import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';

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

const ALL_COURSES = [
    'TRANSICION', '101', '201', '301', '401', '501', '601', '602', '701', '801', '802', '901', '1001', '1101'
];

const TEACHERS_DETAILED = [
    {
        name: "Alexandra Díaz",
        email: "alexandralenguaje@inas.edu.co",
        director_de_grupo: "601",
        role: "teacher",
        position: "Docente de Lenguaje (Directora 601)",
        subjects: ["Español y Literatura"],
        courses: ["501", "601", "602", "901", "1001", "1101"],
        academic_load: [
            { subject: "Español y Literatura", course: "501", blocks: 3 },
            { subject: "Español y Literatura", course: "601", blocks: 3 },
            { subject: "Español y Literatura", course: "602", blocks: 3 },
            { subject: "Español y Literatura", course: "901", blocks: 3 },
            { subject: "Español y Literatura", course: "1001", blocks: 3 },
            { subject: "Español y Literatura", course: "1101", blocks: 3 }
        ]
    },
    {
        name: "Carlos Gómez",
        email: "carlosgomez@inas.edu.co",
        director_de_grupo: null,
        role: "teacher",
        position: "Docente de Ciencias Sociales y Filosofía",
        subjects: ["C Sociales Filosofía", "Filosofía"],
        courses: ["201", "301", "401", "501", "601", "1001", "1101"],
        academic_load: [
            { subject: "C Sociales Filosofía", course: "201", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "301", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "401", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "501", blocks: 1 },
            { subject: "C Sociales Filosofía", course: "601", blocks: 3 },
            { subject: "Filosofía", course: "1001", blocks: 1 },
            { subject: "Filosofía", course: "1101", blocks: 1 }
        ]
    },
    {
        name: "Carolina Acosta",
        email: "carolinaartes@inas.edu.co",
        director_de_grupo: null,
        role: "teacher",
        position: "Docente de Artes Plásticas",
        subjects: ["Artes plásticas"],
        courses: ALL_COURSES,
        academic_load: ALL_COURSES.map(c => ({ subject: "Artes plásticas", course: c, blocks: 1 }))
    },
    {
        name: "Esteban Morales",
        email: "estebanm@inas.edu.co",
        director_de_grupo: "901",
        role: "teacher",
        position: "Docente de Ciencias Sociales (Director 901)",
        subjects: ["C Sociales Filosofía", "C Políticas Económicas"],
        courses: ["501", "701", "801", "802", "901", "1001", "1101"],
        academic_load: [
            { subject: "C Sociales Filosofía", course: "501", blocks: 2 },
            { subject: "C Sociales Filosofía", course: "701", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "801", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "802", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "901", blocks: 3 },
            { subject: "C Sociales Filosofía", course: "1001", blocks: 2 },
            { subject: "C Sociales Filosofía", course: "1101", blocks: 2 }
        ]
    },
    {
        name: "Flor Angela Calvo",
        email: "florciencias@inas.edu.co",
        director_de_grupo: "301",
        role: "teacher",
        position: "Docente de Ciencias Naturales (Directora 301)",
        subjects: ["C. Naturales (Biología)", "C Naturales (Química)"],
        courses: ["TRANSICION", "101", "201", "301", "401", "601", "602"],
        academic_load: [
            { subject: "C. Naturales (Biología)", course: "TRANSICION", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "101", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "201", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "301", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "401", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "601", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "602", blocks: 2 },
            { subject: "C Naturales (Química)", course: "301", blocks: 1 },
            { subject: "C Naturales (Química)", course: "401", blocks: 1 },
            { subject: "C Naturales (Química)", course: "601", blocks: 1 },
            { subject: "C Naturales (Química)", course: "602", blocks: 1 }
        ]
    },
    {
        name: "Freddy Pacheco",
        email: "freddypacheco@inas.edu.co",
        director_de_grupo: null,
        role: "teacher",
        position: "Docente de Educación Física",
        subjects: ["Ed Física"],
        courses: ALL_COURSES,
        academic_load: ALL_COURSES.map(c => ({ subject: "Ed Física", course: c, blocks: 1 }))
    },
    {
        name: "Ibón Angélica Pulido",
        email: "ibonciencias@inas.edu.co",
        director_de_grupo: "801",
        role: "teacher",
        position: "Docente de Ciencias Naturales y Química (Directora 801)",
        subjects: ["C. Naturales (Biología)", "C Naturales (Química)"],
        courses: ["501", "701", "801", "901", "1001", "1101"],
        academic_load: [
            { subject: "C. Naturales (Biología)", course: "501", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "701", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "801", blocks: 2 },
            { subject: "C. Naturales (Biología)", course: "901", blocks: 1 },
            { subject: "C Naturales (Química)", course: "501", blocks: 1 },
            { subject: "C Naturales (Química)", course: "801", blocks: 1 },
            { subject: "C Naturales (Química)", course: "1001", blocks: 2 },
            { subject: "C Naturales (Química)", course: "1101", blocks: 2 }
        ]
    },
    {
        name: "José Jiménez",
        email: "josejimenez@inas.edu.co",
        director_de_grupo: "701",
        role: "teacher",
        position: "Docente de Matemáticas y Geometría (Director 701)",
        subjects: ["Matemáticas", "Geometría"],
        courses: ["301", "501", "601", "602", "701", "801", "802", "901"],
        academic_load: [
            { subject: "Matemáticas", course: "601", blocks: 3 },
            { subject: "Matemáticas", course: "602", blocks: 3 },
            { subject: "Matemáticas", course: "701", blocks: 3 },
            { subject: "Matemáticas", course: "901", blocks: 2 },
            { subject: "Geometría", course: "301", blocks: 1 },
            { subject: "Geometría", course: "501", blocks: 1 },
            { subject: "Geometría", course: "601", blocks: 1 },
            { subject: "Geometría", course: "602", blocks: 1 },
            { subject: "Geometría", course: "801", blocks: 1 },
            { subject: "Geometría", course: "802", blocks: 1 },
            { subject: "Geometría", course: "901", blocks: 1 }
        ]
    },
    {
        name: "Katherine Suarez",
        email: "kathelenguaje@inas.edu.co",
        director_de_grupo: "201",
        role: "teacher",
        position: "Docente de Lenguaje Primaria (Directora 201)",
        subjects: ["Español y Literatura"],
        courses: ["TRANSICION", "101", "201", "301", "401"],
        academic_load: [
            { subject: "Español y Literatura", course: "TRANSICION", blocks: 4 },
            { subject: "Español y Literatura", course: "101", blocks: 4 },
            { subject: "Español y Literatura", course: "201", blocks: 4 },
            { subject: "Español y Literatura", course: "301", blocks: 3 },
            { subject: "Español y Literatura", course: "401", blocks: 3 }
        ]
    },
    {
        name: "Laura Carolina Bernal",
        email: "lauraflorez@inas.edu.co",
        director_de_grupo: "802",
        role: "teacher",
        position: "Docente de Inglés (Directora 802)",
        subjects: ["Inglés"],
        courses: ["501", "601", "602", "701", "801", "802"],
        academic_load: [
            { subject: "Inglés", course: "501", blocks: 3 },
            { subject: "Inglés", course: "601", blocks: 3 },
            { subject: "Inglés", course: "602", blocks: 3 },
            { subject: "Inglés", course: "701", blocks: 3 },
            { subject: "Inglés", course: "801", blocks: 3 },
            { subject: "Inglés", course: "802", blocks: 3 }
        ]
    },
    {
        name: "Luis Carlos Carvajal",
        email: "luiscarvajal@inas.edu.co",
        director_de_grupo: "401",
        role: "teacher",
        position: "Docente de Tecnología, Matemáticas y Geometría (Director 401)",
        subjects: ["Tecnología e Informática", "Matemáticas", "Geometría"],
        courses: ALL_COURSES,
        academic_load: [
            ...ALL_COURSES.map(c => ({ subject: "Tecnología e Informática", course: c, blocks: 1 })),
            { subject: "Matemáticas", course: "401", blocks: 3 },
            { subject: "Geometría", course: "401", blocks: 1 }
        ]
    },
    {
        name: "Luis Mujica",
        email: "luismatematicas@inas.edu.co",
        director_de_grupo: "1101",
        role: "teacher",
        position: "Docente de Matemáticas y Física (Director 1101)",
        subjects: ["Matemáticas", "C. Naturales (Física)", "Geometría"],
        courses: ["701", "801", "802", "901", "1001", "1101"],
        academic_load: [
            { subject: "Matemáticas", course: "801", blocks: 2 },
            { subject: "Matemáticas", course: "802", blocks: 2 },
            { subject: "Matemáticas", course: "1001", blocks: 3 },
            { subject: "Matemáticas", course: "1101", blocks: 3 },
            { subject: "C. Naturales (Física)", course: "801", blocks: 1 },
            { subject: "C. Naturales (Física)", course: "802", blocks: 1 },
            { subject: "C. Naturales (Física)", course: "901", blocks: 1 },
            { subject: "C. Naturales (Física)", course: "1001", blocks: 2 },
            { subject: "C. Naturales (Física)", course: "1101", blocks: 2 },
            { subject: "Geometría", course: "701", blocks: 1 }
        ]
    },
    {
        name: "Maritza Triana",
        email: "maritzaingles@inas.edu.co",
        director_de_grupo: "1001",
        role: "teacher",
        position: "Docente de Lenguaje e Inglés (Directora 1001)",
        subjects: ["Español y Literatura", "Inglés"],
        courses: ["701", "801", "802", "901", "1001", "1101"],
        academic_load: [
            { subject: "Español y Literatura", course: "701", blocks: 3 },
            { subject: "Español y Literatura", course: "801", blocks: 3 },
            { subject: "Español y Literatura", course: "802", blocks: 3 },
            { subject: "Inglés", course: "901", blocks: 3 },
            { subject: "Inglés", course: "1001", blocks: 3 },
            { subject: "Inglés", course: "1101", blocks: 3 }
        ]
    },
    {
        name: "Merly Tapias",
        email: "merlyetica@inas.edu.co",
        director_de_grupo: "TRANSICION",
        role: "teacher",
        position: "Docente de Sociales, Ética y Religión (Directora Transición)",
        subjects: ["C Sociales Filosofía", "Ed Ética y Valores", "Ed Religiosa y Moral"],
        courses: ALL_COURSES,
        academic_load: [
            { subject: "C Sociales Filosofía", course: "TRANSICION", blocks: 2 },
            { subject: "C Sociales Filosofía", course: "101", blocks: 2 },
            ...ALL_COURSES.map(c => ({ subject: "Ed Ética y Valores", course: c, blocks: 1 }))
        ]
    },
    {
        name: "Sonia Agudelo",
        email: "soniaingles@inas.edu.co",
        director_de_grupo: "101",
        role: "teacher",
        position: "Docente de Inglés (Directora 101)",
        subjects: ["Inglés"],
        courses: ["TRANSICION", "101", "201", "301", "401", "901"],
        academic_load: [
            { subject: "Inglés", course: "TRANSICION", blocks: 4 },
            { subject: "Inglés", course: "101", blocks: 4 },
            { subject: "Inglés", course: "201", blocks: 3 },
            { subject: "Inglés", course: "301", blocks: 3 },
            { subject: "Inglés", course: "401", blocks: 3 },
            { subject: "Inglés", course: "901", blocks: 1 }
        ]
    },
    {
        name: "Yuli Gonzalez",
        email: "yulimatematicas@inas.edu.co",
        director_de_grupo: "501",
        role: "teacher",
        position: "Docente de Matemáticas y Geometría (Directora 501)",
        subjects: ["Matemáticas", "Geometría"],
        courses: ["TRANSICION", "101", "201", "301", "501"],
        academic_load: [
            { subject: "Matemáticas", course: "TRANSICION", blocks: 4 },
            { subject: "Matemáticas", course: "101", blocks: 3 },
            { subject: "Matemáticas", course: "201", blocks: 3 },
            { subject: "Matemáticas", course: "301", blocks: 3 },
            { subject: "Matemáticas", course: "501", blocks: 3 },
            { subject: "Geometría", course: "101", blocks: 1 },
            { subject: "Geometría", course: "201", blocks: 1 }
        ]
    },
    {
        name: "Carolina Contreras Pinzón",
        email: "carolinaorientacion@inas.edu.co",
        director_de_grupo: null,
        role: "teacher",
        position: "Psicoorientadora Escolar",
        subjects: ["Psicoorientación y Acompañamiento Escolar"],
        courses: ALL_COURSES,
        academic_load: []
    },
    {
        name: "Manuel Rodríguez",
        email: "orientacion@inas.edu.co",
        director_de_grupo: null,
        role: "teacher",
        position: "Psicoorientador / Convivencia Escolar",
        subjects: ["Psicoorientación y Convivencia Escolar"],
        courses: ALL_COURSES,
        academic_load: []
    },
    {
        name: "Giancarlo Ramírez",
        email: "rectoria@inas.edu.co",
        director_de_grupo: null,
        role: "admin",
        position: "Rector General",
        subjects: ["Dirección Institucional"],
        courses: ALL_COURSES,
        academic_load: []
    },
    {
        name: "Catalina Mahecha",
        email: "secretaria@inas.edu.co",
        director_de_grupo: null,
        role: "admin",
        position: "Secretaria Académica",
        subjects: ["Secretaría y Registro Académico"],
        courses: ALL_COURSES,
        academic_load: []
    }
];

async function updateAcademicLoad() {
    console.log("=================================================");
    console.log("🚀 ACTUALIZANDO ASIGNACIONES Y CARGA ACADÉMICA");
    console.log("=================================================\n");

    const usersSnap = await getDocs(collection(db, 'users'));
    const userMap = new Map(); // email -> doc.id
    usersSnap.docs.forEach(d => {
        const data = d.data();
        if (data.email) userMap.set(data.email.toLowerCase().trim(), d.id);
    });

    for (const t of TEACHERS_DETAILED) {
        const emailKey = t.email.toLowerCase().trim();
        const uid = userMap.get(emailKey);

        if (!uid) {
            console.warn(`⚠️ No se encontró usuario en Firestore para: ${t.email}`);
            continue;
        }

        console.log(`✏️ Actualizando: ${t.name} (${t.email})...`);
        console.log(`   - Dirección de Grupo: ${t.director_de_grupo || 'Ninguna'}`);
        console.log(`   - Cursos asignados (${t.courses.length}): ${t.courses.join(', ')}`);

        // Actualizar en users
        await setDoc(doc(db, 'users', uid), {
            name: t.name,
            email: t.email,
            role: t.role,
            position: t.position,
            director_de_grupo: t.director_de_grupo,
            subjects: t.subjects,
            courses: t.courses,
            academic_load: t.academic_load,
            updated_at: new Date()
        }, { merge: true });

        // Actualizar en teachers
        await setDoc(doc(db, 'teachers', uid), {
            uid: uid,
            name: t.name,
            email: t.email,
            role: t.role,
            position: t.position,
            director_de_grupo: t.director_de_grupo,
            subjects: t.subjects,
            courses: t.courses,
            academic_load: t.academic_load,
            updated_at: new Date()
        }, { merge: true });

        console.log(`   ✅ Guardado exitosamente.`);
    }

    // Registrar o actualizar todos los cursos oficiales en 'courses'
    console.log("\n🏫 Actualizando cursos en colección 'courses'...");
    for (const c of ALL_COURSES) {
        const director = TEACHERS_DETAILED.find(t => t.director_de_grupo === c);
        await setDoc(doc(db, 'courses', c), {
            id: c,
            name: c === 'TRANSICION' ? 'Transición' : `Grado ${c}`,
            director_de_grupo: director ? director.name : null,
            director_email: director ? director.email : null,
            updated_at: new Date()
        }, { merge: true });
    }

    console.log(`\n🎉 ASIGNACIÓN ACADÉMICA Y DIRECCIONES DE GRUPO ACTUALIZADAS AL 100%!`);
}

updateAcademicLoad().then(() => process.exit(0)).catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
});
