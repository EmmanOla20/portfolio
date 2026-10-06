
require('dotenv').config(); // Load .env variables
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Email Transporter Setup ---
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- API: Get Projects ---
app.get('/api/projects', async (req, res) => {
  try {
    const file = await fs.readFile(path.join(__dirname, 'data/projects.json'), 'utf8');
    res.json(JSON.parse(file));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load projects' });
  }
});

// --- API: Contact Form ---
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (message.length < 10) {
    return res.status(400).json({ error: 'Message must be at least 10 characters.' });
  }

  try {
    const newMessage = {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      date: new Date().toISOString()
    };

    // 1. Save to JSON file (Backup log)
    let messages = [];
    try {
      const file = await fs.readFile(path.join(__dirname, 'data/messages.json'), 'utf8');
      messages = JSON.parse(file);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; 
    }
    
    messages.push(newMessage);
    await fs.writeFile(
      path.join(__dirname, 'data/messages.json'),
      JSON.stringify(messages, null, 2)
    );

    // 2. Send the Email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `New Portfolio Message from ${name}`,
      text: `You received a new message.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully for message from ${name}`);

    res.status(201).json({ ok: true, message: 'Message sent!' });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// Fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});