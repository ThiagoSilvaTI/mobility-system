const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const { openDb, DB_PATH } = require('./database/db');
const { initDatabase } = require('./database/init');
const { migrateAuth } = require('./database/migrate');
const { registrarRotasAuth } = require('./database/auth-routes');
const { registrarRotasAdmin } = require('./database/admin-routes');
const cidade = require('./config/cidade');

const PORT = process.env.PORT || 3000;

if (!fs.existsSync(DB_PATH)) {
  initDatabase();
}

const db = openDb();
migrateAuth(db);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { authMiddleware, adminAuthMiddleware } = registrarRotasAuth(app, db);
registrarRotasAdmin(app, db, adminAuthMiddleware);

app.get('/api/cidade', (req, res) => {
  res.json({
    nome: cidade.nome,
    uf: cidade.uf,
    centro: cidade.centro,
    destinoPadrao: cidade.destinoPadrao,
    destinosRapidos: cidade.destinosRapidos,
    destinosBusca: cidade.destinosBusca,
    zoom: cidade.zoom,
  });
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function simularMovimento() {
  const veiculos = db.prepare('SELECT * FROM veiculos WHERE ativo = 1').all();
  const upd = db.prepare('UPDATE veiculos SET lat = ?, lng = ?, ocupacao = ? WHERE id = ?');
  veiculos.forEach((v) => {
    const delta = v.tipo === 'bicicleta' ? 0.0008 : 0.0004;
    const lat = v.lat + (Math.random() - 0.5) * delta;
    const lng = v.lng + (Math.random() - 0.5) * delta;
    const ocup = v.tipo === 'bicicleta' ? 0 : Math.min(60, Math.max(5, v.ocupacao + Math.floor((Math.random() - 0.5) * 6)));
    upd.run(lat, lng, ocup, v.id);
  });
  return db.prepare('SELECT * FROM veiculos WHERE ativo = 1').all();
}

app.get('/api/veiculos', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM veiculos WHERE ativo = 1').all());
});

app.get('/api/paradas', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM paradas').all());
});

app.get('/api/horarios', authMiddleware, (req, res) => {
  const { linha, tipo } = req.query;
  let sql = 'SELECT h.*, r.nome as rota_nome FROM horarios h LEFT JOIN rotas r ON h.rota_id = r.id WHERE 1=1';
  const params = [];
  if (linha) { sql += ' AND h.linha LIKE ?'; params.push(`%${linha}%`); }
  if (tipo) { sql += ' AND h.tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY h.horario';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/rotas', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM rotas ORDER BY embarques DESC').all());
});

app.post('/api/rotas/planejar', authMiddleware, (req, res) => {
  const { destinoLat, destinoLng, origemLat, origemLng } = req.body;
  const oLat = origemLat ?? cidade.centro.lat;
  const oLng = origemLng ?? cidade.centro.lng;
  const dLat = destinoLat ?? cidade.destinoPadrao.lat;
  const dLng = destinoLng ?? cidade.destinoPadrao.lng;

  const paradas = db.prepare('SELECT * FROM paradas').all();
  const veiculos = db.prepare('SELECT * FROM veiculos WHERE ativo = 1').all();
  const rotasDb = db.prepare('SELECT * FROM rotas').all();

  const paradasProx = paradas
    .map((p) => ({
      ...p,
      distOrigem: haversine(oLat, oLng, p.lat, p.lng),
      distDestino: haversine(dLat, dLng, p.lat, p.lng),
    }))
    .sort((a, b) => a.distOrigem - b.distOrigem)
    .slice(0, 3);

  const opcoes = rotasDb.slice(0, 4).map((r, i) => {
    const tipos = { onibus: '🚌 Ônibus', van: '🚐 Van', bicicleta: '🚲 Bicicleta', misto: '🔀 Integrado' };
    const dist = haversine(oLat, oLng, dLat, dLng);
    const tempoExtra = Math.round(dist * 8 + r.duracao_min * 0.3);
    return {
      id: r.id,
      nome: r.nome,
      tipo: r.tipo,
      tipoLabel: tipos[r.tipo] || r.tipo,
      tempoMin: r.duracao_min + tempoExtra + i * 5,
      embarque: paradasProx[i % paradasProx.length]?.nome || 'Hub Central',
      distanciaKm: dist.toFixed(1),
      co2Evitado: (r.co2_evitado_kg * 0.1).toFixed(1),
      transferencias: r.tipo === 'misto' ? 1 : 0,
    };
  }).sort((a, b) => a.tempoMin - b.tempoMin);

  const veiculosProx = veiculos
    .map((v) => ({ ...v, dist: haversine(oLat, oLng, v.lat, v.lng) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

  res.json({
    origem: { lat: oLat, lng: oLng },
    destino: { lat: dLat, lng: dLng },
    opcoes,
    paradasEmbarque: paradasProx,
    veiculosProximos: veiculosProx,
  });
});

app.post('/api/solicitacoes', authMiddleware, (req, res) => {
  const { origem, destino, regiao, telefone } = req.body;
  if (!origem || !destino) return res.status(400).json({ erro: 'Origem e destino são obrigatórios' });
  const r = db
    .prepare(
      'INSERT INTO solicitacoes (cidadao_id, nome, telefone, origem, destino, regiao) VALUES (?,?,?,?,?,?)'
    )
    .run(
      req.cidadao.id,
      req.cidadao.nome,
      telefone || req.cidadao.telefone || '',
      origem,
      destino,
      regiao || 'Periferia'
    );
  res.status(201).json({ id: r.lastInsertRowid, mensagem: 'Solicitação registrada com sucesso' });
});

app.get('/api/solicitacoes', adminAuthMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM solicitacoes ORDER BY criado_em DESC LIMIT 50').all());
});

app.patch('/api/solicitacoes/:id', adminAuthMiddleware, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE solicitacoes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/dashboard', adminAuthMiddleware, (req, res) => {
  const veiculos = db.prepare('SELECT COUNT(*) as total FROM veiculos WHERE ativo = 1').get();
  const solicitacoes = db.prepare("SELECT COUNT(*) as total FROM solicitacoes WHERE status = 'pendente'").get();
  const passageirosHoje = db.prepare('SELECT passageiros FROM fluxo_diario ORDER BY data DESC LIMIT 1').get();
  const rotas = db.prepare('SELECT * FROM rotas ORDER BY embarques DESC').all();
  const regioes = db.prepare('SELECT * FROM metricas_regiao ORDER BY demanda DESC').all();
  const fluxo = db.prepare('SELECT * FROM fluxo_diario ORDER BY data').all();
  const co2Total = db.prepare('SELECT SUM(co2_kg) as total FROM metricas_regiao').get();
  const tipos = db.prepare('SELECT tipo, COUNT(*) as qtd FROM veiculos WHERE ativo = 1 GROUP BY tipo').all();

  res.json({
    kpis: {
      veiculosAtivos: veiculos.total,
      solicitacoesPendentes: solicitacoes.total,
      passageirosHoje: passageirosHoje?.passageiros || 0,
      co2EvitadoMes: (co2Total?.total || 0).toFixed(0),
    },
    rotasMaisUsadas: rotas.slice(0, 6),
    demandaPorRegiao: regioes,
    fluxoPassageiros: fluxo,
    frotaPorTipo: tipos,
    indicadoresAmbientais: {
      co2EvitadoKg: co2Total?.total || 0,
      viagensSustentaveis: fluxo.reduce((s, f) => s + f.viagens, 0),
      modaisVerdes: tipos.filter((t) => t.tipo === 'bicicleta' || t.tipo === 'van').reduce((s, t) => s + t.qtd, 0),
    },
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ tipo: 'veiculos', dados: db.prepare('SELECT * FROM veiculos WHERE ativo = 1').all() }));
});

setInterval(() => {
  const dados = simularMovimento();
  const msg = JSON.stringify({ tipo: 'veiculos', dados });
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
}, 4000);

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ erro: 'Não encontrado' });
  const htmlPublico = {
    '/login.html': 'login.html',
    '/cadastro.html': 'cadastro.html',
    '/admin/login.html': 'admin/login.html',
    '/admin.html': 'admin.html',
  };
  if (htmlPublico[req.path]) {
    return res.sendFile(path.join(__dirname, 'public', htmlPublico[req.path]));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Mobilidade Urbana rodando em http://localhost:${PORT}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin/login.html`);
});
