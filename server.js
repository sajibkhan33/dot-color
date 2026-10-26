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
const PORT = process.env.PORT || 5e3;
const MONGODB_URI = process.env.MONGODB_URI;
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const erpStateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, default: "singleton" },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
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
app.get("/api/state/meta", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected."
    });
  }
  try {
    const doc = await ErpState.findOne({ id: "singleton" }).select("updatedAt");
    if (!doc) {
      return res.json({ success: true, exists: false, updatedAt: null });
    }
    res.json({ success: true, exists: true, updatedAt: doc.updatedAt });
  } catch (error) {
    console.error("Error fetching state meta:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/state", async (_req, res) => {
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
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: doc.data, updatedAt: doc.updatedAt });
  } catch (error) {
    console.error("Error fetching state:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/public/invoice/:id", async (req, res) => {
  const rawId = (req.params.id || "").trim();
  const queryId = rawId.toLowerCase();
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
    const cleanMatches = (val) => {
      if (!val) return false;
      const v = String(val).trim().toLowerCase();
      const vNoHash = v.replace(/^#/, "");
      return v === queryId || vNoHash === queryNoHash || v === queryNoHash || vNoHash === queryId;
    };
    const foundInvoice = invoices.find(
      (inv) => cleanMatches(inv.id) || cleanMatches(inv.invoiceNo) || cleanMatches(inv.referenceNo)
    );
    if (foundInvoice) {
      return res.json({ success: true, type: "invoice", data: foundInvoice, profile });
    }
    const foundQuote = quotations.find(
      (q) => cleanMatches(q.id) || cleanMatches(q.quoteNo) || cleanMatches(q.referenceNo)
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
const broadcastStateUpdate = (updatedAt) => {
  const payload = `data: ${JSON.stringify({ type: "STATE_UPDATED", updatedAt })}

`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
};
app.get("/api/state/events", (req, res) => {
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
app.post("/api/state", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is not connected. Data remains safely in localStorage."
    });
  }
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: "Data payload is required." });
    }
    const updated = await ErpState.findOneAndUpdate(
      { id: "singleton" },
      { data, updatedAt: /* @__PURE__ */ new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    broadcastStateUpdate(updated.updatedAt);
    res.json({ success: true, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error("Error saving state:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/state/reset", async (_req, res) => {
  if (!isConnected) {
    return res.status(503).json({ success: false, message: "MongoDB not connected." });
  }
  try {
    await ErpState.deleteOne({ id: "singleton" });
    broadcastStateUpdate(/* @__PURE__ */ new Date());
    res.json({ success: true, message: "Cloud database state cleared." });
  } catch (error) {
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
const server = app.listen(PORT, () => {
  console.log(`\u{1F680} ERP Server running (process.env.PORT=${process.env.PORT || "undefined"}, listening on ${PORT})`);
});
server.on("error", (err) => {
  console.error("\u274C Server listen error:", err);
});
