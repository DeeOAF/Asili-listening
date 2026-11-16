const fs=require('fs');
const t=fs.readFileSync('src/template.html','utf8');
const out=t.replace('%CSS%',()=>fs.readFileSync('src/style.css','utf8')).replace('%ENGINE%',()=>fs.readFileSync('src/engine.js','utf8')).replace('%APP%',()=>fs.readFileSync('src/app.js','utf8'));
fs.writeFileSync('work-planning.html',out);
console.log('built',out.length,'bytes');
