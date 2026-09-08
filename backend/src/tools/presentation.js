const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const db = require("../services/database");

const REPORTS_DIR = path.join(__dirname, "../../generated/reports");

if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

async function generateDailyReportPptx(dateStr) {
    const targetDate = dateStr || new Date().toISOString().split("T")[0];
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    // 1. Fetch Sales Aggregates
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

    // 2. Fetch Payment Mode Breakdown
    const paymentBreakdown = db.prepare(`
        SELECT
            COALESCE(payment_mode, 'Unspecified') as mode,
            COUNT(*) as count,
            COALESCE(SUM(total), 0) as total
        FROM bills
        WHERE status = 'FINALIZED'
          AND date(created_at) = date(?)
        GROUP BY payment_mode
    `).all(targetDate);

    // 3. Fetch Top Selling Products
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

    // 4. Fetch Low Stock Items
    const lowStockItems = db.prepare(`
        SELECT name, stock, unit, reorder_level
        FROM products
        WHERE stock <= reorder_level
        ORDER BY stock ASC
        LIMIT 6
    `).all();

    // 5. Fetch Customer Khata Balance
    const khataSummary = db.prepare(`
        SELECT
            COUNT(DISTINCT customer_id) as total_customers,
            COALESCE(SUM(
                CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END
            ), 0) as outstanding_balance
        FROM credit_transactions
    `).get();

    // COLOR THEME
    const NAVY = "0F172A";
    const BLUE = "2563EB";
    const SLATE = "475569";
    const LIGHT_BG = "F8FAFC";
    const GREEN = "10B981";
    const WHITE = "FFFFFF";

    // ----------------------------------------------------
    // SLIDE 1: Title & Executive Summary
    // ----------------------------------------------------
    const slide1 = pptx.addSlide();
    slide1.background = { color: NAVY };

    slide1.addText("NEBULA SUPERMARKET OPS", {
        x: 0.8, y: 1.5, w: 11.5, h: 0.6,
        fontSize: 16, color: BLUE, bold: true, fontFace: "Helvetica"
    });

    slide1.addText("Daily Store Operations & Financial Analysis", {
        x: 0.8, y: 2.2, w: 11.5, h: 1.2,
        fontSize: 34, color: WHITE, bold: true, fontFace: "Helvetica"
    });

    slide1.addText(`Report Date: ${targetDate} | Kirana Automated Ops Intelligence`, {
        x: 0.8, y: 3.6, w: 11.5, h: 0.5,
        fontSize: 14, color: "94A3B8", fontFace: "Helvetica"
    });

    slide1.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 4.6, w: 3.5, h: 1.6, fill: { color: "1E293B" }, line: { color: "334155", width: 1 }
    });
    slide1.addText("TOTAL REVENUE", { x: 1.0, y: 4.8, w: 3.1, h: 0.3, fontSize: 11, color: "94A3B8" });
    slide1.addText(`₹${Number(salesSummary.total_sales).toFixed(2)}`, { x: 1.0, y: 5.2, w: 3.1, h: 0.6, fontSize: 24, bold: true, color: GREEN });

    slide1.addShape(pptx.ShapeType.rect, {
        x: 4.6, y: 4.6, w: 3.5, h: 1.6, fill: { color: "1E293B" }, line: { color: "334155", width: 1 }
    });
    slide1.addText("BILLS COMPLETED", { x: 4.8, y: 4.8, w: 3.1, h: 0.3, fontSize: 11, color: "94A3B8" });
    slide1.addText(`${salesSummary.total_bills}`, { x: 4.8, y: 5.2, w: 3.1, h: 0.6, fontSize: 24, bold: true, color: WHITE });

    slide1.addShape(pptx.ShapeType.rect, {
        x: 8.4, y: 4.6, w: 3.5, h: 1.6, fill: { color: "1E293B" }, line: { color: "334155", width: 1 }
    });
    slide1.addText("CRITICAL REORDER ITEMS", { x: 8.6, y: 4.8, w: 3.1, h: 0.3, fontSize: 11, color: "94A3B8" });
    slide1.addText(`${lowStockItems.length}`, { x: 8.6, y: 5.2, w: 3.1, h: 0.6, fontSize: 24, bold: true, color: "F59E0B" });

    // ----------------------------------------------------
    // SLIDE 2: Sales & Financial Performance
    // ----------------------------------------------------
    const slide2 = pptx.addSlide();
    slide2.background = { color: LIGHT_BG };

    slide2.addText("FINANCIAL PERFORMANCE", { x: 0.8, y: 0.5, w: 10, h: 0.4, fontSize: 12, bold: true, color: BLUE });
    slide2.addText("Daily Sales & Tax Breakdown", { x: 0.8, y: 0.9, w: 10, h: 0.6, fontSize: 22, bold: true, color: NAVY });

    const avgTicket = salesSummary.total_bills > 0 ? (salesSummary.total_sales / salesSummary.total_bills).toFixed(2) : "0.00";

    const salesTable = [
        [
            { text: "Metric", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Amount / Count", options: { bold: true, fill: "2563EB", color: "FFFFFF" } }
        ],
        ["Total Finalized Bills", `${salesSummary.total_bills}`],
        ["Base Subtotal (Taxable)", `₹${Number(salesSummary.total_subtotal).toFixed(2)}`],
        ["Central GST (CGST)", `₹${Number(salesSummary.total_cgst).toFixed(2)}`],
        ["State GST (SGST)", `₹${Number(salesSummary.total_sgst).toFixed(2)}`],
        ["Total GST Collected", `₹${(Number(salesSummary.total_cgst) + Number(salesSummary.total_sgst)).toFixed(2)}`],
        [{ text: "Net Daily Revenue", options: { bold: true } }, { text: `₹${Number(salesSummary.total_sales).toFixed(2)}`, options: { bold: true, color: "10B981" } }],
        ["Average Ticket Size", `₹${avgTicket}`]
    ];

    slide2.addTable(salesTable, {
        x: 0.8, y: 1.8, w: 6.5, h: 4.5,
        colW: [4.0, 2.5],
        fontSize: 12,
        border: { color: "E2E8F0", pt: 1 },
        fill: "FFFFFF"
    });

    slide2.addShape(pptx.ShapeType.roundRect, {
        x: 7.8, y: 1.8, w: 4.5, h: 4.5, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 }
    });
    slide2.addText("Fiscal Compliance & GST", { x: 8.1, y: 2.1, w: 3.9, h: 0.4, fontSize: 14, bold: true, color: NAVY });
    slide2.addText(
        "• All sales are booked with legal 50:50 CGST and SGST splits.\n" +
        "• Statutory HSN codes are maintained for all Kirana product categories.\n" +
        "• No billing allowed below cost price, safeguarding gross profit margins.\n" +
        "• Instant PDF invoices generated for customers with compliant tax numbers.",
        { x: 8.1, y: 2.7, w: 3.9, h: 3.2, fontSize: 11, color: SLATE }
    );

    // ----------------------------------------------------
    // SLIDE 3: Payment Mode Distribution
    // ----------------------------------------------------
    const slide3 = pptx.addSlide();
    slide3.background = { color: LIGHT_BG };

    slide3.addText("CASH FLOW & CHANNELS", { x: 0.8, y: 0.5, w: 10, h: 0.4, fontSize: 12, bold: true, color: BLUE });
    slide3.addText("Payment Mode Collection Analysis", { x: 0.8, y: 0.9, w: 10, h: 0.6, fontSize: 22, bold: true, color: NAVY });

    const paymentRows = [
        [
            { text: "Payment Mode", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Transactions", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Volume (₹)", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Share (%)", options: { bold: true, fill: "2563EB", color: "FFFFFF" } }
        ]
    ];

    paymentBreakdown.forEach(p => {
        const share = salesSummary.total_sales > 0
            ? ((p.total / salesSummary.total_sales) * 100).toFixed(1) + "%"
            : "0%";
        paymentRows.push([p.mode.toUpperCase(), `${p.count}`, `₹${Number(p.total).toFixed(2)}`, share]);
    });

    if (paymentBreakdown.length === 0) {
        paymentRows.push(["No Transactions", "0", "₹0.00", "0%"]);
    }

    slide3.addTable(paymentRows, {
        x: 0.8, y: 1.8, w: 11.5, h: 3.0,
        colW: [3.5, 2.5, 3.0, 2.5],
        fontSize: 12,
        border: { color: "E2E8F0", pt: 1 },
        fill: "FFFFFF"
    });

    slide3.addText("Digital Penetration Insight:", { x: 0.8, y: 5.3, w: 11.5, h: 0.4, fontSize: 13, bold: true, color: NAVY });
    slide3.addText("Digital transactions (UPI & Card) enable faster settlement and automated khata reconciliation. Ensure UPI QR code is prominently displayed at counter.", {
        x: 0.8, y: 5.7, w: 11.5, h: 0.8, fontSize: 11, color: SLATE
    });

    // ----------------------------------------------------
    // SLIDE 4: Top Performing Products
    // ----------------------------------------------------
    const slide4 = pptx.addSlide();
    slide4.background = { color: LIGHT_BG };

    slide4.addText("MERCHANDISE VELOCITY", { x: 0.8, y: 0.5, w: 10, h: 0.4, fontSize: 12, bold: true, color: BLUE });
    slide4.addText("Top-Selling Products Leaderboard", { x: 0.8, y: 0.9, w: 10, h: 0.6, fontSize: 22, bold: true, color: NAVY });

    const topProductRows = [
        [
            { text: "Product Name", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Quantity Sold", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Gross Revenue (₹)", options: { bold: true, fill: "2563EB", color: "FFFFFF" } }
        ]
    ];

    topProducts.forEach(tp => {
        topProductRows.push([tp.name, `${tp.total_quantity} ${tp.unit || ""}`, `₹${Number(tp.total_revenue).toFixed(2)}`]);
    });

    if (topProducts.length === 0) {
        topProductRows.push(["No sales data for today", "-", "₹0.00"]);
    }

    slide4.addTable(topProductRows, {
        x: 0.8, y: 1.8, w: 11.5, h: 3.2,
        colW: [5.5, 3.0, 3.0],
        fontSize: 12,
        border: { color: "E2E8F0", pt: 1 },
        fill: "FFFFFF"
    });

    // ----------------------------------------------------
    // SLIDE 5: Inventory Health & Low Stock Alerts
    // ----------------------------------------------------
    const slide5 = pptx.addSlide();
    slide5.background = { color: LIGHT_BG };

    slide5.addText("INVENTORY AUDIT", { x: 0.8, y: 0.5, w: 10, h: 0.4, fontSize: 12, bold: true, color: BLUE });
    slide5.addText("Stock Replenishment & Reorder Alerts", { x: 0.8, y: 0.9, w: 10, h: 0.6, fontSize: 22, bold: true, color: NAVY });

    const stockRows = [
        [
            { text: "Product Name", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Current Stock", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Reorder Trigger Level", options: { bold: true, fill: "2563EB", color: "FFFFFF" } },
            { text: "Status", options: { bold: true, fill: "2563EB", color: "FFFFFF" } }
        ]
    ];

    lowStockItems.forEach(item => {
        stockRows.push([
            item.name,
            `${item.stock} ${item.unit}`,
            `${item.reorder_level} ${item.unit}`,
            { text: "REORDER NOW", options: { color: "DC2626", bold: true } }
        ]);
    });

    if (lowStockItems.length === 0) {
        stockRows.push(["All inventory levels healthy", "-", "-", { text: "OPTIMAL", options: { color: "10B981" } }]);
    }

    slide5.addTable(stockRows, {
        x: 0.8, y: 1.8, w: 11.5, h: 3.5,
        colW: [4.5, 2.5, 2.5, 2.0],
        fontSize: 12,
        border: { color: "E2E8F0", pt: 1 },
        fill: "FFFFFF"
    });

    // ----------------------------------------------------
    // SLIDE 6: Strategic Operations Plan & Khata
    // ----------------------------------------------------
    const slide6 = pptx.addSlide();
    slide6.background = { color: LIGHT_BG };

    slide6.addText("OPERATIONS PLAYBOOK", { x: 0.8, y: 0.5, w: 10, h: 0.4, fontSize: 12, bold: true, color: BLUE });
    slide6.addText("Next Day Action Items & Khata Health", { x: 0.8, y: 0.9, w: 10, h: 0.6, fontSize: 22, bold: true, color: NAVY });

    slide6.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: 1.8, w: 5.5, h: 4.6, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 }
    });
    slide6.addText("Customer Khata (Credit) Status", { x: 1.1, y: 2.1, w: 5.0, h: 0.4, fontSize: 15, bold: true, color: NAVY });
    slide6.addText(`• Active Credit Accounts: ${khataSummary.total_customers || 0}`, { x: 1.1, y: 2.7, w: 5.0, h: 0.3, fontSize: 12, color: SLATE });
    slide6.addText(`• Total Khata Outstanding: ₹${Number(khataSummary.outstanding_balance).toFixed(2)}`, { x: 1.1, y: 3.2, w: 5.0, h: 0.3, fontSize: 13, bold: true, color: "DC2626" });
    slide6.addText("• Credit policy strictly prohibits payment in excess of outstanding balance to prevent ledger discrepancies.", { x: 1.1, y: 3.7, w: 5.0, h: 0.6, fontSize: 11, color: SLATE });
    slide6.addText("• Send automated WhatsApp/Telegram payment reminders to customers with balances older than 7 days.", { x: 1.1, y: 4.5, w: 5.0, h: 0.6, fontSize: 11, color: SLATE });

    slide6.addShape(pptx.ShapeType.roundRect, {
        x: 6.8, y: 1.8, w: 5.5, h: 4.6, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 }
    });
    slide6.addText("Procurement & Morning Checklist", { x: 7.1, y: 2.1, w: 5.0, h: 0.4, fontSize: 15, bold: true, color: NAVY });
    slide6.addText("1. Place distributor orders for critical items flagged on Slide 5.", { x: 7.1, y: 2.7, w: 5.0, h: 0.4, fontSize: 11, color: SLATE });
    slide6.addText("2. Check morning inbound stock and record with cost & MRP via Telegram.", { x: 7.1, y: 3.2, w: 5.0, h: 0.4, fontSize: 11, color: SLATE });
    slide6.addText("3. Reconcile cash drawer against ₹" + Number(salesSummary.total_sales).toFixed(2) + " daily close total.", { x: 7.1, y: 3.7, w: 5.0, h: 0.4, fontSize: 11, color: SLATE });
    slide6.addText("4. Perform weekly backup of kirana.db SQLite file.", { x: 7.1, y: 4.2, w: 5.0, h: 0.4, fontSize: 11, color: SLATE });

    const fileName = `daily-report-${targetDate}.pptx`;
    const filePath = path.join(REPORTS_DIR, fileName);

    await pptx.writeFile({ fileName: filePath });

    return {
        success: true,
        filePath,
        fileName
    };
}

module.exports = {
    generateDailyReportPptx,
    REPORTS_DIR
};
