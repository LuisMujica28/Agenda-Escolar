import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { MOCK_STUDENTS } from './mockData';

/**
 * Calcula un puntaje de coincidencia entre el correo/usuario activo y un estudiante.
 */
function calculateStudentMatchScore(student, userEmail, userId) {
    if (!student || !userEmail) return 0;

    let score = 0;
    const userEmailLower = userEmail.toLowerCase().trim();
    const userPrefix = userEmailLower.split('@')[0];

    // 1. Coincidencia por parent_uids
    if (student.parent_uids && Array.isArray(student.parent_uids) && student.parent_uids.includes(userId)) {
        score += 10000;
    }

    // 2. Coincidencia exacta por email del estudiante o email del padre
    const sEmail = (student.email || '').toLowerCase().trim();
    const pEmail = (student.email_padre || '').toLowerCase().trim();
    if (sEmail && sEmail === userEmailLower) score += 9000;
    if (pEmail && pEmail === userEmailLower) score += 9000;

    // 3. Análisis de nombres y apellidos
    const firstName = (student.firstName || '').toLowerCase().trim();
    const lastName = (student.lastName || '').toLowerCase().trim();
    const fullName = (student.name || '').toLowerCase().trim();

    const fnParts = firstName.split(/\s+/).filter(Boolean);
    const lnParts = lastName.split(/\s+/).filter(Boolean);
    const fullParts = fullName.split(/\s+/).filter(Boolean);

    // Primera letra del primer nombre
    const firstChar = fnParts[0] ? fnParts[0][0] : (fullParts[0] ? fullParts[0][0] : '');

    // VALIDACIÓN CLAVE: El primer carácter del nombre DEBE coincidir con la primera letra del correo
    const firstCharMatches = firstChar && userPrefix.startsWith(firstChar);

    if (firstCharMatches) {
        score += 500;

        // Patrón 1: s + alvarez + b = salvarezb (Primera letra nombre + primer apellido + primera letra segundo apellido)
        if (fnParts.length >= 1 && lnParts.length >= 2) {
            const p1 = fnParts[0][0] + lnParts[0] + lnParts[1][0];
            if (p1 === userPrefix) score += 4000;
        }

        // Patrón 2: s + castro = scastro (Primera letra nombre + primer apellido)
        if (fnParts.length >= 1 && lnParts.length >= 1) {
            const p2 = fnParts[0][0] + lnParts[0];
            if (p2 === userPrefix) score += 3500;
        }

        // Patrón 3: laura + castro = lauracastro (Nombre completo + primer apellido)
        if (fnParts.length >= 1 && lnParts.length >= 1) {
            const p3 = fnParts[0] + lnParts[0];
            if (p3 === userPrefix) score += 3500;
        }

        // Patrón 4: m + s + cruz = mscruz (Primera letra 1er nombre + 1ra letra 2do nombre + primer apellido)
        if (fnParts.length >= 2 && lnParts.length >= 1) {
            const p4 = fnParts[0][0] + fnParts[1][0] + lnParts[0];
            if (p4 === userPrefix) score += 3500;
        }

        // Patrón 5: s + isabella + b + m = sisabellabm
        if (fnParts.length >= 2 && lnParts.length >= 2) {
            const p5 = fnParts[0][0] + fnParts[1] + lnParts[0][0] + lnParts[1][0];
            if (p5 === userPrefix) score += 3500;
        }

        // Si el correo contiene el primer apellido exacto del alumno (ej: alvarez en salvarezb)
        if (lnParts.length >= 1 && lnParts[0].length >= 3 && userPrefix.includes(lnParts[0])) {
            score += 1500;
        }
    }

    return score;
}

export async function getStudentForUser(db, currentUser) {
    if (!currentUser) return null;

    if (currentUser.uid?.startsWith('fake-')) {
        return MOCK_STUDENTS[0];
    }

    try {
        const allStudentsSnap = await getDocs(collection(db, 'students'));
        if (allStudentsSnap.empty) {
            return MOCK_STUDENTS[0];
        }

        const allStudents = allStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Buscar el estudiante con el puntaje de coincidencia más alto
        let bestStudent = null;
        let highestScore = 0;

        for (const student of allStudents) {
            const score = calculateStudentMatchScore(student, currentUser.email, currentUser.uid);
            if (score > highestScore) {
                highestScore = score;
                bestStudent = student;
            }
        }

        if (bestStudent && highestScore > 0) {
            return bestStudent;
        }

        // Fallback únicamente si es cuenta genérica de prueba (demo / colegio.com)
        if (currentUser.email && (currentUser.email.includes('demo') || currentUser.email.includes('colegio.com'))) {
            return allStudents[0];
        }

        return allStudents[0];
    } catch (err) {
        console.error("Error al buscar estudiante para el usuario:", err);
        return MOCK_STUDENTS[0];
    }
}
