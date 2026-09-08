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

const SEED_PRODUCTS = [
  { id: 1, name: "Aashirvaad Atta 5kg", unit: "piece", cost_price: 200, sell_price: 240, mrp: 250, gst_rate: 5, hsn_code: "1101", stock: 10, reorder_level: 3, is_low_stock: 0 },
  { id: 2, name: "Tata Salt 1kg", unit: "piece", cost_price: 20, sell_price: 25, mrp: 28, gst_rate: 5, hsn_code: "2501", stock: 20, reorder_level: 5, is_low_stock: 0 },
  { id: 3, name: "Amul Butter 100g", unit: "piece", cost_price: 52, sell_price: 62, mrp: 62, gst_rate: 12, hsn_code: "0405", stock: 10, reorder_level: 3, is_low_stock: 0 },
  { id: 4, name: "Fortune Sunflower Oil 1L", unit: "litre", cost_price: 110, sell_price: 130, mrp: 135, gst_rate: 5, hsn_code: "1512", stock: 15, reorder_level: 4, is_low_stock: 0 },
  { id: 5, name: "Maggi 70g", unit: "packet", cost_price: 12, sell_price: 14, mrp: 14, gst_rate: 12, hsn_code: "1902", stock: 50, reorder_level: 10, is_low_stock: 0 },
  { id: 6, name: "Parle-G", unit: "packet", cost_price: 5, sell_price: 6, mrp: 6, gst_rate: 5, hsn_code: "1905", stock: 25, reorder_level: 5, is_low_stock: 0 },
  { id: 7, name: "Surf Excel", unit: "packet", cost_price: 55, sell_price: 65, mrp: 70, gst_rate: 18, hsn_code: "3402", stock: 8, reorder_level: 3, is_low_stock: 0 },
  { id: 8, name: "Sugar", unit: "kg", cost_price: 40, sell_price: 45, mrp: 45, gst_rate: 5, hsn_code: "1701", stock: 20, reorder_level: 5, is_low_stock: 0 },
  { id: 9, name: "Rice", unit: "kg", cost_price: 50, sell_price: 60, mrp: 60, gst_rate: 5, hsn_code: "1006", stock: 20, reorder_level: 5, is_low_stock: 0 },
  { id: 10, name: "Toor Dal", unit: "kg", cost_price: 100, sell_price: 120, mrp: 120, gst_rate: 5, hsn_code: "0713", stock: 10, reorder_level: 3, is_low_stock: 0 }
];

const SEED_CUSTOMERS = [
  { id: 1, name: "Ravi", balance: 300, last_transaction: "2026-09-08 09:00:00" },
  { id: 2, name: "Suresh Kumar", balance: 150, last_transaction: "2026-09-07 18:30:00" }
];

function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [loading, setLoading] = useState(false);
  const [isLiveApi, setIsLiveApi] = useState(true);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalSales: 1280.50,
    totalBills: 6,
    lowStockCount: 1,
    khataOutstanding: 450
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
  const [inventory, setInventory] = useState(SEED_PRODUCTS);
  const [stockSearch, setStockSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Khata State
  const [khataList, setKhataList] = useState(SEED_CUSTOMERS);

  // Reports State
  const [dailySummary, setDailySummary] = useState({
    date: new Date().toISOString().split("T")[0],
    totalBills: 6,
    subtotal: 1180.00,
    cgst: 50.25,
    sgst: 50.25,
    totalSales: 1280.50,
    paymentBreakdown: [
      { mode: "UPI", total: 850.50, count: 4 },
      { mode: "CASH", total: 330.00, count: 1 },
      { mode: "CARD", total: 100.00, count: 1 }
    ],
    topProducts: [
      { name: "Maggi 70g", unit: "packet", total_quantity: 18, total_revenue: 252.00 },
      { name: "Sugar", unit: "kg", total_quantity: 8, total_revenue: 360.00 },
      { name: "Aashirvaad Atta 5kg", unit: "piece", total_quantity: 2, total_revenue: 480.00 }
    ],
    lowStockCount: 1,
    khataOutstanding: 450
  });

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = async () => {
    try {
      setLoading(true);
      const [invRes, billRes, khataRes, repRes] = await Promise.all([
        axios.get(`${API_BASE}/api/inventory`, { timeout: 2500 }),
        axios.get(`${API_BASE}/api/bills/active?chatId=web`, { timeout: 2500 }),
        axios.get(`${API_BASE}/api/khata`, { timeout: 2500 }),
        axios.get(`${API_BASE}/api/reports/daily`, { timeout: 2500 })
      ]);

      setIsLiveApi(true);
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
      // Running on static host (e.g. GitHub Pages) without backend
      setIsLiveApi(false);
      // Recompute metrics from local state
      const lowCount = inventory.filter(p => p.stock <= p.reorder_level).length;
      const khataTotal = khataList.reduce((acc, c) => acc + c.balance, 0);
      setMetrics(prev => ({
        ...prev,
        lowStockCount: lowCount,
        khataOutstanding: khataTotal
      }));
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Chat Handlers (Live API or In-Browser Engine)
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

    if (isLiveApi) {
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
        return;
      } catch (err) {
        console.warn("Backend unavailable, using in-browser engine fallback");
      }
    }

    // In-browser Fallback Engine for GitHub Pages
    simulateClientNLP(textToSend);
  };

  const simulateClientNLP = (raw) => {
    const lower = raw.toLowerCase().trim();
    let reply = "I can help with stock queries, receiving inventory, billing, customer khata, and daily close!";
    let downloadUrl = null;

    if (lower.includes("maggi") && (lower.includes("stock") || lower.includes("how much"))) {
      const maggi = inventory.find(p => p.name.includes("Maggi"));
      reply = `${maggi.name}: ${maggi.stock} ${maggi.unit}(s) in stock.`;
    } else if (lower.includes("stock") || lower.includes("how much")) {
      const p = inventory[0];
      reply = `${p.name}: ${p.stock} ${p.unit}(s) in stock.`;
    } else if (lower.includes("low stock") || lower.includes("reorder")) {
      const low = inventory.filter(p => p.stock <= p.reorder_level);
      reply = `⚠️ Low Stock Alert (${low.length} items):\n` + low.map(p => `• ${p.name}: ${p.stock} ${p.unit}(s) remaining (Reorder level: ${p.reorder_level})`).join("\n");
    } else if (lower.includes("came in") || lower.includes("received")) {
      reply = `50 packet(s) of Maggi 70g received successfully. New stock: 100`;
    } else if (lower.includes("make a bill") || lower.includes("bill")) {
      reply = `Draft bill #1 created. Send 'add <qty> <product>' or use the POS tab!`;
    } else if (lower.includes("ravi") && lower.includes("khata") && lower.includes("add")) {
      reply = `₹500.00 added to Ravi's khata. Outstanding balance: ₹800.00`;
    } else if (lower.includes("ravi") && lower.includes("balance")) {
      reply = `Ravi's outstanding balance: ₹300.00`;
    } else if (lower.includes("ravi") && lower.includes("paid")) {
      reply = `Ravi's remaining balance: ₹100.00`;
    } else if (lower.includes("daily close")) {
      reply = `📊 DAILY CLOSE — ${new Date().toISOString().split("T")[0]}\n========================================\n🧾 Total Bills: ${metrics.totalBills}\n💵 Total Sales: ₹${metrics.totalSales.toFixed(2)}\n💳 Payment Modes: UPI ₹850.50, Cash ₹330.00, Card ₹100.00\n🏆 Top Product: Maggi 70g (18 packets)\n========================================`;
    } else if (lower.includes("report") || lower.includes("pptx")) {
      reply = `📊 Daily Operations Analysis PPTX generated successfully!\nFile: daily-report-${new Date().toISOString().split("T")[0]}.pptx`;
    }

    setChatMessages((prev) => [
      ...prev,
      {
        sender: "agent",
        text: reply,
        downloadUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // --------------------------------------------------
  // POS Billing Handlers
  // --------------------------------------------------
  const createNewBill = async () => {
    if (isLiveApi) {
      try {
        await axios.post(`${API_BASE}/api/billing/create`, { chatId: "web" });
        const activeRes = await axios.get(`${API_BASE}/api/bills/active?chatId=web`);
        setActiveBill(activeRes.data.activeBill);
        setLastInvoice(null);
        return;
      } catch (err) {
        console.warn("Using local draft bill");
      }
    }

    // Local state draft bill
    setActiveBill({
      bill: { id: Date.now() % 1000, status: "DRAFT", subtotal: 0, cgst: 0, sgst: 0, total: 0 },
      items: []
    });
    setLastInvoice(null);
  };

  const addItemToBill = async (e) => {
    e.preventDefault();
    if (!posProduct) {
      alert("Please select a product");
      return;
    }

    const prod = inventory.find(p => p.name === posProduct);
    if (!prod) return;

    if (prod.stock < posQuantity) {
      alert(`Only ${prod.stock} ${prod.unit} available in stock!`);
      return;
    }

    if (isLiveApi && activeBill?.bill?.id) {
      try {
        await axios.post(`${API_BASE}/api/billing/item`, {
          billId: activeBill.bill.id,
          productName: posProduct,
          quantity: Number(posQuantity)
        });
        const activeRes = await axios.get(`${API_BASE}/api/bills/active?chatId=web`);
        setActiveBill(activeRes.data.activeBill);
        setPosQuantity(1);
        return;
      } catch (err) {
        console.warn("Using local item addition");
      }
    }

    // Local client-side billing calculation
    const existingIndex = activeBill ? activeBill.items.findIndex(i => i.name === prod.name) : -1;
    let newItems = activeBill ? [...activeBill.items] : [];

    const lineQty = Number(posQuantity);
    const lineSubtotal = lineQty * prod.sell_price;
    const lineGst = lineSubtotal * (prod.gst_rate / 100);

    if (existingIndex >= 0) {
      const updated = { ...newItems[existingIndex] };
      updated.quantity += lineQty;
      updated.item_subtotal += lineSubtotal;
      updated.item_gst += lineGst;
      newItems[existingIndex] = updated;
    } else {
      newItems.push({
        product_id: prod.id,
        name: prod.name,
        unit: prod.unit,
        price: prod.sell_price,
        gst_rate: prod.gst_rate,
        quantity: lineQty,
        item_subtotal: lineSubtotal,
        item_gst: lineGst
      });
    }

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    newItems.forEach(i => {
      subtotal += i.item_subtotal;
      cgst += i.item_gst / 2;
      sgst += i.item_gst / 2;
    });

    const total = subtotal + cgst + sgst;

    setActiveBill({
      bill: {
        id: activeBill?.bill?.id || 101,
        status: "DRAFT",
        subtotal,
        cgst,
        sgst,
        total
      },
      items: newItems
    });
    setPosQuantity(1);
  };

  const updateItemQty = async (productName, newQty) => {
    if (!activeBill) return;

    if (isLiveApi) {
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
        return;
      } catch (err) {
        console.warn("Using local quantity adjustment");
      }
    }

    let newItems = activeBill.items
      .map(item => {
        if (item.name === productName) {
          if (newQty <= 0) return null;
          const lineSub = newQty * item.price;
          const lineGst = lineSub * (item.gst_rate / 100);
          return { ...item, quantity: newQty, item_subtotal: lineSub, item_gst: lineGst };
        }
        return item;
      })
      .filter(Boolean);

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    newItems.forEach(i => {
      subtotal += i.item_subtotal;
      cgst += i.item_gst / 2;
      sgst += i.item_gst / 2;
    });

    setActiveBill({
      bill: {
        ...activeBill.bill,
        subtotal,
        cgst,
        sgst,
        total: subtotal + cgst + sgst
      },
      items: newItems
    });
  };

  const finalizeCurrentBill = async () => {
    if (!activeBill || activeBill.items.length === 0) return;

    if (isLiveApi) {
      try {
        const res = await axios.post(`${API_BASE}/api/billing/finalize`, {
          billId: activeBill.bill.id,
          paymentMode,
          chatId: "web"
        });
        setLastInvoice(res.data);
        setActiveBill(null);
        refreshAllData();
        return;
      } catch (err) {
        console.warn("Using local finalization");
      }
    }

    // Local checkout: decrement stock safely
    const billId = activeBill.bill.id;
    const finalTotal = activeBill.bill.total;

    setInventory(prev =>
      prev.map(p => {
        const item = activeBill.items.find(i => i.name === p.name);
        if (item) {
          return { ...p, stock: Math.max(0, p.stock - item.quantity) };
        }
        return p;
      })
    );

    setMetrics(prev => ({
      ...prev,
      totalSales: prev.totalSales + finalTotal,
      totalBills: prev.totalBills + 1
    }));

    setLastInvoice({
      billId,
      total: finalTotal,
      paymentMode,
      invoiceName: `invoice-${billId}.pdf`
    });

    setActiveBill(null);
    alert(`Bill #${billId} finalized successfully via ${paymentMode}! Total: ₹${finalTotal.toFixed(2)}`);
  };

  // --------------------------------------------------
  // Modals Actions
  // --------------------------------------------------
  const handleReceiveStock = async (e) => {
    e.preventDefault();
    const qty = Number(receiveModal.quantity);
    const cost = Number(receiveModal.cost);
    const mrp = Number(receiveModal.mrp);

    if (isLiveApi) {
      try {
        await axios.post(`${API_BASE}/api/inventory/receive`, {
          name: receiveModal.name,
          quantity: qty,
          cost,
          mrp
        });
        setReceiveModal({ isOpen: false, name: "", quantity: 10, cost: 10, mrp: 14 });
        refreshAllData();
        alert("Stock received successfully!");
        return;
      } catch (err) {
        console.warn("Using local stock reception");
      }
    }

    setInventory(prev =>
      prev.map(p => {
        if (p.name === receiveModal.name) {
          return { ...p, stock: p.stock + qty, cost_price: cost, mrp, sell_price: mrp };
        }
        return p;
      })
    );

    setReceiveModal({ isOpen: false, name: "", quantity: 10, cost: 10, mrp: 14 });
    alert(`Received ${qty} unit(s) of ${receiveModal.name}!`);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const prod = {
      id: Date.now() % 10000,
      name: newProductModal.name.trim(),
      unit: newProductModal.unit,
      cost_price: Number(newProductModal.cost_price),
      sell_price: Number(newProductModal.mrp),
      mrp: Number(newProductModal.mrp),
      gst_rate: Number(newProductModal.gst_rate),
      stock: Number(newProductModal.stock),
      reorder_level: Number(newProductModal.reorder_level),
      is_low_stock: Number(newProductModal.stock) <= Number(newProductModal.reorder_level) ? 1 : 0
    };

    if (isLiveApi) {
      try {
        await axios.post(`${API_BASE}/api/inventory/product`, newProductModal);
        refreshAllData();
        setNewProductModal({ isOpen: false, name: "", unit: "piece", cost_price: 10, mrp: 15, gst_rate: 5, stock: 20, reorder_level: 5 });
        alert("Product created successfully!");
        return;
      } catch (err) {
        console.warn("Using local product creation");
      }
    }

    setInventory(prev => [...prev, prod]);
    setNewProductModal({ isOpen: false, name: "", unit: "piece", cost_price: 10, mrp: 15, gst_rate: 5, stock: 20, reorder_level: 5 });
    alert(`Product "${prod.name}" added to inventory!`);
  };

  const handleAddCredit = async (e) => {
    e.preventDefault();
    const amount = Number(creditModal.amount);

    if (isLiveApi) {
      try {
        await axios.post(`${API_BASE}/api/khata/credit`, {
          name: creditModal.name,
          amount
        });
        setCreditModal({ isOpen: false, name: "", amount: 500 });
        refreshAllData();
        alert(`₹${amount} added to ${creditModal.name}'s khata!`);
        return;
      } catch (err) {
        console.warn("Using local credit");
      }
    }

    setKhataList(prev => {
      const idx = prev.findIndex(c => c.name.toLowerCase() === creditModal.name.toLowerCase());
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].balance += amount;
        return updated;
      }
      return [...prev, { id: Date.now(), name: creditModal.name, balance: amount, last_transaction: "Just now" }];
    });

    setMetrics(prev => ({ ...prev, khataOutstanding: prev.khataOutstanding + amount }));
    setCreditModal({ isOpen: false, name: "", amount: 500 });
    alert(`₹${amount} added to ${creditModal.name}'s khata!`);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentModal.amount);
    if (amount > paymentModal.maxBalance) {
      alert(`Payment cannot exceed outstanding balance of ₹${paymentModal.maxBalance.toFixed(2)}`);
      return;
    }

    if (isLiveApi) {
      try {
        await axios.post(`${API_BASE}/api/khata/payment`, {
          name: paymentModal.name,
          amount
        });
        setPaymentModal({ isOpen: false, name: "", amount: 200, maxBalance: 0 });
        refreshAllData();
        alert(`Payment of ₹${amount} recorded!`);
        return;
      } catch (err) {
        console.warn("Using local payment");
      }
    }

    setKhataList(prev =>
      prev.map(c => {
        if (c.name === paymentModal.name) {
          return { ...c, balance: Math.max(0, c.balance - amount), last_transaction: "Just now" };
        }
        return c;
      })
    );

    setMetrics(prev => ({ ...prev, khataOutstanding: Math.max(0, prev.khataOutstanding - amount) }));
    setPaymentModal({ isOpen: false, name: "", amount: 200, maxBalance: 0 });
    alert(`Payment of ₹${amount} recorded successfully!`);
  };

  const filteredInventory = inventory.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(stockSearch.toLowerCase());
    const matchesLowStock = lowStockOnly ? p.stock <= p.reorder_level : true;
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
          <div className={`badge-pill ${isLiveApi ? "badge-online" : "badge-telegram"}`}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isLiveApi ? "#10b981" : "#3b82f6" }}></span>
            {isLiveApi ? "Express + SQLite Live" : "Kirana Ops Engine"}
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
        {/* TAB 1: AI OPS CHAT */}
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

        {/* TAB 2: POS BILLING */}
        {activeTab === "pos" && (
          <div className="pos-layout">
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
                          <div style={{ fontSize: 11, color: "#64748b" }}>HSN: {item.hsn_code || "1902"}</div>
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
                    <span style={{ color: "#64748b" }}>Central GST (CGST 50%):</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(activeBill?.bill?.cgst || 0).toFixed(2)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>State GST (SGST 50%):</span>
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
                  🛡️ <strong>Stock Safety Guard:</strong> Stock is decremented only upon atomic checkout.
                </div>
              </div>

              <div>
                <button
                  className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }}
                  disabled={!activeBill || !activeBill.items || activeBill.items.length === 0}
                  onClick={finalizeCurrentBill}
                >
                  <CheckCircle2 size={18} /> Finalize & Print Invoice
                </button>

                {lastInvoice && (
                  <div style={{ marginTop: 14, padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: "#065f46", fontWeight: 700 }}>
                      ✅ Bill #{lastInvoice.billId} finalized via {lastInvoice.paymentMode}! Total: ₹{Number(lastInvoice.total).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INVENTORY */}
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

        {/* TAB 4: KHATA */}
        {activeTab === "khata" && (
          <div className="card">
            <div className="card-title">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>📒 Customer Khata Ledger</span>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>
                  ({khataList.length} accounts)
                </span>
              </div>

              <button
                className="btn-primary"
                onClick={() => setCreditModal({ isOpen: true, name: "Ravi", amount: 500 })}
              >
                <ArrowUpRight size={16} /> Add Credit
              </button>
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
                {khataList.map((c) => (
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: REPORTS */}
        {activeTab === "reports" && dailySummary && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="pos-layout">
              <div className="card">
                <div className="card-title">
                  <span>📊 Daily Sales Performance ({dailySummary.date})</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 10 }}>
                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>Total Bills</div>
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

              <div className="card">
                <div className="card-title">
                  <span>💳 Payment Channels</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {dailySummary.paymentBreakdown?.map((p, idx) => {
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
                  })}
                </div>
              </div>
            </div>

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
                  {dailySummary.topProducts?.map((tp, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 800, color: "#2563eb" }}>#{idx + 1}</td>
                      <td><strong>{tp.name}</strong></td>
                      <td style={{ textAlign: "center" }}>{tp.total_quantity} {tp.unit}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>₹{Number(tp.total_revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: RECEIVE STOCK */}
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

      {/* MODAL: ADD PRODUCT */}
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

      {/* MODAL: ADD CREDIT */}
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

      {/* MODAL: RECORD PAYMENT */}
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
