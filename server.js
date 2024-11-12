const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2');  
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 8080;
const secretKey = process.env.JWT_SECRET || "qwerty12345";  

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));  
app.use(express.json());

// MySQL connection setup
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        return;
    }
    console.log('Connected to MySQL database.');
});

// Create tables if they don't exist
db.query(`
    CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        description TEXT,
        image VARCHAR(255),
        status VARCHAR(50),
        email VARCHAR(255),
        date DATETIME,
        location VARCHAR(255)
    )
`);

db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255)
    )
`);

db.query(`
    CREATE TABLE IF NOT EXISTS blacklisted_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token TEXT NOT NULL,
        expiry DATETIME NOT NULL
    )
`);

db.query('SELECT * FROM items', [], (err, results) => {
    if (err) {
        console.error('Fetch Items Error:', err.message);
    } else {
        console.log(result)
    }
});

// Set up Multer for file uploads
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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('frontend'));  // Serve static frontend files

// Register route
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], function (err, result) {
            if (err) {
                console.error('Database Error:', err.message);
                return res.status(400).send({ error: err.message });
            }
            const token = jwt.sign({ userId: result.insertId }, secretKey, { expiresIn: '24h' });
            res.status(201).send({ userId: result.insertId, token });
        });
    } catch (error) {
        console.error('Register Error:', error.message);
        res.status(500).send({ error: error.message });
    }
});

// Login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Login Error:', err.message);
            return res.status(500).send({ error: err.message });
        }
        const user = results[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send({ error: 'Email or password is incorrect' });
        }
        const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '24h' });
        res.send({ userId: user.id, token });
    });
});

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    db.query('SELECT * FROM blacklisted_tokens WHERE token = ?', [token], (err, results) => {
        if (err) {
            console.error('Token Error:', err.message);
            return res.sendStatus(500);
        }
        if (results.length > 0) {
            return res.sendStatus(401);
        }

        jwt.verify(token, secretKey, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    });
};

app.post('/submit-item', authenticateToken, upload.single('itemImage'), (req, res) => {
    const { itemName, itemDescription, itemStatus, userEmail, itemLocation } = req.body;
    const itemImage = req.file;
    const itemDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const newItem = {
        name: itemName,
        description: itemDescription,
        status: itemStatus,
        date: itemDate,
        email: userEmail,
        imageUrl: itemImage ? `/uploads/${itemImage.filename}` : null,
        location: itemLocation
    };

    const query = `INSERT INTO items (name, description, status, email, image, date, location) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const values = [newItem.name, newItem.description, newItem.status, newItem.email, newItem.imageUrl, newItem.date, newItem.location];

    db.query(query, values, function (err, result) {
        if (err) {
            console.error('Database insertion error:', err.message);
            res.status(500).send({ error: 'Failed to submit item' });
        } else {
            newItem.id = result.insertId;
            res.json(newItem);
        }
    });
});

// Get items route
app.get('/items', (req, res) => {
    db.query('SELECT * FROM items', [], (err, results) => {
        if (err) {
            console.error('Fetch Items Error:', err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json(results);
        }
    });
});

// Delete item route
app.delete('/delete-item/:id', authenticateToken, (req, res) => {
    const itemId = parseInt(req.params.id);
    db.query('DELETE FROM items WHERE id = ?', [itemId], (err, result) => {
        if (err) {
            console.error('Delete Item Error:', err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json({ message: 'Item deleted successfully' });
        }
    });
});

// Logout route
app.post('/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const expiry = jwt.decode(token).exp;

    db.query('INSERT INTO blacklisted_tokens (token, expiry) VALUES (?, ?)', [token, new Date(expiry * 1000)], function (err, result) {
        if (err) {
            console.error('Logout Error:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.status(200).send({ message: 'Logged out successfully' });
    });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});


