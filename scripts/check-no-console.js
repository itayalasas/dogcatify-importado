const fs = require('node:fs');
const path = require('node:path');

const roots = ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'utils', 'supabase'];
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const pattern = /console\.(log|debug|info|warn|error|trace)\s*\(/g;
const violations = [];

function visit(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(fullPath);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) violations.push(`${fullPath}:${index + 1}`);
    });
  }
}

roots.forEach(visit);

if (violations.length > 0) {
  process.stderr.write(`Se encontraron ${violations.length} llamadas de consola:\n${violations.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Sin llamadas de consola en el código de aplicación y backend.\n');
