import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Info, Medal } from 'lucide-react';
import { MOCK_LOGS } from '../../lib/mockData';

export default function StudentObserver() {
    const { currentUser } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLogs() {
            if (!currentUser) return;

            // Demo Mode
            if (currentUser.uid.startsWith('fake-')) {
                setTimeout(() => {
                    setLogs(MOCK_LOGS);
                    setLoading(false);
                }, 500);
                return;
            }

            try {
                // 1. Buscar hijo
                const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                const sSnap = await getDocs(qStudent);

                if (sSnap.empty) {
                    setLoading(false);
                    return;
                }

                const studentId = sSnap.docs[0].id; // Tomamos el primer hijo

                // 2. Buscar logs
                const qLogs = query(collection(db, 'observation_logs'), where('student_id', '==', studentId));
                const lSnap = await getDocs(qLogs);
                const logsList = lSnap.docs.map(d => d.data());
                logsList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                setLogs(logsList);
            } catch (e) {
                console.warn("Error observador (Fallback Mock)", e);
                setLogs(MOCK_LOGS);
            } finally {
                setLoading(false);
            }
        }

        loadLogs();
    }, [currentUser]);

    const icons = {
        'NOTE': <Info className="text-gray-500" />,
        'ALERT': <AlertTriangle className="text-red-500" />,
        'CONGRATS': <Medal className="text-green-500" />
    };

    const bgs = {
        'NOTE': 'bg-gray-50 border-gray-200',
        'ALERT': 'bg-red-50 border-red-200',
        'CONGRATS': 'bg-green-50 border-green-200'
    };

    if (loading) return <div className="p-4 text-center">Cargando observador...</div>;
    if (logs.length === 0) return <div className="p-4 text-center text-gray-500">No hay observaciones registradas.</div>;

    return (
        <div className="max-w-xl mx-auto">
            <h2 className="text-xl font-bold mb-4 px-1">Observador del Alumno</h2>
            <div className="space-y-3">
                {logs.map((log, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${bgs[log.type]} flex gap-4`}>
                        <div className={`mt-1 min-w-[20px]`}>{icons[log.type]}</div>
                        <div>
                            <p className="text-gray-800 text-sm whitespace-pre-wrap">{log.content}</p>
                            <p className="text-xs text-gray-400 mt-2">
                                {log.created_at?.seconds ? new Date(log.created_at.seconds * 1000).toLocaleDateString() : 'Fecha desconocida'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
