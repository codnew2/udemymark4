/* ============================================================
   Missões (RFC-003 + RFC-007/007-A, evoluído pelas RFC-008/RFC-010)
   — objetivos comerciais originados de interações com o cliente,
   identificados automaticamente pela IA. Dados e regras de negócio
   já vivem em data.js (getCommitments(), commitmentBucket(),
   commitmentStage(), concludeCommitment()...). Este arquivo é
   apenas a view.
   ============================================================ */

const COMMITMENT_ORIGIN_ICON = { reuniao: "📹", email: "✉", teams: "💬" };
const COMMITMENT_STAGE_ORDER = ["novas", "em_execucao", "aguardando", "observacao"];
const COMMITMENT_STAGE_LABEL = {
  novas: "🎯 Novas", em_execucao: "🚀 Em Execução",
  aguardando: "⏳ Aguardando", observacao: "👀 Observação"
};
/* Rótulo genérico de quem detém a dependência — usado apenas como
   estimativa (Home do módulo) a partir do que foi autorado no
   compromisso (RFC-007-A); a partir da RFC-010 o "quem" deixou de
   ser um campo estruturado, virou parte do texto livre da evolução. */
const RESPONSIBILITY_DEPENDENCY_LABEL = { aguardando_cliente: "Cliente", aguardando_area_interna: "Área interna" };
const COMMITMENT_IMPACT_BADGE = { alto: "badge-critical", medio: "badge-attention", baixo: "badge-neutral" };
/* Motivos de encerramento (RFC-008) — vocabulário próprio, separado
   dos desfechos do botão "Concluir ▾" (que descrevem a resposta do
   cliente, não o motivo do encerramento da Missão). */
const CLOSURE_REASON_OPTIONS = [
  { id: "sucesso", label: "Concluída com sucesso" },
  { id: "desistiu", label: "Cliente desistiu" },
  { id: "cancelada", label: "Cancelada" },
  { id: "substituida", label: "Substituída" },
  { id: "adiada", label: "Adiada" },
  { id: "outro_encerramento", label: "Outro" }
];
const CLOSURE_REASON_LABEL = {};
CLOSURE_REASON_OPTIONS.forEach(o => { CLOSURE_REASON_LABEL[o.id] = o.label; });

let missionPrioritized = false;

function doneOutcomeLabel(outcomeId) {
  const fromButton = COMMITMENT_CONCLUDE_OPTIONS.find(o => o.id === outcomeId);
  if (fromButton) return fromButton.label;
  return CLOSURE_REASON_LABEL[outcomeId] || "registrado";
}

function commitmentAwaitingWho(c) {
  return c.dependencyLabel || RESPONSIBILITY_DEPENDENCY_LABEL[commitmentResponsibility(c)] || "Cliente";
}

function truncateText(text, maxChars) {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars).trim() + "…" : text;
}

function commitmentDueLabel(c) {
  if (c.bucket === "concluido") return "Encerrada";
  if (c.dueOffsetDays < 0) {
    const days = Math.abs(c.dueOffsetDays);
    return `Em atraso há ${days} dia${days > 1 ? "s" : ""}`;
  }
  return formatDayLabel(c.dueOffsetDays);
}

/* Linha extra do card (RFC-010) — mostra a última evolução registrada
   no drawer de movimentação, resumida em 1-2 linhas. Sem histórico
   ainda (Missão nunca movida), cai no desfecho do botão "Concluir"
   quando aplicável, ou simplesmente não aparece. */
function commitmentLastUpdateLine(c) {
  const history = getCommitmentHistory(c.id);
  if (history.length > 0) {
    const last = history[history.length - 1];
    return `<div class="type-body-sm mt-1">Última atualização: <strong>${truncateText(last.descricao, 110)}</strong></div>`;
  }
  if (c.bucket === "concluido") {
    return `<div class="type-body-sm mt-1">Desfecho: <strong>${doneOutcomeLabel(getCommitmentDoneMap()[c.id])}</strong></div>`;
  }
  return "";
}

function renderCommitmentsSummary() {
  const all = getCommitments();
  const atrasado = all.filter(c => c.bucket === "atrasado").length;
  const hoje = all.filter(c => c.bucket === "hoje").length;
  const prox7 = all.filter(c => c.bucket === "prox3" || c.bucket === "semana").length;
  const concluidos = all.filter(c => c.bucket === "concluido").length;
  document.getElementById("commitments-summary-root").innerHTML = `
    <div class="card"><div class="type-caption">Em atraso</div><div class="type-h1 text-critical">${atrasado}</div></div>
    <div class="card"><div class="type-caption">Hoje</div><div class="type-h1">${hoje}</div></div>
    <div class="card"><div class="type-caption">Próximos 7 dias</div><div class="type-h1">${prox7}</div></div>
    <div class="card"><div class="type-caption">Encerradas</div><div class="type-h1 text-positive">${concluidos}</div></div>
  `;
}

/* Resumo do módulo, exibido antes do Kanban (RFC-008). Cada
   estatística é também um filtro clicável (chip) que restringe o
   Kanban/"Por Cliente" logo abaixo às missões correspondentes — sem
   isso, o número era só uma afirmação da IA sem como ser conferida. */
const MISSION_FILTER_LABEL = {
  prioritarias: "Prioritárias",
  aguardando_cliente: "Aguardando cliente",
  vencendo_hoje: "Vencendo hoje",
  novas_ia: "Novas identificadas pela IA"
};
let missionsHomeFilter = null;

function missionMatchesFilter(c) {
  if (!missionsHomeFilter) return true;
  if (missionsHomeFilter === "prioritarias") return c.impact === "alto";
  if (missionsHomeFilter === "aguardando_cliente") return commitmentStage(c) === "aguardando" && commitmentAwaitingWho(c) === "Cliente";
  if (missionsHomeFilter === "vencendo_hoje") return c.bucket === "hoje";
  if (missionsHomeFilter === "novas_ia") return commitmentStage(c) === "novas";
  return true;
}

function setMissionsHomeFilter(key) {
  missionsHomeFilter = (missionsHomeFilter === key) ? null : key;
  renderAllCommitments();
}

function renderMissionsHome() {
  const root = document.getElementById("missions-home-root");
  if (!root) return;
  const open = getCommitments().filter(c => c.bucket !== "concluido");
  const prioritarias = open.filter(c => c.impact === "alto").length;
  const aguardandoCliente = open.filter(c => commitmentStage(c) === "aguardando" && commitmentAwaitingWho(c) === "Cliente").length;
  const vencendoHoje = open.filter(c => c.bucket === "hoje").length;
  const novasIA = open.filter(c => commitmentStage(c) === "novas").length;

  const chips = [
    { key: "prioritarias", label: `${MISSION_FILTER_LABEL.prioritarias} (${prioritarias})` },
    { key: "aguardando_cliente", label: `${MISSION_FILTER_LABEL.aguardando_cliente} (${aguardandoCliente})` },
    { key: "vencendo_hoje", label: `${MISSION_FILTER_LABEL.vencendo_hoje} (${vencendoHoje})` },
    { key: "novas_ia", label: `${MISSION_FILTER_LABEL.novas_ia} (${novasIA})` }
  ];

  root.innerHTML = `
    <div class="ai-block briefing-block mb-8">
      <div class="ai-badge mb-2"><span class="spark">✦</span> Resumo do módulo</div>
      <p class="type-body-lg">Bom dia, ${MANAGER.name.split(" ")[0]}. Hoje você possui <strong>${prioritarias} missõe${prioritarias === 1 ? "" : "s"} prioritária${prioritarias === 1 ? "" : "s"}</strong>, ${aguardandoCliente} aguardando retorno do cliente, ${vencendoHoje} vencendo hoje e ${novasIA} identificada${novasIA === 1 ? "" : "s"} automaticamente pela IA.</p>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap;">
        ${chips.map(ch => `<button class="chip${missionsHomeFilter === ch.key ? " selected" : ""}" data-mission-filter="${ch.key}">${ch.label}</button>`).join("")}
        ${missionsHomeFilter ? `<button class="chip" id="mission-filter-clear">✕ Limpar filtro</button>` : ""}
      </div>
    </div>
  `;

  root.querySelectorAll("[data-mission-filter]").forEach(btn => {
    btn.addEventListener("click", () => setMissionsHomeFilter(btn.dataset.missionFilter));
  });
  const clearBtn = document.getElementById("mission-filter-clear");
  if (clearBtn) clearBtn.addEventListener("click", () => setMissionsHomeFilter(missionsHomeFilter));
}

/* Pontuação usada por "Priorizar automaticamente" — combina impacto
   financeiro, urgência do prazo e risco do cliente. Aproximação
   simples e determinística, coerente com o restante do protótipo. */
function commitmentPriorityScore(c) {
  const impactWeight = { alto: 3, medio: 2, baixo: 1 }[c.impact] || 1;
  const client = getClient(c.clientId);
  const riskWeight = client.risk === "critical" ? 3 : client.risk === "attention" ? 2 : 1;
  return impactWeight * 100 + (-c.dueOffsetDays) * 5 + riskWeight * 10;
}

function commitmentCardHtml(c, draggable) {
  const client = getClient(c.clientId);
  const isDone = c.bucket === "concluido";
  const originIcon = COMMITMENT_ORIGIN_ICON[c.origin.type] || "•";
  const dragAttrs = (draggable && !isDone) ? ` draggable="true" data-comm-id="${c.id}"` : "";

  return `
    <div class="card ai-block${isDone ? " commitment-done" : ""}"${dragAttrs}>
      <div class="flex items-center justify-between gap-2">
        <span class="type-h3">🎯 ${c.title}</span>
        <span class="badge ${COMMITMENT_IMPACT_BADGE[c.impact]}">${COMMITMENT_IMPACT_LABEL[c.impact]}</span>
      </div>
      <a href="cliente.html?id=${c.clientId}" class="type-body-sm mt-1" style="display:block;">${client ? client.name : "Cliente"}</a>

      <div class="approach-panel open mt-3">
        <div class="approach-row"><div class="approach-label">Objetivo</div><div class="approach-value">${c.objetivo || c.title}</div></div>
        <div class="approach-row"><div class="approach-label">Origem</div><div class="approach-value">${originIcon} ${c.origin.label}</div></div>
        <div class="approach-row"><div class="approach-label">Próxima ação</div><div class="approach-value">${c.nextAction || c.title}</div></div>
        <div class="approach-row"><div class="approach-label">Impacto esperado</div><div class="approach-value">${c.impactoEsperado || "Reforçar o relacionamento comercial com o cliente."}</div></div>
      </div>

      <div class="type-body-sm mt-3${c.bucket === "atrasado" ? " text-critical" : ""}">Prazo: <strong>${commitmentDueLabel(c)}</strong></div>
      ${commitmentLastUpdateLine(c)}
      <div class="type-body-sm mt-3">🧠 ${c.aiSummary}</div>
      <div class="flex gap-2 mt-3">
        <button class="btn btn-ghost btn-sm" data-open-drawer="${c.id}">Ver detalhes</button>
        ${isDone ? "" : `<button class="btn btn-secondary btn-sm" data-toggle-conclude="${c.id}">Concluir ▾</button>`}
      </div>
      ${isDone ? "" : `
        <div class="conclude-panel" id="conclude-${c.id}">
          <div class="type-caption mb-2" style="width:100%;">Como terminou este compromisso?</div>
          ${COMMITMENT_CONCLUDE_OPTIONS.map(o => `<button class="btn btn-secondary btn-sm" data-conclude="${c.id}" data-outcome="${o.id}">${o.label}</button>`).join("")}
        </div>
      `}
    </div>
  `;
}

/* ---------------------------------------------------------- */
/* Drawer "Registrar evolução" (RFC-010) — substitui os modais      */
/* contextuais por coluna da RFC-008. Um único fluxo, texto livre,  */
/* sem opções pré-definidas, no mesmo padrão visual dos demais       */
/* drawers do CRM (estende .contact-drawer/.commitment-drawer/       */
/* .objective-drawer). O Kanban permanece visível ao fundo — nunca   */
/* um modal central.                                                 */
/* ---------------------------------------------------------- */
let pendingMove = null;

function stageDisplayLabel(stage) {
  if (stage === "encerradas") return "🔒 Encerradas";
  return COMMITMENT_STAGE_LABEL[stage] || stage;
}

function ensureMissionEvolutionDrawer() {
  if (document.getElementById("mission-evolution-drawer")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="mission-evolution-drawer-scrim" id="mission-evolution-drawer-scrim"></div>
    <aside class="mission-evolution-drawer" id="mission-evolution-drawer">
      <div class="mission-evolution-drawer-header">
        <span class="ai-badge"><span class="spark">✦</span> Registrar evolução</span>
        <button class="icon-btn" id="mission-evolution-close" aria-label="Fechar">✕</button>
      </div>
      <div class="mission-evolution-drawer-body" id="mission-evolution-drawer-body"></div>
    </aside>
  `);
  const scrim = document.getElementById("mission-evolution-drawer-scrim");
  const drawer = document.getElementById("mission-evolution-drawer");
  document.getElementById("mission-evolution-close").addEventListener("click", closeMissionEvolutionDrawer);
  scrim.addEventListener("click", closeMissionEvolutionDrawer);
}

function closeMissionEvolutionDrawer() {
  const drawer = document.getElementById("mission-evolution-drawer");
  const scrim = document.getElementById("mission-evolution-drawer-scrim");
  if (drawer) drawer.classList.remove("open");
  if (scrim) scrim.classList.remove("open");
  pendingMove = null;
}

function openMissionEvolutionDrawer(id, fromStage, toStage) {
  pendingMove = { id, fromStage, toStage };
  document.getElementById("mission-evolution-drawer-body").innerHTML = `
    <div>
      <div class="type-h3">Registrar evolução</div>
      <p class="type-body-sm mt-1">Explique rapidamente o que mudou nesta Missão.</p>
      <div class="type-caption mt-3">${stageDisplayLabel(fromStage)} → ${stageDisplayLabel(toStage)}</div>
    </div>
    <div class="mt-4">
      <div class="type-caption mb-1">Conte o que mudou *</div>
      <textarea class="input" id="me-descricao" rows="3" placeholder="Descreva brevemente o que aconteceu para esta Missão evoluir..."></textarea>
    </div>
    <div class="mt-4">
      <div class="type-caption mb-1">Observações adicionais</div>
      <textarea class="input" id="me-observacoes" rows="2" placeholder="Existe alguma informação importante que poderá ajudar em futuras interações?"></textarea>
    </div>
    <div class="flex gap-2 mt-4">
      <button class="btn btn-primary" id="me-save" disabled>Salvar evolução</button>
      <button class="btn btn-ghost" id="me-cancel">Cancelar</button>
    </div>
  `;
  const descricaoField = document.getElementById("me-descricao");
  const saveBtn = document.getElementById("me-save");
  descricaoField.addEventListener("input", () => { saveBtn.disabled = !descricaoField.value.trim(); });
  document.getElementById("me-cancel").addEventListener("click", closeMissionEvolutionDrawer);
  saveBtn.addEventListener("click", saveMissionEvolution);

  document.getElementById("mission-evolution-drawer").classList.add("open");
  document.getElementById("mission-evolution-drawer-scrim").classList.add("open");
}

function saveMissionEvolution() {
  if (!pendingMove) return;
  const descricao = document.getElementById("me-descricao").value.trim();
  if (!descricao) return;
  const observacoes = document.getElementById("me-observacoes").value.trim();
  const now = new Date();

  addCommitmentHistoryEntry(pendingMove.id, {
    date: now.toLocaleDateString("pt-BR"),
    time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    user: MANAGER.name,
    from: stageDisplayLabel(pendingMove.fromStage),
    to: stageDisplayLabel(pendingMove.toStage),
    descricao,
    observacoes
  });

  if (pendingMove.toStage === "encerradas") {
    concludeCommitment(pendingMove.id, "outro_encerramento");
  } else {
    setCommitmentStageOverride(pendingMove.id, pendingMove.toStage);
  }

  closeMissionEvolutionDrawer();
  renderAllCommitments();
}

function prioritizeMissions() {
  missionPrioritized = true;
  showToast("Missões reorganizadas por impacto financeiro, prazo e risco do cliente.", "✦");
  renderCommitmentsView();
}

/* ---------------------------------------------------------- */
/* Visão "Por Etapa" — Kanban (RFC-007, evoluído pelas RFC-007-A   */
/* e RFC-008). Reaproveita a estrutura do Kanban já existente em   */
/* Oportunidades (.kanban/.kanban-column/.kanban-column-header/     */
/* .kanban-cards) — só muda o agrupamento e o conteúdo do card,     */
/* sem remover nenhuma informação. Colunas representam o ciclo de   */
/* vida natural da Missão, nunca o responsável.                     */
/* ---------------------------------------------------------- */
function renderCommitmentsKanban() {
  const root = document.getElementById("commitments-view-root");
  const all = getCommitments().filter(missionMatchesFilter);
  const open = all.filter(c => c.bucket !== "concluido");
  const done = all.filter(c => c.bucket === "concluido");
  const sortFn = (a, b) => missionPrioritized ? commitmentPriorityScore(b) - commitmentPriorityScore(a) : 0;

  const columns = COMMITMENT_STAGE_ORDER.map(key => ({
    key, label: COMMITMENT_STAGE_LABEL[key],
    items: open.filter(c => commitmentStage(c) === key).sort(sortFn)
  }));
  columns.push({ key: "encerradas", label: "🔒 Encerradas", items: done });

  root.innerHTML = `
    <div class="kanban">
      ${columns.map(col => `
        <div class="kanban-column${col.key === "encerradas" ? " stage-fechado" : ""}" data-stage="${col.key}">
          <div class="kanban-column-header">
            <span class="type-h3">${col.label}</span>
            <span class="badge badge-neutral">${col.items.length}</span>
          </div>
          <div class="kanban-cards">${col.items.map(c => commitmentCardHtml(c, col.key !== "encerradas")).join("")}</div>
        </div>
      `).join("")}
    </div>
    <p class="type-caption mt-3">Arraste uma Missão para outra coluna para registrar como o relacionamento evoluiu.</p>
  `;

  let draggedId = null;
  root.querySelectorAll("[data-comm-id]").forEach(card => {
    card.addEventListener("dragstart", () => { draggedId = card.dataset.commId; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  /* RFC-011 — toda movimentação, entre quaisquer duas colunas (sem
     nenhuma exceção, inclusive Novas → Em Execução), passa por este
     único listener de drop e sempre abre o drawer de evolução antes
     de persistir. Não existe (e não deve existir) um caminho
     alternativo de drop por coluna que pule o registro no Histórico
     da Pendência. */
  root.querySelectorAll(".kanban-column").forEach(col => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      if (!draggedId) return;
      const commitment = getCommitments().find(x => x.id === draggedId);
      if (!commitment) return;
      const fromStage = commitment.bucket === "concluido" ? "encerradas" : commitmentStage(commitment);
      const toStage = col.dataset.stage;
      if (fromStage === toStage) return;
      ensureMissionEvolutionDrawer();
      openMissionEvolutionDrawer(draggedId, fromStage, toStage);
    });
  });
}

function renderByClientView() {
  const root = document.getElementById("commitments-view-root");
  const open = getCommitments().filter(c => c.bucket !== "concluido").filter(missionMatchesFilter);
  const byClient = {};
  open.forEach(c => { (byClient[c.clientId] = byClient[c.clientId] || []).push(c); });
  const clientIds = Object.keys(byClient).sort((a, b) => byClient[b].length - byClient[a].length);

  if (clientIds.length === 0) {
    const emptyMsg = missionsHomeFilter ? "Nenhuma Missão corresponde a este filtro." : "Nenhuma Missão em aberto no momento.";
    root.innerHTML = `<div class="card empty-state"><div class="empty-icon">✓</div><div>${emptyMsg}</div></div>`;
    return;
  }

  root.innerHTML = clientIds.map(clientId => {
    const client = getClient(clientId);
    const items = byClient[clientId].sort((a, b) => a.dueOffsetDays - b.dueOffsetDays);
    const header = `
      <a href="cliente.html?id=${clientId}" class="type-h2">${client ? client.name : "Cliente"}</a>
      <span class="badge badge-neutral">${items.length}</span>
    `;
    return `
      <div class="commitment-group">
        <div class="commitment-group-header">${header}</div>
        <div class="card-grid">${items.map(c => commitmentCardHtml(c)).join("")}</div>
      </div>
    `;
  }).join("");
}

let commitmentsView = "etapa";
function renderCommitmentsView() {
  if (commitmentsView === "etapa") renderCommitmentsKanban();
  else renderByClientView();
}

function renderAllCommitments() {
  renderMissionsHome();
  renderCommitmentsSummary();
  renderCommitmentsView();
}

/* ---------------------------------------------------------- */
/* Painel lateral "Detalhe do Compromisso" (preservado)          */
/* ---------------------------------------------------------- */

function ensureCommitmentDrawer() {
  if (document.getElementById("commitment-drawer")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="commitment-drawer-scrim" id="commitment-drawer-scrim"></div>
    <aside class="commitment-drawer" id="commitment-drawer">
      <div class="commitment-drawer-header">
        <span class="ai-badge"><span class="spark">✦</span> Detalhe do Compromisso</span>
        <button class="icon-btn" id="commitment-drawer-close" aria-label="Fechar">✕</button>
      </div>
      <div class="commitment-drawer-body" id="commitment-drawer-body"></div>
    </aside>
  `);
  const scrim = document.getElementById("commitment-drawer-scrim");
  const drawer = document.getElementById("commitment-drawer");
  function close() { drawer.classList.remove("open"); scrim.classList.remove("open"); }
  document.getElementById("commitment-drawer-close").addEventListener("click", close);
  scrim.addEventListener("click", close);
}

/* Histórico da Pendência (RFC-010, renomeado pela RFC-011) — cada
   movimentação registrada no drawer "Registrar evolução", nunca
   sobrescrita. Distinto da seção "Histórico" acima, que é o contexto
   de fundo do relacionamento (autorado), não o log de movimentações
   do Kanban. */
function commitmentHistoryHtml(c) {
  const history = getCommitmentHistory(c.id);
  if (history.length === 0) {
    return `
      <div class="commitment-drawer-section">
        <div class="type-h3">Histórico da Pendência</div>
        <div class="type-body-sm text-secondary">Nenhuma movimentação registrada ainda.</div>
      </div>
    `;
  }
  const items = [...history].reverse();
  return `
    <div class="commitment-drawer-section">
      <div class="type-h3">Histórico da Pendência</div>
      <div class="flex-col gap-4 mt-2">
        ${items.map(h => `
          <div>
            <div class="type-caption">${h.date} • ${h.time} — ${h.user}</div>
            <div class="type-body-sm mt-1" style="color:var(--text-primary); font-weight:600;">${h.from} → ${h.to}</div>
            <div class="type-body-sm mt-1">${h.descricao}</div>
            ${h.observacoes ? `<div class="type-caption mt-1">Observações: ${h.observacoes}</div>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCommitmentDetail(c, client) {
  const responsavel = c.responsavel === MANAGER.name ? "Você" : c.responsavel;
  const originIcon = COMMITMENT_ORIGIN_ICON[c.origin.type] || "•";
  return `
    <div>
      <div class="type-h3">${c.title}</div>
      <a href="cliente.html?id=${c.clientId}" class="type-body-sm">${client ? client.name : "Cliente"}</a>
    </div>

    <div class="commitment-drawer-section">
      <div class="type-h3">Resumo da interação</div>
      <p class="type-body-sm">${c.detail.resumoInteracao}</p>
    </div>

    <div class="commitment-drawer-section">
      <div class="type-h3">Pessoas envolvidas</div>
      <ul class="list-plain">${c.detail.participantes.map(p => `<li class="type-body-sm">• ${p}</li>`).join("")}</ul>
    </div>

    <div class="commitment-drawer-section">
      <div class="type-h3">Prazo e origem</div>
      <div class="type-body-sm">Prazo: <strong>${commitmentDueLabel(c)}</strong></div>
      <div class="type-body-sm mt-1">Responsável: ${responsavel}</div>
      <div class="type-body-sm mt-1">Origem: ${originIcon} ${c.origin.label}</div>
    </div>

    <div class="commitment-drawer-section">
      <div class="type-h3">Histórico</div>
      <p class="type-body-sm">${c.detail.historico}</p>
    </div>

    ${commitmentHistoryHtml(c)}

    <div class="commitment-drawer-section ai-block">
      <div class="type-h3">🧠 Justificativa da IA</div>
      <p class="type-body-sm">${c.aiSummary}</p>
    </div>

    <div class="commitment-drawer-section">
      <div class="type-h3">Impacto para o relacionamento</div>
      <p class="type-body-sm">${c.detail.impactoRelacionamento}</p>
    </div>

    <div class="risks-block">
      <div class="type-h3">Riscos caso não seja cumprido</div>
      <p class="type-body-sm">${c.detail.riscos}</p>
    </div>
  `;
}

function openCommitmentDrawer(id) {
  const c = getCommitments().find(x => x.id === id);
  if (!c) return;
  const client = getClient(c.clientId);
  document.getElementById("commitment-drawer-body").innerHTML = renderCommitmentDetail(c, client);
  document.getElementById("commitment-drawer").classList.add("open");
  document.getElementById("commitment-drawer-scrim").classList.add("open");
}

/* ---------------------------------------------------------- */
/* Eventos                                                       */
/* ---------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  ensureCommitmentDrawer();
  ensureMissionEvolutionDrawer();
  renderAllCommitments();

  document.getElementById("commitments-segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#commitments-segmented button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    commitmentsView = btn.dataset.view;
    renderCommitmentsView();
  });

  document.getElementById("prioritize-missions-btn").addEventListener("click", prioritizeMissions);

  document.getElementById("commitments-view-root").addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-drawer]");
    if (openBtn) { openCommitmentDrawer(openBtn.dataset.openDrawer); return; }

    const toggleBtn = e.target.closest("[data-toggle-conclude]");
    if (toggleBtn) {
      const panel = document.getElementById("conclude-" + toggleBtn.dataset.toggleConclude);
      if (panel) panel.classList.toggle("open");
      return;
    }

    const concludeBtn = e.target.closest("[data-conclude]");
    if (concludeBtn) {
      const id = concludeBtn.dataset.conclude;
      const outcomeId = concludeBtn.dataset.outcome;
      concludeCommitment(id, outcomeId);
      showToast("Compromisso concluído.", "✓");
      renderAllCommitments();
    }
  });
});
