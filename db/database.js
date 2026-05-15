const sql = require('mssql/msnodesqlv8');

const config = {
    connectionString: `Driver={SQL Server};Server=Malak;Database=tailor_hub;Trusted_Connection=Yes;`
};

let pool = null;

async function initDB() {
    pool = await sql.connect(config);
    console.log('Connected to SQL Server: Malak / tailor_hub');
    return pool;
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function createUser(fullName, email, hashedPassword, phone, city, userType, bio) {
    await pool.request()
        .input('fullName', sql.NVarChar, fullName)
        .input('email', sql.NVarChar, email)
        .input('password', sql.NVarChar, hashedPassword)
        .input('phone', sql.NVarChar, phone || null)
        .input('city', sql.NVarChar, city || null)
        .input('userType', sql.NVarChar, userType)
        .input('bio', sql.NVarChar, bio || null)
        .query(`INSERT INTO users (fullName, email, password, phone, city, userType, bio)
                VALUES (@fullName, @email, @password, @phone, @city, @userType, @bio)`);
    return getUserByEmail(email);
}

async function getUserByEmail(email) {
    const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`SELECT * FROM users WHERE email = @email`);
    return result.recordset[0] || null;
}

async function getUserById(id) {
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`SELECT * FROM users WHERE id = @id`);
    return result.recordset[0] || null;
}

async function updateUser(oldEmail, fullName, newEmail, phone, city, bio) {
    await pool.request()
        .input('fullName', sql.NVarChar, fullName)
        .input('newEmail', sql.NVarChar, newEmail)
        .input('phone', sql.NVarChar, phone || null)
        .input('city', sql.NVarChar, city || null)
        .input('bio', sql.NVarChar, bio || null)
        .input('oldEmail', sql.NVarChar, oldEmail)
        .query(`UPDATE users SET fullName=@fullName, email=@newEmail, phone=@phone, city=@city, bio=@bio
                WHERE email=@oldEmail`);
    return getUserByEmail(newEmail);
}

// ─── Tailors ─────────────────────────────────────────────────────────────────

function parseTailor(t) {
    if (!t) return null;
    return { ...t, gallery: JSON.parse(t.gallery || '[]') };
}

async function getAllTailors() {
    const result = await pool.request()
        .query(`SELECT * FROM tailors ORDER BY name`);
    return result.recordset.map(parseTailor);
}

async function getTailorBySlug(slug) {
    const result = await pool.request()
        .input('slug', sql.NVarChar, slug)
        .query(`SELECT * FROM tailors WHERE slug = @slug`);
    return result.recordset[0] ? parseTailor(result.recordset[0]) : null;
}

async function getTailorById(id) {
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`SELECT * FROM tailors WHERE id = @id`);
    return result.recordset[0] ? parseTailor(result.recordset[0]) : null;
}

async function getTailorByEmail(email) {
    const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`SELECT * FROM tailors WHERE email = @email`);
    return result.recordset[0] ? parseTailor(result.recordset[0]) : null;
}

async function upsertTailor(slug, email, name, city, service, price, bio, avatar, gallery, rate, letter) {
    const existing = await getTailorBySlug(slug);
    const galleryJson = JSON.stringify(gallery || []);

    if (existing) {
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('city', sql.NVarChar, city || null)
            .input('service', sql.NVarChar, service || null)
            .input('price', sql.Float, Number(price) || 0)
            .input('bio', sql.NVarChar, bio || null)
            .input('avatar', sql.NVarChar, avatar || null)
            .input('gallery', sql.NVarChar, galleryJson)
            .input('rate', sql.Float, Number(rate) || 0)
            .input('letter', sql.NVarChar, letter || null)
            .input('slug', sql.NVarChar, slug)
            .query(`UPDATE tailors SET name=@name, city=@city, service=@service, price=@price,
                    bio=@bio, avatar=@avatar, gallery=@gallery, rate=@rate, letter=@letter
                    WHERE slug=@slug`);
    } else {
        await pool.request()
            .input('slug', sql.NVarChar, slug)
            .input('email', sql.NVarChar, email || null)
            .input('name', sql.NVarChar, name)
            .input('city', sql.NVarChar, city || null)
            .input('service', sql.NVarChar, service || null)
            .input('price', sql.Float, Number(price) || 0)
            .input('bio', sql.NVarChar, bio || null)
            .input('avatar', sql.NVarChar, avatar || null)
            .input('gallery', sql.NVarChar, galleryJson)
            .input('rate', sql.Float, Number(rate) || 0)
            .input('letter', sql.NVarChar, letter || null)
            .query(`INSERT INTO tailors (slug, email, name, city, service, price, bio, avatar, gallery, rate, letter)
                    VALUES (@slug, @email, @name, @city, @service, @price, @bio, @avatar, @gallery, @rate, @letter)`);
    }
    return getTailorBySlug(slug);
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function createOrder(orderNumber, type, userId, tailorId, fullName, phone, city, service, price, date, time, notes) {
    await pool.request()
        .input('orderNumber', sql.NVarChar, orderNumber)
        .input('type', sql.NVarChar, type)
        .input('userId', sql.Int, userId || null)
        .input('tailorId', sql.Int, tailorId || null)
        .input('fullName', sql.NVarChar, fullName)
        .input('phone', sql.NVarChar, phone || null)
        .input('city', sql.NVarChar, city || null)
        .input('service', sql.NVarChar, service || null)
        .input('price', sql.NVarChar, price != null ? String(price) : null)
        .input('date', sql.NVarChar, date || null)
        .input('time', sql.NVarChar, time || null)
        .input('notes', sql.NVarChar, notes || null)
        .query(`INSERT INTO orders (orderNumber, type, userId, tailorId, fullName, phone, city, service, price, date, time, notes)
                VALUES (@orderNumber, @type, @userId, @tailorId, @fullName, @phone, @city, @service, @price, @date, @time, @notes)`);
    return getOrderByNumber(orderNumber);
}

async function createMeasurements(orderId, chest, waist, hips, shoulder, arm, length) {
    await pool.request()
        .input('orderId', sql.Int, orderId)
        .input('chest', sql.NVarChar, chest || null)
        .input('waist', sql.NVarChar, waist || null)
        .input('hips', sql.NVarChar, hips || null)
        .input('shoulder', sql.NVarChar, shoulder || null)
        .input('arm', sql.NVarChar, arm || null)
        .input('length', sql.NVarChar, length || null)
        .query(`INSERT INTO measurements (orderId, chest, waist, hips, shoulder, arm, length)
                VALUES (@orderId, @chest, @waist, @hips, @shoulder, @arm, @length)`);
}

async function getMeasurementsByOrderId(orderId) {
    const result = await pool.request()
        .input('orderId', sql.Int, orderId)
        .query(`SELECT * FROM measurements WHERE orderId = @orderId`);
    return result.recordset[0] || null;
}

async function getOrderByNumber(orderNumber) {
    const result = await pool.request()
        .input('orderNumber', sql.NVarChar, orderNumber)
        .query(`SELECT o.*, t.name AS tailorName, t.slug AS tailorSlug, u.email AS userEmail
                FROM orders o
                LEFT JOIN tailors t ON o.tailorId = t.id
                LEFT JOIN users u   ON o.userId   = u.id
                WHERE o.orderNumber = @orderNumber`);
    return result.recordset[0] || null;
}

async function getOrderById(id) {
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`SELECT o.*, t.name AS tailorName, t.slug AS tailorSlug, u.email AS userEmail
                FROM orders o
                LEFT JOIN tailors t ON o.tailorId = t.id
                LEFT JOIN users u   ON o.userId   = u.id
                WHERE o.id = @id`);
    return result.recordset[0] || null;
}

async function getOrdersByUserId(userId) {
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`SELECT o.*, t.name AS tailorName, t.slug AS tailorSlug
                FROM orders o
                LEFT JOIN tailors t ON o.tailorId = t.id
                WHERE o.userId = @userId
                ORDER BY o.createdAt DESC`);
    return result.recordset;
}

async function getOrdersByTailorId(tailorId) {
    const result = await pool.request()
        .input('tailorId', sql.Int, tailorId)
        .query(`SELECT o.*, u.email AS userEmail
                FROM orders o
                LEFT JOIN users u ON o.userId = u.id
                WHERE o.tailorId = @tailorId
                ORDER BY o.createdAt DESC`);
    return result.recordset;
}

async function getAllOrders() {
    const result = await pool.request()
        .query(`SELECT o.*, t.name AS tailorName, u.email AS userEmail
                FROM orders o
                LEFT JOIN tailors t ON o.tailorId = t.id
                LEFT JOIN users u   ON o.userId   = u.id
                ORDER BY o.createdAt DESC`);
    return result.recordset;
}

async function updateOrderStatus(orderNumber, status) {
    await pool.request()
        .input('status', sql.NVarChar, status)
        .input('orderNumber', sql.NVarChar, orderNumber)
        .query(`UPDATE orders SET status = @status WHERE orderNumber = @orderNumber`);
    return getOrderByNumber(orderNumber);
}

// ─── Favorites ───────────────────────────────────────────────────────────────

async function getFavoritesByUser(userId) {
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`SELECT t.* FROM tailors t
                INNER JOIN favorites f ON t.id = f.tailorId
                WHERE f.userId = @userId`);
    return result.recordset.map(parseTailor);
}

async function addFavorite(userId, tailorId) {
    await pool.request()
        .input('userId', sql.Int, userId)
        .input('tailorId', sql.Int, tailorId)
        .query(`IF NOT EXISTS (SELECT 1 FROM favorites WHERE userId=@userId AND tailorId=@tailorId)
                INSERT INTO favorites (userId, tailorId) VALUES (@userId, @tailorId)`);
    return true;
}

async function removeFavorite(userId, tailorId) {
    await pool.request()
        .input('userId', sql.Int, userId)
        .input('tailorId', sql.Int, tailorId)
        .query(`DELETE FROM favorites WHERE userId=@userId AND tailorId=@tailorId`);
    return true;
}

async function isFavorite(userId, tailorId) {
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('tailorId', sql.Int, tailorId)
        .query(`SELECT 1 AS found FROM favorites WHERE userId=@userId AND tailorId=@tailorId`);
    return result.recordset.length > 0;
}

// ─── Contacts ────────────────────────────────────────────────────────────────

async function createContact(fullName, email, message) {
    await pool.request()
        .input('fullName', sql.NVarChar, fullName)
        .input('email', sql.NVarChar, email)
        .input('message', sql.NVarChar, message)
        .query(`INSERT INTO contacts (fullName, email, message) VALUES (@fullName, @email, @message)`);
    return true;
}

module.exports = {
    initDB,
    createUser, getUserByEmail, getUserById, updateUser,
    getAllTailors, getTailorBySlug, getTailorById, getTailorByEmail, upsertTailor,
    createOrder, createMeasurements, getMeasurementsByOrderId,
    getOrderByNumber, getOrderById, getOrdersByUserId, getOrdersByTailorId, getAllOrders, updateOrderStatus,
    getFavoritesByUser, addFavorite, removeFavorite, isFavorite,
    createContact
};
