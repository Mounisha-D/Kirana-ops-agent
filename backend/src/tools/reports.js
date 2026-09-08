const db = require("../services/database");

function getDailySummary(dateStr) {
    const targetDate = dateStr || new Date().toISOString().split("T")[0];

    const salesSummary = db.prepare(`
        SELECT
            COUNT(*) as total_bills,
            COALESCE(SUM(subtotal), 0) as total_subtotal,
            COALESCE(SUM(cgst), 0) as total_cgst,
            COALESCE(SUM(sgst), 0) as total_sgst,
            COALESCE(SUM(total), 0) as total_sales
        FROM bills
        WHERE status = 'FINALIZED'
          AND date(created_at) = date(?)
    `).get(targetDate);

    const paymentBreakdown = db.prepare(`
        SELECT
            COALESCE(payment_mode, 'Cash') as mode,
            COUNT(*) as count,
            COALESCE(SUM(total), 0) as total
        FROM bills
        WHERE status = 'FINALIZED'
          AND date(created_at) = date(?)
        GROUP BY payment_mode
        ORDER BY total DESC
    `).all(targetDate);

    const topProducts = db.prepare(`
        SELECT
            p.name,
            p.unit,
            SUM(bi.quantity) as total_quantity,
            SUM(bi.quantity * bi.price) as total_revenue
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        JOIN products p ON p.id = bi.product_id
        WHERE b.status = 'FINALIZED'
          AND date(b.created_at) = date(?)
        GROUP BY p.id
        ORDER BY total_quantity DESC
        LIMIT 5
    `).all(targetDate);

    const lowStockCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM products
        WHERE stock <= reorder_level
    `).get().count;

    const khataSummary = db.prepare(`
        SELECT
            COALESCE(SUM(
                CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END
            ), 0) as outstanding_balance
        FROM credit_transactions
    `).get();

    return {
        date: targetDate,
        totalBills: salesSummary.total_bills,
        subtotal: salesSummary.total_subtotal,
        cgst: salesSummary.total_cgst,
        sgst: salesSummary.total_sgst,
        totalSales: salesSummary.total_sales,
        paymentBreakdown,
        topProducts,
        lowStockCount,
        khataOutstanding: khataSummary.outstanding_balance
    };
}

function getDailyCloseText(dateStr) {
    const summary = getDailySummary(dateStr);

    let text = `📊 DAILY CLOSE — ${summary.date}\n`;
    text += `========================================\n`;
    text += `🧾 Total Bills: ${summary.totalBills}\n`;
    text += `💰 Subtotal: ₹${Number(summary.subtotal).toFixed(2)}\n`;
    text += `🏛️ CGST: ₹${Number(summary.cgst).toFixed(2)}\n`;
    text += `🏛️ SGST: ₹${Number(summary.sgst).toFixed(2)}\n`;
    text += `💵 Total Sales: ₹${Number(summary.totalSales).toFixed(2)}\n\n`;

    text += `💳 PAYMENT MODES:\n`;
    if (summary.paymentBreakdown.length === 0) {
        text += `• No payments recorded today.\n`;
    } else {
        summary.paymentBreakdown.forEach(p => {
            text += `• ${p.mode.toUpperCase()}: ₹${Number(p.total).toFixed(2)} (${p.count} bills)\n`;
        });
    }

    text += `\n🏆 TOP SELLING PRODUCTS:\n`;
    if (summary.topProducts.length === 0) {
        text += `• No products sold yet today.\n`;
    } else {
        summary.topProducts.forEach((tp, i) => {
            text += `${i + 1}. ${tp.name}: ${tp.total_quantity} ${tp.unit} — ₹${Number(tp.total_revenue).toFixed(2)}\n`;
        });
    }

    text += `\n⚠️ Low Stock Items: ${summary.lowStockCount}\n`;
    text += `📒 Total Khata Outstanding: ₹${Number(summary.khataOutstanding).toFixed(2)}\n`;
    text += `========================================`;

    return text;
}

module.exports = {
    getDailySummary,
    getDailyCloseText
};
