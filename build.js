const fs = require('fs');

fs.mkdirSync('public', { recursive: true });
let html = fs.readFileSync('index.html', 'utf8');
const scriptTag = '<script src="/ux-forms.js?v=20260914"></script>';
if (!html.includes(scriptTag)) {
  html = html.replace('</body>', `${scriptTag}</body>`);
}
fs.writeFileSync('public/index.html', html, 'utf8');
fs.copyFileSync('ux-forms.js', 'public/ux-forms.js');
