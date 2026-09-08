const db = require("../services/database");

function addProduct(data) {
    if (!data || !data.name) {
        return {
            error: "Product name is required",
            message: "Product name is required."
        };
    }

    const trimmedName = data.name.trim();

    const existing = db.prepare(`
        SELECT * FROM products
        WHERE LOWER(name) = ?
    `).get(trimmedName.toLowerCase());

    if (existing) {
        return {
            error: "Product already exists",
            message: `Product "${existing.name}" already exists in the inventory.`
        };
    }

    const unit = data.unit || "piece";
    const mrp = Number(data.mrp) || 0;
    const costPrice = data.cost_price !== undefined ? Number(data.cost_price) : mrp;
    const sellPrice = data.sell_price !== undefined ? Number(data.sell_price) : mrp;
    const gstRate = Number(data.gst_rate) || 0;
    const hsnCode = data.hsn_code || "";
    const stock = Number(data.stock) || 0;
    const reorderLevel = Number(data.reorder_level) || 5;

    const insert = db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO products
            (name, unit, cost_price, sell_price, mrp, gst_rate, hsn_code, stock, reorder_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            trimmedName,
            unit,
            costPrice,
            sellPrice,
            mrp,
            gstRate,
            hsnCode,
            stock,
            reorderLevel
        );

        const productId = result.lastInsertRowid;

        if (stock > 0) {
            db.prepare(`
                INSERT INTO stock_movements (product_id, type, quantity, cost, mrp, notes)
                VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?)
            `).run(productId, stock, costPrice, mrp, "Initial inventory entry");
        }

        return productId;
    });

    const productId = insert();

    return {
        success: true,
        productId,
        name: trimmedName,
        mrp,
        gstRate,
        stock,
        message: `${trimmedName} added successfully.`
    };
}

module.exports = { addProduct };