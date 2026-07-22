import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, getDocs, updateDoc, doc, arrayUnion, where } from 'firebase/firestore';
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
                let loadedCircs = [];
                // Check Demo Mode
                if (currentUser?.uid?.startsWith('fake-')) {
                    loadedCircs = MOCK_NEWS;
                } else {
                    const q = query(collection(db, "circulars"), orderBy("created_at", "desc"));
                    const querySnapshot = await getDocs(q);
                    loadedCircs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }

                // Cargar hijo para filtrar
                let activeStudent = null;
                if (currentUser?.uid?.startsWith('fake-')) {
                    const { MOCK_STUDENTS } = await import('../../lib/mockData');
                    activeStudent = MOCK_STUDENTS[0];
                } else {
                    const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                    const sSnap = await getDocs(qStudent);
                    if (!sSnap.empty) {
                        activeStudent = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
                    }
                }

                loadedCircs = loadedCircs.filter(c => {
                    if (!c.target_type) return true;
                    if (c.target_type === 'ALL') return true;
                    if (c.target_type === 'COURSE' && activeStudent && c.target_course === activeStudent.grade) return true;
                    if (c.target_type === 'STUDENTS' && activeStudent && c.target_students?.includes(activeStudent.id)) return true;
                    if (c.target_parent_uids?.includes(currentUser.uid)) return true;
                    return false;
                });

                setNewsList(loadedCircs);
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
            console.warn("No se pudo guardar la firma en Firestore (Modo Demo Fallback):", error);
            
            // Fallback local y persistencia compartida
            setNewsList(prev => prev.map(n =>
                n.id === newsId
                    ? { ...n, read_by: [...(n.read_by || []), currentUser.uid] }
                    : n
            ));

            const demoReads = JSON.parse(localStorage.getItem('demo_circular_reads') || '{}');
            const currentReads = demoReads[newsId] || [];
            if (!currentReads.includes(currentUser.uid)) {
                demoReads[newsId] = [...currentReads, currentUser.uid];
                localStorage.setItem('demo_circular_reads', JSON.stringify(demoReads));
            }
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
