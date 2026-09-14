const fs = require('fs');

fs.mkdirSync('public', { recursive: true });

let html = fs.readFileSync('index.html', 'utf8');

const scriptTag = '<script src="/ux-forms.js?v=20260914"></script>';

if (!html.includes(scriptTag)) {
  const bodyEnd = html.lastIndexOf('</body>');

  if (bodyEnd === -1) {
    throw new Error('Closing </body> tag not found in index.html');
  }

  html =
    html.slice(0, bodyEnd) +
    scriptTag +
    html.slice(bodyEnd);
}

fs.writeFileSync('public/index.html', html, 'utf8');
fs.copyFileSync('ux-forms.js', 'public/ux-forms.js');
