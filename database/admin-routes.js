// database/admin-routes.js
function registrarRotasAdmin(app, db, adminAuthMiddleware) {
  
  // Listar todos os cidadãos
  app.get('/api/admin/cidadaos', adminAuthMiddleware, (req, res) => {
    const { busca } = req.query;
    let users = db.getAllUsers();
    
    if (busca) {
      const termo = busca.toLowerCase();
      users = users.filter(u => 
        u.nome.toLowerCase().includes(termo) || 
        u.cpf.includes(termo)
      );
    }
    
    res.json(users.map(u => ({
      id: u.id,
      nome: u.nome,
      cpf: u.cpfFormatado,
      cpfNumeros: u.cpf,
      email: u.email,
      telefone: u.telefone,
      isAdmin: u.isAdmin
    })));
  });
  
  // Conceder acesso admin
  app.post('/api/admin/acessos', adminAuthMiddleware, (req, res) => {
    const { cpf } = req.body;
    if (!cpf) {
      return res.status(400).json({ erro: 'CPF é obrigatório' });
    }
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    const user = db.getUserByCPF(cpfLimpo);
    
    if (!user) {
      return res.status(404).json({ erro: 'Cidadão não encontrado' });
    }
    
    if (user.isAdmin) {
      return res.status(400).json({ erro: 'Usuário já é administrador' });
    }
    
    db.updateUser(user.id, { isAdmin: true });
    res.json({ mensagem: `Acesso administrativo concedido para ${user.nome}` });
  });
  
  // Revogar acesso admin
  app.delete('/api/admin/acessos', adminAuthMiddleware, (req, res) => {
    const { cpf } = req.body;
    if (!cpf) {
      return res.status(400).json({ erro: 'CPF é obrigatório' });
    }
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    const user = db.getUserByCPF(cpfLimpo);
    
    if (!user) {
      return res.status(404).json({ erro: 'Cidadão não encontrado' });
    }
    
    if (!user.isAdmin) {
      return res.status(400).json({ erro: 'Usuário não é administrador' });
    }
    
    if (user.cpf === '12345678900') {
      return res.status(403).json({ erro: 'Não é possível revogar acesso do administrador principal' });
    }
    
    db.updateUser(user.id, { isAdmin: false });
    res.json({ mensagem: `Acesso administrativo revogado para ${user.nome}` });
  });
  
  // Dashboard
  app.get('/api/admin/dashboard', adminAuthMiddleware, (req, res) => {
    res.json(db.getDashboardData());
  });
  
  // Solicitações (admin)
  app.get('/api/solicitacoes', adminAuthMiddleware, (req, res) => {
    res.json(db.getAllSolicitacoes());
  });
  
  // Atualizar solicitação
  app.patch('/api/solicitacoes/:id', adminAuthMiddleware, (req, res) => {
    const { status } = req.body;
    const id = parseInt(req.params.id);
    const solicitacao = db.updateSolicitacao(id, { status });
    
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada' });
    }
    
    res.json({ ok: true });
  });
}

module.exports = { registrarRotasAdmin };