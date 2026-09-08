const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "../../kirana.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    unit TEXT NOT NULL,
    cost_price REAL NOT NULL,
    sell_price REAL NOT NULL,
    mrp REAL NOT NULL,
    gst_rate REAL NOT NULL,
    hsn_code TEXT,
    stock REAL DEFAULT 0,
    reorder_level REAL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'DRAFT',
    payment_mode TEXT,
    subtotal REAL DEFAULT 0,
    cgst REAL DEFAULT 0,
    sgst REAL DEFAULT 0,
    total REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    gst_rate REAL NOT NULL,
    FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    chat_id TEXT PRIMARY KEY,
    current_bill_id INTEGER
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- RECEIVED, SOLD, ADJUSTMENT
    quantity REAL NOT NULL,
    cost REAL,
    mrp REAL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

// Seed initial products if table is empty
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get().count;

if (productCount === 0) {
    const seedProducts = [
        ["Aashirvaad Atta 5kg", "piece", 200, 240, 250, 5, "1101", 10, 3],
        ["Tata Salt 1kg", "piece", 20, 25, 28, 5, "2501", 20, 5],
        ["Amul Butter 100g", "piece", 52, 62, 62, 12, "0405", 10, 3],
        ["Fortune Sunflower Oil 1L", "litre", 110, 130, 135, 5, "1512", 15, 4],
        ["Maggi 70g", "packet", 12, 14, 14, 12, "1902", 50, 10],
        ["Parle-G", "packet", 5, 6, 6, 5, "1905", 25, 5],
        ["Surf Excel", "packet", 55, 65, 70, 18, "3402", 8, 3],
        ["Sugar", "kg", 40, 45, 45, 5, "1701", 20, 5],
        ["Rice", "kg", 50, 60, 60, 5, "1006", 20, 5],
        ["Toor Dal", "kg", 100, 120, 120, 5, "0713", 10, 3]
    ];

    const insert = db.prepare(`
        INSERT INTO products
        (name, unit, cost_price, sell_price, mrp, gst_rate, hsn_code, stock, reorder_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of seedProducts) {
        insert.run(...p);
    }
}

module.exports = db;