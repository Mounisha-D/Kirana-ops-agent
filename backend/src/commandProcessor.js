const {
    getStock,
    lowStock,
    receiveStock,
    findProduct
} = require("./tools/inventory");

const { addProduct } = require("./tools/product");

const {
    createBill,
    getSessionBill,
    addItem,
    updateItem,
    removeItem,
    finalizeBill,
    getBill
} = require("./tools/billing");

const {
    addCredit,
    recordPayment,
    getBalance
} = require("./tools/credit");

const {
    getPreference,
    setPreference
} = require("./tools/preferences");

const {
    getDailyCloseText,
    getDailySummary
} = require("./tools/reports");

const {
    generateDailyReportPptx
} = require("./tools/presentation");

function parseReceive(text) {
    const costMatch = text.match(/(?:cost|cp|at\s+cost)\s*[^0-9\s]*\s*(\d+(?:\.\d+)?)/i);
    const mrpMatch = text.match(/(?:mrp|selling|sp)\s*[^0-9\s]*\s*(\d+(?:\.\d+)?)/i);
    if (!costMatch || !mrpMatch) return null;

    const cost = Number(costMatch[1]);
    const mrp = Number(mrpMatch[1]);

    let cleaned = text
        .replace(/^(?:we\s+)?(?:received|receive)\s+/i, "")
        .replace(/(?:cost|cp|at\s+cost)\s*[^0-9\s]*\s*\d+(?:\.\d+)?/i, "")
        .replace(/(?:mrp|selling|sp)\s*[^0-9\s]*\s*\d+(?:\.\d+)?/i, "")
        .replace(/came\s+in/i, "")
        .replace(/\band\b/gi, "")
        .trim();

    const qtyMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:packets?|pieces?|units?|kg|kgs?|litres?|l)?\s*(?:of\s+)?(.*)/i);
    if (!qtyMatch) return null;

    const qty = Number(qtyMatch[1]);
    let name = qtyMatch[2]
        .replace(/[,\s]+$/, "")
        .replace(/^[,\s]+/, "")
        .replace(/\s+(?:packets?|pieces?|units?|kg|kgs?|litres?|l)$/i, "")
        .trim();

    return { qty, name, cost, mrp };
}

async function processCommand(message, chatId = "web") {
    if (!message || typeof message !== "string") {
        return {
            text: "Please send a valid text message.",
            type: "error"
        };
    }

    const raw = message.trim();
    const lower = raw.toLowerCase();

    // ----------------------------------------------------
    // 1. HELP & GREETING
    // ----------------------------------------------------
    if (lower === "help" || lower === "/help" || lower === "start" || lower === "/start" || lower === "hi" || lower === "hello") {
        return {
            text:
                "👋 **Welcome to Nebula Supermarket Ops Agent!**\n\n" +
                "Here are sample commands you can use:\n\n" +
                "📦 **Inventory:**\n" +
                "• `How much Maggi is in stock?`\n" +
                "• `show low stock`\n" +
                "• `50 packets of Maggi came in, cost ₹12, MRP ₹14`\n" +
                "• `new item: Amul Butter 100g, GST 12%, MRP ₹62`\n\n" +
                "🧾 **Billing:**\n" +
                "• `make a bill`\n" +
                "• `add 2 sugar`\n" +
                "• `add 4 Maggi`\n" +
                "• `change Maggi to 5`\n" +
                "• `remove Maggi`\n" +
                "• `show bill`\n" +
                "• `finalize bill UPI`\n" +
                "• `make a bill: 2kg sugar, 4 Maggi, UPI`\n\n" +
                "📒 **Khata (Customer Credit):**\n" +
                "• `Add ₹500 to Ravi's khata`\n" +
                "• `What is Ravi's balance?`\n" +
                "• `Ravi paid ₹200`\n\n" +
                "📊 **Reports & PPTX:**\n" +
                "• `daily close`\n" +
                "• `generate report` (generates 6-slide PPTX)",
            type: "help"
        };
    }

    // ----------------------------------------------------
    // 2. DAILY CLOSE
    // ----------------------------------------------------
    if (
        lower === "daily close" ||
        lower === "close day" ||
        lower === "end of day" ||
        lower.includes("daily sales summary")
    ) {
        const text = getDailyCloseText();
        const summary = getDailySummary();
        return {
            text,
            type: "daily_close",
            data: summary
        };
    }

    // ----------------------------------------------------
    // 3. GENERATE PPTX REPORT
    // ----------------------------------------------------
    if (
        lower.includes("generate report") ||
        lower.includes("daily report") ||
        lower.includes("create report") ||
        lower.includes("pptx report") ||
        lower === "generate pptx"
    ) {
        try {
            const reportResult = await generateDailyReportPptx();
            return {
                text: `📊 Daily Operations Analysis PPTX generated successfully!\nFile: ${reportResult.fileName}`,
                type: "report_generated",
                reportFile: reportResult.filePath,
                reportName: reportResult.fileName,
                downloadUrl: `/api/reports/download/${reportResult.fileName}`
            };
        } catch (err) {
            return {
                text: `Error generating report: ${err.message}`,
                type: "error"
            };
        }
    }

    // ----------------------------------------------------
    // 4. LOW STOCK / REORDER
    // ----------------------------------------------------
    if (
        lower === "show low stock" ||
        lower === "low stock" ||
        lower.includes("low stock") ||
        lower === "reorder" ||
        lower.includes("reorder list")
    ) {
        const result = lowStock();
        return {
            text: result.message,
            type: "low_stock",
            data: result.items
        };
    }

    // ----------------------------------------------------
    // 5. RECEIVE STOCK
    // ----------------------------------------------------
    const receiveData = parseReceive(raw);
    if (receiveData) {
        const res = receiveStock(receiveData.name, receiveData.qty, receiveData.cost, receiveData.mrp);
        return {
            text: res.message,
            type: res.error ? "error" : "receive_stock",
            data: res
        };
    }

    // ----------------------------------------------------
    // 6. ADD PRODUCT
    // ----------------------------------------------------
    if (
        lower.startsWith("new item") ||
        lower.startsWith("add product") ||
        lower.startsWith("create product")
    ) {
        const match = raw.match(
            /(?:new item|add product|create product)\s*:?\s*(.+?),\s*(?:gst\s*(\d+(?:\.\d+)?)%?,\s*)?mrp\s*[^0-9\s]*\s*(\d+(?:\.\d+)?)/i
        );

        if (!match) {
            return {
                text: "Please provide product details in format: `new item: <name>, GST <rate>%, MRP ₹<price>`",
                type: "error"
            };
        }

        const name = match[1].trim();
        const gst = Number(match[2] || 5);
        const mrp = Number(match[3]);

        let unit = "piece";
        if (/\b(?:kg|kgs)\b/i.test(name)) unit = "kg";
        else if (/\b(?:litre|l|ml)\b/i.test(name)) unit = "litre";
        else if (/\b(?:packet|pkt)\b/i.test(name)) unit = "packet";

        const res = addProduct({
            name,
            unit,
            cost_price: mrp,
            sell_price: mrp,
            mrp,
            gst_rate: gst,
            stock: 0,
            reorder_level: 5
        });

        return {
            text: res.message,
            type: "product_added",
            data: res
        };
    }

    // ----------------------------------------------------
    // 7. COMPOSITE ONE-SHOT BILL
    // ----------------------------------------------------
    if (lower.startsWith("make a bill:") || lower.startsWith("create bill:")) {
        const payload = raw.substring(raw.indexOf(":") + 1).trim();
        const parts = payload.split(",").map(p => p.trim()).filter(Boolean);

        let paymentMode = null;
        const lastPart = parts[parts.length - 1];
        if (/^(?:upi|cash|card)$/i.test(lastPart)) {
            paymentMode = lastPart.toUpperCase();
            parts.pop();
        }

        const bill = createBill(chatId);
        const addedItems = [];
        const failedItems = [];

        for (const part of parts) {
            const itemMatch = part.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|g|litre|l|packets?|pieces?|units?)?\s+(.+)$/i);
            if (itemMatch) {
                const qty = Number(itemMatch[1]);
                const prodName = itemMatch[2].trim();
                const addRes = addItem(bill.billId, prodName, qty);
                if (addRes.success) {
                    addedItems.push(`${qty} ${prodName}`);
                } else {
                    failedItems.push(`${prodName}: ${addRes.message}`);
                }
            } else {
                failedItems.push(`Could not parse item: "${part}"`);
            }
        }

        if (paymentMode && addedItems.length > 0) {
            const finalRes = await finalizeBill(bill.billId, paymentMode, chatId);
            return {
                text: `${finalRes.message}\n` + (failedItems.length > 0 ? `\nWarnings:\n${failedItems.join("\n")}` : ""),
                type: "bill_finalized",
                data: finalRes,
                invoiceFile: finalRes.invoiceFile,
                invoiceName: finalRes.invoiceName,
                downloadUrl: finalRes.billId ? `/api/invoices/${finalRes.billId}` : null
            };
        }

        const preview = getBill(bill.billId);
        let respText = preview.text;
        if (failedItems.length > 0) {
            respText += `\n\n⚠️ Could not add:\n` + failedItems.join("\n");
        }
        respText += `\n\n💡 To checkout, send: \`finalize bill UPI\` or \`finalize bill Cash\``;

        return {
            text: respText,
            type: "bill_preview",
            data: preview
        };
    }

    // ----------------------------------------------------
    // 8. KHATA (CUSTOMER CREDIT & PAYMENTS)
    // ----------------------------------------------------
    const creditMatch = raw.match(
        /add\s*[^0-9\s]*\s*(\d+(?:\.\d+)?)\s*(?:to|in)\s+(.+?)['’]?s?\s*khata/i
    );
    if (creditMatch) {
        const amount = Number(creditMatch[1]);
        const name = creditMatch[2].trim();
        const res = addCredit(name, amount);
        return {
            text: res.message,
            type: "khata_credit",
            data: res
        };
    }

    const paidMatch1 = raw.match(/^(.+?)\s+paid\s*[^0-9\s]*\s*(\d+(?:\.\d+)?)/i);
    const paidMatch2 = raw.match(/(?:paid|payment).*?[^0-9\s]*\s*(\d+(?:\.\d+)?).*?(?:by|from)\s+(.+)/i);

    if (paidMatch1) {
        const name = paidMatch1[1].replace(/^(?:customer|mr\.?|mrs\.?)\s+/i, "").trim();
        const amount = Number(paidMatch1[2]);
        const res = recordPayment(name, amount);
        return {
            text: res.message,
            type: res.error ? "error" : "khata_payment",
            data: res
        };
    } else if (paidMatch2) {
        const amount = Number(paidMatch2[1]);
        const name = paidMatch2[2].trim();
        const res = recordPayment(name, amount);
        return {
            text: res.message,
            type: res.error ? "error" : "khata_payment",
            data: res
        };
    }

    if (
        lower.includes("balance") ||
        lower.includes("owe") ||
        (lower.includes("khata") && !lower.includes("add"))
    ) {
        let name = raw
            .replace(/what\s+is/gi, "")
            .replace(/what's/gi, "")
            .replace(/how\s+much/gi, "")
            .replace(/does/gi, "")
            .replace(/owe/gi, "")
            .replace(/balance/gi, "")
            .replace(/khata/gi, "")
            .replace(/in\s+/gi, "")
            .replace(/of\s+/gi, "")
            .replace(/['’]s/gi, "")
            .replace(/[?.]/gi, "")
            .trim();

        if (!name) {
            return {
                text: "Please specify the customer name (e.g. `What is Ravi's balance?`).",
                type: "error"
            };
        }

        const res = getBalance(name);
        return {
            text: res.message,
            type: "khata_balance",
            data: res
        };
    }

    // ----------------------------------------------------
    // 9. BILLING LIFECYCLE
    // ----------------------------------------------------
    if (
        lower === "make a bill" ||
        lower === "create bill" ||
        lower === "new bill" ||
        lower === "bill"
    ) {
        const bill = createBill(chatId);
        return {
            text: `${bill.message}\nSend \`add <quantity> <product>\` to add items.`,
            type: "bill_created",
            data: bill
        };
    }

    if (
        lower === "show bill" ||
        lower === "view bill" ||
        lower === "current bill" ||
        lower === "check bill"
    ) {
        const activeBillId = getSessionBill(chatId);
        if (!activeBillId) {
            return {
                text: "No active draft bill found. Send `make a bill` to start a new one.",
                type: "info"
            };
        }
        const billData = getBill(activeBillId);
        return {
            text: billData.text,
            type: "bill_preview",
            data: billData
        };
    }

    const addItemMatch = raw.match(/^add\s+(\d+(?:\.\d+)?)\s*(?:kg|kgs|g|litre|l|packets?|pieces?|units?)?\s+(.+)$/i);
    if (addItemMatch && !lower.includes("khata")) {
        let activeBillId = getSessionBill(chatId);
        let createdNotice = "";
        if (!activeBillId) {
            const newBill = createBill(chatId);
            activeBillId = newBill.billId;
            createdNotice = `Created draft bill #${activeBillId}.\n`;
        }

        const quantity = Number(addItemMatch[1]);
        const prodName = addItemMatch[2].trim();

        const res = addItem(activeBillId, prodName, quantity);
        return {
            text: `${createdNotice}${res.message}`,
            type: res.error ? "error" : "item_added",
            data: res
        };
    }

    const removeMatch = raw.match(/^(?:remove|delete)\s+(.+)$/i);
    if (removeMatch) {
        const activeBillId = getSessionBill(chatId);
        if (!activeBillId) {
            return {
                text: "No active draft bill found. Send `make a bill` first.",
                type: "error"
            };
        }
        const prodName = removeMatch[1].trim();
        const res = removeItem(activeBillId, prodName);
        return {
            text: res.message,
            type: res.error ? "error" : "item_removed",
            data: res
        };
    }

    const changeMatch = raw.match(/^(?:change|update|set)\s+(.+?)\s+(?:to|=)\s*(\d+(?:\.\d+)?)$/i);
    if (changeMatch) {
        const activeBillId = getSessionBill(chatId);
        if (!activeBillId) {
            return {
                text: "No active draft bill found. Send `make a bill` first.",
                type: "error"
            };
        }
        const prodName = changeMatch[1].trim();
        const quantity = Number(changeMatch[2]);
        const res = updateItem(activeBillId, prodName, quantity);
        return {
            text: res.message,
            type: res.error ? "error" : "item_updated",
            data: res
        };
    }

    if (lower.startsWith("finalize bill") || lower.startsWith("checkout")) {
        const activeBillId = getSessionBill(chatId);
        if (!activeBillId) {
            return {
                text: "No active draft bill to finalize. Send `make a bill` to begin.",
                type: "error"
            };
        }

        let paymentMode = "UPI";
        if (lower.includes("cash")) paymentMode = "CASH";
        else if (lower.includes("card")) paymentMode = "CARD";
        else if (lower.includes("upi")) paymentMode = "UPI";
        else {
            const savedPref = getPreference("payment_mode", "UPI");
            paymentMode = savedPref.toUpperCase();
        }

        const res = await finalizeBill(activeBillId, paymentMode, chatId);

        return {
            text: res.message,
            type: res.error ? "error" : "bill_finalized",
            data: res,
            invoiceFile: res.invoiceFile,
            invoiceName: res.invoiceName,
            downloadUrl: res.billId ? `/api/invoices/${res.billId}` : null
        };
    }

    // ----------------------------------------------------
    // 10. PREFERENCES
    // ----------------------------------------------------
    const prefMatch = raw.match(/(?:set\s+)?(?:default\s+)?payment(?:_mode)?\s*(?:=|to)?\s*(upi|cash|card)/i);
    if (prefMatch) {
        const mode = prefMatch[1].toUpperCase();
        const res = setPreference("payment_mode", mode);
        return {
            text: `Default payment mode updated to ${mode}.`,
            type: "preference_saved",
            data: res
        };
    }

    // ----------------------------------------------------
    // 11. STOCK INQUIRIES
    // ----------------------------------------------------
    if (
        lower.includes("stock") ||
        lower.includes("how much") ||
        lower.includes("how many") ||
        lower.includes("left") ||
        lower.startsWith("check ")
    ) {
        let productQuery = raw
            .replace(/how\s+much/gi, "")
            .replace(/how\s+many/gi, "")
            .replace(/check\s+stock\s+of/gi, "")
            .replace(/stock\s+of/gi, "")
            .replace(/check\s+/gi, "")
            .replace(/is\s+in\s+stock/gi, "")
            .replace(/in\s+stock/gi, "")
            .replace(/stock/gi, "")
            .replace(/packets?\s+are\s+left/gi, "")
            .replace(/units?\s+are\s+left/gi, "")
            .replace(/are\s+left/gi, "")
            .replace(/left/gi, "")
            .replace(/do\s+we\s+have/gi, "")
            .replace(/is\s+available/gi, "")
            .replace(/available/gi, "")
            .replace(/is\s+/gi, "")
            .replace(/[?.]/gi, "")
            .trim();

        if (!productQuery) {
            return {
                text: "Please specify the product name (e.g. `How much Maggi is in stock?`).",
                type: "error"
            };
        }

        const res = getStock(productQuery);
        return {
            text: res.message,
            type: res.error ? "error" : "stock_info",
            data: res
        };
    }

    return {
        text: "I didn't quite understand that command. Try asking:\n• `How much Maggi is in stock?`\n• `make a bill`\n• `show low stock`\n• `daily close`\n• Or type `help` for full commands list.",
        type: "unknown"
    };
}

module.exports = {
    processCommand,
    parseReceive
};