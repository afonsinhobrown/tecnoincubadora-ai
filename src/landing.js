// Gerado a partir de public/index.html — NÃO editar manualmente.
export const LANDING_HTML = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TECNOINCUBADORA AI — Assistentes por sistema</title>
<style>
  :root {
    --azul: #0f4c81; --azul-claro: #e8f1fa; --verde: #0e8a5f;
    --cinza: #64748b; --borda: #e2e8f0; --fundo: #f8fafc; --vermelho: #dc2626;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--fundo); color: #1e293b; min-height: 100vh; }
  header { background: var(--azul); color: #fff; padding: 20px 24px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  header h1 { font-size: 1.25rem; font-weight: 600; }
  header .pill { background: rgba(255,255,255,.15); border-radius: 999px; padding: 4px 12px; font-size: .75rem; }
  main { max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
  .subtitulo { color: var(--cinza); font-size: .95rem; margin-bottom: 20px; text-align: center; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .sistema { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 18px; cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .1s; display: flex; flex-direction: column; gap: 8px; }
  .sistema:hover { border-color: var(--azul); box-shadow: 0 4px 14px rgba(15,76,129,.14); transform: translateY(-2px); }
  .sistema .emoji { font-size: 1.7rem; }
  .sistema .nome { font-weight: 700; font-size: 1.02rem; color: var(--azul); }
  .sistema .desc { font-size: .8rem; color: var(--cinza); flex: 1; }
  .sistema .estado { font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
  .precos { margin-top: 34px; }
  .precos h2 { text-align: center; color: var(--azul); margin-bottom: 6px; }
  .precos > p { text-align: center; color: var(--cinza); font-size: .9rem; margin-bottom: 18px; }
  .precos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
  .plano { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 20px; }
  .plano.destaque { border-color: var(--azul); box-shadow: 0 4px 16px rgba(15,76,129,.15); }
  .plano .p-nome { font-weight: 700; color: var(--azul); font-size: 1.05rem; }
  .plano .p-preco { font-size: 1.6rem; font-weight: 800; color: var(--azul); margin: 6px 0 2px; }
  .plano .p-mes { color: var(--cinza); font-size: .8rem; margin-bottom: 12px; }
  .plano ul { list-style: none; font-size: .85rem; color: #334155; }
  .plano li { padding: 4px 0; }
  .sistema .ativo { color: var(--verde); }
  .sistema .breve { color: var(--cinza); }
  .painel { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.05); max-width: 420px; margin: 0 auto; }
  .painel h2 { font-size: 1.05rem; color: var(--azul); margin-bottom: 4px; }
  .painel .sub { font-size: .82rem; color: var(--cinza); margin-bottom: 14px; }
  .painel .campo { width: 100%; margin-bottom: 10px; padding: 11px 14px; border: 1.5px solid var(--borda); border-radius: 10px; font-size: .95rem; }
  .painel button { width: 100%; background: var(--azul); color: #fff; border: 0; border-radius: 10px; padding: 12px; font-size: .95rem; font-weight: 600; cursor: pointer; }
  .painel button:hover { background: #0d3f6b; }
  .voltar-link { display: inline-block; margin-bottom: 14px; background: none; border: 1.5px solid var(--borda); border-radius: 999px; padding: 6px 14px; cursor: pointer; color: var(--cinza); font-size: .8rem; text-decoration: none; }
  #sessao-info { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  #sessao-info .nome { font-weight: 600; color: var(--azul); }
  #sessao-info .voltar-link { margin-bottom: 0; }
  .busca-box { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
  .busca-box label { font-size: .85rem; color: var(--cinza); display: block; margin-bottom: 8px; }
  .linha { display: flex; gap: 10px; }
  .linha input { flex: 1; padding: 13px 16px; border: 1.5px solid var(--borda); border-radius: 10px; font-size: 1rem; outline: none; }
  .linha input:focus { border-color: var(--azul); }
  .linha button { width: auto; background: var(--azul); color: #fff; border: 0; border-radius: 10px; padding: 0 26px; font-size: 1rem; font-weight: 600; cursor: pointer; }
  .linha button:disabled { opacity: .6; cursor: wait; }
  .exemplos { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .exemplos button { width: auto; background: var(--azul-claro); color: var(--azul); border: 0; border-radius: 999px; padding: 6px 14px; font-size: .8rem; cursor: pointer; }
  #estado { margin: 14px 2px; font-size: .9rem; color: var(--cinza); min-height: 20px; }
  #estado.erro { color: var(--vermelho); }
  #resposta { display: grid; gap: 14px; }
  .bloco { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 18px; }
  .bloco h3 { font-size: 1rem; margin-bottom: 12px; color: var(--azul); }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 10px; margin-bottom: 12px; }
  .kpi { background: var(--azul-claro); border-radius: 10px; padding: 12px 14px; }
  .kpi .valor { font-size: 1.35rem; font-weight: 700; color: var(--azul); }
  .kpi .rotulo { font-size: .75rem; color: var(--cinza); margin-top: 2px; }
  table.tab { width: 100%; border-collapse: collapse; font-size: .88rem; }
  .tab th { text-align: left; color: var(--cinza); font-weight: 600; font-size: .75rem; text-transform: uppercase; padding: 6px 8px; border-bottom: 1.5px solid var(--borda); }
  .tab td { padding: 7px 8px; border-bottom: 1px solid var(--borda); }
  .tab tr:last-child td { border-bottom: 0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .alerta { color: var(--vermelho); font-weight: 600; }
  .produtos-titulo { margin-top: 4px; font-size: .85rem; color: var(--cinza); }
  .cartao { background: #fff; border: 1px solid var(--borda); border-radius: 12px; padding: 13px 16px; cursor: pointer; transition: border-color .15s; }
  .cartao:hover { border-color: var(--azul); }
  .cartao .nome { font-weight: 600; font-size: .95rem; }
  .cartao .generico { color: var(--cinza); font-size: .82rem; margin-top: 2px; }
  .detalhe { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 22px; }
  .detalhe h2 { font-size: 1.15rem; margin-bottom: 4px; }
  .voltar { margin-top: 16px; background: none; border: 1.5px solid var(--borda); border-radius: 10px; padding: 9px 18px; cursor: pointer; font-size: .9rem; color: var(--azul); font-weight: 600; }
  .vazio { text-align: center; color: var(--cinza); padding: 30px 0; }
  footer { text-align: center; color: var(--cinza); font-size: .78rem; padding: 24px; }
  #btn-pdf { background: var(--verde); color: #fff; border: 0; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: .8rem; }
  #btn-insights { background: var(--azul-claro); color: var(--azul); border: 0; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: .8rem; }
  #modo-info { display: none; margin: 10px 2px; padding: 8px 12px; border-radius: 8px; font-size: .8rem; background: #f1f5f9; color: var(--cinza); }
  #modo-info.off { background: var(--azul-claro); color: var(--azul); }
  #progresso { display: none; height: 4px; border-radius: 4px; background: var(--borda); overflow: hidden; margin: 10px 2px; }
  #progresso .bar { height: 100%; width: 0; background: var(--azul); animation: prog 1.4s ease-in-out infinite; }
  @keyframes prog { 0% { width: 0; } 50% { width: 80%; } 100% { width: 100%; } }
  #pdf-header { display: none; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #0f4c81; }
  #pdf-header h2 { color: #0f4c81; font-size: 1.2rem; margin: 0 0 6px; }
  #pdf-header .meta { font-size: .85rem; color: #555; }
  @media print {
    body * { visibility: hidden; }
    #pdf-header, #pdf-header * { visibility: visible; }
    #pdf-header { display: block; position: absolute; left: 0; top: 0; width: 100%; }
    #resposta, #resposta * { visibility: visible; }
    #resposta { position: absolute; left: 0; top: 90px; width: 100%; }
  }
</style>
</head>
<body>
<header>
  <h1>🧠 TECNOINCUBADORA AI</h1>
  <span class="pill">Assistentes inteligentes por sistema</span>
</header>

<main>
  <!-- Vista 1: landing com os sistemas -->
  <section id="view-landing">
    <p class="subtitulo">Escolhe o teu sistema. Entra com as credenciais que já usas nele.</p>
    <div class="grid" id="grid-sistemas"></div>

    <div class="precos">
      <h2>Planos do assistente IA</h2>
      <p>Preços mensais por sistema.</p>
      <div class="precos-grid">
        <div class="plano">
          <div class="p-nome">Básico</div>
          <div class="p-preco">1.000 MT</div><div class="p-mes">/ mês</div>
          <ul>
            <li>50 perguntas (prompts) por mês</li>
            <li>1 utilizador</li>
            <li>Sem download de ficheiros</li>
          </ul>
        </div>
        <div class="plano destaque">
          <div class="p-nome">Standard</div>
          <div class="p-preco">1.700 MT</div><div class="p-mes">/ mês</div>
          <ul>
            <li>80 perguntas (prompts) por mês</li>
            <li>3 utilizadores</li>
            <li>10 downloads por mês</li>
          </ul>
        </div>
        <div class="plano">
          <div class="p-nome">Pro</div>
          <div class="p-preco">2.500 MT</div><div class="p-mes">/ mês</div>
          <ul>
            <li>Perguntas ilimitadas</li>
            <li>Downloads ilimitados</li>
            <li>Partilha via WhatsApp</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- Vista 2: login do sistema -->
  <section id="view-login" style="display:none">
    <button class="voltar-link" onclick="mostrarVista('landing')">← Voltar</button>
    <div class="painel">
      <h2 id="login-titulo"></h2>
      <p class="sub" id="login-sub"></p>
      <input class="campo" id="login-email" type="email" placeholder="Email do sistema">
      <input class="campo" id="login-pass" type="password" placeholder="Password">
      <button id="btn-login" onclick="entrar()">Entrar</button>
    </div>
  </section>

  <!-- Vista 3: assistente do sistema -->
  <section id="view-chat" style="display:none">
    <div id="sessao-info">
      <span class="nome" id="sessao-nome"></span>
      <button class="voltar-link" onclick="sair()">Terminar sessão</button>
      <button id="btn-pdf" onclick="baixarPDF()" title="Exportar a resposta atual em PDF">⬇ PDF</button>
      <button id="btn-excel" onclick="baixarExcel()" title="Exportar os resultados em Excel/CSV">⬇ Excel</button>
      <button id="btn-wa" onclick="partilharWhatsapp()" title="Partilhar por WhatsApp">WhatsApp</button>
      <button id="btn-insights" onclick="mostrarInsights()" title="Resumo e indicadores de negócio">📊 Insights</button>
    </div>
    <div id="licenca-info" style="display:none; margin-bottom:10px; padding:8px 12px; border-radius:8px; font-size:.8rem; background:#fff; border:1px solid var(--borda);"></div>
    <div class="busca-box">
      <label for="q">Pergunta em linguagem normal</label>
      <div class="linha">
        <input id="q" placeholder="Ex: quantas vendas tive hoje?">
        <button id="btn" onclick="perguntar()">Perguntar</button>
      </div>
      <div class="exemplos" id="exemplos"></div>
    </div>
    <div id="estado"></div>
    <div id="progresso"><div class="bar"></div></div>
    <div id="modo-info"></div>
    <div id="pdf-header"></div>
    <div id="resposta"></div>
  </section>
</main>

<footer>TECNOINCUBADORA AI · TECNOINCUBADORA</footer>

<script>
let SISTEMA_ATUAL = null;      // sistema selecionado
let ULTIMA_RESPOSTA = null;    // última resposta { blocos, produtos, sistema } p/ exportação
let SESSAO = null;             // { usuario, farmacia } do login
const EXEMPLOS_PADRAO = [
  'quantas vendas tive hoje?', 'faturação do mês', 'produtos mais vendidos',
  'o que tenho que repor no estoque?', 'pedidos pendentes', 'amoxilina'
];
const elLanding = document.getElementById('view-landing');
const elLogin = document.getElementById('view-login');
const elChat = document.getElementById('view-chat');
const elGrid = document.getElementById('grid-sistemas');
const elLoginTitulo = document.getElementById('login-titulo');
const elLoginSub = document.getElementById('login-sub');
const elEmail = document.getElementById('login-email');
const elPass = document.getElementById('login-pass');
const elSessaoNome = document.getElementById('sessao-nome');
const elQ = document.getElementById('q');
const elBtn = document.getElementById('btn');
const elEstado = document.getElementById('estado');
const elResp = document.getElementById('resposta');
const elModo = document.getElementById('modo-info');
const elLicenca = document.getElementById('licenca-info');
const elProgresso = document.getElementById('progresso');
const MZN = v => Number(v).toLocaleString('pt-MZ', { minimumFractionDigits: 2 }) + ' MZN';

function getToken() { return localStorage.getItem('gf_token'); }
function getSistema() { try { return JSON.parse(localStorage.getItem('gf_sistema')); } catch { return null; } }

function mostrarVista(nome) {
  elLanding.style.display = nome === 'landing' ? '' : 'none';
  elLogin.style.display = nome === 'login' ? '' : 'none';
  elChat.style.display = nome === 'chat' ? '' : 'none';
}

// ── Landing: lista os sistemas ──────────────────────────────────────
async function carregarSistemas() {
  const r = await fetch('/api/sistemas');
  const sistemas = await r.json();
  elGrid.innerHTML = '';
  sistemas.forEach(s => {
    const c = document.createElement(s.url && !s.implementado ? 'a' : 'div');
    c.className = 'sistema';
    if (s.url && !s.implementado) {
      c.href = s.url;
      c.target = '_blank';
      c.rel = 'noopener';
      c.title = 'Abrir ' + s.nome + ' → ' + s.url;
    }
    c.innerHTML = \`
      <div class="emoji">\${s.emoji}</div>
      <div class="nome">\${esc(s.nome)}\${s.url ? ' ↗' : ''}</div>
      <div class="desc">\${esc(s.desc)}</div>
      <div class="estado \${s.implementado ? 'ativo' : 'breve'}">\${s.implementado ? '● Disponível' : s.url ? '● Abrir sistema' : '○ Em breve'}</div>\`;
    if (!s.url) c.onclick = () => escolherSistema(s);
    elGrid.appendChild(c);
  });
}

// ── Selecionar sistema -> login ─────────────────────────────────────
function escolherSistema(s) {
  SISTEMA_ATUAL = s;
  elLoginTitulo.textContent = s.emoji + ' ' + s.nome;
  elLoginSub.textContent = s.implementado
    ? 'Entra com as tuas credenciais do ' + s.nome + '.'
    : 'Este sistema ainda não está integrado.';
  elLoginSub.style.color = s.implementado ? '' : 'var(--vermelho)';
  document.getElementById('btn-login').disabled = !s.implementado;
  document.getElementById('btn-login').style.opacity = s.implementado ? '' : '.5';
  mostrarVista('login');
}

async function entrar() {
  if (!SISTEMA_ATUAL || !SISTEMA_ATUAL.implementado) return;
  const email = elEmail.value.trim(), password = elPass.value;
  if (!email || !password) { alert('Preencha email e password.'); return; }
  elEstado.textContent = 'A autenticar…';
  try {
    const r = await fetch('/api/sistemas/' + SISTEMA_ATUAL.slug + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Erro no login');
    localStorage.setItem('gf_token', d.token);
    localStorage.setItem('gf_sistema', JSON.stringify(SISTEMA_ATUAL));
    iniciarChat(d);
  } catch (err) {
    elEstado.className = 'erro';
    elEstado.textContent = 'Erro: ' + err.message;
  }
}

function sair() {
  localStorage.removeItem('gf_token');
  localStorage.removeItem('gf_sistema');
  elEmail.value = ''; elPass.value = '';
  elEstado.className = ''; elEstado.textContent = '';
  elLicenca.style.display = 'none';
  elResp.innerHTML = '';
  mostrarVista('landing');
}

function atualizarLicencaDisplay(lic) {
  if (!lic) { elLicenca.style.display = 'none'; return; }
  if (lic.unlimited) {
    elLicenca.style.display = 'block';
    elLicenca.style.background = '#dcfce7'; elLicenca.style.color = '#166534'; elLicenca.style.borderColor = '#bbf7d0';
    elLicenca.textContent = '✓ ' + (lic.motivo || 'Acesso ilimitado');
    return;
  }
  let texto = '';
  if (lic.trial && lic.trialFim) {
    const dias = Math.max(0, Math.ceil((new Date(lic.trialFim) - new Date()) / 86400000));
    texto = 'Trial: ' + dias + ' dias restantes (até ' + new Date(lic.trialFim).toLocaleDateString('pt-PT') + ') | Plano: ' + (lic.plano || 'basico');
    elLicenca.style.background = '#fef3c7'; elLicenca.style.color = '#92400e';
  } else {
    const plano = lic.plano || 'basico';
    const usados = lic.lic?.prompts_usados ?? 0;
    const limites = { basico: 50, standard: 80, pro: Infinity };
    const limite = limites[plano] ?? 50;
    texto = 'Plano ' + plano + ' | Prompts: ' + usados + '/' + (limite === Infinity ? '∞' : limite) + ' este mês';
    elLicenca.style.background = '#fff'; elLicenca.style.color = 'var(--cinza)';
  }
  elLicenca.style.display = 'block';
  elLicenca.textContent = texto;
}

async function consumirDownload() {
  const token = getToken(); const s = getSistema();
  if (!token || !s) { alert('Inicie sessão.'); return false; }
  try {
    const r = await fetch('/api/licencas/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ sistemaSlug: s.slug })
    });
    const d = await r.json();
    if (d.licenca) atualizarLicencaDisplay(d.licenca);
    if (!r.ok) { alert(d.error || 'Limite atingido'); return false; }
    return true;
  } catch(e) { alert('Erro: ' + e.message); return false; }
}

// Exporta a resposta atual como PDF (usa o diálogo de impressão do navegador)
async function baixarPDF() {
  if (!elResp.innerHTML) { alert('Ainda não há resultados para exportar.'); return; }
  if (!await consumirDownload()) return;
  const s = getSistema();
  const cab = document.getElementById('pdf-header');
  const usr = SESSAO?.usuario, ten = SESSAO?.farmacia;
  cab.innerHTML = '<h2>🧠 TECNOINCUBADORA AI</h2>' +
    '<div class="meta"><strong>Sistema:</strong> ' + esc(s ? s.nome : '—') +
    ' &nbsp;·&nbsp; <strong>Utilizador:</strong> ' + esc(usr ? (usr.nome || usr.email || '—') : '—') +
    ' &nbsp;·&nbsp; <strong>Tenant:</strong> ' + esc(ten ? (ten.nome || '—') : '—') +
    ' &nbsp;·&nbsp; ' + new Date().toLocaleString('pt-PT') + '</div>';
  window.print();
}

// Recolhe todos os arrays de dados (tabelas) dos blocos da última resposta
function arraysDaResposta() {
  const arr = [];
  (ULTIMA_RESPOSTA?.blocos || []).forEach(b => {
    if (Array.isArray(b.dados)) arr.push({ titulo: b.titulo, linhas: b.dados });
    else if (b.dados && Array.isArray(b.dados.lista)) arr.push({ titulo: b.titulo + ' (lista)', linhas: b.dados.lista });
    else if (b.dados && Array.isArray(b.dados.por_forma_pagamento)) arr.push({ titulo: b.titulo + ' (por forma)', linhas: b.dados.por_forma_pagamento });
  });
  return arr;
}

function toCSV(linhas) {
  if (!linhas.length) return '';
  const cols = Object.keys(linhas[0]);
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return cols.join(';') + '\\n' + linhas.map(l => cols.map(c => esc(l[c])).join(';')).join('\\n');
}

// Exporta os resultados em Excel/CSV (separador ; para abrir direto no Excel pt)
async function baixarExcel() {
  if (!await consumirDownload()) return;
  const arr = arraysDaResposta();
  if (!arr.length) { alert('Não há tabelas de dados para exportar.'); return; }
  const nome = (getSistema()?.nome || 'dados').replace(/\\s+/g, '_') + '_' + (ULTIMA_RESPOSTA?.query || 'consulta').replace(/[^\\w\\d]+/g, '_').slice(0, 30) + '.csv';
  const conteudo = '\\ufeff' + arr.map(a => a.titulo + '\\n' + toCSV(a.linhas)).join('\\n\\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Texto-resumo da resposta para partilha/insights
function textoResumo() {
  const linhas = ['*' + (getSistema()?.nome || 'Consulta') + ' — ' + (ULTIMA_RESPOSTA?.query || '') + '*', ''];
  (ULTIMA_RESPOSTA?.blocos || []).forEach(b => {
    linhas.push('*' + b.titulo + '*');
    if (Array.isArray(b.dados)) {
      b.dados.slice(0, 15).forEach(r => linhas.push('- ' + (Object.values(r).join(' | '))));
    } else if (b.dados && typeof b.dados === 'object') {
      const t = b.dados.totais || b.dados;
      Object.entries(t).filter(([,v]) => typeof v !== 'object').forEach(([k, v]) => linhas.push('• ' + k.replace(/_/g, ' ') + ': ' + v));
      if (Array.isArray(b.dados.lista)) b.dados.lista.slice(0, 15).forEach(r => linhas.push('- ' + (Object.values(r).join(' | '))));
    }
    linhas.push('');
  });
  return linhas.join('\\n');
}

// Partilha a resposta por WhatsApp
async function partilharWhatsapp() {
  if (!ULTIMA_RESPOSTA) { alert('Ainda não há resultados para partilhar.'); return; }
  if (!await consumirDownload()) return;
  const texto = encodeURIComponent(textoResumo());
  window.open('https://wa.me/?text=' + texto, '_blank');
}

// Resumo/indicadores de negócio (Business Insights) + download
function mostrarInsights() {
  if (!ULTIMA_RESPOSTA) { alert('Ainda não há resultados.'); return; }
  const blob = ULTIMA_RESPOSTA;
  const linhas = ['📊 Business Insights — ' + (getSistema()?.nome || ''), '', 'Pergunta: ' + (blob.query || ''), '', textoResumo(), ''];
  // indicadores adicionais
  (blob.blocos || []).forEach(b => {
    if (!b.dados) return;
    if (Array.isArray(b.dados)) {
      linhas.push('Indicador: ' + (b.dados.length) + ' registos listados.');
    } else if (b.dados.totais) {
      const t = b.dados.totais;
      const vals = Object.entries(t).filter(([,v]) => typeof v !== 'object').map(([k, v]) => \`\${k.replace(/_/g,' ')}: \${v}\`);
      linhas.push('Indicador: ' + vals.join(' · '));
      if (Array.isArray(b.dados.lista)) linhas.push('Registos: ' + b.dados.lista.length);
    }
  });
  const corpo = linhas.join('\\n');
  elEstado.className = '';
  elEstado.textContent = '';
  const box = document.createElement('div');
  box.className = 'bloco';
  box.innerHTML = '<h3>📊 Business Insights</h3><pre style="white-space:pre-wrap;font-family:inherit;font-size:.9rem">' + esc(corpo) + '</pre>' +
    '<button class="voltar" onclick="baixarInsights()">⬇ Baixar (.txt)</button>';
  elResp.appendChild(box);
}

async function baixarInsights() {
  if (!ULTIMA_RESPOSTA) return;
  if (!await consumirDownload()) return;
  const corpo = textoResumo();
  const blob = new Blob(['📊 Business Insights — ' + (getSistema()?.nome || '') + '\\n\\n' + corpo], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'insights_' + (getSistema()?.slug || 'sistema') + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Chat ────────────────────────────────────────────────────────────
function iniciarChat(d) {
  const s = getSistema();
  SESSAO = { usuario: d.usuario || null, farmacia: d.farmacia || null };
  elSessaoNome.textContent = s.emoji + ' ' + s.nome + ' · ' +
    ((d.farmacia && d.farmacia.nome) || (d.usuario && (d.usuario.nome || d.usuario.email)) || 'sessão iniciada');
  renderExemplos(s.exemplos || EXEMPLOS_PADRAO);
  elEstado.className = '';
  elEstado.textContent = 'Sessão iniciada.';
  elResp.innerHTML = '';
  mostrarVista('chat');
  elQ.focus();
}

function urlSistema(caminho) {
  const s = getSistema();
  const base = (s && s.apiPath) || '/api/farmacia';
  return base + caminho;
}

async function perguntar() {
  const query = elQ.value.trim();
  if (!query) return;
  const token = getToken();
  if (!token) { sair(); return; }
  elBtn.disabled = true;
  elEstado.className = '';
  elEstado.textContent = 'A analisar…';
  elModo.style.display = 'none';
  elProgresso.style.display = 'block';
  elResp.innerHTML = '';
  try {
    const r = await fetch(urlSistema('/pergunta'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ query })
    });
    const d = await r.json();
    if (r.status === 401) { sair(); throw new Error('Sessão expirada. Inicie sessão de novo.'); }
    if (r.status === 402) { atualizarLicencaDisplay(d.licenca); throw new Error(d.error || 'Limite atingido'); }
    if (!r.ok) throw new Error(d.error || 'Erro');
    if (d.licenca) atualizarLicencaDisplay(d.licenca);
    ULTIMA_RESPOSTA = { blocos: d.blocos, produtos: d.produtos, sistema: getSistema(), query };
    const temRel = d.blocos.length > 0, temProd = d.total_produtos > 0;
    elModo.className = '';
    if (d.modo === 'interno') { elModo.style.display = 'block'; elModo.className = ''; elModo.textContent = '⚙ Motor interno — a responder com os recursos próprios.'; }
    else if (d.modo === 'externo') { elModo.style.display = 'block'; elModo.className = 'off'; elModo.textContent = '🧠 Assistido por IA externa.'; }
    else elModo.style.display = 'none';
    elEstado.textContent = temRel || temProd
      ? 'Resultados para “' + query + '”:'
      : 'Nada encontrado para “' + query + '”. Tenta outra forma de perguntar.';
    d.blocos.forEach(renderBloco);
    if (temProd) renderProdutos(d.produtos, temRel);
    if (!temRel && !temProd) elResp.innerHTML = '<div class="vazio">🙈 Experimenta: “vendas de hoje”, “estoque baixo”, “paracetamol”…</div>';
    if (d.licenca) atualizarLicencaDisplay(d.licenca);
  } catch (err) {
    elEstado.className = 'erro';
    elEstado.textContent = 'Erro: ' + err.message;
    if (err.message.includes('402') || err.message.includes('Limite')) {
      elLicenca.style.display = 'block';
      elLicenca.style.background = '#fee2e2'; elLicenca.style.color = '#991b1b';
      elLicenca.textContent = '⚠️ ' + err.message;
    }
  } finally { elBtn.disabled = false; elProgresso.style.display = 'none'; }
}

function renderBloco(b) {
  const el = document.createElement('div');
  el.className = 'bloco';
  const corpo = document.createElement('div');
  if (b.erro) corpo.innerHTML = '<p class="alerta">Erro: ' + esc(b.erro) + '</p>';
  else if (b.intencao.startsWith('vendas_')) renderVendas(corpo, b.dados);
  else if (b.intencao === 'top_produtos') renderTabela(corpo, b.dados,
    ['Produto', 'Qtd', 'Receita'], r => [esc(r.nome), r.quantidade_vendida, MZN(r.receita)], true);
  else if (b.intencao === 'estoque_baixo') renderEstoque(corpo, b.dados);
  else if (b.intencao === 'clientes') renderClientes(corpo, b.dados);
  else if (b.intencao === 'pedidos_abertos' || b.intencao === 'pedidos_estado') renderTabela(corpo, b.dados,
    ['Estado', 'Pedidos', 'Total'], r => [esc(r.status || '—'), r.pedidos, MZN(r.total)], true);
  else if (b.intencao === 'fazer_venda') renderVenda(corpo, b.dados);
  else if (b.texto) corpo.innerHTML = '<p>' + esc(b.texto) + '</p>';
  else if (b.dados) renderDados(corpo, b.dados);
  const h = document.createElement('h3'); h.textContent = b.titulo;
  el.append(h, corpo);
  const acoes = document.createElement('div');
  acoes.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;';
  const btnExp = document.createElement('button');
  btnExp.textContent = '🔍 Explorar mais';
  btnExp.style.cssText = 'background:var(--azul-claro);color:var(--azul);border:0;border-radius:999px;padding:6px 12px;font-size:.8rem;cursor:pointer;';
  btnExp.onclick = () => explorarMais(b.titulo, b.intencao);
  const btnDet = document.createElement('button');
  btnDet.textContent = '➕ Adicionar detalhes';
  btnDet.style.cssText = 'background:#fff;color:var(--azul);border:1px solid var(--borda);border-radius:999px;padding:6px 12px;font-size:.8rem;cursor:pointer;';
  btnDet.onclick = () => adicionarDetalhes(b.titulo);
  acoes.append(btnExp, btnDet);
  el.append(acoes);
  elResp.appendChild(el);
}

function explorarMais(titulo, intencao) {
  const sug = {
    'vendas_periodo': 'mostrar mais detalhes e por forma de pagamento',
    'top_produtos': 'mostrar top 20 e com categoria',
    'estoque_baixo': 'mostrar com fornecedor e data de validade',
    'clientes': 'mostrar lista completa com contacto',
    'dentro': 'mostrar com telefone e última entrada',
    'faturas': 'mostrar com cliente e método de pagamento',
    'mensalidades': 'mostrar só as expiradas deste mês'
  }[intencao] || 'com mais detalhes';
  elQ.value = titulo + ' — ' + sug;
  elQ.focus();
  perguntar();
}

function adicionarDetalhes(titulo) {
  const extra = prompt('Que detalhe queres adicionar para "' + titulo + '"? (ex. período, cliente, produto)');
  if (extra && extra.trim()) { elQ.value = titulo + ' — ' + extra.trim(); perguntar(); }
}

function renderDados(container, dados) {
  if (Array.isArray(dados) && dados.length) {
    const chaves = Object.keys(dados[0]).filter(k => k !== 'id');
    renderTabela(container, dados, chaves.map(c => cap(String(c).replace(/_/g, ' '))),
      r => chaves.map(c => esc(String(r[c] ?? ''))));
    return;
  }
  if (dados && typeof dados === 'object') {
    // formato { totais: {...}, lista: [...] } -> KPIs + tabela da lista
    if (dados.totais && typeof dados.totais === 'object') {
      const t = dados.totais;
      const entradas = Object.entries(t).filter(([, v]) => v != null && typeof v !== 'object');
      if (entradas.length) {
        container.innerHTML = '<div class="kpi-grid">' + entradas.map(([k, v]) =>
          \`<div class="kpi"><div class="valor">\${esc(String(v))}</div><div class="rotulo">\${esc(cap(String(k).replace(/_/g, ' ')))}</div></div>\`
        ).join('') + '</div>';
      }
      if (Array.isArray(dados.lista) && dados.lista.length) {
        const chaves = Object.keys(dados.lista[0]).filter(k => k !== 'id');
        renderTabela(container, dados.lista, chaves.map(c => cap(String(c).replace(/_/g, ' '))),
          r => chaves.map(c => esc(String(r[c] ?? ''))));
      }
      return;
    }
    const entradas = Object.entries(dados).filter(([, v]) => v != null && typeof v !== 'object');
    if (entradas.length) {
      container.innerHTML = '<div class="kpi-grid">' + entradas.map(([k, v]) =>
        \`<div class="kpi"><div class="valor">\${esc(String(v))}</div><div class="rotulo">\${esc(cap(String(k).replace(/_/g, ' ')))}</div></div>\`
      ).join('') + '</div>';
    }
  }
}

function renderVenda(container, d) {
  container.innerHTML = \`
    <div class="kpi-grid">
      <div class="kpi"><div class="valor">\${esc(d.numero_pedido)}</div><div class="rotulo">Nº pedido</div></div>
      <div class="kpi"><div class="valor">\${MZN(d.total)}</div><div class="rotulo">Total</div></div>
      <div class="kpi"><div class="valor">\${esc(d.forma_pagamento)}</div><div class="rotulo">Pagamento</div></div>
    </div>\`;
  renderTabela(container, d.itens, ['Produto', 'Qtd', 'Preço', 'Subtotal'],
    r => [esc(r.produto), r.quantidade, MZN(r.preco_unitario), MZN(r.subtotal)], true);
}

function renderVendas(container, d) {
  const t = d.totais;
  container.innerHTML = \`
    <div class="kpi-grid">
      <div class="kpi"><div class="valor">\${t.pedidos}</div><div class="rotulo">Pedidos</div></div>
      <div class="kpi"><div class="valor">\${MZN(t.total)}</div><div class="rotulo">Total faturado</div></div>
      <div class="kpi"><div class="valor">\${MZN(t.ticket_medio)}</div><div class="rotulo">Ticket médio</div></div>
    </div>\`;
  if (d.por_forma_pagamento.length) {
    renderTabela(container, d.por_forma_pagamento, ['Forma de pagamento', 'Pedidos', 'Total'],
      r => [esc(cap(r.forma_pagamento)), r.pedidos, MZN(r.total)], true);
  }
}

function renderEstoque(container, dados) {
  if (!dados.length) { container.innerHTML = '<p>✅ Nenhum produto abaixo do mínimo.</p>'; return; }
  renderTabela(container, dados, ['Produto', 'Qtd', 'Mínimo', 'Preço'],
    r => [\`<span class="alerta">\${esc(r.nome)}</span>\`, r.quantidade, r.quantidade_minima, MZN(r.preco_venda)], false,
    r => verProduto(r.id, r.nome));
}

function renderClientes(container, d) {
  const t = d.totais || d;
  container.innerHTML = \`
    <div class="kpi-grid">
      <div class="kpi"><div class="valor">\${t.clientes ?? '—'}</div><div class="rotulo">Registados</div></div>
      <div class="kpi"><div class="valor">\${t.ativos ?? t.novos_30d ?? '—'}</div><div class="rotulo">\${t.ativos != null ? 'Ativos' : 'Novos (30d)'}</div></div>
    </div>\`;
  if (d.lista && d.lista.length) {
    renderTabela(container, d.lista, ['Nome', 'Telefone', 'Plano', 'Estado'],
      r => [esc(r.nome || ''), esc(r.telefone || '—'), esc(r.plano || '—'), esc(cap(r.status || '—'))]);
  }
}

function renderTabela(container, linhas, cab, fmt, numCols = false, onClick = null) {
  const tb = document.createElement('table');
  tb.className = 'tab';
  tb.innerHTML = '<thead><tr>' + cab.map((c, i) => \`<th class="\${i > 0 ? 'num' : ''}">\${c}</th>\`).join('') + '</tr></thead>';
  const corpo = document.createElement('tbody');
  linhas.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = fmt(r).map((c, i) => \`<td class="\${i > 0 ? 'num' : ''}">\${c}</td>\`).join('');
    if (onClick) { tr.style.cursor = 'pointer'; tr.onclick = () => onClick(r); }
    corpo.appendChild(tr);
  });
  tb.appendChild(corpo);
  container.appendChild(tb);
}

function renderProdutos(produtos, abaixoDeRelatorio) {
  const wrap = document.createElement('div');
  wrap.className = 'bloco';
  wrap.innerHTML = '<h3>🛒 Produtos encontrados</h3><p class="produtos-titulo">Toca num produto para ver preço e estoque</p>';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;gap:8px;margin-top:10px';
  produtos.forEach(p => {
    const c = document.createElement('div');
    c.className = 'cartao';
    c.innerHTML = \`<div class="nome">\${esc(p.nome)}</div><div class="generico">\${esc(p.nome_generico || '')}</div>\`;
    c.onclick = () => verProduto(p.id, p.nome);
    grid.appendChild(c);
  });
  wrap.appendChild(grid);
  elResp.appendChild(wrap);
}

async function verProduto(id, nome) {
  const token = getToken();
  elEstado.textContent = 'A carregar ' + nome + '…';
  elResp.innerHTML = '';
  const r = await fetch(urlSistema('/produto/' + id), { headers: { 'Authorization': 'Bearer ' + token } });
  const p = await r.json();
  elEstado.textContent = '';
  const linhas = [
    ['Nome genérico', p.nome_generico], ['Tipo', p.tipo], ['Concentração', p.concentracao],
    ['Forma farmacêutica', p.forma_farmaceutica], ['Composição', p.composicao],
    ['Indicação', p.indicacao], ['Código de barras', p.codigo_barras],
    ['Requer receita', p.requer_receita ? 'Sim' : 'Não']
  ].filter(l => l[1] !== '' && l[1] != null);
  let est = '';
  if (p.estoque && p.estoque.length) {
    est = p.estoque.map(e => \`
      <tr><td>Preço</td><td><strong>\${MZN(e.preco_venda)}</strong>\${e.em_promocao && e.preco_promocional ? ' (promoção: ' + MZN(e.preco_promocional) + ')' : ''}</td></tr>
      <tr><td>Quantidade em estoque</td><td class="\${e.quantidade == 0 ? 'alerta' : ''}">\${e.quantidade}</td></tr>
      <tr><td>Lote / Validade</td><td>\${e.lote || '—'} / \${e.data_validade ? e.data_validade.slice(0, 10) : '—'}</td></tr>\`).join('');
  } else est = '<tr><td>Estoque</td><td class="alerta">Sem estoque disponível</td></tr>';
  elResp.innerHTML = \`
    <div class="detalhe">
      <h2>\${esc(p.nome)}</h2><p class="produtos-titulo" style="margin-bottom:14px">Produto #\${p.id}</p>
      <table class="tab">\${linhas.map(l => \`<tr><td style="color:var(--cinza);width:180px">\${l[0]}</td><td>\${esc(String(l[1]))}</td></tr>\`).join('')}\${est}</table>
      <button class="voltar" onclick="perguntar()">← Voltar</button>
    </div>\`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s; }

// Início: lista sistemas e, se já havia sessão, reabre o chat
(async function init() {
  await carregarSistemas();
  const s = getSistema();
  if (s && getToken()) {
    SISTEMA_ATUAL = s;
    mostrarVista('chat');
    elSessaoNome.textContent = s.emoji + ' ' + s.nome + ' · sessão iniciada';
  } else {
    mostrarVista('landing');
  }
})();

function renderExemplos(exemplos) {
  const caixa = document.getElementById('exemplos');
  caixa.innerHTML = '';
  (exemplos && exemplos.length ? exemplos : EXEMPLOS_PADRAO).forEach(txt => {
    const b = document.createElement('button');
    b.textContent = '“' + txt + '”';
    b.onclick = () => { elQ.value = txt; perguntar(); };
    caixa.appendChild(b);
  });
}
elQ.addEventListener('keydown', e => { if (e.key === 'Enter') perguntar(); });
elPass.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
</script>
</body>
</html>
`;
