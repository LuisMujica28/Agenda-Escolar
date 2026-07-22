// Datos de prueba para que la app no se vea vacía en modo Demo

export const MOCK_NEWS = [
    {
        id: 'demo-1',
        title: 'Festival de Arte y Cultura',
        body: 'Estimados padres, este viernes celebraremos nuestro festival anual. Sus hijos pueden venir vestidos de su artista favorito. ¡Los esperamos a las 10:00 AM en el auditorio!',
        priority: 'NORMAL',
        created_at: { seconds: Date.now() / 1000 },
        author_id: 'admin',
        requires_acknowledgment: true,
        read_by: []
    },
    {
        id: 'demo-2',
        title: ' Suspensión de Ruta 4 - Urgente',
        body: 'Debido a obras en la Av. Principal, la Ruta 4 tendrá un retraso de 20 minutos esta tarde. Favor estar atentos al GPS.',
        priority: 'HIGH',
        created_at: { seconds: (Date.now() / 1000) - 86400 }, // Ayer
        author_id: 'admin',
        requires_acknowledgment: true,
        read_by: ['demo-parent']
    },
    {
        id: 'demo-3',
        title: 'Menú de Cafetería - Noviembre',
        body: 'Ya está disponible el menú saludable para el mes de noviembre. Pueden recargar las tarjetas en secretaría.',
        priority: 'NORMAL',
        created_at: { seconds: (Date.now() / 1000) - 172800 }, // Anteayer
        author_id: 'admin',
        requires_acknowledgment: false,
        read_by: []
    }
];

export const MOCK_STUDENTS = [
    {
        id: 'st-1',
        name: 'Juanito Pérez',
        grade: '9A',
        photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juanito',
        parent_uids: ['parent-1']
    },
    {
        id: 'st-2',
        name: 'María García',
        grade: '10B',
        photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
        parent_uids: ['parent-2']
    },
    {
        id: 'st-3',
        name: 'Carlos López',
        grade: '9A',
        photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos',
        parent_uids: ['parent-1']
    }
];

export const MOCK_LOGS = [
    {
        id: 'log-1',
        type: 'CONGRATS',
        content: 'Excelente participación en la clase de Historia. Ayudó a sus compañeros a entender el tema.',
        created_at: { seconds: Date.now() / 1000 },
        student_id: 'st-1'
    },
    {
        id: 'log-2',
        type: 'ALERT',
        content: 'Llegó tarde a clase después del recreo (15 min). Se le hizo un llamado de atención verbal.',
        created_at: { seconds: (Date.now() / 1000) - 86400 }, // Ayer
        student_id: 'st-1'
    },
    {
        id: 'log-3',
        type: 'NOTE',
        content: 'Recordar traer el material de geometría para la próxima semana (compás y regla).',
        created_at: { seconds: (Date.now() / 1000) - 200000 }, // Hace 2 días
        student_id: 'st-1'
    }
];

export const MOCK_PARENTS = [
    { uid: 'parent-1', displayName: 'Luisa Pérez (Acudiente de Juanito)', email: 'luisa@school.com' },
    { uid: 'parent-2', displayName: 'Pedro García (Acudiente de María)', email: 'pedro@school.com' },
    { uid: 'parent-3', displayName: 'Sofía López (Acudiente de Carlos)', email: 'sofia@school.com' },
    { uid: 'parent-4', displayName: 'Carlos Ramos (Acudiente de Mateo)', email: 'carlos@school.com' },
    { uid: 'demo-parent', displayName: 'Usuario Demo Acudiente (Mock)', email: 'demo@school.com' }
];

