import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Configurar credenciales de Google
const credentialsPath = path.join(__dirname, '../credentials/vertex-key.json');
let vertexAiInstance = null;
let useDemoAI = false;

if (fs.existsSync(credentialsPath)) {
    try {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        
        // Leer el projectId desde el JSON de la cuenta de servicio
        const keyData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        const projectId = keyData.project_id || 'silver-tempo-497102-r1';
        
        console.log(`🔑 Credenciales cargadas exitosamente para el proyecto: ${projectId}`);
        
        vertexAiInstance = new VertexAI({
            project: projectId,
            location: 'us-central1'
        });
    } catch (err) {
        console.error("❌ Error al inicializar Vertex AI con las credenciales:", err);
        useDemoAI = true;
    }
} else {
    console.warn("⚠️ credentials/vertex-key.json no encontrado. Iniciando IA en MODO DEMO/FALLBACK.");
    useDemoAI = true;
}

// Cargar Manual de Convivencia
const manualPath = path.join(__dirname, 'data/manual_convivencia.txt');
let manualContent = '';
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("📘 Manual de Convivencia cargado en memoria de la IA.");
} else {
    console.warn("⚠️ Advertencia: No se encontró data/manual_convivencia.txt.");
}

// System Instruction para Gemini
const getSystemInstruction = (role) => {
    let roleGreeting = 'usuario escolar';
    if (role === 'teacher') roleGreeting = 'docente';
    if (role === 'parent') roleGreeting = 'acudiente/padre de familia';
    if (role === 'admin') roleGreeting = 'administrador del plantel';

    return `Eres "Hermes", el Asistente de IA oficial del Instituto Nueva América de Suba (INAS).
    Estás interactuando con un usuario que tiene el rol de: ${roleGreeting}.

    Tu misión es:
    1. Resolver dudas sobre el reglamento, horarios, uniformes, calificaciones y normas del colegio utilizando la información del Manual de Convivencia.
    2. Ayudar a redactar circulares, reportes, tareas o justificaciones si el rol del usuario lo requiere (ej. si es docente o acudiente).

    [INFORMACIÓN OFICIAL DEL MANUAL DE CONVIVENCIA INAS]
    ${manualContent}

    Reglas estrictas de respuesta:
    - Sé muy respetuoso, formal, amable y claro.
    - Basa tus respuestas únicamente en los datos provistos en el manual. Si no sabes algo o no está en el manual, di: "Esa consulta no se detalla en el Manual de Convivencia oficial. Te sugiero comunicarte con la secretaría o el coordinador correspondiente."
    - No inventes números de teléfono, direcciones ni nombres de docentes que no estén en el manual.
    - Mantén las respuestas breves y directas al grano.`;
};

// Endpoint principal de Chat
app.post('/api/ia/chat', async (req, res) => {
    const { messages, role } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Falta el historial de mensajes o el formato es inválido.' });
    }

    const lastMessage = messages[messages.length - 1]?.content;
    if (!lastMessage) {
        return res.status(400).json({ error: 'El último mensaje del usuario no puede estar vacío.' });
    }

    // --- MODO DEMO FALLBACK (Si no hay credenciales JSON reales) ---
    if (useDemoAI || !vertexAiInstance) {
        console.log("🤖 Procesando mensaje en MODO DEMO (Simulado)");
        await new Promise(r => setTimeout(r, 1200)); // Simular retraso

        const lowerMessage = lastMessage.toLowerCase();
        let demoResponse = "";

        if (lowerMessage.includes('manual') || lowerMessage.includes('convivencia')) {
            demoResponse = "El Manual de Convivencia del INAS establece que la convivencia se fundamenta en el respeto mutuo. Puedes consultar apartados sobre uniformes, faltas disciplinarias o escala académica desde este chat. ¿Hay algún tema en específico que desees conocer?";
        } else if (lowerMessage.includes('uniforme')) {
            demoResponse = "Según el Manual de Convivencia de INAS:\n- El Uniforme de Diario para mujeres es falda escocesa a la rodilla, chaleco azul oscuro, medias blancas y zapatos negros. Para hombres es pantalón gris, chaleco azul oscuro y zapatos negros.\n- El Uniforme de Educación Física es la sudera azul oficial y tenis totalmente blancos.";
        } else if (lowerMessage.includes('horario') || lowerMessage.includes('entrada') || lowerMessage.includes('salida')) {
            demoResponse = "El horario escolar para estudiantes en el INAS es de 7:00 AM a 2:00 PM. Se considera retardo a partir de las 7:05 AM. La atención a padres es los miércoles de 2:15 PM a 3:30 PM, con cita previa.";
        } else if (lowerMessage.includes('redactar') || lowerMessage.includes('escribir') || lowerMessage.includes('circular') || lowerMessage.includes('comunicado')) {
            demoResponse = "¡Claro! Aquí tienes una plantilla para tu circular:\n\n**Circular Oficial INAS**\nEstimados Padres de Familia,\n\nPor medio de la presente les informamos sobre la actividad programada... [Detallar actividad y fecha]. Agradecemos su colaboración y firma de autorización.\n\nAtentamente,\nDirección Académica.";
        } else if (lowerMessage.includes('nota') || lowerMessage.includes('calificacion') || lowerMessage.includes('promedio') || lowerMessage.includes('pasar')) {
            demoResponse = "La escala académica oficial evalúa de 0 a 100 puntos:\n- Superior: 95-100\n- Alto: 80-94\n- Básico (Mínimo aprobatorio): 75-79\n- Bajo (Reprobatorio): 0-74\nLas notas constan de 5 componentes (Pruebas, Guía, Ejercitación, Actitudinal), cada uno con un peso del 20%.";
        } else {
            demoResponse = `Hola. Soy Hermes, el asistente de IA del colegio INAS. Para darte una respuesta real de inteligencia artificial utilizando tus créditos de Google Cloud, recuerda configurar el archivo de credenciales de tu proyecto en la ruta 'credentials/vertex-key.json'.\n\nPor ahora (Modo Demo), puedo decirte que el horario de clases es de 7:00 AM a 2:00 PM y la nota mínima para aprobar es de 75 puntos. ¿En qué más puedo ayudarte?`;
        }

        return res.json({ response: demoResponse });
    }

    // --- MODO VERTEX AI GEMINI REAL (Si hay JSON de credenciales) ---
    try {
        console.log("🧠 Enviando prompt a Vertex AI Gemini...");
        const generativeModel = vertexAiInstance.getGenerativeModel({
            model: 'gemini-1.5-flash-002',
            generationConfig: {
                maxOutputTokens: 800,
                temperature: 0.3,
            },
            systemInstruction: {
                parts: [{ text: getSystemInstruction(role) }]
            }
        });

        // Dar formato al historial en la estructura de contenidos de la API de Vertex
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const result = await generativeModel.generateContent({ contents });
        const responseText = result.response.candidates[0].content.parts[0].text;
        
        console.log("✅ Respuesta recibida exitosamente de Vertex AI.");
        return res.json({ response: responseText });

    } catch (error) {
        console.error("❌ Error al conectar con Vertex AI:", error);
        return res.status(500).json({ 
            error: 'Ocurrió un error al procesar tu solicitud con la IA.',
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escolar corriendo en http://localhost:${PORT}`);
});
