// Builds the published site from the readable source in src2/.
// common.js goes in front of each page's script, then each script is obfuscated.
const fs = require('fs');
const path = require('path');
const Obf = require('javascript-obfuscator');
const csso = require('csso');
const { minify } = require('html-minifier-terser');
const [src, out, mode] = process.argv.slice(2);   // mode "readable" skips minifying and obfuscation
const PAGES = { 'landing.html': 'index.html', 'level1.html': '1/index.html', 'level2.html': '2/index.html', 'level3.html': '3/index.html' };
// WITHOUT_L3=1 leaves out the /3/ page (level 3 is otherwise gated by its release countdown)
if (process.env.WITHOUT_L3) delete PAGES['level3.html'];
// HOME_ONLY=1 builds just the homepage (the levels are retired)
if (process.env.HOME_ONLY) for (const k of Object.keys(PAGES)) if (k !== 'landing.html') delete PAGES[k];

// The project links are locked with the password (PBKDF2 + AES-GCM), so they aren't readable in the page source.
async function sealProjects(file) {
  const { password, links } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { subtle } = require('crypto').webcrypto;
  const salt = require('crypto').randomBytes(16), iv = require('crypto').randomBytes(12);
  const base = await subtle.importKey('raw', Buffer.from(password.trim().toLowerCase()), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const data = await subtle.encrypt({ name: 'AES-GCM', iv }, key, Buffer.from(JSON.stringify(links)));
  const b64 = (b) => Buffer.from(b).toString('base64');
  return [b64(salt), b64(iv), b64(data)].join('.');
}

(async () => {
  const common = fs.readFileSync(path.join(src, 'common.js'), 'utf8');
  const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
  fs.mkdirSync(path.join(out, 'stylesheets'), { recursive: true });
  fs.writeFileSync(path.join(out, 'stylesheets/styles.css'), mode === 'readable' ? css : csso.minify(css, { comments: false }).css + '\n');
  for (const [from, to] of Object.entries(PAGES)) {
    let html = fs.readFileSync(path.join(src, from), 'utf8');
    if (html.includes('__PROJECTS__')) html = html.replace('__PROJECTS__', await sealProjects(path.join(src, 'projects.json')));

    const m = html.match(/<script>\n([\s\S]*?)<\/script>/);
    let js = common + '\n' + m[1];
    if (mode !== 'readable') {
      js = Obf.obfuscate(js, {
        compact: true, controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.5,
        identifierNamesGenerator: 'hexadecimal', renameGlobals: true,
        stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 1,
        stringArrayRotate: true, stringArrayShuffle: true, splitStrings: true, splitStringsChunkLength: 6,
        unicodeEscapeSequence: false, selfDefending: false, target: 'browser'
      }).getObfuscatedCode();
    }
    html = html.replace(m[0], () => '<script>' + (mode === 'readable' ? '\n' : '') + js + '</script>');
    if (mode !== 'readable') html = await minify(html, { collapseWhitespace: true, removeComments: true });
    fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
    fs.writeFileSync(path.join(out, to), html + '\n');
    console.log('built', to, html.length, 'bytes');
  }
})();
