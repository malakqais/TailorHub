const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use(session({
    secret: 'tailorhub-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname)));

function requireAuth(req, res, next) {
    if (!req.session.userEmail) {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    next();
}

function safeUser(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, city, password, userType } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'بيانات ناقصة' });
        }

        const existing = db.getUserByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const type = userType === 'tailor' ? 'tailor' : 'customer';
        const bio = type === 'tailor' ? 'خياط محترف جديد في تيلورهب' : 'مهتمة بتصميم الازياء والتفصيل';

        const user = db.createUser(fullName, email, hashed, phone, city, type, bio);

        if (type === 'tailor') {
            const tailorId = email.replace(/[^a-zA-Z0-9]/g, '');
            db.upsertTailor(tailorId, email, fullName, city, 'خياطة وتفصيل', 0, bio, null, [], 0, fullName.charAt(0));
        }

        req.session.userEmail = user.email;
        req.session.userType = user.userType;

        res.json({ user: safeUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = db.getUserByEmail(email);

        if (!user) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        req.session.userEmail = user.email;
        req.session.userType = user.userType;

        res.json({ user: safeUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.userEmail) {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    const user = db.getUserByEmail(req.session.userEmail);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
    res.json({ user: safeUser(user) });
});

// ─── Users ───────────────────────────────────────────────────────────────────

app.put('/api/users/me', requireAuth, (req, res) => {
    try {
        const { fullName, email, phone, city, bio } = req.body;
        const oldEmail = req.session.userEmail;

        const updated = db.updateUser(oldEmail, fullName, email || oldEmail, phone, city, bio);

        if (email && email !== oldEmail) {
            req.session.userEmail = email;
        }

        if (updated.userType === 'tailor') {
            const tailor = db.getTailorByEmail(oldEmail);
            if (tailor) {
                db.upsertTailor(
                    tailor.id, email || oldEmail,
                    fullName || tailor.name,
                    city || tailor.city,
                    tailor.service, tailor.price, bio || tailor.bio,
                    tailor.avatar,
                    JSON.parse(tailor.gallery || '[]'),
                    tailor.rate, fullName ? fullName.charAt(0) : tailor.letter
                );
            }
        }

        res.json({ user: safeUser(updated) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─── Tailors ─────────────────────────────────────────────────────────────────

app.get('/api/tailors', (req, res) => {
    const tailors = db.getAllTailors().map(t => ({
        ...t,
        gallery: JSON.parse(t.gallery || '[]')
    }));
    res.json({ tailors });
});

app.get('/api/tailors/:id', (req, res) => {
    const tailor = db.getTailorById(req.params.id);
    if (!tailor) return res.status(404).json({ error: 'الخياط غير موجود' });
    res.json({ tailor: { ...tailor, gallery: JSON.parse(tailor.gallery || '[]') } });
});

app.put('/api/tailors/:id', requireAuth, (req, res) => {
    try {
        const { name, city, service, price, bio, avatar, gallery, rate } = req.body;
        const tailorId = req.params.id;
        const userEmail = req.session.userEmail;

        const existing = db.getTailorById(tailorId);
        if (!existing) return res.status(404).json({ error: 'الخياط غير موجود' });

        if (existing.email && existing.email !== userEmail) {
            const user = db.getUserByEmail(userEmail);
            const derivedId = userEmail.replace(/[^a-zA-Z0-9]/g, '');
            if (tailorId !== derivedId) {
                return res.status(403).json({ error: 'غير مصرح' });
            }
        }

        const updated = db.upsertTailor(
            tailorId, existing.email || userEmail,
            name || existing.name,
            city || existing.city,
            service || existing.service,
            price !== undefined ? price : existing.price,
            bio || existing.bio,
            avatar !== undefined ? avatar : existing.avatar,
            gallery || JSON.parse(existing.gallery || '[]'),
            rate !== undefined ? rate : existing.rate,
            (name || existing.name).charAt(0)
        );

        res.json({ tailor: { ...updated, gallery: JSON.parse(updated.gallery || '[]') } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─── Orders ──────────────────────────────────────────────────────────────────

app.post('/api/orders', (req, res) => {
    try {
        const { type, userEmail, fullName, phone, city, tailorId, tailorName, service, price, date, time, notes, measurements } = req.body;

        if (!fullName || !tailorId || !service) {
            return res.status(400).json({ error: 'بيانات ناقصة' });
        }

        const id = 'TH-' + Date.now().toString().slice(-6);
        const email = userEmail || (req.session.userEmail || 'guest');

        const order = db.createOrder(id, type || 'booking', email, fullName, phone, city, tailorId, tailorName, service, price, date, time, notes);

        if (measurements && type === 'custom') {
            db.createMeasurements(id, measurements.chest, measurements.waist, measurements.hips, measurements.shoulder, measurements.arm, measurements.length);
        }

        res.json({ order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.get('/api/orders', (req, res) => {
    const { userEmail, tailorId } = req.query;
    let orders;

    if (tailorId) {
        orders = db.getOrdersByTailorId(tailorId);
    } else if (userEmail) {
        orders = db.getOrdersByUserEmail(userEmail);
    } else if (req.session.userEmail) {
        const user = db.getUserByEmail(req.session.userEmail);
        if (user && user.userType === 'tailor') {
            const tailor = db.getTailorByEmail(req.session.userEmail);
            orders = tailor ? db.getOrdersByTailorId(tailor.id) : [];
        } else {
            orders = db.getOrdersByUserEmail(req.session.userEmail);
        }
    } else {
        orders = db.getAllOrders();
    }

    res.json({ orders });
});

app.get('/api/orders/:id', (req, res) => {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    const measurements = db.getMeasurementsByOrderId(req.params.id);
    res.json({ order, measurements });
});

app.put('/api/orders/:id/complete', requireAuth, (req, res) => {
    const order = db.updateOrderStatus(req.params.id, 'مكتمل');
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    res.json({ order });
});

app.put('/api/orders/:id/status', requireAuth, (req, res) => {
    const { status } = req.body;
    const order = db.updateOrderStatus(req.params.id, status);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    res.json({ order });
});

// ─── Favorites ───────────────────────────────────────────────────────────────

app.get('/api/favorites', requireAuth, (req, res) => {
    const tailors = db.getFavoritesByUser(req.session.userEmail).map(t => ({
        ...t,
        gallery: JSON.parse(t.gallery || '[]')
    }));
    res.json({ tailors });
});

app.post('/api/favorites/:tailorId', requireAuth, (req, res) => {
    db.addFavorite(req.session.userEmail, req.params.tailorId);
    res.json({ ok: true });
});

app.delete('/api/favorites/:tailorId', requireAuth, (req, res) => {
    db.removeFavorite(req.session.userEmail, req.params.tailorId);
    res.json({ ok: true });
});

app.get('/api/favorites/check/:tailorId', requireAuth, (req, res) => {
    const is = db.isFavorite(req.session.userEmail, req.params.tailorId);
    res.json({ isFavorite: is });
});

// ─── Contacts ────────────────────────────────────────────────────────────────

app.post('/api/contacts', (req, res) => {
    const { fullName, email, message } = req.body;
    if (!fullName || !email || !message) {
        return res.status(400).json({ error: 'بيانات ناقصة' });
    }
    db.createContact(fullName, email, message);
    res.json({ ok: true });
});

// ─── Start ───────────────────────────────────────────────────────────────────

db.initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`TailorHub server running at http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/Home.html to start`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
