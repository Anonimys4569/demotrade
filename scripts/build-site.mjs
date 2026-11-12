// Збирає сайт у папку site/: головна сторінка + веб-додаток у site/app/
import fs from 'node:fs';
fs.rmSync('site', { recursive: true, force: true });
fs.mkdirSync('site/app', { recursive: true });
fs.cpSync('landing', 'site', { recursive: true });
fs.cpSync('dist', 'site/app', { recursive: true });
fs.mkdirSync('site/downloads', { recursive: true });
console.log('Сайт зібрано в папку site/');
