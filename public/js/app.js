const API = '';

let cidadeConfig = null;
let CENTRO = [-3.6692, -45.3801];
let DESTINOS = {};
let mapZoom = 15;
let map, mapRast, markersMain = {}, markersRast = {}, routeLayer, ws;
let destinoAtual = [-3.6715, -45.3768];

async function carregarCidade() {
  const res = await fetch(`${API}/api/cidade`);
  cidadeConfig = await res.json();
  CENTRO = [cidadeConfig.centro.lat, cidadeConfig.centro.lng];
  destinoAtual = [cidadeConfig.destinoPadrao.lat, cidadeConfig.destinoPadrao.lng];
  mapZoom = cidadeConfig.zoom || 15;
  DESTINOS = cidadeConfig.destinosBusca || {};
  const tagline = document.querySelector('.tagline');
  if (tagline) tagline.textContent = `${cidadeConfig.nome} — ${cidadeConfig.uf} · Mobilidade inteligente e inclusiva`;
  document.title = `MobiCidade — ${cidadeConfig.nome} (${cidadeConfig.uf})`;
  renderDestinosRapidos(cidadeConfig.destinosRapidos);
}

function renderDestinosRapidos(destinos) {
  const fieldset = document.getElementById('destinosRapidos');
  if (!fieldset || !destinos) return;
  fieldset.innerHTML = `<legend>Destinos rápidos em ${cidadeConfig.nome}</legend>`;
  destinos.forEach((d) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.lat = d.lat;
    btn.dataset.lng = d.lng;
    btn.textContent = d.nome;
    btn.addEventListener('click', () => {
      document.getElementById('destino').value = d.nome;
      buscarRota('', d.lat, d.lng);
    });
    fieldset.appendChild(btn);
  });
}

const icons = {
  onibus: L.divIcon({ className: 'marker-bus', html: '🚌', iconSize: [28, 28], iconAnchor: [14, 14] }),
  van: L.divIcon({ className: 'marker-van', html: '🚐', iconSize: [28, 28], iconAnchor: [14, 14] }),
  bicicleta: L.divIcon({ className: 'marker-bike', html: '🚲', iconSize: [28, 28], iconAnchor: [14, 14] }),
};

function initMap(elId, zoom = mapZoom) {
  const m = L.map(elId).setView(CENTRO, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(m);
  return m;
}

function atualizarMarcadores(veiculos, mapa, store) {
  const ids = new Set(veiculos.map((v) => v.id));
  Object.keys(store).forEach((id) => {
    if (!ids.has(Number(id))) {
      mapa.removeLayer(store[id]);
      delete store[id];
    }
  });
  veiculos.forEach((v) => {
    const ic = icons[v.tipo] || icons.onibus;
    const popup = `<strong>${v.linha || v.tipo}</strong><br>Ocupação: ${v.ocupacao}%<br>Tipo: ${v.tipo}`;
    if (store[v.id]) {
      store[v.id].setLatLng([v.lat, v.lng]);
      store[v.id].setPopupContent(popup);
    } else {
      store[v.id] = L.marker([v.lat, v.lng], { icon: ic })
        .addTo(mapa)
        .bindPopup(popup);
    }
  });
}

async function carregarVeiculos() {
  const res = await authFetch(`${API}/api/veiculos`);
  const dados = await res.json();
  if (map) atualizarMarcadores(dados, map, markersMain);
  if (mapRast) atualizarMarcadores(dados, mapRast, markersRast);
  renderListaVeiculos(dados);
  return dados;
}

function renderListaVeiculos(veiculos) {
  const el = document.getElementById('listaVeiculos');
  if (!el) return;
  el.innerHTML = veiculos
    .map(
      (v) => `
    <article class="veiculo-card veiculo-card--${v.tipo}" role="listitem">
      <h3>${v.tipo === 'onibus' ? '🚌' : v.tipo === 'van' ? '🚐' : '🚲'} ${v.linha || v.tipo}</h3>
      <p>Linha: ${v.linha || '—'}</p>
      <p>Ocupação: <strong>${v.ocupacao}%</strong></p>
      <p>Posição: ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}</p>
    </article>`
    )
    .join('');
}

function conectarWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.tipo === 'veiculos') {
      if (map) atualizarMarcadores(msg.dados, map, markersMain);
      if (mapRast) atualizarMarcadores(msg.dados, mapRast, markersRast);
      renderListaVeiculos(msg.dados);
    }
  };
  ws.onclose = () => setTimeout(conectarWS, 3000);
}

function resolverDestino(texto) {
  const t = texto.toLowerCase().trim();
  for (const [k, coords] of Object.entries(DESTINOS)) {
    if (t.includes(k) || k.includes(t)) return coords;
  }
  return destinoAtual;
}

async function buscarRota(destinoTexto, lat, lng) {
  const coords = lat && lng ? [lat, lng] : resolverDestino(destinoTexto);
  destinoAtual = coords;
  const res = await authFetch(`${API}/api/rotas/planejar`, {
    method: 'POST',
    body: JSON.stringify({ destinoLat: coords[0], destinoLng: coords[1] }),
  });
  const data = await res.json();
  renderRotas(data);
  desenharRota(data);
}

function renderRotas(data) {
  const el = document.getElementById('resultadosRota');
  if (!data.opcoes?.length) {
    el.innerHTML = '<p>Nenhuma rota encontrada.</p>';
    return;
  }
  el.innerHTML = data.opcoes
    .map(
      (o, i) => `
    <article class="rota-card ${i === 0 ? 'rota-card--melhor' : ''}" tabindex="0">
      ${i === 0 ? '<span aria-label="Melhor opção">⭐ Melhor opção</span><br>' : ''}
      <h3>${o.tipoLabel} — ${o.nome}</h3>
      <p class="tempo">${o.tempoMin} min</p>
      <p class="meta">Embarque: <strong>${o.embarque}</strong> · ${o.distanciaKm} km</p>
      <p class="meta">CO₂ evitado: ~${o.co2Evitado} kg · Transferências: ${o.transferencias}</p>
    </article>`
    )
    .join('');

  if (document.body.classList.contains('narracao-ativa')) {
    const melhor = data.opcoes[0];
    el.setAttribute('aria-label', `Melhor rota: ${melhor.nome}, ${melhor.tempoMin} minutos, embarque em ${melhor.embarque}`);
  }
}

function desenharRota(data) {
  if (routeLayer) map.removeLayer(routeLayer);
  const pts = [
    [data.origem.lat, data.origem.lng],
    ...(data.paradasEmbarque || []).slice(0, 2).map((p) => [p.lat, p.lng]),
    [data.destino.lat, data.destino.lng],
  ];
  routeLayer = L.polyline(pts, { color: '#1a8f6a', weight: 5, opacity: 0.8, dashArray: '8,8' }).addTo(map);
  L.marker([data.destino.lat, data.destino.lng], {
    icon: L.divIcon({ html: '📍', iconSize: [24, 24], iconAnchor: [12, 24] }),
  })
    .addTo(map)
    .bindPopup('Seu destino');
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
}

async function buscarHorarios(e) {
  e?.preventDefault();
  const linha = document.getElementById('filtroLinha').value;
  const tipo = document.getElementById('filtroTipo').value;
  const params = new URLSearchParams();
  if (linha) params.set('linha', linha);
  if (tipo) params.set('tipo', tipo);
  const res = await authFetch(`${API}/api/horarios?${params}`);
  const lista = await res.json();
  const el = document.getElementById('listaHorarios');
  if (!lista.length) {
    el.innerHTML = '<p>Nenhum horário encontrado.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>Linha</th><th>Tipo</th><th>Horário</th><th>Sentido</th><th>Rota</th></tr></thead>
      <tbody>
        ${lista.map((h) => `<tr><td>${h.linha}</td><td>${h.tipo}</td><td><strong>${h.horario}</strong></td><td>${h.sentido}</td><td>${h.rota_nome || '—'}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

async function carregarMinhasSolicitacoes() {
  try {
    const res = await authFetch(`${API}/api/auth/minhas-solicitacoes`);
    const lista = await res.json();
    const wrap = document.getElementById('minhasSolicitacoes');
    const ul = document.getElementById('listaMinhasSolicitacoes');
    if (!wrap || !ul || !lista.length) return;
    wrap.hidden = false;
    ul.innerHTML = lista
      .map(
        (s) =>
          `<li><strong>${s.origem}</strong> → ${s.destino}<br><small>${s.regiao} · ${s.status} · ${s.criado_em}</small></li>`
      )
      .join('');
  } catch {
    /* ignora */
  }
}

async function enviarDemanda(e) {
  e.preventDefault();
  const msg = document.getElementById('msgDemanda');
  const body = {
    telefone: document.getElementById('telDemanda').value,
    origem: document.getElementById('origemDemanda').value,
    destino: document.getElementById('destinoDemanda').value,
    regiao: document.getElementById('regiaoDemanda').value,
  };
  try {
    const res = await authFetch(`${API}/api/solicitacoes`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      msg.hidden = false;
      msg.className = 'msg msg--erro';
      msg.textContent = data.erro || 'Erro ao enviar';
      return;
    }
    msg.hidden = false;
    msg.className = 'msg msg--ok';
    msg.textContent = data.mensagem || 'Solicitação enviada!';
    e.target.reset();
    const u = getUsuario();
    if (u?.telefone) document.getElementById('telDemanda').value = u.telefone;
    carregarMinhasSolicitacoes();
  } catch {
    msg.hidden = false;
    msg.className = 'msg msg--erro';
    msg.textContent = 'Erro ao enviar. Tente novamente.';
  }
}

function prepararAreaDemanda(usuario) {
  const info = document.getElementById('demandaUsuarioInfo');
  if (info) info.textContent = `Solicitação vinculada ao CPF ${usuario.cpf} — ${usuario.nome}`;
  const tel = document.getElementById('telDemanda');
  if (tel && usuario.telefone) tel.value = usuario.telefone;
}

function trocarSecao(id) {
  document.querySelectorAll('.section').forEach((s) => {
    s.classList.remove('active');
    s.hidden = true;
  });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  const sec = document.getElementById(`sec-${id}`);
  sec.classList.add('active');
  sec.hidden = false;
  const btn = document.querySelector(`[data-section="${id}"]`);
  btn?.classList.add('active');
  btn?.setAttribute('aria-current', 'page');
  if (id === 'rastreamento' && mapRast) setTimeout(() => mapRast.invalidateSize(), 200);
  if (id === 'horarios') buscarHorarios();
  if (id === 'demanda') carregarMinhasSolicitacoes();
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => trocarSecao(btn.dataset.section));
});

document.getElementById('formRota')?.addEventListener('submit', (e) => {
  e.preventDefault();
  buscarRota(document.getElementById('destino').value);
});

document.getElementById('formHorarios')?.addEventListener('submit', buscarHorarios);
document.getElementById('formDemanda')?.addEventListener('submit', enviarDemanda);

document.addEventListener('DOMContentLoaded', async () => {
  if (!exigirLogin()) return;
  const usuario = await validarSessao();
  if (!usuario) {
    window.location.href = '/login.html';
    return;
  }
  renderUsuarioHeader();
  prepararAreaDemanda(usuario);

  await carregarCidade();
  map = initMap('map');
  mapRast = initMap('mapRastreamento', Math.max(mapZoom - 1, 13));
  carregarVeiculos();
  conectarWS();
  buscarHorarios();
});
