const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const SECRET_KEY = 'taskflow_secret_2026';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------- Auth Middleware ----------
function authMiddleware(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
}

// ---------- REGISTER ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const hashed = bcrypt.hashSync(password, 8);
  db.run(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashed],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE'))
          return res.status(400).json({ error: 'Email already registered' });
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Registered successfully' });
    }
  );
});

// ---------- LOGIN ----------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '2h' });
    res.json({ token, name: user.name, userId: user.id });
  });
});

// ---------- GET ALL USERS ----------
app.get('/api/users', authMiddleware, (req, res) => {
  db.all('SELECT id, name, email FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- CREATE PROJECT ----------
app.post('/api/projects', authMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name required' });

  db.run(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
    [name, description || '', req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
        [this.lastID, req.userId]);
      res.json({ message: 'Project created', projectId: this.lastID });
    }
  );
});

// ---------- GET MY PROJECTS ----------
app.get('/api/projects', authMiddleware, (req, res) => {
  const query = `
    SELECT projects.*, users.name as owner_name,
      (SELECT COUNT(*) FROM tasks WHERE tasks.project_id = projects.id) as task_count
    FROM projects
    JOIN project_members ON projects.id = project_members.project_id
    JOIN users ON projects.owner_id = users.id
    WHERE project_members.user_id = ?
    ORDER BY projects.created_at DESC
  `;
  db.all(query, [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- DELETE PROJECT ----------
app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  db.run('DELETE FROM projects WHERE id = ? AND owner_id = ?',
    [req.params.id, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('DELETE FROM tasks WHERE project_id = ?', [req.params.id]);
      db.run('DELETE FROM project_members WHERE project_id = ?', [req.params.id]);
      res.json({ message: 'Project deleted' });
    }
  );
});

// ---------- GET PROJECT TASKS ----------
app.get('/api/projects/:id/tasks', authMiddleware, (req, res) => {
  const query = `
    SELECT tasks.*,
      u1.name as assigned_name,
      u2.name as created_name
    FROM tasks
    LEFT JOIN users u1 ON tasks.assigned_to = u1.id
    LEFT JOIN users u2 ON tasks.created_by = u2.id
    WHERE tasks.project_id = ?
    ORDER BY tasks.created_at DESC
  `;
  db.all(query, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- CREATE TASK ----------
app.post('/api/projects/:id/tasks', authMiddleware, (req, res) => {
  const { title, description, priority, assigned_to, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title required' });

  db.run(
    `INSERT INTO tasks (project_id, title, description, priority, assigned_to, created_by, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, title, description || '', priority || 'medium',
     assigned_to || null, req.userId, due_date || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Task created', taskId: this.lastID });
    }
  );
});

// ---------- UPDATE TASK STATUS ----------
app.put('/api/tasks/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  db.run('UPDATE tasks SET status = ? WHERE id = ?',
    [status, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Status updated' });
    }
  );
});

// ---------- DELETE TASK ----------
app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ? AND created_by = ?',
    [req.params.id, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Task deleted' });
    }
  );
});

// ---------- GET TASK COMMENTS ----------
app.get('/api/tasks/:id/comments', authMiddleware, (req, res) => {
  const query = `
    SELECT task_comments.*, users.name
    FROM task_comments
    JOIN users ON task_comments.user_id = users.id
    WHERE task_comments.task_id = ?
    ORDER BY task_comments.created_at ASC
  `;
  db.all(query, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- ADD TASK COMMENT ----------
app.post('/api/tasks/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Comment required' });
  db.run(
    'INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)',
    [req.params.id, req.userId, content],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Comment added' });
    }
  );
});

// ---------- DELETE TASK COMMENT ----------
app.delete('/api/tasks/comments/:id', authMiddleware, (req, res) => {
  db.run('DELETE FROM task_comments WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Comment deleted' });
    }
  );
});

// ---------- ADD PROJECT MEMBER ----------
app.post('/api/projects/:id/members', authMiddleware, (req, res) => {
  const { user_id } = req.body;
  db.run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)',
    [req.params.id, user_id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Member added' });
    }
  );
});

const PORT = 3000;
app.listen(PORT, () => console.log(`TaskFlow running on http://localhost:${PORT}`));