/* ============================================================
   Compromissos (RFC-003) — promessas assumidas com o cliente,
   identificadas automaticamente pela IA a partir das interações.
   Dados e regras de negócio já vivem em data.js (getCommitments(),
   commitmentBucket(), concludeCommitment()...). Este arquivo é
   apenas a view.
   ============================================================ */

const COMMITMENT_ORIGIN_ICON = { reuniao: "📹", email: "✉", teams: "💬" };
const COMMITMENT_STAGE_ORDER = ["novas", "em_andamento", "dependencias", "em_acompanhamento"];
const COMMITMENT_STAGE_LABEL = {
  novas: "🆕 Novas", em_andamento: "▶️ Em Andamento",
  dependencias: "⏳ Dependências", em_acompanhamento: "👀 Em Acompanhamento"
};
/* Rótulo da "dependência atual" exibida no card (RFC-007-A) — só faz
   sentido para compromissos que dependem de alguém além do gerente;
   quando há uma área interna específica, c.dependencyLabel tem
   prioridade (ex.: "Comitê de Crédito") sobre este rótulo genérico. */
const RESPONSIBILITY_DEPENDENCY_LABEL = { aguardando_cliente: "Cliente", aguardando_area_interna: "Área interna" };
const COMMITMENT_IMPACT_BADGE = { alto: "badge-critical", medio: "badge-attention", baixo: "badge-neutral" };

function commitmentDueLabel(c) {
  if (c.bucket === "concluido") return "Concluído";
  if (c.dueOffsetDays < 0) {
    const days = Math.abs(c.dueOffsetDays);
    return `Em atraso há ${days} dia${days > 1 ? "s" : ""}`;
  }
  return formatDayLabel(c.dueOffsetDays);
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
    <div class="card"><div class="type-caption">Concluídos</div><div class="type-h1 text-positive">${concluidos}</div></div>
  `;
}

function commitmentCardHtml(c, draggable) {
  const client = getClient(c.clientId);
  const isDone = c.bucket === "concluido";
  const originIcon = COMMITMENT_ORIGIN_ICON[c.origin.type] || "•";
  const doneOutcome = isDone ? COMMITMENT_CONCLUDE_OPTIONS.find(o => o.id === getCommitmentDoneMap()[c.id]) : null;
  const dragAttrs = (draggable && !isDone) ? ` draggable="true" data-comm-id="${c.id}"` : "";
  const responsibility = commitmentResponsibility(c);
  const dependencyText = (!isDone && (responsibility === "aguardando_cliente" || responsibility === "aguardando_area_interna"))
    ? (c.dependencyLabel || RESPONSIBILITY_DEPENDENCY_LABEL[responsibility])
    : null;

  return `
    <div class="card ai-block${isDone ? " commitment-done" : ""}"${dragAttrs}>
      <div class="flex items-center justify-between gap-2">
        <span class="type-h3">🎯 ${c.title}</span>
        <span class="badge ${COMMITMENT_IMPACT_BADGE[c.impact]}">${COMMITMENT_IMPACT_LABEL[c.impact]}</span>
      </div>
      <a href="cliente.html?id=${c.clientId}" class="type-body-sm mt-1" style="display:block;">${client ? client.name : "Cliente"}</a>
      <div class="type-body-sm mt-2${c.bucket === "atrasado" ? " text-critical" : ""}">Prazo: <strong>${commitmentDueLabel(c)}</strong></div>
      <div class="type-body-sm mt-1">Origem: ${originIcon} ${c.origin.label}</div>
      ${dependencyText ? `<div class="type-body-sm mt-1">Dependência atual: <strong>${dependencyText}</strong></div>` : ""}
      <div class="type-body-sm mt-3">🧠 ${c.aiSummary}</div>
      ${isDone
        ? `<div class="type-caption mt-3 text-secondary">Desfecho: ${doneOutcome ? doneOutcome.label : "registrado"}</div>`
        : `
        <div class="flex gap-2 mt-3">
          <button class="btn btn-ghost btn-sm" data-open-drawer="${c.id}">Ver detalhes</button>
          <button class="btn btn-secondary btn-sm" data-toggle-conclude="${c.id}">Concluir ▾</button>
        </div>
        <div class="conclude-panel" id="conclude-${c.id}">
          <div class="type-caption mb-2" style="width:100%;">Como terminou este compromisso?</div>
          ${COMMITMENT_CONCLUDE_OPTIONS.map(o => `<button class="btn btn-secondary btn-sm" data-conclude="${c.id}" data-outcome="${o.id}">${o.label}</button>`).join("")}
        </div>
      `}
    </div>
  `;
}

/* ---------------------------------------------------------- */
/* Visão "Por Etapa" — Kanban (RFC-007, evoluído pela RFC-007-A)  */
/* Reaproveita a estrutura do Kanban já existente em Oportunidades */
/* (.kanban/.kanban-column/.kanban-column-header/.kanban-cards e o */
/* mesmo mecanismo de drag-and-drop) — só muda o agrupamento e o   */
/* conteúdo do card, que continua sendo o commitmentCardHtml(c)   */
/* de sempre, sem nenhuma informação removida. As colunas agora     */
/* representam o ciclo de vida da Missão (Novas → Em Andamento →   */
/* Dependências → Em Acompanhamento → Concluídas); a responsabilidade */
/* deixou de ser coluna e aparece dentro do card ("Dependência atual"). */
/* ---------------------------------------------------------- */
function renderCommitmentsKanban() {
  const root = document.getElementById("commitments-view-root");
  const all = getCommitments();
  const open = all.filter(c => c.bucket !== "concluido");
  const done = all.filter(c => c.bucket === "concluido");

  const columns = COMMITMENT_STAGE_ORDER.map(key => ({
    key, label: COMMITMENT_STAGE_LABEL[key],
    items: open.filter(c => commitmentStage(c) === key)
  }));
  columns.push({ key: "concluidas", label: "✅ Concluídas", items: done });

  root.innerHTML = `
    <div class="kanban">
      ${columns.map(col => `
        <div class="kanban-column${col.key === "concluidas" ? " stage-fechado" : ""}" data-stage="${col.key}">
          <div class="kanban-column-header">
            <span class="type-h3">${col.label}</span>
            <span class="badge badge-neutral">${col.items.length}</span>
          </div>
          <div class="kanban-cards">${col.items.map(c => commitmentCardHtml(c, col.key !== "concluidas")).join("")}</div>
        </div>
      `).join("")}
    </div>
    <p class="type-caption mt-3">Arraste os cartões entre colunas para atualizar a etapa da Missão, ou solte em "Concluídas" para concluir.</p>
  `;

  let draggedId = null;
  root.querySelectorAll("[data-comm-id]").forEach(card => {
    card.addEventListener("dragstart", () => { draggedId = card.dataset.commId; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  root.querySelectorAll(".kanban-column").forEach(col => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      if (!draggedId) return;
      if (col.dataset.stage === "concluidas") {
        concludeCommitment(draggedId, "outro");
        showToast("Missão concluída.", "✓");
        renderAllCommitments();
      } else {
        setCommitmentStageOverride(draggedId, col.dataset.stage);
        showToast("A etapa desta Missão foi atualizada.", "✦");
        renderCommitmentsKanban();
      }
    });
  });
}

function renderByClientView() {
  const root = document.getElementById("commitments-view-root");
  const open = getCommitments().filter(c => c.bucket !== "concluido");
  const byClient = {};
  open.forEach(c => { (byClient[c.clientId] = byClient[c.clientId] || []).push(c); });
  const clientIds = Object.keys(byClient).sort((a, b) => byClient[b].length - byClient[a].length);

  if (clientIds.length === 0) {
    root.innerHTML = `<div class="card empty-state"><div class="empty-icon">✓</div><div>Nenhum compromisso em aberto no momento.</div></div>`;
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
  renderCommitmentsSummary();
  renderCommitmentsView();
}

/* ---------------------------------------------------------- */
/* Painel lateral "Detalhe do Compromisso"                      */
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
  renderAllCommitments();

  document.getElementById("commitments-segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#commitments-segmented button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    commitmentsView = btn.dataset.view;
    renderCommitmentsView();
  });

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
