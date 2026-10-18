import { basicSetup, EditorView } from 'codemirror';
import { vim, getCM } from '@replit/codemirror-vim';
import { keymap } from '@codemirror/view';
import { indentWithTab, defaultKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import './style.css';

type FileEntry = { name: string; path: string; directory: boolean };
const API = 'http://127.0.0.1:4179/api';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fileList = $('file-list');
const tabName = $('tab-name');
const fileStatus = $('file-status');
const unsavedIndicator = $('unsaved-indicator');
const modeLabel = $('mode-label');
const cursorStatus = $('cursor-status');
const message = $('message');
const commandInput = $('command-input') as HTMLInputElement;
let currentPath = 'scratch.txt';
let savedText = '';
let suppressChange = false;

const editor = new EditorView({
  doc: '# Welcome to WebEmacs\n\nA small, keyboard-first editor for the browser.\n\n## Quick start\n- Press i to enter Insert mode.\n- Press Esc to return to Normal mode.\n- Type :help in the command bar below for available commands.\n- Use Open to load a file from the local workspace.\n\n한글 입력도 시험해 보세요.\n',
  extensions: [
    basicSetup,
    vim(),
    keymap.of([...defaultKeymap, ...searchKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !suppressChange) updateDirtyState();
      if (update.selectionSet || update.docChanged) updateCursor();
    }),
    EditorView.theme({
      '&': { height: '100%', backgroundColor: '#111318', color: '#d7dce5', fontSize: '14px' },
      '.cm-content': { fontFamily: 'JetBrains Mono, SFMono-Regular, Consolas, monospace', padding: '22px 24px', caretColor: '#9fe870' },
      '.cm-gutters': { backgroundColor: '#111318', color: '#626b7b', border: 'none', paddingLeft: '12px' },
      '.cm-activeLineGutter': { backgroundColor: '#1a1e26' },
      '.cm-activeLine': { backgroundColor: '#171b22' },
      '&.cm-focused': { outline: 'none' },
      '.cm-cursor': { borderLeftColor: '#a6e3a1' },
      '.cm-selectionBackground, ::selection': { backgroundColor: '#34435b !important' }
    })
  ]
});
$('editor-host').append(editor.dom);

function notify(text: string, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}
function updateDirtyState() {
  const dirty = editor.state.doc.toString() !== savedText;
  unsavedIndicator.classList.toggle('visible', dirty);
  tabName.textContent = currentPath.split('/').pop() || 'scratch.txt';
  fileStatus.textContent = currentPath + (dirty ? ' •' : '');
}
function updateCursor() {
  const pos = editor.state.selection.main.head;
  const line = editor.state.doc.lineAt(pos);
  cursorStatus.textContent = `Ln ${line.number}, Col ${pos - line.from + 1}`;
  const cm = getCM(editor);
  if (cm) modeLabel.textContent = cm.state.vim.insertMode ? 'INSERT' : 'NORMAL';
}
async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
async function refreshFiles() {
  try {
    const data = await request('/files');
    fileList.replaceChildren();
    if (!data.files.length) {
      fileList.innerHTML = '<div class="empty">workspace 폴더에 파일이 없습니다.</div>';
      return;
    }
    for (const file of data.files as FileEntry[]) {
      if (file.directory) continue;
      const button = document.createElement('button');
      button.className = 'file-item' + (file.path === currentPath ? ' selected' : '');
      button.innerHTML = `<span class="file-glyph">${file.name.endsWith('.md') ? 'M' : '·'}</span><span></span>`;
      button.lastElementChild!.textContent = file.name;
      button.title = file.path;
      button.addEventListener('click', () => openFile(file.path));
      fileList.append(button);
    }
  } catch {
    fileList.innerHTML = '<div class="empty">로컬 서버를 찾을 수 없습니다.<br>터미널에서 npm run dev를 실행하세요.</div>';
  }
}
async function openFile(path: string) {
  try {
    const data = await request(`/file?path=${encodeURIComponent(path)}`);
    suppressChange = true;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: data.content } });
    suppressChange = false;
    currentPath = data.path;
    savedText = data.content;
    updateDirtyState(); updateCursor(); await refreshFiles();
    notify(`열었습니다: ${currentPath}`);
  } catch (error) { notify((error as Error).message, true); }
}
async function saveFile() {
  const content = editor.state.doc.toString();
  try {
    const data = await request('/file', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath, content }) });
    currentPath = data.path; savedText = content; updateDirtyState(); await refreshFiles();
    notify(`저장했습니다: ${currentPath}`);
  } catch (error) { notify((error as Error).message, true); }
}
function newFile() {
  suppressChange = true;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } });
  suppressChange = false;
  currentPath = 'scratch.txt'; savedText = ''; updateDirtyState(); updateCursor();
  notify('새 버퍼를 만들었습니다. 저장할 파일 이름을 :w 명령으로 지정하세요.');
}
function runCommand(raw: string) {
  const parts = raw.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const arg = parts.slice(1).join(' ');
  commandInput.value = '';
  if (!command) return;
  if (command === 'w' || command === 'write' || command === 'save') {
    if (arg) currentPath = arg;
    void saveFile();
  } else if (command === 'e' || command === 'edit' || command === 'open') {
    if (!arg) { notify('사용법: :e 파일이름', true); return; }
    void openFile(arg);
  } else if (command === 'q' || command === 'quit') {
    if (editor.state.doc.toString() !== savedText) { notify('저장되지 않은 변경 사항이 있습니다. 먼저 :w로 저장하세요.', true); return; }
    newFile();
  } else if (command === 'help') {
    notify('명령: :w [파일] 저장 · :e 파일 열기 · :new 새 버퍼 · :q 버퍼 초기화 · :help 도움말');
  } else if (command === 'new') newFile();
  else notify(`알 수 없는 명령: ${command} ( :help 입력)`, true);
}

$('new-file').addEventListener('click', newFile);
$('open-file').addEventListener('click', () => {
  const path = window.prompt('workspace 내 파일 경로를 입력하세요. 예: notes.md');
  if (path) void openFile(path);
});
$('save-file').addEventListener('click', () => void saveFile());
$('refresh-files').addEventListener('click', () => void refreshFiles());
$('toggle-sidebar').addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('hidden'));
commandInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); runCommand(commandInput.value.replace(/^:/, '')); editor.focus(); }
  if (event.key === 'Escape') { commandInput.value = ''; editor.focus(); }
});
document.addEventListener('keydown', (event) => {
  if (event.key === ':' && document.activeElement !== commandInput && !(document.activeElement instanceof HTMLInputElement)) {
    event.preventDefault(); commandInput.focus(); commandInput.value = ':'; commandInput.setSelectionRange(1, 1);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault(); void saveFile();
  }
});

request('/health').then(() => {
  $('connection-label').textContent = '로컬 연결됨';
  document.querySelector('.connection-dot')?.classList.add('online');
  void refreshFiles();
}).catch(() => {
  $('connection-label').textContent = '서버 미연결';
  notify('로컬 백엔드가 실행되지 않았습니다. npm install 후 npm run dev를 실행하세요.', true);
});
updateCursor();
