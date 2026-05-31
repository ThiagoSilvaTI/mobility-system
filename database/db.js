// database/db.js
const {
  USERS_FILE,
  VEICULOS_FILE,
  PARADAS_FILE,
  ROTAS_FILE,
  HORARIOS_FILE,
  SOLICITACOES_FILE,
  FLUXO_FILE,
  METRICAS_REGIAO_FILE,
  CIDADE_FILE,
  readJSON,
  writeJSON
} = require('./init');

class JSONDatabase {
  constructor() {
    this.users = readJSON(USERS_FILE);
    this.veiculos = readJSON(VEICULOS_FILE);
    this.paradas = readJSON(PARADAS_FILE);
    this.rotas = readJSON(ROTAS_FILE);
    this.horarios = readJSON(HORARIOS_FILE);
    this.solicitacoes = readJSON(SOLICITACOES_FILE);
    this.fluxoDiario = readJSON(FLUXO_FILE);
    this.metricasRegiao = readJSON(METRICAS_REGIAO_FILE);
    this.cidade = readJSON(CIDADE_FILE);
  }

  // Salvar alterações
  saveUsers() {
    writeJSON(USERS_FILE, this.users);
  }

  saveVeiculos() {
    writeJSON(VEICULOS_FILE, this.veiculos);
  }

  saveSolicitacoes() {
    writeJSON(SOLICITACOES_FILE, this.solicitacoes);
  }

  saveAll() {
    this.saveUsers();
    this.saveVeiculos();
    this.saveSolicitacoes();
  }

  // Usuários
  getUserByCPF(cpf) {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.users.find(u => u.cpf === cpfLimpo);
  }

  getUserById(id) {
    return this.users.find(u => u.id === id);
  }

  getAllUsers() {
    return [...this.users];
  }

  createUser(userData) {
    const newId = this.users.length > 0 ? Math.max(...this.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      ...userData,
      cpf: userData.cpf.replace(/\D/g, ''),
      cpfFormatado: userData.cpf,
      isAdmin: false,
      criado_em: new Date().toISOString()
    };
    this.users.push(newUser);
    this.saveUsers();
    return newUser;
  }

  updateUser(id, updates) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updates };
      this.saveUsers();
      return this.users[index];
    }
    return null;
  }

  deleteUser(id) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      const deleted = this.users.splice(index, 1)[0];
      this.saveUsers();
      return deleted;
    }
    return null;
  }

  // Veículos
  getAllVeiculos() {
    return this.veiculos.filter(v => v.ativo === 1);
  }

  getVeiculoById(id) {
    return this.veiculos.find(v => v.id === id);
  }

  updateVeiculo(id, updates) {
    const index = this.veiculos.findIndex(v => v.id === id);
    if (index !== -1) {
      this.veiculos[index] = { ...this.veiculos[index], ...updates };
      this.saveVeiculos();
      return this.veiculos[index];
    }
    return null;
  }

  // Paradas
  getAllParadas() {
    return [...this.paradas];
  }

  // Rotas
  getAllRotas() {
    return [...this.rotas];
  }

  getRotasMaisUsadas(limit = 6) {
    return [...this.rotas].sort((a, b) => b.embarques - a.embarques).slice(0, limit);
  }

  // Horários
  getHorarios(filters = {}) {
    let result = [...this.horarios];
    if (filters.linha) {
      result = result.filter(h => h.linha.toLowerCase().includes(filters.linha.toLowerCase()));
    }
    if (filters.tipo) {
      result = result.filter(h => h.tipo === filters.tipo);
    }
    return result;
  }

  // Solicitações
  getAllSolicitacoes() {
    return [...this.solicitacoes].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  }

  getSolicitacoesByCidadao(cidadaoId) {
    return this.solicitacoes.filter(s => s.cidadao_id === cidadaoId).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  }

  getSolicitacoesPendentes() {
    return this.solicitacoes.filter(s => s.status === 'pendente');
  }

  createSolicitacao(data) {
    const newId = this.solicitacoes.length > 0 ? Math.max(...this.solicitacoes.map(s => s.id)) + 1 : 1;
    const newSolicitacao = {
      id: newId,
      ...data,
      status: 'pendente',
      criado_em: new Date().toISOString()
    };
    this.solicitacoes.push(newSolicitacao);
    this.saveSolicitacoes();
    return newSolicitacao;
  }

  updateSolicitacao(id, updates) {
    const index = this.solicitacoes.findIndex(s => s.id === id);
    if (index !== -1) {
      this.solicitacoes[index] = { ...this.solicitacoes[index], ...updates };
      this.saveSolicitacoes();
      return this.solicitacoes[index];
    }
    return null;
  }

  // Fluxo diário
  getFluxoDiario() {
    return [...this.fluxoDiario];
  }

  // Métricas por região
  getMetricasRegiao() {
    return [...this.metricasRegiao];
  }

  // Dashboard KPIs
  getDashboardData() {
    const veiculosAtivos = this.veiculos.filter(v => v.ativo === 1).length;
    const solicitacoesPendentes = this.solicitacoes.filter(s => s.status === 'pendente').length;
    const passageirosHoje = this.fluxoDiario[this.fluxoDiario.length - 1]?.passageiros || 0;
    const co2Total = this.metricasRegiao.reduce((sum, r) => sum + r.co2_kg, 0);
    
    const tipos = this.veiculos.reduce((acc, v) => {
      if (v.ativo === 1) {
        acc[v.tipo] = (acc[v.tipo] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      kpis: {
        veiculosAtivos,
        solicitacoesPendentes,
        passageirosHoje,
        co2EvitadoMes: Math.round(co2Total)
      },
      rotasMaisUsadas: this.getRotasMaisUsadas(),
      demandaPorRegiao: this.metricasRegiao,
      fluxoPassageiros: this.fluxoDiario,
      frotaPorTipo: Object.entries(tipos).map(([tipo, qtd]) => ({ tipo, qtd })),
      indicadoresAmbientais: {
        co2EvitadoKg: co2Total,
        viagensSustentaveis: this.fluxoDiario.reduce((sum, f) => sum + f.viagens, 0),
        modaisVerdes: (tipos.bicicleta || 0) + (tipos.van || 0)
      }
    };
  }
}

let db = null;

function openDb() {
  if (!db) {
    db = new JSONDatabase();
  }
  return db;
}

module.exports = {
  openDb,
  JSONDatabase
};