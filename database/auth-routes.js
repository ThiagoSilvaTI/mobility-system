// database/auth-routes.js
function registrarRotasAuth(app, db) {
  
  // Middleware de autenticação
  const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }
    
    const token = authHeader.substring(7);
    // Token simples: base64 do cpf
    try {
      const cpf = Buffer.from(token, 'base64').toString();
      const cidadao = db.getUserByCPF(cpf);
      if (!cidadao) {
        return res.status(401).json({ erro: 'Token inválido' });
      }
      req.cidadao = cidadao;
      next();
    } catch {
      return res.status(401).json({ erro: 'Token inválido' });
    }
  };
  
  // Middleware de autenticação admin
  const adminAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }
    
    const token = authHeader.substring(7);
    try {
      const cpf = Buffer.from(token, 'base64').toString();
      const admin = db.getUserByCPF(cpf);
      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ erro: 'Acesso negado. Requer privilégios administrativos.' });
      }
      req.admin = admin;
      next();
    } catch {
      return res.status(401).json({ erro: 'Token inválido' });
    }
  };
  
  // Registro de usuário
  app.post('/api/auth/registro', async (req, res) => {
    const { nome, cpf, telefone, email, senha } = req.body;
    
    if (!nome || !cpf || !senha) {
      return res.status(400).json({ erro: 'Nome, CPF e senha são obrigatórios' });
    }
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    const existingUser = db.getUserByCPF(cpfLimpo);
    if (existingUser) {
      return res.status(400).json({ erro: 'CPF já cadastrado' });
    }
    
    const newUser = db.createUser({
      nome,
      cpf,
      telefone: telefone || '',
      email: email || '',
      senha
    });
    
    const token = Buffer.from(newUser.cpf).toString('base64');
    res.status(201).json({
      token,
      cidadao: {
        id: newUser.id,
        nome: newUser.nome,
        cpf: newUser.cpfFormatado,
        email: newUser.email,
        telefone: newUser.telefone,
        isAdmin: newUser.isAdmin
      }
    });
  });
  
  // Login
  app.post('/api/auth/login', (req, res) => {
    const { cpf, senha } = req.body;
    
    if (!cpf || !senha) {
      return res.status(400).json({ erro: 'CPF e senha são obrigatórios' });
    }
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    const user = db.getUserByCPF(cpfLimpo);
    
    if (!user || user.senha !== senha) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos' });
    }
    
    const token = Buffer.from(user.cpf).toString('base64');
    res.json({
      token,
      cidadao: {
        id: user.id,
        nome: user.nome,
        cpf: user.cpfFormatado,
        email: user.email,
        telefone: user.telefone,
        isAdmin: user.isAdmin
      }
    });
  });
  
  // Admin login
  app.post('/api/auth/admin/login', (req, res) => {
    const { cpf, senha } = req.body;
    
    if (!cpf || !senha) {
      return res.status(400).json({ erro: 'CPF e senha são obrigatórios' });
    }
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    const admin = db.getUserByCPF(cpfLimpo);
    
    if (!admin || admin.senha !== senha || !admin.isAdmin) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos, ou usuário não é administrador' });
    }
    
    const token = Buffer.from(admin.cpf).toString('base64');
    res.json({
      token,
      admin: {
        id: admin.id,
        nome: admin.nome,
        cpf: admin.cpfFormatado,
        email: admin.email,
        isAdmin: admin.isAdmin
      }
    });
  });
  
  // Obter dados do usuário atual
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({
      cidadao: {
        id: req.cidadao.id,
        nome: req.cidadao.nome,
        cpf: req.cidadao.cpfFormatado,
        email: req.cidadao.email,
        telefone: req.cidadao.telefone,
        isAdmin: req.cidadao.isAdmin
      }
    });
  });
  
  // Admin: obter dados do admin atual
  app.get('/api/auth/admin/me', adminAuthMiddleware, (req, res) => {
    res.json({
      admin: {
        id: req.admin.id,
        nome: req.admin.nome,
        cpf: req.admin.cpfFormatado,
        email: req.admin.email,
        isAdmin: req.admin.isAdmin
      }
    });
  });
  
  // Logout (apenas limpa no cliente)
  app.post('/api/auth/logout', (req, res) => {
    res.json({ ok: true });
  });
  
  // Deletar conta
  app.delete('/api/auth/me', authMiddleware, (req, res) => {
    const deleted = db.deleteUser(req.cidadao.id);
    if (deleted) {
      res.json({ ok: true, mensagem: 'Conta excluída com sucesso' });
    } else {
      res.status(404).json({ erro: 'Usuário não encontrado' });
    }
  });
  
  // Minhas solicitações
  app.get('/api/auth/minhas-solicitacoes', authMiddleware, (req, res) => {
    const solicitacoes = db.getSolicitacoesByCidadao(req.cidadao.id);
    res.json(solicitacoes.map(s => ({
      ...s,
      criado_em: new Date(s.criado_em).toLocaleDateString('pt-BR')
    })));
  });
  
  return { authMiddleware, adminAuthMiddleware };
}

module.exports = { registrarRotasAuth };