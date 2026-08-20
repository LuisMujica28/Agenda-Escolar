export const CONVIVENCIA_CATEGORIES = {
    TIPO_1: {
        id: 'TIPO_1',
        name: 'Faltas Leves (Tipo I)',
        shortName: 'Tipo I - Leve',
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        pillColor: 'bg-emerald-600 text-white',
        severity: 'LEVE',
        description: 'Situaciones que alteran levemente la convivencia o el desarrollo de las actividades académicas (Ley 1620 / Manual INAS).'
    },
    TIPO_2: {
        id: 'TIPO_2',
        name: 'Faltas Graves (Tipo II)',
        shortName: 'Tipo II - Grave',
        color: 'bg-amber-50 text-amber-900 border-amber-200',
        badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
        pillColor: 'bg-amber-600 text-white',
        severity: 'GRAVE',
        description: 'Acciones que vulneran la sana convivencia, la honestidad, el respeto o el cuidado de bienes.'
    },
    TIPO_3: {
        id: 'TIPO_3',
        name: 'Faltas Gravísimas (Tipo III)',
        shortName: 'Tipo III - Gravísima',
        color: 'bg-rose-50 text-rose-900 border-rose-200',
        badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
        pillColor: 'bg-rose-600 text-white',
        severity: 'GRAVISIMA',
        description: 'Hechos de agresión física, acoso escolar, sustancias prohibidas o que atentan contra la integridad.'
    },
    RECONOCIMIENTO: {
        id: 'RECONOCIMIENTO',
        name: 'Méritos y Reconocimientos',
        shortName: 'Reconocimiento',
        color: 'bg-indigo-50 text-indigo-900 border-indigo-200',
        badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        pillColor: 'bg-indigo-600 text-white',
        severity: 'POSITIVO',
        description: 'Reconocimiento oficial a conductas sobresalientes, liderazgo, esfuerzo y excelencia académica.'
    }
};

export const CONVIVENCIA_PRESETS = [
    // --- TIPO I: FALTAS LEVES ---
    {
        id: 'retardo_jornada',
        category: 'TIPO_1',
        article: 'Art. 12 Num. 1 - Puntualidad e Ingreso al Plantel',
        title: 'Retardo al ingreso a la jornada escolar',
        shortTitle: '⏰ Llegada Tarde',
        icon: 'Clock',
        suggestedAction: 'Llamado de atención formativo y registro en observador.',
        getTemplate: (timeStr) => `[Art. 12 Num. 1 - Manual INAS] El estudiante ingresó con retraso a la jornada escolar a las ${timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} sin presentar justificación médica o excusa previa del acudiente. Se realiza registro formativo según el protocolo de puntualidad.`
    },
    {
        id: 'retardo_clase',
        category: 'TIPO_1',
        article: 'Art. 12 Num. 2 - Puntualidad en Cambios de Bloque',
        title: 'Retardo al cambio de bloque de clase',
        shortTitle: '⏳ Retardo a Clase',
        icon: 'Hourglass',
        suggestedAction: 'Llamado de atención verbal y compromiso de puntualidad.',
        getTemplate: () => `[Art. 12 Num. 2 - Manual INAS] El estudiante ingresó tarde al aula de clase tras el cambio de bloque o finalización del descanso sin autorización justificada, interrumpiendo el inicio de la sesión pedagógica.`
    },
    {
        id: 'porte_uniforme',
        category: 'TIPO_1',
        article: 'Art. 18 - Presentación Personal y Uniformes',
        title: 'Porte inadecuado del uniforme escolar reglamentario',
        shortTitle: '👔 Uniforme Inadecuado',
        icon: 'Shirt',
        suggestedAction: 'Notificación al acudiente para corrección de presentación personal.',
        getTemplate: () => `[Art. 18 - Manual INAS] Se evidencia porte inadecuado del uniforme reglamentario (uso de prendas no autorizadas, calzado no correspondiente al día o falta de distintivos institucionales). Se solicita a la familia garantizar el porte correcto del uniforme según el horario.`
    },
    {
        id: 'uso_celular',
        category: 'TIPO_1',
        article: 'Art. 22 - Uso de Dispositivos Electrónicos',
        title: 'Uso no autorizado de celular o audífonos en clase',
        shortTitle: '📱 Celular en Clase',
        icon: 'Smartphone',
        suggestedAction: 'Solicitud de guardar dispositivo y registro en observador.',
        getTemplate: () => `[Art. 22 - Manual INAS] El estudiante fue sorprendido utilizando el teléfono móvil / audífonos durante la explicación pedagógica sin previa autorización del docente. Se le solicita guardar el dispositivo para no distraer su proceso formativo.`
    },
    {
        id: 'sin_materiales',
        category: 'TIPO_1',
        article: 'Art. 15 - Deberes Académicos y Materiales',
        title: 'Incumplimiento de tareas o materiales requeridos',
        shortTitle: '📚 Sin Material / Tarea',
        icon: 'BookX',
        suggestedAction: 'Compromiso de presentar actividad y ponerse al día en la siguiente sesión.',
        getTemplate: () => `[Art. 15 - Manual INAS] El estudiante no presentó la tarea asignada ni trajo los útiles/cuaderno requeridos para el desarrollo de la actividad en clase, afectando su desempeño académico de la jornada.`
    },
    {
        id: 'indisciplina_interrupcion',
        category: 'TIPO_1',
        article: 'Art. 14 - Clima de Aula y Comportamiento',
        title: 'Indisciplina o interrupción recurrente de clase',
        shortTitle: '🗣️ Charla / Indisciplina',
        icon: 'MessageSquareX',
        suggestedAction: 'Llamado de atención verbal, cambio de puesto y compromiso pedagógico.',
        getTemplate: () => `[Art. 14 - Manual INAS] El estudiante presenta constante distracción, charlas reiteradas y fomento del desorden durante la clase, haciendo caso omiso a las instrucciones formativas del docente.`
    },
    {
        id: 'consumo_alimentos',
        category: 'TIPO_1',
        article: 'Art. 24 - Normas de Higiene y Cuidado de Espacios',
        title: 'Consumo de alimentos o chicle en clase',
        shortTitle: '🍔 Comida en Clase',
        icon: 'Coffee',
        suggestedAction: 'Disposición adecuada de alimentos en el bote de basura.',
        getTemplate: () => `[Art. 24 - Manual INAS] Consumo de alimentos o golosinas dentro del salón de clase en horario pedagógico no permitido, contraviniendo las normas de higiene y concentración en el aula.`
    },
    {
        id: 'personalizada_tipo1',
        category: 'TIPO_1',
        article: 'Art. 10 al 25 - Situaciones Tipo I',
        title: 'Novedad Leve Personalizada',
        shortTitle: '✍️ Otra Falta Leve',
        icon: 'Edit3',
        suggestedAction: 'Llamado de atención formativo y seguimiento.',
        getTemplate: () => `[Situación Tipo I - Manual INAS] `
    },

    // --- TIPO II: FALTAS GRAVES ---
    {
        id: 'evasion_clase',
        category: 'TIPO_2',
        article: 'Art. 31 - Permanencia en Actividades Pedagógicas',
        title: 'Evasión de clase encontrándose en el plantel',
        shortTitle: '🏃‍♂️ Evasión de Clase',
        icon: 'Footprints',
        suggestedAction: 'Citación a Coordinación de Convivencia con el acudiente.',
        getTemplate: () => `[Art. 31 - Manual INAS] El estudiante no ingresó al aula de clase encontrándose dentro de las instalaciones del colegio (evasión de clase). Se remite la novedad a Coordinación de Convivencia para seguimiento disciplinario con acudiente.`
    },
    {
        id: 'falta_respeto',
        category: 'TIPO_2',
        article: 'Art. 33 - Respeto y Trato Digno a la Comunidad',
        title: 'Falta de respeto o uso de vocabulario soez',
        shortTitle: '⚠️ Falta de Respeto',
        icon: 'AlertTriangle',
        suggestedAction: 'Acta de compromiso en Coordinación y reflexión sobre respeto comunitario.',
        getTemplate: () => `[Art. 33 - Manual INAS] El estudiante empleó vocabulario soez, tono desafiante o actitud de irrespeto hacia compañeros / docente durante la jornada escolar. Se abre proceso reflexivo formativo con compromiso suscrito.`
    },
    {
        id: 'fraude_academico',
        category: 'TIPO_2',
        article: 'Art. 35 - Honestidad Académica y SIEE',
        title: 'Deshonestidad académica / Fraude en evaluación',
        shortTitle: '📝 Fraude Académico',
        icon: 'FileX',
        suggestedAction: 'Anulación de la prueba, nota mínima y notificación formal al acudiente.',
        getTemplate: () => `[Art. 35 - Manual INAS] Se evidencia intento o comisión de fraude (copia en evaluación, alteración de documento o plagio de trabajo académico). Se anula la actividad evaluativa de acuerdo con el SIEE y se cita al acudiente.`
    },
    {
        id: 'dano_mobiliario',
        category: 'TIPO_2',
        article: 'Art. 37 - Cuidado y Preservación de Bienes Institucionales',
        title: 'Daño o deterioro voluntario de bienes del colegio',
        shortTitle: '📦 Daño a Mobiliario',
        icon: 'Hammer',
        suggestedAction: 'Compromiso de reparación y resarcimiento económico del bien afectado.',
        getTemplate: () => `[Art. 37 - Manual INAS] Se constata daño o uso destructivo sobre el mobiliario institucional (pupitre, pared, equipo tecnológico o instalaciones). El acudiente se compromete a la reposición o arreglo del bien afectado.`
    },
    {
        id: 'reincidencia_leves',
        category: 'TIPO_2',
        article: 'Art. 38 - Reincidencia y Escalamiento Convivencial',
        title: 'Reincidencia sistemática en faltas leves',
        shortTitle: '🔄 Reincidencia en Faltas',
        icon: 'RotateCcw',
        suggestedAction: 'Citación formal a acudiente con Director de Grupo y Coordinación.',
        getTemplate: () => `[Art. 38 - Manual INAS] El estudiante acumula 3 o más faltas leves en el periodo escolar sin evidenciar cambio de actitud ni cumplimiento de compromisos. Se escala a falta Tipo II y se solicita reunión presencial con el acudiente.`
    },
    {
        id: 'personalizada_tipo2',
        category: 'TIPO_2',
        article: 'Art. 30 al 40 - Situaciones Tipo II',
        title: 'Novedad Grave Personalizada',
        shortTitle: '✍️ Otra Falta Grave',
        icon: 'Edit3',
        suggestedAction: 'Citación a Coordinación y acta de compromiso.',
        getTemplate: () => `[Situación Tipo II - Manual INAS] `
    },

    // --- TIPO III: FALTAS GRAVÍSIMAS ---
    {
        id: 'agresion_fisica',
        category: 'TIPO_3',
        article: 'Art. 42 - Integridad Física y Convivencia Escolar',
        title: 'Agresión física o participación en riña escolar',
        shortTitle: '🥊 Agresión Física / Riña',
        icon: 'Flame',
        suggestedAction: 'Suspensión preventiva, activación de ruta Ley 1620 y citación a Comité de Convivencia.',
        getTemplate: () => `[Art. 42 - Manual INAS / Ley 1620] Participación en agresión física o riña que vulnera la integridad física de miembros de la comunidad escolar. Se activa de inmediato el protocolo de la Ruta de Atención Integral de Convivencia Escolar.`
    },
    {
        id: 'acoso_bullying',
        category: 'TIPO_3',
        article: 'Art. 44 - Prevención de Acoso Escolar (Ley 1620)',
        title: 'Acoso escolar sistemático (Bullying / Ciberbullying)',
        shortTitle: '🛑 Acoso Escolar / Bullying',
        icon: 'ShieldAlert',
        suggestedAction: 'Remisión urgente a Orientación Escolar, Coordinación y Comité de Convivencia.',
        getTemplate: () => `[Art. 44 - Manual INAS / Ley 1620] Se comprueba conducta reiterada de intimidación, burlas sistemáticas o agresión psicológica/digital hacia otro estudiante. Se activa protocolo de protección y acompañamiento psicosocial integral.`
    },
    {
        id: 'sustancias_prohibidas',
        category: 'TIPO_3',
        article: 'Art. 46 - Prohibición de Sustancias Nocivas',
        title: 'Porte o consumo de sustancias prohibidas (vapeador/alcohol/tabaco)',
        shortTitle: '🚬 Sustancias Prohibidas',
        icon: 'Ban',
        suggestedAction: 'Decomiso preventivo, citación urgente a padres y reporte a directivos.',
        getTemplate: () => `[Art. 46 - Manual INAS] Porte o consumo de sustancias no autorizadas (vapeadores, cigarrillos, bebidas alcohólicas u otras sustancias) dentro del plantel o portando el uniforme. Se cita con carácter de urgencia al acudiente.`
    },
    {
        id: 'personalizada_tipo3',
        category: 'TIPO_3',
        article: 'Art. 41 al 50 - Situaciones Tipo III',
        title: 'Novedad Gravísima Personalizada',
        shortTitle: '✍️ Otra Falta Gravísima',
        icon: 'Edit3',
        suggestedAction: 'Activación de Ruta Integral de Convivencia y citación urgente.',
        getTemplate: () => `[Situación Tipo III - Manual INAS / Ley 1620] `
    },

    // --- RECONOCIMIENTOS Y MÉRITOS ---
    {
        id: 'merito_excelencia',
        category: 'RECONOCIMIENTO',
        article: 'Art. 52 Num. 1 - Estímulo a la Excelencia Académica',
        title: 'Reconocimiento por Excelencia Académica y Actitudinal',
        shortTitle: '🌟 Excelencia / Liderazgo',
        icon: 'Star',
        suggestedAction: 'Felicitación oficial consignada en hoja de vida y cuadro de honor.',
        getTemplate: () => `[Art. 52 Num. 1 - Manual INAS] Se exalta y felicita al estudiante por su destacada participación, responsabilidad impecable y liderazgo positivo durante las actividades académicas e institucionales.`
    },
    {
        id: 'merito_solidaridad',
        category: 'RECONOCIMIENTO',
        article: 'Art. 52 Num. 2 - Estímulo a la Solidaridad y Compañerismo',
        title: 'Reconocimiento por Compañerismo y Solidaridad',
        shortTitle: '🤝 Solidaridad / Compañerismo',
        icon: 'HeartHandshake',
        suggestedAction: 'Mención de honor en observador escolar.',
        getTemplate: () => `[Art. 52 Num. 2 - Manual INAS] Felicitaciones por su gran espíritu de compañerismo, colaboración y apoyo desinteresado hacia sus pares y docentes, fortaleciendo el clima de sana convivencia institucional.`
    },
    {
        id: 'merito_superacion',
        category: 'RECONOCIMIENTO',
        article: 'Art. 52 Num. 3 - Estímulo al Esfuerzo y Progreso',
        title: 'Reconocimiento por Esfuerzo y Superación Constante',
        shortTitle: '📈 Progreso y Superación',
        icon: 'TrendingUp',
        suggestedAction: 'Estímulo motivacional en hoja de vida del estudiante.',
        getTemplate: () => `[Art. 52 Num. 3 - Manual INAS] Se exalta el compromiso, dedicación y evidente progreso del estudiante, demostrando superación y gran actitud positiva frente a sus metas escolares.`
    },
    {
        id: 'personalizada_merito',
        category: 'RECONOCIMIENTO',
        article: 'Art. 52 - Estímulos Institucionales',
        title: 'Reconocimiento Personalizado',
        shortTitle: '✍️ Otro Reconocimiento',
        icon: 'Edit3',
        suggestedAction: 'Mención de honor en observador.',
        getTemplate: () => `[Estímulo Institucional - Manual INAS] `
    }
];
