require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { readJSON, writeJSON } = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_TEST = process.env.NODE_ENV === 'test';

// Trust Render's reverse proxy so `secure` session cookies work behind HTTPS
app.set('trust proxy', 1);

// ---------- Security & parsing ----------
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Sessions ----------
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// ---------- Rate limiting ----------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
  skip: () => IS_TEST
});

app.use('/api/', apiLimiter);

// ---------- Email ----------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ---------- Validation schemas ----------
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(10).max(5000)
});

const projectCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  url: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(50)).max(10).optional().default([])
});

const projectUpdateSchema = projectCreateSchema.partial();

const messagePatchSchema = z.object({
  read: z.boolean()
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return res.status(400).json({
        error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request body'
      });
    }
    req.validated = result.data;
    next();
  };
}

// ---------- Auth middleware ----------
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ============ AUTH ============

app.post('/api/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.validated;

  if (username !== process.env.ADMIN_USER) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const ok = await bcrypt.compare(password, process.env.ADMIN_PASS_HASH || '');
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.user = { username };
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.status(401).json({ loggedIn: false });
});

// ============ PUBLIC ============

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await readJSON('projects.json');
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load projects' });
  }
});

app.post('/api/contact', validate(contactSchema), async (req, res) => {
  const { name, email, message } = req.validated;

  try {
    const newMessage = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      read: false,
      date: new Date().toISOString()
    };

    const messages = await readJSON('messages.json');
    messages.push(newMessage);
    await writeJSON('messages.json', messages);

    if (!IS_TEST) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: `New Portfolio Message from ${name}`,
        text: `You received a new message.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
      });
      console.log(`Email sent for message from ${name}`);
    }

    res.status(201).json({ ok: true, message: 'Message sent!' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// ============ PROJECTS CRUD ============

app.post('/api/projects', requireAuth, validate(projectCreateSchema), async (req, res) => {
  const { title, description, url, tags } = req.validated;
  const projects = await readJSON('projects.json');
  const project = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: description.trim(),
    url: url.trim(),
    tags
  };
  projects.push(project);
  await writeJSON('projects.json', projects);
  res.status(201).json(project);
});

app.put('/api/projects/:id', requireAuth, validate(projectUpdateSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.validated;
  const projects = await readJSON('projects.json');
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found.' });

  projects[idx] = {
    ...projects[idx],
    ...updates,
    title: updates.title?.trim() ?? projects[idx].title,
    description: updates.description?.trim() ?? projects[idx].description,
    url: updates.url?.trim() ?? projects[idx].url
  };
  await writeJSON('projects.json', projects);
  res.json(projects[idx]);
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const projects = await readJSON('projects.json');
  const next = projects.filter(p => p.id !== id);
  if (next.length === projects.length) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  await writeJSON('projects.json', next);
  res.json({ ok: true });
});

// ============ MESSAGES ============

app.get('/api/messages', requireAuth, async (req, res) => {
  const messages = await readJSON('messages.json');
  res.json(messages);
});

app.patch('/api/messages/:id', requireAuth, validate(messagePatchSchema), async (req, res) => {
  const { id } = req.params;
  const { read } = req.validated;
  const messages = await readJSON('messages.json');
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Message not found.' });
  messages[idx].read = read;
  await writeJSON('messages.json', messages);
  res.json(messages[idx]);
});

app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const messages = await readJSON('messages.json');
  const next = messages.filter(m => m.id !== id);
  if (next.length === messages.length) {
    return res.status(404).json({ error: 'Message not found.' });
  }
  await writeJSON('messages.json', next);
  res.json({ ok: true });
});

// ============ PAGES ============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------- 404 + error handler ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
});

// ---------- Start server (skip when imported by tests) ----------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel at http://localhost:${PORT}/admin`);
  });
}

module.exports = app;