/**
 * SwiftPOS — server.js
 * Express + fs (flat JSON file) — zero native dependencies.
 * No better-sqlite3, no node-gyp, no compilation. Runs on Render free tier.
 *
 * Data is stored in data/swiftpos.json (one JSON file, one object).
 * A persistent Render disk keeps it alive across deploys & restarts.
 */

'use strict';
const path    = require('path');
const fs      = require('fs');
const express = require('express');
const cors    = require('cors');
const comp    = require('compression');

/* ── paths ───────────────────────────────── */
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'swiftpos.json');
const PUB_DIR  = path.join(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ── default seed data ───────────────────── */
const DEFAULT_DB = {
  items: [
    {id:1,name:'Tomato',barcode:'6001234000001',price:1.50,cost:0.80,stock:420,min:50,cat:'food',unit:'kg',wsUnit:'carton',wsQty:20,wsPrice:22.00},
    {id:2,name:'Orange Juice',barcode:'6001234000002',price:2.20,cost:1.10,stock:60,min:12,cat:'drink',unit:'ltr',wsUnit:'carton',wsQty:12,wsPrice:18.00},
    {id:3,name:'Rice 1kg',barcode:'6001234000003',price:3.50,cost:2.00,stock:40,min:10,cat:'food',unit:'kg',wsUnit:'box',wsQty:25,wsPrice:42.00},
    {id:4,name:'Shampoo',barcode:'6001234000004',price:4.99,cost:2.50,stock:36,min:6,cat:'home',unit:'pcs',wsUnit:'box',wsQty:12,wsPrice:22.00},
    {id:5,name:'Bread',barcode:'6001234000005',price:1.80,cost:0.90,stock:15,min:20,cat:'food',unit:'pcs',wsUnit:'dozen',wsQty:12,wsPrice:16.00},
  ],
  sales: [],
  expenses: [],
  finance: [],
  customers: [
    {id:1,name:'Maria Santos',phone:'+31 6 1234 5678',points:820,balance:0,totalSpent:0,visits:0},
    {id:2,name:'Johan Bakker',phone:'+31 6 2345 6789',points:120,balance:45,totalSpent:0,visits:0},
  ],
  suppliers: [
    {id:1,name:'Al-Rashid Foods',phone:'+31 20 555 0101',email:'orders@alrashid.nl',cat:'food',addr:'Amsterdam West',initials:'AR'},
    {id:2,name:'Euro Drinks BV',phone:'+31 20 555 0202',email:'info@eurodrinks.nl',cat:'drink',addr:'Rotterdam',initials:'ED'},
    {id:3,name:'HomeStore NL',phone:'+31 20 555 0303',email:'supply@homestore.nl',cat:'home',addr:'Utrecht',initials:'HS'},
    {id:4,name:'General Traders',phone:'+31 20 555 0404',email:'gt@general.nl',cat:'other',addr:'Den Haag',initials:'GT'},
  ],
  orders: [
    {id:1,ref:'PO-0041',supplier:'Al-Rashid Foods',supId:1,date:'2026-06-01',due:'2026-06-05',
     items:[{name:'Tomato',qty:5,unit:'carton',cost:22.00},{name:'Rice 1kg',qty:4,unit:'box',cost:42.00}],
     status:'pending',total:278.00},
    {id:2,ref:'PO-0040',supplier:'Euro Drinks BV',supId:2,date:'2026-05-28',due:'2026-06-02',
     items:[{name:'Orange Juice',qty:10,unit:'carton',cost:18.00}],status:'partial',total:180.00},
    {id:3,ref:'PO-0039',supplier:'HomeStore NL',supId:3,date:'2026-05-25',due:'2026-05-30',
     items:[{name:'Shampoo',qty:3,unit:'box',cost:22.00}],status:'received',total:66.00},
  ],
  users: [
    {id:1,name:'Ahmad Karimi',email:'ahmad@swiftpos.com',role:'owner',status:'active',last:'Today',pinHash:'-335835704'},
    {id:2,name:'Sara Nazari',email:'sara@swiftpos.com',role:'admin',status:'active',last:'Today',pinHash:'1050253'},
    {id:3,name:'Karim Yusuf',email:'karim@swiftpos.com',role:'cashier',status:'active',last:'Yesterday',pinHash:'48690'},
    {id:4,name:'Layla Hassan',email:'layla@swiftpos.com',role:'cashier',status:'inactive',last:'3 days ago',pinHash:'1567547438'},
  ],
  partners: [
    {id:1,name:'Ahmad Karimi',nameInit:'AK',share:50,invested:10000,drawn:2400,withdrawals:[],availableBalance:0},
    {id:2,name:'Sara Nazari',nameInit:'SN',share:30,invested:6000,drawn:1200,withdrawals:[],availableBalance:0},
    {id:3,name:'Omar Mansour',nameInit:'OM',share:20,invested:4000,drawn:600,withdrawals:[],availableBalance:0},
  ],
  settings: {
    taxRate:5, taxEnabled:true, taxInclusive:false, taxOnReceipt:true, taxName:'Tax',
    currency:'€', storeName:'SwiftPOS', phone:'+31 20 555 0100',
    addr:'Jordaan 12, Amsterdam', email:'info@swiftpos.com',
    receiptFooter:'Thank you! · شكراً · مننه', lang:'en', expBudget:0,
  },
  counters: {sale:1,item:6,customer:3,finance:1,po:42,user:5,partner:4,exp:1},
};

/* ── flat-file helpers ───────────────────────
   Read / write the entire JSON file atomically.
   We write to a temp file then rename so a crash
   mid-write never corrupts the data file.
─────────────────────────────────────────────── */
function dbRead() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('dbRead error:', e.message);
    return null;
  }
}

function dbWrite(data) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, DB_FILE);   // atomic on most OS / filesystems
}

// Seed on first run
if (!fs.existsSync(DB_FILE)) {
  dbWrite(DEFAULT_DB);
  console.log('🌱  swiftpos.json created with default data');
}

/* ── express ─────────────────────────────── */
const app = express();
app.use(comp());
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.static(PUB_DIR));

/* ── API routes ─────────────────────────── */

// GET — return full db
app.get('/api/db', (req, res) => {
  const data = dbRead() || DEFAULT_DB;
  res.json(data);
});

// PUT — overwrite full db (frontend debounces to 400 ms)
app.put('/api/db', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }
  try {
    dbWrite(body);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/db error:', e.message);
    res.status(500).json({ error: 'Write failed' });
  }
});

// PATCH — update a single dot-path key, e.g. { path: 'settings.taxRate', value: 8 }
app.patch('/api/db', (req, res) => {
  const { path: p, value } = req.body || {};
  if (!p) return res.status(400).json({ error: 'path required' });
  try {
    const data  = dbRead() || DEFAULT_DB;
    const parts = p.split('.');
    let obj = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    dbWrite(data);
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/db error:', e.message);
    res.status(500).json({ error: 'Write failed' });
  }
});

// DELETE — factory reset
app.delete('/api/db', (req, res) => {
  try {
    dbWrite(JSON.parse(JSON.stringify(DEFAULT_DB)));
    res.json({ ok: true, message: 'Database reset to defaults' });
  } catch (e) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now(), file: DB_FILE });
});

// SPA fallback — serve index.html for every non-API path
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(PUB_DIR, 'index.html'));
});

/* ── start ───────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀  SwiftPOS running → http://localhost:${PORT}`);
  console.log(`📄  Data file: ${DB_FILE}`);
});
