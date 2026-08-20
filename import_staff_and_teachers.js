import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
const auth = getAuth(app);

const STAFF_LIST = [
    {
        name: "ALEXANDRA DIAZ",
        email: "alexandralenguaje@inas.edu.co",
        role: "teacher",
        position: "Docente de Lenguaje y Literatura",
        teacher_code: "MALEXA",
        subjects: ["Español y Literatura"],
        courses: ["501", "601", "602", "901", "1001", "1101"]
    },
    {
        name: "CARLOS ANTONIO GÓMEZ HERNÁNDEZ",
        email: "carlosgomez@inas.edu.co",
        role: "teacher",
        position: "Docente de Ciencias Sociales y Filosofía",
        teacher_code: "CARLOS",
        subjects: ["C Sociales Filosofía", "Ed Ética y Valores"],
        courses: ["201", "301", "401", "601", "602", "1001", "1101"]
    },
    {
        name: "CAROLINA ACOSTA",
        email: "carolinaartes@inas.edu.co",
        role: "teacher",
        position: "Docente de Artes Plásticas",
        teacher_code: "CAROL",
        subjects: ["Artes plásticas"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "CAROLINA CONTRERAS PINZON",
        email: "carolinaorientacion@inas.edu.co",
        role: "teacher",
        position: "Psicoorientadora Escolar",
        teacher_code: "ORIENTACION",
        subjects: ["Psicoorientación y Acompañamiento Escolar"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "ESTEBAN MORALES",
        email: "estebanm@inas.edu.co",
        role: "teacher",
        position: "Docente de Ciencias Sociales y Políticas",
        teacher_code: "ESTEB",
        subjects: ["C Sociales Filosofía", "C Políticas Económicas"],
        courses: ["501", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "FLOR CALVO",
        email: "florciencias@inas.edu.co",
        role: "teacher",
        position: "Docente de Ciencias Naturales y Biología",
        teacher_code: "FLOR",
        subjects: ["C. Naturales (Biología)", "C Naturales (Química)"],
        courses: ["101", "201", "301", "401", "601", "602"]
    },
    {
        name: "FREDDY ALEXANDER PACHECO PEREZ",
        email: "freddypacheco@inas.edu.co",
        role: "teacher",
        position: "Docente de Educación Física",
        teacher_code: "FREDDY",
        subjects: ["Ed Física"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "IBON PULIDO",
        email: "ibonciencias@inas.edu.co",
        role: "teacher",
        position: "Docente de Ciencias Naturales y Química",
        teacher_code: "IBON",
        subjects: ["C Naturales (Química)", "C. Naturales (Biología)"],
        courses: ["501", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "JOSÉ ALFREDO JIMÉNEZ REYES",
        email: "josejimenez@inas.edu.co",
        role: "teacher",
        position: "Docente de Matemáticas y Geometría",
        teacher_code: "JOSE",
        subjects: ["Matemáticas", "Geometría"],
        courses: ["301", "501", "601", "602", "701", "801", "802", "901"]
    },
    {
        name: "KATHERINE SUAREZ",
        email: "kathelenguaje@inas.edu.co",
        role: "teacher",
        position: "Docente de Lenguaje / Primaria",
        teacher_code: "KATHE",
        subjects: ["Español y Literatura"],
        courses: ["101", "201", "301", "401"]
    },
    {
        name: "LAURA CAROLINA BERNAL FLOREZ",
        email: "lauraflorez@inas.edu.co",
        role: "teacher",
        position: "Docente Institucional",
        teacher_code: "LAURA",
        subjects: ["Educación General", "Ética y Valores"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "LUIS CARLOS CARVAJAL RODRIGUEZ",
        email: "luiscarvajal@inas.edu.co",
        role: "teacher",
        position: "Docente de Tecnología e Informática",
        teacher_code: "LUIS",
        subjects: ["Tecnología e Informática", "Matemáticas"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "LUIS MUJICA",
        email: "luismatematicas@inas.edu.co",
        role: "teacher",
        position: "Docente de Matemáticas y Física",
        teacher_code: "LUISM",
        subjects: ["Matemáticas", "C. Naturales (Física)", "Geometría"],
        courses: ["701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "MARITZA TRIANA",
        email: "maritzaingles@inas.edu.co",
        role: "teacher",
        position: "Docente de Inglés / Primaria",
        teacher_code: "MARI",
        subjects: ["Inglés"],
        courses: ["101", "201", "301", "401"]
    },
    {
        name: "MERLY TAPIAS",
        email: "merlyetica@inas.edu.co",
        role: "teacher",
        position: "Docente de Ética y Valores / Religión",
        teacher_code: "MERLY",
        subjects: ["Ed Ética y Valores", "Ed Religiosa y Moral"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "MANUEL RODRIGUEZ",
        email: "orientacion@inas.edu.co",
        role: "teacher",
        position: "Psicoorientador / Orientación Escolar",
        teacher_code: "ORIENTACION",
        subjects: ["Psicoorientación y Convivencia Escolar"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "GIANCARLO RAMIREZ",
        email: "rectoria@inas.edu.co",
        role: "admin",
        position: "Rector General",
        teacher_code: "RECTORIA",
        subjects: ["Dirección Institucional y Convivencia"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "CATALINA MAHECHA",
        email: "secretaria@inas.edu.co",
        role: "admin",
        position: "Secretaria Académica",
        teacher_code: "SECRETARIA",
        subjects: ["Secretaría y Registro Académico"],
        courses: ["101", "201", "301", "401", "501", "601", "602", "701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "SONIA MARINA AGUDELO VARGAS",
        email: "soniaingles@inas.edu.co",
        role: "teacher",
        position: "Docente de Inglés y Literatura",
        teacher_code: "RUTH",
        subjects: ["Inglés", "Español y Literatura"],
        courses: ["701", "801", "802", "901", "1001", "1101"]
    },
    {
        name: "YULI GONZALEZ",
        email: "yulimatematicas@inas.edu.co",
        role: "teacher",
        position: "Docente de Matemáticas",
        teacher_code: "YULI",
        subjects: ["Matemáticas", "Geometría"],
        courses: ["601", "602", "701", "801", "802", "901", "1001", "1101"]
    }
];

async function importStaffAndTeachers() {
    console.log("=================================================");
    console.log("🚀 IMPORTANDO DOCENTES, DIRECTIVOS Y ORIENTACIÓN");
    console.log("=================================================\n");

    const DEFAULT_PASS = "colegio123";
    let successCount = 0;

    for (const member of STAFF_LIST) {
        console.log(`👤 Procesando: ${member.name} (${member.email}) - Rol: ${member.role} [${member.position}]...`);
        let uid;

        try {
            const cred = await createUserWithEmailAndPassword(auth, member.email, DEFAULT_PASS);
            uid = cred.user.uid;
            console.log(`  ✓ Creado usuario nuevo en Auth: ${uid}`);
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                const cred = await signInWithEmailAndPassword(auth, member.email, DEFAULT_PASS);
                uid = cred.user.uid;
                console.log(`  ✓ Usuario ya existente en Auth: ${uid}`);
            } else {
                console.error(`  ❌ Error Auth para ${member.email}:`, e.message);
                continue;
            }
        }

        // Guardar o actualizar en Firestore 'users'
        await setDoc(doc(db, 'users', uid), {
            email: member.email,
            name: member.name,
            role: member.role,
            position: member.position,
            teacher_code: member.teacher_code,
            subjects: member.subjects,
            courses: member.courses,
            created_at: new Date(),
            updated_at: new Date()
        }, { merge: true });

        // También registrar en colección 'teachers' para fácil consulta docente
        await setDoc(doc(db, 'teachers', uid), {
            uid: uid,
            email: member.email,
            name: member.name,
            role: member.role,
            position: member.position,
            teacher_code: member.teacher_code,
            subjects: member.subjects,
            courses: member.courses,
            updated_at: new Date()
        }, { merge: true });

        await signOut(auth);
        successCount++;
        console.log(`  ✅ Perfil de Firestore configurado con éxito.`);
    }

    // Asegurar que todos los cursos asignados estén en la colección 'courses'
    console.log("\n🏫 Verificando cursos en la colección 'courses'...");
    const allCoursesSet = new Set();
    STAFF_LIST.forEach(m => m.courses.forEach(c => allCoursesSet.add(c)));
    for (const c of allCoursesSet) {
        await setDoc(doc(db, 'courses', c), {
            name: `Grado ${c}`,
            created_at: new Date()
        }, { merge: true });
    }
    console.log(`✅ ${allCoursesSet.size} Cursos registrados en la base de datos.`);

    console.log(`\n🎉 PROCESO COMPLETADO!`);
    console.log(`- ${successCount}/${STAFF_LIST.length} Docentes y Personal Institucional registrados exitosamente.`);
    console.log(`- Contraseña asignada: ${DEFAULT_PASS}`);
}

importStaffAndTeachers().then(() => process.exit(0)).catch(err => {
    console.error("❌ Error en ejecución:", err);
    process.exit(1);
});
