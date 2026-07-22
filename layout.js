/* ============================================================
   CRM Agêntico — Empresa X | Shell de Layout Compartilhado
   Injeta sidebar, header, painel global de IA e utilitários
   comuns (tema, toast, "Por que estou vendo isso?").
   ============================================================ */

const NAV_ITEMS = [
  { key: "home", label: "Início", icon: "⌂", href: "home.html" },
  { key: "radar", label: "Carteira", icon: "◎", href: "radar.html" },
  { key: "agenda", label: "Agenda", icon: "🗓", href: "agenda.html" },
  { key: "pipeline", label: "Oportunidades", icon: "💡", href: "pipeline.html" },
  { key: "compromissos", label: "Missões", icon: "🎯", href: "compromissos.html" },
  { key: "planning", label: "Planning", icon: "📋", href: "planning.html" },
  { key: "resumo", label: "Resumo Executivo", icon: "📊", href: "resumo.html" },
  { key: "nps", label: "NPS", icon: "★", href: "nps.html" },
  { key: "chat", label: "Pergunte à IA", icon: "✦", href: "chat.html" }
];

const BOTTOM_NAV_KEYS = ["home", "radar", "agenda", "chat"];

function currentPageKey() {
  return document.body.dataset.page || "home";
}

function buildSidebar() {
  const active = currentPageKey();
  const items = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="${item.key === active ? "active" : ""}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>
  `).join("");

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark">Empresa</div>
        <div>
          <div class="brand-text">CRM Agêntico</div>
          <div class="brand-sub">Empresa X</div>
        </div>
      </div>
      <nav class="sidebar-nav">${items}</nav>
      <div class="sidebar-footer">
        Analista contínuo ativo<br>Última sincronização: agora
        <button id="reset-demo-btn" class="sidebar-reset-btn">↺ Reiniciar demonstração</button>
      </div>
    </aside>
  `;
}

const DEMO_STATE_KEYS = [
  "crm-feed-dismissed", "crm-meeting-draft", "crm-meeting-registered",
  "crm-mission-done", "crm-pipeline-stage", "crm-planning-suggestions",
  "crm-proactive-dismissed", "crm-commitments-done", "crm-commitments-extra",
  "crm-agenda-view", "crm-agenda-calendars", "crm-meeting-mode-dismissed", "crm-agenda-favorites",
  "crm-commitments-stage", "crm-commitments-history"
];

function resetDemoState() {
  DEMO_STATE_KEYS.forEach(k => localStorage.removeItem(k));
  location.reload();
}

function initResetButton() {
  const btn = document.getElementById("reset-demo-btn");
  if (btn) btn.addEventListener("click", resetDemoState);
}

function buildBottomNav() {
  const active = currentPageKey();
  const items = NAV_ITEMS.filter(i => BOTTOM_NAV_KEYS.includes(i.key)).map(item => `
    <a href="${item.href}" class="${item.key === active ? "active" : ""}">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label.split(" ")[0]}</span>
    </a>
  `).join("");
  return `<nav class="bottom-nav">${items}</nav>`;
}

function buildTopbar() {
  return `
    <header class="topbar">
      <div class="topbar-search" id="topbar-search-trigger">
        <span class="ai-spark">✦</span>
        <span class="type-body-sm">Pergunte à IA sobre sua carteira...</span>
      </div>
      <div class="topbar-actions" style="position:relative;">
        <button class="icon-btn" id="theme-toggle" title="Alternar tema" aria-label="Alternar tema claro/escuro">◐</button>
        <div style="position:relative;">
          <button class="icon-btn" id="notif-bell-btn" title="Assistente Proativo" aria-label="Notificações">
            🔔<span class="dot" id="notif-dot"></span>
          </button>
          <div class="notif-dropdown" id="notif-dropdown"></div>
        </div>
        <div class="avatar" title="${MANAGER.name}">${MANAGER.initials}</div>
      </div>
    </header>
  `;
}

function buildAiDrawer() {
  return `
    <div class="ai-drawer-scrim" id="ai-scrim"></div>
    <button class="ai-fab" id="ai-fab-btn" aria-label="Abrir Pergunte à IA">✦</button>
    <aside class="ai-drawer" id="ai-drawer">
      <div class="ai-drawer-header">
        <div class="flex items-center gap-2">
          <span class="ai-badge"><span class="spark">✦</span> Pergunte à IA</span>
        </div>
        <button class="icon-btn" id="ai-drawer-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ai-drawer-body" id="ai-drawer-body">
        <div class="chat-msg from-ai">
          <div class="chat-bubble">Olá, ${MANAGER.name.split(" ")[0]}. Pode me perguntar qualquer coisa sobre sua carteira, ou simular uma decisão com "e se...".</div>
          <div class="chat-chips">
            <button class="chip quick-q" data-q="Quais clientes devo visitar esta semana?">Quais clientes visitar?</button>
            <button class="chip quick-q" data-q="Quais clientes estão há mais de 60 dias sem contato?">Sem contato há 60+ dias</button>
          </div>
        </div>
      </div>
      <div class="ai-drawer-footer">
        <form id="ai-drawer-form">
          <input type="text" class="input" id="ai-drawer-input" placeholder="Pergunte algo sobre sua carteira..." autocomplete="off">
          <button type="submit" class="btn btn-primary">➤</button>
        </form>
        <a href="chat.html" class="type-caption" style="display:block;margin-top:8px;text-align:center;">Abrir conversa completa →</a>
      </div>
    </aside>
  `;
}

function initShell() {
  const shellRoot = document.getElementById("shell-root");
  if (!shellRoot) return;
  shellRoot.insertAdjacentHTML("afterbegin", buildSidebar());
  shellRoot.insertAdjacentHTML("beforeend", buildBottomNav());

  const topbarRoot = document.getElementById("topbar-root");
  if (topbarRoot) topbarRoot.innerHTML = buildTopbar();

  document.body.insertAdjacentHTML("beforeend", buildAiDrawer());
  document.body.insertAdjacentHTML("beforeend", '<div class="toast-container" id="toast-root"></div>');

  initTheme();
  initAiDrawer();
  initWhyButtons();
  initNotifications();
  initResetButton();
}

/* ---------------------------------------------------------- */
/* Assistente Proativo — dropdown do sino de notificações        */
/* ---------------------------------------------------------- */
function getDismissedSuggestions() {
  return JSON.parse(localStorage.getItem("crm-proactive-dismissed") || "[]");
}
function dismissSuggestion(id) {
  const list = getDismissedSuggestions();
  list.push(id);
  localStorage.setItem("crm-proactive-dismissed", JSON.stringify(list));
}

function renderNotifDropdown() {
  const dismissed = getDismissedSuggestions();
  const suggestions = getProactiveSuggestions().filter(s => !dismissed.includes(s.id));
  const dropdown = document.getElementById("notif-dropdown");
  const dot = document.getElementById("notif-dot");
  if (dot) dot.style.display = suggestions.length ? "block" : "none";

  if (suggestions.length === 0) {
    dropdown.innerHTML = `
      <div class="notif-dropdown-header">
        <span class="ai-badge"><span class="spark">✦</span> Assistente Proativo</span>
      </div>
      <div class="empty-state" style="padding: var(--space-6) var(--space-4);">Nenhuma sugestão pendente no momento.</div>
    `;
    return;
  }

  dropdown.innerHTML = `
    <div class="notif-dropdown-header">
      <span class="ai-badge"><span class="spark">✦</span> Assistente Proativo</span>
    </div>
    <div class="flex-col">
      ${suggestions.map(s => `
        <div class="notif-item">
          <div class="flex gap-2">
            <span>${s.icon}</span>
            <span class="type-body-sm" style="color:var(--text-primary);">${s.text}</span>
          </div>
          <div class="flex gap-2 mt-2">
            <a class="btn btn-primary btn-sm" href="${s.link}">Aceitar</a>
            <button class="btn btn-ghost btn-sm" data-snooze="${s.id}">Adiar</button>
            <button class="btn btn-ghost btn-sm" data-dismiss-notif="${s.id}">Descartar</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  dropdown.querySelectorAll("[data-dismiss-notif]").forEach(btn => btn.addEventListener("click", () => {
    dismissSuggestion(btn.dataset.dismissNotif);
    renderNotifDropdown();
    showToast("Sugestão descartada.", "✕");
  }));
  dropdown.querySelectorAll("[data-snooze]").forEach(btn => btn.addEventListener("click", () => {
    dismissSuggestion(btn.dataset.snooze);
    renderNotifDropdown();
    showToast("Sugestão adiada — a IA volta a lembrar em breve.", "⏱");
  }));
}

function initNotifications() {
  const bell = document.getElementById("notif-bell-btn");
  const dropdown = document.getElementById("notif-dropdown");
  if (!bell) return;
  renderNotifDropdown();
  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (dropdown.classList.contains("open") && !dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove("open");
    }
  });
}

/* ---------------------------------------------------------- */
/* Tema claro/escuro                                            */
/* ---------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem("crm-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀" : "◐";
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("crm-theme", next);
      btn.textContent = next === "dark" ? "☀" : "◐";
    });
  }
}

/* ---------------------------------------------------------- */
/* Toast                                                         */
/* ---------------------------------------------------------- */
function showToast(message, icon) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${icon || "✓"}</span><span>${message}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 200ms"; }, 2600);
  setTimeout(() => el.remove(), 2900);
}

/* ---------------------------------------------------------- */
/* Componente transversal "Por que estou vendo isso?"           */
/* Uso: <button class="why-btn" data-why-target="why-x1">...    */
/*      <div class="why-panel" id="why-x1">...conteúdo...</div> */
/* ---------------------------------------------------------- */
function initWhyButtons() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".why-btn");
    if (!btn) return;
    const targetId = btn.dataset.whyTarget;
    const panel = document.getElementById(targetId);
    if (!panel) return;
    panel.classList.toggle("open");
    btn.textContent = panel.classList.contains("open") ? "Ocultar explicação" : (btn.dataset.label || "Por que estou vendo isso?");
  });
}

function whyButtonHtml(id, label) {
  return `<button class="why-btn" data-why-target="${id}" data-label="${label || "Por que estou vendo isso?"}">🔍 ${label || "Por que estou vendo isso?"}</button>`;
}

function whyPanelHtml(id, reasons, note) {
  const items = reasons.map(r => `<li>${r}</li>`).join("");
  return `
    <div class="why-panel" id="${id}">
      <div class="why-title">Por que você está vendo isso</div>
      <ul>${items}</ul>
      ${note ? `<div class="type-caption mt-2">${note}</div>` : ""}
    </div>
  `;
}

/* ---------------------------------------------------------- */
/* Painel Global de IA — versão mini (drawer)                   */
/* ---------------------------------------------------------- */
function initAiDrawer() {
  const drawer = document.getElementById("ai-drawer");
  const scrim = document.getElementById("ai-scrim");
  const fab = document.getElementById("ai-fab-btn");
  const closeBtn = document.getElementById("ai-drawer-close");
  const searchTrigger = document.getElementById("topbar-search-trigger");
  const form = document.getElementById("ai-drawer-form");
  const input = document.getElementById("ai-drawer-input");
  const body = document.getElementById("ai-drawer-body");

  function open() { drawer.classList.add("open"); scrim.classList.add("open"); }
  function close() { drawer.classList.remove("open"); scrim.classList.remove("open"); }

  if (fab) fab.addEventListener("click", open);
  if (searchTrigger) searchTrigger.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (scrim) scrim.addEventListener("click", close);

  function appendUserMsg(text) {
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg from-user"><div class="chat-bubble">${text}</div></div>`);
  }
  function appendAiMsg(html) {
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg from-ai"><div class="chat-bubble">${html}</div></div>`);
  }
  function appendProcessing() {
    const id = "proc-" + Date.now();
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg from-ai" id="${id}"><div class="processing-indicator"><span class="processing-dot"></span>Consultando a carteira...</div></div>`);
    return id;
  }

  function handleQuery(text) {
    if (!text.trim()) return;
    appendUserMsg(text);
    body.scrollTop = body.scrollHeight;
    const procId = appendProcessing();
    setTimeout(() => {
      const procEl = document.getElementById(procId);
      if (procEl) procEl.remove();
      const answer = answerQuery(text);
      appendAiMsg(answer);
      body.scrollTop = body.scrollHeight;
    }, 700);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value;
      input.value = "";
      handleQuery(val);
    });
  }
  document.addEventListener("click", (e) => {
    const q = e.target.closest(".quick-q");
    if (q) handleQuery(q.dataset.q);
  });
}

function clientChipsHtml(clients) {
  return clients.map(c => `<a class="chip" href="cliente.html?id=${c.id}">${c.name}</a>`).join("");
}
