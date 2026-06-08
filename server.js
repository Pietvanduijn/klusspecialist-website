const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database setup
const db = new sqlite3.Database('./klusspecialist.db', (err) => {
  if (err) console.error(err);
  else console.log('Connected to SQLite database');
});

// Initialize database tables
db.serialize(() => {
  // Company info table
  db.run(`CREATE TABLE IF NOT EXISTS company_info (
    id INTEGER PRIMARY KEY,
    name TEXT,
    owner TEXT,
    email TEXT,
    phone TEXT,
    region TEXT,
    description TEXT
  )`);

  // Projects table
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table (contact form)
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Initialize company info with defaults
  db.get('SELECT * FROM company_info LIMIT 1', (err, row) => {
    if (!row) {
      db.run(`INSERT INTO company_info (name, owner, email, phone, region, description) 
              VALUES (?, ?, ?, ?, ?, ?)`,
        ['De Klusspecialist van Duijn', 'Piet van Duijn', 'piet_vanduijn@msn.com', 
         '0624262413', 'Zuid-Holland', 'Gespecialiseerd in badkamers, toiletinstallaties en klussen in en rondom het huis']
      );
    }
  });
});

// API Routes

// Get company info
app.get('/api/company', (req, res) => {
  db.get('SELECT * FROM company_info LIMIT 1', (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || {});
  });
});

// Update company info
app.post('/api/company', (req, res) => {
  const { name, owner, email, phone, region, description } = req.body;
  db.run(
    `UPDATE company_info SET name=?, owner=?, email=?, phone=?, region=?, description=? WHERE id=1`,
    [name, owner, email, phone, region, description],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true });
    }
  );
});

// Get all projects
app.get('/api/projects', (req, res) => {
  db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

// Get single project
app.get('/api/projects/:id', (req, res) => {
  db.get('SELECT * FROM projects WHERE id=?', [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || {});
  });
});

// Create project with image
app.post('/api/projects', upload.single('image'), (req, res) => {
  const { title, category, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.run(
    `INSERT INTO projects (title, category, description, image_url) VALUES (?, ?, ?, ?)`,
    [title, category, description, image_url],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID, title, category, description, image_url });
    }
  );
});

// Update project
app.put('/api/projects/:id', upload.single('image'), (req, res) => {
  const { title, category, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
  
  db.run(
    `UPDATE projects SET title=?, category=?, description=?, image_url=? WHERE id=?`,
    [title, category, description, image_url, req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true });
    }
  );
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  db.run('DELETE FROM projects WHERE id=?', [req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

// Submit contact form
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  db.run(
    `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`,
    [name, email, message],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true, id: this.lastID });
    }
  );
});

// Get all messages (for admin)
app.get('/api/messages', (req, res) => {
  db.all('SELECT * FROM messages ORDER BY created_at DESC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📁 Uploads folder: ./uploads`);
  console.log(`💾 Database: ./klusspecialist.db`);
});
