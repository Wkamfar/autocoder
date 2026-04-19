import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('web');

interface RouteHandler {
  (req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string>): Promise<void>;
}

const routes: Array<{ method: string; pattern: RegExp; handler: RouteHandler }> = [];

function route(method: string, path: string, handler: RouteHandler) {
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
  routes.push({ method, pattern, handler });
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(data));
}

function html(res: http.ServerResponse, body: string) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page(body));
}

function page(body: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NightShift Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#c9d1d9;line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:20px}
h1{color:#58a6ff;margin-bottom:20px;font-size:1.8em}
h2{color:#58a6ff;margin:20px 0 10px;font-size:1.3em}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px}
.card h3{color:#f0f6fc;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:16px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #21262d}
th{color:#8b949e;font-weight:600;font-size:.85em;text-transform:uppercase}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.8em;font-weight:600}
.badge-green{background:#1b4332;color:#52c41a}
.badge-yellow{background:#3d3200;color:#f5c542}
.badge-red{background:#3d0000;color:#f54242}
.badge-blue{background:#0d2744;color:#58a6ff}
nav{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;margin-bottom:20px}
nav a{color:#8b949e;text-decoration:none;margin-right:20px;font-weight:500}
nav a:hover,nav a.active{color:#58a6ff}
.stat{text-align:center}
.stat .value{font-size:2em;font-weight:700;color:#f0f6fc}
.stat .label{color:#8b949e;font-size:.85em}
pre{background:#0d1117;border:1px solid #30363d;padding:12px;border-radius:6px;overflow-x:auto;font-size:.85em}
.empty{color:#8b949e;font-style:italic;padding:20px;text-align:center}
</style>
</head><body>
<nav>
<a href="/">Dashboard</a>
<a href="/crm">CRM Pipeline</a>
<a href="/brain">Brain</a>
<a href="/debates">Debates</a>
<a href="/decisions">Decisions</a>
<a href="/api/health">API Health</a>
</nav>
<div class="container">${body}</div>
</body></html>`;
}

// --- API Routes ---

route('GET', '/api/health', async (_req, res) => {
  json(res, {
    status: 'online',
    uptime: process.uptime(),
    node: process.version,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

route('GET', '/api/state', async (_req, res) => {
  const stateDir = config.runtime.stateDir;
  try {
    const files = fs.readdirSync(stateDir);
    const currentRun = files.find(f => f.startsWith('run_'));
    let runState = null;
    if (currentRun) {
      const runDir = path.join(stateDir, currentRun);
      const progressFile = path.join(runDir, 'progress_log.jsonl');
      if (fs.existsSync(progressFile)) {
        const lines = fs.readFileSync(progressFile, 'utf8').trim().split('\n').filter(Boolean);
        runState = {
          run_id: currentRun,
          entries: lines.length,
          last: lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null,
        };
      }
    }
    json(res, { stateDir, files, currentRun, runState });
  } catch {
    json(res, { stateDir, files: [], currentRun: null, runState: null });
  }
});

route('GET', '/api/crm/deals', async (_req, res) => {
  try {
    const dbPath = config.sales.dbPath;
    if (!fs.existsSync(dbPath)) {
      json(res, { deals: [], error: 'no database' });
      return;
    }
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath, { readonly: true });
    const deals = db.prepare('SELECT * FROM deals ORDER BY updated_at DESC LIMIT 100').all();
    db.close();
    json(res, { deals });
  } catch (err) {
    json(res, { deals: [], error: (err as Error).message });
  }
});

route('GET', '/api/crm/accounts', async (_req, res) => {
  try {
    const dbPath = config.sales.dbPath;
    if (!fs.existsSync(dbPath)) { json(res, { accounts: [], error: 'no database' }); return; }
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath, { readonly: true });
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY updated_at DESC LIMIT 100').all();
    db.close();
    json(res, { accounts });
  } catch (err) {
    json(res, { accounts: [], error: (err as Error).message });
  }
});

route('GET', '/api/crm/contacts', async (_req, res) => {
  try {
    const dbPath = config.sales.dbPath;
    if (!fs.existsSync(dbPath)) { json(res, { contacts: [], error: 'no database' }); return; }
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath, { readonly: true });
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC LIMIT 100').all();
    db.close();
    json(res, { contacts });
  } catch (err) {
    json(res, { contacts: [], error: (err as Error).message });
  }
});

route('GET', '/api/crm/activities', async (_req, res) => {
  try {
    const dbPath = config.sales.dbPath;
    if (!fs.existsSync(dbPath)) { json(res, { activities: [], error: 'no database' }); return; }
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath, { readonly: true });
    const activities = db.prepare('SELECT * FROM activities ORDER BY occurred_at DESC LIMIT 100').all();
    db.close();
    json(res, { activities });
  } catch (err) {
    json(res, { activities: [], error: (err as Error).message });
  }
});

route('GET', '/api/brain', async (_req, res) => {
  const brainDir = config.brain.dir;
  const knowledge: Record<string, string> = {};
  const knowledgeDir = path.join(brainDir, 'knowledge');
  try {
    if (fs.existsSync(knowledgeDir)) {
      for (const file of fs.readdirSync(knowledgeDir)) {
        if (file.endsWith('.md')) {
          knowledge[file] = fs.readFileSync(path.join(knowledgeDir, file), 'utf8').slice(0, 5000);
        }
      }
    }
  } catch {}
  json(res, { brainDir, knowledge });
});

route('GET', '/api/debates', async (_req, res) => {
  const stateDir = config.runtime.stateDir;
  const debatesDir = path.join(stateDir, 'pair-debate-runs');
  const debates: unknown[] = [];
  try {
    if (fs.existsSync(debatesDir)) {
      for (const file of fs.readdirSync(debatesDir).slice(-50)) {
        if (file.endsWith('.jsonl')) {
          const lines = fs.readFileSync(path.join(debatesDir, file), 'utf8').trim().split('\n');
          const first = lines[0] ? JSON.parse(lines[0]) : {};
          const last = lines[lines.length - 1] ? JSON.parse(lines[lines.length - 1]) : {};
          debates.push({ file, rounds: lines.length, first, last });
        }
      }
    }
  } catch {}
  json(res, { debates });
});

// --- HTML Routes ---

route('GET', '/', async (_req, res) => {
  html(res, `
<h1>NightShift Dashboard</h1>
<div class="grid">
  <div class="card stat"><div class="value" id="uptime">--</div><div class="label">Uptime</div></div>
  <div class="card stat"><div class="value" id="memory">--</div><div class="label">Memory (MB)</div></div>
  <div class="card stat"><div class="value" id="deals">--</div><div class="label">Deals</div></div>
  <div class="card stat"><div class="value" id="accounts">--</div><div class="label">Accounts</div></div>
</div>
<div class="grid">
  <div class="card"><h3>System Status</h3><pre id="health">Loading...</pre></div>
  <div class="card"><h3>Latest Run</h3><pre id="run">Loading...</pre></div>
</div>
<script>
async function load(){
  try{
    const h=await(await fetch('/api/health')).json();
    document.getElementById('uptime').textContent=Math.floor(h.uptime/60)+'m';
    document.getElementById('memory').textContent=Math.floor(h.memory.rss/1048576);
    document.getElementById('health').textContent=JSON.stringify(h,null,2);
  }catch(e){document.getElementById('health').textContent='Error: '+e.message}
  try{
    const s=await(await fetch('/api/state')).json();
    document.getElementById('run').textContent=JSON.stringify(s,null,2);
  }catch{}
  try{
    const d=await(await fetch('/api/crm/deals')).json();
    document.getElementById('deals').textContent=d.deals?.length??0;
    const a=await(await fetch('/api/crm/accounts')).json();
    document.getElementById('accounts').textContent=a.accounts?.length??0;
  }catch{}
}
load();setInterval(load,15000);
</script>`);
});

route('GET', '/crm', async (_req, res) => {
  html(res, `
<h1>CRM Pipeline</h1>
<h2>Deals</h2>
<div id="deals-table" class="card"><div class="empty">Loading...</div></div>
<h2>Accounts</h2>
<div id="accounts-table" class="card"><div class="empty">Loading...</div></div>
<h2>Contacts</h2>
<div id="contacts-table" class="card"><div class="empty">Loading...</div></div>
<script>
function tbl(cols,rows){
  if(!rows.length)return '<div class="empty">No data</div>';
  let h='<table><tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr>';
  for(const r of rows)h+='<tr>'+cols.map(c=>'<td>'+(r[c]??'')+'</td>').join('')+'</tr>';
  return h+'</table>';
}
async function load(){
  try{
    const d=await(await fetch('/api/crm/deals')).json();
    document.getElementById('deals-table').innerHTML=tbl(['id','account_id','title','stage','value_usd','status','updated_at'],d.deals||[]);
  }catch{}
  try{
    const a=await(await fetch('/api/crm/accounts')).json();
    document.getElementById('accounts-table').innerHTML=tbl(['id','name','domain','industry','segment','status'],a.accounts||[]);
  }catch{}
  try{
    const c=await(await fetch('/api/crm/contacts')).json();
    document.getElementById('contacts-table').innerHTML=tbl(['id','account_id','full_name','email','title','role_label'],c.contacts||[]);
  }catch{}
}
load();
</script>`);
});

route('GET', '/brain', async (_req, res) => {
  html(res, `
<h1>Brain Knowledge</h1>
<div id="brain" class="grid"><div class="card"><div class="empty">Loading...</div></div></div>
<script>
async function load(){
  const b=await(await fetch('/api/brain')).json();
  const k=b.knowledge||{};
  const keys=Object.keys(k);
  if(!keys.length){document.getElementById('brain').innerHTML='<div class="card"><div class="empty">No knowledge files yet</div></div>';return}
  document.getElementById('brain').innerHTML=keys.map(f=>'<div class="card"><h3>'+f+'</h3><pre>'+k[f].replace(/</g,'&lt;')+'</pre></div>').join('');
}
load();
</script>`);
});

route('GET', '/debates', async (_req, res) => {
  html(res, `
<h1>Pair Debates</h1>
<div id="debates"><div class="card"><div class="empty">Loading...</div></div></div>
<script>
async function load(){
  const d=await(await fetch('/api/debates')).json();
  const list=d.debates||[];
  if(!list.length){document.getElementById('debates').innerHTML='<div class="card"><div class="empty">No debates yet. Run one via Discord or CLI.</div></div>';return}
  document.getElementById('debates').innerHTML=list.map(db=>'<div class="card"><h3>'+db.file+'</h3><p>'+db.rounds+' rounds</p><pre>'+JSON.stringify(db.last,null,2).replace(/</g,'&lt;')+'</pre></div>').join('');
}
load();
</script>`);
});

route('GET', '/decisions', async (_req, res) => {
  html(res, `
<h1>Decision Engine</h1>
<div class="card"><div class="empty">Decision rankings are computed on-demand.<br>Use <code>!ns sales top-decisions</code> in Discord or <code>node dist/index.js sales top-decisions</code> via CLI.</div></div>`);
});

// --- Server ---

export function startWebServer(port = 3000): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method || 'GET';

    for (const r of routes) {
      if (r.method !== method) continue;
      const match = r.pattern.exec(url.pathname);
      if (match) {
        try {
          await r.handler(req, res, match.groups || {});
        } catch (err) {
          log.error('route error', err);
          json(res, { error: (err as Error).message }, 500);
        }
        return;
      }
    }
    res.writeHead(404);
    res.end('not found');
  });

  server.listen(port, '0.0.0.0', () => {
    log.info(`web dashboard at http://0.0.0.0:${port}`);
  });

  return server;
}
