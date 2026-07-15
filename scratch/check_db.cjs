const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Leer variables de .env manualmente
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, ''); // quitar comillas
        env[key] = value;
    }
});

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

async function checkDatabase() {
    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // Chequear cursos
        const cSnap = await getDocs(collection(db, 'courses'));
        console.log("=== CURSOS EN BD ===");
        cSnap.docs.forEach(doc => {
            console.log(`- ${doc.id}`);
        });

        // Chequear estudiantes
        const sSnap = await getDocs(collection(db, 'students'));
        console.log("\n=== ESTUDIANTES EN BD ===");
        console.log(`Total estudiantes: ${sSnap.size}`);
        sSnap.docs.slice(0, 10).forEach(doc => {
            console.log(`- ${doc.data().name} (Curso: ${doc.data().grade})`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

checkDatabase();
