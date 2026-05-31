// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const { openDb } = require('./database/db');
const { initDatabase, DATA_DIR } = require('./database/init');
const { registrarRotasAuth } = require('./database/auth-routes');
const { registrarRotasAdmin } = require('./database/admin-routes');
const cidade = require('./config/cidade');

const PORT = process.env.PORT || 3000;

// Inicializa o banco JSON se não existir
if (!fs.existsSync(DATA_DIR)) {
  initDatabase();
}

const db = openDb();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas de autenticação
const { authMiddleware, adminAuthMiddleware } = registrarRotasAuth(app, db);
registrarRotasAdmin(app, db, adminAuthMiddleware);

// Configuração da cidade
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

// Função Haversine
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Simular movimento dos veículos
function simularMovimento() {
  const veiculos = db.getAllVeiculos();
  veiculos.forEach((v) => {
    const delta = v.tipo === 'bicicleta' ? 0.0008 : 0.0004;
    const lat = v.lat + (Math.random() - 0.5) * delta;
    const lng = v.lng + (Math.random() - 0.5) * delta;
    const ocup = v.tipo === 'bicicleta' ? 0 : Math.min(60, Math.max(5, v.ocupacao + Math.floor((Math.random() - 0.5) * 6)));
    db.updateVeiculo(v.id, { lat, lng, ocupacao: ocup });
  });
  return db.getAllVeiculos();
}

// Rotas da API
app.get('/api/veiculos', authMiddleware, (req, res) => {
  res.json(db.getAllVeiculos());
});

app.get('/api/paradas', authMiddleware, (req, res) => {
  res.json(db.getAllParadas());
});

app.get('/api/horarios', authMiddleware, (req, res) => {
  const { linha, tipo } = req.query;
  res.json(db.getHorarios({ linha, tipo }));
});

app.get('/api/rotas', authMiddleware, (req, res) => {
  res.json(db.getAllRotas());
});

app.post('/api/rotas/planejar', authMiddleware, (req, res) => {
  const { destinoLat, destinoLng, origemLat, origemLng } = req.body;
  const oLat = origemLat ?? cidade.centro.lat;
  const oLng = origemLng ?? cidade.centro.lng;
  const dLat = destinoLat ?? cidade.destinoPadrao.lat;
  const dLng = destinoLng ?? cidade.destinoPadrao.lng;

  const paradas = db.getAllParadas();
  const veiculos = db.getAllVeiculos();
  const rotasDb = db.getAllRotas();

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

  res.json({
    origem: { lat: oLat, lng: oLng },
    destino: { lat: dLat, lng: dLng },
    opcoes,
    paradasEmbarque: paradasProx,
    veiculosProximos: veiculos.slice(0, 5),
  });
});

// Solicitações de transporte
app.post('/api/solicitacoes', authMiddleware, (req, res) => {
  const { origem, destino, regiao, telefone } = req.body;
  if (!origem || !destino) {
    return res.status(400).json({ erro: 'Origem e destino são obrigatórios' });
  }
  
  const solicitacao = db.createSolicitacao({
    cidadao_id: req.cidadao.id,
    nome: req.cidadao.nome,
    telefone: telefone || req.cidadao.telefone || '',
    origem,
    destino,
    regiao: regiao || 'Periferia'
  });
  
  res.status(201).json({ id: solicitacao.id, mensagem: 'Solicitação registrada com sucesso' });
});

// WebSocket para atualizações em tempo real
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ tipo: 'veiculos', dados: db.getAllVeiculos() }));
});

setInterval(() => {
  const dados = simularMovimento();
  const msg = JSON.stringify({ tipo: 'veiculos', dados });
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
}, 4000);

// Rotas HTML
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ erro: 'Não encontrado' });
  }
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
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚌  MobiCidade - Mobilidade Urbana Inteligente        ║
║                                                          ║
║   📱 App: http://localhost:${PORT}                         ║
║   👑 Admin: http://localhost:${PORT}/admin/login.html     ║
║                                                          ║
║   👤 Admin CPF: 123.456.789-00                          ║
║   🔑 Senha: admin123                                     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});