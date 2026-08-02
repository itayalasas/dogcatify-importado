const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const roots = ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'utils', 'supabase'];
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const methods = new Set(['log', 'debug', 'info', 'warn', 'error', 'trace']);

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return extensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function isConsoleCall(node) {
  const callee = node.callee;
  return node.type === 'CallExpression'
    && callee?.type === 'MemberExpression'
    && !callee.computed
    && callee.object?.type === 'Identifier'
    && callee.object.name === 'console'
    && callee.property?.type === 'Identifier'
    && methods.has(callee.property.name);
}

function isRequiredBody(statementPath) {
  const parent = statementPath.parentPath;
  if (!parent) return false;
  if (parent.isIfStatement()) {
    return parent.node.consequent === statementPath.node || parent.node.alternate === statementPath.node;
  }
  if (parent.isWhileStatement() || parent.isDoWhileStatement() || parent.isForStatement()
    || parent.isForInStatement() || parent.isForOfStatement() || parent.isLabeledStatement()
    || parent.isWithStatement()) {
    return parent.node.body === statementPath.node;
  }
  return false;
}

function removeConsoleCalls(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes('console.')) return 0;

  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'dynamicImport', 'importAttributes', 'topLevelAwait'],
    });
  } catch (error) {
    throw new Error(`No se pudo analizar ${filePath}: ${error.message}`);
  }

  const edits = [];
  traverse(ast, {
    CallExpression(callPath) {
      if (!isConsoleCall(callPath.node)) return;

      const statementPath = callPath.findParent((candidate) => candidate.isExpressionStatement());
      const isOnlyExpression = statementPath?.node.expression === callPath.node;

      if (isOnlyExpression && isRequiredBody(statementPath)) {
        edits.push({ start: statementPath.node.start, end: statementPath.node.end, replacement: '{}' });
        return;
      }

      if (isOnlyExpression) {
        const lineStart = source.lastIndexOf('\n', statementPath.node.start - 1) + 1;
        const prefix = source.slice(lineStart, statementPath.node.start);
        if (/^\s*$/.test(prefix)) {
          let lineEnd = source.indexOf('\n', statementPath.node.end);
          if (lineEnd === -1) lineEnd = statementPath.node.end;
          else lineEnd += 1;
          edits.push({ start: lineStart, end: lineEnd, replacement: '' });
          return;
        }
      }

      edits.push({ start: callPath.node.start, end: callPath.node.end, replacement: 'undefined' });
    },
  });

  const uniqueEdits = [...new Map(edits.map((edit) => [`${edit.start}:${edit.end}`, edit])).values()]
    .sort((a, b) => b.start - a.start);
  let output = source;
  let lastStart = Infinity;
  let applied = 0;
  for (const edit of uniqueEdits) {
    if (edit.end > lastStart) continue;
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
    lastStart = edit.start;
    applied += 1;
  }

  if (output !== source) fs.writeFileSync(filePath, output);
  return applied;
}

let changedFiles = 0;
let removedCalls = 0;
for (const filePath of roots.flatMap(collectFiles)) {
  const count = removeConsoleCalls(filePath);
  if (count > 0) changedFiles += 1;
  removedCalls += count;
}

process.stdout.write(`Eliminadas ${removedCalls} llamadas de consola en ${changedFiles} archivos.\n`);
