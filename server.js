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
    if (!req.session.userEmail) return res.status(401).json({ error: 'غير مصرح' });
    next();
}

function safeUser(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
}

async function getSessionUser(req) {
    if (!req.session.userEmail) return null;
    return db.getUserByEmail(req.session.userEmail);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, phone, city, password, userType } = req.body;
        if (!fullName || !email || !password)
            return res.status(400).json({ error: 'بيانات ناقصة' });

        const existing = await db.getUserByEmail(email);
        if (existing) return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });

        const hashed = await bcrypt.hash(password, 10);
        const type = userType === 'tailor' ? 'tailor' : 'customer';
        const bio = type === 'tailor' ? 'خياط محترف جديد في تيلورهب' : 'مهتمة بتصميم الازياء والتفصيل';

        const user = await db.createUser(fullName, email, hashed, phone, city, type, bio);

        if (type === 'tailor') {
            const slug = email.replace(/[^a-zA-Z0-9]/g, '');
            await db.upsertTailor(slug, email, fullName, city, 'خياطة وتفصيل', 0, bio, null, [], 0, fullName.charAt(0));
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
        const user = await db.getUserByEmail(email);
        if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

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

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userEmail) return res.status(401).json({ error: 'غير مصرح' });
    const user = await db.getUserByEmail(req.session.userEmail);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
    res.json({ user: safeUser(user) });
});

// ─── Users ───────────────────────────────────────────────────────────────────

app.put('/api/users/me', requireAuth, async (req, res) => {
    try {
        const { fullName, email, phone, city, bio } = req.body;
        const oldEmail = req.session.userEmail;
        const updated = await db.updateUser(oldEmail, fullName, email || oldEmail, phone, city, bio);

        if (email && email !== oldEmail) req.session.userEmail = email;

        if (updated.userType === 'tailor') {
            const tailor = await db.getTailorByEmail(oldEmail);
            if (tailor) {
                await db.upsertTailor(
                    tailor.slug, email || oldEmail,
                    fullName || tailor.name, city || tailor.city,
                    tailor.service, tailor.price, bio || tailor.bio,
                    tailor.avatar, tailor.gallery, tailor.rate,
                    fullName ? fullName.charAt(0) : tailor.letter
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

app.get('/api/tailors', async (req, res) => {
    try {
        const tailors = await db.getAllTailors();
        res.json({ tailors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.get('/api/tailors/:id', async (req, res) => {
    try {
        const param = req.params.id;
        const tailor = isNaN(param)
            ? await db.getTailorBySlug(param)
            : await db.getTailorById(Number(param));
        if (!tailor) return res.status(404).json({ error: 'الخياط غير موجود' });
        res.json({ tailor });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.put('/api/tailors/:id', requireAuth, async (req, res) => {
    try {
        const { name, city, service, price, bio, avatar, gallery, rate } = req.body;
        const param = req.params.id;
        const existing = isNaN(param)
            ? await db.getTailorBySlug(param)
            : await db.getTailorById(Number(param));
        if (!existing) return res.status(404).json({ error: 'الخياط غير موجود' });

        const updated = await db.upsertTailor(
            existing.slug, existing.email || req.session.userEmail,
            name || existing.name, city || existing.city,
            service || existing.service,
            price !== undefined ? price : existing.price,
            bio || existing.bio,
            avatar !== undefined ? avatar : existing.avatar,
            gallery || existing.gallery,
            rate !== undefined ? rate : existing.rate,
            (name || existing.name).charAt(0)
        );
        res.json({ tailor: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─── Orders ──────────────────────────────────────────────────────────────────

app.post('/api/orders', async (req, res) => {
    try {
        const { type, userEmail, fullName, phone, city, tailorId, service, price, date, time, notes, measurements } = req.body;
        if (!fullName || !tailorId || !service)
            return res.status(400).json({ error: 'بيانات ناقصة' });

        const orderNumber = 'TH-' + Date.now().toString().slice(-6);

        const emailToUse = userEmail || req.session.userEmail || null;
        let userId = null;
        if (emailToUse && emailToUse !== 'guest') {
            const u = await db.getUserByEmail(emailToUse);
            if (u) userId = u.id;
        }

        const tailorIdInt = isNaN(tailorId) ? null : Number(tailorId);

        const order = await db.createOrder(
            orderNumber, type || 'booking',
            userId, tailorIdInt,
            fullName, phone, city, service, price, date, time, notes
        );

        if (measurements && type === 'custom' && order) {
            await db.createMeasurements(
                order.id,
                measurements.chest, measurements.waist, measurements.hips,
                measurements.shoulder, measurements.arm, measurements.length
            );
        }
        res.json({ order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { userEmail, tailorId } = req.query;
        let orders;

        if (tailorId) {
            orders = await db.getOrdersByTailorId(Number(tailorId));
        } else if (userEmail) {
            const u = await db.getUserByEmail(userEmail);
            orders = u ? await db.getOrdersByUserId(u.id) : [];
        } else if (req.session.userEmail) {
            const user = await db.getUserByEmail(req.session.userEmail);
            if (user && user.userType === 'tailor') {
                const tailor = await db.getTailorByEmail(req.session.userEmail);
                orders = tailor ? await db.getOrdersByTailorId(tailor.id) : [];
            } else if (user) {
                orders = await db.getOrdersByUserId(user.id);
            } else {
                orders = [];
            }
        } else {
            orders = await db.getAllOrders();
        }
        res.json({ orders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const param = req.params.id;
        const order = param.startsWith('TH-')
            ? await db.getOrderByNumber(param)
            : await db.getOrderById(Number(param));
        if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
        const measurements = await db.getMeasurementsByOrderId(order.id);
        res.json({ order, measurements });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.put('/api/orders/:id/complete', requireAuth, async (req, res) => {
    try {
        const order = await db.updateOrderStatus(req.params.id, 'مكتمل');
        if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
        res.json({ order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await db.updateOrderStatus(req.params.id, status);
        if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
        res.json({ order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─── Favorites ───────────────────────────────────────────────────────────────

app.get('/api/favorites', requireAuth, async (req, res) => {
    try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'غير مصرح' });
        const tailors = await db.getFavoritesByUser(user.id);
        res.json({ tailors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.post('/api/favorites/:tailorId', requireAuth, async (req, res) => {
    try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'غير مصرح' });
        await db.addFavorite(user.id, Number(req.params.tailorId));
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.delete('/api/favorites/:tailorId', requireAuth, async (req, res) => {
    try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'غير مصرح' });
        await db.removeFavorite(user.id, Number(req.params.tailorId));
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

app.get('/api/favorites/check/:tailorId', requireAuth, async (req, res) => {
    try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'غير مصرح' });
        const is = await db.isFavorite(user.id, Number(req.params.tailorId));
        res.json({ isFavorite: is });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─── Contacts ────────────────────────────────────────────────────────────────

app.post('/api/contacts', async (req, res) => {
    try {
        const { fullName, email, message } = req.body;
        if (!fullName || !email || !message)
            return res.status(400).json({ error: 'بيانات ناقصة' });
        await db.createContact(fullName, email, message);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─── Start ───────────────────────────────────────────────────────────────────

db.initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`TailorHub server running at http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/Home.html to start`);
    });
}).catch(err => {
    console.error('Failed to connect to SQL Server:', err.message);
    process.exit(1);
});
