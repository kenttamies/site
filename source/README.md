# Counter game (retired)

The refresh-counter game that ran on kenttami.es in October–November 2026: levels 1–3 and the level picker.

- `1/`, `2/`, `3/`, `index.html`: the published (obfuscated) pages as they were live.
- `source/`: the readable source. `common.js` is prepended to each page's script at build time.

Build: `npm i javascript-obfuscator csso html-minifier-terser`, then
`node source/build.js source <out-dir>` (add `readable` as a third argument to skip minifying).
