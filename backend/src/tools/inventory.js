const db = require("../services/database");

function searchProduct(query) {
    if (!query) return [];
    const clean = query.trim().toLowerCase();
    return db.prepare(`
        SELECT * FROM products
        WHERE LOWER(name) LIKE ?
        ORDER BY name ASC
    `).all(`%${clean}%`);
}

function findProduct(name) {
    if (!name) return null;
    const clean = name.trim().toLowerCase();

    // 1. Try exact match (case-insensitive)
    let product = db.prepare(`
        SELECT * FROM products
        WHERE LOWER(name) = ?
        LIMIT 1
    `).get(clean);

    if (product) return product;

    // 2. Try prefix match
    product = db.prepare(`
        SELECT * FROM products
        WHERE LOWER(name) LIKE ?
        LIMIT 1
    `).get(`${clean}%`);

    if (product) return product;

    // 3. Try substring match
    product = db.prepare(`
        SELECT * FROM products
        WHERE LOWER(name) LIKE ?
        LIMIT 1
    `).get(`%${clean}%`);

    return product || null;
}

function getStock(name) {
    const product = findProduct(name);

    if (!product) {
        return {
            error: "Product not found",
            message: `Product "${name}" not found in inventory.`
        };
    }

    return {
        id: product.id,
        name: product.name,
        unit: product.unit,
        stock: product.stock,
        reorder_level: product.reorder_level,
        cost_price: product.cost_price,
        sell_price: product.sell_price,
        mrp: product.mrp,
        gst_rate: product.gst_rate,
        message: `${product.name}: ${product.stock} ${product.unit}(s) in stock.`
    };
}

function lowStock() {
    const items = db.prepare(`
        SELECT id, name, unit, stock, reorder_level
        FROM products
        WHERE stock <= reorder_level
        ORDER BY stock ASC
    `).all();

    if (items.length === 0) {
        return {
            items: [],
            message: "All items are sufficiently stocked. No low-stock alerts!"
        };
    }

    const lines = items.map(
        i => `• ${i.name}: ${i.stock} ${i.unit}(s) remaining (Reorder level: ${i.reorder_level})`
    );

    return {
        items,
        message: `⚠️ Low Stock Alert (${items.length} items):\n` + lines.join("\n")
    };
}

function receiveStock(name, quantity, cost, mrp) {
    const product = findProduct(name);

    if (!product) {
        return {
            error: "Product not found",
            message: `Cannot receive stock: product "${name}" not found.`
        };
    }

    const numQty = Number(quantity);
    const numCost = Number(cost);
    const numMrp = Number(mrp);

    const updateProduct = db.transaction(() => {
        db.prepare(`
            UPDATE products
            SET stock = stock + ?,
                cost_price = ?,
                mrp = ?,
                sell_price = ?
            WHERE id = ?
        `).run(numQty, numCost, numMrp, numMrp, product.id);

        db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, cost, mrp, notes)
            VALUES (?, 'RECEIVED', ?, ?, ?, ?)
        `).run(product.id, numQty, numCost, numMrp, `Stock inbound: +${numQty} @ ₹${numCost}`);
    });

    updateProduct();

    const newStock = product.stock + numQty;

    return {
        success: true,
        product: product.name,
        unit: product.unit,
        added: numQty,
        cost: numCost,
        mrp: numMrp,
        newStock,
        message: `${numQty} ${product.unit}(s) of ${product.name} received successfully. New stock: ${newStock}`
    };
}

function getAllProducts() {
    return db.prepare(`
        SELECT *,
               CASE WHEN stock <= reorder_level THEN 1 ELSE 0 END AS is_low_stock
        FROM products
        ORDER BY name ASC
    `).all();
}

module.exports = {
    searchProduct,
    findProduct,
    getStock,
    lowStock,
    receiveStock,
    getAllProducts
};