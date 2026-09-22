import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, query, where } from 'firebase/firestore';
import { MOCK_STUDENTS } from './mockData.js';

/**
 * Calcula un puntaje de coincidencia entre el correo/usuario activo y un estudiante.
 */
function calculateStudentMatchScore(student, userEmail, userId, isMasterAuth = false) {
    if (!student || !userEmail) return 0;

    let score = 0;
    const userEmailLower = userEmail.toLowerCase().trim();
    const userPrefix = userEmailLower.split('@')[0];

    // 1. Coincidencia exacta por email del estudiante o email del padre (MÁXIMA PRIORIDAD)
    const sEmail = (student.email || '').toLowerCase().trim();
    const pEmail = (student.email_padre || '').toLowerCase().trim();
    if (sEmail && sEmail === userEmailLower) score += 20000;
    if (pEmail && pEmail === userEmailLower) score += 18000;

    // 2. Coincidencia por parent_uids (sólo si no es sesión de master auth para evitar vincular el UID de admin)
    if (!isMasterAuth && userId && student.parent_uids && Array.isArray(student.parent_uids) && student.parent_uids.includes(userId)) {
        score += 10000;
    }

    // 3. Análisis de nombres y apellidos
    const firstName = (student.firstName || '').toLowerCase().trim();
    const lastName = (student.lastName || '').toLowerCase().trim();
    const fullName = (student.name || '').toLowerCase().trim();

    const fnParts = firstName.split(/\s+/).filter(Boolean);
    const lnParts = lastName.split(/\s+/).filter(Boolean);
    const fullParts = fullName.split(/\s+/).filter(Boolean);

    // Primera letra del primer nombre (o de alguna de las partes del nombre)
    const firstChar = fnParts[0] ? fnParts[0][0] : (fullParts[0] ? fullParts[0][0] : '');

    // VALIDACIÓN CLAVE: El primer carácter del nombre coincide con la primera letra del correo
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

    // Coincidencia de apellido en cualquier posición del prefijo
    if (lnParts.length >= 1 && lnParts[0].length >= 4 && userPrefix.includes(lnParts[0])) {
        score += 1200;
    }

    return score;
}

export async function getStudentForUser(db, currentUser) {
    if (!currentUser) return null;

    try {
        const cleanEmail = (currentUser.email || '').toLowerCase().trim();
        const isMaster = !!currentUser.isMasterAuth;

        // 0. Búsqueda directa por correo del alumno o acudiente (rápida, indexada y exacta)
        if (cleanEmail) {
            try {
                const qStudent = query(collection(db, 'students'), where('email', '==', cleanEmail));
                const sSnap = await getDocs(qStudent);
                if (!sSnap.empty) {
                    const docMatch = sSnap.docs[0];
                    return { id: docMatch.id, ...docMatch.data() };
                }

                const qParent = query(collection(db, 'students'), where('email_padre', '==', cleanEmail));
                const pSnap = await getDocs(qParent);
                if (!pSnap.empty) {
                    const docMatch = pSnap.docs[0];
                    return { id: docMatch.id, ...docMatch.data() };
                }

                const qParentEmail = query(collection(db, 'students'), where('parent_email', '==', cleanEmail));
                const peSnap = await getDocs(qParentEmail);
                if (!peSnap.empty) {
                    const docMatch = peSnap.docs[0];
                    return { id: docMatch.id, ...docMatch.data() };
                }
            } catch (queryErr) {
                console.warn("Aviso en búsqueda directa por correo:", queryErr);
            }
        }

        const allStudentsSnap = await getDocs(collection(db, 'students'));
        if (allStudentsSnap.empty) {
            return MOCK_STUDENTS[0];
        }

        const allStudents = allStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Buscar el estudiante con el puntaje de coincidencia más alto
        let bestStudent = null;
        let highestScore = 0;

        for (const student of allStudents) {
            const score = calculateStudentMatchScore(student, currentUser.email, currentUser.uid, isMaster);
            if (score > highestScore) {
                highestScore = score;
                bestStudent = student;
            }
        }

        if (bestStudent && highestScore > 0) {
            // Auto-vincular parent_uids en Firestore sólo si es un acudiente legítimo (no master impersonation)
            if (!isMaster && currentUser.uid && (!bestStudent.parent_uids || !bestStudent.parent_uids.includes(currentUser.uid))) {
                try {
                    await updateDoc(doc(db, 'students', bestStudent.id), {
                        parent_uids: arrayUnion(currentUser.uid)
                    });
                } catch (e) {
                    // Silently continue
                }
            }
            return bestStudent;
        }

        // Si no hay ninguna coincidencia confiable, retornar perfil para el usuario actual (no de otro estudiante)
        return {
            id: `user-${currentUser.uid || 'temp'}`,
            name: currentUser.displayName || cleanEmail.split('@')[0],
            firstName: (currentUser.displayName || '').split(' ')[0] || cleanEmail.split('@')[0],
            lastName: (currentUser.displayName || '').split(' ').slice(1).join(' ') || '',
            email: cleanEmail,
            grade: 'Estudiante INAS',
            id_code: 'INAS-EST'
        };
    } catch (err) {
        console.error("Error al buscar estudiante para el usuario:", err);
        return MOCK_STUDENTS[0];
    }
}

