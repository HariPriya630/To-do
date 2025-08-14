(() => {
  const $ = sel => document.querySelector(sel);
  const listEl = $('#list');
  const newTaskEl = $('#newTask');
  const priorityEl = $('#priority');
  const dueEl = $('#due');
  const addBtn = $('#addBtn');
  const filterEl = $('#filter');
  const sortEl = $('#sort');
  const searchEl = $('#search');
  const countEl = $('#count');
  const backupBtn = $('#backupBtn');
  const restoreFile = $('#restoreFile');
  const clearBtn = $('#clearBtn');
  const installBtn = $('#installBtn');

  let tasks = load();
  let dragId = null;
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });

  installBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  function load() {
    try { return JSON.parse(localStorage.getItem('smartTasks')||'[]'); }
    catch { return []; }
  }
  function save() {
    localStorage.setItem('smartTasks', JSON.stringify(tasks));
    updateCount();
  }

  function uid(){ return Math.random().toString(36).slice(2,9); }

  function addTask(text, priority='medium', due=null) {
    if (!text.trim()) return;
    tasks.push({ id: uid(), text: text.trim(), done:false, created: Date.now(), priority, due });
    save(); render();
  }

  function updateTask(id, props) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    Object.assign(t, props);
    save(); render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save(); render();
  }

  function reorder(id, beforeId) {
    const idx = tasks.findIndex(t => t.id === id);
    const [item] = tasks.splice(idx,1);
    const targetIdx = beforeId ? tasks.findIndex(t => t.id === beforeId) : tasks.length;
    tasks.splice(targetIdx,0,item);
    save(); render();
  }

  function isOverdue(t) {
    if (!t.due) return false;
    const d = new Date(t.due);
    const today = new Date(); today.setHours(0,0,0,0);
    return !t.done && d < today;
  }
  function isToday(t){
    if (!t.due) return false;
    const d = new Date(t.due);
    const today = new Date(); today.setHours(0,0,0,0);
    const td = new Date(today); return d.getTime() === td.getTime();
  }

  function sortTasks(arr) {
    const a = [...arr];
    switch (sortEl.value) {
      case 'due':
        a.sort((x,y) => (x.due||'9999') < (y.due||'9999') ? -1 : 1);
        break;
      case 'priority':
        const rank = {high:0, medium:1, low:2};
        a.sort((x,y) => (rank[x.priority] ?? 9) - (rank[y.priority] ?? 9));
        break;
      case 'alpha':
        a.sort((x,y) => x.text.localeCompare(y.text));
        break;
      default:
        a.sort((x,y) => x.created - y.created);
    }
    return a;
  }

  function filterTasks(arr) {
    const q = searchEl.value.trim().toLowerCase();
    let a = arr;
    if (filterEl.value === 'active') a = a.filter(t => !t.done);
    if (filterEl.value === 'completed') a = a.filter(t => t.done);
    if (filterEl.value === 'overdue') a = a.filter(isOverdue);
    if (filterEl.value === 'today') a = a.filter(isToday);
    if (q) a = a.filter(t => t.text.toLowerCase().includes(q));
    return a;
  }

  function updateCount(){
    countEl.textContent = tasks.length.toString();
  }

  function render() {
    const frag = document.createDocumentFragment();
    const visible = sortTasks(filterTasks(tasks));
    listEl.innerHTML = '';
    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No tasks. Add something above!';
      listEl.appendChild(empty);
      updateCount();
      return;
    }
    visible.forEach(t => frag.appendChild(renderTask(t)));
    listEl.appendChild(frag);
    updateCount();
  }

  function renderTask(t) {
    const el = document.createElement('div');
    el.className = 'task' + (t.done ? ' done' : '');
    el.draggable = true;
    el.dataset.id = t.id;

    el.addEventListener('dragstart', () => { dragId = t.id; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); });
    el.addEventListener('dragover', e => { e.preventDefault(); });
    el.addEventListener('drop', e => {
      e.preventDefault();
      const beforeId = el.dataset.id;
      if (dragId && dragId !== beforeId) reorder(dragId, beforeId);
    });

    const left = document.createElement('div');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = t.done;
    checkbox.addEventListener('change', () => updateTask(t.id, {done: checkbox.checked}));
    left.appendChild(checkbox);

    const center = document.createElement('div');
    const text = document.createElement('div');
    text.className = 'text';
    text.contentEditable = 'true';
    text.textContent = t.text;
    text.addEventListener('blur', () => updateTask(t.id, {text: text.textContent || ''}));
    text.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } });
    const meta = document.createElement('div');
    meta.className = 'meta';

    const chipP = document.createElement('span');
    chipP.className = 'chip ' + (t.priority === 'high' ? 'priority-high' : t.priority === 'low' ? 'priority-low' : 'priority-med');
    chipP.textContent = 'Priority: ' + t.priority;
    meta.appendChild(chipP);

    if (t.due) {
      const chipD = document.createElement('span');
      chipD.className = 'chip';
      chipD.textContent = 'Due: ' + t.due + (isOverdue(t) ? ' ⚠️' : isToday(t) ? ' • today' : '');
      meta.appendChild(chipD);
    }

    center.appendChild(text);
    center.appendChild(meta);

    const right = document.createElement('div');
    right.className = 'right';
    const editPriority = document.createElement('select');
    ['low','medium','high'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p[0].toUpperCase() + p.slice(1);
      if (t.priority === p) opt.selected = true;
      editPriority.appendChild(opt);
    });
    editPriority.addEventListener('change', () => updateTask(t.id, {priority: editPriority.value}));

    const editDue = document.createElement('input');
    editDue.type = 'date';
    editDue.value = t.due || '';
    editDue.addEventListener('change', () => updateTask(t.id, {due: editDue.value || null}));

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteTask(t.id));

    right.appendChild(editPriority);
    right.appendChild(editDue);
    right.appendChild(del);

    el.appendChild(left);
    el.appendChild(center);
    el.appendChild(right);
    return el;
  }

  addBtn.addEventListener('click', () => addTask(newTaskEl.value, priorityEl.value, dueEl.value || null));
  newTaskEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask(newTaskEl.value, priorityEl.value, dueEl.value || null);
  });
  [filterEl, sortEl].forEach(el => el.addEventListener('change', render));
  [searchEl].forEach(el => el.addEventListener('input', render));

  backupBtn.addEventListener('click', () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart-tasks-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  restoreFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        tasks = data;
        save(); render();
      } else { alert('Invalid backup file.'); }
    } catch(err){ alert('Could not restore backup.'); }
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Delete ALL tasks? This cannot be undone.')) {
      tasks = []; save(); render();
    }
  });

  // Initial render
  render();
})();