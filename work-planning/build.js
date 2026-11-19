const fs = require('fs');
const t = fs.readFileSync('src/template.html', 'utf8');
const out = t.replace('%CSS%', () => fs.readFileSync('src/style.css', 'utf8'))
  .replace('%ENGINE%', () => fs.readFileSync('src/engine.js', 'utf8'))
  .replace('%APP%', () => fs.readFileSync('src/app.js', 'utf8'));
fs.writeFileSync('work-planning.html', out);
console.log('built work-planning.html', out.length, 'bytes');

// Shareable copy for a claude.ai Artifact: the host adds the doctype, <html>, <head> and viewport,
// and only allows Google Fonts from outside, so drop our skeleton lines and embed the logo.
const LOGO = '../tupande-farm-planner/assets/tupande-by-oaf-horizontal.png';
const logo = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
const art = out
  .replace(/^<!doctype html>\n<html[^>]*>\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n/, '')
  .split(LOGO).join(logo);
if (art.startsWith('<!doctype') || art.includes(LOGO)) throw new Error('artifact build: skeleton or logo path left in');
fs.writeFileSync('work-planning.artifact.html', art);
console.log('built work-planning.artifact.html', art.length, 'bytes');
