import { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function CreateCircular() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState('NORMAL');
    const [reqAck, setReqAck] = useState(false);
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        if (!title || !body) return;

        setLoading(true);
        try {
            await addDoc(collection(db, "circulars"), {
                title,
                body,
                priority,
                requires_acknowledgment: reqAck,
                author_id: currentUser.uid,
                created_at: serverTimestamp(),
                audience: 'ALL',
                read_by: []
            });
            navigate('/'); // Volver al home
        } catch (error) {
            console.error("Error creando circular:", error);
            alert("Error al publicar");
        }
        setLoading(false);
    }

    return (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md mt-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Redactar Nueva Circular</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-gray-700 font-bold mb-2">Título</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Ej: Reunión de Padres"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">Contenido</label>
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        className="w-full border rounded-lg p-2 h-32 focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Escriba el mensaje aquí..."
                        required
                    />
                </div>

                <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={priority === 'HIGH'}
                            onChange={e => setPriority(e.target.checked ? 'HIGH' : 'NORMAL')}
                            className="w-5 h-5 text-red-600"
                        />
                        <span className={priority === 'HIGH' ? 'font-bold text-red-600' : 'text-gray-700'}>
                            Alta Prioridad
                        </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={reqAck}
                            onChange={e => setReqAck(e.target.checked)}
                            className="w-5 h-5"
                        />
                        <span className="text-gray-700">Requiere Acuse de Recibo</span>
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                >
                    {loading ? 'Publicando...' : 'Publicar Circular'}
                </button>
            </form>
        </div>
    );
}
