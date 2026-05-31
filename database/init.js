// database/init.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VEICULOS_FILE = path.join(DATA_DIR, 'veiculos.json');
const PARADAS_FILE = path.join(DATA_DIR, 'paradas.json');
const ROTAS_FILE = path.join(DATA_DIR, 'rotas.json');
const HORARIOS_FILE = path.join(DATA_DIR, 'horarios.json');
const SOLICITACOES_FILE = path.join(DATA_DIR, 'solicitacoes.json');
const FLUXO_FILE = path.join(DATA_DIR, 'fluxo_diario.json');
const METRICAS_REGIAO_FILE = path.join(DATA_DIR, 'metricas_regiao.json');
const CIDADE_FILE = path.join(DATA_DIR, 'cidade.json');

const cidade = require('../config/cidade');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(file, defaultValue = []) {
  if (fs.existsSync(file)) {
    try {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Erro ao ler ${file}:`, err);
      return defaultValue;
    }
  }
  return defaultValue;
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function initUsers() {
  const users = readJSON(USERS_FILE, []);
  
  // Verifica se já existe o admin
  const adminExists = users.some(u => u.cpf === '12345678900');
  
  if (users.length === 0) {
    // Usuários iniciais
    const initialUsers = [
      {
        id: 1,
        nome: 'Administrador',
        cpf: '12345678900',
        cpfFormatado: '123.456.789-00',
        senha: 'admin123',
        email: 'admin@mobicidade.com',
        telefone: '(98) 99999-0000',
        isAdmin: true,
        criado_em: new Date().toISOString()
      },
      {
        id: 2,
        nome: 'João Silva',
        cpf: '52998224725',
        cpfFormatado: '529.982.247-25',
        senha: '123456',
        email: 'joao@email.com',
        telefone: '(98) 91234-5678',
        isAdmin: false,
        criado_em: new Date().toISOString()
      },
      {
        id: 3,
        nome: 'Maria Santos',
        cpf: '12345678909',
        cpfFormatado: '123.456.789-09',
        senha: '123456',
        email: 'maria@email.com',
        telefone: '(98) 98765-4321',
        isAdmin: false,
        criado_em: new Date().toISOString()
      }
    ];
    writeJSON(USERS_FILE, initialUsers);
    console.log('✅ Usuários inicializados com admin CPF: 123.456.789-00');
  } else if (!adminExists) {
    // Adiciona admin se não existir
    const adminUser = {
      id: users.length + 1,
      nome: 'Administrador',
      cpf: '12345678900',
      cpfFormatado: '123.456.789-00',
      senha: 'admin123',
      email: 'admin@mobicidade.com',
      telefone: '(98) 99999-0000',
      isAdmin: true,
      criado_em: new Date().toISOString()
    };
    users.push(adminUser);
    writeJSON(USERS_FILE, users);
    console.log('✅ Admin adicionado: 123.456.789-00');
  }
  
  return readJSON(USERS_FILE);
}

function initVeiculos() {
  const veiculos = readJSON(VEICULOS_FILE, []);
  if (veiculos.length === 0) {
    const initialVeiculos = cidade.veiculos.map((v, idx) => ({
      id: idx + 1,
      tipo: v[0],
      linha: v[1],
      placa: v[2],
      lat: v[3],
      lng: v[4],
      ocupacao: v[5],
      ativo: 1
    }));
    writeJSON(VEICULOS_FILE, initialVeiculos);
    console.log(`✅ ${initialVeiculos.length} veículos inicializados`);
  }
  return readJSON(VEICULOS_FILE);
}

function initParadas() {
  const paradas = readJSON(PARADAS_FILE, []);
  if (paradas.length === 0) {
    const initialParadas = cidade.paradas.map((p, idx) => ({
      id: idx + 1,
      nome: p[0],
      lat: p[1],
      lng: p[2]
    }));
    writeJSON(PARADAS_FILE, initialParadas);
    console.log(`✅ ${initialParadas.length} paradas inicializadas`);
  }
  return readJSON(PARADAS_FILE);
}

function initRotas() {
  const rotas = readJSON(ROTAS_FILE, []);
  if (rotas.length === 0) {
    const initialRotas = cidade.rotas.map((r, idx) => ({
      id: idx + 1,
      nome: r[0],
      tipo: r[1],
      origem: r[2],
      destino: r[3],
      duracao_min: r[4],
      embarques: r[5],
      co2_evitado_kg: r[6]
    }));
    writeJSON(ROTAS_FILE, initialRotas);
    console.log(`✅ ${initialRotas.length} rotas inicializadas`);
  }
  return readJSON(ROTAS_FILE);
}

function initHorarios() {
  const horarios = readJSON(HORARIOS_FILE, []);
  if (horarios.length === 0) {
    const initialHorarios = [];
    const horariosDia = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    
    cidade.rotas.forEach((r, idx) => {
      horariosDia.forEach((h, hidx) => {
        initialHorarios.push({
          id: initialHorarios.length + 1,
          linha: r[0].split(' - ')[0],
          tipo: r[1],
          horario: h,
          sentido: 'Centro ↔ Bairro',
          rota_id: idx + 1
        });
      });
    });
    writeJSON(HORARIOS_FILE, initialHorarios);
    console.log(`✅ ${initialHorarios.length} horários inicializados`);
  }
  return readJSON(HORARIOS_FILE);
}

function initSolicitacoes() {
  const solicitacoes = readJSON(SOLICITACOES_FILE, []);
  if (solicitacoes.length === 0) {
    const initialSolicitacoes = [
      {
        id: 1,
        cidadao_id: 2,
        nome: 'João Silva',
        telefone: '(98) 91234-5678',
        origem: 'Zona Rural Norte',
        destino: 'Centro',
        regiao: 'Zona Rural Norte',
        status: 'pendente',
        criado_em: new Date().toISOString()
      },
      {
        id: 2,
        cidadao_id: 3,
        nome: 'Maria Santos',
        telefone: '(98) 98765-4321',
        origem: 'Araçagy',
        destino: 'Hospital Municipal',
        regiao: 'Araçagy',
        status: 'aprovado',
        criado_em: new Date().toISOString()
      }
    ];
    writeJSON(SOLICITACOES_FILE, initialSolicitacoes);
    console.log(`✅ ${initialSolicitacoes.length} solicitações inicializadas`);
  }
  return readJSON(SOLICITACOES_FILE);
}

function initFluxoDiario() {
  const fluxo = readJSON(FLUXO_FILE, []);
  if (fluxo.length === 0) {
    const initialFluxo = [];
    const data = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(data);
      d.setDate(d.getDate() - i);
      initialFluxo.push({
        id: initialFluxo.length + 1,
        data: d.toISOString().split('T')[0],
        passageiros: Math.floor(500 + Math.random() * 3000),
        viagens: Math.floor(200 + Math.random() * 800),
        co2_kg: Math.floor(100 + Math.random() * 400)
      });
    }
    writeJSON(FLUXO_FILE, initialFluxo);
    console.log(`✅ Fluxo diário inicializado`);
  }
  return readJSON(FLUXO_FILE);
}

function initMetricasRegiao() {
  const metricas = readJSON(METRICAS_REGIAO_FILE, []);
  if (metricas.length === 0) {
    const initialMetricas = cidade.regioes.map((r, idx) => ({
      id: idx + 1,
      regiao: r[0],
      demanda: r[1],
      passageiros_dia: r[2],
      co2_kg: r[3]
    }));
    writeJSON(METRICAS_REGIAO_FILE, initialMetricas);
    console.log(`✅ ${initialMetricas.length} métricas por região inicializadas`);
  }
  return readJSON(METRICAS_REGIAO_FILE);
}

function initCidade() {
  writeJSON(CIDADE_FILE, cidade);
  console.log(`✅ Configuração da cidade salva: ${cidade.nome}`);
}

function initDatabase() {
  console.log('\n🚀 Inicializando banco de dados JSON...\n');
  ensureDataDir();
  initUsers();
  initVeiculos();
  initParadas();
  initRotas();
  initHorarios();
  initSolicitacoes();
  initFluxoDiario();
  initMetricasRegiao();
  initCidade();
  console.log('\n✅ Banco de dados JSON inicializado com sucesso!');
  console.log(`📁 Diretório: ${DATA_DIR}\n`);
}

function resetDatabase() {
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    console.log('🗑️  Diretório de dados removido');
  }
  initDatabase();
}

module.exports = {
  initDatabase,
  resetDatabase,
  DATA_DIR,
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
};