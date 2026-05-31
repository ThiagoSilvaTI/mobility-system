# MobiCidade — Mobilidade Urbana Inteligente

Plataforma digital de mobilidade urbana com app para cidadãos e painel de gestão municipal.

## Login de cidadãos

- Cadastro em `/cadastro.html` com **CPF obrigatório** (validação de dígitos)
- Login em `/login.html` com CPF + senha
- Um cadastro por CPF
- Conta demo: **096.209.973-28** / senha **123456**

## Área administrativa (separada)

- Login: http://localhost:3000/admin/login.html
- Apenas CPFs com perfil **admin** acessam o painel
- Admins podem conceder/revogar acesso admin a outros CPFs já cadastrados
- O app do cidadão **não exibe** link para o admin

## Funcionalidades

### App do usuário (`/`)
- Mapa da cidade com veículos em tempo real (ônibus, vans, bicicletas)
- Planejamento de rotas com tempo estimado e pontos de embarque
- Consulta de horários por linha e tipo
- Rastreamento em tempo real (WebSocket)
- Solicitação de transporte sob demanda (regiões menos atendidas)
- Acessibilidade: alto contraste, fonte ampliada, redução de animações, ARIA

### Painel municipal (`/admin.html`)
- KPIs: frota ativa, passageiros, solicitações, CO₂ evitado
- Gráficos de fluxo e demanda por região
- Rotas mais utilizadas
- Indicadores ambientais
- Gestão de solicitações sob demanda

## Tecnologias

- HTML, CSS, JavaScript
- Node.js + Express
- SQLite nativo (`node:sqlite`)
- Leaflet + OpenStreetMap
- Chart.js (admin)
- Python opcional (`scripts/analytics.py`)

## Como rodar

```bash
cd mobilidade-urbana
npm install
npm run init-db
npm start
```

> **Node.js 22.5+** necessário (você está no 24 — ok).
> Se `init-db` falhar com arquivo em uso, pare o servidor (`Ctrl+C`) e use `npm run reset-db` para recriar os dados.

Acesse:
- **App:** http://localhost:3000
- **Admin:** http://localhost:3000/admin.html

### Análise Python (opcional)

```bash
python scripts/analytics.py
```

## Estrutura

```
mobilidade-urbana/
├── server.js           # API REST + WebSocket
├── database/
│   ├── init.js         # Cria e popula o banco
│   └── mobilidade.db   # Gerado após init-db
├── public/
│   ├── index.html      # App cidadão
│   ├── admin.html      # Painel municipal
│   ├── css/
│   └── js/
└── scripts/
    └── analytics.py
```

## API principal

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/veiculos` | Posição dos veículos |
| POST | `/api/rotas/planejar` | Planejar viagem |
| GET | `/api/horarios` | Horários |
| POST | `/api/solicitacoes` | Transporte sob demanda |
| GET | `/api/admin/dashboard` | Dados do painel |

WebSocket: conexão na mesma porta para atualização de veículos a cada 4s.
