const {
  normalizarCpf,
  formatarCpf,
  cpfValido,
  hashSenha,
  verificarSenha,
  gerarToken,
} = require('./auth-utils');

const SESSAO_DIAS = 7;

function cidadaoPublico(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    cpf: formatarCpf(row.cpf),
    email: row.email || '',
    telefone: row.telefone || '',
  };
}

/** Perfil do usuário logado (inclui se é admin) */
function cidadaoComPerfil(row) {
  if (!row) return null;
  return {
    ...cidadaoPublico(row),
    isAdmin: !!(row.is_admin ?? row.isAdmin),
  };
}

function adminPublico(row) {
  if (!row) return null;
  return {
    ...cidadaoPublico(row),
    isAdmin: true,
  };
}

function registrarRotasAuth(app, db) {
  function carregarSessao(token) {
    return db
      .prepare(
        `SELECT s.token, s.cidadao_id, c.nome, c.cpf, c.email, c.telefone, c.is_admin
         FROM sessoes s
         JOIN cidadaos c ON c.id = s.cidadao_id
         WHERE s.token = ? AND s.expira_em > datetime('now')`
      )
      .get(token);
  }

  function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ erro: 'Faça login para continuar' });
    }
    const sessao = carregarSessao(token);
    if (!sessao) {
      return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
    }
    req.cidadao = {
      id: sessao.cidadao_id,
      nome: sessao.nome,
      cpf: sessao.cpf,
      email: sessao.email,
      telefone: sessao.telefone,
      is_admin: !!sessao.is_admin,
    };
    req.token = token;
    next();
  }

  function adminAuthMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
      if (!req.cidadao.is_admin) {
        return res.status(403).json({
          erro: 'Acesso restrito. Use o login administrativo em /admin/login.html',
        });
      }
      next();
    });
  }

  function criarSessao(cidadaoId) {
    const token = gerarToken();
    const expira = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessoes (token, cidadao_id, expira_em) VALUES (?,?,?)').run(
      token,
      cidadaoId,
      expira.slice(0, 19).replace('T', ' ')
    );
    return token;
  }

  app.post('/api/auth/registro', (req, res) => {
    const { nome, cpf, senha, email, telefone } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
    const cpfNum = normalizarCpf(cpf);
    if (!cpfNum) return res.status(400).json({ erro: 'CPF é obrigatório' });
    if (!cpfValido(cpfNum)) return res.status(400).json({ erro: 'CPF inválido' });
    if (!senha || senha.length < 6) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres' });
    }
    const existe = db.prepare('SELECT id FROM cidadaos WHERE cpf = ?').get(cpfNum);
    if (existe) return res.status(409).json({ erro: 'CPF já cadastrado. Faça login.' });

    const r = db
      .prepare(
        'INSERT INTO cidadaos (nome, cpf, email, telefone, senha_hash, is_admin) VALUES (?,?,?,?,?,0)'
      )
      .run(nome.trim(), cpfNum, email?.trim() || null, telefone?.trim() || null, hashSenha(senha));

    const cidadao = db.prepare('SELECT * FROM cidadaos WHERE id = ?').get(r.lastInsertRowid);
    const token = criarSessao(cidadao.id);

    res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso',
      token,
      cidadao: cidadaoPublico(cidadao),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { cpf, senha } = req.body;
    const cpfNum = normalizarCpf(cpf);
    if (!cpfNum) return res.status(400).json({ erro: 'CPF é obrigatório' });
    if (!senha) return res.status(400).json({ erro: 'Senha é obrigatória' });

    const cidadao = db.prepare('SELECT * FROM cidadaos WHERE cpf = ?').get(cpfNum);
    if (!cidadao || !verificarSenha(senha, cidadao.senha_hash)) {
      return res.status(401).json({ erro: 'CPF ou senha incorretos' });
    }

    const token = criarSessao(cidadao.id);
    res.json({
      mensagem: 'Login realizado',
      token,
      cidadao: cidadaoComPerfil(cidadao),
    });
  });

  app.post('/api/auth/admin/login', (req, res) => {
    const { cpf, senha } = req.body;
    const cpfNum = normalizarCpf(cpf);
    if (!cpfNum) return res.status(400).json({ erro: 'CPF é obrigatório' });
    if (!senha) return res.status(400).json({ erro: 'Senha é obrigatória' });

    const cidadao = db.prepare('SELECT * FROM cidadaos WHERE cpf = ?').get(cpfNum);
    if (!cidadao || !verificarSenha(senha, cidadao.senha_hash)) {
      return res.status(401).json({ erro: 'CPF ou senha incorretos' });
    }
    if (!cidadao.is_admin) {
      return res.status(403).json({
        erro: 'Este CPF não tem permissão de administrador. Solicite acesso a um gestor municipal.',
      });
    }

    const token = criarSessao(cidadao.id);
    res.json({
      mensagem: 'Login administrativo realizado',
      token,
      admin: adminPublico(cidadao),
    });
  });

  app.post('/api/auth/logout', authMiddleware, (req, res) => {
    db.prepare('DELETE FROM sessoes WHERE token = ?').run(req.token);
    res.json({ mensagem: 'Logout realizado' });
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ cidadao: cidadaoComPerfil(req.cidadao) });
  });

  app.delete('/api/auth/me', authMiddleware, (req, res) => {
    const cidadaoId = req.cidadao.id;
    db.prepare('DELETE FROM solicitacoes WHERE cidadao_id = ?').run(cidadaoId);
    db.prepare('DELETE FROM sessoes WHERE cidadao_id = ?').run(cidadaoId);
    db.prepare('DELETE FROM cidadaos WHERE id = ?').run(cidadaoId);
    res.json({ mensagem: 'Conta excluída com sucesso' });
  });

  app.get('/api/auth/admin/me', adminAuthMiddleware, (req, res) => {
    res.json({ admin: adminPublico(req.cidadao) });
  });

  app.get('/api/auth/minhas-solicitacoes', authMiddleware, (req, res) => {
    const lista = db
      .prepare(
        'SELECT * FROM solicitacoes WHERE cidadao_id = ? ORDER BY criado_em DESC LIMIT 20'
      )
      .all(req.cidadao.id);
    res.json(lista);
  });

  return { authMiddleware, adminAuthMiddleware };
}

module.exports = { registrarRotasAuth };
