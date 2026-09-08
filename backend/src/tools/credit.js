const db = require("../services/database");

function getCustomer(name) {
    if (!name) return null;
    const clean = name.trim();

    let customer = db.prepare(`
        SELECT * FROM customers
        WHERE LOWER(name) = ?
    `).get(clean.toLowerCase());

    if (!customer) {
        const result = db.prepare(`
            INSERT INTO customers (name)
            VALUES (?)
        `).run(clean);

        customer = {
            id: result.lastInsertRowid,
            name: clean
        };
    }

    return customer;
}

function getBalance(name) {
    const customer = getCustomer(name);
    if (!customer) {
        return {
            error: "Customer name required",
            message: "Customer name is required."
        };
    }

    const result = db.prepare(`
        SELECT
            COALESCE(SUM(
                CASE
                    WHEN type = 'CREDIT' THEN amount
                    ELSE -amount
                END
            ), 0) AS balance
        FROM credit_transactions
        WHERE customer_id = ?
    `).get(customer.id);

    const balance = Number(result.balance);

    return {
        customer: customer.name,
        balance,
        message: `${customer.name}'s outstanding balance: ₹${balance.toFixed(2)}`
    };
}

function addCredit(name, amount) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return {
            error: "Invalid amount",
            message: "Please specify a valid credit amount greater than 0."
        };
    }

    const customer = getCustomer(name);

    db.prepare(`
        INSERT INTO credit_transactions (customer_id, type, amount)
        VALUES (?, 'CREDIT', ?)
    `).run(customer.id, numAmount);

    const balanceObj = getBalance(name);

    return {
        customer: customer.name,
        added: numAmount,
        balance: balanceObj.balance,
        message: `₹${numAmount.toFixed(2)} added to ${customer.name}'s khata. Outstanding balance: ₹${balanceObj.balance.toFixed(2)}`
    };
}

function recordPayment(name, amount) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return {
            error: "Invalid amount",
            message: "Please specify a valid payment amount greater than 0."
        };
    }

    const customer = getCustomer(name);
    const current = getBalance(name);

    if (numAmount > current.balance) {
        return {
            error: "Payment exceeds existing khata balance",
            message: `Payment exceeds existing khata balance. ${customer.name}'s current balance is ₹${current.balance.toFixed(2)}.`
        };
    }

    db.prepare(`
        INSERT INTO credit_transactions (customer_id, type, amount)
        VALUES (?, 'PAYMENT', ?)
    `).run(customer.id, numAmount);

    const updated = getBalance(name);

    return {
        customer: customer.name,
        paid: numAmount,
        balance: updated.balance,
        message: `${customer.name}'s remaining balance: ₹${updated.balance.toFixed(2)}`
    };
}

function getAllCustomers() {
    return db.prepare(`
        SELECT
            c.id,
            c.name,
            COALESCE(SUM(
                CASE WHEN ct.type = 'CREDIT' THEN ct.amount ELSE -ct.amount END
            ), 0) as balance,
            MAX(ct.created_at) as last_transaction
        FROM customers c
        LEFT JOIN credit_transactions ct ON ct.customer_id = c.id
        GROUP BY c.id
        ORDER BY balance DESC, c.name ASC
    `).all();
}

module.exports = {
    getCustomer,
    getBalance,
    addCredit,
    recordPayment,
    getAllCustomers
};