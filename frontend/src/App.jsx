import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Store,
  MessageSquare,
  ShoppingCart,
  Package,
  BookOpen,
  BarChart3,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  FileSpreadsheet
} from "lucide-react";
import "./App.css";

const API_BASE = "";

function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [loading, setLoading] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalBills: 0,
    lowStockCount: 0,
    khataOutstanding: 0
  });

  // Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "agent",
      text: "👋 Welcome to Nebula Supermarket Ops Agent!\nAsk me about stock, billing, customer khata, daily close, or generating reports.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef(null);

  // POS State
  const [activeBill, setActiveBill] = useState(null);
  const [posProduct, setPosProduct] = useState("");
  const [posQuantity, setPosQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [lastInvoice, setLastInvoice] = useState(null);

  // Inventory State
  const [inventory, setInventory] = useState([]);
  const [stockSearch, setStockSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Khata State
  const [khataList, setKhataList] = useState([]);

  // Reports State
  const [dailySummary, setDailySummary] = useState(null);

  // Modals
  const [receiveModal, setReceiveModal] = useState({
    isOpen: false,
    name: "",
    quantity: 10,
    cost: 10,
    mrp: 14
  });

  const [newProductModal, setNewProductModal] = useState({
    isOpen: false,
    name: "",
    unit: "piece",
    cost_price: 10,
    mrp: 15,
    gst_rate: 5,
    stock: 20,
    reorder_level: 5
  });

  const [creditModal, setCreditModal] = useState({
    isOpen: false,
    name: "",
    amount: 500
  });

  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    name: "",
    amount: 200,
    maxBalance: 0
  });

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Initial Data Load
  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = async () => {
    try {
      setLoading(true);
      const [invRes, billRes, khataRes, repRes] = await Promise.all([
        axios.get(`${API_BASE}/api/inventory`),
        axios.get(`${API_BASE}/api/bills/active?chatId=web`),
        axios.get(`${API_BASE}/api/khata`),
        axios.get(`${API_BASE}/api/reports/daily`)
      ]);

      setInventory(invRes.data.products || []);
      setActiveBill(billRes.data.activeBill || null);
      setKhataList(khataRes.data.customers || []);
      setDailySummary(repRes.data || null);

      if (repRes.data) {
        setMetrics({
          totalSales: repRes.data.totalSales || 0,
          totalBills: repRes.data.totalBills || 0,
          lowStockCount: repRes.data.lowStockCount || 0,
          khataOutstanding: repRes.data.khataOutstanding || 0
        });
      }
    } catch (err) {
      console.error("Failed to fetch store data:", err);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Chat Handlers
  // --------------------------------------------------
  const sendChatMessage = async (msgText) => {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim()) return;

    const userMsg = {
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!msgText) setChatInput("");

    try {
      const res = await axios.post(`${API_BASE}/api/chat`, {
        message: textToSend,
        chatId: "web"
      });

      const agentMsg = {
        sender: "agent",
        text: res.data.response,
        downloadUrl: res.data.downloadUrl,
        invoiceName: res.data.invoiceName,
        reportName: res.data.reportName,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages((prev) => [...prev, agentMsg]);
      refreshAllData();
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: `⚠️ Error: ${err.response?.data?.error || err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // --------------------------------------------------
  // POS / Billing Handlers
  // --------------------------------------------------
  const createNewBill = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/billing/create`, { chatId: "web" });
      const activeRes = await axios.get(`${API_BASE}/api/bills/active?chatId=web`);
      setActiveBill(activeRes.data.activeBill);
      setLastInvoice(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const addItemToBill = async (e) => {
    e.preventDefault();
    if (!posProduct) {
      alert("Please select a product");
      return;
    }

    let billId = activeBill?.bill?.id;
    if (!billId) {
      const newBill = await axios.post(`${API_BASE}/api/billing/create`, { chatId: "web" });
      billId = newBill.data.billId;
    }

    try {
      await axios.post(`${API_BASE}/api/billing/item`, {
        billId,
        productName: posProduct,
        quantity: Number(posQuantity)
      });
      const activeRes = await axios.get(`${API_BASE}/api/bills/active?chatId=web`);
      setActiveBill(activeRes.data.activeBill);
      setPosQuantity(1);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const updateItemQty = async (productName, newQty) => {
    if (!activeBill) return;
    try {
      if (newQty <= 0) {
        await axios.delete(`${API_BASE}/api/billing/item`, {
          data: { billId: activeBill.bill.id, productName }
        });
      } else {
        await axios.put(`${API_BASE}/api/billing/item`, {
          billId: activeBill.bill.id,
          productName,
          quantity: newQty
        });
      }
      const activeRes = await axios.get(`${API_BASE}/api/bills/active?chatId=web`);
      setActiveBill(activeRes.data.activeBill);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const finalizeCurrentBill = async () => {
    if (!activeBill) return;
    try {
      const res = await axios.post(`${API_BASE}/api/billing/finalize`, {
        billId: activeBill.bill.id,
        paymentMode,
        chatId: "web"
      });
      setLastInvoice(res.data);
      setActiveBill(null);
      refreshAllData();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // --------------------------------------------------
  // Modal Actions (Stock, Products, Khata)
  // --------------------------------------------------
  const handleReceiveStock = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/inventory/receive`, {
        name: receiveModal.name,
        quantity: Number(receiveModal.quantity),
        cost: Number(receiveModal.cost),
        mrp: Number(receiveModal.mrp)
      });
      setReceiveModal({ isOpen: false, name: "", quantity: 10, cost: 10, mrp: 14 });
      refreshAllData();
      alert("Stock received successfully!");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/inventory/product`, newProductModal);
      setNewProductModal({
        isOpen: false,
        name: "",
        unit: "piece",
        cost_price: 10,
        mrp: 15,
        gst_rate: 5,
        stock: 20,
        reorder_level: 5
      });
      refreshAllData();
      alert("Product created successfully!");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleAddCredit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/khata/credit`, {
        name: creditModal.name,
        amount: Number(creditModal.amount)
      });
      setCreditModal({ isOpen: false, name: "", amount: 500 });
      refreshAllData();
      alert(`₹${creditModal.amount} added to ${creditModal.name}'s khata!`);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amountNum = Number(paymentModal.amount);
    if (amountNum > paymentModal.maxBalance) {
      alert(`Payment cannot exceed outstanding balance of ₹${paymentModal.maxBalance.toFixed(2)}`);
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/khata/payment`, {
        name: paymentModal.name,
        amount: amountNum
      });
      setPaymentModal({ isOpen: false, name: "", amount: 200, maxBalance: 0 });
      refreshAllData();
      alert(`Payment of ₹${amountNum} recorded successfully!`);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Filtered inventory
  const filteredInventory = inventory.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(stockSearch.toLowerCase());
    const matchesLowStock = lowStockOnly ? p.is_low_stock === 1 : true;
    return matchesSearch && matchesLowStock;
  });

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo">N</div>
          <div>
            <div className="brand-title">
              Nebula KnowLab
              <span className="brand-subtitle">Supermarket Ops Agent</span>
            </div>
          </div>
        </div>

        <div className="nav-badges">
          <div className="badge-pill badge-online">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span>
            SQLite WAL Active
          </div>
          <div className="badge-pill badge-telegram">
            🤖 @KiranaOpsAgent2026_bot
          </div>
          <button className="btn-secondary" onClick={refreshAllData} title="Refresh live data">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Sync
          </button>
        </div>
      </header>

      {/* Quick Metrics Banner */}
      <section className="metrics-banner">
        <div className="metric-card">
          <div className="metric-info">
            <h4>Today's Sales</h4>
            <div className="metric-value">₹{Number(metrics.totalSales).toFixed(2)}</div>
          </div>
          <div className="metric-icon-box icon-sales">
            <Store size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Finalized Bills</h4>
            <div className="metric-value">{metrics.totalBills}</div>
          </div>
          <div className="metric-icon-box icon-bills">
            <ShoppingCart size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Low Stock Alerts</h4>
            <div className="metric-value" style={{ color: metrics.lowStockCount > 0 ? "#ef4444" : "#0f172a" }}>
              {metrics.lowStockCount}
            </div>
          </div>
          <div className="metric-icon-box icon-stock">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Khata Outstanding</h4>
            <div className="metric-value" style={{ color: metrics.khataOutstanding > 0 ? "#d97706" : "#0f172a" }}>
              ₹{Number(metrics.khataOutstanding).toFixed(2)}
            </div>
          </div>
          <div className="metric-icon-box icon-khata">
            <BookOpen size={24} />
          </div>
        </div>
      </section>

      {/* Main Tab Navigation */}
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare size={16} />
          AI Ops Assistant
        </button>

        <button
          className={`tab-btn ${activeTab === "pos" ? "active" : ""}`}
          onClick={() => setActiveTab("pos")}
        >
          <ShoppingCart size={16} />
          POS Billing Terminal
          {activeBill && activeBill.items?.length > 0 && (
            <span style={{ background: "#2563eb", color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 10 }}>
              {activeBill.items.length}
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          <Package size={16} />
          Inventory & Stock
          {metrics.lowStockCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 10 }}>
              {metrics.lowStockCount}
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === "khata" ? "active" : ""}`}
          onClick={() => setActiveTab("khata")}
        >
          <BookOpen size={16} />
          Customer Khata
        </button>

        <button
          className={`tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <BarChart3 size={16} />
          Daily Close & Reports
        </button>
      </nav>

      {/* Tab Contents Area */}
      <main className="tab-content-area">
        {/* ---------------------------------------------------- */}
        {/* TAB 1: AI OPS CHAT ASSISTANT                         */}
        {/* ---------------------------------------------------- */}
        {activeTab === "chat" && (
          <div className="chat-container">
            <div className="chat-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Store size={20} color="#2563eb" />
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Kirana Conversational Ops Assistant</h3>
                  <p style={{ fontSize: 12, color: "#64748b" }}>Rule-based Kirana NLP Engine • Zero External AI API</p>
                </div>
              </div>
              <span className="badge-pill badge-online">Ready</span>
            </div>

            <div className="chat-messages">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`message-bubble ${msg.sender === "user" ? "message-user" : "message-agent"}`}
                >
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                    {msg.sender === "user" ? "Shop Owner" : "Ops Agent"} • {msg.timestamp}
                  </div>
                  <div>{msg.text}</div>

                  {msg.downloadUrl && (
                    <a
                      href={msg.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="message-download-btn"
                    >
                      <Download size={14} />
                      {msg.reportName ? `Download Presentation (${msg.reportName})` : `Download PDF Invoice`}
                    </a>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Bar */}
            <div className="quick-prompts-bar">
              <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center", fontWeight: 600 }}>Quick:</span>
              <button className="prompt-chip" onClick={() => sendChatMessage("How much Maggi is in stock?")}>
                🔍 Maggi stock?
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("show low stock")}>
                ⚠️ Show low stock
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("50 packets of Maggi came in, cost ₹12, MRP ₹14")}>
                📥 Receive 50 Maggi
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("make a bill: 2kg sugar, 4 Maggi, UPI")}>
                🧾 Make bill (Sugar + Maggi)
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("Add ₹500 to Ravi's khata")}>
                📒 Add ₹500 to Ravi
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("What is Ravi's balance?")}>
                💰 Ravi balance?
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("daily close")}>
                📊 Daily Close
              </button>
              <button className="prompt-chip" onClick={() => sendChatMessage("generate report")}>
                📑 Generate PPTX
              </button>
            </div>

            {/* Chat Input */}
            <form
              className="chat-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage();
              }}
            >
              <input
                type="text"
                className="chat-input-box"
                placeholder="Ask in natural language e.g. 'How much Maggi is in stock?' or 'make a bill'..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                <Send size={16} />
                Send
              </button>
            </form>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: POS BILLING TERMINAL                          */}
        {/* ---------------------------------------------------- */}
        {activeTab === "pos" && (
          <div className="pos-layout">
            {/* Left: Bill Builder & Items */}
            <div className="card">
              <div className="card-title">
                <span>
                  🧾 Active Bill {activeBill ? `#${activeBill.bill.id}` : "(No draft)"}
                </span>
                {!activeBill ? (
                  <button className="btn-primary" onClick={createNewBill}>
                    <Plus size={16} /> Start New Bill
                  </button>
                ) : (
                  <button className="btn-secondary" onClick={createNewBill}>
                    Reset / New
                  </button>
                )}
              </div>

              {/* Add item form */}
              <form onSubmit={addItemToBill} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <select
                  className="form-control"
                  style={{ flex: 2 }}
                  value={posProduct}
                  onChange={(e) => setPosProduct(e.target.value)}
                >
                  <option value="">-- Select Product --</option>
                  {inventory.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} (Stock: {p.stock} {p.unit} | ₹{p.sell_price})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0.1"
                  step="any"
                  className="form-control"
                  style={{ width: 100 }}
                  value={posQuantity}
                  onChange={(e) => setPosQuantity(e.target.value)}
                  placeholder="Qty"
                />

                <button type="submit" className="btn-primary">
                  <Plus size={16} /> Add
                </button>
              </form>

              {/* Items Table */}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: "right" }}>Rate</th>
                    <th style={{ textAlign: "center" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>GST</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!activeBill || activeBill.items?.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                        No items added to draft bill yet.
                      </td>
                    </tr>
                  ) : (
                    activeBill.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.name}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>HSN: {item.hsn_code || "N/A"}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>₹{Number(item.price).toFixed(2)}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: "2px 8px" }}
                              onClick={() => updateItemQty(item.name, item.quantity - 1)}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: 600 }}>{item.quantity}</span>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: "2px 8px" }}
                              onClick={() => updateItemQty(item.name, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>{item.gst_rate}%</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          ₹{(item.item_subtotal + item.item_gst).toFixed(2)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                            onClick={() => updateItemQty(item.name, 0)}
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Right: Checkout & Tax Breakdown */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="card-title">
                  <span>💰 Tax & Settlement</span>
                </div>

                <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Taxable Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(activeBill?.bill?.subtotal || 0).toFixed(2)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Central GST (CGST):</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(activeBill?.bill?.cgst || 0).toFixed(2)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>State GST (SGST):</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(activeBill?.bill?.sgst || 0).toFixed(2)}</span>
                  </div>

                  <div style={{ height: 1, background: "#e2e8f0", margin: "12px 0" }}></div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
                    <span>Grand Total:</span>
                    <span style={{ color: "#2563eb" }}>₹{Number(activeBill?.bill?.total || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Select Payment Mode</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {["UPI", "CASH", "CARD"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={paymentMode === mode ? "btn-primary" : "btn-secondary"}
                        style={{ flex: 1 }}
                        onClick={() => setPaymentMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 12, borderRadius: 8, fontSize: 12, color: "#1e40af", marginBottom: 20 }}>
                  🛡️ <strong>Stock Safety Guard:</strong> Inventory stock is strictly preserved during drafting and only reduced after you finalize this bill.
                </div>
              </div>

              <div>
                <button
                  className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }}
                  disabled={!activeBill || !activeBill.items || activeBill.items.length === 0}
                  onClick={finalizeCurrentBill}
                >
                  <CheckCircle2 size={18} /> Finalize & Print PDF Invoice
                </button>

                {lastInvoice && (
                  <div style={{ marginTop: 14, padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: "#065f46", fontWeight: 700, marginBottom: 6 }}>
                      ✅ Bill #{lastInvoice.billId} finalized!
                    </div>
                    <a
                      href={`/api/invoices/${lastInvoice.billId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="message-download-btn"
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <Download size={14} /> Download PDF Invoice (Bill #{lastInvoice.billId})
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: INVENTORY MANAGEMENT                          */}
        {/* ---------------------------------------------------- */}
        {activeTab === "inventory" && (
          <div className="card">
            <div className="card-title">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>📦 Store Inventory</span>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>
                  ({inventory.length} total products)
                </span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn-secondary"
                  onClick={() => setReceiveModal({ isOpen: true, name: inventory[0]?.name || "Maggi 70g", quantity: 50, cost: 12, mrp: 14 })}
                >
                  <ArrowDownLeft size={16} /> Inbound Stock (Receive)
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setNewProductModal({ ...newProductModal, isOpen: true })}
                >
                  <Plus size={16} /> New Product
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="Search products by name or category..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                />
                Show Low Stock Alerts Only
              </label>
            </div>

            {/* Inventory Table */}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Unit</th>
                  <th style={{ textAlign: "right" }}>Cost Price</th>
                  <th style={{ textAlign: "right" }}>Selling Price</th>
                  <th style={{ textAlign: "right" }}>MRP</th>
                  <th style={{ textAlign: "right" }}>GST</th>
                  <th style={{ textAlign: "center" }}>Stock</th>
                  <th style={{ textAlign: "center" }}>Reorder Level</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((p) => {
                  const isLow = p.stock <= p.reorder_level;
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{p.unit}</td>
                      <td style={{ textAlign: "right" }}>₹{Number(p.cost_price).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>₹{Number(p.sell_price).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>₹{Number(p.mrp).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{p.gst_rate}%</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{p.stock}</td>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{p.reorder_level}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`status-badge ${isLow ? "badge-low-stock" : "badge-in-stock"}`}>
                          {isLow ? "REORDER NOW" : "IN STOCK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: CUSTOMER KHATA (CREDIT LEDGER)                */}
        {/* ---------------------------------------------------- */}
        {activeTab === "khata" && (
          <div className="card">
            <div className="card-title">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>📒 Customer Khata Ledger</span>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>
                  ({khataList.length} accounts)
                </span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={() => setCreditModal({ isOpen: true, name: "Ravi", amount: 500 })}
                >
                  <ArrowUpRight size={16} /> Add Credit
                </button>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th style={{ textAlign: "right" }}>Outstanding Balance</th>
                  <th>Last Transaction</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {khataList.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                      No customer accounts yet. Add credit using the button above or Telegram.
                    </td>
                  </tr>
                ) : (
                  khataList.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: c.balance > 0 ? "#dc2626" : "#059669" }}>
                        ₹{Number(c.balance).toFixed(2)}
                      </td>
                      <td style={{ color: "#64748b", fontSize: 12 }}>
                        {c.last_transaction || "N/A"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={() => setCreditModal({ isOpen: true, name: c.name, amount: 200 })}
                          >
                            + Credit
                          </button>
                          <button
                            className="btn-primary"
                            style={{ padding: "4px 10px", fontSize: 12, background: "#10b981" }}
                            disabled={c.balance <= 0}
                            onClick={() => setPaymentModal({ isOpen: true, name: c.name, amount: c.balance, maxBalance: c.balance })}
                          >
                            Record Payment
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 5: REPORTS & DAILY CLOSE                         */}
        {/* ---------------------------------------------------- */}
        {activeTab === "reports" && dailySummary && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Top Row: Financial summary cards */}
            <div className="pos-layout">
              <div className="card">
                <div className="card-title">
                  <span>📊 Daily Sales Performance ({dailySummary.date})</span>
                  <a
                    href="/api/reports/generate-pptx"
                    className="btn-primary"
                    style={{ textDecoration: "none" }}
                  >
                    <FileSpreadsheet size={16} /> Download 6-Slide PPTX Deck
                  </a>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 10 }}>
                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>Total Finalized Bills</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{dailySummary.totalBills}</div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>Gross Revenue</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>
                      ₹{Number(dailySummary.totalSales).toFixed(2)}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>Central GST (CGST)</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      ₹{Number(dailySummary.cgst).toFixed(2)}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>State GST (SGST)</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      ₹{Number(dailySummary.sgst).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                    className="btn-secondary"
                    style={{ width: "100%", justifyContent: "center", padding: 12 }}
                    onClick={() => {
                      sendChatMessage("daily close");
                      setActiveTab("chat");
                    }}
                  >
                    View Formatted Daily Close Receipt in Chat
                  </button>
                </div>
              </div>

              {/* Payment Mode Distribution */}
              <div className="card">
                <div className="card-title">
                  <span>💳 Payment Channels</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {dailySummary.paymentBreakdown?.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: 13 }}>No payment data recorded today.</p>
                  ) : (
                    dailySummary.paymentBreakdown?.map((p, idx) => {
                      const share = dailySummary.totalSales > 0 ? (p.total / dailySummary.totalSales) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <strong>{p.mode}</strong>
                            <span>₹{Number(p.total).toFixed(2)} ({p.count} bills)</span>
                          </div>
                          <div style={{ width: "100%", height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${share}%`,
                                height: "100%",
                                background: p.mode === "UPI" ? "#2563eb" : p.mode === "CASH" ? "#10b981" : "#f59e0b"
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Top Products */}
            <div className="card">
              <div className="card-title">
                <span>🏆 Top Selling Products Leaderboard</span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Product Name</th>
                    <th style={{ textAlign: "center" }}>Units Sold</th>
                    <th style={{ textAlign: "right" }}>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.topProducts?.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>
                        No product sales recorded today.
                      </td>
                    </tr>
                  ) : (
                    dailySummary.topProducts?.map((tp, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 800, color: "#2563eb" }}>#{idx + 1}</td>
                        <td><strong>{tp.name}</strong></td>
                        <td style={{ textAlign: "center" }}>{tp.total_quantity} {tp.unit}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>₹{Number(tp.total_revenue).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: RECEIVE STOCK                               */}
      {/* ---------------------------------------------------- */}
      {receiveModal.isOpen && (
        <div className="modal-overlay" onClick={() => setReceiveModal({ ...receiveModal, isOpen: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>📥 Inbound Stock Receipt</h3>
            <form onSubmit={handleReceiveStock}>
              <div className="form-group">
                <label>Product Name</label>
                <select
                  className="form-control"
                  value={receiveModal.name}
                  onChange={(e) => setReceiveModal({ ...receiveModal, name: e.target.value })}
                  required
                >
                  {inventory.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quantity Inbound</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={receiveModal.quantity}
                  onChange={(e) => setReceiveModal({ ...receiveModal, quantity: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Cost Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={receiveModal.cost}
                    onChange={(e) => setReceiveModal({ ...receiveModal, cost: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>MRP (₹)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={receiveModal.mrp}
                    onChange={(e) => setReceiveModal({ ...receiveModal, mrp: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReceiveModal({ ...receiveModal, isOpen: false })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Receive & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: ADD NEW PRODUCT                             */}
      {/* ---------------------------------------------------- */}
      {newProductModal.isOpen && (
        <div className="modal-overlay" onClick={() => setNewProductModal({ ...newProductModal, isOpen: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>✨ Add New Kirana Product</h3>
            <form onSubmit={handleAddProduct}>
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Amul Cheese 200g"
                  value={newProductModal.name}
                  onChange={(e) => setNewProductModal({ ...newProductModal, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    className="form-control"
                    value={newProductModal.unit}
                    onChange={(e) => setNewProductModal({ ...newProductModal, unit: e.target.value })}
                  >
                    <option value="piece">piece</option>
                    <option value="packet">packet</option>
                    <option value="kg">kg</option>
                    <option value="litre">litre</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>GST Rate (%)</label>
                  <select
                    className="form-control"
                    value={newProductModal.gst_rate}
                    onChange={(e) => setNewProductModal({ ...newProductModal, gst_rate: Number(e.target.value) })}
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Cost Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={newProductModal.cost_price}
                    onChange={(e) => setNewProductModal({ ...newProductModal, cost_price: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>MRP / Selling Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={newProductModal.mrp}
                    onChange={(e) => setNewProductModal({ ...newProductModal, mrp: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={newProductModal.stock}
                    onChange={(e) => setNewProductModal({ ...newProductModal, stock: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Reorder Alert Level</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={newProductModal.reorder_level}
                    onChange={(e) => setNewProductModal({ ...newProductModal, reorder_level: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setNewProductModal({ ...newProductModal, isOpen: false })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: ADD CREDIT TO KHATA                         */}
      {/* ---------------------------------------------------- */}
      {creditModal.isOpen && (
        <div className="modal-overlay" onClick={() => setCreditModal({ ...creditModal, isOpen: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>📒 Add Customer Credit (Khata)</h3>
            <form onSubmit={handleAddCredit}>
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ravi"
                  value={creditModal.name}
                  onChange={(e) => setCreditModal({ ...creditModal, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Credit Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  className="form-control"
                  value={creditModal.amount}
                  onChange={(e) => setCreditModal({ ...creditModal, amount: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCreditModal({ ...creditModal, isOpen: false })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: RECORD KHATA PAYMENT                        */}
      {/* ---------------------------------------------------- */}
      {paymentModal.isOpen && (
        <div className="modal-overlay" onClick={() => setPaymentModal({ ...paymentModal, isOpen: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>💵 Record Khata Repayment</h3>
            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label>Customer</label>
                <input
                  type="text"
                  className="form-control"
                  value={paymentModal.name}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>
                  Repayment Amount (₹) — Max: ₹{paymentModal.maxBalance.toFixed(2)}
                </label>
                <input
                  type="number"
                  min="1"
                  max={paymentModal.maxBalance}
                  step="any"
                  className="form-control"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPaymentModal({ ...paymentModal, isOpen: false })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: "#10b981" }}>
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
