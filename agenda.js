/* ============================================================
   Agenda Inteligente (RFC-005) — calendário completo (Dia/Semana/
   Mês/Agenda), Home da Agenda, Painel Inteligente contextual,
   Modo Reunião proativo e Registrar Reunião por Voz (preservado).
   ============================================================ */

/* ---------------------------------------------------------- */
/* Estado de reuniões registradas / rascunhos (já existente)    */
/* ---------------------------------------------------------- */
function getRegisteredOverrides() {
  return JSON.parse(localStorage.getItem("crm-meeting-registered") || "{}");
}
function setRegistered(meetingId) {
  const map = getRegisteredOverrides();
  map[meetingId] = true;
  localStorage.setItem("crm-meeting-registered", JSON.stringify(map));
}
function isRegistered(m) {
  if (m.registrada) return true;
  return !!getRegisteredOverrides()[m.id];
}

function getSavedDrafts() {
  return JSON.parse(localStorage.getItem("crm-meeting-draft") || "{}");
}
function saveDraft(meetingId, draft) {
  const map = getSavedDrafts();
  map[meetingId] = draft;
  localStorage.setItem("crm-meeting-draft", JSON.stringify(map));
}
function getDraftForMeeting(m, client) {
  const saved = getSavedDrafts()[m.id];
  return saved || generateDraft(client, m);
}

function briefingSectionsHtml(client) {
  const pendencias = client.planning.objectives.filter(o => computeObjectiveStatus(o) === "atrasado").map(o => o.title);
  const lastEntry = client.timeline[client.timeline.length - 1];
  const rec = generateRecommendation(client);
  return `
    <div class="flex-col gap-4 mt-3">
      <div><div class="type-caption mb-1">HISTÓRICO RELEVANTE</div><p class="type-body-sm" style="color:var(--text-primary);">${client.timeline.slice(-2).map(t => t.text).join(" ")}</p></div>
      <div><div class="type-caption mb-1">PENDÊNCIAS EM ABERTO</div><p class="type-body-sm" style="color:var(--text-primary);">${pendencias.length ? pendencias.join("; ") : "Nenhuma pendência em aberto."}</p></div>
      <div><div class="type-caption mb-1">OPORTUNIDADES</div><p class="type-body-sm" style="color:var(--text-primary);">${client.opportunities.length ? client.opportunities.map(o => `${o.product} (${o.probabilityPct}%)`).join(", ") : "Nenhuma oportunidade identificada no momento."}</p></div>
      <div><div class="type-caption mb-1">PRODUTOS CONTRATADOS</div><p class="type-body-sm" style="color:var(--text-primary);">${client.products.join(", ")}</p></div>
      <div><div class="type-caption mb-1">PESSOAS-CHAVE</div><p class="type-body-sm" style="color:var(--text-primary);">${client.contato.nome} — ${client.contato.cargo}</p></div>
      <div><div class="type-caption mb-1">ÚLTIMA CONVERSA</div><p class="type-body-sm" style="color:var(--text-primary);">${lastEntry.title}: ${lastEntry.text}</p></div>
      <div class="ai-block">
        <div class="ai-badge mb-1"><span class="spark">✦</span> Recomendação da IA para esta reunião</div>
        <p class="type-body-sm" style="color:var(--text-primary);">${rec.text}</p>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------- */
/* Fluxo pós-reunião (Fase 5) — rascunho gerado pela IA a partir */
/* do registro por voz, agora cobrindo decisões, compromissos e */
/* o impacto esperado em cada módulo relacionado.                */
/* ---------------------------------------------------------- */
function generateDraft(client, meeting) {
  const assunto = meeting ? meeting.title.toLowerCase() : "o andamento do relacionamento";
  return {
    resumo: `Reunião com ${client.contato.nome} (${client.contato.cargo}) sobre ${assunto}. Conversa produtiva sobre o andamento do relacionamento e próximos passos comerciais. Cliente demonstrou ${client.risk === "critical" ? "preocupação com a situação financeira recente" : "abertura para avançar nas discussões em curso"}.`,
    decisoes: client.risk === "critical"
      ? [`${client.contato.nome} se comprometeu a regularizar a pendência em aberto.`]
      : ["Cliente concordou em avançar para a próxima etapa da negociação em curso."],
    timelineNote: `Registro de reunião: principais pontos discutidos incluíram andamento comercial, contexto do setor de ${client.setor.toLowerCase()} e alinhamento de próximos passos.`,
    planningNote: client.planning.objectives.length ? `Reforçado o objetivo "${client.planning.objectives[0].title}" durante a conversa.` : "Nenhuma atualização de Planning identificada nesta conversa.",
    tarefasText: "Enviar material comercial em até 5 dias úteis\nAgendar follow-up em 30 dias",
    oportunidades: client.opportunities.length ? `Reforçado interesse em ${client.opportunities[0].product}; manter estágio "${client.opportunities[0].stage}".` : "Nenhuma nova oportunidade identificada nesta conversa.",
    relationshipNote: `Relationship Score de ${client.contato.nome} será reavaliado com base no tom da conversa — revise no perfil do cliente após a atualização.`
  };
}

function renderRegisteredView(container, meeting, client) {
  const draft = getDraftForMeeting(meeting, client);
  container.innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Registrado por voz — aplicado ao perfil do cliente</div>
    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Resumo da reunião</span></div>
      <p class="type-body-sm" style="color:var(--text-primary);">${draft.resumo}</p>
    </div>
    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Timeline</span></div>
      <p class="type-body-sm" style="color:var(--text-primary);">${draft.timelineNote}</p>
    </div>
    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Account Planning</span></div>
      <p class="type-body-sm" style="color:var(--text-primary);">${draft.planningNote}</p>
    </div>
    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Compromissos / follow-ups</span></div>
      <p class="type-body-sm" style="color:var(--text-primary); white-space:pre-line;">${draft.tarefasText}</p>
      <a href="compromissos.html" class="type-caption mt-2" style="display:block;">Ver em Pendências →</a>
    </div>
    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Oportunidades</span></div>
      <p class="type-body-sm" style="color:var(--text-primary);">${draft.oportunidades}</p>
    </div>
  `;
}

function refreshAfterVoiceFlow(meetingId) {
  if (document.getElementById("agenda-list-root")) renderAgenda();
  else renderCurrentView();

  const panel = document.getElementById("meeting-panel");
  if (panel && panel.classList.contains("open")) openMeetingPanel(meetingId);
}

/* ---------------------------------------------------------- */
/* Visão "Agenda" — lista agrupada por dia (comportamento         */
/* original, inalterado)                                          */
/* ---------------------------------------------------------- */
function meetingCardHtml(m) {
  const client = getClient(m.clientId);
  const statusBadge = m.status === "agendada"
    ? (m.briefingReady ? '<span class="badge badge-positive">Briefing pronto</span>' : '<span class="badge badge-attention">Briefing em preparação</span>')
    : (isRegistered(m) ? '<span class="badge badge-neutral">Registrada</span>' : '<span class="badge badge-attention">Sem registro</span>');

  return `
    <div class="card" data-meeting-card="${m.id}">
      <div class="flex items-center justify-between">
        <div>
          <a href="cliente.html?id=${client.id}" class="type-h3">${client.name}</a>
          <div class="type-body-sm">${m.time} · ${m.type}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="mt-3 flex gap-2" style="flex-wrap:wrap;">
        ${m.status === "agendada"
          ? `<button class="btn btn-secondary btn-sm" data-toggle-briefing="${m.id}">Ver Briefing Antes da Reunião</button>`
          : (isRegistered(m)
              ? `<button class="btn btn-secondary btn-sm" data-toggle-registered="${m.id}">Ver o que foi registrado</button>`
              : `<button class="btn btn-primary btn-sm" data-open-capture="${m.id}">✦ Registrar Interação</button>`)}
        <button class="btn btn-ai btn-sm" data-open-meeting="${m.id}">✦ Painel Inteligente</button>
      </div>
      <div class="mt-2" id="expand-${m.id}"></div>
    </div>
  `;
}

function renderAgenda() {
  const root = document.getElementById("agenda-list-root");
  if (!root) return;
  const meetings = getMeetingsSorted();
  const groups = {};
  meetings.forEach(m => {
    const label = formatDayLabel(m.offsetDays);
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  });

  root.innerHTML = Object.entries(groups).map(([label, list]) => `
    <div>
      <div class="type-h2 mb-3">${label}</div>
      <div class="flex-col gap-3">${list.map(meetingCardHtml).join("")}</div>
    </div>
  `).join("");

  root.querySelectorAll("[data-toggle-briefing]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = MEETINGS.find(mm => mm.id === btn.dataset.toggleBriefing);
      const client = getClient(m.clientId);
      const expandEl = document.getElementById(`expand-${m.id}`);
      if (expandEl.dataset.open === "true") { expandEl.innerHTML = ""; expandEl.dataset.open = "false"; btn.textContent = "Ver Briefing Antes da Reunião"; return; }
      expandEl.dataset.open = "true";
      btn.textContent = "Ocultar Briefing";
      if (!m.briefingReady) {
        expandEl.innerHTML = `<p class="type-body-sm mt-2">O briefing ainda está sendo preparado pela IA e estará disponível em breve.</p>`;
        return;
      }
      expandEl.innerHTML = briefingSectionsHtml(client);
    });
  });

  root.querySelectorAll("[data-open-capture]").forEach(btn => {
    btn.addEventListener("click", () => openCaptureFlow(btn.dataset.openCapture));
  });

  root.querySelectorAll("[data-toggle-registered]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = MEETINGS.find(mm => mm.id === btn.dataset.toggleRegistered);
      const client = getClient(m.clientId);
      const expandEl = document.getElementById(`expand-${m.id}`);
      if (expandEl.dataset.open === "true") { expandEl.innerHTML = ""; expandEl.dataset.open = "false"; btn.textContent = "Ver o que foi registrado"; return; }
      expandEl.dataset.open = "true";
      btn.textContent = "Ocultar registro";
      renderRegisteredView(expandEl, m, client);
    });
  });

  root.querySelectorAll("[data-open-meeting]").forEach(btn => {
    btn.addEventListener("click", () => openMeetingPanel(btn.dataset.openMeeting));
  });
}

/* ---------------------------------------------------------- */
/* Home da Agenda                                                */
/* ---------------------------------------------------------- */
function pad2(n) { return String(n).padStart(2, "0"); }

function renderAgendaHome() {
  const root = document.getElementById("agenda-home-root");
  if (!root) return;
  const todays = getTodaysMeetings();

  if (todays.length === 0) {
    root.innerHTML = `
      <div class="ai-block briefing-block agenda-home-summary">
        <div class="ai-badge mb-2"><span class="spark">✦</span> Home da Agenda</div>
        <p class="type-body-lg">Bom dia, ${MANAGER.name.split(" ")[0]}. Sua agenda está livre hoje — nenhuma reunião de cliente agendada. Bom momento para avançar itens de "Por Onde Começo?" ou revisar o Account Planning.</p>
      </div>
    `;
    return;
  }

  const criticalClients = new Set(todays.filter(m => getClient(m.clientId).risk === "critical").map(m => m.clientId));
  const highRiskMeeting = todays.find(m => getClient(m.clientId).risk === "critical");
  const totalMin = todays.reduce((acc, m) => acc + (m.durationMin || 30), 0);
  const h = Math.floor(totalMin / 60), mm = totalMin % 60;
  const topOpp = getTopOpportunities(1)[0];

  root.innerHTML = `
    <div class="ai-block briefing-block agenda-home-summary">
      <div class="ai-badge mb-2"><span class="spark">✦</span> Home da Agenda</div>
      <p class="type-body-lg">Bom dia, ${MANAGER.name.split(" ")[0]}. Hoje você tem <strong>${todays.length} reunião${todays.length === 1 ? "" : "es"}</strong>, ${criticalClients.size} cliente${criticalClients.size === 1 ? "" : "s"} prioritário${criticalClients.size === 1 ? "" : "s"}${highRiskMeeting ? ` (incluindo 1 reunião de alto risco com ${getClient(highRiskMeeting.clientId).name})` : ""} e uma oportunidade de ${formatCurrencyCompact(topOpp.impact)} em aberto na carteira. Tempo total em reuniões: ${h}h${mm > 0 ? pad2(mm) : ""}. Todos os briefings já foram preparados pela IA.</p>
    </div>
  `;
}

/* ---------------------------------------------------------- */
/* Calendário — estado, navegação e visões Dia/Semana/Mês         */
/* ---------------------------------------------------------- */
const AGENDA_VIEWS = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "agenda", label: "Agenda" }
];
const GRID_START_HOUR = 8, GRID_END_HOUR = 19, HOUR_PX = 56;
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

let agendaView = localStorage.getItem("crm-agenda-view") || "semana";
let agendaAnchorDate = new Date();
let agendaVisibleCalendars = JSON.parse(localStorage.getItem("crm-agenda-calendars") || '{"principal":true,"equipe":true}');

function dateOnly(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dateToOffsetDays(date) {
  const today = dateOnly(new Date());
  const d = dateOnly(date);
  return Math.round((d - today) / 86400000);
}
function startOfWeek(date) {
  const d = dateOnly(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}
function startOfMonthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}
function visibleEvents(list) {
  return list.filter(m => agendaVisibleCalendars[m.calendar || "principal"] !== false);
}

function renderViewSegmented() {
  const root = document.getElementById("agenda-view-segmented");
  root.innerHTML = AGENDA_VIEWS.map(v => `<button data-view="${v.key}" class="${v.key === agendaView ? "active" : ""}">${v.label}</button>`).join("");
  root.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      agendaView = btn.dataset.view;
      localStorage.setItem("crm-agenda-view", agendaView);
      renderViewSegmented();
      renderCurrentView();
    });
  });
}

function renderCalendarToggles() {
  const root = document.getElementById("agenda-calendar-toggles");
  root.innerHTML = `
    <label><input type="checkbox" data-cal="principal" ${agendaVisibleCalendars.principal !== false ? "checked" : ""}> <span class="cal-dot principal"></span> Calendário Principal</label>
    <label><input type="checkbox" data-cal="equipe" ${agendaVisibleCalendars.equipe !== false ? "checked" : ""}> <span class="cal-dot equipe"></span> Equipe Comercial</label>
  `;
  root.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      agendaVisibleCalendars[cb.dataset.cal] = cb.checked;
      localStorage.setItem("crm-agenda-calendars", JSON.stringify(agendaVisibleCalendars));
      renderCurrentView();
    });
  });
}

/* ---------------------------------------------------------- */
/* Favoritos — clientes marcados a partir do Painel Inteligente   */
/* ---------------------------------------------------------- */
function getFavoriteClientIds() {
  return JSON.parse(localStorage.getItem("crm-agenda-favorites") || "[]");
}
function isFavoriteClient(clientId) {
  return getFavoriteClientIds().includes(clientId);
}
function toggleFavoriteClient(clientId) {
  const list = getFavoriteClientIds();
  const idx = list.indexOf(clientId);
  if (idx === -1) list.push(clientId); else list.splice(idx, 1);
  localStorage.setItem("crm-agenda-favorites", JSON.stringify(list));
  return list.includes(clientId);
}

function renderAgendaFavorites() {
  const root = document.getElementById("agenda-favorites-root");
  if (!root) return;
  const ids = getFavoriteClientIds();
  if (ids.length === 0) {
    root.innerHTML = `<div class="type-body-sm text-secondary">Nenhum cliente favoritado ainda. Abra o Painel Inteligente de uma reunião e toque na estrela ao lado do nome do cliente para favoritar.</div>`;
    return;
  }
  root.innerHTML = `<div class="flex-col gap-2">${ids.map(id => {
    const c = getClient(id);
    return `<a href="cliente.html?id=${c.id}" class="chip">★ ${c.name}</a>`;
  }).join("")}</div>`;
}

function navLabel() {
  if (agendaView === "mes") return agendaAnchorDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (agendaView === "dia") return agendaAnchorDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
  if (agendaView === "semana") {
    const start = startOfWeek(agendaAnchorDate);
    const end = addDays(start, 6);
    return `${start.getDate()} — ${end.getDate()} de ${end.toLocaleDateString("pt-BR", { month: "long" })}`;
  }
  return "Todos os próximos compromissos";
}

function updateNavControls() {
  document.getElementById("agenda-nav-label").textContent = navLabel();
  const showNav = agendaView !== "agenda";
  ["agenda-nav-prev", "agenda-nav-next", "agenda-nav-today"].forEach(id => {
    document.getElementById(id).style.display = showNav ? "" : "none";
  });
}

function navStep(dir) {
  if (agendaView === "dia") agendaAnchorDate = addDays(agendaAnchorDate, dir);
  else if (agendaView === "semana") agendaAnchorDate = addDays(agendaAnchorDate, dir * 7);
  else if (agendaView === "mes") { const d = new Date(agendaAnchorDate); d.setMonth(d.getMonth() + dir); agendaAnchorDate = d; }
  renderCurrentView();
}

function renderCurrentView() {
  updateNavControls();
  const root = document.getElementById("agenda-view-root");
  if (agendaView === "mes") renderMonthView(root);
  else if (agendaView === "semana") renderWeekView(root);
  else if (agendaView === "dia") renderDayView(root);
  else { root.innerHTML = `<div id="agenda-list-root" class="flex-col gap-4"></div>`; renderAgenda(); }
}

function monthEventChipHtml(m) {
  const isEquipe = m.calendar === "equipe";
  const client = m.clientId ? getClient(m.clientId) : null;
  const riskClass = !isEquipe && client && client.risk === "critical" ? " risk-critical" : "";
  const label = isEquipe ? m.title : client.name;
  return `<div class="month-event-chip${isEquipe ? " equipe" : ""}${riskClass}" data-open-meeting="${m.id}">${m.time} ${label}</div>`;
}

function renderMonthView(root) {
  const gridStart = startOfMonthGrid(agendaAnchorDate);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));

  root.innerHTML = `
    <div class="month-grid">
      ${WEEKDAY_LABELS.map(w => `<div class="month-weekday">${w}</div>`).join("")}
      ${cells.map(d => {
        const offset = dateToOffsetDays(d);
        const outside = d.getMonth() !== agendaAnchorDate.getMonth();
        const events = visibleEvents(getMeetingsInRange(offset, offset));
        const shown = events.slice(0, 3);
        const more = events.length - shown.length;
        return `
          <div class="month-cell${outside ? " outside" : ""}${offset === 0 ? " today" : ""}" data-offset="${offset}">
            <div class="month-cell-date">${d.getDate()}</div>
            ${shown.map(monthEventChipHtml).join("")}
            ${more > 0 ? `<div class="month-event-more">+${more} mais</div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
  wireEventOpeners(root);
  root.querySelectorAll(".month-cell").forEach(cell => {
    cell.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-meeting]")) return;
      agendaAnchorDate = addDays(new Date(), parseInt(cell.dataset.offset, 10));
      agendaView = "dia";
      localStorage.setItem("crm-agenda-view", agendaView);
      renderViewSegmented();
      renderCurrentView();
    });
  });
}

function eventBlockHtml(m) {
  const [h, min] = m.time.split(":").map(Number);
  const startMin = h * 60 + min;
  const gridStartMin = GRID_START_HOUR * 60;
  const top = Math.max(0, (startMin - gridStartMin) / 60) * HOUR_PX;
  const height = Math.max(20, ((m.durationMin || 30) / 60) * HOUR_PX - 2);
  const isEquipe = m.calendar === "equipe";
  const client = m.clientId ? getClient(m.clientId) : null;
  const riskClass = !isEquipe && client && client.risk === "critical" ? " risk-critical" : "";
  const label = isEquipe ? m.title : client.name;
  return `
    <div class="time-grid-event${isEquipe ? " equipe" : ""}${riskClass}" style="top:${top}px; height:${height}px;" data-open-meeting="${m.id}">
      <div class="tge-time">${m.time}</div>
      <div class="tge-title">${label}</div>
    </div>
  `;
}

function timeGridHtml(days) {
  const hours = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) hours.push(h);
  return `
    <div class="time-grid-wrap">
      <div class="time-grid-hours">
        <div style="height:44px;"></div>
        ${hours.map(h => `<div class="time-grid-hour-label">${pad2(h)}:00</div>`).join("")}
      </div>
      <div class="time-grid-days" style="grid-template-columns: repeat(${days.length}, 1fr);">
        ${days.map(d => {
          const offset = dateToOffsetDays(d);
          const events = visibleEvents(getMeetingsInRange(offset, offset));
          return `
            <div class="time-grid-day-col" data-offset="${offset}">
              <div class="time-grid-day-header${offset === 0 ? " today" : ""}">
                <span class="dow">${d.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
                <span class="dom">${d.getDate()}</span>
              </div>
              <div style="position:relative;">
                ${hours.map(() => `<div class="time-grid-hour-row"></div>`).join("")}
                ${events.map(eventBlockHtml).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderWeekView(root) {
  const start = startOfWeek(agendaAnchorDate);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  root.innerHTML = timeGridHtml(days);
  wireEventOpeners(root);
}

function renderDayView(root) {
  root.innerHTML = timeGridHtml([dateOnly(agendaAnchorDate)]);
  wireEventOpeners(root);
}

function wireEventOpeners(root) {
  root.querySelectorAll("[data-open-meeting]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openMeetingPanel(el.dataset.openMeeting);
    });
  });
}

/* ---------------------------------------------------------- */
/* Painel Inteligente — contextual ao compromisso selecionado    */
/* ---------------------------------------------------------- */
function ensureMeetingPanel() {
  if (document.getElementById("meeting-panel")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="meeting-panel-scrim" id="meeting-panel-scrim"></div>
    <aside class="meeting-panel" id="meeting-panel">
      <div class="meeting-panel-header">
        <span class="ai-badge"><span class="spark">✦</span> Painel Inteligente</span>
        <button class="icon-btn" id="meeting-panel-close" aria-label="Fechar">✕</button>
      </div>
      <div class="meeting-panel-body" id="meeting-panel-body"></div>
    </aside>
  `);
  const scrim = document.getElementById("meeting-panel-scrim");
  const panel = document.getElementById("meeting-panel");
  function close() { panel.classList.remove("open"); scrim.classList.remove("open"); }
  document.getElementById("meeting-panel-close").addEventListener("click", close);
  scrim.addEventListener("click", close);
}

function meetingCommitmentDueLabel(c) {
  if (c.bucket === "concluido") return "Concluído";
  if (c.dueOffsetDays < 0) { const days = Math.abs(c.dueOffsetDays); return `Em atraso há ${days} dia${days > 1 ? "s" : ""}`; }
  return formatDayLabel(c.dueOffsetDays);
}

function renderMeetingPanelBody(m) {
  if (m.calendar === "equipe") {
    return `
      <div>
        <div class="type-h3">${m.title}</div>
        <div class="type-body-sm mt-1">${formatDayLabel(m.offsetDays)} · ${m.time} · ${m.type}</div>
        <div class="type-body-sm mt-1">${m.location}</div>
      </div>
      <div class="type-body-sm text-secondary">Compromisso interno — não vinculado a um cliente da carteira.</div>
    `;
  }

  const client = getClient(m.clientId);
  const rec = generateRecommendation(client);
  const participants = getMeetingParticipants(m);
  const commitments = getCommitments().filter(c => c.clientId === client.id && c.bucket !== "concluido");
  const objective = client.planning.objectives[0];

  return `
    <div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <a href="cliente.html?id=${client.id}" class="type-h3">${client.name}</a>
          <button class="icon-btn" data-toggle-favorite="${client.id}" title="${isFavoriteClient(client.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}" style="width:28px; height:28px; font-size:14px;">${isFavoriteClient(client.id) ? "★" : "☆"}</button>
        </div>
        <span class="badge ${client.risk === "critical" ? "badge-critical" : client.risk === "attention" ? "badge-attention" : "badge-positive"}">${riskLabel(client.risk)}</span>
      </div>
      <div class="type-body-sm mt-1">${formatDayLabel(m.offsetDays)} · ${m.time} (${m.durationMin || 30} min) · ${m.type} · ${m.location}</div>
    </div>

    <div class="meeting-panel-section ai-block">
      <div class="ai-badge mb-2"><span class="spark">✦</span> Briefing Executivo</div>
      <div class="type-h3">${m.title}</div>
      <p class="type-body-sm mt-1">${rec.text}</p>
    </div>

    <div class="meeting-panel-section">
      <div class="type-h3">Participantes</div>
      ${participants.length ? participants.map(s => `
        <div class="meeting-participant-row" data-open-participant="${s.id}" data-client="${client.id}">
          <div class="contact-avatar">${s.iniciais}</div>
          <div style="flex:1; min-width:0;">
            <div class="type-body-sm" style="color:var(--text-primary); font-weight:600;">${s.nome}</div>
            <div class="type-caption">${s.cargo} · ${client.name}</div>
          </div>
        </div>
      `).join("") : `<div class="type-body-sm text-secondary">Nenhum stakeholder mapeado para este cliente ainda.</div>`}
    </div>

    <div class="meeting-panel-section change-block">
      <div class="type-h3">O que mudou desde a última reunião</div>
      <ul class="list-plain">${(m.whatChanged || []).map(t => `<li class="type-body-sm">• ${t}</li>`).join("")}</ul>
    </div>

    <div class="meeting-panel-section">
      <div class="type-h3">Histórico das últimas interações</div>
      <p class="type-body-sm">${client.timeline.slice(-2).map(t => t.text).join(" ")}</p>
    </div>

    <div class="meeting-panel-section">
      <div class="type-h3">Pendências</div>
      ${commitments.length ? commitments.map(c => `<div class="type-body-sm mt-1">🎯 ${c.title} — ${meetingCommitmentDueLabel(c)}</div>`).join("") : `<div class="type-body-sm text-secondary">Nenhuma pendência em aberto para este cliente.</div>`}
      <a href="compromissos.html" class="type-caption mt-2" style="display:block;">Ver Pendências →</a>
    </div>

    <div class="meeting-panel-section">
      <div class="type-h3">Account Planning relacionado</div>
      ${objective ? `
        <div class="type-body-sm" style="color:var(--text-primary);">${objective.title}</div>
        <span class="badge ${PLANNING_STATUS_BADGE[computeObjectiveStatus(objective)]}">${PLANNING_STATUS_LABEL[computeObjectiveStatus(objective)]}</span>
      ` : `<div class="type-body-sm text-secondary">Nenhum objetivo de Planning registrado para este cliente.</div>`}
      <a href="planning.html" class="type-caption mt-2" style="display:block;">Ver Planning →</a>
    </div>

    <div class="meeting-panel-section">
      <div class="type-h3">Oportunidades relacionadas</div>
      ${client.opportunities.length ? client.opportunities.map(o => `<div class="type-body-sm mt-1">${o.product} — ${o.probabilityPct}% · ${formatCurrencyCompact(o.impact)}</div>`).join("") : `<div class="type-body-sm text-secondary">Nenhuma oportunidade identificada para este cliente no momento.</div>`}
      <a href="pipeline.html" class="type-caption mt-2" style="display:block;">Ver no Pipeline →</a>
    </div>

    <div class="meeting-panel-section">
      <div class="type-h3">Produtos com maior potencial</div>
      ${(m.suggestedProducts || []).map(p => `<div class="type-body-sm mt-1"><strong>${p.product}</strong> — ${p.justification}</div>`).join("")}
    </div>

    <div class="meeting-panel-section risks-block">
      <div class="type-h3">Riscos</div>
      <ul class="list-plain">${(m.risks || []).map(r => `<li class="type-body-sm">• ${r}</li>`).join("")}</ul>
    </div>

    <div class="meeting-panel-section strategy-final">
      <div class="type-h2 mb-2">🧠 Estratégia sugerida</div>
      <p class="type-body-sm" style="color:var(--text-primary);">${m.strategySuggestion}</p>
    </div>

    <!--
    <div class="meeting-panel-section">
      <div class="type-h3">Ações rápidas</div>
      <div class="meeting-quick-actions">
        <a class="btn btn-secondary btn-sm" href="cliente.html?id=${client.id}">Abrir Cliente</a>
        <a class="btn btn-secondary btn-sm" href="pipeline.html">Abrir Oportunidade</a>
        <a class="btn btn-secondary btn-sm" href="planning.html">Abrir Planning</a>
        <a class="btn btn-secondary btn-sm" href="compromissos.html">Abrir Pendências</a>
        <button class="btn btn-ai btn-sm" data-toast="Chamada do Teams simulada.">💬 Iniciar Teams</button>
        <button class="btn btn-secondary btn-sm" data-toast="E-mail simulado enviado.">📧 Enviar E-mail</button>
      </div>
    </div>
    -->

    ${m.status === "concluida" ? `
      <div class="meeting-panel-section">
        <div class="type-h3">Registro da reunião</div>
        <div id="meeting-panel-voice-${m.id}"></div>
      </div>
    ` : ""}
  `;
}

function openMeetingPanel(id) {
  const m = MEETINGS.find(x => x.id === id);
  if (!m) return;
  ensureMeetingPanel();
  const body = document.getElementById("meeting-panel-body");
  body.innerHTML = renderMeetingPanelBody(m);
  document.getElementById("meeting-panel").classList.add("open");
  document.getElementById("meeting-panel-scrim").classList.add("open");

  body.querySelectorAll("[data-open-participant]").forEach(row => {
    row.addEventListener("click", () => {
      window.location.href = `cliente.html?id=${row.dataset.client}&contact=${row.dataset.openParticipant}`;
    });
  });
  body.querySelectorAll("[data-toast]").forEach(btn => {
    btn.addEventListener("click", () => showToast(btn.dataset.toast, "✓"));
  });
  body.querySelectorAll("[data-toggle-favorite]").forEach(btn => {
    btn.addEventListener("click", () => {
      const nowFav = toggleFavoriteClient(btn.dataset.toggleFavorite);
      btn.textContent = nowFav ? "★" : "☆";
      btn.title = nowFav ? "Remover dos favoritos" : "Adicionar aos favoritos";
      showToast(nowFav ? "Cliente adicionado aos favoritos." : "Cliente removido dos favoritos.", nowFav ? "★" : "✓");
      renderAgendaFavorites();
    });
  });

  if (m.calendar !== "equipe" && m.status === "concluida") {
    const client = getClient(m.clientId);
    const voiceRoot = document.getElementById(`meeting-panel-voice-${m.id}`);
    if (voiceRoot) {
      if (isRegistered(m)) {
        voiceRoot.innerHTML = `<button class="btn btn-secondary btn-sm" id="panel-toggle-registered-${m.id}">Ver o que foi registrado</button><div class="mt-2" id="panel-registered-${m.id}"></div>`;
        document.getElementById(`panel-toggle-registered-${m.id}`).addEventListener("click", () => {
          renderRegisteredView(document.getElementById(`panel-registered-${m.id}`), m, client);
        });
      } else {
        voiceRoot.innerHTML = `<button class="btn btn-primary btn-sm" id="panel-open-capture-${m.id}">✦ Registrar Interação</button>`;
        document.getElementById(`panel-open-capture-${m.id}`).addEventListener("click", () => openCaptureFlow(m.id));
      }
    }
  }
}

/* ---------------------------------------------------------- */
/* Modo Reunião — takeover proativo antes da reunião              */
/* ---------------------------------------------------------- */
function ensureMeetingModeModal() {
  if (document.getElementById("meeting-mode-scrim")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="meeting-mode-scrim" id="meeting-mode-scrim">
      <div class="meeting-mode-modal" id="meeting-mode-modal"></div>
    </div>
  `);
}

function getMeetingModeDismissed() {
  return JSON.parse(localStorage.getItem("crm-meeting-mode-dismissed") || "[]");
}
function dismissMeetingMode(id) {
  const list = getMeetingModeDismissed();
  list.push(id);
  localStorage.setItem("crm-meeting-mode-dismissed", JSON.stringify(list));
}

function closeMeetingMode() {
  const scrim = document.getElementById("meeting-mode-scrim");
  if (scrim) scrim.classList.remove("open");
}

function openMeetingMode(m, minutesUntil) {
  const client = getClient(m.clientId);
  const participants = getMeetingParticipants(m);
  const commitments = getCommitments().filter(c => c.clientId === client.id && c.bucket !== "concluido");

  document.getElementById("meeting-mode-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Modo Reunião</div>
    <div class="type-h2">Sua próxima reunião começa em <span class="meeting-mode-countdown">${minutesUntil} min</span></div>
    <div class="divider"></div>
    <div class="type-caption">Cliente</div>
    <div class="type-h3 mb-2">${client.name}</div>
    <div class="type-caption">Objetivo</div>
    <p class="type-body-sm mb-2">${m.title}</p>
    <div class="type-caption mb-1">Você falará com</div>
    ${participants.map(s => `<div class="type-body-sm">• ${s.nome} — ${s.cargo} (Relationship Score ${s.relationshipScore})</div>`).join("")}
    <div class="divider"></div>
    <div class="type-h3 mb-2">O que mudou desde a última reunião</div>
    ${(m.whatChanged || []).map(t => `<div class="type-body-sm">✔ ${t}</div>`).join("")}
    <div class="divider"></div>
    <div class="type-h3 mb-2">Pendências abertas</div>
    ${commitments.length ? commitments.map(c => `<div class="type-body-sm">• ${c.title}</div>`).join("") : `<div class="type-body-sm text-secondary">Nenhuma pendência em aberto.</div>`}
    <div class="divider"></div>
    <div class="type-h3 mb-2">Produtos sugeridos</div>
    ${(m.suggestedProducts || []).map(p => `<div class="type-body-sm">• ${p.product}</div>`).join("")}
    <div class="divider"></div>
    <div class="ai-block">
      <div class="type-h3 mb-2">Estratégia recomendada pela IA</div>
      <p class="type-body-sm">${m.strategySuggestion}</p>
    </div>
    <div class="divider"></div>
    <div class="type-h3 mb-2">Impactos esperados desta reunião</div>
    <p class="type-body-sm">Esta conversa poderá atualizar automaticamente: Account Planning, Missões, Relationship Score, Oportunidades, Timeline do Cliente e Resumo Executivo.</p>
    <div class="divider"></div>
    <div class="flex gap-2" style="flex-wrap:wrap;">
      <button class="btn btn-ai btn-sm" data-toast="Chamada do Teams simulada.">Entrar no Teams</button>
      <button class="btn btn-secondary btn-sm" id="meeting-mode-full-briefing">Abrir Briefing Completo</button>
      <a class="btn btn-secondary btn-sm" href="cliente.html?id=${client.id}">Abrir Cliente</a>
      <a class="btn btn-secondary btn-sm" href="pipeline.html">Abrir Oportunidade</a>
      <button class="btn btn-ghost btn-sm" id="meeting-mode-dismiss">Já iniciei a reunião</button>
    </div>
  `;
  document.getElementById("meeting-mode-scrim").classList.add("open");

  document.getElementById("meeting-mode-modal").querySelectorAll("[data-toast]").forEach(btn => {
    btn.addEventListener("click", () => showToast(btn.dataset.toast, "✓"));
  });
  document.getElementById("meeting-mode-full-briefing").addEventListener("click", () => {
    closeMeetingMode();
    openMeetingPanel(m.id);
  });
  document.getElementById("meeting-mode-dismiss").addEventListener("click", () => {
    dismissMeetingMode(m.id);
    closeMeetingMode();
    showToast("Boa reunião! Este aviso não vai aparecer de novo para este compromisso.", "✓");
  });
}

function checkMeetingMode() {
  const dismissed = getMeetingModeDismissed();
  const next = getNextImminentMeeting(15);
  if (next && !dismissed.includes(next.meeting.id)) openMeetingMode(next.meeting, next.minutesUntil);
}

function simulateMeetingMode() {
  const todays = getTodaysMeetings().filter(m => m.status === "agendada");
  if (todays.length === 0) { showToast("Nenhuma reunião agendada para hoje para simular.", "ℹ"); return; }
  const target = [...todays].sort((a, b) => a.time.localeCompare(b.time))[0];
  openMeetingMode(target, 15);
}

/* ---------------------------------------------------------- */
/* Inicialização                                                  */
/* ---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderAgendaHome();
  renderViewSegmented();
  renderCalendarToggles();
  renderAgendaFavorites();
  renderCurrentView();
  ensureMeetingPanel();
  ensureMeetingModeModal();

  document.getElementById("agenda-nav-prev").addEventListener("click", () => navStep(-1));
  document.getElementById("agenda-nav-next").addEventListener("click", () => navStep(1));
  document.getElementById("agenda-nav-today").addEventListener("click", () => { agendaAnchorDate = new Date(); renderCurrentView(); });
  // document.getElementById("simulate-meeting-mode-btn").addEventListener("click", simulateMeetingMode);

  checkMeetingMode();
});
