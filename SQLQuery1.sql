--CREATE DATABASE tailor_hub;


--CREATE TABLE users (
--    id       INT IDENTITY(1,1) PRIMARY KEY,
--    fullName NVARCHAR(255) NOT NULL,
--    email    NVARCHAR(50) NOT NULL UNIQUE,
--    password NVARCHAR(50) NOT NULL,
--    phone    CHAR(10),
--    city     NVARCHAR(10),
--    userType NVARCHAR(10) NOT NULL DEFAULT 'customer',
--    bio      NVARCHAR(MAX),
--);


--CREATE TABLE tailors (
--    id       INT IDENTITY(1,1) PRIMARY KEY,
--    slug     NVARCHAR(100) NOT NULL UNIQUE,   -- used in URLs e.g. 'yasmeen'
--    email    NVARCHAR(50) UNIQUE,
--    name     NVARCHAR(255) NOT NULL,
--    city     NVARCHAR(10),
--    service  NVARCHAR(255),
--    price    FLOAT DEFAULT 0,
--    bio      NVARCHAR(MAX),
--    avatar   NVARCHAR(MAX),
--    gallery  NVARCHAR(MAX) DEFAULT '[]',
--    rate     FLOAT DEFAULT 0,
--    isSeeded BIT DEFAULT 0
--);


--CREATE TABLE orders (
--    id          INT IDENTITY(1,1) PRIMARY KEY,
--    orderNumber NVARCHAR(50) NOT NULL UNIQUE,   -- e.g. 'TH-123456'
--    type        NVARCHAR(50) NOT NULL,
--    userId      INT NOT NULL,
--    tailorId    INT NOT NULL,
--    fullName    NVARCHAR(255) NOT NULL,
--    phone       NVARCHAR(10),
--    city        NVARCHAR(100),
--    service     NVARCHAR(255),
--    price       NVARCHAR(50),
--    date       DATE,
--    time       TIME,
--    notes       NVARCHAR(MAX),
--    status      NVARCHAR(20) DEFAULT N'قيد المراجعة',
--    FOREIGN KEY (userId)   REFERENCES users(id),
--    FOREIGN KEY (tailorId) REFERENCES tailors(id)
--);


--CREATE TABLE measurements (
--    id       INT IDENTITY(1,1) PRIMARY KEY,
--    orderId  INT NOT NULL,
--    chest    NVARCHAR(50),
--    waist    NVARCHAR(50),
--    hips     NVARCHAR(50),
--    shoulder NVARCHAR(50),
--    arm      NVARCHAR(50),
--    length   NVARCHAR(50),
--    FOREIGN KEY (orderId) REFERENCES orders(id)
--);


--CREATE TABLE favorites (
--    id       INT IDENTITY(1,1) PRIMARY KEY,
--    userId   INT NOT NULL,
--    tailorId INT NOT NULL,
--    CONSTRAINT UC_favorites UNIQUE (userId, tailorId),
--    FOREIGN KEY (userId)   REFERENCES users(id),
--    FOREIGN KEY (tailorId) REFERENCES tailors(id)
--);


--CREATE TABLE contacts (
--    id        INT IDENTITY(1,1) PRIMARY KEY,
--    fullName  NVARCHAR(255) NOT NULL,
--    email     NVARCHAR(50) NOT NULL,
--    message   NVARCHAR(MAX) NOT NULL,
--);


-- Seed default tailors
INSERT INTO tailors (slug, email, name, city, service, price,  bio, isSeeded) VALUES
('yasmeen', 'yasmeen@tailorhub.jo', N'اتيلية الياسمين', N'مادبا', N'فساتين السهرة والأعراس', 45, N'أتيلية متخصصة في فساتين السهرة والأعراس بأعلى مستويات الجودة', 1),
('jordan',  'jordan@tailorhub.jo',  N'مخيطة الأردن',    N'إربد',  N'الثوب الأردني المطرز',   70,  N'متخصصون في التراث الأردني والثوب المطرز التقليدي', 1),
('east',    'east@tailorhub.jo',    N'أناقة الشرق',     N'السلط', N'قفاطين وأثواب تراثية',    55,  N'إبداع وأناقة في كل تفصيلة، متخصصون في الأثواب التراثية', 1),
('yousef',  'yousef@tailorhub.jo',  N'دار يوسف للتفصيل',N'عمان',  N'بدلات رجالية ومناسبات',  80,  N'دار يوسف للتفصيل - خبرة أكثر من 20 سنة في البدلات الرجالية', 1);


INSERT INTO users (fullName, email, password, phone, city, userType, bio) VALUES
(N'أحمد علي',   'ahmed@domain.com', '12345', '0791234567', N'عمان', 'customer', N'عميل يحب الأزياء الكلاسيكية'),
(N'ليلى محمود', 'leila@domain.com', '12345', '0789876543', N'إربد', 'customer', N'تهوى الفساتين التراثية'),
(N'سامي يوسف',  'sami@domain.com',  '12345', '0795558888', N'مادبا', 'customer', N'يحب الملابس الرسمية'),
(N'نور فهد',    'noor@domain.com',  '12345', '0771112222', N'السلط', 'customer', N'مهتم بالملابس الشرقية');


INSERT INTO orders (orderNumber, type, userId, tailorId, fullName, phone, city, service, price, date, time, notes) VALUES
('TH-1001', 'Custom Dress', 1, 1, N'أحمد علي', '0791234567', N'عمان', N'فساتين سهرة', 50, '2026-05-16', '10:30', N'توصيل سريع'),
('TH-1002', 'Traditional Dress', 2, 3, N'ليلى محمود', '0789876543', N'إربد', N'قفطان تراثي', 60, '2026-05-17', '12:00', N'تعديل الطول'),
('TH-1003', 'Men Suit', 3, 4, N'سامي يوسف', '0795558888', N'مادبا', N'بدلة رسمية', 80, '2026-05-18', '14:00', N'قماش فاخر');


INSERT INTO measurements (orderId, chest, waist, hips, shoulder, arm, length) VALUES
(1, '90cm', '70cm', '95cm', '40cm', '60cm', '120cm'),
(2, '85cm', '65cm', '90cm', '38cm', '58cm', '110cm'),
(3, '100cm', '85cm', '95cm', '45cm', '62cm', '125cm');


INSERT INTO favorites (userId, tailorId) VALUES
(1, 1),
(2, 3),
(3, 4),
(4, 2);


INSERT INTO contacts (fullName, email, message) VALUES
(N'أحمد علي', 'ahmed@domain.com', N'أود الاستفسار عن خدمة التوصيل'),
(N'ليلى محمود', 'leila@domain.com', N'هل يمكن تعديل الطول على القفطان؟'),
(N'سامي يوسف', 'sami@domain.com', N'ما هي أوقات العمل في المخيطة؟');




select * 
from tailors;


select * 
from users;



select * 
from orders;



select * 
from measurements;



select * 
from favorites;


