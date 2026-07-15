const fs = require('fs');
const path = require('path');

// 1. Leer y parsear el CSV de estudiantes completos
const csvPath = path.join(__dirname, '../estudiantes_completos.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split(/\r?\n/);

const emailToNameMap = {};
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parsear fila respetando comillas
    const values = [];
    let inQuotes = false;
    let val = '';
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(val.trim());
            val = '';
        } else {
            val += char;
        }
    }
    values.push(val.trim());

    if (values.length >= 3) {
        const firstName = values[0];
        const lastName = values[1];
        const email = values[2].toLowerCase();
        emailToNameMap[email] = { firstName, lastName };
    }
}

// 2. Leer SeedPage.jsx
const seedPagePath = path.join(__dirname, '../src/pages/SeedPage.jsx');
let seedContent = fs.readFileSync(seedPagePath, 'utf-8');

// Listas originales de estudiantes en SeedPage
// Extraeremos y actualizaremos los arrays usando expresiones regulares o parseando y mapeando.
// Vamos a extraer DECIMO_STUDENTS y ONCE_STUDENTS

function extractArray(content, arrayName) {
    const regex = new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
    const match = content.match(regex);
    if (!match) return null;
    
    const arrayStr = match[1];
    // Convertir de formato texto JS a objetos
    const items = [];
    const itemRegex = /\{\s*name:\s*"([^"]+)",\s*email:\s*"([^"]+)",\s*id_code:\s*"([^"]+)"\s*\}/g;
    let m;
    while ((m = itemRegex.exec(arrayStr)) !== null) {
        items.push({ name: m[1], email: m[2], id_code: m[3] });
    }
    return { fullMatch: match[0], items };
}

const decimoInfo = extractArray(seedContent, 'DECIMO_STUDENTS');
const onceInfo = extractArray(seedContent, 'ONCE_STUDENTS');

function updateStudentsList(studentsList) {
    return studentsList.map(s => {
        const emailKey = s.email.toLowerCase();
        if (emailToNameMap[emailKey]) {
            const { firstName, lastName } = emailToNameMap[emailKey];
            return {
                firstName: firstName.toUpperCase(),
                lastName: lastName.toUpperCase(),
                email: s.email,
                id_code: s.id_code
            };
        } else {
            // Si no está, adivinar con nuestra regla
            const words = s.name.trim().split(/\s+/);
            let firstName = s.name;
            let lastName = '';
            if (words.length === 2) {
                firstName = words[0];
                lastName = words[1];
            } else if (words.length >= 3) {
                firstName = words.slice(0, -2).join(' ');
                lastName = words.slice(-2).join(' ');
            }
            return {
                firstName: firstName.toUpperCase(),
                lastName: lastName.toUpperCase(),
                email: s.email,
                id_code: s.id_code
            };
        }
    });
}

const updatedDecimo = updateStudentsList(decimoInfo.items);
const updatedOnce = updateStudentsList(onceInfo.items);

function arrayToJsString(array, arrayName) {
    let str = `const ${arrayName} = [\n`;
    array.forEach(s => {
        str += `    { firstName: "${s.firstName}", lastName: "${s.lastName}", email: "${s.email}", id_code: "${s.id_code}" },\n`;
    });
    str += `];`;
    return str;
}

const decimoStr = arrayToJsString(updatedDecimo, 'DECIMO_STUDENTS');
const onceStr = arrayToJsString(updatedOnce, 'ONCE_STUDENTS');

// Reemplazar en el archivo
const decimoRegex = /const\s+DECIMO_STUDENTS\s*=\s*\[[\s\S]*?\];/;
const onceRegex = /const\s+ONCE_STUDENTS\s*=\s*\[[\s\S]*?\];/;

seedContent = seedContent.replace(decimoRegex, decimoStr);
seedContent = seedContent.replace(onceRegex, onceStr);

fs.writeFileSync(seedPagePath, seedContent, 'utf-8');
console.log('SeedPage.jsx actualizado exitosamente con nombres y apellidos separados.');
