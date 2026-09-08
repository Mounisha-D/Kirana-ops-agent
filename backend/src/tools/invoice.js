const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const db = require("../services/database");

const INVOICES_DIR = path.join(__dirname, "../../generated/invoices");

if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

function generateInvoicePdf(billId) {
    return new Promise((resolve, reject) => {
        const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
        if (!bill) {
            return reject(new Error(`Bill #${billId} not found`));
        }

        const items = db.prepare(`
            SELECT
                bi.quantity,
                bi.price,
                bi.gst_rate,
                p.name,
                p.unit,
                p.hsn_code
            FROM bill_items bi
            JOIN products p ON p.id = bi.product_id
            WHERE bi.bill_id = ?
        `).all(billId);

        const fileName = `invoice-${billId}.pdf`;
        const filePath = path.join(INVOICES_DIR, fileName);

        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        // Header
        doc.fillColor("#1e293b")
           .fontSize(22)
           .font("Helvetica-Bold")
           .text("NEBULA SUPERMARKET & KIRANA", { align: "center" });

        doc.fontSize(9)
           .font("Helvetica")
           .fillColor("#64748b")
           .text("Complete Retail & Daily Grocery Solutions", { align: "center" })
           .text("104, Market Complex, MG Road, Bengaluru - 560001", { align: "center" })
           .text("GSTIN: 29ABCDE1234F1Z5 | Phone: +91 98450 12345", { align: "center" });

        doc.moveDown(0.5);
        doc.strokeColor("#cbd5e1").lineWidth(1)
           .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.8);

        // Bill Meta
        const startY = doc.y;
        doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
        doc.text(`TAX INVOICE: INV-${String(billId).padStart(5, "0")}`, 40, startY);
        doc.font("Helvetica").fontSize(9).fillColor("#475569");
        doc.text(`Date: ${bill.created_at || new Date().toISOString().split("T")[0]}`, 40, startY + 14);
        doc.text(`Payment Mode: ${bill.payment_mode || "CASH"}`, 40, startY + 26);

        doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a");
        doc.text(`Status: ${bill.status || "FINALIZED"}`, 400, startY);
        doc.font("Helvetica").fontSize(9).fillColor("#475569");
        doc.text(`POS Terminal: #01 (Main)`, 400, startY + 14);
        doc.text(`Cashier: Admin`, 400, startY + 26);

        doc.moveDown(2);

        // Table Header
        const tableTop = doc.y + 10;
        doc.rect(40, tableTop, 515, 22).fill("#f1f5f9");

        doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(9);
        doc.text("#", 45, tableTop + 6, { width: 25 });
        doc.text("Item Description", 70, tableTop + 6, { width: 170 });
        doc.text("HSN", 245, tableTop + 6, { width: 50 });
        doc.text("Qty", 300, tableTop + 6, { width: 50, align: "right" });
        doc.text("Rate (₹)", 355, tableTop + 6, { width: 55, align: "right" });
        doc.text("GST %", 415, tableTop + 6, { width: 45, align: "right" });
        doc.text("Total (₹)", 465, tableTop + 6, { width: 80, align: "right" });

        let currentY = tableTop + 26;
        doc.font("Helvetica").fontSize(9).fillColor("#334155");

        items.forEach((item, index) => {
            const itemTotal = (item.quantity * item.price).toFixed(2);
            doc.text(String(index + 1), 45, currentY, { width: 25 });
            doc.text(item.name, 70, currentY, { width: 170 });
            doc.text(item.hsn_code || "-", 245, currentY, { width: 50 });
            doc.text(`${item.quantity} ${item.unit || "unit"}`, 300, currentY, { width: 50, align: "right" });
            doc.text(Number(item.price).toFixed(2), 355, currentY, { width: 55, align: "right" });
            doc.text(`${item.gst_rate}%`, 415, currentY, { width: 45, align: "right" });
            doc.text(itemTotal, 465, currentY, { width: 80, align: "right" });

            currentY += 18;
            doc.strokeColor("#f1f5f9").lineWidth(0.5)
               .moveTo(40, currentY - 3).lineTo(555, currentY - 3).stroke();
        });

        // Totals Box
        currentY += 10;
        doc.strokeColor("#cbd5e1").lineWidth(1)
           .moveTo(320, currentY).lineTo(555, currentY).stroke();
        currentY += 8;

        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc.text("Subtotal:", 330, currentY);
        doc.text(`₹${Number(bill.subtotal).toFixed(2)}`, 465, currentY, { width: 80, align: "right" });

        currentY += 15;
        doc.text("CGST:", 330, currentY);
        doc.text(`₹${Number(bill.cgst).toFixed(2)}`, 465, currentY, { width: 80, align: "right" });

        currentY += 15;
        doc.text("SGST:", 330, currentY);
        doc.text(`₹${Number(bill.sgst).toFixed(2)}`, 465, currentY, { width: 80, align: "right" });

        currentY += 18;
        doc.rect(320, currentY - 4, 235, 26).fill("#e2e8f0");
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("Grand Total:", 330, currentY + 3);
        doc.text(`₹${Number(bill.total).toFixed(2)}`, 465, currentY + 3, { width: 80, align: "right" });

        // Footer
        const footerY = 740;
        doc.strokeColor("#cbd5e1").lineWidth(0.5)
           .moveTo(40, footerY).lineTo(555, footerY).stroke();

        doc.fontSize(8).font("Helvetica").fillColor("#64748b")
           .text("Thank you for shopping with Nebula Supermarket! We appreciate your business.", 40, footerY + 10, { align: "center" })
           .text("GST Summary: CGST + SGST split 50/50 per applicable slab. Computer generated tax invoice.", 40, footerY + 22, { align: "center" });

        doc.end();

        writeStream.on("finish", () => {
            resolve({
                success: true,
                filePath,
                fileName
            });
        });

        writeStream.on("error", (err) => {
            reject(err);
        });
    });
}

module.exports = {
    generateInvoicePdf,
    INVOICES_DIR
};
