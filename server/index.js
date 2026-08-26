import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';
import nodemailer from 'nodemailer';

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

// Configurar transportador de correo (Nodemailer)
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

let mailTransporter = null;
let isEmailConfigured = false;

if (smtpUser && smtpPass) {
    try {
        mailTransporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        isEmailConfigured = true;
        console.log(`📧 Servicio de correo SMTP configurado exitosamente con cuenta: ${smtpUser}`);
    } catch (err) {
        console.error("❌ Error al inicializar transportador SMTP:", err);
    }
} else {
    console.warn("ℹ️ SMTP_USER / SMTP_PASS no configurados en .env. El envío de correos operará en MODO SIMULACIÓN Y REGISTRO.");
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

// Generador de Plantilla HTML para Notificación de Asistencia
const generateAttendanceEmailHtml = ({
    student_name,
    student_grade,
    parent_name,
    status,
    date_str,
    time_str,
    teacher_name,
    notes
}) => {
    const isAbsent = status === 'ABSENT';
    const titleText = isAbsent ? 'Alerta de Inasistencia Escolar' : 'Reporte de Llegada Tarde';
    const statusLabel = isAbsent ? 'INASISTENCIA REGISTRADA' : 'LLEGADA TARDE / RETARDO';
    const badgeBg = isAbsent ? '#fee2e2' : '#fef3c7';
    const badgeColor = isAbsent ? '#991b1b' : '#92400e';
    const headerGradient = isAbsent 
        ? 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)' 
        : 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${titleText}</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            
            <!-- Encabezado Institucional -->
            <tr>
                <td style="background: ${headerGradient}; padding: 32px 24px; text-align: center; color: #ffffff;">
                    <div style="font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; opacity: 0.9; margin-bottom: 6px;">
                        Instituto Nueva América de Suba (INAS)
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.2;">
                        ${titleText}
                    </h1>
                    <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.95;">
                        Control y Seguimiento Diario de Asistencia
                    </p>
                </td>
            </tr>

            <!-- Cuerpo del Mensaje -->
            <tr>
                <td style="padding: 30px 24px;">
                    <p style="font-size: 16px; margin: 0 0 16px 0; color: #334155; line-height: 1.5;">
                        Estimado(a) Acudiente <strong>${parent_name || 'Padre de Familia'}</strong>:
                    </p>
                    <p style="font-size: 15px; margin: 0 0 20px 0; color: #475569; line-height: 1.6;">
                        Le informamos que en el llamado a lista diario de la jornada escolar, se ha registrado la siguiente novedad de asistencia respecto a su acudido(a):
                    </p>

                    <!-- Tarjeta de Detalles del Estudiante -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                        <tr>
                            <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Estudiante</span>
                                <strong style="font-size: 17px; color: #0f172a;">${student_name}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 20px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
                                <table width="100%">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Curso / Grado</span>
                                            <strong style="font-size: 15px; color: #1e293b;">${student_grade}</strong>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Fecha del Reporte</span>
                                            <strong style="font-size: 15px; color: #1e293b;">${date_str} ${time_str ? `(${time_str})` : ''}</strong>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px;">Estado Reportado</span>
                                <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
                                    ${statusLabel}
                                </span>
                            </td>
                        </tr>
                        ${notes ? `
                        <tr>
                            <td style="padding: 14px 20px; background-color: #ffffff;">
                                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Observación del Docente</span>
                                <span style="font-size: 14px; color: #334155; line-height: 1.4;">${notes}</span>
                            </td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="padding: 12px 20px; background-color: #f1f5f9; font-size: 13px; color: #64748b;">
                                Registrado por: <strong>${teacher_name || 'Coordinación / Docencia INAS'}</strong>
                            </td>
                        </tr>
                    </table>

                    <!-- Aviso de Justificación -->
                    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
                        <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                            <strong>📌 ¿Qué debo hacer si es una inasistencia justificada?</strong><br>
                            Si el estudiante se encuentra enfermo o ausente por fuerza mayor, por favor ingrese a la <strong>Agenda Virtual Escolar</strong> o radique la incapacidad médica ante la secretaría del colegio dentro de los 3 días hábiles siguientes.
                        </p>
                    </div>

                    <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
                        Este es un mensaje automático de control institucional para la seguridad y tranquilidad de los hogares.
                    </p>
                </td>
            </tr>

            <!-- Pie de Página Institucional -->
            <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    <strong>Instituto Nueva América de Suba (INAS)</strong><br>
                    Formando líderes con excelencia y valores<br>
                    Bogotá D.C., Colombia • Agenda Virtual Escolar
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};

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

// Endpoint para Notificación de Inasistencias y Retardos por Correo
app.post('/api/attendance/notify', async (req, res) => {
    const { records, sender_name } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'No se enviaron registros de inasistencia para notificar.' });
    }

    const results = [];
    let sentCount = 0;
    let simulatedCount = 0;
    let failedCount = 0;

    for (const record of records) {
        const {
            student_id,
            student_name,
            student_grade,
            parent_name,
            parent_email,
            status,
            date_str,
            time_str,
            notes
        } = record;

        const effectiveEmail = (parent_email || '').trim();
        const isAbsent = status === 'ABSENT';
        const subject = isAbsent 
            ? `🚨 [INAS] Alerta de Inasistencia: ${student_name} (${student_grade}) - ${date_str}`
            : `⏰ [INAS] Reporte de Llegada Tarde: ${student_name} (${student_grade}) - ${date_str}`;

        const htmlContent = generateAttendanceEmailHtml({
            student_name,
            student_grade,
            parent_name,
            status,
            date_str,
            time_str: time_str || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            teacher_name: sender_name || 'Coordinación INAS',
            notes
        });

        if (!effectiveEmail || !effectiveEmail.includes('@')) {
            results.push({
                student_id,
                student_name,
                status: 'SKIPPED_NO_EMAIL',
                message: 'No tiene correo de acudiente registrado'
            });
            continue;
        }

        // Si tenemos SMTP configurado, enviar correo real
        if (isEmailConfigured && mailTransporter) {
            try {
                await mailTransporter.sendMail({
                    from: `"Instituto Nueva América" <${smtpUser}>`,
                    to: effectiveEmail,
                    subject,
                    html: htmlContent
                });
                sentCount++;
                results.push({
                    student_id,
                    student_name,
                    email: effectiveEmail,
                    status: 'SENT',
                    mode: 'SMTP_REAL'
                });
            } catch (mailErr) {
                console.error(`❌ Error al enviar correo a ${effectiveEmail}:`, mailErr);
                failedCount++;
                results.push({
                    student_id,
                    student_name,
                    email: effectiveEmail,
                    status: 'FAILED',
                    error: mailErr.message
                });
            }
        } else {
            // MODO SIMULACIÓN Y REGISTRO EN CONSOLA
            console.log(`📨 [SIMULACIÓN CORREO] Para: ${effectiveEmail} | Asunto: ${subject}`);
            simulatedCount++;
            results.push({
                student_id,
                student_name,
                email: effectiveEmail,
                status: 'SENT',
                mode: 'SIMULATED',
                preview_subject: subject
            });
        }
    }

    return res.json({
        success: true,
        total: records.length,
        sentCount: isEmailConfigured ? sentCount : simulatedCount,
        failedCount,
        isSimulated: !isEmailConfigured,
        results
    });
});

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

