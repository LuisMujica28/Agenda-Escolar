const fs = require('fs');
const path = require('path');

// Leer SeedPage.jsx
const seedPagePath = path.join(__dirname, '../src/pages/SeedPage.jsx');
const seedContent = fs.readFileSync(seedPagePath, 'utf-8');

// Extraer ONCE_STUDENTS
const regex = /const\s+ONCE_STUDENTS\s*=\s*\[([\s\S]*?)\];/;
const match = seedContent.match(regex);
if (!match) {
    console.log("No se encontró ONCE_STUDENTS");
    process.exit(1);
}

const arrayStr = match[1];
const items = [];
const itemRegex = /\{\s*firstName:\s*"([^"]+)",\s*lastName:\s*"([^"]+)",\s*email:\s*"([^"]+)",\s*id_code:\s*"([^"]+)"\s*\}/g;
let m;
while ((m = itemRegex.exec(arrayStr)) !== null) {
    items.push({ firstName: m[1], lastName: m[2], email: m[3], id_code: m[4] });
}

// Ordenar por primer apellido
const sorted = [...items].sort((a, b) => {
    return a.lastName.localeCompare(b.lastName);
});

console.log("=== ESTUDIANTES DE 1101 ORDENADOS POR APELLIDO (A a Z) ===");
sorted.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.lastName}, ${s.firstName} (${s.email})`);
});
