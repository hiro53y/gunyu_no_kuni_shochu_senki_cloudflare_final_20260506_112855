const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'out', 'test-build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n');
