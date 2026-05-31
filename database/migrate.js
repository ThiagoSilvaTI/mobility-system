const { tableExists } = require('./db');
const { hashSenha, normalizarCpf } = require('./auth-utils');
const adminConfig = require('../config/admin');

function migrateAuth(db) {
  if (!tableExists(db, 'cidadaos')) {
    db.exec(`
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
    `);
    console.log('Tabelas de cidadãos criadas.');
  }

  const cols = db.prepare('PRAGMA table_info(solicitacoes)').all();
  const temCidadao = cols.some((c) => c.name === 'cidadao_id');
  if (!temCidadao) {
    db.exec('ALTER TABLE solicitacoes ADD COLUMN cidadao_id INTEGER REFERENCES cidadaos(id)');
    console.log('Coluna cidadao_id adicionada em solicitacoes.');
  }

  const colsCid = db.prepare('PRAGMA table_info(cidadaos)').all();
  if (!colsCid.some((c) => c.name === 'is_admin')) {
    db.exec('ALTER TABLE cidadaos ADD COLUMN is_admin INTEGER DEFAULT 0');
    console.log('Coluna is_admin adicionada em cidadaos.');
  }

  adminConfig.cpfsAdminIniciais.forEach((cpf) => {
    db.prepare('UPDATE cidadaos SET is_admin = 1 WHERE cpf = ?').run(normalizarCpf(cpf));
  });

  const total = db.prepare('SELECT COUNT(*) as c FROM cidadaos').get();
  if (total.c === 0) {
    db.prepare(
      'INSERT INTO cidadaos (nome, cpf, email, telefone, senha_hash, is_admin) VALUES (?,?,?,?,?,1)'
    ).run(
      'Ana Clara Silva Aragão',
      '096.209.973-28',
      'aragão@email.com',
      '(98) 99999-0000',
      hashSenha('123456')
    );
    console.log('Cidadão demo (admin): CPF 096.209.973-28 | senha: 123456');
  }
}

module.exports = { migrateAuth };
