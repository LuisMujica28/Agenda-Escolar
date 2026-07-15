import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function DigitalID() {
    const { currentUser } = useAuth();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStudent() {
            if (!currentUser) return;

            // Modo Demo
            if (currentUser.uid.startsWith('fake-')) {
                setStudent({
                    name: "Juanito Pérez",
                    grade: "9A",
                    id_code: "ST-2023-001",
                    photo_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Juanito"
                });
                setLoading(false);
                return;
            }

            try {
                const qStudent = query(collection(db, 'students'), where('parent_uids', 'array-contains', currentUser.uid));
                const sSnap = await getDocs(qStudent);

                if (!sSnap.empty) {
                    const studentData = sSnap.docs[0].data();
                    setStudent({
                        name: studentData.name,
                        firstName: studentData.firstName || '',
                        lastName: studentData.lastName || '',
                        grade: studentData.grade,
                        id_code: studentData.id_code || 'ST-N/A',
                        photo_url: studentData.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentData.name}`
                    });
                } else {
                    // Fallback
                    setStudent({
                        name: "Alumno no asignado",
                        grade: "N/A",
                        id_code: "ST-N/A",
                        photo_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=NoAssigned"
                    });
                }
            } catch (error) {
                console.error("Error al cargar carnet:", error);
            } finally {
                setLoading(false);
            }
        }

        loadStudent();
    }, [currentUser]);

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-sm mx-auto bg-white rounded-xl shadow-lg overflow-hidden mt-10 border border-gray-200 relative">
            <div className="bg-primary h-24 absolute w-full top-0"></div>
            <div className="px-6 pb-6 pt-16 relative text-center">
                <div className="w-24 h-24 mx-auto rounded-full border-4 border-white shadow-md bg-white overflow-hidden mb-4">
                    <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                </div>

                <h2 className="text-xl font-bold text-gray-800">
                    {student.lastName && student.firstName 
                        ? `${student.lastName} ${student.firstName}` 
                        : student.name}
                </h2>
                <p className="text-gray-500 font-medium">{student.grade}</p>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Estudiante Regular</p>

                <div className="mt-6 border-t pt-6 flex flex-col items-center">
                    {/* QR Code simple con imagen de API externa o placeholder */}
                    <div className="w-32 h-32 flex items-center justify-center border p-1 rounded bg-white">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${student.id_code}`} 
                            alt="QR Code" 
                            className="w-full h-full"
                        />
                    </div>
                    <p className="mt-2 text-sm font-mono text-gray-600">{student.id_code}</p>
                </div>

                <div className="mt-6 text-xs text-gray-400">
                    Válido hasta: Dic 2026
                </div>
            </div>
        </div>
    );
}

