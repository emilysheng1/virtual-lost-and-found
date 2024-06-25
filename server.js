const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;
const secretKey = "qwerty12345";

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(express.static('frontend'));

const db = new sqlite3.Database('items.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        image TEXT,
        status TEXT,
        email TEXT,
        date TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS blacklisted_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        expiry DATE NOT NULL
    )`);
});

app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], function (err) {
            if (err) {
                return res.status(400).send({ error: err.message });
            }
            const token = jwt.sign({ userId: this.lastID }, secretKey, { expiresIn: '24h' });
            res.status(201).send({ userId: this.lastID, token });
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).send({ error: err.message });
        }
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send({ error: 'Email or password is incorrect' });
        }
        const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '24h' });
        res.send({ userId: user.id, token });
    });
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    db.get('SELECT * FROM blacklisted_tokens WHERE token = ?', [token], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.sendStatus(500);
        }
        if (row) {
            return res.sendStatus(401);
        }

        jwt.verify(token, secretKey, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    });
};

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

app.post('/submit-item', upload.single('itemImage'), (req, res) => {
    const { itemName, itemDescription, itemStatus, userEmail } = req.body;
    const itemImage = req.file;
    const itemDate = new Date().toLocaleDateString('en-US');

    console.log('Received data:', req.body);
    console.log('Received file:', itemImage);
    console.log('Generated date:', itemDate); 

    const newItem = {
        name: itemName,
        description: itemDescription,
        status: itemStatus,
        date: itemDate, 
        email: userEmail,
        imageUrl: itemImage ? `/uploads/${itemImage.filename}` : null 
    };

    const query = `INSERT INTO items (name, description, status, email, image, date) VALUES (?, ?, ?, ?, ?, ?)`;
    const values = [newItem.name, newItem.description, newItem.status, newItem.email, newItem.imageUrl, newItem.date];

    console.log('Executing query:', query);
    console.log('With values:', values);

    db.run(query, values, function (err) {
        if (err) {
            console.error('Database insertion error:', err.message); 
            res.status(500).send({ error: 'Failed to submit item' });
        } else {
            newItem.id = this.lastID; // Add the id of the new item
            res.json(newItem);
        }
    });
});


app.get('/items', (req, res) => {
    db.all('SELECT * FROM items', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json(rows);
        }
    });
});

app.delete('/delete-item/:id', (req, res) => {
    const itemId = parseInt(req.params.id);
    db.run('DELETE FROM items WHERE id = ?', [itemId], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json({ message: 'Item deleted successfully' });
        }
    });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Ensure this path is correct

app.post('/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const expiry = jwt.decode(token).exp;

    db.run('INSERT INTO blacklisted_tokens (token, expiry) VALUES (?, ?)', [token, new Date(expiry * 1000)], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.status(200).send({ message: 'Logged out successfully' });
    });
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
