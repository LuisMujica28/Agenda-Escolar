const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../estudiantes_completos.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split(/\r?\n/);

lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('becerra')) {
        console.log(`Line ${idx + 1}: ${line}`);
    }
});
