const API = 'http://localhost:3000/api';
let token = localStorage.getItem('token');
let currentUserId = localStorage.getItem('userId');
let currentProjectId = null;
let activeTaskId = null;
let allUsers = [];

// ---------- Toast ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2000);
}

// ---------- Modal Helpers ----------
document.querySelectorAll('.close').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.add('hidden');
  });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.remove('hidden');
  });
});

// ---------- Auth UI ----------
function updateAuthUI() {
  const name = localStorage.getItem('name');
  if (token) {
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('projectsBtn').classList.remove('hidden');
    document.getElementById('userGreeting').classList.remove('hidden');
    document.getElementById('userGreeting').textContent = `Hi, ${name}`;
    document.getElementById('landingSection').classList.add('hidden');
    document.getElementById('projectsSection').classList.remove('hidden');
    document.getElementById('boardSection').classList.add('hidden');
    loadProjects();
    loadUsers();
  } else {
    document.getElementById('loginBtn').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('projectsBtn').classList.add('hidden');
    document.getElementById('userGreeting').classList.add('hidden');
    document.getElementById('landingSection').classList.remove('hidden');
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('boardSection').classList.add('hidden');
  }
}

document.getElementById('loginBtn').addEventListener('click', () =>
  document.getElementById('authModal').classList.remove('hidden'));
document.getElementById('landingLoginBtn').addEventListener('click', () =>
  document.getElementById('authModal').classList.remove('hidden'));
document.getElementById('projectsBtn').addEventListener('click', () => {
  document.getElementById('projectsSection').classList.remove('hidden');
  document.getElementById('boardSection').classList.add('hidden');
  loadProjects();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  token = null;
  currentUserId = null;
  updateAuthUI();
});

// ---------- Register ----------
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const msg = document.getElementById('registerMessage');

  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) { msg.style.color = '#e3584f'; msg.textContent = data.error; return; }
    msg.style.color = '#4caf78';
    msg.textContent = 'Registered! Please login.';
    document.querySelector('[data-tab="loginForm"]').click();
  } catch (err) {
    msg.textContent = 'Server error.';
  }
});

// ---------- Login ----------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMessage');

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { msg.style.color = '#e3584f'; msg.textContent = data.error; return; }

    token = data.token;
    currentUserId = data.userId;
    localStorage.setItem('token', token);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('name', data.name);

    msg.style.color = '#4caf78';
    msg.textContent = 'Login successful!';
    setTimeout(() => {
      document.getElementById('authModal').classList.add('hidden');
      msg.textContent = '';
      updateAuthUI();
    }, 500);
  } catch (err) {
    msg.textContent = 'Server error.';
  }
});

// ---------- Load Users ----------
async function loadUsers() {
  try {
    const res = await fetch(`${API}/users`, { headers: { Authorization: token } });
    allUsers = await res.json();
    const select = document.getElementById('taskAssignee');
    select.innerHTML = '<option value="">Assign to (optional)</option>';
    allUsers.forEach(u => {
      select.innerHTML += `<option value="${u.id}">${u.name}</option>`;
    });
  } catch (err) {}
}

// ---------- Load Projects ----------
async function loadProjects() {
  const list = document.getElementById('projectsList');
  list.innerHTML = '<p style="color:#8a8a8a;text-align:center;padding:30px;">Loading...</p>';
  try {
    const res = await fetch(`${API}/projects`, { headers: { Authorization: token } });
    const projects = await res.json();

    if (projects.length === 0) {
      list.innerHTML = '<p style="color:#8a8a8a;text-align:center;padding:40px;">No projects yet. Create one!</p>';
      return;
    }

    list.innerHTML = projects.map(p => `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-info">
          <h3>${p.name}</h3>
          <p>${p.description || 'No description'} · by ${p.owner_name}</p>
        </div>
        <div class="project-card-meta">
          <span class="task-badge">${p.task_count} tasks</span>
          ${String(p.owner_id) === String(currentUserId) ?
            `<button class="delete-project-btn" data-id="${p.id}">🗑</button>` : ''}
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-project-btn')) return;
        openBoard(card.dataset.id, projects.find(p => String(p.id) === card.dataset.id).name);
      });
    });

    document.querySelectorAll('.delete-project-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this project?')) return;
        await fetch(`${API}/projects/${btn.dataset.id}`, {
          method: 'DELETE',
          headers: { Authorization: token }
        });
        showToast('Project deleted.');
        loadProjects();
      });
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e3584f;text-align:center;">Could not load projects.</p>';
  }
}

// ---------- New Project ----------
document.getElementById('newProjectBtn').addEventListener('click', () =>
  document.getElementById('newProjectModal').classList.remove('hidden'));

document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('projectName').value;
  const description = document.getElementById('projectDesc').value;
  const msg = document.getElementById('projectMessage');

  try {
    const res = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ name, description })
    });
    const data = await res.json();
    if (!res.ok) { msg.textContent = data.error; return; }

    document.getElementById('projectName').value = '';
    document.getElementById('projectDesc').value = '';
    document.getElementById('newProjectModal').classList.add('hidden');
    showToast('Project created!');
    loadProjects();
  } catch (err) {
    msg.textContent = 'Server error.';
  }
});

// ---------- Open Board ----------
function openBoard(projectId, projectName) {
  currentProjectId = projectId;
  document.getElementById('boardTitle').textContent = projectName;
  document.getElementById('projectsSection').classList.add('hidden');
  document.getElementById('boardSection').classList.remove('hidden');
  loadTasks();
}

document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('boardSection').classList.add('hidden');
  document.getElementById('projectsSection').classList.remove('hidden');
  loadProjects();
});

// ---------- Load Tasks ----------
async function loadTasks() {
  const cols = {
    todo: document.getElementById('tasks-todo'),
    inprogress: document.getElementById('tasks-inprogress'),
    done: document.getElementById('tasks-done')
  };

  Object.values(cols).forEach(col => col.innerHTML = '');

  try {
    const res = await fetch(`${API}/projects/${currentProjectId}/tasks`, {
      headers: { Authorization: token }
    });
    const tasks = await res.json();

    if (tasks.length === 0) {
      cols.todo.innerHTML = '<p style="color:#8a8a8a;font-size:13px;text-align:center;padding:20px;">No tasks yet.</p>';
      return;
    }

    tasks.forEach(task => {
      const col = cols[task.status] || cols.todo;
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <div class="task-card-title">${task.title}</div>
        <div class="task-card-meta">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${task.assigned_name ? `<span class="assigned-badge">👤 ${task.assigned_name}</span>` : ''}
          ${task.due_date ? `<span class="due-date">📅 ${task.due_date}</span>` : ''}
        </div>
        <div class="task-status-btns">
          <button class="status-btn ${task.status === 'todo' ? 'active' : ''}" 
            data-taskid="${task.id}" data-status="todo">Todo</button>
          <button class="status-btn ${task.status === 'inprogress' ? 'active' : ''}" 
            data-taskid="${task.id}" data-status="inprogress">In Progress</button>
          <button class="status-btn ${task.status === 'done' ? 'active' : ''}" 
            data-taskid="${task.id}" data-status="done">Done</button>
          ${String(task.created_by) === String(currentUserId) ?
            `<button class="status-btn" style="color:#e3584f;margin-left:auto;" 
              onclick="deleteTask(${task.id})">🗑</button>` : ''}
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('status-btn')) return;
        openTaskDetail(task);
      });

      card.querySelectorAll('.status-btn[data-status]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await fetch(`${API}/tasks/${btn.dataset.taskid}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: token },
            body: JSON.stringify({ status: btn.dataset.status })
          });
          showToast('Status updated!');
          loadTasks();
        });
      });

      col.appendChild(card);
    });
  } catch (err) {
    console.error('Could not load tasks.');
  }
}

// ---------- New Task ----------
document.getElementById('newTaskBtn').addEventListener('click', () =>
  document.getElementById('newTaskModal').classList.remove('hidden'));

document.getElementById('newTaskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDesc').value;
  const priority = document.getElementById('taskPriority').value;
  const due_date = document.getElementById('taskDueDate').value;
  const assigned_to = document.getElementById('taskAssignee').value;
  const msg = document.getElementById('taskMessage');

  try {
    const res = await fetch(`${API}/projects/${currentProjectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ title, description, priority, due_date, assigned_to })
    });
    const data = await res.json();
    if (!res.ok) { msg.textContent = data.error; return; }

    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('newTaskModal').classList.add('hidden');
    showToast('Task created!');
    loadTasks();
  } catch (err) {
    msg.textContent = 'Server error.';
  }
});

// ---------- Delete Task ----------
async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  await fetch(`${API}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  showToast('Task deleted.');
  loadTasks();
}

// ---------- Task Detail ----------
function openTaskDetail(task) {
  activeTaskId = task.id;
  document.getElementById('taskDetailBody').innerHTML = `
    <div class="task-detail-title">${task.title}</div>
    <p class="task-detail-desc">${task.description || 'No description.'}</p>
    <div class="task-detail-meta">
      <span class="meta-chip priority-badge priority-${task.priority}">${task.priority} priority</span>
      ${task.assigned_name ? `<span class="meta-chip">👤 ${task.assigned_name}</span>` : ''}
      ${task.due_date ? `<span class="meta-chip">📅 Due: ${task.due_date}</span>` : ''}
      <span class="meta-chip">Status: ${task.status}</span>
    </div>
  `;
  document.getElementById('taskDetailModal').classList.remove('hidden');
  loadTaskComments(task.id);
}

// ---------- Task Comments ----------
async function loadTaskComments(taskId) {
  const list = document.getElementById('taskCommentsList');
  list.innerHTML = '';
  try {
    const res = await fetch(`${API}/tasks/${taskId}/comments`, {
      headers: { Authorization: token }
    });
    const comments = await res.json();

    if (comments.length === 0) {
      list.innerHTML = '<p style="color:#8a8a8a;font-size:13px;padding:10px 0;">No comments yet.</p>';
      return;
    }

    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="comment-body">
          <h5>${c.name}</h5>
          <p>${c.content}</p>
        </div>
        ${String(c.user_id) === String(currentUserId) ?
          `<button class="delete-comment" onclick="deleteTaskComment(${c.id})">🗑</button>` : ''}
      </div>
    `).join('');
  } catch (err) {}
}

document.getElementById('submitTaskComment').addEventListener('click', async () => {
  const content = document.getElementById('taskCommentInput').value.trim();
  if (!content) return;

  try {
    await fetch(`${API}/tasks/${activeTaskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ content })
    });
    document.getElementById('taskCommentInput').value = '';
    showToast('Comment added!');
    loadTaskComments(activeTaskId);
  } catch (err) {}
});

async function deleteTaskComment(commentId) {
  await fetch(`${API}/tasks/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  showToast('Comment deleted.');
  loadTaskComments(activeTaskId);
}

// ---------- Init ----------
updateAuthUI();