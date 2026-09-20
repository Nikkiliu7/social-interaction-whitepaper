// 开发期自检：ESM 语法检查 + 导入路径存在性 + 导出符号匹配。
// 用法：node web/tools/check.mjs
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jsRoot = path.join(here, '..', 'assets', 'js');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

const files = walk(jsRoot);
const temp = mkdtempSync(path.join(tmpdir(), 'slw-check-'));
const problems = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const mirror = path.join(temp, `${path.basename(file, '.js')}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(mirror, source, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', mirror], { stdio: 'pipe' });
  } catch (error) {
    problems.push(`[语法] ${path.relative(jsRoot, file)}\n${error.stderr?.toString() || error.message}`);
  }

  const importRe = /import\s+(?:([\s\S]*?)\s+from\s+)?['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(source))) {
    const [, clause, specifier] = match;
    const target = path.resolve(path.dirname(file), specifier);
    let targetSource = '';
    try {
      targetSource = readFileSync(target, 'utf8');
    } catch {
      problems.push(`[路径] ${path.relative(jsRoot, file)} → ${specifier} 不存在`);
      continue;
    }
    if (!clause || clause.trim().startsWith('*')) continue;
    const named = clause.match(/\{([\s\S]*?)\}/);
    if (!named) continue;
    for (const raw of named[1].split(',')) {
      const name = raw.split(' as ')[0].trim();
      if (!name) continue;
      const exported = new RegExp(
        `export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`
      ).test(targetSource);
      if (!exported) {
        problems.push(`[导出] ${path.relative(jsRoot, file)} 引用了 ${specifier} 中不存在的 ${name}`);
      }
    }
  }
}

rmSync(temp, { recursive: true, force: true });

if (problems.length) {
  console.error(problems.join('\n\n'));
  process.exit(1);
}
console.log(`OK：${files.length} 个模块语法、导入路径与导出符号检查通过`);
