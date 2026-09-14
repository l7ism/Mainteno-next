const fs = require('fs');
const zlib = require('zlib');

fs.mkdirSync('public', { recursive: true });
let html = fs.readFileSync('index.html', 'utf8');

const scripts = [
  '<script src="/ux-forms.js?v=20260914"></script>',
  '<script src="https://vlxpqsmmzhnhkceqcnes.supabase.co/functions/v1/mainteno-user-admin-ui?v=20260914"></script>'
  '<script src="https://vlxpqsmmzhnhkceqcnes.supabase.co/functions/v1/mainteno-asset-ui?v=20260914p5"></script>'
];

for (const tag of scripts) {
  if (!html.includes(tag)) {
    const p = html.lastIndexOf('</body>');
    if (p < 0) throw new Error('Closing </body> tag not found');
    html = html.slice(0, p) + tag + html.slice(p);
  }
}

const pwaHead = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="/icon-192.png">',
  '<meta name="application-name" content="Mainteno Next">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Mainteno">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
].join('');

if (!html.includes('href="/manifest.webmanifest"')) {
  const p = html.indexOf('</head>');
  if (p < 0) throw new Error('Closing </head> tag not found');
  html = html.slice(0, p) + pwaHead + html.slice(p);
}

fs.writeFileSync('public/index.html', html);
fs.copyFileSync('ux-forms.js', 'public/ux-forms.js');

const manifest = {
  id: '/',
  name: 'Mainteno Next',
  short_name: 'Mainteno',
  description: 'GMAO mobile pour la maintenance industrielle',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#f3f4f6',
  theme_color: '#111827',
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ]
};

fs.writeFileSync(
  'public/manifest.webmanifest',
  JSON.stringify(manifest, null, 2)
);

function crc32(buf) {
  let c = 0xffffffff;

  for (const b of buf) {
    c ^= b;

    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }

  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);

  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);

  out.writeUInt32BE(
    crc32(Buffer.concat([t, data])),
    8 + data.length
  );

  return out;
}

function makeIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);

  const pad = Math.floor(size * 0.20);
  const thick = Math.max(8, Math.floor(size * 0.08));
  const top = Math.floor(size * 0.25);
  const bottom = Math.floor(size * 0.75);

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;

    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;

      let r = 17;
      let g = 24;
      let b = 39;

      const left =
        x >= pad &&
        x < pad + thick &&
        y >= top &&
        y <= bottom;

      const right =
        x >= size - pad - thick &&
        x < size - pad &&
        y >= top &&
        y <= bottom;

      const d1 =
        Math.abs(
          (x - pad) -
          (y - top) * 0.55
        ) < thick * 0.7;

      const d2 =
        Math.abs(
          (size - pad - x) -
          (y - top) * 0.55
        ) < thick * 0.7;

      const mid =
        y >= top &&
        y <= Math.floor(size * 0.58) &&
        (d1 || d2);

      if (left || right || mid) {
        r = 255;
        g = 255;
        b = 255;
      }

      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);

  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([
      137, 80, 78, 71,
      13, 10, 26, 10
    ]),
    chunk('IHDR', ihdr),
    chunk(
      'IDAT',
      zlib.deflateSync(raw, { level: 9 })
    ),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(
  'public/icon-192.png',
  makeIcon(192)
);

fs.writeFileSync(
  'public/icon-512.png',
  makeIcon(512)
);

const version = String(
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  Date.now()
).slice(0, 20);

const adminUi =
  'https://vlxpqsmmzhnhkceqcnes.supabase.co/functions/v1/mainteno-user-admin-ui?v=20260914';

const assetUi =
  'https://vlxpqsmmzhnhkceqcnes.supabase.co/functions/v1/mainteno-asset-ui?v=20260914p5';

const sw = `
const V=${JSON.stringify(version)};
const P='mainteno-next-';
const A=P+'app-'+V;
const R=P+'runtime-'+V;

const U=${JSON.stringify(adminUi)};
const X=${JSON.stringify(assetUi)};

const SHELL=[
  '/',
  '/index.html',
  '/ux-forms.js?v=20260914',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  U,
  X
];

self.addEventListener('install',e=>
  e.waitUntil((async()=>{

    const c=await caches.open(A);

    await Promise.allSettled(
      SHELL.map(async u=>{
        try{
          const r=await fetch(u,{cache:'reload'});

          if(r.ok || r.type==='opaque'){
            await c.put(u,r.clone());
          }
        }catch{}
      })
    );

    await self.skipWaiting();

  })())
);

self.addEventListener('activate',e=>
  e.waitUntil((async()=>{

    for(const k of await caches.keys()){

      if(
        k.startsWith(P) &&
        k!==A &&
        k!==R
      ){
        await caches.delete(k);
      }

    }

    await self.clients.claim();

  })())
);

async function nav(req){

  const c=await caches.open(A);

  try{

    const r=await fetch(req);

    if(r.ok){

      await c.put('/',r.clone());

      await c.put(
        '/index.html',
        r.clone()
      );

    }

    return r;

  }catch{

    return (
      await c.match('/index.html') ||
      await c.match('/') ||
      new Response(
        '<h1>Mainteno hors ligne</h1><p>Ouvre une fois l’application avec Internet pour activer le mode hors ligne.</p>',
        {
          headers:{
            'Content-Type':
            'text/html;charset=utf-8'
          }
        }
      )
    );

  }
}

async function swr(req,name){

  const c=await caches.open(name);

  const old=await c.match(
    req,
    {ignoreVary:true}
  );

  const net=fetch(req)
    .then(async r=>{

      if(r.ok || r.type==='opaque'){
        await c.put(
          req,
          r.clone()
        );
      }

      return r;

    })
    .catch(()=>null);

  return (
    old ||
    await net ||
    new Response(
      '',
      {status:503}
    )
  );
}

self.addEventListener('fetch',e=>{

  const q=e.request;

  if(q.method!=='GET'){
    return;
  }

  const u=new URL(q.url);

  if(
    q.mode==='navigate' &&
    u.origin===location.origin
  ){
    return e.respondWith(
      nav(q)
    );
  }

 if(u.href===U || u.href===X){

  return e.respondWith(
    swr(q,A)
  );

}
  if(u.origin!==location.origin){
    return;
  }

  if(
    ['script','style','image','manifest']
      .includes(q.destination) ||
    u.pathname==='/ux-forms.js' ||
    u.pathname==='/manifest.webmanifest'
  ){
    e.respondWith(
      swr(q,R)
    );
  }

});
`;

fs.writeFileSync(
  'public/sw.js',
  sw
);

console.log(
  'Mainteno Next PWA build:',
  version
);
