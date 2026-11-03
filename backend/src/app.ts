import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import eventsRoutes from './modules/events/events.routes';
import invitesRoutes from './modules/invites/invites.routes';
import registrationsRoutes from './modules/registrations/registrations.routes';
import ticketsRoutes from './modules/tickets/tickets.routes';
import checkinRoutes from './modules/checkin/checkin.routes';
import disputesRoutes from './modules/disputes/disputes.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import tenantsRoutes from './modules/tenants/tenants.routes';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes';
import { errorHandler } from './middlewares/error.middleware';
import { apiLimiter } from './middlewares/rateLimit.middleware';

const app = express();

// Trust proxy for Cloudflare Tunnel / reverse proxies
app.set('trust proxy', 1);

// Security headers & CORS
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Global rate limiting
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto Init DB endpoint for deployment bootstrap
app.get('/api/v1/init-db', async (req, res) => {
  let connection: any = null;
  try {
    const { pool } = await import('./config/database');
    connection = await pool.getConnection();
    const candidatePaths = [
      path.resolve(process.cwd(), 'aiven_database_dump.sql'),
      path.resolve(process.cwd(), 'backend', 'aiven_database_dump.sql'),
      path.resolve(__dirname, '../aiven_database_dump.sql'),
      path.resolve(__dirname, '../../aiven_database_dump.sql'),
    ];
    const dumpPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!dumpPath) {
      return res.status(404).json({ success: false, message: 'aiven_database_dump.sql not found on server' });
    }
    const dumpSql = fs.readFileSync(dumpPath, 'utf-8');
    const statements = dumpSql
      .split(/;\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    for (const sql of statements) {
      try {
        await connection.query(sql);
      } catch (e: any) {}
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    const [tables]: any = await connection.query('SHOW TABLES');
    return res.json({
      success: true,
      message: 'Khởi tạo cơ sở dữ liệu Aiven thành công!',
      tableCount: tables.length,
      tables: tables.map((t: any) => Object.values(t)[0]),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Persistent Storage for Custom Invite Card Templates (Canva / Uploaded)
const TEMPLATES_FILE = path.join(process.cwd(), 'data', 'invite_templates.json');
function readStoredTemplates(): { items: any[]; activeId: string | null } {
  try {
    if (!fs.existsSync(TEMPLATES_FILE)) {
      return { items: [], activeId: null };
    }
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      activeId: parsed.activeId || null,
    };
  } catch {
    return { items: [], activeId: null };
  }
}

function writeStoredTemplates(data: { items: any[]; activeId: string | null }) {
  try {
    const dir = path.dirname(TEMPLATES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error('Failed to write invite templates:', e);
  }
}

app.get('/api/v1/invite-templates', (req, res) => {
  res.json({ success: true, data: readStoredTemplates() });
});

app.post('/api/v1/invite-templates', (req, res) => {
  const { id, name, templateUrl, config, aspectHeight, setActive } = req.body || {};
  if (!templateUrl) {
    res.status(400).json({ success: false, message: 'Missing templateUrl' });
    return;
  }
  const store = readStoredTemplates();
  const itemId = id || `tpl_${Date.now()}`;
  const existingIdx = store.items.findIndex((t) => t.id === itemId);
  const record = {
    id: itemId,
    name: name || `Mẫu Phôi Canva #${store.items.length + 1}`,
    templateUrl,
    config: config || {},
    aspectHeight: aspectHeight || 1920,
    updatedAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    store.items[existingIdx] = record;
  } else {
    store.items.unshift(record);
    if (store.items.length > 12) {
      store.items = store.items.slice(0, 12);
    }
  }
  if (setActive !== false) {
    store.activeId = itemId;
  }
  writeStoredTemplates(store);
  res.json({ success: true, data: store, savedItem: record });
});

app.delete('/api/v1/invite-templates/:id', (req, res) => {
  const store = readStoredTemplates();
  store.items = store.items.filter((t) => t.id !== req.params.id);
  if (store.activeId === req.params.id) {
    store.activeId = store.items[0]?.id || null;
  }
  writeStoredTemplates(store);
  res.json({ success: true, data: store });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/invites', invitesRoutes);
app.use('/api/v1/registrations', registrationsRoutes);
app.use('/api/v1/tickets', ticketsRoutes);
app.use('/api/v1/check-in', checkinRoutes);
app.use('/api/v1/disputes', disputesRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/tenants', tenantsRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);

// Error Handler
app.use(errorHandler);

export default app;
