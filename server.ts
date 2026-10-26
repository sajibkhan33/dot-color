import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

// Ensure MongoDB Atlas SRV DNS resolution succeeds on Windows/local networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS cannot be set
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mongoose Schema for ERP State Persistence
// Matches the singleton cloud sync pattern (like restaurantstates in cafeteria project)
const erpStateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, default: 'singleton' },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'erpstates' }
);

const ErpState = mongoose.model('ErpState', erpStateSchema);

let isConnected = false;

// Connect to MongoDB
const connectDB = async () => {
  if (!MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not set in .env file. Running in offline/memory mode.');
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas successfully! Database:', mongoose.connection.name);
  } catch (error) {
    isConnected = false;
    console.error('❌ MongoDB Atlas connection error:', error);
  }
};

connectDB();

// API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: isConnected ? 'connected' : 'disconnected',
    databaseName: isConnected ? mongoose.connection.name : null,
  });
});

// Lightweight meta endpoint to check if remote state was updated by another device
app.get('/api/state/meta', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB is not connected.',
    });
  }

  try {
    const doc = await ErpState.findOne({ id: 'singleton' }).select('updatedAt');
    if (!doc) {
      return res.json({ success: true, exists: false, updatedAt: null });
    }
    res.json({ success: true, exists: true, updatedAt: doc.updatedAt });
  } catch (error: any) {
    console.error('Error fetching state meta:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get ERP state from MongoDB
app.get('/api/state', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB is not connected. Check MONGODB_URI in .env.',
    });
  }

  try {
    const doc = await ErpState.findOne({ id: 'singleton' });
    if (!doc) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: doc.data, updatedAt: doc.updatedAt });
  } catch (error: any) {
    console.error('Error fetching state:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Public single invoice fetch endpoint (for QR code scan lookup)
app.get('/api/public/invoice/:id', async (req, res) => {
  const rawId = (req.params.id || '').trim();
  const queryId = rawId.toLowerCase();
  const queryNoHash = queryId.replace(/^#/, '');

  if (!isConnected) {
    return res.status(503).json({ success: false, message: 'Database is currently offline.' });
  }

  try {
    const doc = await ErpState.findOne({ id: 'singleton' });
    if (!doc || !doc.data) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoices = Array.isArray(doc.data.invoices) ? doc.data.invoices : [];
    const quotations = Array.isArray(doc.data.quotations) ? doc.data.quotations : [];
    const profile = doc.data.profile || {};

    const cleanMatches = (val?: string) => {
      if (!val) return false;
      const v = String(val).trim().toLowerCase();
      const vNoHash = v.replace(/^#/, '');
      return v === queryId || vNoHash === queryNoHash || v === queryNoHash || vNoHash === queryId;
    };

    const foundInvoice = invoices.find(
      (inv: any) =>
        cleanMatches(inv.id) ||
        cleanMatches(inv.invoiceNo) ||
        cleanMatches(inv.referenceNo)
    );

    if (foundInvoice) {
      return res.json({ success: true, type: 'invoice', data: foundInvoice, profile });
    }

    const foundQuote = quotations.find(
      (q: any) =>
        cleanMatches(q.id) ||
        cleanMatches(q.quoteNo) ||
        cleanMatches(q.referenceNo)
    );

    if (foundQuote) {
      return res.json({ success: true, type: 'quotation', data: foundQuote, profile });
    }

    return res.status(404).json({ success: false, message: 'Invoice not found.' });
  } catch (error: any) {
    console.error('Error fetching public invoice:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Real-Time Multi-Device Broadcast Bus (Server-Sent Events) ---
const sseClients = new Set<express.Response>();

const broadcastStateUpdate = (updatedAt: any) => {
  const payload = `data: ${JSON.stringify({ type: 'STATE_UPDATED', updatedAt })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
};

// SSE Stream Endpoint for Instant Live Sync across Devices
app.get('/api/state/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial connected ACK
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  // Periodic heartbeat every 20s to prevent reverse proxy/Render idle timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Save or Update ERP state in MongoDB
app.post('/api/state', async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB is not connected. Data remains safely in localStorage.',
    });
  }

  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: 'Data payload is required.' });
    }

    const updated = await ErpState.findOneAndUpdate(
      { id: 'singleton' },
      { data, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Instant real-time broadcast to all other open devices/tabs
    broadcastStateUpdate(updated.updatedAt);

    res.json({ success: true, updatedAt: updated.updatedAt });
  } catch (error: any) {
    console.error('Error saving state:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset state
app.post('/api/state/reset', async (_req, res) => {
  if (!isConnected) {
    return res.status(503).json({ success: false, message: 'MongoDB not connected.' });
  }
  try {
    await ErpState.deleteOne({ id: 'singleton' });
    broadcastStateUpdate(new Date());
    res.json({ success: true, message: 'Cloud database state cleared.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- DotColor Communication Printer Bridge Cloud Queue ---
interface CloudPrintJob {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'completed';
  createdAt: number;
}

const cloudPrintJobs: CloudPrintJob[] = [];
let lastAgentHeartbeat = 0;
let lastAgentTelemetry: any = {};

// Clean up old jobs after 1 hour
setInterval(() => {
  const now = Date.now();
  for (let i = cloudPrintJobs.length - 1; i >= 0; i--) {
    if (now - cloudPrintJobs[i].createdAt > 3600000) {
      cloudPrintJobs.splice(i, 1);
    }
  }
}, 60000);

// Print Bridge: Polling endpoint for local agent
app.get('/api/print-bridge/poll', (req, res) => {
  lastAgentHeartbeat = Date.now();
  const metaHeader = req.headers['x-agent-printers'];
  if (typeof metaHeader === 'string' && metaHeader.trim()) {
    try {
      const decoded = JSON.parse(Buffer.from(metaHeader, 'base64').toString('utf8'));
      if (decoded && typeof decoded === 'object') {
        lastAgentTelemetry = decoded;
      }
    } catch {}
  }
  const pending = cloudPrintJobs.filter((j) => j.status === 'pending');
  res.json({
    success: true,
    jobs: pending,
    serverTime: Date.now(),
  });
});

// Print Bridge: Mark jobs completed by agent
app.post('/api/print-bridge/complete', (req, res) => {
  lastAgentHeartbeat = Date.now();
  const { jobIds } = req.body || {};
  if (Array.isArray(jobIds)) {
    for (const j of cloudPrintJobs) {
      if (jobIds.includes(j.id)) {
        j.status = 'completed';
      }
    }
  }
  res.json({ success: true });
});

// Print Bridge: Agent status endpoint
app.get('/api/print-bridge/status', (_req, res) => {
  const isOnline = Date.now() - lastAgentHeartbeat < 30000;
  res.json({
    success: true,
    isAgentOnline: isOnline,
    activePrinter: isOnline ? lastAgentTelemetry.activePrinter : undefined,
    isUsbConnected: isOnline ? Boolean(lastAgentTelemetry.isUsbConnected) : false,
    isLanReachable: isOnline ? Boolean(lastAgentTelemetry.isLanReachable) : false,
    printers: isOnline ? lastAgentTelemetry.printers || [] : [],
    detailedPrinters: isOnline ? lastAgentTelemetry.detailedPrinters || [] : [],
    lastHeartbeatAgoSeconds: Math.floor((Date.now() - lastAgentHeartbeat) / 1000),
    pendingCount: cloudPrintJobs.filter((j) => j.status === 'pending').length,
  });
});

// Print Bridge: Hardware Print Enqueue Endpoint
const handlePrintQueue = (req: express.Request, res: express.Response) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'No invoice data provided' });
    }

    const job: CloudPrintJob = {
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'INVOICE',
      payload,
      status: 'pending',
      createdAt: Date.now(),
    };

    cloudPrintJobs.push(job);
    res.json({ success: true, queued: true, jobId: job.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
};

app.post('/api/hardware/print-invoice', handlePrintQueue);
app.post('/api/hardware/print-bill', handlePrintQueue);
app.post('/api/hardware/print-pos', handlePrintQueue);

// Download 1-Click Printer Agent Setup ZIP
app.get('/api/download/printer-agent-zip', (_req, res) => {
  const candidates = [
    path.join(__dirname, 'public', 'downloads', 'DotColorPrinter-Setup.zip'),
    path.join(__dirname, 'dist', 'downloads', 'DotColorPrinter-Setup.zip'),
  ];
  for (const zipPath of candidates) {
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Disposition', 'attachment; filename="DotColorPrinter-Setup.zip"');
      res.setHeader('Content-Type', 'application/zip');
      return res.sendFile(zipPath);
    }
  }
  return res.status(404).json({ success: false, error: 'Setup package not found' });
});

// Download 1-Click Installer BAT directly
app.get('/api/download/printer-installer-bat', (_req, res) => {
  const batPath = path.join(__dirname, 'scripts', 'INSTALL-DOTCOLOR-PRINTER.bat');
  if (fs.existsSync(batPath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="INSTALL-DOTCOLOR-PRINTER.bat"');
    res.setHeader('Content-Type', 'application/x-bat');
    return res.sendFile(batPath);
  }
  return res.status(404).json({ success: false, error: 'Installer script not found' });
});

// Serve frontend in production or if dist exists
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.use('/downloads', express.static(path.join(__dirname, 'public', 'downloads')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Not Found');
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 ERP Server running (process.env.PORT=${process.env.PORT || 'undefined'}, listening on ${PORT})`);
});

server.on('error', (err: any) => {
  console.error('❌ Server listen error:', err);
});
