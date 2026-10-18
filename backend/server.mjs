import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.WEBEMACS_WORKSPACE || path.join(__dirname, '..', 'workspace'));
const app = express();
const port = Number(process.env.WEBEMACS_PORT || 4179);
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function resolveInsideWorkspace(relativePath = '') {
  if (typeof relativePath !== 'string' || relativePath.includes('\0')) throw new Error('잘못된 파일 경로입니다.');
  const resolved = path.resolve(root, relativePath || '.');
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('workspace 밖의 경로는 접근할 수 없습니다.');
  return resolved;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, workspace: root }));
app.get('/api/files', async (_req, res) => {
  try {
    await fs.mkdir(root, { recursive: true });
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = entries.map(entry => ({ name: entry.name, path: entry.name, directory: entry.isDirectory() }))
      .filter(entry => !entry.name.startsWith('.'))
      .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
    res.json({ files, workspace: root });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/file', async (req, res) => {
  try {
    const filePath = resolveInsideWorkspace(String(req.query.path || ''));
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return res.status(400).json({ error: '일반 파일만 열 수 있습니다.' });
    if (stat.size > 2 * 1024 * 1024) return res.status(413).json({ error: '2MB보다 큰 파일은 아직 지원하지 않습니다.' });
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ path: path.relative(root, filePath).split(path.sep).join('/'), content });
  } catch (error) { res.status(400).json({ error: error.code === 'ENOENT' ? '파일을 찾을 수 없습니다.' : error.message }); }
});
app.put('/api/file', async (req, res) => {
  try {
    const { path: relativePath, content } = req.body || {};
    if (typeof relativePath !== 'string' || !relativePath.trim()) return res.status(400).json({ error: '저장할 파일 이름이 필요합니다.' });
    if (typeof content !== 'string') return res.status(400).json({ error: '문서 내용이 올바르지 않습니다.' });
    if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) return res.status(413).json({ error: '2MB보다 큰 문서는 아직 지원하지 않습니다.' });
    const filePath = resolveInsideWorkspace(relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    res.json({ ok: true, path: path.relative(root, filePath).split(path.sep).join('/') });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*path', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
await fs.mkdir(root, { recursive: true });
app.listen(port, '127.0.0.1', () => console.log(`WebEmacs backend: http://127.0.0.1:${port} | workspace: ${root}`));
