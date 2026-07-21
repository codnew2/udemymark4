/* ============================================================
   Captura Inteligente de Interações (RFC-006)
   Evolução do fluxo de registro pós-reunião: em vez de um único
   caminho (voz), o gerente escolhe como a interação chegou até a
   IA — Teams, voz, texto colado ou manual — e recebe sempre o
   mesmo painel de revisão categorizado antes de confirmar.
   Reaproveita saveDraft/setRegistered/renderRegisteredView/
   addExtraCommitment/refreshAfterVoiceFlow já existentes em
   agenda.js — nenhum dado paralelo é criado.
   ============================================================ */

const CAPTURE_STEP_TEMPLATES = {
  teams: ["Importando transcrição...", "Analisando conversa...", "Extraindo decisões...", "Identificando oportunidades...", "Gerando resumo executivo...", "Resumo pronto."],
  voz: ["Transcrevendo áudio...", "Analisando conversa...", "Extraindo decisões...", "Identificando oportunidades...", "Gerando resumo executivo...", "Resumo pronto."],
  colar: ["Lendo o texto colado...", "Analisando conversa...", "Extraindo decisões...", "Identificando oportunidades...", "Gerando resumo executivo...", "Resumo pronto."]
};

/* ---------------------------------------------------------- */
/* Modal — infraestrutura                                        */
/* ---------------------------------------------------------- */
function ensureCaptureModal() {
  if (document.getElementById("capture-modal-scrim")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="capture-modal-scrim" id="capture-modal-scrim">
      <div class="capture-modal" id="capture-modal"></div>
    </div>
  `);
}

function closeCaptureModal() {
  const scrim = document.getElementById("capture-modal-scrim");
  if (scrim) scrim.classList.remove("open");
}

function openCaptureFlow(meetingId) {
  const m = MEETINGS.find(x => x.id === meetingId);
  if (!m) return;
  const client = getClient(m.clientId);
  ensureCaptureModal();
  renderCaptureChoice(m, client);
  document.getElementById("capture-modal-scrim").classList.add("open");
}

/* ---------------------------------------------------------- */
/* Etapa 1 — escolha de origem                                    */
/* ---------------------------------------------------------- */
function renderCaptureChoice(m, client) {
  const teamsAvailable = m.type === "Videochamada";
  document.getElementById("capture-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Captura Inteligente</div>
    <div class="type-h2">A reunião com ${client.name} foi encerrada.</div>
    <p class="type-body-sm mt-1">Como deseja registrar esta interação?</p>
    <div class="capture-option-list">
      <button class="capture-option" id="capture-opt-teams" ${teamsAvailable ? "" : "disabled"}>
        <span class="capture-option-icon">🟦</span>
        <span>
          <div class="capture-option-title">Importar automaticamente do Microsoft Teams</div>
          <div class="capture-option-sub">${teamsAvailable ? "Gravação e transcrição disponíveis para esta reunião." : "Não disponível — sem gravação para esta reunião presencial."}</div>
        </span>
      </button>
      <button class="capture-option" id="capture-opt-voz">
        <span class="capture-option-icon">🎙</span>
        <span>
          <div class="capture-option-title">Registrar por voz</div>
          <div class="capture-option-sub">Fale um resumo da reunião.</div>
        </span>
      </button>
      <button class="capture-option" id="capture-opt-colar">
        <span class="capture-option-icon">📋</span>
        <span>
          <div class="capture-option-title">Colar resumo</div>
          <div class="capture-option-sub">Cole uma ata, e-mail ou texto.</div>
        </span>
      </button>
      <button class="capture-option" id="capture-opt-manual">
        <span class="capture-option-icon">✏️</span>
        <span>
          <div class="capture-option-title">Registrar manualmente</div>
          <div class="capture-option-sub">Apenas em último caso.</div>
        </span>
      </button>
      <button class="capture-option" id="capture-opt-skip">
        <span class="capture-option-icon">—</span>
        <span>
          <div class="capture-option-title">Agora não</div>
          <div class="capture-option-sub">Registrar esta interação depois.</div>
        </span>
      </button>
    </div>
  `;
  if (teamsAvailable) document.getElementById("capture-opt-teams").addEventListener("click", () => renderCaptureProcessing(m, client, "teams"));
  document.getElementById("capture-opt-voz").addEventListener("click", () => renderCaptureRecording(m, client));
  document.getElementById("capture-opt-colar").addEventListener("click", () => renderCapturePaste(m, client));
  document.getElementById("capture-opt-manual").addEventListener("click", () => renderCaptureManual(m, client));
  document.getElementById("capture-opt-skip").addEventListener("click", () => {
    closeCaptureModal();
    showToast("Você pode registrar esta interação depois, a qualquer momento.", "🕐");
  });
}

/* ---------------------------------------------------------- */
/* Fluxo 2 — Registrar por voz                                    */
/* ---------------------------------------------------------- */
function renderCaptureRecording(m, client) {
  document.getElementById("capture-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Registrar por voz</div>
    <div class="capture-record-wrap">
      <button class="record-btn" id="capture-record-btn">🎙</button>
      <p class="type-body-sm mt-4">Narre livremente o que aconteceu na reunião com ${client.name}.</p>
      <p class="type-caption mt-1">Toque para começar a falar. Toque novamente para parar.</p>
    </div>
    <div class="flex gap-2 mt-2">
      <button class="btn btn-ghost" id="capture-back-btn">← Voltar</button>
    </div>
  `;
  document.getElementById("capture-back-btn").addEventListener("click", () => renderCaptureChoice(m, client));

  let seconds = 0, timer = null;
  const btn = document.getElementById("capture-record-btn");
  btn.addEventListener("click", () => {
    btn.classList.add("recording");
    btn.textContent = "■";
    const timerEl = document.createElement("div");
    timerEl.className = "voice-timer";
    timerEl.textContent = "00:00";
    btn.insertAdjacentElement("afterend", timerEl);
    timer = setInterval(() => {
      seconds++;
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(seconds % 60).padStart(2, "0");
      timerEl.textContent = `${mm}:${ss}`;
    }, 1000);
    btn.addEventListener("click", function stopHandler() {
      clearInterval(timer);
      btn.removeEventListener("click", stopHandler);
      renderCaptureProcessing(m, client, "voz");
    }, { once: true });
  }, { once: true });
}

/* ---------------------------------------------------------- */
/* Fluxo 3 — Colar resumo                                         */
/* ---------------------------------------------------------- */
function renderCapturePaste(m, client) {
  document.getElementById("capture-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Colar resumo</div>
    <p class="type-body-sm mb-2">Cole a ata, e-mail ou anotações da reunião com ${client.name}.</p>
    <textarea class="input" id="capture-paste-textarea" rows="6" placeholder="Cole aqui o texto..."></textarea>
    <div class="flex gap-2 mt-4">
      <button class="btn btn-primary" id="capture-analyze-btn">Analisar</button>
      <button class="btn btn-ghost" id="capture-back-btn">← Voltar</button>
    </div>
  `;
  document.getElementById("capture-back-btn").addEventListener("click", () => renderCaptureChoice(m, client));
  document.getElementById("capture-analyze-btn").addEventListener("click", () => renderCaptureProcessing(m, client, "colar"));
}

/* ---------------------------------------------------------- */
/* Fluxo 4 — Registrar manualmente (sem IA)                       */
/* ---------------------------------------------------------- */
function renderCaptureManual(m, client) {
  document.getElementById("capture-modal").innerHTML = `
    <div class="badge badge-neutral mb-3">✏️ Registro manual</div>
    <p class="type-body-sm mb-2">Preencha rapidamente o essencial sobre a reunião com ${client.name}. Sem análise automática da IA neste modo.</p>
    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Resumo da reunião</span></div>
      <textarea class="input" id="capture-manual-resumo" rows="3" placeholder="O que aconteceu na reunião?"></textarea>
    </div>
    <div class="draft-panel mt-3">
      <div class="draft-panel-header"><span class="type-h3">Próximos passos</span></div>
      <textarea class="input" id="capture-manual-tarefas" rows="2" placeholder="Um por linha"></textarea>
    </div>
    <div class="flex gap-2 mt-4">
      <button class="btn btn-primary" id="capture-manual-save">Salvar registro</button>
      <button class="btn btn-ghost" id="capture-back-btn">← Voltar</button>
    </div>
  `;
  document.getElementById("capture-back-btn").addEventListener("click", () => renderCaptureChoice(m, client));
  document.getElementById("capture-manual-save").addEventListener("click", () => {
    const resumo = document.getElementById("capture-manual-resumo").value.trim() || `Reunião com ${client.name} registrada manualmente.`;
    const tarefas = document.getElementById("capture-manual-tarefas").value.split("\n").map(s => s.trim()).filter(Boolean);
    const analysis = { resumo, decisoes: [], missoes: tarefas, oportunidadesMencionadas: [], planning: null, relacionamento: null, healthScore: null };
    const selections = { decisoes: [], missoes: tarefas.map(() => true), oportunidades: [], planning: false, relacionamento: false, healthScore: false };
    renderCaptureApplying(m, client, analysis, selections, "manual");
  });
}

/* ---------------------------------------------------------- */
/* Processamento simulado (Fluxos 1, 2 e 3 — mesma animação)      */
/* ---------------------------------------------------------- */
function renderCaptureProcessing(m, client, source) {
  const steps = CAPTURE_STEP_TEMPLATES[source];
  document.getElementById("capture-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> IA processando a interação</div>
    <div class="capture-step-list" id="capture-step-list">
      ${steps.map((label, i) => `<div class="capture-step" data-step="${i}"><span class="capture-step-icon"></span><span>${label}</span></div>`).join("")}
    </div>
  `;
  const stepEls = document.querySelectorAll("#capture-step-list .capture-step");
  let i = 0;
  function advance() {
    if (i > 0) { stepEls[i - 1].classList.remove("active"); stepEls[i - 1].classList.add("done"); }
    if (i < stepEls.length) {
      stepEls[i].classList.add("active");
      i++;
      setTimeout(advance, 650);
    } else {
      setTimeout(() => renderCaptureReview(m, client, generateCaptureAnalysis(client, m), source), 500);
    }
  }
  advance();
}

/* ---------------------------------------------------------- */
/* Síntese da análise — reaproveita os dados já existentes do     */
/* cliente e da reunião (RFC-005), sem inventar um dado paralelo  */
/* ---------------------------------------------------------- */
function generateCaptureAnalysis(client, meeting) {
  const resumo = `Reunião com ${client.contato.nome} (${client.contato.cargo}) sobre ${meeting.title.toLowerCase()}. ${client.risk === "critical" ? "O cliente demonstrou preocupação com a situação financeira recente, mas se mostrou aberto a um plano de regularização." : "A conversa avançou de forma produtiva, com boa receptividade às propostas apresentadas."}`;

  const decisoes = client.risk === "critical"
    ? [`${client.contato.nome} se comprometeu a regularizar a pendência em aberto.`, "Ficou definido um novo contato em até 15 dias para acompanhar a evolução."]
    : ["Cliente aprovou avançar para a próxima etapa da negociação em curso.", "Ficou combinado o envio de material complementar em até 5 dias úteis."];

  const missoes = ["Enviar material comercial combinado durante a reunião.", "Agendar reunião de follow-up em 30 dias."];

  const oportunidadesMencionadas = [
    ...client.opportunities.map(o => o.product),
    ...(meeting.suggestedProducts || []).map(p => p.product)
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);

  const objective = client.planning.objectives[0];
  const planning = objective ? {
    objective: objective.title,
    currentPct: objective.plannedPct,
    suggestedPct: Math.min(100, objective.plannedPct + 15)
  } : null;

  const newStakeholder = (client.relationships || []).find(s => s.insight === "novo" || s.insight === "mudou_cargo");
  const relacionamento = newStakeholder
    ? `${newStakeholder.nome} (${newStakeholder.cargo}) foi mencionado durante a conversa. ${newStakeholder.insight === "novo" ? "Ainda não há histórico de relacionamento com este contato." : "Este contato mudou de cargo recentemente."} O Relationship Score deve ser revisado.`
    : null;

  const healthDelta = client.risk === "critical" ? -5 : (client.healthTrend === "up" ? 3 : 0);
  const healthScore = healthDelta !== 0 ? {
    current: client.healthScore,
    suggested: Math.max(0, Math.min(100, client.healthScore + healthDelta)),
    reason: client.risk === "critical" ? "Atraso identificado ainda em aberto durante a conversa." : "Sinais positivos de avanço comercial identificados na conversa."
  } : null;

  return { resumo, decisoes, missoes, oportunidadesMencionadas, planning, relacionamento, healthScore };
}

/* ---------------------------------------------------------- */
/* Painel de revisão — aceitar/rejeitar cada sugestão             */
/* ---------------------------------------------------------- */
function captureItemRow(groupName, index, text) {
  return `
    <div class="capture-item-row">
      <input type="checkbox" data-group="${groupName}" data-index="${index}" checked>
      <span class="capture-item-text">${text}</span>
    </div>
  `;
}

function renderCaptureReview(m, client, analysis, source) {
  const sourceLabel = { teams: "importado do Microsoft Teams", voz: "transcrito do áudio gravado", colar: "extraído do texto colado" }[source] || "";
  document.getElementById("capture-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Resumo${sourceLabel ? " — " + sourceLabel : ""}</div>

    <div class="draft-panel">
      <div class="draft-panel-header"><span class="type-h3">Resumo Executivo</span></div>
      <textarea class="input" id="capture-review-resumo" rows="3">${analysis.resumo}</textarea>
    </div>

    ${analysis.decisoes.length ? `
      <div class="section">
        <div class="type-h3 mb-2">Decisões</div>
        ${analysis.decisoes.map((d, i) => captureItemRow("decisoes", i, d)).join("")}
      </div>
    ` : ""}

    ${analysis.missoes.length ? `
      <div class="section">
        <div class="type-h3 mb-2">Missões identificadas</div>
        ${analysis.missoes.map((d, i) => captureItemRow("missoes", i, d)).join("")}
      </div>
    ` : ""}

    ${analysis.oportunidadesMencionadas.length ? `
      <div class="section">
        <div class="type-h3 mb-2">Oportunidades</div>
        ${analysis.oportunidadesMencionadas.map((d, i) => captureItemRow("oportunidades", i, d)).join("")}
      </div>
    ` : ""}

    ${analysis.planning ? `
      <div class="section change-block">
        <div class="type-h3 mb-2">Planning</div>
        <div class="capture-item-row">
          <input type="checkbox" data-group="planning" data-index="0" checked>
          <span class="capture-item-text">Objetivo impactado: <strong>${analysis.planning.objective}</strong>. Sugestão: atualizar progresso de ${analysis.planning.currentPct}% para ${analysis.planning.suggestedPct}%.</span>
        </div>
      </div>
    ` : ""}

    ${analysis.relacionamento ? `
      <div class="section">
        <div class="type-h3 mb-2">Relacionamentos</div>
        <div class="capture-item-row">
          <input type="checkbox" data-group="relacionamento" data-index="0" checked>
          <span class="capture-item-text">${analysis.relacionamento}</span>
        </div>
      </div>
    ` : ""}

    ${analysis.healthScore ? `
      <div class="section risks-block">
        <div class="type-h3 mb-2">Health Score</div>
        <div class="capture-item-row">
          <input type="checkbox" data-group="healthScore" data-index="0" checked>
          <span class="capture-item-text">Sugestão: ${analysis.healthScore.suggested > analysis.healthScore.current ? "aumentar" : "reduzir"} de ${analysis.healthScore.current} para ${analysis.healthScore.suggested}. Motivo: ${analysis.healthScore.reason}</span>
        </div>
      </div>
    ` : ""}

    <div class="flex gap-2 mt-5">
      <button class="btn btn-primary" id="capture-confirm-btn">Revisar e Confirmar</button>
      <button class="btn btn-ghost" id="capture-cancel-btn">Cancelar</button>
    </div>
  `;

  document.getElementById("capture-cancel-btn").addEventListener("click", closeCaptureModal);

  document.getElementById("capture-confirm-btn").addEventListener("click", () => {
    analysis.resumo = document.getElementById("capture-review-resumo").value;
    const selections = { decisoes: [], missoes: [], oportunidades: [], planning: false, relacionamento: false, healthScore: false };
    document.querySelectorAll("#capture-modal input[type=checkbox]").forEach(cb => {
      const group = cb.dataset.group, idx = parseInt(cb.dataset.index, 10);
      if (group === "planning" || group === "relacionamento" || group === "healthScore") selections[group] = cb.checked;
      else selections[group][idx] = cb.checked;
    });
    renderCaptureApplying(m, client, analysis, selections, source);
  });
}

/* ---------------------------------------------------------- */
/* Aprovação — aplica só o que foi aceito                         */
/* ---------------------------------------------------------- */
function renderCaptureApplying(m, client, analysis, selections) {
  const tasks = [];
  if (selections.missoes.some(Boolean)) tasks.push("Criar Missões");
  tasks.push("Atualizar Timeline");
  if (selections.planning) tasks.push("Atualizar Planning");
  if (selections.oportunidades.some(Boolean)) tasks.push("Atualizar Oportunidades");
  if (selections.relacionamento) tasks.push("Atualizar Relationship Score");
  if (selections.healthScore) tasks.push("Atualizar Health Score");

  document.getElementById("capture-modal").innerHTML = `
    <div class="ai-badge mb-3"><span class="spark">✦</span> Aplicando atualizações</div>
    <div class="capture-step-list" id="capture-apply-list">
      ${tasks.map((label, i) => `<div class="capture-step" data-step="${i}"><span class="capture-step-icon"></span><span>${label}</span></div>`).join("")}
    </div>
  `;
  const stepEls = document.querySelectorAll("#capture-apply-list .capture-step");
  let i = 0;
  function advance() {
    if (i > 0) { stepEls[i - 1].classList.remove("active"); stepEls[i - 1].classList.add("done"); }
    if (i < stepEls.length) {
      stepEls[i].classList.add("active");
      i++;
      setTimeout(advance, 450);
    } else {
      setTimeout(() => finalizeCaptureConfirm(m, client, analysis, selections), 400);
    }
  }
  advance();
}

function finalizeCaptureConfirm(m, client, analysis, selections) {
  const acceptedMissoes = analysis.missoes.filter((_, i) => selections.missoes[i]);
  const acceptedDecisoes = analysis.decisoes.filter((_, i) => selections.decisoes[i]);
  const acceptedOpportunities = analysis.oportunidadesMencionadas.filter((_, i) => selections.oportunidades[i]);

  const draft = {
    resumo: analysis.resumo,
    decisoes: acceptedDecisoes,
    timelineNote: analysis.resumo,
    planningNote: (selections.planning && analysis.planning)
      ? `Objetivo "${analysis.planning.objective}" atualizado de ${analysis.planning.currentPct}% para ${analysis.planning.suggestedPct}%.`
      : "Nenhuma atualização de Planning aplicada nesta interação.",
    tarefasText: acceptedMissoes.length ? acceptedMissoes.join("\n") : "Nenhum follow-up identificado nesta interação.",
    oportunidades: acceptedOpportunities.length ? `Reforçado interesse em: ${acceptedOpportunities.join(", ")}.` : "Nenhuma oportunidade reforçada nesta interação.",
    relationshipNote: (selections.relacionamento && analysis.relacionamento) ? analysis.relacionamento : "Nenhuma atualização de relacionamento aplicada nesta interação."
  };

  saveDraft(m.id, draft);
  setRegistered(m.id);

  acceptedMissoes.forEach((title, i) => {
    addExtraCommitment({
      id: "co-capture-" + m.id + "-" + i + "-" + Date.now(),
      clientId: client.id,
      title,
      dueOffsetDays: 5 + i * 10,
      impact: client.risk === "critical" ? "alto" : "medio",
      responsavel: MANAGER.name,
      origin: { type: "reuniao", label: `Interação registrada em ${formatDayLabel(m.offsetDays)}` },
      aiSummary: `Identifiquei este compromisso a partir da Captura Inteligente da interação com ${client.name}.`,
      detail: {
        resumoInteracao: analysis.resumo,
        participantes: [client.contato.nome],
        historico: "Compromisso gerado automaticamente pela Captura Inteligente de Interações.",
        impactoRelacionamento: "Cumprir o prazo reforça a credibilidade construída durante a interação.",
        riscos: "Ainda não avaliado — compromisso recém-criado pela IA."
      }
    });
  });

  closeCaptureModal();
  showToast(`Interação com ${client.name} registrada e atualizações aplicadas.`, "✓");
  refreshAfterVoiceFlow(m.id);
}

document.addEventListener("DOMContentLoaded", ensureCaptureModal);
