const db = require("../services/database");
const { findProduct } = require("./inventory");
const { generateInvoicePdf } = require("./invoice");

function createBill(chatId = null) {
    const result = db.prepare(`
        INSERT INTO bills (status)
        VALUES ('DRAFT')
    `).run();

    const billId = result.lastInsertRowid;

    if (chatId) {
        db.prepare(`
            INSERT INTO sessions (chat_id, current_bill_id)
            VALUES (?, ?)
            ON CONFLICT(chat_id)
            DO UPDATE SET current_bill_id = excluded.current_bill_id
        `).run(String(chatId), billId);
    }

    return {
        billId,
        status: "DRAFT",
        message: `Draft bill #${billId} created.`
    };
}

function getSessionBill(chatId) {
    if (!chatId) return null;

    const session = db.prepare(`
        SELECT current_bill_id FROM sessions WHERE chat_id = ?
    `).get(String(chatId));

    if (!session || !session.current_bill_id) return null;

    const bill = db.prepare(`
        SELECT * FROM bills WHERE id = ?
    `).get(session.current_bill_id);

    if (bill && bill.status === "DRAFT") {
        return bill.id;
    }

    return null;
}

function clearSessionBill(chatId) {
    if (!chatId) return;
    db.prepare(`
        UPDATE sessions SET current_bill_id = NULL WHERE chat_id = ?
    `).run(String(chatId));
}

function addItem(billId, productName, quantity) {
    const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);

    if (!bill) {
        return { error: "Bill not found", message: `Bill #${billId} not found.` };
    }

    if (bill.status !== "DRAFT") {
        return { error: "Bill already finalized", message: `Bill #${billId} has already been finalized.` };
    }

    const product = findProduct(productName);
    if (!product) {
        return { error: "Product not found", message: `Product "${productName}" not found in inventory.` };
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
        return { error: "Invalid quantity", message: "Please specify a quantity greater than 0." };
    }

    // Check existing quantity in draft bill
    const existing = db.prepare(`
        SELECT * FROM bill_items
        WHERE bill_id = ? AND product_id = ?
    `).get(billId, product.id);

    const targetQty = (existing ? existing.quantity : 0) + numQty;

    // Guard 1: Oversell protection
    if (product.stock < targetQty) {
        return {
            error: `Only ${product.stock} ${product.unit} available`,
            message: `Not enough stock. Only ${product.stock} ${product.unit}(s) of ${product.name} available.`
        };
    }

    // Guard 2: Below-cost protection
    if (product.sell_price < product.cost_price) {
        return {
            error: "Sale below cost price is not allowed",
            message: `Sale below cost price is not allowed for ${product.name} (Cost: ₹${product.cost_price}, Price: ₹${product.sell_price}).`
        };
    }

    if (existing) {
        db.prepare(`
            UPDATE bill_items
            SET quantity = quantity + ?
            WHERE id = ?
        `).run(numQty, existing.id);
    } else {
        db.prepare(`
            INSERT INTO bill_items (bill_id, product_id, quantity, price, gst_rate)
            VALUES (?, ?, ?, ?, ?)
        `).run(billId, product.id, numQty, product.sell_price, product.gst_rate);
    }

    // Return updated preview
    const updatedBill = getBill(billId);

    return {
        success: true,
        billId,
        product: product.name,
        quantity: numQty,
        price: product.sell_price,
        billTotal: updatedBill.bill.total,
        message: `Added ${numQty} ${product.unit || ""}(s) of ${product.name} to bill #${billId}.`
    };
}

function updateItem(billId, productName, newQuantity) {
    const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
    if (!bill || bill.status !== "DRAFT") {
        return { error: "Bill not found or finalized", message: "Active draft bill not found." };
    }

    const product = findProduct(productName);
    if (!product) {
        return { error: "Product not found", message: `Product "${productName}" not found.` };
    }

    const numQty = Number(newQuantity);
    if (numQty <= 0) {
        return removeItem(billId, productName);
    }

    if (product.stock < numQty) {
        return {
            error: `Only ${product.stock} ${product.unit} available`,
            message: `Cannot update: Only ${product.stock} ${product.unit}(s) available.`
        };
    }

    const existing = db.prepare(`
        SELECT id FROM bill_items
        WHERE bill_id = ? AND product_id = ?
    `).get(billId, product.id);

    if (!existing) {
        return addItem(billId, productName, numQty);
    }

    db.prepare(`
        UPDATE bill_items
        SET quantity = ?
        WHERE id = ?
    `).run(numQty, existing.id);

    return {
        success: true,
        product: product.name,
        newQuantity: numQty,
        message: `Updated ${product.name} quantity to ${numQty} in bill #${billId}.`
    };
}

function removeItem(billId, productName) {
    const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
    if (!bill || bill.status !== "DRAFT") {
        return { error: "Bill not found or finalized", message: "Active draft bill not found." };
    }

    const product = findProduct(productName);
    if (!product) {
        return { error: "Product not found", message: `Product "${productName}" not found.` };
    }

    const result = db.prepare(`
        DELETE FROM bill_items
        WHERE bill_id = ? AND product_id = ?
    `).run(billId, product.id);

    if (result.changes === 0) {
        return { error: "Item not in bill", message: `"${product.name}" was not in bill #${billId}.` };
    }

    return {
        success: true,
        removed: product.name,
        message: `Removed ${product.name} from bill #${billId}.`
    };
}

function getBill(billId) {
    const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
    if (!bill) {
        return { error: "Bill not found", message: `Bill #${billId} not found.` };
    }

    const items = db.prepare(`
        SELECT
            bi.id as item_id,
            bi.product_id,
            bi.quantity,
            bi.price,
            bi.gst_rate,
            p.name,
            p.unit,
            p.stock as current_stock,
            (bi.quantity * bi.price) as item_subtotal,
            (bi.quantity * bi.price * bi.gst_rate / 100) as item_gst
        FROM bill_items bi
        JOIN products p ON p.id = bi.product_id
        WHERE bi.bill_id = ?
    `).all(billId);

    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    items.forEach(i => {
        subtotal += i.item_subtotal;
        totalCgst += i.item_gst / 2;
        totalSgst += i.item_gst / 2;
    });

    const total = subtotal + totalCgst + totalSgst;

    // Format text representation
    let text = `🧾 BILL #${billId} [${bill.status}]\n`;
    text += `----------------------------------------\n`;
    if (items.length === 0) {
        text += `No items in bill yet.\n`;
    } else {
        items.forEach((item, idx) => {
            const lineTotal = item.item_subtotal + item.item_gst;
            text += `${idx + 1}. ${item.name} x ${item.quantity} ${item.unit || ""} @ ₹${item.price} = ₹${lineTotal.toFixed(2)} (GST ${item.gst_rate}%)\n`;
        });
    }
    text += `----------------------------------------\n`;
    text += `Subtotal: ₹${subtotal.toFixed(2)}\n`;
    text += `CGST: ₹${totalCgst.toFixed(2)}\n`;
    text += `SGST: ₹${totalSgst.toFixed(2)}\n`;
    text += `Total: ₹${total.toFixed(2)}`;

    return {
        bill: {
            ...bill,
            subtotal,
            cgst: totalCgst,
            sgst: totalSgst,
            total
        },
        items,
        text
    };
}

async function finalizeBill(billId, paymentMode = "UPI", chatId = null) {
    const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
    if (!bill) {
        return { error: "Bill not found", message: `Bill #${billId} not found.` };
    }

    // Idempotency: If already finalized, return cached bill details without duplicating stock deductions
    if (bill.status === "FINALIZED") {
        return {
            alreadyFinalized: true,
            billId,
            subtotal: bill.subtotal,
            cgst: bill.cgst,
            sgst: bill.sgst,
            total: bill.total,
            paymentMode: bill.payment_mode,
            message: `Bill #${billId} is already finalized with payment mode ${bill.payment_mode}. Total: ₹${bill.total.toFixed(2)}`
        };
    }

    const items = db.prepare(`
        SELECT
            bi.*,
            p.name,
            p.stock,
            p.unit
        FROM bill_items bi
        JOIN products p ON p.id = bi.product_id
        WHERE bi.bill_id = ?
    `).all(billId);

    if (items.length === 0) {
        return { error: "Bill has no items", message: `Cannot finalize empty bill #${billId}. Add items first.` };
    }

    // Atomic Transaction: Concurrency safe stock reduction and bill state update
    const checkoutTransaction = db.transaction(() => {
        // 1. Strict Stock Re-verification
        for (const item of items) {
            const liveProduct = db.prepare(`SELECT stock, name, unit FROM products WHERE id = ?`).get(item.product_id);
            if (!liveProduct || liveProduct.stock < item.quantity) {
                const avail = liveProduct ? liveProduct.stock : 0;
                throw new Error(`Oversell prevention: Not enough stock for ${item.name}. Required: ${item.quantity}, Available: ${avail}`);
            }
        }

        // 2. Compute financial totals & decrement stock
        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;

        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const gst = (itemTotal * item.gst_rate) / 100;

            subtotal += itemTotal;
            cgst += gst / 2;
            sgst += gst / 2;

            // Decrement inventory stock
            db.prepare(`
                UPDATE products
                SET stock = stock - ?
                WHERE id = ?
            `).run(item.quantity, item.product_id);

            // Audit log in stock movements
            db.prepare(`
                INSERT INTO stock_movements (product_id, type, quantity, cost, mrp, notes)
                VALUES (?, 'SOLD', ?, ?, ?, ?)
            `).run(item.product_id, item.quantity, item.price, item.price, `Finalized Bill #${billId}`);
        }

        const grandTotal = subtotal + cgst + sgst;

        // 3. Mark bill finalized
        db.prepare(`
            UPDATE bills
            SET status = 'FINALIZED',
                payment_mode = ?,
                subtotal = ?,
                cgst = ?,
                sgst = ?,
                total = ?
            WHERE id = ?
        `).run(paymentMode.toUpperCase(), subtotal, cgst, sgst, grandTotal, billId);

        return {
            billId,
            subtotal,
            cgst,
            sgst,
            total: grandTotal,
            paymentMode: paymentMode.toUpperCase()
        };
    });

    let checkoutResult;
    try {
        checkoutResult = checkoutTransaction();
    } catch (err) {
        return {
            error: "Checkout failed",
            message: err.message
        };
    }

    // Generate PDF invoice
    let invoiceInfo = null;
    try {
        invoiceInfo = await generateInvoicePdf(billId);
    } catch (err) {
        console.error("PDF generation failed:", err.message);
    }

    // Clear active draft bill in session if any
    if (chatId) {
        clearSessionBill(chatId);
    }

    return {
        success: true,
        billId,
        subtotal: checkoutResult.subtotal,
        cgst: checkoutResult.cgst,
        sgst: checkoutResult.sgst,
        total: checkoutResult.total,
        paymentMode: checkoutResult.paymentMode,
        invoiceFile: invoiceInfo ? invoiceInfo.filePath : null,
        invoiceName: invoiceInfo ? invoiceInfo.fileName : null,
        message: `Bill #${billId} finalized successfully! Payment via ${checkoutResult.paymentMode}. Total: ₹${checkoutResult.total.toFixed(2)} (Subtotal: ₹${checkoutResult.subtotal.toFixed(2)}, CGST: ₹${checkoutResult.cgst.toFixed(2)}, SGST: ₹${checkoutResult.sgst.toFixed(2)})`
    };
}

function getAllBills() {
    const bills = db.prepare(`
        SELECT * FROM bills
        ORDER BY id DESC
        LIMIT 50
    `).all();

    return bills.map(b => getBill(b.id));
}

module.exports = {
    createBill,
    getSessionBill,
    clearSessionBill,
    addItem,
    updateItem,
    removeItem,
    getBill,
    finalizeBill,
    getAllBills
};