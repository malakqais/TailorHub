const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tailorhub.db');

let db = null;

async function initDB() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    createTables();
    seedTailors();
    return db;
}

function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            city TEXT,
            userType TEXT NOT NULL DEFAULT 'customer',
            bio TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tailors (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT NOT NULL,
            city TEXT,
            service TEXT,
            price REAL DEFAULT 0,
            bio TEXT,
            avatar TEXT,
            gallery TEXT DEFAULT '[]',
            rate REAL DEFAULT 0,
            letter TEXT,
            isSeeded INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            userEmail TEXT,
            fullName TEXT NOT NULL,
            phone TEXT,
            city TEXT,
            tailorId TEXT,
            tailorName TEXT,
            service TEXT,
            price TEXT,
            date TEXT,
            time TEXT,
            notes TEXT,
            status TEXT DEFAULT 'قيد المراجعة',
            createdAt TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderId TEXT NOT NULL,
            chest TEXT,
            waist TEXT,
            hips TEXT,
            shoulder TEXT,
            arm TEXT,
            length TEXT,
            FOREIGN KEY (orderId) REFERENCES orders(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userEmail TEXT NOT NULL,
            tailorId TEXT NOT NULL,
            UNIQUE(userEmail, tailorId)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now'))
        )
    `);

    save();
}

function seedTailors() {
    const existing = queryOne('SELECT COUNT(*) as cnt FROM tailors WHERE isSeeded = 1');
    if (existing && existing.cnt > 0) return;

    const seeds = [
        { id: 'yasmeen', email: 'yasmeen@tailorhub.jo', name: 'اتيلية الياسمين', city: 'مادبا', service: 'فساتين السهرة والأعراس', price: 45, letter: 'ي', bio: 'أتيلية متخصصة في فساتين السهرة والأعراس بأعلى مستويات الجودة' },
        { id: 'jordan', email: 'jordan@tailorhub.jo', name: 'مخيطة الأردن', city: 'إربد', service: 'الثوب الأردني المطرز', price: 70, letter: 'أ', bio: 'متخصصون في التراث الأردني والثوب المطرز التقليدي' },
        { id: 'east', email: 'east@tailorhub.jo', name: 'أناقة الشرق', city: 'السلط', service: 'قفاطين وأثواب تراثية', price: 55, letter: 'ش', bio: 'إبداع وأناقة في كل تفصيلة، متخصصون في الأثواب التراثية' },
        { id: 'yousef', email: 'yousef@tailorhub.jo', name: 'دار يوسف للتفصيل', city: 'عمان', service: 'بدلات رجالية ومناسبات', price: 80, letter: 'د', bio: 'دار يوسف للتفصيل - خبرة أكثر من 20 سنة في البدلات الرجالية' }
    ];

    seeds.forEach(t => {
        db.run(
            `INSERT OR IGNORE INTO tailors (id, email, name, city, service, price, letter, bio, isSeeded) VALUES (?,?,?,?,?,?,?,?,1)`,
            [t.id, t.email, t.name, t.city, t.service, t.price, t.letter, t.bio]
        );
    });

    save();
}

function query(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params.map(n));
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function queryOne(sql, params = []) {
    const rows = query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function n(v) {
    return v === undefined ? null : v;
}

function run(sql, params = []) {
    db.run(sql, params.map(n));
    save();
}

// Users
function createUser(fullName, email, hashedPassword, phone, city, userType, bio) {
    run(
        `INSERT INTO users (fullName, email, password, phone, city, userType, bio) VALUES (?,?,?,?,?,?,?)`,
        [fullName, email, hashedPassword, phone, city, userType, bio || '']
    );
    return queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

function getUserByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

function updateUser(email, fullName, newEmail, phone, city, bio) {
    run(
        `UPDATE users SET fullName=?, email=?, phone=?, city=?, bio=? WHERE email=?`,
        [fullName, newEmail, phone, city, bio, email]
    );
    return queryOne('SELECT * FROM users WHERE email = ?', [newEmail]);
}

// Tailors
function getAllTailors() {
    return query('SELECT * FROM tailors ORDER BY name');
}

function getTailorById(id) {
    return queryOne('SELECT * FROM tailors WHERE id = ?', [id]);
}

function getTailorByEmail(email) {
    return queryOne('SELECT * FROM tailors WHERE email = ?', [email]);
}

function upsertTailor(id, email, name, city, service, price, bio, avatar, gallery, rate, letter) {
    const existing = getTailorById(id);
    if (existing) {
        run(
            `UPDATE tailors SET name=?, city=?, service=?, price=?, bio=?, avatar=?, gallery=?, rate=?, letter=? WHERE id=?`,
            [name, city, service, price, bio, avatar, JSON.stringify(gallery || []), rate, letter, id]
        );
    } else {
        run(
            `INSERT INTO tailors (id, email, name, city, service, price, bio, avatar, gallery, rate, letter) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [id, email, name, city, service, price, bio, avatar, JSON.stringify(gallery || []), rate, letter]
        );
    }
    return getTailorById(id);
}

// Orders
function createOrder(id, type, userEmail, fullName, phone, city, tailorId, tailorName, service, price, date, time, notes) {
    run(
        `INSERT INTO orders (id, type, userEmail, fullName, phone, city, tailorId, tailorName, service, price, date, time, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, type, userEmail, fullName, phone, city, tailorId, tailorName, service, price, date, time, notes]
    );
    return queryOne('SELECT * FROM orders WHERE id = ?', [id]);
}

function createMeasurements(orderId, chest, waist, hips, shoulder, arm, length) {
    run(
        `INSERT INTO measurements (orderId, chest, waist, hips, shoulder, arm, length) VALUES (?,?,?,?,?,?,?)`,
        [orderId, chest, waist, hips, shoulder, arm, length]
    );
}

function getMeasurementsByOrderId(orderId) {
    return queryOne('SELECT * FROM measurements WHERE orderId = ?', [orderId]);
}

function getOrdersByUserEmail(email) {
    return query('SELECT * FROM orders WHERE userEmail = ? ORDER BY createdAt DESC', [email]);
}

function getOrdersByTailorId(tailorId) {
    return query('SELECT * FROM orders WHERE tailorId = ? ORDER BY createdAt DESC', [tailorId]);
}

function getAllOrders() {
    return query('SELECT * FROM orders ORDER BY createdAt DESC');
}

function getOrderById(id) {
    return queryOne('SELECT * FROM orders WHERE id = ?', [id]);
}

function updateOrderStatus(id, status) {
    run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    return getOrderById(id);
}

// Favorites
function getFavoritesByUser(userEmail) {
    const favs = query('SELECT tailorId FROM favorites WHERE userEmail = ?', [userEmail]);
    const ids = favs.map(f => f.tailorId);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return query(`SELECT * FROM tailors WHERE id IN (${placeholders})`, ids);
}

function addFavorite(userEmail, tailorId) {
    try {
        run('INSERT OR IGNORE INTO favorites (userEmail, tailorId) VALUES (?,?)', [userEmail, tailorId]);
        return true;
    } catch (e) {
        return false;
    }
}

function removeFavorite(userEmail, tailorId) {
    run('DELETE FROM favorites WHERE userEmail = ? AND tailorId = ?', [userEmail, tailorId]);
    return true;
}

function isFavorite(userEmail, tailorId) {
    const r = queryOne('SELECT id FROM favorites WHERE userEmail = ? AND tailorId = ?', [userEmail, tailorId]);
    return !!r;
}

// Contacts
function createContact(fullName, email, message) {
    run('INSERT INTO contacts (fullName, email, message) VALUES (?,?,?)', [fullName, email, message]);
    return true;
}

module.exports = {
    initDB,
    createUser,
    getUserByEmail,
    updateUser,
    getAllTailors,
    getTailorById,
    getTailorByEmail,
    upsertTailor,
    createOrder,
    createMeasurements,
    getMeasurementsByOrderId,
    getOrdersByUserEmail,
    getOrdersByTailorId,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getFavoritesByUser,
    addFavorite,
    removeFavorite,
    isFavorite,
    createContact
};
