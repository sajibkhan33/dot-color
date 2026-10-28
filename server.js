import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
dotenv.config();
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);
const HOST = "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI;
const ERP_API_KEY = process.env.ERP_API_KEY || "dotcolor_sec_key_9f82d1c6e4";
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const requireAuth = (req, res, next) => {
  const headerKey = req.headers["x-api-key"];
  const queryKey = req.query.apiKey;
  const providedKey = typeof headerKey === "string" ? headerKey.trim() : typeof queryKey === "string" ? queryKey.trim() : null;
  if (!providedKey || providedKey !== ERP_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key."
    });
  }
  next();
};
const erpStateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, default: "singleton" },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    revision: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: "erpstates" }
);
const ErpState = mongoose.model("ErpState", erpStateSchema);
let isConnected = false;
const connectDB = async () => {
  if (!MONGODB_URI) {
    console.warn("\u26A0\uFE0F  MONGODB_URI is not set in .env file. Running in offline/memory mode.");
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5e3
    });
    isConnected = true;
    console.log("\u2705 Connected to MongoDB Atlas successfully! Database:", mongoose.connection.name);
  } catch (error) {
    isConnected = false;
    console.error("\u274C MongoDB Atlas connection error:", error);
  }
};
connectDB();
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: isConnected ? "connected" : "disconnected",
    databaseName: isConnected ? mongoose.connection.name : null
  });
});
app.get("/api/state/meta", requireAuth, async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected."
    });
  }
  try {
    const doc = await ErpState.findOne({ id: "singleton" }).select("updatedAt revision");
    if (!doc) {
      return res.json({ success: true, exists: false, revision: 0, updatedAt: null });
    }
    const revision = doc.revision || doc.data?._rev || 1;
    res.json({ success: true, exists: true, revision, updatedAt: doc.updatedAt });
  } catch (error) {
    console.error("Error fetching state meta:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/state", requireAuth, async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected. Check MONGODB_URI in .env."
    });
  }
  try {
    const doc = await ErpState.findOne({ id: "singleton" });
    if (!doc) {
      return res.json({ success: true, data: null, revision: 0 });
    }
    const revision = doc.revision || doc.data?._rev || 1;
    res.json({ success: true, data: doc.data, revision, updatedAt: doc.updatedAt });
  } catch (error) {
    console.error("Error fetching state:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/public/invoice/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const queryId = (req.params.id || "").trim().toLowerCase();
  const queryNoHash = queryId.replace(/^#/, "");
  if (!isConnected) {
    return res.status(503).json({ success: false, message: "Database is currently offline." });
  }
  try {
    const doc = await ErpState.findOne({ id: "singleton" });
    if (!doc || !doc.data) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }
    const invoices = Array.isArray(doc.data.invoices) ? doc.data.invoices : [];
    const quotations = Array.isArray(doc.data.quotations) ? doc.data.quotations : [];
    const profile = doc.data.profile || {};
    const foundInvoice = invoices.find(
      (inv) => inv.id && inv.id.toLowerCase() === queryId || inv.id && inv.id.toLowerCase() === queryNoHash || inv.invoiceNo && inv.invoiceNo.toLowerCase() === queryId || inv.invoiceNo && inv.invoiceNo.toLowerCase() === queryNoHash || inv.id && inv.id.toLowerCase().replace(/^#/, "") === queryNoHash || inv.invoiceNo && inv.invoiceNo.toLowerCase().replace(/^#/, "") === queryNoHash
    );
    if (foundInvoice) {
      return res.json({ success: true, type: "invoice", data: foundInvoice, profile });
    }
    const foundQuote = quotations.find(
      (q) => q.id && q.id.toLowerCase() === queryId || q.id && q.id.toLowerCase() === queryNoHash || q.quoteNo && q.quoteNo.toLowerCase() === queryId || q.quoteNo && q.quoteNo.toLowerCase() === queryNoHash || q.id && q.id.toLowerCase().replace(/^#/, "") === queryNoHash || q.quoteNo && q.quoteNo.toLowerCase().replace(/^#/, "") === queryNoHash
    );
    if (foundQuote) {
      return res.json({ success: true, type: "quotation", data: foundQuote, profile });
    }
    return res.status(404).json({ success: false, message: "Invoice not found." });
  } catch (error) {
    console.error("Error fetching public invoice:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
const sseClients = /* @__PURE__ */ new Set();
const broadcastStateUpdate = (updatedAt, senderTabId, revision) => {
  const payload = `data: ${JSON.stringify({ type: "STATE_UPDATED", updatedAt, senderTabId, revision })}

`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
};
app.get("/api/state/events", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}

`);
  const heartbeat = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 2e4);
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});
app.post("/api/state", requireAuth, async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected. Data remains safely in localStorage."
    });
  }
  try {
    const { data, clientRev, senderTabId, force } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: "Data payload is required." });
    }
    if (Array.isArray(data.auditLogs) && data.auditLogs.length > 500) {
      data.auditLogs = data.auditLogs.slice(-500);
    }
    const existing = await ErpState.findOne({ id: "singleton" });
    const isRestore = Boolean(
      req.body.isRestore || req.body.forceRestore || data?.isBackupRestore || data?._isRestore
    );
    let currentRev = 0;
    if (existing) {
      currentRev = existing.revision || existing.data?._rev || 1;
      if (!force && !isRestore && typeof clientRev === "number" && clientRev < currentRev) {
        return res.status(409).json({
          success: false,
          conflict: true,
          currentRev,
          updatedAt: existing.updatedAt,
          message: "Conflict detected: Remote state was modified by another session. Please pull before pushing."
        });
      }
    }
    const nextRev = Math.max(currentRev, typeof clientRev === "number" ? clientRev : 0) + 1;
    data._rev = nextRev;
    let effectivePurgeTime = 0;
    if (isRestore) {
      data.lastPurgedAt = null;
      data.lastPurgeMode = null;
      delete data.isBackupRestore;
      delete data._isRestore;
      if (existing?.data) {
        existing.data.lastPurgedAt = null;
        existing.data.lastPurgeMode = null;
      }
      if (!Array.isArray(data.auditLogs)) data.auditLogs = [];
      data.auditLogs.unshift({
        id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        staffId: "admin",
        staffName: "Admin",
        staffRole: "Super Admin",
        location: "All",
        actionType: "DATA_RESTORED",
        entityType: "System",
        details: "System restored from database backup. Purge quarantine reset.",
        detailsBn: "\u09A1\u09BE\u099F\u09BE\u09AC\u09C7\u09B8 \u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A5\u09C7\u0995\u09C7 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09B0\u09BF\u09B8\u09CD\u099F\u09CB\u09B0 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964",
        timestamp: `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)} ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 5)}`,
        severity: "info"
      });
      if (data.auditLogs.length > 500) {
        data.auditLogs = data.auditLogs.slice(0, 500);
      }
      console.log(`[RESTORE] Manual database backup restored successfully. Purge quarantine cleared (rev: ${nextRev}).`);
    } else {
      effectivePurgeTime = existing?.data?.lastPurgedAt ? new Date(existing.data.lastPurgedAt).getTime() : 0;
    }
    if (!isRestore && effectivePurgeTime > 0) {
      data.lastPurgedAt = existing.data.lastPurgedAt;
      data.lastPurgeMode = existing.data.lastPurgeMode;
      if (Array.isArray(data.invoices)) {
        data.invoices = data.invoices.filter((inv) => {
          const match = String(inv.id || "").match(/inv-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            console.log(`[PURGE GUARD] Blocked stale resurrection of invoice ${inv.id} (${inv.invoiceNo}) created before purge.`);
            return false;
          }
          return true;
        });
      }
      if (Array.isArray(data.transactions)) {
        data.transactions = data.transactions.filter((tx) => {
          const match = String(tx.id || "").match(/tx-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            console.log(`[PURGE GUARD] Blocked stale resurrection of transaction ${tx.id} created before purge.`);
            return false;
          }
          return true;
        });
      }
      if (Array.isArray(data.purchaseOrders)) {
        data.purchaseOrders = data.purchaseOrders.filter((po) => {
          const match = String(po.id || "").match(/po-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            console.log(`[PURGE GUARD] Blocked stale resurrection of purchase order ${po.id} created before purge.`);
            return false;
          }
          return true;
        });
      }
      if (Array.isArray(data.quotations)) {
        data.quotations = data.quotations.filter((q) => {
          const match = String(q.id || "").match(/qt-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            return false;
          }
          return true;
        });
      }
      if (Array.isArray(data.stockMovements)) {
        data.stockMovements = data.stockMovements.filter((sm) => {
          const match = String(sm.id || "").match(/sm-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            return false;
          }
          return true;
        });
      }
      if (Array.isArray(data.journalEntries)) {
        data.journalEntries = data.journalEntries.filter((je) => {
          const match = String(je.id || "").match(/jnl-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            return false;
          }
          return true;
        });
      }
      if (Array.isArray(data.projects) && existing.data.lastPurgeMode === "RESET_ALL_TRANSACTIONS") {
        data.projects = data.projects.filter((p) => {
          const match = String(p.id || "").match(/prj-(\d+)/);
          if (match && Number(match[1]) < effectivePurgeTime) {
            return false;
          }
          return true;
        });
      }
    }
    const updated = await ErpState.findOneAndUpdate(
      { id: "singleton" },
      { data, revision: nextRev, updatedAt: /* @__PURE__ */ new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    broadcastStateUpdate(updated.updatedAt, senderTabId, nextRev);
    res.json({ success: true, revision: nextRev, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error("Error saving state:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/state/reset", requireAuth, async (_req, res) => {
  if (!isConnected) {
    return res.status(503).json({ success: false, message: "MongoDB not connected." });
  }
  try {
    await ErpState.deleteOne({ id: "singleton" });
    broadcastStateUpdate(/* @__PURE__ */ new Date(), void 0, 0);
    res.json({ success: true, message: "Cloud database state cleared." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/purge-data", requireAuth, async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ success: false, message: "MongoDB is not connected." });
  }
  try {
    const { mode, senderTabId } = req.body;
    const existing = await ErpState.findOne({ id: "singleton" });
    if (!existing || !existing.data) {
      return res.status(404).json({ success: false, message: "No ERP state found to purge." });
    }
    const currentRev = existing.revision || existing.data?._rev || 1;
    const nextRev = currentRev + 1;
    const data = { ...existing.data };
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (mode === "RESET_ALL_TRANSACTIONS" || mode === "WIPE_ALL_EXCEPT_PRODUCTS") {
      data.invoices = [];
      data.quotations = [];
      data.purchaseOrders = [];
      data.transactions = [];
      data.stockMovements = [];
      data.journalEntries = [];
      data.projects = [];
      if (Array.isArray(data.customers)) {
        data.customers = data.customers.map((c) => ({
          ...c,
          totalPurchased: 0,
          dueAmount: 0,
          advanceBalance: 0
        }));
      }
      if (Array.isArray(data.suppliers)) {
        data.suppliers = data.suppliers.map((s) => ({
          ...s,
          totalPurchased: 0,
          balancePayable: 0,
          dueAmount: 0
        }));
      }
      if (Array.isArray(data.products)) {
        data.products = data.products.map((p) => ({
          ...p,
          stockFactory: 0,
          stockOffice: 0
        }));
      }
      if (Array.isArray(data.chartOfAccounts)) {
        data.chartOfAccounts = data.chartOfAccounts.map((acc) => ({
          ...acc,
          openingBalance: 0,
          currentBalance: 0
        }));
      }
    } else if (mode === "SALES" || mode === "SALES_RESET") {
      data.invoices = [];
      data.quotations = [];
      if (Array.isArray(data.customers)) {
        data.customers = data.customers.map((c) => ({
          ...c,
          totalPurchased: 0,
          dueAmount: 0
        }));
      }
      if (Array.isArray(data.transactions)) {
        data.transactions = data.transactions.filter((t) => {
          const isSales = t.category === "Sales Revenue" || t.category === "Customer Payment" || t.category === "Customer Advance Adjustment";
          const isInv = Boolean(t.refNo && (t.refNo.startsWith("DCC-INV-") || t.refNo.startsWith("inv-")));
          const isPos = Boolean(t.description && (t.description.startsWith("POS Payment:") || t.description.startsWith("Sales Invoice payment") || t.description.startsWith("Invoice Due Payment:")));
          return !(isSales || isInv || isPos);
        });
      }
      if (Array.isArray(data.journalEntries)) {
        data.journalEntries = data.journalEntries.filter((je) => {
          const isSales = je.source === "SALES";
          const isInv = Boolean(je.refNo && (je.refNo.startsWith("DCC-INV-") || je.refNo.startsWith("inv-")));
          return !(isSales || isInv);
        });
      }
      if (Array.isArray(data.stockMovements)) {
        data.stockMovements = data.stockMovements.filter((m) => {
          const isInv = Boolean(m.refNo && (m.refNo.startsWith("DCC-INV-") || m.refNo.startsWith("inv-")));
          const isSalesReason = Boolean(m.reason && (m.reason.toLowerCase().includes("sales invoice") || m.reason.toLowerCase().includes("pos sale")));
          return !(isInv || isSalesReason);
        });
      }
    } else if (mode === "PURCHASES") {
      data.purchaseOrders = [];
      if (Array.isArray(data.suppliers)) {
        data.suppliers = data.suppliers.map((s) => ({
          ...s,
          totalPurchased: 0,
          balancePayable: 0,
          dueAmount: 0
        }));
      }
      if (Array.isArray(data.transactions)) {
        data.transactions = data.transactions.filter((t) => {
          const isPo = Boolean(t.refNo && (t.refNo.startsWith("DCC-PO-") || t.refNo.startsWith("po-")));
          return !isPo;
        });
      }
      if (Array.isArray(data.journalEntries)) {
        data.journalEntries = data.journalEntries.filter((je) => {
          const isPo = je.source === "PURCHASE" || Boolean(je.refNo && (je.refNo.startsWith("DCC-PO-") || je.refNo.startsWith("po-")));
          return !isPo;
        });
      }
    } else if (mode === "TRANSACTIONS") {
      data.transactions = [];
      data.journalEntries = [];
      if (Array.isArray(data.chartOfAccounts)) {
        data.chartOfAccounts = data.chartOfAccounts.map((acc) => ({
          ...acc,
          currentBalance: acc.openingBalance || 0
        }));
      }
    } else if (mode === "JOURNALS") {
      data.journalEntries = [];
      if (Array.isArray(data.chartOfAccounts)) {
        data.chartOfAccounts = data.chartOfAccounts.map((acc) => ({
          ...acc,
          currentBalance: acc.openingBalance || 0
        }));
      }
    } else if (mode === "PROJECTS") {
      data.projects = [];
      if (Array.isArray(data.transactions)) {
        data.transactions = data.transactions.filter((t) => !(t.category?.toLowerCase().includes("project") || t.accountHead?.toLowerCase().includes("project")));
      }
      if (Array.isArray(data.journalEntries)) {
        data.journalEntries = data.journalEntries.filter((j) => !(j.source === "PROJECT_EXPENSE" || j.source === "PROJECT_SALES"));
      }
      if (Array.isArray(data.chartOfAccounts)) {
        data.chartOfAccounts = data.chartOfAccounts.map((acc) => {
          const isPrj = acc.code === "5206" || acc.code === "4002" || acc.code === "4051" || acc.code === "4060" || acc.name?.toLowerCase().includes("project");
          return isPrj ? { ...acc, currentBalance: acc.openingBalance || 0 } : acc;
        });
      }
    } else if (mode === "INVENTORY_STOCK") {
      data.stockMovements = [];
      if (Array.isArray(data.products)) {
        data.products = data.products.map((p) => ({
          ...p,
          stockFactory: 0,
          stockOffice: 0
        }));
      }
    } else if (mode === "AUDIT_LOGS") {
      data.auditLogs = [];
    }
    data.lastPurgedAt = nowIso;
    data.lastPurgeMode = mode;
    data._rev = nextRev;
    if (!Array.isArray(data.auditLogs)) data.auditLogs = [];
    data.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      staffId: "admin",
      staffName: "Admin",
      staffRole: "Super Admin",
      location: "All",
      actionType: "DATA_CLEANED",
      entityType: "System",
      details: `Server-side authoritative wipe executed: ${mode}.`,
      detailsBn: `\u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0\u09C7 \u09A1\u09C7\u099F\u09BE \u09AA\u09B0\u09BF\u09B7\u09CD\u0995\u09BE\u09B0 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09DF\u09C7\u099B\u09C7: ${mode}\u0964`,
      timestamp: `${nowIso.slice(0, 10)} ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 5)}`,
      severity: "critical"
    });
    if (data.auditLogs.length > 500) {
      data.auditLogs = data.auditLogs.slice(0, 500);
    }
    const updated = await ErpState.findOneAndUpdate(
      { id: "singleton" },
      { data, revision: nextRev, updatedAt: /* @__PURE__ */ new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    broadcastStateUpdate(updated.updatedAt, senderTabId, nextRev);
    return res.json({
      success: true,
      revision: nextRev,
      updatedAt: updated.updatedAt,
      data: updated.data,
      message: `Data purge for '${mode}' successfully completed on MongoDB Atlas.`
    });
  } catch (error) {
    console.error("Error during data purge:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
const cloudPrintJobs = [];
let lastAgentHeartbeat = 0;
let lastAgentTelemetry = {};
setInterval(() => {
  const now = Date.now();
  for (let i = cloudPrintJobs.length - 1; i >= 0; i--) {
    if (now - cloudPrintJobs[i].createdAt > 36e5) {
      cloudPrintJobs.splice(i, 1);
    }
  }
}, 6e4);
app.get("/api/print-bridge/poll", (req, res) => {
  lastAgentHeartbeat = Date.now();
  const metaHeader = req.headers["x-agent-printers"];
  if (typeof metaHeader === "string" && metaHeader.trim()) {
    try {
      const decoded = JSON.parse(Buffer.from(metaHeader, "base64").toString("utf8"));
      if (decoded && typeof decoded === "object") {
        lastAgentTelemetry = decoded;
      }
    } catch {
    }
  }
  const pending = cloudPrintJobs.filter((j) => j.status === "pending");
  res.json({
    success: true,
    jobs: pending,
    serverTime: Date.now()
  });
});
app.post("/api/print-bridge/complete", (req, res) => {
  lastAgentHeartbeat = Date.now();
  const { jobIds } = req.body || {};
  if (Array.isArray(jobIds)) {
    for (const j of cloudPrintJobs) {
      if (jobIds.includes(j.id)) {
        j.status = "completed";
      }
    }
  }
  res.json({ success: true });
});
app.get("/api/print-bridge/status", (_req, res) => {
  const isOnline = Date.now() - lastAgentHeartbeat < 3e4;
  res.json({
    success: true,
    isAgentOnline: isOnline,
    activePrinter: isOnline ? lastAgentTelemetry.activePrinter : void 0,
    isUsbConnected: isOnline ? Boolean(lastAgentTelemetry.isUsbConnected) : false,
    isLanReachable: isOnline ? Boolean(lastAgentTelemetry.isLanReachable) : false,
    printers: isOnline ? lastAgentTelemetry.printers || [] : [],
    detailedPrinters: isOnline ? lastAgentTelemetry.detailedPrinters || [] : [],
    lastHeartbeatAgoSeconds: Math.floor((Date.now() - lastAgentHeartbeat) / 1e3),
    pendingCount: cloudPrintJobs.filter((j) => j.status === "pending").length
  });
});
const handlePrintQueue = (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: "No invoice data provided" });
    }
    const job = {
      id: "job_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      type: "INVOICE",
      payload,
      status: "pending",
      createdAt: Date.now()
    };
    cloudPrintJobs.push(job);
    res.json({ success: true, queued: true, jobId: job.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
};
app.post("/api/hardware/print-invoice", handlePrintQueue);
app.post("/api/hardware/print-bill", handlePrintQueue);
app.post("/api/hardware/print-pos", handlePrintQueue);
app.get("/api/download/printer-agent-zip", (_req, res) => {
  const candidates = [
    path.join(__dirname, "public", "downloads", "DotColorPrinter-Setup.zip"),
    path.join(__dirname, "dist", "downloads", "DotColorPrinter-Setup.zip")
  ];
  for (const zipPath of candidates) {
    if (fs.existsSync(zipPath)) {
      res.setHeader("Content-Disposition", 'attachment; filename="DotColorPrinter-Setup.zip"');
      res.setHeader("Content-Type", "application/zip");
      return res.sendFile(zipPath);
    }
  }
  return res.status(404).json({ success: false, error: "Setup package not found" });
});
app.get("/api/download/printer-installer-bat", (_req, res) => {
  const batPath = path.join(__dirname, "scripts", "INSTALL-DOTCOLOR-PRINTER.bat");
  if (fs.existsSync(batPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="INSTALL-DOTCOLOR-PRINTER.bat"');
    res.setHeader("Content-Type", "application/x-bat");
    return res.sendFile(batPath);
  }
  return res.status(404).json({ success: false, error: "Installer script not found" });
});
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.use("/downloads", express.static(path.join(__dirname, "public", "downloads")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) res.status(404).send("Not Found");
  });
});
const server = app.listen(PORT, HOST, () => {
  console.log(`\u{1F680} ERP Server running at http://${HOST}:${PORT} (process.env.PORT=${process.env.PORT || "undefined"})`);
});
server.on("error", (err) => {
  console.error("\u274C Server listen error:", err);
});
