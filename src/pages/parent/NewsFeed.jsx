import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import NewsCard from '../../components/NewsCard';
import { Loader2 } from 'lucide-react';
import { MOCK_NEWS } from '../../lib/mockData';

export default function NewsFeed() {
    const [newsList, setNewsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useAuth();

    useEffect(() => {
        async function fetchNews() {
            try {
                // Check Demo Mode
                if (currentUser?.uid?.startsWith('fake-')) {
                    // Simulamos carga
                    setTimeout(() => {
                        setNewsList(MOCK_NEWS);
                        setLoading(false);
                    }, 600);
                    return;
                }

                const q = query(collection(db, "circulars"), orderBy("created_at", "desc"));
                const querySnapshot = await getDocs(q);
                const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setNewsList(docs);
            } catch (error) {
                console.warn("Error cargando noticias (Fallback a Mock Data):", error);
                setNewsList(MOCK_NEWS);
            } finally {
                setLoading(false);
            }
        }

        fetchNews();
    }, [currentUser]);

    async function handleAcknowledge(newsId) {
        if (!currentUser) return;

        // Demo Mode Acknowledge
        if (currentUser.uid.startsWith('fake-')) {
            setNewsList(prev => prev.map(n =>
                n.id === newsId
                    ? { ...n, read_by: [...(n.read_by || []), currentUser.uid] }
                    : n
            ));
            alert("Acuse de recibo registrado (Simulado)");
            return;
        }

        try {
            const newsRef = doc(db, "circulars", newsId);
            await updateDoc(newsRef, {
                read_by: arrayUnion(currentUser.uid)
            });
            setNewsList(prev => prev.map(n =>
                n.id === newsId
                    ? { ...n, read_by: [...(n.read_by || []), currentUser.uid] }
                    : n
            ));
        } catch (error) {
            console.error("Error al firmar:", error);
        }
    }

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-xl mx-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800 px-1">Tablón de Anuncios</h2>
            {newsList.length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-white rounded-lg shadow-sm">
                    No hay circulares recientes.
                </div>
            ) : (
                newsList.map(item => (
                    <NewsCard
                        key={item.id}
                        news={item}
                        currentUserId={currentUser.uid}
                        onAcknowledge={handleAcknowledge}
                    />
                ))
            )}
        </div>
    );
}
