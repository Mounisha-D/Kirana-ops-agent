# Nebula KnowLab — Supermarket Ops Agent 🏪

An AI-style conversational supermarket and Kirana store management system built with **Node.js, Express, SQLite (better-sqlite3), Telegraf (Telegram Bot), and React.js**.

> [!IMPORTANT]
> **Zero External AI APIs**: This system is 100% deterministic and rule-based. It does **NOT** rely on OpenAI, Ollama, Anthropic, or any third-party AI APIs. All natural language Kirana commands, ambiguities, and units are parsed using custom rule-based NLP engines.

---

## 📑 Table of Contents
1. [Executive Overview](#executive-overview)
2. [Key Capabilities & Features](#key-capabilities--features)
3. [System Architecture](#system-architecture)
4. [Tech Stack](#tech-stack)
5. [Database Schema & Integrity](#database-schema--integrity)
6. [Business Guardrails & Fiscal Rules](#business-guardrails--fiscal-rules)
7. [Installation & Setup](#installation--setup)
8. [Running the Application](#running-the-application)
9. [Telegram Bot Integration](#telegram-bot-integration)
10. [REST API Documentation](#rest-api-documentation)
11. [Conversational Command Guide](#conversational-command-guide)
12. [Automated Test Suite](#automated-test-suite)
13. [Document Generation (PDF & PPTX)](#document-generation-pdf--pptx)

---

## 1. Executive Overview

Small Indian Kirana stores and supermarkets operate in fast-paced retail environments where counter space and time are at a premium. **Nebula KnowLab — Supermarket Ops Agent** empowers the shop owner to communicate naturally through **Telegram** and a unified **React Operations Dashboard**. 

The shop owner can check stock levels, log inbound inventory shipments, assemble customer bills, update quantities, enforce GST splits, track customer credit (Khata), print compliant PDF invoices, and generate 6-slide executive PowerPoint decks on demand.

---

## 2. Key Capabilities & Features

### 📦 Inventory Management
- **Stock Queries**: Natural queries like *"How much Maggi is in stock?"*, *"Maggi stock"*, *"Check stock of Sugar"*.
- **Inbound Shipments**: Parse natural shipments such as *"50 packets of Maggi came in, cost ₹12, MRP ₹14"*.
- **Dynamic Product Creation**: Add products with custom units and GST slabs: *"new item: Amul Butter 100g, GST 12%, MRP ₹62"*.
- **Low Stock & Reorder**: Real-time alerts when `stock <= reorder_level`.
- **Stock Movement Audit Log**: Every addition, checkout, and adjustment is recorded with timestamps and unit costs.

### 🧾 POS & Billing Terminal
- **Draft Isolation**: Stock is **NEVER** deducted when items are added to a draft bill. Stock is decremented only upon atomic finalization.
- **Incremental & Composite Commands**: Supports step-by-step editing (`make a bill`, `add 2 sugar`, `change Maggi to 5`, `remove Maggi`) as well as single-shot multi-item checkout (`make a bill: 2kg sugar, 1 Aashirvaad atta 5kg, 4 Maggi, UPI`).
- **Oversell Prevention**: Real-time validation preventing addition or finalization if requested quantity exceeds current on-shelf stock.
- **Below-Cost Safeguard**: Rejects selling any item below its cost price (`selling_price < cost_price`).
- **GST Breakdown**: Automatically splits GST 50:50 into Central GST (CGST) and State GST (SGST).

### 📒 Customer Khata (Credit Ledger)
- **Credit Assignment**: *"Add ₹500 to Ravi's khata"*.
- **Balance Checks**: *"What is Ravi's balance?"* or *"How much does Ravi owe?"*.
- **Repayment Tracking**: *"Ravi paid ₹200"*.
- **Overpayment Guard**: Enforces strict ledger integrity by blocking payments exceeding current outstanding balance.

### 📊 Document Generation & Intelligence
- **PDF Tax Invoices**: Automatically generated upon bill finalization using `PDFKit` with store header, GSTIN, HSN codes, tax summary, and totals.
- **PPTX Executive Presentations**: Generates 6-slide daily operations PowerPoint reports using `PptxGenJS` (Revenue, Tax breakdown, Payment channels, Fast movers, Low-stock alerts, and Strategic recommendations).
- **Telegram Direct File Dispatch**: Bot uploads `.pdf` invoices and `.pptx` presentations directly into the owner's Telegram chat.

---

## 3. System Architecture

```text
                           SHOP OWNER / OPERATOR
                          /                     \
                 (Telegram Bot)            (React Web Dashboard)
                       |                             |
              [Telegraf Engine]             [Vite React App]
                       \                             /
                        v                           v
                       -------------------------------
                       |    COMMAND PROCESSOR        |
                       |   (Rule-based Kirana NLP)   |
                       -------------------------------
                                      |
         -----------------------------------------------------------
         |                 |                   |                   |
         v                 v                   v                   v
     Inventory          Billing              Khata            Preferences
         |                 |                   |                   |
         -----------------------------------------------------------
                                      |
                                      v
                             [SQLite Database]
                        (WAL Mode, Atomic Transactions)
                                      |
         -----------------------------------------------------------
         |                                                         |
         v                                                         v
    [PDFKit Engine]                                       [PptxGenJS Engine]
   (Tax Invoices PDF)                                    (Executive Deck PPTX)
```

---

## 4. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend Runtime** | Node.js (v22+) | High-performance asynchronous execution |
| **Web Server** | Express.js 5.x | REST API endpoints & static document hosting |
| **Database** | SQLite + `better-sqlite3` | Embedded, zero-maintenance database with WAL mode |
| **NLP Engine** | Custom Regex Tokenizer | Deterministic, rule-based natural language parsing |
| **Telegram Bot** | `telegraf` | Official Telegram Bot API framework |
| **PDF Generation** | `pdfkit` | Compliant GST invoice generation |
| **Presentation Deck** | `pptxgenjs` | 6-slide executive daily report generation |
| **Frontend UI** | React.js 19 + Vite 8 | Real-time supermarket operations dashboard |
| **Icons & Styling** | `lucide-react` | Clean, modern retail interface |

---

## 5. Database Schema & Integrity

The system maintains 8 relational tables inside `kirana.db`:

```sql
-- Inventory Items
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    unit TEXT NOT NULL,
    cost_price REAL NOT NULL,
    sell_price REAL NOT NULL,
    mrp REAL NOT NULL,
    gst_rate REAL NOT NULL,
    hsn_code TEXT,
    stock REAL DEFAULT 0,
    reorder_level REAL DEFAULT 5
);

-- Invoices & Bills
CREATE TABLE bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT' or 'FINALIZED'
    payment_mode TEXT,
    subtotal REAL DEFAULT 0,
    cgst REAL DEFAULT 0,
    sgst REAL DEFAULT 0,
    total REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Bill Line Items
CREATE TABLE bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    gst_rate REAL NOT NULL,
    FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Customer Khata Directory
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- Credit Ledger Transactions
CREATE TABLE credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'CREDIT' or 'PAYMENT'
    amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
);

-- Store Key-Value Preferences
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Chat/Terminal Sessions (Isolated Drafts)
CREATE TABLE sessions (
    chat_id TEXT PRIMARY KEY,
    current_bill_id INTEGER
);

-- Complete Audit Trail of All Stock In/Out
CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'RECEIVED', 'SOLD', 'ADJUSTMENT'
    quantity REAL NOT NULL,
    cost REAL,
    mrp REAL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
);
```

---

## 6. Business Guardrails & Fiscal Rules

1. **Atomic Concurrency Protection**: 
   Finalization wraps inventory stock re-verification and deduction inside a single SQLite atomic `db.transaction()`. If two terminals attempt to finalize the last item simultaneously, only one succeeds and the other is safely rolled back.
2. **Idempotent Checkout**:
   Submitting a finalization request for an already finalized bill returns the existing summary and invoice without deducting inventory a second time.
3. **Draft Bill Isolation**:
   Adding items to a draft bill does **NOT** decrement `products.stock`. Stock decreases strictly after finalization.
4. **Below-Cost Protection**:
   Attempting to add or sell any item where `sell_price < cost_price` is blocked with a clear warning message.
5. **Khata Overpayment Rejection**:
   Payments cannot exceed current outstanding debt. If Ravi owes ₹500, a payment of ₹600 is rejected with `Payment exceeds existing khata balance`.
6. **GST Split**:
   GST is divided equally into CGST (50%) and SGST (50%) on each taxable line item.

---

## 7. Installation & Setup

### Prerequisites
- Node.js v18+ (tested on v22.19.0)
- npm v9+

### Step 1: Clone or Navigate to Project
```powershell
cd C:\Users\User\Desktop\kirana-ops-agent
```

### Step 2: Install Backend Dependencies
```powershell
cd backend
npm install
```

### Step 3: Install Frontend Dependencies
```powershell
cd ../frontend
npm install
```

### Step 4: Configure Environment Variables
Inside `backend/.env`:
```env
PORT=5000
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
```

---

## 8. Running the Application

### Start the Backend Server (Port 5000)
```powershell
cd C:\Users\User\Desktop\kirana-ops-agent\backend
node src/server.js
```
Output:
```text
Server running on http://localhost:5000
Telegram bot started!
```

### Start the React Frontend Dashboard (Port 5173)
Open a second terminal window:
```powershell
cd C:\Users\User\Desktop\kirana-ops-agent\frontend
npm run dev
```
Navigate to: `http://localhost:5173`

---


## 9. REST API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service health status |
| `POST` | `/api/chat` | Natural language Kirana command execution (`{ message, chatId }`) |
| `GET` | `/api/inventory` | All products, current stocks, units, and low-stock flags |
| `POST` | `/api/inventory/receive` | Inbound stock reception (`{ name, quantity, cost, mrp }`) |
| `POST` | `/api/inventory/product` | Create new product |
| `GET` | `/api/bills` | History of all bills with line items |
| `GET` | `/api/bills/active?chatId=web` | Active draft bill for current terminal session |
| `POST` | `/api/billing/create` | Start new draft bill |
| `POST` | `/api/billing/item` | Add item to draft bill |
| `PUT` | `/api/billing/item` | Update item quantity in draft bill |
| `DELETE` | `/api/billing/item` | Remove item from draft bill |
| `POST` | `/api/billing/finalize` | Finalize bill (`{ billId, paymentMode, chatId }`) |
| `GET` | `/api/khata` | All customer accounts and outstanding balances |
| `POST` | `/api/khata/credit` | Add customer credit (`{ name, amount }`) |
| `POST` | `/api/khata/payment` | Record customer payment (`{ name, amount }`) |
| `GET` | `/api/reports/daily` | Today's sales, taxes, payment breakdown, and top products |
| `GET` | `/api/reports/generate-pptx` | Generates and downloads the 6-slide `.pptx` report |
| `GET` | `/api/invoices/:id` | Downloads the generated PDF tax invoice |

---

## 11. Conversational Command Guide

### Stock Checks
- `How much Maggi is in stock?`
- `Maggi stock`
- `Check stock of Sugar`
- `show low stock`

### Receiving Inbound Stock
- `50 packets of Maggi came in, cost ₹12, MRP ₹14`
- `receive 20 Maggi cost 11 mrp 14`

### Adding Products
- `new item: Amul Butter 100g, GST 12%, MRP ₹62`
- `new item: Amul Cheese 200g, GST 12%, MRP ₹120`

### Billing Operations
- `make a bill`
- `add 2 sugar`
- `add 4 Maggi`
- `change Maggi to 5`
- `remove Maggi`
- `show bill`
- `finalize bill UPI` (or `Cash` / `Card`)
- Composite One-Shot: `make a bill: 2kg sugar, 1 Aashirvaad atta 5kg, 4 Maggi, UPI`

### Customer Khata (Credit)
- `Add ₹500 to Ravi's khata`
- `What is Ravi's balance?`
- `Ravi paid ₹200`

### Reports & Presentations
- `daily close`
- `generate report`

---

## 12. Automated Test Suite

A comprehensive end-to-end test suite is included in `backend/test-suite.js`. It validates 22 distinct assertions covering every tool, rule, and document generation pipeline.

### Run Tests:
```powershell
cd backend
node test-suite.js
```

### Test Coverage Summary:
- ✅ Stock inquiry pattern matching
- ✅ Stock receipt & audit logging
- ✅ Dynamic product creation with GST slabs
- ✅ Draft bill isolation (stock unchanged during drafting)
- ✅ Bill finalization and stock reduction
- ✅ PDF invoice generation and validation
- ✅ Idempotency (preventing double checkout)
- ✅ Oversell protection
- ✅ Khata credit addition and balance reporting
- ✅ Khata overpayment prevention
- ✅ Low-stock detection
- ✅ Daily close aggregation
- ✅ PPTX presentation creation (6 slides)
- ✅ Composite one-shot bill parsing and checkout

---

## 13. Document Generation (PDF & PPTX)

### PDF Invoice (`backend/generated/invoices/`)
- Tax Invoice Number (`INV-XXXXX`)
- Store Header, GSTIN, and Address
- Itemized table with HSN codes, Rate, GST %, and Line Totals
- 50:50 CGST and SGST breakdown
- Grand Total and payment mode
- Customer appreciation footer

### Executive PPTX Presentation (`backend/generated/reports/`)
- **Slide 1**: Executive Title & Metric Badges
- **Slide 2**: Financial Performance (Subtotal, GST, Net Sales, Average Ticket)
- **Slide 3**: Payment Mode Breakdown (UPI vs Cash vs Card)
- **Slide 4**: Top Selling Products Leaderboard
- **Slide 5**: Inventory Audit & Low-Stock Reorder Triggers
- **Slide 6**: Operations Playbook, Khata Health & Morning Checklist
