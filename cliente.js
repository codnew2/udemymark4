/* ============================================================
   Perfil do Cliente — recomendação, health score, timeline,
   oportunidades, planning, produtos e cadastro.
   ============================================================ */

function getClientIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || CLIENTS[0].id;
}

function renderClientSwitcher(current) {
  const select = document.getElementById("client-switcher");
  select.innerHTML = CLIENTS.map(c => `<option value="${c.id}" ${c.id === current.id ? "selected" : ""}>${c.name}</option>`).join("");
  select.addEventListener("change", () => {
    window.location.href = `cliente.html?id=${select.value}`;
  });
}

function renderRecommendation(c) {
  const rec = generateRecommendation(c);
  return `
    <div class="ai-block briefing-block" style="max-width:none;">
      <div class="flex items-center justify-between mb-2">
        <span class="ai-badge"><span class="spark">✦</span> Recomendação atual da IA</span>
        <span class="health-score-ring" style="--pct:${c.healthScore}; --ring-color: ${c.risk === "critical" ? "var(--state-critical)" : c.risk === "attention" ? "var(--state-attention)" : "var(--state-positive)"};">
          <span class="score-value type-h3">${c.healthScore}</span>
        </span>
      </div>
      <p class="type-body-lg">${rec.text}</p>
      <div class="mt-3">
        ${whyButtonHtml("why-rec")}
        ${whyPanelHtml("why-rec", rec.reasons)}
      </div>
    </div>
  `;
}

function renderHealthFactors(c) {
  const color = t => t === "down" ? "var(--state-critical)" : t === "up" ? "var(--state-positive)" : "var(--neutral-400)";
  return `
    <div class="card">
      <div class="section-title"><span class="type-h2">Health Score — composição</span></div>
      ${c.healthFactors.map(f => `
        <div class="factor-row">
          <span class="type-body-sm" style="color:var(--text-primary); flex:1;">${f.label}</span>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width:${f.weight}%; background:${color(f.trend)};"></div></div>
          <span class="type-caption" style="width: 20px; text-align:right;">${trendIcon(f.trend)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTimeline(c) {
  const sentimentClass = s => s === "positive" ? "sentiment-positive" : s === "negative" ? "sentiment-negative" : "";
  return `
    <div class="card ai-block">
      <div class="flex items-center gap-2 mb-4">
        <span class="type-h2">Timeline Inteligente</span>
        <span class="ai-badge"><span class="spark">✦</span> Gerado pela IA</span>
      </div>
      <div class="timeline">
        ${c.timeline.map((t, i) => `
          <div class="timeline-item ${sentimentClass(t.sentiment)}">
            <div class="period">${t.period}</div>
            <div class="marker-title">${t.title}</div>
            <p class="type-body-sm">${t.text}</p>
            <button class="timeline-toggle" data-toggle-source="src-${c.id}-${i}">ver detalhe completo</button>
            <div class="timeline-source" id="src-${c.id}-${i}"><strong>Fonte:</strong> ${t.source}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ============================================================
   Relacionamentos Estratégicos (RFC-001 + RFC-002)
   ============================================================ */

function renderApproachContent(s) {
  const a = s.approachSeed;
  return `
    <div class="approach-row"><div class="approach-label">Objetivo</div><div class="approach-value">${a.objetivo}</div></div>
    <div class="approach-row"><div class="approach-label">Contexto</div><div class="approach-value">${a.contexto}</div></div>
    <div class="approach-row"><div class="approach-label">Dica</div><div class="approach-value">${a.dica}</div></div>
    <div class="approach-row"><div class="approach-label">Produtos sugeridos</div><div class="approach-value">${a.produtos.length ? a.produtos.join(", ") : "Nenhum produto específico no momento."}</div></div>
    <div class="approach-row"><div class="approach-label">Riscos</div><div class="approach-value">${a.riscos}</div></div>
    <div class="approach-row"><div class="approach-label">Tempo sugerido</div><div class="approach-value">${a.tempo}</div></div>
    <div class="approach-row"><div class="approach-label">Chance de resposta positiva</div><div class="approach-value">${a.chance}</div></div>
  `;
}

function renderContactCard(s) {
  const status = computeRelationshipStatus(s);
  const ringColor = s.relationshipScore >= 70 ? "var(--state-positive)" : s.relationshipScore >= 40 ? "var(--state-attention)" : "var(--state-critical)";
  const teamsHref = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(s.contato.teams)}`;

  return `
    <div class="contact-card" data-contact-id="${s.id}">
      <div class="contact-card-head">
        <div class="contact-avatar">${s.iniciais}</div>
        <div class="contact-identity">
          <div class="contact-name">${s.nome} <span title="${status.label}">${status.dot}</span></div>
          <div class="contact-role">${s.cargo} · ${s.area}</div>
          <div class="contact-status-note">${status.note}</div>
        </div>
      </div>

      <div class="contact-score-row">
        <span class="health-score-ring sm" style="--pct:${s.relationshipScore}; --ring-color:${ringColor};"><span class="score-value type-body-sm">${s.relationshipScore}</span></span>
        <div class="contact-badges">
          <span class="badge badge-neutral">${s.decisionRole}</span>
          <span class="badge badge-ai">Influência ${influenceLabel(s.influenceScore)}</span>
        </div>
      </div>

      <div class="ai-block contact-ai-block">
        <p class="type-body-sm">${s.aiSummary}</p>
        <p class="type-body-sm" style="color:var(--text-primary); font-weight:500; margin-top:4px;">${s.aiRecommendation}</p>
      </div>

      <div class="contact-actions">
        <a class="btn btn-secondary btn-sm" href="tel:${s.contato.telefone.replace(/\D/g, "")}">📞 Ligar</a>
        <a class="btn btn-secondary btn-sm" href="mailto:${s.contato.email}">📧 E-mail</a>
        <button class="btn btn-secondary btn-sm" data-toast="Reunião solicitada com ${s.nome}.">📅 Agendar</button>
        <a class="btn btn-secondary btn-sm" href="${teamsHref}" target="_blank" rel="noopener">💬 Teams</a>
        <button class="btn btn-ai btn-sm" data-toggle-approach="approach-${s.id}">✨ Preparar abordagem</button>
      </div>

      <div class="approach-panel" id="approach-${s.id}">
        ${renderApproachContent(s)}
      </div>

      <div class="contact-info">
        <span>📞 ${s.contato.telefone} · 📱 ${s.contato.celular}</span>
        <span>📧 ${s.contato.email}</span>
        <span>💬 ${s.contato.teams} · 🏢 ${s.contato.escritorio} · ${s.contato.fuso}</span>
      </div>

      <button class="why-btn" data-open-contact="${s.id}" style="align-self:flex-start;">🧠 Análise Completa</button>
    </div>
  `;
}

function renderInfluenceMap(client) {
  const rels = client.relationships || [];
  if (rels.length === 0) return "";
  const sorted = [...rels].sort((a, b) => b.influenceScore - a.influenceScore);
  return `
    <div class="card">
      <div class="type-h2 mb-3">Mapa de Influência</div>
      <div class="influence-map">
        ${sorted.map(s => `
          <div class="influence-node">
            <div class="contact-avatar">${s.iniciais}</div>
            <div class="influence-info">
              <span class="influence-name">${s.nome}</span>
              <span class="influence-role">${s.decisionRole} · Influência ${influenceLabel(s.influenceScore)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRelationshipsModule(c) {
  if (!c.relationships || c.relationships.length === 0) return "";
  const strategy = generateRelationshipStrategy(c);
  return `
    <div class="section-title"><span class="type-h2">Relacionamentos Estratégicos</span></div>
    <div class="ai-block briefing-block strategy-brain mb-5">
      <div class="ai-badge mb-2"><span class="spark">✦</span> Estratégia de Relacionamento</div>
      <p class="type-body-lg">🧠 ${strategy.text}</p>
      ${strategy.actions.length ? `
        <div class="type-h3 mt-3">Próximas ações sugeridas</div>
        <ul class="actions-list">${strategy.actions.map(a => `<li>${a}</li>`).join("")}</ul>
      ` : ""}
      <div class="mt-3">
        ${whyButtonHtml("why-strategy-" + c.id)}
        ${whyPanelHtml("why-strategy-" + c.id, strategy.reasons)}
      </div>
    </div>

    <div class="contact-grid">
      ${c.relationships.map(s => renderContactCard(s)).join("")}
    </div>

    ${renderInfluenceMap(c)}
  `;
}

/* ---------------------------------------------------------- */
/* Painel lateral "Análise Completa" de um contato               */
/* ---------------------------------------------------------- */

function ensureContactDrawer() {
  if (document.getElementById("contact-drawer")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="contact-drawer-scrim" id="contact-drawer-scrim"></div>
    <aside class="contact-drawer" id="contact-drawer">
      <div class="contact-drawer-header">
        <span class="ai-badge"><span class="spark">✦</span> Análise Completa</span>
        <button class="icon-btn" id="contact-drawer-close" aria-label="Fechar">✕</button>
      </div>
      <div class="contact-drawer-body" id="contact-drawer-body"></div>
    </aside>
  `);
  const scrim = document.getElementById("contact-drawer-scrim");
  const drawer = document.getElementById("contact-drawer");
  function close() { drawer.classList.remove("open"); scrim.classList.remove("open"); }
  document.getElementById("contact-drawer-close").addEventListener("click", close);
  scrim.addEventListener("click", close);
}

function renderContactAnalysis(s, client) {
  const status = computeRelationshipStatus(s);
  const strategy = generateContactStrategy(s, client);
  const evo = scoreEvolutionNarrative(s);
  const channel = bestChannelInfo(s);

  return `
    <div class="flex items-center gap-3">
      <div class="contact-avatar" style="width:56px;height:56px;font-size:16px;">${s.iniciais}</div>
      <div>
        <div class="type-h3">${s.nome}</div>
        <div class="type-body-sm">${s.cargo} · ${s.area}</div>
      </div>
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Perfil Executivo</div>
      <div class="flex items-center gap-3 mb-2 mt-2">
        <span class="health-score-ring sm" style="--pct:${s.relationshipScore}; --ring-color: var(--ai-accent);"><span class="score-value type-body-sm">${s.relationshipScore}</span></span>
        <div class="type-body-sm">
          Influência: <strong>${influenceLabel(s.influenceScore)}</strong><br>
          Papel: <strong>${s.decisionRole}</strong>
        </div>
      </div>
      <div class="type-body-sm text-secondary">Tempo de relacionamento: ${s.tempoRelacionamentoMeses} meses · Tempo na empresa: ${s.tempoEmpresaAnos} anos</div>
      <div class="mt-2 type-caption">${status.dot} ${status.label} — ${status.note}</div>
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Perfil Comportamental</div>
      <ul class="list-plain">${s.behavioralPatterns.map(b => `<li class="type-body-sm">• ${b}</li>`).join("")}</ul>
      <div class="hypothesis-note">Hipóteses baseadas em padrões observados — nunca afirmações absolutas.</div>
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Principais Interesses</div>
      <div class="flex" style="flex-wrap:wrap; gap: var(--space-2);">${s.interests.map(i => `<span class="chip">${i}</span>`).join("")}</div>
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Possíveis Objeções</div>
      <ul class="list-plain">${s.objections.map(o => `<li class="type-body-sm">• ${o}</li>`).join("")}</ul>
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Memória do Relacionamento</div>
      ${s.memory.length
        ? s.memory.map(m => `<div class="ai-block contact-ai-block mb-2"><p class="type-body-sm">${m}</p></div>`).join("")
        : `<div class="type-body-sm text-secondary">Ainda não há fatos suficientes registrados sobre este contato.</div>`}
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Evolução do Relacionamento</div>
      <div class="score-evolution mb-2">
        ${s.scoreHistory.map((v, i) => `${i > 0 ? '<span class="arrow">→</span>' : ""}<span class="step${i === s.scoreHistory.length - 1 ? " current" : ""}">${v}</span>`).join("")}
      </div>
      <div class="type-body-sm text-secondary">${evo}</div>
    </div>

    <div class="contact-drawer-section">
      <div class="type-h3">Histórico de Comunicação</div>
      <div class="type-body-sm">Último e-mail: ${s.communication.lastEmailDaysAgo >= 150 ? "sem registro" : `há ${s.communication.lastEmailDaysAgo} dias`} — ${s.communication.lastEmailSubject}</div>
      <div class="type-body-sm mt-1">Última reunião: ${s.communication.lastMeetingDate} · Última ligação: ${s.communication.lastCallDate}</div>
      <div class="type-body-sm mt-1">Tempo médio de resposta: ${s.communication.avgResponseTime} · Último canal utilizado: ${s.communication.lastChannelUsed}</div>
      <div class="mt-3">
        <div class="factor-row"><span class="type-body-sm">E-mail</span><div class="factor-bar-track"><div class="factor-bar-fill" style="width:${s.communication.channelStats.email}%; background:var(--ai-accent);"></div></div><span class="type-caption">${s.communication.channelStats.email}%</span></div>
        <div class="factor-row"><span class="type-body-sm">Telefone</span><div class="factor-bar-track"><div class="factor-bar-fill" style="width:${s.communication.channelStats.telefone}%; background:var(--ai-accent);"></div></div><span class="type-caption">${s.communication.channelStats.telefone}%</span></div>
        <div class="factor-row"><span class="type-body-sm">Teams</span><div class="factor-bar-track"><div class="factor-bar-fill" style="width:${s.communication.channelStats.teams}%; background:var(--ai-accent);"></div></div><span class="type-caption">${s.communication.channelStats.teams}%</span></div>
      </div>
      <div class="type-caption mt-2">${channel.explanation}</div>
    </div>

    <div class="strategy-final">
      <div class="type-h2 mb-2">Se eu fosse você...</div>
      <div class="strategy-row"><div class="strategy-label">Próxima ação</div><div class="strategy-value">${strategy.proximaAcao}</div></div>
      <div class="strategy-row"><div class="strategy-label">Melhor canal</div><div class="strategy-value">${strategy.melhorCanal}</div></div>
      <div class="strategy-row"><div class="strategy-label">Melhor horário</div><div class="strategy-value">${strategy.melhorHorario}</div></div>
      <div class="strategy-row"><div class="strategy-label">Quem deveria participar</div><div class="strategy-value">${strategy.envolver}</div></div>
      <div class="strategy-row"><div class="strategy-label">Riscos</div><div class="strategy-value">${strategy.riscos}</div></div>
      <div class="strategy-row"><div class="strategy-label">Oportunidade</div><div class="strategy-value">${strategy.oportunidade}</div></div>
      <div class="strategy-row"><div class="strategy-label">Justificativa</div><div class="strategy-value">${strategy.justificativa}</div></div>
    </div>
  `;
}

function openContactDrawer(stakeholderId, clientId) {
  const client = getClient(clientId);
  const s = client.relationships.find(r => r.id === stakeholderId);
  if (!s) return;
  document.getElementById("contact-drawer-body").innerHTML = renderContactAnalysis(s, client);
  document.getElementById("contact-drawer").classList.add("open");
  document.getElementById("contact-drawer-scrim").classList.add("open");
}

function renderOpportunities(c) {
  if (!c.opportunities || c.opportunities.length === 0) {
    return `<div class="card empty-state"><div class="empty-icon">✓</div><div>Nenhuma oportunidade identificada para este cliente no momento.</div></div>`;
  }
  return c.opportunities.map((o, i) => `
    <div class="card ai-block mb-3">
      <div class="flex items-center justify-between">
        <span class="type-h3">${o.product}</span>
        <span class="badge ${o.probabilityPct >= 65 ? "badge-positive" : o.probabilityPct >= 35 ? "badge-attention" : "badge-neutral"}">${probabilityLabel(o.probabilityPct)} · ${o.probabilityPct}%</span>
      </div>
      <div class="type-body-sm mt-1">Impacto estimado: <strong>${formatCurrencyCompact(o.impact)}</strong> · Estágio: ${o.stage}</div>
      <div class="mt-2">
        ${whyButtonHtml("why-opp-" + o.id)}
        ${whyPanelHtml("why-opp-" + o.id, [o.justification])}
      </div>
      <div class="flex gap-2 mt-3">
        <button class="btn btn-secondary btn-sm" data-toast="Contato agendado para tratar esta oportunidade.">Agendar contato</button>
        <a class="btn btn-ghost btn-sm" href="pipeline.html">Ver no pipeline →</a>
      </div>
    </div>
  `).join("");
}

function renderPlanning(c) {
  const suggestionState = JSON.parse(localStorage.getItem("crm-planning-suggestions") || "{}");
  const state = suggestionState[c.id] || "pending";

  const objectivesHtml = c.planning.objectives.map(o => `
    <div class="flex items-center justify-between" style="padding: var(--space-2) 0; border-bottom: 1px solid var(--border-default);">
      <span class="type-body-sm" style="color:var(--text-primary);">${o.title}</span>
      <span class="badge ${PLANNING_STATUS_BADGE[computeObjectiveStatus(o)]}">${PLANNING_STATUS_LABEL[computeObjectiveStatus(o)]}</span>
    </div>
  `).join("");

  let suggestionHtml = "";
  if (c.planning.aiSuggestion) {
    if (state === "pending") {
      suggestionHtml = `
        <div class="ai-block mt-4" id="planning-suggestion-block">
          <div class="ai-badge mb-2"><span class="spark">✦</span> Sugestão da IA pendente</div>
          <p class="type-body-sm" style="color:var(--text-primary);">${c.planning.aiSuggestion}</p>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary btn-sm" id="planning-approve">Aprovar sugestão</button>
            <button class="btn btn-secondary btn-sm" id="planning-edit">Editar</button>
            <button class="btn btn-destructive btn-sm" id="planning-discard">Descartar</button>
          </div>
        </div>
      `;
    } else if (state === "approved") {
      suggestionHtml = `<div class="mt-4"><span class="badge badge-positive">Sugestão aprovada e aplicada ao Planning</span></div>`;
    } else if (state === "discarded") {
      suggestionHtml = `<div class="mt-4"><span class="badge badge-neutral">Sugestão descartada</span></div>`;
    }
  }

  return `
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <span class="type-h2">Account Planning Vivo</span>
        <a href="planning.html" class="type-caption">Ver Planning agregado →</a>
      </div>
      ${objectivesHtml}
      ${suggestionHtml}
    </div>
  `;
}

function wirePlanningActions(c) {
  const approveBtn = document.getElementById("planning-approve");
  const discardBtn = document.getElementById("planning-discard");
  const editBtn = document.getElementById("planning-edit");
  function setState(state) {
    const map = JSON.parse(localStorage.getItem("crm-planning-suggestions") || "{}");
    map[c.id] = state;
    localStorage.setItem("crm-planning-suggestions", JSON.stringify(map));
    renderClientPage(c.id);
  }
  if (approveBtn) approveBtn.addEventListener("click", () => { setState("approved"); showToast("Sugestão aprovada e aplicada ao Account Planning.", "✓"); });
  if (discardBtn) discardBtn.addEventListener("click", () => { setState("discarded"); showToast("Sugestão descartada.", "✕"); });
  if (editBtn) editBtn.addEventListener("click", () => {
    const block = document.getElementById("planning-suggestion-block");
    const currentText = c.planning.aiSuggestion;
    block.innerHTML = `
      <div class="ai-badge mb-2"><span class="spark">✦</span> Editando sugestão da IA</div>
      <textarea class="input" id="planning-edit-textarea" rows="3">${currentText}</textarea>
      <div class="flex gap-2 mt-3">
        <button class="btn btn-primary btn-sm" id="planning-save-edit">Salvar e aprovar</button>
        <button class="btn btn-ghost btn-sm" id="planning-cancel-edit">Cancelar</button>
      </div>
    `;
    document.getElementById("planning-save-edit").addEventListener("click", () => { setState("approved"); showToast("Sugestão editada e aplicada ao Account Planning.", "✓"); });
    document.getElementById("planning-cancel-edit").addEventListener("click", () => renderClientPage(c.id));
  });
}

function renderProducts(c) {
  return `
    <div class="card">
      <div class="type-h2 mb-3">Produtos Contratados</div>
      <div class="flex" style="flex-wrap:wrap; gap: var(--space-2);">
        ${c.products.map(p => `<span class="chip">${p}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderCadastro(c) {
  return `
    <details class="card">
      <summary class="type-h2" style="cursor:pointer;">Dados Cadastrais</summary>
      <div class="mt-4 flex-col gap-2">
        <div class="type-body-sm"><strong>CNPJ:</strong> ${c.cnpj}</div>
        <div class="type-body-sm"><strong>Setor:</strong> ${c.setor}</div>
        <div class="type-body-sm"><strong>Sede:</strong> ${c.sede}</div>
        <div class="type-body-sm"><strong>Cliente desde:</strong> ${c.clienteDesde}</div>
        <div class="type-body-sm"><strong>Receita anual estimada:</strong> ${formatCurrencyCompact(c.receitaAnual)}</div>
        <div class="type-body-sm"><strong>Contato principal:</strong> ${c.contato.nome} — ${c.contato.cargo} · ${c.contato.email} · ${c.contato.telefone}</div>
      </div>
    </details>
  `;
}

function renderClientPage(clientId) {
  const c = getClient(clientId);
  const root = document.getElementById("cliente-root");
  document.title = `${c.name} — CRM Agêntico Empresa X`;

  root.innerHTML = `
    <div class="flex items-center gap-3 mb-2">
      <span class="type-h1">${c.name}</span>
      <span class="badge badge-neutral">${c.segment}</span>
    </div>
    <div class="type-body-sm mb-5">${c.setor} · ${c.sede} · Cliente desde ${c.clienteDesde}</div>

    ${renderRecommendation(c)}

    <div class="section">${renderHealthFactors(c)}</div>
    <div class="section">${renderTimeline(c)}</div>

    <div class="section">${renderRelationshipsModule(c)}</div>

    <div class="section">
      <div class="section-title"><span class="type-h2">Oportunidades deste cliente</span></div>
      ${renderOpportunities(c)}
    </div>

    <div class="section">${renderPlanning(c)}</div>
    <div class="section">${renderProducts(c)}</div>
    <div class="section">${renderCadastro(c)}</div>
  `;

  root.querySelectorAll("[data-toggle-source]").forEach(btn => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.dataset.toggleSource);
      panel.classList.toggle("open");
      btn.textContent = panel.classList.contains("open") ? "ocultar detalhe" : "ver detalhe completo";
    });
  });
  root.querySelectorAll("[data-toast]").forEach(btn => {
    btn.addEventListener("click", () => showToast(btn.dataset.toast, "✓"));
  });
  root.querySelectorAll("[data-toggle-approach]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.toggleApproach).classList.toggle("open");
    });
  });
  root.querySelectorAll("[data-open-contact]").forEach(btn => {
    btn.addEventListener("click", () => openContactDrawer(btn.dataset.openContact, c.id));
  });

  wirePlanningActions(c);
  renderClientSwitcher(c);
}

document.addEventListener("DOMContentLoaded", () => {
  ensureContactDrawer();
  const clientId = getClientIdFromUrl();
  renderClientPage(clientId);

  const contactId = new URLSearchParams(window.location.search).get("contact");
  if (contactId) openContactDrawer(contactId, clientId);
});
