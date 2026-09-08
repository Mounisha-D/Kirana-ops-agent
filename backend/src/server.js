require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { Telegraf } = require("telegraf");

const { processCommand } = require("./commandProcessor");
const { getAllProducts, receiveStock } = require("./tools/inventory");
const { addProduct } = require("./tools/product");
const {
    createBill,
    getSessionBill,
    addItem,
    updateItem,
    removeItem,
    getBill,
    finalizeBill,
    getAllBills
} = require("./tools/billing");
const {
    getAllCustomers,
    addCredit,
    recordPayment,
    getBalance
} = require("./tools/credit");
const { getDailySummary, getDailyCloseText } = require("./tools/reports");
const { generateDailyReportPptx, REPORTS_DIR } = require("./tools/presentation");
const { INVOICES_DIR } = require("./tools/invoice");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static generated documents (invoices & reports)
app.use("/generated", express.static(path.join(__dirname, "../generated")));

// --------------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------------
app.get("/", (req, res) => {
    res.json({
        message: "Kirana Ops Agent is running!",
        status: "online",
        timestamp: new Date().toISOString()
    });
});

// --------------------------------------------------------
// NATURAL LANGUAGE CHAT API (Rule-based Kirana NLP)
// --------------------------------------------------------
app.post("/api/chat", async (req, res) => {
    try {
        const { message, chatId } = req.body;

        if (!message) {
            return res.status(400).json({
                error: "Message is required"
            });
        }

        const result = await processCommand(message, chatId || "web");

        res.json({
            response: result.text,
            type: result.type,
            data: result.data || null,
            downloadUrl: result.downloadUrl || null,
            invoiceName: result.invoiceName || null,
            reportName: result.reportName || null
        });
    } catch (error) {
        console.error("Chat API error:", error);
        res.status(500).json({
            error: error.message
        });
    }
});

// --------------------------------------------------------
// INVENTORY APIS
// --------------------------------------------------------
app.get("/api/inventory", (req, res) => {
    try {
        const products = getAllProducts();
        res.json({ products });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/inventory/receive", (req, res) => {
    try {
        const { name, quantity, cost, mrp } = req.body;
        if (!name || quantity === undefined || cost === undefined || mrp === undefined) {
            return res.status(400).json({ error: "Missing required fields (name, quantity, cost, mrp)" });
        }
        const result = receiveStock(name, quantity, cost, mrp);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/inventory/product", (req, res) => {
    try {
        const result = addProduct(req.body);
        if (result.error) {
            return res.status(400).json(result);
        }
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --------------------------------------------------------
// BILLING APIS
// --------------------------------------------------------
app.get("/api/bills", (req, res) => {
    try {
        const bills = getAllBills();
        res.json({ bills });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/bills/active", (req, res) => {
    try {
        const chatId = req.query.chatId || "web";
        const activeBillId = getSessionBill(chatId);
        if (!activeBillId) {
            return res.json({ activeBill: null });
        }
        const billData = getBill(activeBillId);
        res.json({ activeBill: billData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/billing/create", (req, res) => {
    try {
        const chatId = req.body.chatId || "web";
        const bill = createBill(chatId);
        res.json(bill);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/billing/item", (req, res) => {
    try {
        const { billId, productName, quantity } = req.body;
        if (!billId || !productName || quantity === undefined) {
            return res.status(400).json({ error: "billId, productName, and quantity are required" });
        }
        const result = addItem(billId, productName, quantity);
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/billing/item", (req, res) => {
    try {
        const { billId, productName, quantity } = req.body;
        const result = updateItem(billId, productName, quantity);
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/billing/item", (req, res) => {
    try {
        const { billId, productName } = req.body;
        const result = removeItem(billId, productName);
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/billing/finalize", async (req, res) => {
    try {
        const { billId, paymentMode, chatId } = req.body;
        if (!billId) {
            return res.status(400).json({ error: "billId is required" });
        }
        const result = await finalizeBill(billId, paymentMode || "UPI", chatId || "web");
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --------------------------------------------------------
// KHATA APIS
// --------------------------------------------------------
app.get("/api/khata", (req, res) => {
    try {
        const customers = getAllCustomers();
        res.json({ customers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/khata/credit", (req, res) => {
    try {
        const { name, amount } = req.body;
        if (!name || !amount) {
            return res.status(400).json({ error: "Customer name and amount required" });
        }
        const result = addCredit(name, amount);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/khata/payment", (req, res) => {
    try {
        const { name, amount } = req.body;
        if (!name || !amount) {
            return res.status(400).json({ error: "Customer name and amount required" });
        }
        const result = recordPayment(name, amount);
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --------------------------------------------------------
// REPORTS & DOCUMENT DOWNLOADS
// --------------------------------------------------------
app.get("/api/reports/daily", (req, res) => {
    try {
        const summary = getDailySummary(req.query.date);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/reports/generate-pptx", async (req, res) => {
    try {
        const report = await generateDailyReportPptx(req.query.date);
        res.download(report.filePath, report.fileName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/reports/download/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(REPORTS_DIR, filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename);
    } else {
        res.status(404).json({ error: "Report file not found" });
    }
});

app.get("/api/invoices/:id", (req, res) => {
    const billId = req.params.id;
    const fileName = `invoice-${billId}.pdf`;
    const filePath = path.join(INVOICES_DIR, fileName);
    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        res.status(404).json({ error: `Invoice for Bill #${billId} not found` });
    }
});

// --------------------------------------------------------
// START HTTP SERVER
// --------------------------------------------------------
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// --------------------------------------------------------
// TELEGRAM BOT (Telegraf)
// --------------------------------------------------------
if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

        bot.start((ctx) => {
            ctx.reply(
                "🏪 Welcome to Nebula Supermarket Ops Agent!\n\n" +
                "I am your automated Kirana store operations assistant.\n\n" +
                "Try commands like:\n" +
                "• How much Maggi is in stock?\n" +
                "• 50 packets of Maggi came in, cost ₹12, MRP ₹14\n" +
                "• new item: Amul Butter 100g, GST 12%, MRP ₹62\n" +
                "• make a bill: 2kg sugar, 4 Maggi, UPI\n" +
                "• show low stock\n" +
                "• daily close\n" +
                "• generate report\n\n" +
                "Type /help anytime to see full capabilities."
            );
        });

        bot.help((ctx) => {
            ctx.reply(
                "📖 Nebula Supermarket Commands:\n\n" +
                "📦 Inventory:\n" +
                "• <product> stock?\n" +
                "• <qty> of <product> came in, cost ₹<cost>, MRP ₹<mrp>\n" +
                "• show low stock\n\n" +
                "🧾 Billing:\n" +
                "• make a bill\n" +
                "• add <qty> <product>\n" +
                "• remove <product>\n" +
                "• change <product> to <qty>\n" +
                "• show bill\n" +
                "• finalize bill UPI (or Cash)\n\n" +
                "📒 Khata:\n" +
                "• Add ₹<amount> to <customer>'s khata\n" +
                "• What is <customer>'s balance?\n" +
                "• <customer> paid ₹<amount>\n\n" +
                "📊 Reports:\n" +
                "• daily close\n" +
                "• generate report (sends PPTX presentation)"
            );
        });

        bot.on("text", async (ctx) => {
            try {
                const message = ctx.message.text;
                const chatId = ctx.chat.id.toString();

                const result = await processCommand(message, chatId);

                // Send response text
                await ctx.reply(result.text);

                // If invoice PDF was generated, dispatch as document
                if (result.invoiceFile && fs.existsSync(result.invoiceFile)) {
                    await ctx.replyWithDocument({
                        source: result.invoiceFile,
                        filename: result.invoiceName || "invoice.pdf"
                    });
                }

                // If PPTX report was generated, dispatch as document
                if (result.reportFile && fs.existsSync(result.reportFile)) {
                    await ctx.replyWithDocument({
                        source: result.reportFile,
                        filename: result.reportName || "daily-report.pptx"
                    });
                }
            } catch (error) {
                console.error("Telegram bot error:", error);
                ctx.reply("Sorry, something went wrong processing your command.");
            }
        });

        bot.launch().then(() => {
            console.log("Telegram bot started!");
        }).catch(err => {
            console.warn("Telegram bot launch warning:", err.message);
        });

        // Graceful shutdown
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));
    } catch (err) {
        console.warn("Telegram initialization skipped:", err.message);
    }
} else {
    console.log("TELEGRAM_BOT_TOKEN not configured.");
}

module.exports = { app, server };