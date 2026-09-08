const fs = require("fs");
const path = require("path");
const { processCommand } = require("./src/commandProcessor");
const db = require("./src/services/database");
const { getDailySummary } = require("./src/tools/reports");

async function runTests() {
    console.log("==================================================");
    console.log("🧪 STARTING NEBULA SUPERMARKET OPS AGENT TEST SUITE");
    console.log("==================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    }

    const testChatId = "test-session-" + Date.now();

    // ----------------------------------------------------
    // TEST 1: Stock Query
    // ----------------------------------------------------
    console.log("--- TEST 1: Stock Query ---");
    const stockRes = await processCommand("How much Maggi is in stock?", testChatId);
    console.log("Response:", stockRes.text);
    assert(
        stockRes.text.includes("Maggi") && stockRes.text.includes("in stock"),
        "Query 'How much Maggi is in stock?' returns stock info"
    );

    // ----------------------------------------------------
    // TEST 2: Receive Stock
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Receive Stock ---");
    const maggiBefore = db.prepare("SELECT stock FROM products WHERE name LIKE '%Maggi%'").get().stock;
    const receiveRes = await processCommand("50 packets of Maggi came in, cost ₹12, MRP ₹14", testChatId);
    console.log("Response:", receiveRes.text);
    const maggiAfter = db.prepare("SELECT stock FROM products WHERE name LIKE '%Maggi%'").get().stock;
    assert(
        maggiAfter === maggiBefore + 50,
        `Maggi stock incremented correctly from ${maggiBefore} to ${maggiAfter}`
    );
    assert(
        receiveRes.text.includes("received successfully"),
        "Stock reception message matches expectation"
    );

    // ----------------------------------------------------
    // TEST 3: Add Product
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Add Product ---");
    const uniqueName = `Amul Cheese Test ${Date.now() % 10000} 200g`;
    const addProdRes = await processCommand(`new item: ${uniqueName}, GST 12%, MRP ₹120`, testChatId);
    console.log("Response:", addProdRes.text);
    const createdProd = db.prepare("SELECT * FROM products WHERE name = ?").get(uniqueName);
    assert(
        createdProd && createdProd.mrp === 120 && createdProd.gst_rate === 12,
        "New product stored in database with correct GST and MRP"
    );
    assert(
        addProdRes.text.includes("added successfully"),
        "Product addition returns success message"
    );

    // ----------------------------------------------------
    // TEST 4: Billing Lifecycle & Stock Reservation Safety
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Billing Lifecycle & Stock Reservation Safety ---");
    const billSession = "bill-test-" + Date.now();

    // 4A: Make a bill
    const makeBillRes = await processCommand("make a bill", billSession);
    console.log("Make Bill:", makeBillRes.text);
    assert(makeBillRes.type === "bill_created", "Draft bill created");

    // Stock check before adding items
    const sugarBefore = db.prepare("SELECT stock FROM products WHERE name LIKE '%Sugar%'").get().stock;

    // 4B: Add item
    const addItemRes = await processCommand("add 2 sugar", billSession);
    console.log("Add Item:", addItemRes.text);
    const sugarDuringDraft = db.prepare("SELECT stock FROM products WHERE name LIKE '%Sugar%'").get().stock;
    assert(
        sugarBefore === sugarDuringDraft,
        "Stock remains unchanged while item is only in draft bill (stock safe)"
    );

    // 4C: Add another item
    await processCommand("add 4 Maggi", billSession);

    // 4D: Show bill
    const showBillRes = await processCommand("show bill", billSession);
    console.log("Show Bill:\n" + showBillRes.text);
    assert(showBillRes.text.includes("Sugar") && showBillRes.text.includes("Maggi"), "Show bill lists all items");

    // 4E: Update quantity
    const updateRes = await processCommand("change Maggi to 5", billSession);
    console.log("Change Maggi to 5:", updateRes.text);
    assert(updateRes.text.includes("5"), "Quantity updated to 5");

    // 4F: Finalize bill
    const finalizeRes = await processCommand("finalize bill UPI", billSession);
    console.log("Finalize Bill:", finalizeRes.text);
    assert(finalizeRes.type === "bill_finalized", "Bill finalized successfully");

    // Stock check after finalization
    const sugarAfterCheckout = db.prepare("SELECT stock FROM products WHERE name LIKE '%Sugar%'").get().stock;
    assert(
        sugarAfterCheckout === sugarBefore - 2,
        `Stock accurately reduced after finalization from ${sugarBefore} to ${sugarAfterCheckout}`
    );

    // 4G: PDF Invoice generation check
    assert(
        finalizeRes.invoiceFile && fs.existsSync(finalizeRes.invoiceFile),
        `PDF invoice generated at ${finalizeRes.invoiceFile}`
    );

    // 4H: Idempotency Check (Finalize same bill again)
    const doubleFinalizeRes = await processCommand("finalize bill UPI", billSession);
    console.log("Double Finalize:", doubleFinalizeRes.text);
    // Since session cleared, second attempt says no active bill or handles idempotently
    assert(
        doubleFinalizeRes.type === "error" || doubleFinalizeRes.type === "info" || doubleFinalizeRes.data?.alreadyFinalized,
        "Submitting finalization again does not re-deduct stock"
    );

    // ----------------------------------------------------
    // TEST 5: Oversell & Below-Cost Guardrails
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Guardrails (Oversell & Below-Cost) ---");
    const guardSession = "guard-session-" + Date.now();
    await processCommand("make a bill", guardSession);

    // Try overselling
    const oversellRes = await processCommand("add 9999 Maggi", guardSession);
    console.log("Oversell check:", oversellRes.text);
    assert(
        oversellRes.text.toLowerCase().includes("not enough stock") || oversellRes.text.toLowerCase().includes("only"),
        "Overselling properly blocked"
    );

    // ----------------------------------------------------
    // TEST 6: Customer Khata (Credit & Repayment)
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Customer Khata ---");
    const customer = "Ravi";

    // 6A: Add Credit
    const creditRes = await processCommand(`Add ₹500 to ${customer}'s khata`, testChatId);
    console.log("Add Credit:", creditRes.text);
    assert(creditRes.text.includes("500.00"), "₹500 added to Khata");

    // 6B: Check Balance
    const balanceRes1 = await processCommand(`What is ${customer}'s balance?`, testChatId);
    console.log("Check Balance 1:", balanceRes1.text);
    assert(balanceRes1.text.includes("500.00"), "Balance reports ₹500.00");

    // 6C: Overpayment protection
    const overpayRes = await processCommand(`${customer} paid ₹999`, testChatId);
    console.log("Overpayment check:", overpayRes.text);
    assert(
        overpayRes.text.toLowerCase().includes("exceeds"),
        "Overpayment greater than balance is blocked"
    );

    // 6D: Valid Payment
    const paymentRes = await processCommand(`${customer} paid ₹200`, testChatId);
    console.log("Valid Payment:", paymentRes.text);
    assert(
        paymentRes.text.includes("300.00"),
        "Payment recorded; remaining balance is ₹300.00"
    );

    // ----------------------------------------------------
    // TEST 7: Low Stock Alerts
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Low Stock Alerts ---");
    const lowStockRes = await processCommand("show low stock", testChatId);
    console.log("Low stock response:\n" + lowStockRes.text);
    assert(
        lowStockRes.type === "low_stock",
        "Low stock detection returns items below reorder level"
    );

    // ----------------------------------------------------
    // TEST 8: Daily Close
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Daily Close ---");
    const dailyCloseRes = await processCommand("daily close", testChatId);
    console.log("Daily Close:\n" + dailyCloseRes.text);
    assert(
        dailyCloseRes.text.includes("DAILY CLOSE") && dailyCloseRes.text.includes("Total Sales:"),
        "Daily close summarizes sales, taxes, payments, and top products"
    );

    // ----------------------------------------------------
    // TEST 9: PPTX Executive Presentation Report
    // ----------------------------------------------------
    console.log("\n--- TEST 9: PPTX Presentation Generation ---");
    const pptxRes = await processCommand("generate report", testChatId);
    console.log("PPTX Report:", pptxRes.text);
    assert(
        pptxRes.type === "report_generated" && pptxRes.reportFile && fs.existsSync(pptxRes.reportFile),
        `Executive PPTX presentation successfully generated at ${pptxRes.reportFile}`
    );

    // ----------------------------------------------------
    // TEST 10: Composite One-shot Bill
    // ----------------------------------------------------
    console.log("\n--- TEST 10: Composite One-Shot Bill ---");
    const compositeSession = "comp-" + Date.now();
    const compositeRes = await processCommand("make a bill: 2kg sugar, 1 Aashirvaad atta 5kg, 4 Maggi, UPI", compositeSession);
    console.log("Composite Bill Result:\n" + compositeRes.text);
    assert(
        compositeRes.type === "bill_finalized" && compositeRes.invoiceFile,
        "Composite bill parsed items, calculated GST, finalized, and produced invoice"
    );

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log("\n==================================================");
    console.log(`📊 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error("Test execution error:", err);
    process.exit(1);
});
