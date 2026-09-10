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

// Dominios y correos autorizados institucionalmente
export const isAuthorizedInstitutionalEmail = (email) => {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    return clean.endsWith('@inas.edu.co') || clean === 'admin@colegio.com';
};

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'teacher', 'parent'
    const [loading, setLoading] = useState(true);

    async function login(email, password) {
        const cleanEmail = email.trim().toLowerCase();

        // Validación estricta de dominio antes del intento de autenticación
        if (!isAuthorizedInstitutionalEmail(cleanEmail)) {
            const err = new Error('Solo se permiten cuentas de correo institucional (@inas.edu.co).');
            err.code = 'auth/unauthorized-domain';
            throw err;
        }

        return await signInWithEmailAndPassword(auth, cleanEmail, password);
    }

    // Inicio de sesión oficial con Google Workspace for Education (@inas.edu.co)
    async function loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        
        // Solicitar a Google que filtre prioritariamente las cuentas del dominio escolar
        provider.setCustomParameters({
            hd: 'inas.edu.co',
            prompt: 'select_account'
        });

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';

        // Si el usuario intentó seleccionar una cuenta no institucional (@gmail.com u otra)
        if (!isAuthorizedInstitutionalEmail(cleanEmail)) {
            await signOut(auth);
            const err = new Error('Acceso denegado: Solo se permiten cuentas institucionales con dominio @inas.edu.co.');
            err.code = 'auth/unauthorized-domain';
            throw err;
        }

        return user;
    }

    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
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
                try {
                    const cleanEmail = user.email.toLowerCase().trim();
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        setUserRole(docSnap.data().role);
                    } else {
                        // Buscar si existe un perfil precargado con este email en la colección 'users'
                        const qUsers = query(collection(db, 'users'), where('email', '==', cleanEmail));
                        const uSnap = await getDocs(qUsers);

                        if (!uSnap.empty) {
                            const uData = uSnap.docs[0].data();
                            const resolvedRole = uData.role || 'parent';
                            setUserRole(resolvedRole);

                            // Vincular el perfil existente al UID de autenticación actual
                            try {
                                await setDoc(doc(db, 'users', user.uid), {
                                    ...uData,
                                    email: cleanEmail,
                                    name: user.displayName || uData.name || 'Usuario INAS'
                                }, { merge: true });
                            } catch (e) {
                                // Continuar con el rol resuelto en memoria
                            }
                        } else {
                            // Directivos principales
                            if (cleanEmail === 'rectoria@inas.edu.co' || cleanEmail === 'secretaria@inas.edu.co' || cleanEmail === 'admin@colegio.com') {
                                setUserRole('admin');
                            } else {
                                // Por defecto, alumnos y padres que entran con Google institucional reciben rol 'parent'
                                setUserRole('parent');
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error al obtener rol del usuario:", error);
                    setUserRole('parent');
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
