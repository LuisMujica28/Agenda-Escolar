import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'teacher', 'parent'
    const [loading, setLoading] = useState(true);

    async function login(email, password) {
        // ---------------------------------------------------------
        // DEMO BACKDOOR: Acceso sin credenciales reales de Firebase
        // ---------------------------------------------------------
        if (email.includes('demo') || email.includes('school')) {
            console.log("Activando Modo Demo para:", email);
            let role = 'guest';
            if (email.includes('admin')) role = 'admin';
            if (email.includes('profe') || email.includes('teacher')) role = 'teacher';
            if (email.includes('padre') || email.includes('parent') || email.includes('demo')) role = 'parent';

            const fakeUser = {
                uid: 'fake-' + role + '-' + Date.now(),
                email,
                isAnonymous: false,
                displayName: 'Usuario Demo'
            };

            // Simulamos retardo de red
            await new Promise(r => setTimeout(r, 800));

            setCurrentUser(fakeUser);
            setUserRole(role);
            return fakeUser;
        }

        // Intento real con Firebase
        try {
            return await signInWithEmailAndPassword(auth, email, password);
        } catch (e) {
            // Si no hay API Key o falla, sugerimos modo demo
            if (e.code === 'auth/invalid-api-key' || e.code === 'auth/internal-error') {
                alert("⚠️ Firebase no configurado. \n\nEntrando automágicamente en MODO DEMO como Padre.");
                return login('demo@school.com', 'password');
            }
            throw e;
        }
    }

    function logout() {
        if (currentUser?.uid?.startsWith('fake-')) {
            setCurrentUser(null);
            setUserRole(null);
            return Promise.resolve();
        }
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            // Si estamos en modo fake, no dejar que el listener de firebase nos saque
            if (currentUser?.uid?.startsWith('fake-')) return;

            setCurrentUser(user);
            if (user) {
                try {
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserRole(docSnap.data().role);
                    } else {
                        console.warn("Usuario logueado sin perfil en 'users'");
                        setUserRole('guest');
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                }
            } else {
                setUserRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]); // Dependencia clave para mantener estado fake

    const value = {
        currentUser,
        userRole,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
