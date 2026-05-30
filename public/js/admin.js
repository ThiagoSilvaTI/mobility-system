const API = '';
let chartFluxo, chartRegiao;

async function carregarDashboard() {
  const [dashRes, solRes] = await Promise.all([
    adminFetch(`${API}/api/admin/dashboard`),
    adminFetch(`${API}/api/solicitacoes`),
  ]);
  const dash = await dashRes.json();
  const solicitacoes = await solRes.json();

  document.getElementById('kpiVeiculos').textContent = dash.kpis.veiculosAtivos.toLocaleString('pt-BR');
  document.getElementById('kpiPassageiros').textContent = dash.kpis.passageirosHoje.toLocaleString('pt-BR');
  document.getElementById('kpiSolicitacoes').textContent = dash.kpis.solicitacoesPendentes;
  document.getElementById('kpiCo2').textContent = Number(dash.kpis.co2EvitadoMes).toLocaleString('pt-BR');

  renderTabelaRotas(dash.rotasMaisUsadas);
  renderTabelaRegioes(dash.demandaPorRegiao);
  renderEco(dash.indicadoresAmbientais);
  renderSolicitacoes(solicitacoes);
  renderCharts(dash.fluxoPassageiros, dash.demandaPorRegiao);
}

function renderTabelaRotas(rotas) {
  const tbody = document.querySelector('#tabelaRotas tbody');
  tbody.innerHTML = rotas
    .map(
      (r) => `<tr>
      <td>${r.nome}</td>
      <td>${r.tipo}</td>
      <td>${r.duracao_min} min</td>
      <td>${r.embarques.toLocaleString('pt-BR')}</td>
      <td>${r.co2_evitado_kg} kg</td>
    </tr>`
    )
    .join('');
}

function renderTabelaRegioes(regioes) {
  const tbody = document.querySelector('#tabelaRegioes tbody');
  tbody.innerHTML = regioes
    .map(
      (r) => `<tr>
      <td>${r.regiao}</td>
      <td>${r.demanda}%</td>
      <td>${r.passageiros_dia.toLocaleString('pt-BR')}</td>
      <td>${r.co2_kg}</td>
    </tr>`
    )
    .join('');
}

function renderEco(ind) {
  document.getElementById('ecoIndicadores').innerHTML = `
    <div class="eco-item"><span>CO₂ evitado total</span><strong>${Math.round(ind.co2EvitadoKg).toLocaleString('pt-BR')} kg</strong></div>
    <div class="eco-item"><span>Viagens sustentáveis</span><strong>${ind.viagensSustentaveis.toLocaleString('pt-BR')}</strong></div>
    <div class="eco-item"><span>Modais verdes ativos</span><strong>${ind.modaisVerdes}</strong></div>
  `;
}

function renderSolicitacoes(lista) {
  const tbody = document.querySelector('#tabelaSolicitacoes tbody');
  tbody.innerHTML = lista
    .map(
      (s) => `<tr>
      <td>${s.id}</td>
      <td>${s.nome || '—'}</td>
      <td>${s.origem}</td>
      <td>${s.destino}</td>
      <td>${s.regiao}</td>
      <td><span class="status status--${s.status}">${s.status}</span></td>
      <td>
        ${s.status === 'pendente' ? `
          <button class="btn-sm" data-id="${s.id}" data-status="aprovado">Aprovar</button>
          <button class="btn-sm" data-id="${s.id}" data-status="em_andamento">Em andamento</button>
        ` : '—'}
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('.btn-sm').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await adminFetch(`${API}/api/solicitacoes/${btn.dataset.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: btn.dataset.status }),
      });
      carregarDashboard();
    });
  });
}

async function carregarCidadaos(busca = '') {
  const params = busca ? `?busca=${encodeURIComponent(busca)}` : '';
  const res = await adminFetch(`${API}/api/admin/cidadaos${params}`);
  const lista = await res.json();
  const tbody = document.querySelector('#tabelaCidadaos tbody');
  const eu = getAdminUsuario();

  tbody.innerHTML = lista
    .map((c) => {
      const perfil = c.isAdmin
        ? '<span class="badge-admin">Administrador</span>'
        : '<span class="badge-cidadao">Cidadão</span>';
      let acao = '—';
      if (c.isAdmin && c.id !== eu?.id) {
        acao = `<button type="button" class="btn-sm btn-sm--danger" data-cpf="${c.cpfNumeros}">Revogar admin</button>`;
      } else if (!c.isAdmin) {
        acao = `<button type="button" class="btn-sm" data-cpf="${c.cpfNumeros}" data-promover>Conceder admin</button>`;
      }
      return `<tr>
        <td>${c.nome}</td>
        <td>${c.cpf}</td>
        <td>${perfil}</td>
        <td>${acao}</td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-promover]').forEach((btn) => {
    btn.addEventListener('click', () => concederAdmin(btn.dataset.cpf));
  });
  tbody.querySelectorAll('.btn-sm--danger').forEach((btn) => {
    btn.addEventListener('click', () => revogarAdmin(btn.dataset.cpf));
  });
}

function mostrarMsgAcessos(texto, tipo = 'ok') {
  const el = document.getElementById('msgAcessos');
  el.textContent = texto;
  el.className = `auth-msg auth-msg--${tipo}`;
  el.hidden = false;
}

async function concederAdmin(cpf) {
  const res = await adminFetch(`${API}/api/admin/acessos`, {
    method: 'POST',
    body: JSON.stringify({ cpf }),
  });
  const data = await res.json();
  if (!res.ok) {
    mostrarMsgAcessos(data.erro || 'Erro', 'erro');
    return;
  }
  mostrarMsgAcessos(data.mensagem, 'ok');
  carregarCidadaos(document.getElementById('buscaCidadao').value);
}

async function revogarAdmin(cpf) {
  if (!confirm('Remover acesso administrativo deste CPF?')) return;
  const res = await adminFetch(`${API}/api/admin/acessos`, {
    method: 'DELETE',
    body: JSON.stringify({ cpf }),
  });
  const data = await res.json();
  if (!res.ok) {
    mostrarMsgAcessos(data.erro || 'Erro', 'erro');
    return;
  }
  mostrarMsgAcessos(data.mensagem, 'ok');
  carregarCidadaos(document.getElementById('buscaCidadao').value);
}

function renderCharts(fluxo, regioes) {
  const ctxF = document.getElementById('chartFluxo');
  const ctxR = document.getElementById('chartRegiao');
  if (chartFluxo) chartFluxo.destroy();
  if (chartRegiao) chartRegiao.destroy();

  chartFluxo = new Chart(ctxF, {
    type: 'line',
    data: {
      labels: fluxo.map((f) => f.data.slice(5)),
      datasets: [{
        label: 'Passageiros',
        data: fluxo.map((f) => f.passageiros),
        borderColor: '#1a8f6a',
        backgroundColor: 'rgba(26,143,106,0.15)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });

  chartRegiao = new Chart(ctxR, {
    type: 'bar',
    data: {
      labels: regioes.map((r) => r.regiao),
      datasets: [{
        label: 'Demanda (%)',
        data: regioes.map((r) => r.demanda),
        backgroundColor: ['#1a8f6a', '#2ecc9a', '#0e6b8a', '#27ae60', '#16a085', '#8e44ad', '#2980b9'],
      }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function renderAdminUser() {
  const u = getAdminUsuario();
  const el = document.getElementById('adminUserBar');
  if (el && u) {
    el.innerHTML = `<small>Logado como</small><strong>${u.nome}</strong><span>${u.cpf}</span>`;
  }
}

document.getElementById('btnAtualizar')?.addEventListener('click', () => {
  carregarDashboard();
  carregarCidadaos(document.getElementById('buscaCidadao')?.value || '');
});

document.getElementById('btnLogoutAdmin')?.addEventListener('click', logoutAdmin);

document.getElementById('cpfAdmin')?.addEventListener('input', (e) => {
  e.target.value = mascararCpf(e.target.value);
});

document.getElementById('formConcederAdmin')?.addEventListener('submit', (e) => {
  e.preventDefault();
  concederAdmin(document.getElementById('cpfAdmin').value);
  document.getElementById('cpfAdmin').value = '';
});

let buscaTimer;
document.getElementById('buscaCidadao')?.addEventListener('input', (e) => {
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(() => carregarCidadaos(e.target.value), 300);
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!exigirAdmin()) return;
  const admin = await validarSessaoAdmin();
  if (!admin) {
    window.location.href = '/admin/login.html';
    return;
  }
  renderAdminUser();
  carregarDashboard();
  carregarCidadaos();
});
