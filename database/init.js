const { openDb, DB_PATH, tableExists } = require('./db');
const { hashSenha } = require('./auth-utils');
const cidade = require('../config/cidade');

const reset = process.argv.includes('--reset');

function dropAll(db) {
  db.exec(`
    DROP TABLE IF EXISTS sessoes;
    DROP TABLE IF EXISTS horarios;
    DROP TABLE IF EXISTS solicitacoes;
    DROP TABLE IF EXISTS paradas;
    DROP TABLE IF EXISTS veiculos;
    DROP TABLE IF EXISTS rotas;
    DROP TABLE IF EXISTS metricas_regiao;
    DROP TABLE IF EXISTS fluxo_diario;
    DROP TABLE IF EXISTS cidadaos;
  `);
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE veiculos (
      id INTEGER PRIMARY KEY,
      tipo TEXT NOT NULL,
      linha TEXT,
      placa TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      ocupacao INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE rotas (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      origem TEXT,
      destino TEXT,
      duracao_min INTEGER,
      embarques INTEGER DEFAULT 0,
      co2_evitado_kg REAL DEFAULT 0
    );

    CREATE TABLE horarios (
      id INTEGER PRIMARY KEY,
      rota_id INTEGER,
      linha TEXT,
      tipo TEXT,
      horario TEXT,
      sentido TEXT,
      FOREIGN KEY (rota_id) REFERENCES rotas(id)
    );

    CREATE TABLE paradas (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      acessivel INTEGER DEFAULT 1
    );

    CREATE TABLE cidadaos (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL UNIQUE,
      email TEXT,
      telefone TEXT,
      senha_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE sessoes (
      id INTEGER PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      cidadao_id INTEGER NOT NULL,
      expira_em TEXT NOT NULL,
      FOREIGN KEY (cidadao_id) REFERENCES cidadaos(id)
    );

    CREATE TABLE solicitacoes (
      id INTEGER PRIMARY KEY,
      cidadao_id INTEGER,
      nome TEXT,
      telefone TEXT,
      origem TEXT,
      destino TEXT,
      regiao TEXT,
      status TEXT DEFAULT 'pendente',
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cidadao_id) REFERENCES cidadaos(id)
    );

    CREATE TABLE metricas_regiao (
      id INTEGER PRIMARY KEY,
      regiao TEXT NOT NULL,
      demanda INTEGER,
      passageiros_dia INTEGER,
      co2_kg REAL
    );

    CREATE TABLE fluxo_diario (
      id INTEGER PRIMARY KEY,
      data TEXT,
      passageiros INTEGER,
      viagens INTEGER
    );
  `);
}

function seed(db) {
  const insV = db.prepare('INSERT INTO veiculos (tipo, linha, placa, lat, lng, ocupacao) VALUES (?,?,?,?,?,?)');
  cidade.veiculos.forEach((v) => insV.run(...v));

  const insR = db.prepare('INSERT INTO rotas (nome, tipo, origem, destino, duracao_min, embarques, co2_evitado_kg) VALUES (?,?,?,?,?,?,?)');
  cidade.rotas.forEach((r) => insR.run(...r));

  const horarios = [
    [1, '101', 'onibus', '06:00', 'ida'],
    [1, '101', 'onibus', '06:30', 'ida'],
    [1, '101', 'onibus', '07:00', 'ida'],
    [1, '101', 'onibus', '07:30', 'ida'],
    [2, '202', 'onibus', '06:15', 'ida'],
    [2, '202', 'onibus', '06:45', 'ida'],
    [3, '305', 'onibus', '05:45', 'circular'],
    [3, '305', 'onibus', '06:15', 'circular'],
    [4, 'V1', 'van', '07:00', 'ida'],
    [4, 'V1', 'van', '12:00', 'ida'],
    [5, 'V2', 'van', '08:00', 'ida'],
    [7, '410', 'onibus', '06:00', 'ida'],
    [7, '410', 'onibus', '18:00', 'volta'],
  ];
  const insH = db.prepare('INSERT INTO horarios (rota_id, linha, tipo, horario, sentido) VALUES (?,?,?,?,?)');
  horarios.forEach((h) => insH.run(...h));

  const insP = db.prepare('INSERT INTO paradas (nome, lat, lng) VALUES (?,?,?)');
  cidade.paradas.forEach((p) => insP.run(...p));

  const regioes = cidade.regioes || [
    ['Centro', 95, 8200, 220],
    ['Araçagy', 72, 5400, 150],
    ['São José', 68, 4800, 130],
  ];
  const insM = db.prepare('INSERT INTO metricas_regiao (regiao, demanda, passageiros_dia, co2_kg) VALUES (?,?,?,?)');
  regioes.forEach((r) => insM.run(...r));

  const fluxo = [
    ['2026-05-24', 28500, 14200],
    ['2026-05-25', 31200, 15800],
    ['2026-05-26', 29800, 15100],
    ['2026-05-27', 33400, 16900],
    ['2026-05-28', 32100, 16200],
    ['2026-05-29', 35600, 17800],
    ['2026-05-30', 28900, 14500],
  ];
  const insF = db.prepare('INSERT INTO fluxo_diario (data, passageiros, viagens) VALUES (?,?,?)');
  fluxo.forEach((f) => insF.run(...f));

  db.prepare(
    'INSERT INTO cidadaos (nome, cpf, email, telefone, senha_hash, is_admin) VALUES (?,?,?,?,?,1)'
  ).run(
    'Maria Silva (demo)',
    '52998224725',
    'maria@email.com',
    '(98) 99999-0000',
    hashSenha('123456')
  );
}

function initDatabase(options = {}) {
  const forceReset = options.reset ?? reset;
  const db = openDb();

  if (!forceReset && tableExists(db, 'veiculos')) {
    const { c } = db.prepare('SELECT COUNT(*) as c FROM veiculos').get();
    if (c > 0) {
      console.log('Banco já possui dados. Para recriar: npm run init-db -- --reset');
      console.log('(Pare o servidor antes com Ctrl+C)');
      db.close();
      return false;
    }
  }

  if (forceReset) {
    console.log('Recriando tabelas...');
    dropAll(db);
  }

  if (!tableExists(db, 'veiculos')) {
    createSchema(db);
    seed(db);
    console.log('Banco de dados criado com sucesso em', DB_PATH);
  } else if (forceReset) {
    createSchema(db);
    seed(db);
    console.log('Banco de dados resetado com sucesso em', DB_PATH);
  }

  db.close();
  return true;
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
