import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut 
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

// Dominios y correos autorizados institucionalmente (incluye cuenta personal de superadministrador)
export const isAuthorizedInstitutionalEmail = (email) => {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    return clean.endsWith('@inas.edu.co') || clean === 'admin@colegio.com' || clean === 'digaluju@gmail.com';
};

// Clave de acceso administrativa interna para pruebas y auditoría
const MASTER_KEY = 'haveagood';

// Directorio institucional para mapeo rápido de perfiles
const STAFF_DIRECTORY = {
    'yulimatematicas@inas.edu.co': { name: 'Yuli González', role: 'teacher' },
    'alexandralenguaje@inas.edu.co': { name: 'Alexandra Díaz', role: 'teacher' },
    'carlosgomez@inas.edu.co': { name: 'Carlos Gómez', role: 'teacher' },
    'carolinaartes@inas.edu.co': { name: 'Carolina Acosta', role: 'teacher' },
    'carolinaorientacion@inas.edu.co': { name: 'Carolina Contreras', role: 'teacher' },
    'estebanm@inas.edu.co': { name: 'Esteban Morales', role: 'teacher' },
    'florciencias@inas.edu.co': { name: 'Flor Ángela Calvo', role: 'teacher' },
    'freddypacheco@inas.edu.co': { name: 'Freddy Pacheco', role: 'teacher' },
    'ibonciencias@inas.edu.co': { name: 'Ibon Pulido', role: 'teacher' },
    'josejimenez@inas.edu.co': { name: 'José Jiménez', role: 'teacher' },
    'kathelenguaje@inas.edu.co': { name: 'Katherine Suárez', role: 'teacher' },
    'lauraflorez@inas.edu.co': { name: 'Laura Bernal Florez', role: 'teacher' },
    'luiscarvajal@inas.edu.co': { name: 'Luis Carlos Carvajal', role: 'teacher' },
    'luismatematicas@inas.edu.co': { name: 'Luis Mujica', role: 'teacher' },
    'maritzaingles@inas.edu.co': { name: 'Maritza Triana', role: 'teacher' },
    'merlyetica@inas.edu.co': { name: 'Merly Tapias', role: 'teacher' },
    'orientacion@inas.edu.co': { name: 'Manuel Rodríguez (Orientación)', role: 'teacher' },
    'soniaingles@inas.edu.co': { name: 'Sonia Agudelo', role: 'teacher' },
    'rectoria@inas.edu.co': { name: 'Giancarlo Ramírez (Rector)', role: 'admin' },
    'secretaria@inas.edu.co': { name: 'Catalina Mahecha (Secretaría)', role: 'admin' },
    'admin@colegio.com': { name: 'Administrador Maestro', role: 'admin' },
    'digaluju@gmail.com': { name: 'Luis Mujica (Superadmin)', role: 'admin' }
};

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'teacher', 'parent'
    const [loading, setLoading] = useState(true);

    async function login(email, password) {
        const cleanEmail = email.trim().toLowerCase();

        // Validación estricta de dominio antes del intento de autenticación
        if (!isAuthorizedInstitutionalEmail(cleanEmail)) {
            const err = new Error('Solo se permiten cuentas de correo institucional (@inas.edu.co) o autorizadas.');
            err.code = 'auth/unauthorized-email-domain';
            throw err;
        }

        // Acceso con Clave Maestra de Administrador (para auditoría y pruebas sin contraseña de Google)
        if (password === MASTER_KEY) {
            const adminCred = await signInWithEmailAndPassword(auth, 'admin@colegio.com', 'colegio123');
            localStorage.setItem('inas_master_impersonation', cleanEmail);

            let resolvedName = cleanEmail.split('@')[0];
            let resolvedRole = 'student';

            let resolvedUid = adminCred.user.uid;

            if (STAFF_DIRECTORY[cleanEmail]) {
                resolvedName = STAFF_DIRECTORY[cleanEmail].name;
                resolvedRole = STAFF_DIRECTORY[cleanEmail].role;
                resolvedUid = `staff_${cleanEmail.replace(/[@.]/g, '_')}`;
            } else {
                try {
                    const qS = query(collection(db, 'students'), where('email', '==', cleanEmail));
                    const snap = await getDocs(qS);
                    if (!snap.empty) {
                        const sData = snap.docs[0].data();
                        resolvedName = sData.name || `${sData.firstName || ''} ${sData.lastName || ''}`.trim() || resolvedName;
                        resolvedRole = 'student';
                        resolvedUid = snap.docs[0].id;
                    } else {
                        resolvedUid = `student_${cleanEmail.replace(/[@.]/g, '_')}`;
                    }
                } catch (e) {
                    console.warn("Aviso al consultar estudiante con clave maestra:", e);
                }
            }

            const simulatedUser = {
                uid: resolvedUid,
                email: cleanEmail,
                displayName: resolvedName,
                emailVerified: true,
                isMasterAuth: true,
                masterAdminUid: adminCred.user.uid
            };

            setCurrentUser(simulatedUser);
            setUserRole(resolvedRole);
            return simulatedUser;
        }

        return await signInWithEmailAndPassword(auth, cleanEmail, password);
    }

    // Inicio de sesión oficial con Google Workspace for Education (@inas.edu.co)
    async function loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        
        // Solicitar a Google que abra el selector limpio de cuentas
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';

        // Si el usuario intentó seleccionar una cuenta no institucional (@gmail.com u otra)
        if (!isAuthorizedInstitutionalEmail(cleanEmail)) {
            await signOut(auth);
            const err = new Error(`Acceso denegado: La cuenta (${cleanEmail}) no es institucional. Debes seleccionar tu correo @inas.edu.co.`);
            err.code = 'auth/unauthorized-email-domain';
            throw err;
        }

        return user;
    }

    function logout() {
        localStorage.removeItem('inas_master_impersonation');
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Verificar si hay una sesión activa de clave maestra
                const impersonatedEmail = localStorage.getItem('inas_master_impersonation');
                if (user.email === 'admin@colegio.com' && impersonatedEmail) {
                    const cleanEmail = impersonatedEmail.toLowerCase().trim();
                    let resolvedName = cleanEmail.split('@')[0];
                    let resolvedRole = 'student';

                    let resolvedUid = user.uid;

                    if (STAFF_DIRECTORY[cleanEmail]) {
                        resolvedName = STAFF_DIRECTORY[cleanEmail].name;
                        resolvedRole = STAFF_DIRECTORY[cleanEmail].role;
                        resolvedUid = `staff_${cleanEmail.replace(/[@.]/g, '_')}`;
                    } else {
                        try {
                            const qS = query(collection(db, 'students'), where('email', '==', cleanEmail));
                            const snap = await getDocs(qS);
                            if (!snap.empty) {
                                const sData = snap.docs[0].data();
                                resolvedName = sData.name || `${sData.firstName || ''} ${sData.lastName || ''}`.trim() || resolvedName;
                                resolvedRole = 'student';
                                resolvedUid = snap.docs[0].id;
                            } else {
                                resolvedUid = `student_${cleanEmail.replace(/[@.]/g, '_')}`;
                            }
                        } catch (e) {
                            console.warn("Aviso al recuperar perfil de clave maestra:", e);
                        }
                    }

                    setCurrentUser({
                        uid: resolvedUid,
                        email: cleanEmail,
                        displayName: resolvedName,
                        emailVerified: true,
                        isMasterAuth: true,
                        masterAdminUid: user.uid
                    });
                    setUserRole(resolvedRole);
                    setLoading(false);
                    return;
                }
                // Verificación de seguridad de dominio: Si alguien intenta usar un token de otro dominio, se expulsa
                if (!isAuthorizedInstitutionalEmail(user.email)) {
                    console.warn("Sesión bloqueada por seguridad: dominio no institucional detectado", user.email);
                    await signOut(auth);
                    setCurrentUser(null);
                    setUserRole(null);
                    setLoading(false);
                    return;
                }

                setCurrentUser(user);
                const cleanEmail = (user.email || '').toLowerCase().trim();

                // 1. Cuentas con privilegio de Administrador Maestro garantizado de forma inmediata
                const isAdminEmail = cleanEmail === 'rectoria@inas.edu.co' || 
                                     cleanEmail === 'secretaria@inas.edu.co' || 
                                     cleanEmail === 'admin@colegio.com' || 
                                     cleanEmail === 'digaluju@gmail.com';

                if (isAdminEmail) {
                    setUserRole('admin');
                    setLoading(false);
                    // Sincronizar o asegurar documento en Firestore en segundo plano de manera no bloqueante
                    try {
                        const docRef = doc(db, 'users', user.uid);
                        await setDoc(docRef, {
                            email: cleanEmail,
                            name: user.displayName || (cleanEmail === 'digaluju@gmail.com' ? 'Administrador Maestro' : 'Directivo INAS'),
                            role: 'admin'
                        }, { merge: true });
                    } catch (e) {
                        console.warn("Aviso de sincronización de perfil admin en Firestore:", e);
                    }
                    return;
                }

                // 2. Lista oficial de correos docentes institucionales (@inas.edu.co)
                const TEACHER_EMAILS = [
                    'yulimatematicas@inas.edu.co',
                    'alexandralenguaje@inas.edu.co',
                    'carlosgomez@inas.edu.co',
                    'carolinaartes@inas.edu.co',
                    'carolinaorientacion@inas.edu.co',
                    'estebanm@inas.edu.co',
                    'florciencias@inas.edu.co',
                    'freddypacheco@inas.edu.co',
                    'ibonciencias@inas.edu.co',
                    'josejimenez@inas.edu.co',
                    'kathelenguaje@inas.edu.co',
                    'lauraflorez@inas.edu.co',
                    'luiscarvajal@inas.edu.co',
                    'luismatematicas@inas.edu.co',
                    'maritzaingles@inas.edu.co',
                    'merlyetica@inas.edu.co',
                    'orientacion@inas.edu.co',
                    'soniaingles@inas.edu.co'
                ];

                if (TEACHER_EMAILS.includes(cleanEmail)) {
                    setUserRole('teacher');
                    setLoading(false);
                    // Sincronizar o asegurar documento docente en Firestore
                    try {
                        const docRef = doc(db, 'users', user.uid);
                        await setDoc(docRef, {
                            email: cleanEmail,
                            name: user.displayName || 'Docente INAS',
                            role: 'teacher'
                        }, { merge: true });
                    } catch (e) {
                        console.warn("Aviso de sincronización de perfil docente en Firestore:", e);
                    }
                    return;
                }

                // 3. Para demás usuarios (estudiantes), asignar estrictamente rol 'student'
                try {
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const r = docSnap.data().role;
                        const role = (r === 'admin' || r === 'teacher') ? r : 'student';
                        setUserRole(role);
                    } else {
                        // Buscar si existe un perfil precargado con este email en la colección 'users'
                        try {
                            const qUsers = query(collection(db, 'users'), where('email', '==', cleanEmail));
                            const uSnap = await getDocs(qUsers);

                            if (!uSnap.empty) {
                                const uData = uSnap.docs[0].data();
                                const r = uData.role;
                                const resolvedRole = (r === 'admin' || r === 'teacher') ? r : 'student';
                                setUserRole(resolvedRole);

                                // Vincular el perfil existente al UID de autenticación actual
                                await setDoc(doc(db, 'users', user.uid), {
                                    ...uData,
                                    email: cleanEmail,
                                    name: user.displayName || uData.name || 'Estudiante INAS',
                                    role: resolvedRole
                                }, { merge: true });
                            } else {
                                setUserRole('student');
                            }
                        } catch {
                            setUserRole('student');
                        }
                    }
                } catch (error) {
                    console.error("Error al obtener rol del usuario:", error);
                    setUserRole('student');
                }
            } else {
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userRole,
        login,
        loginWithGoogle,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
