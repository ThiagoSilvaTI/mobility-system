const { normalizarCpf, formatarCpf } = require('./auth-utils');

function registrarRotasAdmin(app, db, adminAuthMiddleware) {
  app.get('/api/admin/cidadaos', adminAuthMiddleware, (req, res) => {
    const busca = (req.query.busca || '').trim();
    let sql = 'SELECT id, nome, cpf, email, telefone, is_admin, criado_em FROM cidadaos';
    const params = [];
    if (busca) {
      const cpf = normalizarCpf(busca);
      sql += ' WHERE nome LIKE ? OR cpf LIKE ?';
      params.push(`%${busca}%`, `%${cpf || busca.replace(/\D/g, '')}%`);
    }
    sql += ' ORDER BY is_admin DESC, nome ASC LIMIT 100';
    const lista = db.prepare(sql).all(...params).map((c) => ({
      id: c.id,
      nome: c.nome,
      cpf: formatarCpf(c.cpf),
      cpfNumeros: c.cpf,
      email: c.email || '',
      telefone: c.telefone || '',
      isAdmin: !!c.is_admin,
      criadoEm: c.criado_em,
    }));
    res.json(lista);
  });

  app.post('/api/admin/acessos', adminAuthMiddleware, (req, res) => {
    const cpfNum = normalizarCpf(req.body.cpf);
    if (!cpfNum) return res.status(400).json({ erro: 'Informe o CPF' });

    const cidadao = db.prepare('SELECT id, nome, cpf, is_admin FROM cidadaos WHERE cpf = ?').get(cpfNum);
    if (!cidadao) {
      return res.status(404).json({
        erro: 'CPF não cadastrado. O cidadão precisa criar conta antes de receber acesso admin.',
      });
    }
    if (cidadao.is_admin) {
      return res.status(409).json({ erro: 'Este CPF já possui acesso de administrador.' });
    }

    db.prepare('UPDATE cidadaos SET is_admin = 1 WHERE id = ?').run(cidadao.id);
    res.json({
      mensagem: `Acesso admin concedido a ${cidadao.nome}`,
      cidadao: { id: cidadao.id, nome: cidadao.nome, cpf: formatarCpf(cidadao.cpf), isAdmin: true },
    });
  });

  app.delete('/api/admin/acessos', adminAuthMiddleware, (req, res) => {
    const cpfNum = normalizarCpf(req.body.cpf);
    if (!cpfNum) return res.status(400).json({ erro: 'Informe o CPF' });

    const cidadao = db.prepare('SELECT id, nome, cpf, is_admin FROM cidadaos WHERE cpf = ?').get(cpfNum);
    if (!cidadao) return res.status(404).json({ erro: 'CPF não encontrado' });
    if (!cidadao.is_admin) {
      return res.status(400).json({ erro: 'Este CPF não é administrador' });
    }

    if (cidadao.id === req.cidadao.id) {
      return res.status(400).json({ erro: 'Você não pode remover seu próprio acesso admin' });
    }

    const totalAdmins = db.prepare('SELECT COUNT(*) as c FROM cidadaos WHERE is_admin = 1').get();
    if (totalAdmins.c <= 1) {
      return res.status(400).json({ erro: 'Não é possível remover o último administrador do sistema' });
    }

    db.prepare('UPDATE cidadaos SET is_admin = 0 WHERE id = ?').run(cidadao.id);
    res.json({
      mensagem: `Acesso admin removido de ${cidadao.nome}`,
      cidadao: { id: cidadao.id, nome: cidadao.nome, cpf: formatarCpf(cidadao.cpf), isAdmin: false },
    });
  });
}

module.exports = { registrarRotasAdmin };
