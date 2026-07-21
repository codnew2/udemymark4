/* ============================================================
   CRM Agêntico — Empresa X | Camada de Dados Fictícios
   Fonte única de verdade consumida por todas as páginas.
   ============================================================ */

const MANAGER = {
  name: "Camila Nogueira",
  role: "Gerente de Relacionamento — Middle Market/Corporate",
  portfolioSize: 14,
  initials: "CN"
};

const PRODUCT_CATALOG = [
  "Conta Corrente PJ", "Capital de Giro", "Câmbio / NDF", "Seguro Empresarial",
  "Cartão Corporativo", "Consórcio", "Previdência Corporativa",
  "Antecipação de Recebíveis", "Crédito Rural Estruturado", "Seguro Garantia",
  "Estruturação de Dívida", "Crédito CAPEX", "Cash Management"
];

/* ---------------------------------------------------------- */
/* Utilidades de data/formatação                               */
/* ---------------------------------------------------------- */

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayLabel(offsetDays) {
  if (offsetDays === 0) return "Hoje";
  if (offsetDays === 1) return "Amanhã";
  if (offsetDays === -1) return "Ontem";
  const d = addDays(new Date(), offsetDays);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
}

function formatTime(hhmm) {
  return hhmm;
}

function formatCurrencyBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatCurrencyCompact(value) {
  if (value >= 1000000) return "R$ " + (value / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
  if (value >= 1000) return "R$ " + (value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil";
  return formatCurrencyBRL(value);
}

function trendIcon(trend) {
  if (trend === "up") return "▲";
  if (trend === "down") return "▼";
  return "–";
}

function riskLabel(risk) {
  return { critical: "Crítico", attention: "Atenção", stable: "Estável" }[risk] || risk;
}

const PLANNING_STATUS_BADGE = { no_prazo: "badge-positive", atrasado: "badge-critical", concluido: "badge-neutral" };
const PLANNING_STATUS_LABEL = { no_prazo: "No prazo", atrasado: "Atrasado", concluido: "Concluído" };

/* A IA detecta objetivos atrasados comparando o prazo (due, em dias
   relativos a hoje) com a data atual — não é um rótulo fixo no dado. */
function computeObjectiveStatus(o) {
  if (o.status === "concluido") return "concluido";
  return o.due < 0 ? "atrasado" : "no_prazo";
}

/* ---------------------------------------------------------- */
/* Account Planning Vivo (RFC-004)                              */
/* Ciclo de vida do objetivo, planejado x realizado, mudanças  */
/* e sugestões de evolução — tudo derivado, nada hardcoded.    */
/* ---------------------------------------------------------- */

const OBJECTIVE_STAGES = ["planejado", "primeira_reuniao", "produto_apresentado", "negociacao", "proposta", "contratado", "concluido"];
const OBJECTIVE_STAGE_LABEL = {
  planejado: "Planejado", primeira_reuniao: "1ª reunião realizada", produto_apresentado: "Produto apresentado",
  negociacao: "Negociação iniciada", proposta: "Proposta enviada", contratado: "Operação contratada", concluido: "Objetivo concluído"
};
const OBJECTIVE_CATEGORY_LABEL = { concluido: "Concluído", em_andamento: "Em andamento", em_risco: "Em risco", aguardando_cliente: "Aguardando decisão do cliente" };
const OBJECTIVE_CATEGORY_BADGE = { concluido: "badge-positive", em_andamento: "badge-neutral", em_risco: "badge-critical", aguardando_cliente: "badge-info" };

function objectiveStage(o) {
  if (o.status === "concluido") return "concluido";
  return o.stage || "planejado";
}
function objectiveRealizedPct(o) {
  return Math.round((OBJECTIVE_STAGES.indexOf(objectiveStage(o)) / (OBJECTIVE_STAGES.length - 1)) * 100);
}
function objectivePlannedPct(o) {
  return objectiveStage(o) === "concluido" ? 100 : (o.plannedPct ?? 0);
}
function objectiveDiffPct(o) {
  return objectiveRealizedPct(o) - objectivePlannedPct(o);
}
/* A categoria nunca é um rótulo fixo: deriva do estágio atual e da
   distância entre o planejado e o realizado até agora. */
function objectiveCategory(o) {
  if (objectiveStage(o) === "concluido") return "concluido";
  if (o.awaitingClientDecision) return "aguardando_cliente";
  return objectiveDiffPct(o) <= -10 ? "em_risco" : "em_andamento";
}

function getAllPlanningObjectives() {
  const list = [];
  CLIENTS.forEach(c => (c.planning.objectives || []).forEach(o => list.push({ ...o, clientId: c.id, clientName: c.name })));
  return list;
}

function getPlanningPortfolioSummary() {
  const all = getAllPlanningObjectives();
  const byCategory = { concluido: 0, em_andamento: 0, em_risco: 0, aguardando_cliente: 0 };
  let realizedSum = 0, diffAbsSum = 0;
  all.forEach(o => {
    byCategory[objectiveCategory(o)]++;
    realizedSum += objectiveRealizedPct(o);
    diffAbsSum += Math.abs(objectiveDiffPct(o));
  });
  const progressPct = all.length ? Math.round(realizedSum / all.length) : 0;
  const confidencePct = all.length ? Math.max(0, Math.min(100, Math.round(100 - diffAbsSum / all.length))) : 100;
  return { total: all.length, byCategory, progressPct, confidencePct };
}

function getPlanningImpact() {
  const concluded = getAllPlanningObjectives().filter(o => objectiveStage(o) === "concluido");
  const closedOpportunities = getAllOpportunities().filter(o => o.stage === "Fechado");
  return {
    revenue: closedOpportunities.reduce((a, o) => a + o.impact, 0),
    productsContracted: concluded.length,
    operationsRealized: closedOpportunities.length,
    clientsImpacted: new Set(concluded.map(o => o.clientId)).size
  };
}

function generatePlanningBriefing() {
  const summary = getPlanningPortfolioSummary();
  const ahead = getAllPlanningObjectives().filter(o => objectiveCategory(o) === "em_andamento" && objectiveDiffPct(o) >= 10).length;
  return `Analisei continuamente sua carteira. Dos ${summary.total} objetivos planejados, ${summary.byCategory.concluido} já foram concluídos`
    + (ahead > 0 ? ` e ${ahead} ${ahead === 1 ? "está evoluindo" : "estão evoluindo"} acima da expectativa` : "")
    + `. ${summary.byCategory.em_risco} ${summary.byCategory.em_risco === 1 ? "apresenta" : "apresentam"} risco e ${summary.byCategory.aguardando_cliente} ${summary.byCategory.aguardando_cliente === 1 ? "aguarda" : "aguardam"} decisão do cliente. `
    + `Minha recomendação é priorizar os objetivos em risco antes de qualquer novo compromisso.`;
}

function probabilityLabel(pct) {
  if (pct >= 65) return "Alta";
  if (pct >= 35) return "Média";
  return "Baixa";
}

/* ---------------------------------------------------------- */
/* Relacionamentos Estratégicos — pools e fábrica de contato    */
/* A IA deriva parte dos dados de cada stakeholder (contato,    */
/* estatísticas de canal, rede, comportamento) a partir de       */
/* poucos campos centrais autorados — só o essencial é escrito  */
/* à mão por contato, o resto é calculado de forma determinística.*/
/* ---------------------------------------------------------- */

const INTEREST_POOL_BY_AREA = {
  "Financeiro": ["Crédito", "Capital de Giro", "Hedge"],
  "Tesouraria": ["Câmbio", "Liquidez", "Hedge"],
  "Presidência": ["Expansão", "Investimentos", "Governança"],
  "Diretoria Executiva": ["Expansão", "Investimentos", "Governança"],
  "Jurídico": ["Garantias", "Compliance", "Contratos"],
  "Compras": ["Capital de Giro", "Prazo de pagamento", "Crédito"],
  "Controladoria": ["Indicadores financeiros", "Crédito", "Digitalização"],
  "default": ["Crédito", "Expansão", "Digitalização"]
};

const BEHAVIOR_POOL = [
  "Prefere reuniões objetivas, direto ao ponto",
  "Responde rapidamente pela manhã",
  "Envolve outras áreas antes de decidir",
  "Costuma solicitar indicadores financeiros antes de qualquer decisão",
  "Demonstra maior abertura em conversas presenciais",
  "Prefere alinhar por escrito antes de uma ligação"
];

const OBJECTION_POOL = [
  "Sensibilidade à taxa de juros",
  "Necessidade de envolver a Tesouraria antes de decidir",
  "Processo interno de aprovação mais lento",
  "Preocupação com fluxo de caixa no curto prazo",
  "Tende a comparar propostas antes de decidir"
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickFrom(arr, seed, n = 1) {
  const start = seed % arr.length;
  const out = [];
  for (let i = 0; i < n && i < arr.length; i++) out.push(arr[(start + i) % arr.length]);
  return out;
}

function emailFromName(nome, domain) {
  const parts = nome.toLowerCase().split(" ").filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first}.${last}@${domain}`;
}

/* Constrói o objeto completo de um stakeholder a partir de um "seed"
   com os campos centrais autorados (narrativa e números-chave).
   Tudo que é mecânico (contato, estatística de canal, perfil
   comportamental) é derivado de forma determinística pelo id. */
function buildStakeholder(client, s) {
  const h = hashStr(client.id + s.id);
  const domain = client.contato.email.split("@")[1];
  const iniciais = s.nome.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const interestsPool = INTEREST_POOL_BY_AREA[s.area] || INTEREST_POOL_BY_AREA.default;

  const scoreHistory = s.scoreHistory || (() => {
    const dir = (s.insight === "esfriando" || s.insight === "saiu") ? -1 : 1;
    const step = 6 + (h % 5);
    const arr = [Math.max(5, Math.min(99, s.relationshipScore - dir * step * 3))];
    for (let i = 1; i < 3; i++) arr.push(Math.max(5, Math.min(99, arr[i - 1] + dir * step)));
    arr.push(s.relationshipScore);
    return arr;
  })();

  const channelOrder = ["email", "telefone", "teams"];
  const preferredChannel = channelOrder[h % 3];
  const channelStats = preferredChannel === "email" ? { email: 78 + (h % 15), telefone: 5 + (h % 8), teams: 4 + (h % 6) }
    : preferredChannel === "telefone" ? { telefone: 70 + (h % 15), email: 15 + (h % 8), teams: 5 + (h % 6) }
    : { teams: 65 + (h % 15), email: 20 + (h % 8), telefone: 5 + (h % 6) };
  const channelLabel = { email: "E-mail", telefone: "Telefone", teams: "Teams" };

  return {
    id: s.id, nome: s.nome, cargo: s.cargo, area: s.area, iniciais,
    tempoRelacionamentoMeses: s.tempoRelacionamentoMeses,
    tempoEmpresaAnos: s.tempoEmpresaAnos,
    relationshipScore: s.relationshipScore, scoreHistory,
    scoreReasons: s.scoreReasons,
    influenceScore: s.influenceScore, decisionRole: s.decisionRole,
    insight: s.insight || null,
    lastInteractionDays: s.lastInteractionDays,
    lastInteractionType: s.lastInteractionType,
    lastInteractionSummary: s.lastInteractionSummary,
    nextRecommended: s.nextRecommended,
    productsInterest: s.productsInterest,
    preferences: s.preferences || [],
    memory: s.memory,
    timeline: s.timeline,
    aiSummary: s.aiSummary,
    aiRecommendation: s.aiRecommendation,
    contato: {
      telefone: s.telefone || client.contato.telefone,
      celular: s.celular,
      email: s.email || emailFromName(s.nome, domain),
      teams: s.email || emailFromName(s.nome, domain),
      escritorio: s.escritorio || client.sede,
      fuso: s.fuso || "GMT-3"
    },
    communication: {
      lastEmailDaysAgo: s.lastEmailDaysAgo ?? s.lastInteractionDays,
      lastEmailSubject: s.lastEmailSubject,
      lastMeetingDate: s.lastMeetingDate,
      lastCallDate: s.lastCallDate,
      avgResponseTime: s.avgResponseTime,
      channelStats,
      lastChannelUsed: s.lastChannelUsed || channelLabel[preferredChannel]
    },
    approachSeed: s.approachSeed,
    behavioralPatterns: s.behavioralPatterns || pickFrom(BEHAVIOR_POOL, h, 3),
    interests: s.interests || pickFrom(interestsPool, h, 3),
    objections: s.objections || pickFrom(OBJECTION_POOL, h + 1, 2)
  };
}

/* ---------------------------------------------------------- */
/* Carteira de Clientes                                        */
/* ---------------------------------------------------------- */

const CLIENTS = [
  {
    id: "c01", name: "Grupo Vantage Logística", segment: "Corporate",
    setor: "Logística e Transporte", cnpj: "12.345.678/0001-90",
    sede: "São Paulo, SP", clienteDesde: 2014, receitaAnual: 420000000,
    contato: { nome: "Eduardo Marins", cargo: "Diretor Financeiro", email: "eduardo.marins@vantagelog.com.br", telefone: "(11) 4002-1150" },
    healthScore: 42, healthTrend: "down",
    healthFactors: [
      { label: "Atraso em aberto há 22 dias", weight: 34, trend: "down" },
      { label: "Sem contato há 68 dias", weight: 28, trend: "down" },
      { label: "Queda de NPS no trimestre", weight: 22, trend: "down" },
      { label: "Aumento de dívida de curto prazo", weight: 16, trend: "down" }
    ],
    risk: "critical", potential: "alto", relationship: "neutro", priority: 98,
    lastContactDays: 68,
    nps: { score: 34, trend: "down", delta: -21 },
    delinquency: { value: 480000, days: 22 },
    products: ["Conta Corrente PJ", "Capital de Giro", "Cash Management"],
    timeline: [
      { period: "Fevereiro", title: "Renovação de limite aprovada", text: "Limite de capital de giro renovado com aumento de 15%, refletindo bom histórico de pagamento até então.", sentiment: "positive", source: "Sistema — evento de crédito" },
      { period: "Maio", title: "Primeiro atraso relevante", text: "Cliente atrasou parcela de capital de giro pela primeira vez em 3 anos, alegando problema pontual de fluxo de caixa.", sentiment: "negative", source: "Nota de reunião — Camila Nogueira" },
      { period: "Junho", title: "NPS caiu 21 pontos", text: "Pesquisa de satisfação trimestral registrou queda expressiva, com menção a demora no atendimento de uma solicitação de câmbio.", sentiment: "negative", source: "Pesquisa NPS — Empresa X" },
      { period: "Julho", title: "IA recomenda contato imediato", text: "Atraso persiste há 22 dias e não há contato registrado há 68 dias — combinação classificada como risco crítico.", sentiment: "negative", source: "Análise contínua da IA" }
    ],
    opportunities: [
      { id: "o01", product: "Estruturação de Dívida", probabilityPct: 55, impact: 2400000, stage: "Proposta", justification: "Concentração de dívida de curto prazo cresceu 12% no trimestre; estruturação de longo prazo reduziria pressão de caixa e risco de novos atrasos.", origin: { type: "email", label: "E-mail recebido" } }
    ],
    planning: {
      objectives: [
        {
          title: "Reduzir concentração de dívida de curto prazo", due: -15,
          stage: "proposta", plannedPct: 85,
          aiAnalysis: "Após o atraso de pagamento e a queda de contato, as tratativas de estruturação de dívida esfriaram — a proposta está pronta desde junho mas não avançou.",
          recommendation: "Retomar contato direto imediatamente, aproveitando a proposta de Estruturação de Dívida já enviada.",
          timeline: [
            { period: "Fevereiro", title: "Objetivo definido no Planning", text: "IA identificou concentração crescente de dívida de curto prazo como prioridade do ciclo.", sentiment: "neutral", source: "Account Planning" },
            { period: "Junho", title: "Proposta de estruturação enviada", text: "Proposta de Estruturação de Dívida formalizada, mas sem retorno do cliente desde então.", sentiment: "negative", source: "Nota de reunião — Camila Nogueira" }
          ]
        },
        {
          title: "Aumentar share de produtos de proteção cambial", due: 30,
          stage: "planejado", plannedPct: 5,
          aiAnalysis: "Ainda não houve nenhuma interação específica sobre produtos de proteção cambial com este cliente.",
          recommendation: "Incluir o tema em uma próxima conversa comercial, sem urgência no momento.",
          timeline: [
            { period: "Julho", title: "Objetivo planejado", text: "Planning definiu a diversificação para produtos de proteção cambial como objetivo de médio prazo.", sentiment: "neutral", source: "Account Planning" }
          ]
        }
      ],
      aiSuggestion: "O objetivo \"Reduzir concentração de dívida de curto prazo\" está atrasado há 15 dias, e o cliente segue em atraso de pagamento há 22 dias. Sugiro antecipar a conversa sobre a estruturação de dívida já identificada como oportunidade, aproveitando a reunião de hoje.",
      suggestionContext: { originalObjective: "Reduzir concentração de dívida de curto prazo", newInfo: "Atraso de pagamento persiste há 22 dias e o cliente segue sem contato há 68 dias." }
    }
  },
  {
    id: "c02", name: "Nortex Alimentos S.A.", segment: "Middle Market",
    setor: "Alimentos e Bebidas", cnpj: "23.456.789/0001-11",
    sede: "Curitiba, PR", clienteDesde: 2018, receitaAnual: 95000000,
    contato: { nome: "Marina Kolb", cargo: "CFO", email: "marina.kolb@nortex.com.br", telefone: "(41) 3025-4410" },
    healthScore: 81, healthTrend: "up",
    healthFactors: [
      { label: "Pagamentos em dia há 18 meses", weight: 30, trend: "up" },
      { label: "NPS subiu 6 pontos", weight: 25, trend: "up" },
      { label: "Contato recente e frequente", weight: 20, trend: "up" },
      { label: "Baixa diversificação de produtos", weight: 15, trend: "stable" }
    ],
    risk: "stable", potential: "médio", relationship: "forte", priority: 41,
    lastContactDays: 12,
    nps: { score: 78, trend: "up", delta: 6 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Cartão Corporativo"],
    timeline: [
      { period: "Março", title: "Expansão de linha de produção", text: "Cliente investiu em nova linha de produção e sinalizou possível necessidade futura de capital de giro adicional.", sentiment: "positive", source: "Nota de reunião — Camila Nogueira" },
      { period: "Junho", title: "NPS subiu para 78", text: "Cliente elogiou agilidade na abertura de conta garantida para fornecedor estratégico.", sentiment: "positive", source: "Pesquisa NPS — Empresa X" }
    ],
    opportunities: [
      { id: "o02", product: "Conta Garantida", probabilityPct: 28, impact: 200000, stage: "Identificado", justification: "Baixa diversificação de produtos e expansão recente de produção indicam potencial necessidade de linha de garantia adicional.", origin: { type: "reuniao", label: "Reunião registrada em março" } }
    ],
    planning: {
      objectives: [
        {
          title: "Diversificar carteira de produtos contratados", due: 45,
          stage: "primeira_reuniao", plannedPct: 15,
          aiAnalysis: "Reunião de março já identificou potencial de conta garantida; discussão inicial ocorreu dentro do esperado.",
          recommendation: "Avançar para apresentação formal do produto na próxima interação.",
          timeline: [
            { period: "Março", title: "Primeira reunião sobre diversificação", text: "Reunião trimestral abordou a baixa diversificação de produtos e identificou potencial de conta garantida.", sentiment: "positive", source: "Nota de reunião — Camila Nogueira" }
          ]
        }
      ],
      aiSuggestion: null
    }
  },
  {
    id: "c03", name: "Metalúrgica Andrade", segment: "Corporate",
    setor: "Metalurgia e Siderurgia", cnpj: "34.567.890/0001-22",
    sede: "Belo Horizonte, MG", clienteDesde: 2011, receitaAnual: 260000000,
    contato: { nome: "Ricardo Andrade", cargo: "Diretor-Presidente", email: "ricardo@metalurgicaandrade.com.br", telefone: "(31) 3222-7890" },
    healthScore: 58, healthTrend: "down",
    healthFactors: [
      { label: "Atraso pontual em aberto há 8 dias", weight: 30, trend: "down" },
      { label: "Queda de NPS de 9 pontos", weight: 25, trend: "down" },
      { label: "Boa aderência de produtos", weight: 25, trend: "stable" },
      { label: "Contato regular mantido", weight: 20, trend: "up" }
    ],
    risk: "attention", potential: "alto", relationship: "neutro", priority: 76,
    lastContactDays: 34,
    nps: { score: 52, trend: "down", delta: -9 },
    delinquency: { value: 120000, days: 8 },
    products: ["Capital de Giro", "Seguro Empresarial", "Câmbio / NDF"],
    timeline: [
      { period: "Janeiro", title: "Contratação de seguro garantia negada", text: "Proposta de seguro garantia para nova licitação foi recusada por pendência documental — cliente ficou insatisfeito com o processo.", sentiment: "negative", source: "Nota de reunião — Camila Nogueira" },
      { period: "Abril", title: "Novo contrato relevante fechado", text: "Cliente venceu licitação pública de grande porte, ampliando necessidade de capital de giro e garantias.", sentiment: "positive", source: "E-mail do cliente" },
      { period: "Junho", title: "Atraso pontual identificado", text: "Parcela de capital de giro em atraso há 8 dias — cliente sinalizou que é atraso operacional, não estrutural.", sentiment: "negative", source: "Sistema — evento de crédito" }
    ],
    opportunities: [
      { id: "o03", product: "Seguro Garantia", probabilityPct: 78, impact: 850000, stage: "Em contato", justification: "Novo contrato público exige apólice de seguro garantia; cliente já sinalizou interesse após resolver pendência documental anterior.", origin: { type: "reuniao", label: "Reunião realizada em 04/07" } }
    ],
    planning: {
      objectives: [
        {
          title: "Reverter percepção negativa do processo de seguro garantia", due: -5,
          stage: "negociacao", plannedPct: 60,
          aiAnalysis: "Apesar da nova oportunidade de seguro garantia já em contato, a percepção negativa do processo anterior ainda não foi formalmente endereçada com o cliente.",
          recommendation: "Fazer contato específico reconhecendo o problema anterior antes de avançar comercialmente.",
          timeline: [
            { period: "Janeiro", title: "Processo anterior recusado", text: "Proposta de seguro garantia negada por pendência documental, gerando insatisfação.", sentiment: "negative", source: "Nota de reunião — Camila Nogueira" },
            { period: "Junho", title: "Pendência resolvida, sem reconhecimento formal", text: "Cliente resolveu a pendência e sinalizou interesse em retomar, mas o desgaste do processo anterior não foi tratado diretamente.", sentiment: "neutral", source: "Análise contínua da IA" }
          ]
        },
        {
          title: "Estruturar garantias para novo contrato público", due: 20,
          stage: "produto_apresentado", plannedPct: 30,
          aiAnalysis: "Produto de seguro garantia já apresentado após a vitória do novo contrato público; evolução dentro do esperado.",
          recommendation: "Confirmar cronograma de contratação com o cliente para não perder o prazo do processo licitatório.",
          timeline: [
            { period: "Abril", title: "Novo contrato público vencido", text: "Cliente venceu licitação de grande porte, ampliando necessidade de garantias.", sentiment: "positive", source: "E-mail do cliente" }
          ]
        }
      ],
      aiSuggestion: "O objetivo de reverter a percepção sobre o seguro garantia está atrasado há 5 dias e há uma nova oportunidade de mesmo produto em andamento — as duas frentes podem ser tratadas na mesma conversa.",
      suggestionContext: { originalObjective: "Reverter percepção negativa do processo de seguro garantia", newInfo: "Nova oportunidade de Seguro Garantia foi identificada para o mesmo cliente." },
      changes: [
        { title: "Nova oportunidade de mesmo produto identificada", detectedAt: "04/07", impact: "Acelera potencialmente o objetivo de estruturar garantias, mas exige alinhar com a percepção negativa ainda não resolvida.", affectedObjectives: ["Reverter percepção negativa do processo de seguro garantia", "Estruturar garantias para novo contrato público"], recommendation: "Tratar as duas frentes na mesma conversa, começando pelo reconhecimento do processo anterior." }
      ]
    }
  },
  {
    id: "c04", name: "BioFarma Sul Indústria Farmacêutica", segment: "Middle Market",
    setor: "Indústria Farmacêutica", cnpj: "45.678.901/0001-33",
    sede: "Porto Alegre, RS", clienteDesde: 2016, receitaAnual: 140000000,
    contato: { nome: "Luiza Hoffmann", cargo: "CFO", email: "luiza.hoffmann@biofarmasul.com.br", telefone: "(51) 3358-2200" },
    healthScore: 74, healthTrend: "up",
    healthFactors: [
      { label: "Pagamentos em dia", weight: 28, trend: "stable" },
      { label: "Contato muito recente", weight: 24, trend: "up" },
      { label: "Alta aderência a novos produtos", weight: 26, trend: "up" },
      { label: "NPS estável em patamar alto", weight: 22, trend: "stable" }
    ],
    risk: "stable", potential: "alto", relationship: "forte", priority: 55,
    lastContactDays: 5,
    nps: { score: 81, trend: "stable", delta: 1 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Capital de Giro", "Previdência Corporativa"],
    timeline: [
      { period: "Fevereiro", title: "Expansão da planta industrial anunciada", text: "Cliente anunciou plano de expansão da capacidade produtiva para os próximos 18 meses.", sentiment: "positive", source: "E-mail do cliente" },
      { period: "Maio", title: "Reunião de acompanhamento trimestral", text: "Discutida necessidade de capital de giro adicional para sustentar crescimento de estoque.", sentiment: "positive", source: "Registro de reunião por voz" },
      { period: "Julho", title: "IA identifica oportunidade de capital de giro", text: "Cruzamento entre plano de expansão e ciclo de caixa atual indica alta probabilidade de aceite de nova linha.", sentiment: "positive", source: "Análise contínua da IA" }
    ],
    opportunities: [
      { id: "o04", product: "Capital de Giro", probabilityPct: 82, impact: 1100000, stage: "Negociação", justification: "Expansão da planta em curso aumenta necessidade de caixa; cliente já sinalizou abertura para nova linha em reunião recente.", origin: { type: "teams", label: "Conversa no Teams" } }
    ],
    planning: {
      objectives: [
        {
          title: "Financiar ciclo de caixa da expansão industrial", due: 25,
          stage: "negociacao", plannedPct: 45,
          aiAnalysis: "Negociação avançou mais rápido que o esperado após a reunião trimestral — cliente já sinalizou abertura para a nova linha.",
          recommendation: "Aproveitar o momentum e enviar a proposta formal ainda esta semana.",
          timeline: [
            { period: "Maio", title: "Reunião de acompanhamento", text: "Discutida necessidade de capital de giro adicional para sustentar crescimento de estoque.", sentiment: "positive", source: "Registro de reunião por voz" }
          ]
        },
        {
          title: "Aumentar penetração de previdência corporativa", status: "concluido", due: -10,
          stage: "concluido", plannedPct: 95,
          aiAnalysis: "Objetivo concluído dentro do prazo esperado.",
          recommendation: null,
          timeline: [
            { period: "Junho", title: "Adesão à previdência corporativa formalizada", text: "Cliente contratou plano de previdência corporativa para seus executivos.", sentiment: "positive", source: "Sistema — evento de produto" }
          ]
        }
      ],
      aiSuggestion: null
    }
  },
  {
    id: "c05", name: "Construtora Horizonte Empreendimentos", segment: "Corporate",
    setor: "Construção Civil", cnpj: "56.789.012/0001-44",
    sede: "São Paulo, SP", clienteDesde: 2009, receitaAnual: 610000000,
    contato: { nome: "Paulo Salomão", cargo: "Diretor Financeiro", email: "paulo.salomao@horizonte.com.br", telefone: "(11) 3888-6600" },
    healthScore: 39, healthTrend: "down",
    healthFactors: [
      { label: "Atraso relevante em aberto há 45 dias", weight: 36, trend: "down" },
      { label: "Sem contato há 91 dias", weight: 30, trend: "down" },
      { label: "NPS em patamar crítico", weight: 24, trend: "down" },
      { label: "Redução de produtos contratados", weight: 10, trend: "down" }
    ],
    risk: "critical", potential: "médio", relationship: "fraco", priority: 99,
    lastContactDays: 91,
    nps: { score: 29, trend: "down", delta: -18 },
    delinquency: { value: 950000, days: 45 },
    products: ["Conta Corrente PJ", "Capital de Giro"],
    timeline: [
      { period: "Dezembro", title: "Desaceleração de obras em andamento", text: "Cliente sinalizou desaceleração de dois empreendimentos por dificuldades de licenciamento.", sentiment: "negative", source: "E-mail do cliente" },
      { period: "Março", title: "Atraso relevante iniciado", text: "Parcela de capital de giro entrou em atraso, sem retorno às tentativas de contato da equipe comercial.", sentiment: "negative", source: "Sistema — evento de crédito" },
      { period: "Junho", title: "Cliente sem contato há mais de 3 meses", text: "Nenhuma interação registrada desde a última tentativa de cobrança — situação classificada como risco severo.", sentiment: "negative", source: "Análise contínua da IA" }
    ],
    opportunities: [],
    planning: {
      objectives: [
        {
          title: "Recuperar relacionamento e regularizar atraso", due: -30,
          stage: "planejado", plannedPct: 70,
          aiAnalysis: "Nenhuma ação de recuperação foi iniciada apesar da gravidade do atraso e da ausência de contato há 91 dias.",
          recommendation: "Priorizar contato direto imediatamente — este é o cliente de maior risco da carteira.",
          timeline: [
            { period: "Junho", title: "Situação classificada como risco severo", text: "Atraso de R$ 950 mil há 45 dias e 91 dias sem contato levaram a IA a classificar o cliente como risco crítico.", sentiment: "negative", source: "Análise contínua da IA" }
          ]
        }
      ],
      aiSuggestion: "Este é o cliente com maior risco da carteira: atraso de R$ 950 mil há 45 dias e nenhum contato há 91 dias. Recomendo priorizar contato direto ainda hoje, antes de qualquer outra ação da Missão do Dia.",
      suggestionContext: { originalObjective: "Recuperar relacionamento e regularizar atraso", newInfo: "Atraso de R$ 950 mil há 45 dias e 91 dias sem contato — maior risco da carteira." }
    }
  },
  {
    id: "c06", name: "TechNova Sistemas Ltda", segment: "Middle Market",
    setor: "Tecnologia e Software", cnpj: "67.890.123/0001-55",
    sede: "Campinas, SP", clienteDesde: 2020, receitaAnual: 68000000,
    contato: { nome: "Bruno Castilho", cargo: "CEO", email: "bruno@technova.com.br", telefone: "(19) 3521-9090" },
    healthScore: 88, healthTrend: "up",
    healthFactors: [
      { label: "Contato muito frequente", weight: 25, trend: "up" },
      { label: "NPS entre os mais altos da carteira", weight: 30, trend: "up" },
      { label: "Novo contrato internacional fechado", weight: 25, trend: "up" },
      { label: "Pagamentos sempre em dia", weight: 20, trend: "stable" }
    ],
    risk: "stable", potential: "alto", relationship: "forte", priority: 22,
    lastContactDays: 3,
    nps: { score: 85, trend: "up", delta: 4 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Cartão Corporativo", "Cash Management"],
    timeline: [
      { period: "Abril", title: "Fechou contrato internacional", text: "Cliente fechou contrato de licenciamento de software com empresa nos EUA, gerando fluxo de recebíveis em dólar.", sentiment: "positive", source: "Registro de reunião por voz" },
      { period: "Junho", title: "Primeira operação de câmbio", text: "Realizou a primeira operação de câmbio para recebimento do contrato internacional, com boa experiência.", sentiment: "positive", source: "Sistema — evento de produto" }
    ],
    opportunities: [
      { id: "o05", product: "Câmbio / NDF", probabilityPct: 74, impact: 640000, stage: "Proposta", justification: "Fluxo recorrente de recebíveis em dólar do novo contrato internacional torna o hedge cambial altamente aderente.", origin: { type: "email", label: "E-mail recebido" } }
    ],
    planning: {
      objectives: [
        {
          title: "Estruturar proteção cambial para receita internacional", due: 12,
          stage: "proposta", plannedPct: 60,
          aiAnalysis: "Cliente já realizou a primeira operação de câmbio e recebeu proposta formal de hedge — evolução acima do esperado.",
          recommendation: "Fechar a operação de hedge ainda este mês para capturar o câmbio atual.",
          timeline: [
            { period: "Junho", title: "Primeira operação de câmbio realizada", text: "Cliente realizou a primeira operação de câmbio para o contrato internacional, com boa experiência.", sentiment: "positive", source: "Sistema — evento de produto" }
          ]
        }
      ],
      aiSuggestion: null
    }
  },
  {
    id: "c07", name: "Distribuidora Cordeiro & Cia", segment: "Middle Market",
    setor: "Distribuição e Atacado", cnpj: "78.901.234/0001-66",
    sede: "Recife, PE", clienteDesde: 2013, receitaAnual: 82000000,
    contato: { nome: "Sandra Cordeiro", cargo: "Sócia-Diretora", email: "sandra@cordeirodistribuidora.com.br", telefone: "(81) 3223-4455" },
    healthScore: 63, healthTrend: "stable",
    healthFactors: [
      { label: "Sem contato há 47 dias", weight: 28, trend: "down" },
      { label: "NPS estável em patamar médio", weight: 24, trend: "stable" },
      { label: "Pagamentos em dia", weight: 26, trend: "stable" },
      { label: "Baixa diversificação de produtos", weight: 22, trend: "stable" }
    ],
    risk: "attention", potential: "baixo", relationship: "neutro", priority: 60,
    lastContactDays: 47,
    nps: { score: 58, trend: "stable", delta: 0 },
    delinquency: null,
    products: ["Conta Corrente PJ"],
    timeline: [
      { period: "Fevereiro", title: "Renovação simples de limite", text: "Renovação de limite de conta garantida sem alterações relevantes de condição.", sentiment: "neutral", source: "Sistema — evento de crédito" },
      { period: "Maio", title: "Sem novas interações registradas", text: "Nenhum contato comercial registrado nos últimos meses além de comunicações operacionais.", sentiment: "neutral", source: "Análise contínua da IA" }
    ],
    opportunities: [],
    planning: {
      objectives: [
        {
          title: "Retomar cadência de contato trimestral", due: -7,
          stage: "planejado", plannedPct: 30,
          aiAnalysis: "Nenhuma interação comercial registrada além de comunicações operacionais nos últimos meses.",
          recommendation: "Incluir o cliente na próxima rodada de contatos preventivos.",
          timeline: [
            { period: "Maio", title: "Ausência de interações comerciais", text: "Nenhum contato comercial registrado nos últimos meses além de comunicações operacionais.", sentiment: "neutral", source: "Análise contínua da IA" }
          ]
        }
      ],
      aiSuggestion: "Nenhuma interação comercial registrada há 47 dias. Sugiro incluir este cliente na próxima rodada de contatos preventivos.",
      suggestionContext: { originalObjective: "Retomar cadência de contato trimestral", newInfo: "Nenhuma interação comercial registrada há 47 dias." }
    }
  },
  {
    id: "c08", name: "Frigorífico Santa Fé Alimentos", segment: "Corporate",
    setor: "Frigorífico e Proteína Animal", cnpj: "89.012.345/0001-77",
    sede: "Campo Grande, MS", clienteDesde: 2010, receitaAnual: 340000000,
    contato: { nome: "Antônio Vilela", cargo: "Diretor Financeiro", email: "antonio.vilela@santafealimentos.com.br", telefone: "(67) 3324-1188" },
    healthScore: 70, healthTrend: "up",
    healthFactors: [
      { label: "Contato recente e produtivo", weight: 26, trend: "up" },
      { label: "NPS em recuperação", weight: 24, trend: "up" },
      { label: "Plano de expansão de planta sinalizado", weight: 28, trend: "up" },
      { label: "Concentração em poucos produtos", weight: 22, trend: "stable" }
    ],
    risk: "stable", potential: "alto", relationship: "forte", priority: 45,
    lastContactDays: 18,
    nps: { score: 74, trend: "up", delta: 8 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Capital de Giro", "Seguro Empresarial"],
    timeline: [
      { period: "Janeiro", title: "Queda de NPS por demora em análise de crédito", text: "Cliente reclamou do tempo de resposta em uma solicitação de ampliação de limite.", sentiment: "negative", source: "Pesquisa NPS — Empresa X" },
      { period: "Abril", title: "Processo de crédito revisado", text: "Equipe agilizou processo de análise após feedback — cliente reconheceu a melhoria.", sentiment: "positive", source: "Nota de reunião — Camila Nogueira" },
      { period: "Junho", title: "Anúncio de expansão de planta", text: "Cliente sinalizou investimento em nova planta de processamento para o próximo ano.", sentiment: "positive", source: "E-mail do cliente" }
    ],
    opportunities: [
      { id: "o06", product: "Crédito CAPEX", probabilityPct: 61, impact: 3200000, stage: "Identificado", justification: "Expansão de planta anunciada tem alta aderência a linha de crédito CAPEX de longo prazo, ainda não oferecida formalmente.", origin: { type: "reuniao", label: "Reunião realizada em 06/07" } }
    ],
    planning: {
      objectives: [
        {
          title: "Apresentar estrutura de crédito CAPEX para expansão", due: 18,
          stage: "proposta", plannedPct: 55, awaitingClientDecision: true,
          aiAnalysis: "Proposta de estrutura de crédito CAPEX foi apresentada após o anúncio de expansão da planta; decisão está no comitê de investimentos do cliente.",
          recommendation: "Fazer follow-up em 5 dias úteis caso não haja retorno do comitê.",
          timeline: [
            { period: "Junho", title: "Expansão de planta anunciada", text: "Cliente sinalizou investimento em nova planta de processamento para o próximo ano.", sentiment: "positive", source: "E-mail do cliente" }
          ]
        }
      ],
      aiSuggestion: null,
      changes: [
        { title: "Comitê de investimentos acionado", detectedAt: "06/07", impact: "Objetivo de CAPEX passa a depender de decisão externa ao cliente comercial, fora do controle direto do gerente.", affectedObjectives: ["Apresentar estrutura de crédito CAPEX para expansão"], recommendation: "Agendar follow-up após decisão do comitê." }
      ]
    }
  },
  {
    id: "c09", name: "AgroVelo Insumos Agrícolas", segment: "Middle Market",
    setor: "Agronegócio — Insumos", cnpj: "90.123.456/0001-88",
    sede: "Rio Verde, GO", clienteDesde: 2017, receitaAnual: 118000000,
    contato: { nome: "Helena Duarte", cargo: "CFO", email: "helena.duarte@agrovelo.com.br", telefone: "(64) 3611-2233" },
    healthScore: 55, healthTrend: "down",
    healthFactors: [
      { label: "Sem contato há 52 dias", weight: 30, trend: "down" },
      { label: "NPS em queda moderada", weight: 24, trend: "down" },
      { label: "Sazonalidade típica do setor", weight: 20, trend: "stable" },
      { label: "Pagamentos em dia", weight: 26, trend: "stable" }
    ],
    risk: "attention", potential: "médio", relationship: "neutro", priority: 68,
    lastContactDays: 52,
    nps: { score: 49, trend: "down", delta: -7 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Crédito Rural Estruturado"],
    timeline: [
      { period: "Março", title: "Pico sazonal de compra de insumos", text: "Cliente utilizou linha de crédito rural para financiar compra antecipada de insumos da safra.", sentiment: "positive", source: "Sistema — evento de produto" },
      { period: "Junho", title: "Sem contato desde o período de safra", text: "Nenhuma interação comercial registrada desde o pico sazonal — padrão de atenção pela IA.", sentiment: "neutral", source: "Análise contínua da IA" }
    ],
    opportunities: [
      { id: "o07", product: "Crédito Rural Estruturado", probabilityPct: 35, impact: 500000, stage: "Identificado", justification: "Padrão sazonal indica nova necessidade de crédito rural na próxima janela de plantio.", origin: { type: "email", label: "E-mail recebido" } }
    ],
    planning: {
      objectives: [
        {
          title: "Antecipar oferta de crédito para próxima safra", due: 40,
          stage: "planejado", plannedPct: 5,
          aiAnalysis: "Ainda dentro da janela de planejamento; sem urgência apesar da ausência de contato desde o pico sazonal.",
          recommendation: "Programar contato preventivo antes da próxima janela de plantio.",
          timeline: [
            { period: "Junho", title: "Sem contato desde o pico sazonal", text: "Nenhuma interação comercial registrada desde o pico sazonal.", sentiment: "neutral", source: "Análise contínua da IA" }
          ]
        }
      ],
      aiSuggestion: null
    }
  },
  {
    id: "c10", name: "Cerâmica Realce Revestimentos", segment: "Middle Market",
    setor: "Materiais de Construção", cnpj: "01.234.567/0001-99",
    sede: "Criciúma, SC", clienteDesde: 2012, receitaAnual: 54000000,
    contato: { nome: "Jorge Salvan", cargo: "Diretor Administrativo-Financeiro", email: "jorge.salvan@ceramicarealce.com.br", telefone: "(48) 3437-5566" },
    healthScore: 46, healthTrend: "down",
    healthFactors: [
      { label: "Atraso em aberto há 15 dias", weight: 32, trend: "down" },
      { label: "Sem contato há 73 dias", weight: 28, trend: "down" },
      { label: "NPS baixo e em queda", weight: 26, trend: "down" },
      { label: "Baixo potencial comercial adicional", weight: 14, trend: "stable" }
    ],
    risk: "critical", potential: "baixo", relationship: "fraco", priority: 80,
    lastContactDays: 73,
    nps: { score: 38, trend: "down", delta: -11 },
    delinquency: { value: 60000, days: 15 },
    products: ["Conta Corrente PJ"],
    timeline: [
      { period: "Fevereiro", title: "Queda de demanda no setor de revestimentos", text: "Cliente relatou retração no setor de construção civil afetando faturamento.", sentiment: "negative", source: "E-mail do cliente" },
      { period: "Maio", title: "Atraso iniciado", text: "Parcela de conta garantida entrou em atraso — cliente não retornou contatos posteriores.", sentiment: "negative", source: "Sistema — evento de crédito" }
    ],
    opportunities: [],
    planning: {
      objectives: [
        {
          title: "Regularizar atraso e reavaliar limite de crédito", due: -20,
          stage: "planejado", plannedPct: 60,
          aiAnalysis: "Cliente não retornou contatos desde o início do atraso; nenhuma ação de regularização foi iniciada.",
          recommendation: "Acionar recuperação de crédito antes de qualquer nova oferta comercial.",
          timeline: [
            { period: "Maio", title: "Atraso iniciado sem retorno", text: "Parcela de conta garantida entrou em atraso — cliente não retornou contatos posteriores.", sentiment: "negative", source: "Sistema — evento de crédito" }
          ]
        }
      ],
      aiSuggestion: "Atraso de R$ 60 mil há 15 dias combinado a 73 dias sem contato — recomendo ação de recuperação antes de qualquer nova oferta comercial.",
      suggestionContext: { originalObjective: "Regularizar atraso e reavaliar limite de crédito", newInfo: "Atraso de R$ 60 mil há 15 dias combinado a 73 dias sem contato." }
    }
  },
  {
    id: "c11", name: "Silva & Prado Engenharia", segment: "Corporate",
    setor: "Engenharia e Infraestrutura", cnpj: "11.222.333/0001-00",
    sede: "Rio de Janeiro, RJ", clienteDesde: 2008, receitaAnual: 780000000,
    contato: { nome: "Fernanda Prado", cargo: "Vice-Presidente Financeira", email: "fernanda.prado@silvaprado.com.br", telefone: "(21) 3505-7700" },
    healthScore: 92, healthTrend: "stable",
    healthFactors: [
      { label: "Relacionamento consolidado há 16 anos", weight: 25, trend: "stable" },
      { label: "NPS entre os mais altos da carteira", weight: 30, trend: "up" },
      { label: "Contato constante e produtivo", weight: 25, trend: "up" },
      { label: "Ampla adesão a produtos estratégicos", weight: 20, trend: "stable" }
    ],
    risk: "stable", potential: "alto", relationship: "forte", priority: 15,
    lastContactDays: 2,
    nps: { score: 90, trend: "stable", delta: 1 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Capital de Giro", "Seguro Empresarial", "Câmbio / NDF", "Cash Management"],
    timeline: [
      { period: "Janeiro", title: "Renovação do contrato-mãe", text: "Renovado o contrato-guarda-chuva que rege as principais operações de crédito do grupo.", sentiment: "positive", source: "Registro de reunião por voz" },
      { period: "Abril", title: "Novo projeto de infraestrutura vencido", text: "Cliente venceu grande licitação de infraestrutura rodoviária, ampliando necessidade de garantias.", sentiment: "positive", source: "E-mail do cliente" },
      { period: "Julho", title: "IA recomenda cross-sell de seguros", text: "Volume de novas obras torna o cliente altamente aderente a uma ampliação da apólice de seguro empresarial.", sentiment: "positive", source: "Análise contínua da IA" }
    ],
    opportunities: [
      { id: "o08", product: "Renovação de Limite + Cross-sell Seguros", probabilityPct: 88, impact: 1800000, stage: "Fechado", justification: "Cliente estratégico com relacionamento de 16 anos; renovação e ampliação de seguros já formalizadas.", origin: { type: "reuniao", label: "Reunião realizada em 01/07" } }
    ],
    planning: {
      objectives: [
        {
          title: "Renovar contrato-mãe", status: "concluido", due: -60,
          stage: "concluido", plannedPct: 100,
          aiAnalysis: "Contrato-guarda-chuva renovado dentro do prazo planejado.",
          recommendation: null,
          timeline: [
            { period: "Janeiro", title: "Contrato-mãe renovado", text: "Renovado o contrato-guarda-chuva que rege as principais operações de crédito do grupo.", sentiment: "positive", source: "Registro de reunião por voz" }
          ]
        },
        {
          title: "Ampliar cobertura de seguros para novas obras", status: "concluido", due: -10,
          stage: "concluido", plannedPct: 90,
          aiAnalysis: "Ampliação de seguros formalizada logo após a vitória da licitação de infraestrutura.",
          recommendation: null,
          timeline: [
            { period: "Abril", title: "Nova licitação vencida", text: "Cliente venceu grande licitação de infraestrutura rodoviária, ampliando necessidade de garantias.", sentiment: "positive", source: "E-mail do cliente" },
            { period: "Julho", title: "Cross-sell de seguros formalizado", text: "Ampliação da apólice de seguro empresarial contratada.", sentiment: "positive", source: "Sistema — evento de produto" }
          ]
        },
        {
          title: "Mapear necessidades do próximo ciclo de investimento", due: 60,
          stage: "planejado", plannedPct: 5,
          aiAnalysis: "Objetivo recém-definido após a conclusão dos dois primeiros; ainda dentro do prazo esperado.",
          recommendation: "Aproveitar o bom momento do relacionamento para iniciar o mapeamento nos próximos meses.",
          timeline: [
            { period: "Julho", title: "Objetivo definido", text: "Após concluir os objetivos anteriores, Planning passou a mapear o próximo ciclo de investimento do grupo.", sentiment: "neutral", source: "Account Planning" }
          ]
        }
      ],
      aiSuggestion: null
    }
  },
  {
    id: "c12", name: "TransCarga Brasil Logística", segment: "Middle Market",
    setor: "Transporte de Cargas", cnpj: "22.333.444/0001-11",
    sede: "Guarulhos, SP", clienteDesde: 2015, receitaAnual: 76000000,
    contato: { nome: "Diego Almeida", cargo: "Diretor Financeiro", email: "diego.almeida@transcarga.com.br", telefone: "(11) 2401-3300" },
    healthScore: 51, healthTrend: "down",
    healthFactors: [
      { label: "Sem contato há 40 dias", weight: 28, trend: "down" },
      { label: "NPS em queda moderada", weight: 24, trend: "down" },
      { label: "Aumento de frota sinalizado", weight: 26, trend: "up" },
      { label: "Ciclo de caixa apertado no setor", weight: 22, trend: "stable" }
    ],
    risk: "attention", potential: "médio", relationship: "neutro", priority: 71,
    lastContactDays: 40,
    nps: { score: 45, trend: "down", delta: -6 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Cartão Corporativo"],
    timeline: [
      { period: "Março", title: "Plano de ampliação de frota", text: "Cliente sinalizou intenção de ampliar frota de caminhões nos próximos meses.", sentiment: "positive", source: "E-mail do cliente" },
      { period: "Junho", title: "Ciclo de recebíveis apertado", text: "Cliente mencionou dificuldade de caixa por prazo longo de recebimento de fretes.", sentiment: "negative", source: "Nota de reunião — Camila Nogueira" }
    ],
    opportunities: [
      { id: "o09", product: "Antecipação de Recebíveis", probabilityPct: 58, impact: 420000, stage: "Em contato", justification: "Ciclo de caixa apertado por prazo de recebimento de fretes torna a antecipação de recebíveis altamente relevante.", origin: { type: "visita_tecnica", label: "Visita técnica às operações" } }
    ],
    planning: {
      objectives: [
        {
          title: "Estruturar antecipação de recebíveis", due: 15,
          stage: "primeira_reuniao", plannedPct: 20,
          aiAnalysis: "Visita técnica às operações confirmou o ciclo de caixa apertado relatado pelo cliente; tratativa em estágio inicial.",
          recommendation: "Agendar apresentação formal do produto de antecipação de recebíveis.",
          timeline: [
            { period: "Junho", title: "Ciclo de recebíveis apertado relatado", text: "Cliente mencionou dificuldade de caixa por prazo longo de recebimento de fretes.", sentiment: "negative", source: "Nota de reunião — Camila Nogueira" }
          ]
        }
      ],
      aiSuggestion: null,
      changes: [
        { title: "Novo plano de ampliação de frota sinalizado", detectedAt: "Março", impact: "Aumenta o potencial de médio prazo do cliente, mas o ciclo de caixa apertado ainda é o fator limitante imediato.", affectedObjectives: ["Estruturar antecipação de recebíveis"], recommendation: "Priorizar a antecipação de recebíveis antes de oferecer produtos de expansão de frota." }
      ]
    }
  },
  {
    id: "c13", name: "Grupo Mirante Educacional", segment: "Corporate",
    setor: "Educação", cnpj: "33.444.555/0001-22",
    sede: "Fortaleza, CE", clienteDesde: 2012, receitaAnual: 210000000,
    contato: { nome: "Cecília Bastos", cargo: "CFO", email: "cecilia.bastos@grupomirante.com.br", telefone: "(85) 3261-4400" },
    healthScore: 77, healthTrend: "stable",
    healthFactors: [
      { label: "Pagamentos sempre em dia", weight: 28, trend: "stable" },
      { label: "Contato recente", weight: 24, trend: "up" },
      { label: "NPS estável em bom patamar", weight: 26, trend: "stable" },
      { label: "Baixa exploração de produtos de proteção", weight: 22, trend: "stable" }
    ],
    risk: "stable", potential: "médio", relationship: "forte", priority: 33,
    lastContactDays: 9,
    nps: { score: 79, trend: "stable", delta: 2 },
    delinquency: null,
    products: ["Conta Corrente PJ", "Capital de Giro"],
    timeline: [
      { period: "Fevereiro", title: "Abertura de novo campus", text: "Cliente inaugurou novo campus, ampliando necessidade de produtos de proteção patrimonial.", sentiment: "positive", source: "E-mail do cliente" },
      { period: "Maio", title: "Reunião de relacionamento trimestral", text: "Conversa produtiva sobre planos de expansão para os próximos dois anos.", sentiment: "positive", source: "Registro de reunião por voz" }
    ],
    opportunities: [
      { id: "o10", product: "Consórcio + Seguro de Vida Empresarial", probabilityPct: 52, impact: 300000, stage: "Proposta", justification: "Abertura de novo campus e crescimento de headcount aumentam aderência a produtos de proteção corporativa.", origin: { type: "teams", label: "Conversa no Teams" } }
    ],
    planning: {
      objectives: [
        {
          title: "Ampliar produtos de proteção patrimonial", due: 35,
          stage: "proposta", plannedPct: 45,
          aiAnalysis: "Conversa no Teams avançou rapidamente para uma proposta formal, impulsionada pela abertura do novo campus.",
          recommendation: "Fechar a proposta de consórcio e seguro de vida empresarial ainda este trimestre.",
          timeline: [
            { period: "Fevereiro", title: "Abertura de novo campus", text: "Cliente inaugurou novo campus, ampliando necessidade de produtos de proteção patrimonial.", sentiment: "positive", source: "E-mail do cliente" }
          ]
        }
      ],
      aiSuggestion: null,
      changes: [
        { title: "Nova unidade inaugurada", detectedAt: "Fevereiro", impact: "Aumenta a aderência a produtos de proteção patrimonial, acelerando o objetivo relacionado.", affectedObjectives: ["Ampliar produtos de proteção patrimonial"], recommendation: "Aproveitar o momentum para propor consórcio e seguro de vida ainda este trimestre." }
      ]
    }
  },
  {
    id: "c14", name: "Ótica Prisma Distribuidora", segment: "Middle Market",
    setor: "Distribuição — Ótica", cnpj: "44.555.666/0001-33",
    sede: "Goiânia, GO", clienteDesde: 2024, receitaAnual: 38000000,
    contato: { nome: "Rafael Coutinho", cargo: "Sócio-Diretor", email: "rafael@oticaprisma.com.br", telefone: "(62) 3251-8877" },
    healthScore: 34, healthTrend: "down",
    healthFactors: [
      { label: "Atraso em aberto há 30 dias", weight: 34, trend: "down" },
      { label: "Sem contato há 85 dias", weight: 30, trend: "down" },
      { label: "NPS crítico", weight: 26, trend: "down" },
      { label: "Histórico curto — cliente transferido recentemente", weight: 10, trend: "stable" }
    ],
    risk: "critical", potential: "baixo", relationship: "fraco", priority: 95,
    lastContactDays: 85,
    nps: { score: 22, trend: "down", delta: -14 },
    delinquency: { value: 35000, days: 30 },
    products: ["Conta Corrente PJ"],
    timeline: [
      { period: "Maio", title: "Carteira transferida para nova gerente", text: "Cliente foi realocado para a carteira de Camila Nogueira após reestruturação de equipe — histórico anterior ainda em consolidação.", sentiment: "neutral", source: "Sistema — evento de carteira" },
      { period: "Junho", title: "Atraso identificado logo após a transferência", text: "Parcela em atraso identificada já no primeiro mês da nova gestão, sem contato prévio registrado pela gerente anterior.", sentiment: "negative", source: "Sistema — evento de crédito" }
    ],
    opportunities: [],
    planning: {
      objectives: [
        {
          title: "Reconstruir relacionamento após transferência de carteira", due: -10,
          stage: "planejado", plannedPct: 40,
          aiAnalysis: "Cliente ainda não tem histórico suficiente com a nova gerente; atraso identificado logo após a transferência dificulta o primeiro contato.",
          recommendation: "Priorizar primeiro contato estruturado, reconhecendo a transição de gerente.",
          timeline: [
            { period: "Maio", title: "Carteira transferida", text: "Cliente foi realocado para a carteira de Camila Nogueira após reestruturação de equipe.", sentiment: "neutral", source: "Sistema — evento de carteira" }
          ]
        }
      ],
      aiSuggestion: "Cliente ainda não tem histórico suficiente com você para uma recomendação totalmente confiável, mas os sinais objetivos (atraso de 30 dias + 85 dias sem contato) já indicam prioridade máxima de contato.",
      suggestionContext: { originalObjective: "Reconstruir relacionamento após transferência de carteira", newInfo: "Atraso de 30 dias identificado logo após a transferência de carteira, sem contato prévio." },
      changes: [
        { title: "Cliente transferido de carteira", detectedAt: "Maio", impact: "Reduz a confiança da IA nas recomendações até que histórico suficiente seja acumulado.", affectedObjectives: ["Reconstruir relacionamento após transferência de carteira"], recommendation: "Priorizar primeiro contato estruturado nas próximas 2 semanas." }
      ]
    }
  }
];

/* ---------------------------------------------------------- */
/* Relacionamentos Estratégicos — seeds por cliente             */
/* Cada cliente recebe 2 stakeholders. O contato já cadastrado  */
/* em CLIENTS entra como stakeholder principal (enriquecido),   */
/* e um segundo stakeholder é adicionado para revelar a rede de  */
/* influência ao redor do decisor conhecido.                    */
/* ---------------------------------------------------------- */

const RELATIONSHIP_SEEDS = {
  c01: [
    {
      id: "p01", nome: "Eduardo Marins", cargo: "Diretor Financeiro", area: "Financeiro",
      tempoRelacionamentoMeses: 34, tempoEmpresaAnos: 9, celular: "(11) 98888-1150",
      relationshipScore: 58, scoreReasons: ["68 dias sem nenhuma interação direta", "Atraso de R$ 480 mil ainda em aberto"],
      influenceScore: 90, decisionRole: "Decisor financeiro", insight: "esfriando",
      lastInteractionDays: 68, lastInteractionType: "Ligação", lastInteractionSummary: "Contato para tratar do atraso de capital de giro, sem retorno desde então.",
      lastEmailDaysAgo: 40, lastEmailSubject: "Renovação da linha de capital de giro", lastMeetingDate: "12/05", lastCallDate: "04/05", avgResponseTime: "6 horas",
      nextRecommended: "Priorizar contato direto ainda esta semana, antes de qualquer nova oferta.",
      productsInterest: ["Estruturação de Dívida", "Cash Management"],
      memory: ["Mencionou, antes do atraso, que a área de câmbio demorou a responder uma solicitação — motivo da queda de NPS."],
      timeline: [
        { period: "Maio", text: "Autorizou o primeiro atraso da relação, alegando problema pontual de caixa." },
        { period: "Julho", text: "Sem retorno às tentativas de contato da equipe comercial." }
      ],
      aiSummary: "Diretor Financeiro e principal decisor das operações de crédito. Autorizou o atraso atual e não responde há 68 dias.",
      aiRecommendation: "Ligar diretamente hoje — é o caminho mais direto para reverter o risco crítico do cliente.",
      approachSeed: {
        objetivo: "Reabrir o diálogo sobre o atraso de capital de giro e apresentar a estruturação de dívida.",
        contexto: "Autorizou o atraso alegando problema pontual de caixa e não responde há 68 dias.",
        dica: "Evite cobrar o atraso na abertura. Comece perguntando sobre o impacto do problema de caixa que ele mesmo mencionou.",
        produtos: ["Estruturação de Dívida"], riscos: "Pode evitar o contato por constrangimento com o atraso.", tempo: "15 minutos", chance: "Média"
      }
    },
    {
      id: "p02", nome: "Marcos Vieira", cargo: "Gerente de Tesouraria", area: "Tesouraria",
      tempoRelacionamentoMeses: 1, tempoEmpresaAnos: 4, celular: "(11) 98888-3321",
      relationshipScore: 35, scoreReasons: ["Nenhuma interação direta registrada até o momento", "Identificado recentemente como parte do processo decisório de crédito"],
      influenceScore: 68, decisionRole: "Influenciador em crédito", insight: "novo",
      lastInteractionDays: 90, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Identificado pela IA como participante das decisões recentes de crédito, sem contato direto ainda.",
      lastEmailDaysAgo: 90, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Agendar uma apresentação inicial para construir relacionamento.",
      productsInterest: ["Cash Management"],
      memory: [],
      timeline: [{ period: "Junho", text: "Passou a participar das aprovações internas de crédito, segundo registros do cliente." }],
      aiSummary: "Nova figura identificada no processo de crédito do cliente. Ainda sem histórico de relacionamento direto.",
      aiRecommendation: "Agendar uma apresentação inicial para não deixar esse relacionamento crescer sem acompanhamento.",
      approachSeed: {
        objetivo: "Fazer uma primeira aproximação institucional.",
        contexto: "Passou a participar de decisões de crédito recentemente, sem relacionamento prévio com o banco.",
        dica: "Apresente-se e entenda o papel dele no processo, sem tratar de pendências ainda.",
        produtos: ["Cash Management"], riscos: "Pode não reconhecer a gerente como ponto de contato principal ainda.", tempo: "20 minutos", chance: "Média"
      }
    }
  ],
  c02: [
    {
      id: "p03", nome: "Marina Kolb", cargo: "CFO", area: "Financeiro",
      tempoRelacionamentoMeses: 78, tempoEmpresaAnos: 11, celular: "(41) 99025-4410",
      relationshipScore: 85, scoreReasons: ["NPS subiu 6 pontos após bom atendimento recente", "Contato frequente e recente, há 12 dias"],
      influenceScore: 88, decisionRole: "Decisora financeira", insight: "fortalecendo",
      lastInteractionDays: 12, lastInteractionType: "Reunião presencial", lastInteractionSummary: "Discutiu a expansão da linha de produção e possível necessidade futura de capital de giro.",
      lastEmailDaysAgo: 6, lastEmailSubject: "Condições da Conta Garantida", lastMeetingDate: "25/06", lastCallDate: "10/06", avgResponseTime: "3 horas",
      nextRecommended: "Aproveitar o bom momento para apresentar a Conta Garantida.",
      productsInterest: ["Conta Garantida", "Capital de Giro"],
      memory: ["Comentou que a empresa investiu em nova linha de produção e pode precisar de capital de giro adicional."],
      timeline: [
        { period: "Março", text: "Sinalizou expansão da linha de produção." },
        { period: "Junho", text: "Elogiou a agilidade na abertura de conta garantida para um fornecedor estratégico." }
      ],
      aiSummary: "CFO e decisora financeira, com relacionamento forte e em fortalecimento contínuo.",
      aiRecommendation: "Bom momento para aprofundar — aproveitar a expansão recente para apresentar novos produtos.",
      approachSeed: {
        objetivo: "Apresentar a Conta Garantida como suporte à expansão da produção.",
        contexto: "Investiu em nova linha de produção e já demonstrou abertura a novos produtos.",
        dica: "Comece perguntando como está indo a expansão antes de qualquer oferta.",
        produtos: ["Conta Garantida"], riscos: "Baixo — relacionamento já é forte.", tempo: "15 minutos", chance: "Alta"
      }
    },
    {
      id: "p04", nome: "Diego Ferraz", cargo: "Controller", area: "Controladoria",
      tempoRelacionamentoMeses: 20, tempoEmpresaAnos: 5, celular: "(41) 99025-7710",
      relationshipScore: 60, scoreReasons: ["Contato pontual, mas sempre responsivo", "Papel mais operacional que estratégico"],
      influenceScore: 45, decisionRole: "Aprovador operacional", insight: null,
      lastInteractionDays: 25, lastInteractionType: "E-mail", lastInteractionSummary: "Trocou e-mails sobre conciliação de extratos.",
      lastEmailDaysAgo: 25, lastEmailSubject: "Conciliação de extratos — fechamento mensal", lastMeetingDate: "—", lastCallDate: "02/05", avgResponseTime: "4 horas",
      nextRecommended: "Manter contato trimestral, sem urgência.",
      productsInterest: ["Cash Management"],
      memory: [],
      timeline: [{ period: "Maio", text: "Ajudou a validar dados para a renovação de conta garantida de um fornecedor." }],
      aiSummary: "Controller com papel operacional, aprova processos internos mas não decide sozinho.",
      aiRecommendation: "Manter relacionamento cordial — não é prioridade imediata.",
      approachSeed: {
        objetivo: "Alinhar o processo de conciliação e identificar outras necessidades operacionais.",
        contexto: "Já colaborou em validações anteriores.",
        dica: "Trate como uma conversa operacional, não comercial.",
        produtos: ["Cash Management"], riscos: "Baixo.", tempo: "10 minutos", chance: "Alta"
      }
    }
  ],
  c03: [
    {
      id: "p05", nome: "Ricardo Andrade", cargo: "Diretor-Presidente", area: "Presidência",
      tempoRelacionamentoMeses: 90, tempoEmpresaAnos: 14, celular: "(31) 98222-7890",
      relationshipScore: 68, scoreReasons: ["NPS caiu 9 pontos após processo de seguro garantia recusado", "Ainda é o decisor final de todas as operações relevantes"],
      influenceScore: 95, decisionRole: "Decisor final", insight: "esfriando",
      lastInteractionDays: 34, lastInteractionType: "Reunião presencial", lastInteractionSummary: "Reclamou da recusa da apólice de seguro garantia por pendência documental.",
      lastEmailDaysAgo: 20, lastEmailSubject: "Nova licitação — necessidade de garantias", lastMeetingDate: "03/06", lastCallDate: "22/05", avgResponseTime: "5 horas",
      nextRecommended: "Retomar contato mostrando que a pendência já foi resolvida.",
      productsInterest: ["Seguro Garantia"],
      memory: ["Ficou insatisfeito com a recusa do seguro garantia para a licitação."],
      timeline: [
        { period: "Janeiro", text: "Teve proposta de seguro garantia recusada por pendência documental." },
        { period: "Abril", text: "Venceu licitação pública de grande porte, ampliando necessidade de garantias." }
      ],
      aiSummary: "Diretor-Presidente e decisor final. Ficou insatisfeito com o processo de seguro garantia recusado em janeiro.",
      aiRecommendation: "Reabrir a conversa mostrando que a pendência documental já foi resolvida, antes de qualquer nova oferta.",
      approachSeed: {
        objetivo: "Reverter a percepção negativa do processo de seguro garantia e avançar a nova apólice.",
        contexto: "Teve proposta recusada por pendência documental e segue insatisfeito.",
        dica: "Reconheça a falha no processo anterior antes de apresentar a nova proposta.",
        produtos: ["Seguro Garantia"], riscos: "Pode associar a nova oferta à experiência ruim anterior.", tempo: "20 minutos", chance: "Alta"
      }
    },
    {
      id: "p06", nome: "Camila Andrade Ribeiro", cargo: "Diretora Jurídica", area: "Jurídico",
      tempoRelacionamentoMeses: 2, tempoEmpresaAnos: 7, celular: "(31) 98222-4410",
      relationshipScore: 40, scoreReasons: ["Nenhum contato direto até o momento", "Papel central na aprovação de documentos para garantias"],
      influenceScore: 55, decisionRole: "Aprovadora de documentação", insight: "novo",
      lastInteractionDays: 60, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Responsável pela documentação da licitação — ainda sem contato direto com a gerente.",
      lastEmailDaysAgo: 60, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Envolver diretamente na próxima proposta de seguro garantia para evitar nova recusa por documentação.",
      productsInterest: ["Seguro Garantia"],
      memory: [],
      timeline: [{ period: "Janeiro", text: "Responsável pela pendência documental que motivou a recusa da apólice." }],
      aiSummary: "Responsável jurídica pela documentação — foi o elo que faltou na última tentativa de seguro garantia.",
      aiRecommendation: "Incluir diretamente na próxima proposta para evitar repetir a recusa por documentação.",
      approachSeed: {
        objetivo: "Alinhar antecipadamente a documentação necessária para a nova apólice.",
        contexto: "Foi responsável pela pendência que causou a recusa anterior.",
        dica: "Trate como parceira técnica, não como obstáculo.",
        produtos: ["Seguro Garantia"], riscos: "Pode repetir os mesmos gaps documentais se não for envolvida cedo.", tempo: "15 minutos", chance: "Alta"
      }
    }
  ],
  c04: [
    {
      id: "p07", nome: "Luiza Hoffmann", cargo: "CFO", area: "Financeiro",
      tempoRelacionamentoMeses: 60, tempoEmpresaAnos: 8, celular: "(51) 99358-2200",
      relationshipScore: 88, scoreReasons: ["Alta aderência a novos produtos oferecidos", "Contato muito recente e frequente"],
      influenceScore: 90, decisionRole: "Decisora financeira", insight: "fortalecendo",
      lastInteractionDays: 5, lastInteractionType: "Registro de reunião por voz", lastInteractionSummary: "Discutiu necessidade de capital de giro adicional para sustentar o crescimento de estoque.",
      lastEmailDaysAgo: 3, lastEmailSubject: "Proposta de Capital de Giro — expansão", lastMeetingDate: "02/07", lastCallDate: "20/06", avgResponseTime: "2 horas",
      nextRecommended: "Fechar a negociação de Capital de Giro já em andamento.",
      productsInterest: ["Capital de Giro", "Previdência Corporativa"],
      memory: ["Anunciou plano de expansão da planta industrial para os próximos 18 meses."],
      timeline: [
        { period: "Fevereiro", text: "Anunciou plano de expansão da capacidade produtiva." },
        { period: "Maio", text: "Discutiu necessidade de capital de giro adicional." }
      ],
      aiSummary: "CFO decisora, com relacionamento forte e em expansão de necessidades por causa do crescimento da planta.",
      aiRecommendation: "Avançar rápido — a negociação de Capital de Giro já está madura.",
      approachSeed: {
        objetivo: "Fechar a negociação da nova linha de Capital de Giro.",
        contexto: "Expansão da planta industrial em curso, aumentando necessidade de caixa.",
        dica: "Vá direto às condições finais — ela já está convencida da necessidade.",
        produtos: ["Capital de Giro"], riscos: "Concorrência pode oferecer condições melhores se o fechamento demorar.", tempo: "15 minutos", chance: "Alta"
      }
    },
    {
      id: "p08", nome: "Rafael Kunz", cargo: "Diretor Industrial", area: "Operações",
      tempoRelacionamentoMeses: 8, tempoEmpresaAnos: 10, celular: "(51) 99358-9010",
      relationshipScore: 50, scoreReasons: ["Contato pontual, mas tecnicamente relevante para o timing da oferta", "Não participa diretamente das decisões financeiras"],
      influenceScore: 60, decisionRole: "Influenciador técnico", insight: null,
      lastInteractionDays: 40, lastInteractionType: "E-mail", lastInteractionSummary: "Trocou e-mails técnicos sobre o cronograma da expansão da planta.",
      lastEmailDaysAgo: 40, lastEmailSubject: "Cronograma da expansão — fase 2", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "1 dia",
      nextRecommended: "Incluir na próxima reunião para validar o cronograma de necessidade de caixa.",
      productsInterest: ["Capital de Giro"],
      memory: [],
      timeline: [{ period: "Fevereiro", text: "Detalhou o cronograma técnico da expansão da planta." }],
      aiSummary: "Diretor Industrial, dono do cronograma da expansão que motiva a oportunidade de crédito.",
      aiRecommendation: "Envolver para validar prazos antes de formalizar a proposta com a CFO.",
      approachSeed: {
        objetivo: "Validar o cronograma da expansão para calibrar valor e prazo da linha de crédito.",
        contexto: "Detalhou por e-mail o cronograma técnico da expansão.",
        dica: "Foque em prazos e operação, não em condições financeiras.",
        produtos: ["Capital de Giro"], riscos: "Baixo.", tempo: "10 minutos", chance: "Alta"
      }
    }
  ],
  c05: [
    {
      id: "p09", nome: "Paulo Salomão", cargo: "Diretor Financeiro", area: "Financeiro",
      tempoRelacionamentoMeses: 130, tempoEmpresaAnos: 15, celular: "(11) 98888-6600",
      relationshipScore: 25, scoreReasons: ["91 dias sem qualquer interação", "Atraso de R$ 950 mil segue em aberto há 45 dias"],
      influenceScore: 85, decisionRole: "Decisor financeiro", insight: "sem_interacao",
      lastInteractionDays: 91, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Última tentativa foi uma cobrança sobre o atraso, sem retorno.",
      lastEmailDaysAgo: 70, lastEmailSubject: "Regularização do atraso em aberto", lastMeetingDate: "—", lastCallDate: "12/04", avgResponseTime: "Sem resposta",
      nextRecommended: "Priorizar contato direto hoje — maior risco da carteira.",
      productsInterest: [],
      memory: ["Sinalizou desaceleração de dois empreendimentos por dificuldades de licenciamento."],
      timeline: [
        { period: "Dezembro", text: "Sinalizou desaceleração de obras por licenciamento." },
        { period: "Março", text: "Entrou em atraso sem retorno às tentativas de contato." }
      ],
      aiSummary: "Diretor Financeiro e decisor — maior risco de relacionamento da carteira, sem contato há 91 dias.",
      aiRecommendation: "Ligar hoje, antes de qualquer outra ação da Missão do Dia.",
      approachSeed: {
        objetivo: "Reabrir o diálogo e entender a real situação da desaceleração das obras.",
        contexto: "Sinalizou desaceleração por licenciamento antes de parar de responder.",
        dica: "Não inicie cobrando o atraso — pergunte primeiro sobre a situação dos empreendimentos.",
        produtos: [], riscos: "Alto — pode estar evitando o contato deliberadamente.", tempo: "20 minutos", chance: "Baixa"
      }
    },
    {
      id: "p10", nome: "Marina Salomão Diniz", cargo: "Sócia-Administradora", area: "Diretoria Executiva",
      tempoRelacionamentoMeses: 0, tempoEmpresaAnos: 12, celular: "(11) 98888-9920",
      relationshipScore: 20, scoreReasons: ["Nenhuma interação registrada com esta gerente", "Identificada como sócia-administradora com poder de decisão"],
      influenceScore: 80, decisionRole: "Decisora — ainda não mapeada", insight: "novo",
      lastInteractionDays: 200, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Sócia-administradora do grupo — nunca houve contato direto registrado.",
      lastEmailDaysAgo: 200, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Buscar uma via alternativa de contato, já que o Diretor Financeiro está inacessível.",
      productsInterest: [],
      memory: [],
      timeline: [{ period: "—", text: "Nenhum histórico de interação registrado até o momento." }],
      aiSummary: "Sócia-administradora do grupo, com poder de decisão, mas sem nenhum histórico de relacionamento com o banco.",
      aiRecommendation: "Usar como via alternativa de contato, já que o Diretor Financeiro está inacessível há 91 dias.",
      approachSeed: {
        objetivo: "Estabelecer o primeiro contato e entender a situação financeira do grupo.",
        contexto: "O Diretor Financeiro está inacessível há 91 dias; ela nunca foi contatada.",
        dica: "Apresente-se institucionalmente e pergunte sobre a saúde geral do negócio, sem tratar do atraso de imediato.",
        produtos: [], riscos: "Pode não ser a pessoa certa para tratar de crédito operacional.", tempo: "20 minutos", chance: "Baixa"
      }
    }
  ],
  c06: [
    {
      id: "p11", nome: "Bruno Castilho", cargo: "CEO", area: "Presidência",
      tempoRelacionamentoMeses: 48, tempoEmpresaAnos: 6, celular: "(19) 99521-9090",
      relationshipScore: 92, scoreReasons: ["NPS entre os mais altos da carteira", "Contato muito frequente e recente"],
      influenceScore: 96, decisionRole: "Decisor único", insight: "fortalecendo",
      lastInteractionDays: 3, lastInteractionType: "Registro de reunião por voz", lastInteractionSummary: "Relatou a primeira operação de câmbio para o novo contrato internacional, com boa experiência.",
      lastEmailDaysAgo: 2, lastEmailSubject: "Proposta de hedge cambial estruturado", lastMeetingDate: "05/07", lastCallDate: "28/06", avgResponseTime: "1 hora",
      nextRecommended: "Avançar a proposta de hedge cambial enquanto o entusiasmo está alto.",
      productsInterest: ["Câmbio / NDF"],
      memory: ["Fechou contrato de licenciamento de software com empresa nos EUA."],
      timeline: [
        { period: "Abril", text: "Fechou contrato internacional de licenciamento de software." },
        { period: "Junho", text: "Realizou a primeira operação de câmbio, com boa experiência." }
      ],
      aiSummary: "CEO e decisor único — relacionamento em forte crescimento após o contrato internacional.",
      aiRecommendation: "Avançar agora a proposta de hedge cambial, aproveitando a boa experiência recente.",
      approachSeed: {
        objetivo: "Formalizar a proteção cambial para o fluxo recorrente em dólar.",
        contexto: "Teve boa experiência na primeira operação de câmbio recente.",
        dica: "Reforce a boa experiência anterior antes de apresentar o hedge estruturado.",
        produtos: ["Câmbio / NDF"], riscos: "Baixo.", tempo: "15 minutos", chance: "Alta"
      }
    },
    {
      id: "p12", nome: "Patrícia Yamamoto", cargo: "CFO", area: "Financeiro",
      tempoRelacionamentoMeses: 1, tempoEmpresaAnos: 1, celular: "(19) 99521-4470",
      relationshipScore: 30, scoreReasons: ["Cargo recente — sem histórico de relacionamento", "Provável aprovadora interna de novas operações financeiras"],
      influenceScore: 70, decisionRole: "Aprovadora financeira", insight: "novo",
      lastInteractionDays: 120, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Assumiu a área financeira recentemente — ainda sem contato com a gerente.",
      lastEmailDaysAgo: 120, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Apresentar-se antes de formalizar a proposta de hedge, já que ela deve aprovar internamente.",
      productsInterest: ["Câmbio / NDF"],
      memory: [],
      timeline: [{ period: "Maio", text: "Assumiu como CFO da empresa, segundo informação pública." }],
      aiSummary: "CFO recém-chegada à empresa — ainda não tem nenhum relacionamento com o banco.",
      aiRecommendation: "Fazer a apresentação institucional antes de levar a proposta de hedge para aprovação.",
      approachSeed: {
        objetivo: "Primeira apresentação institucional à nova CFO.",
        contexto: "Assumiu o cargo recentemente e ainda não conhece o banco.",
        dica: "Foque em construir relacionamento, não em vender produtos ainda.",
        produtos: [], riscos: "Pode preferir revisar todos os fornecedores financeiros do zero.", tempo: "20 minutos", chance: "Média"
      }
    }
  ],
  c07: [
    {
      id: "p13", nome: "Sandra Cordeiro", cargo: "Sócia-Diretora", area: "Presidência",
      tempoRelacionamentoMeses: 70, tempoEmpresaAnos: 13, celular: "(81) 98223-4455",
      relationshipScore: 55, scoreReasons: ["47 dias sem contato comercial", "Baixa diversificação de produtos indica relacionamento pouco explorado"],
      influenceScore: 90, decisionRole: "Decisora única", insight: "sem_interacao",
      lastInteractionDays: 47, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Nenhum contato comercial registrado além de comunicações operacionais.",
      lastEmailDaysAgo: 47, lastEmailSubject: "Renovação de limite — conta garantida", lastMeetingDate: "—", lastCallDate: "10/04", avgResponseTime: "1 dia",
      nextRecommended: "Incluir na próxima rodada de contatos preventivos.",
      productsInterest: ["Conta Corrente PJ"],
      memory: [],
      timeline: [
        { period: "Fevereiro", text: "Renovou limite de conta garantida sem alterações relevantes." },
        { period: "Maio", text: "Sem novas interações comerciais registradas." }
      ],
      aiSummary: "Sócia-diretora e única decisora — relacionamento estável, mas sem cadência de contato recente.",
      aiRecommendation: "Retomar contato preventivo antes que o relacionamento esfrie ainda mais.",
      approachSeed: {
        objetivo: "Retomar a cadência de relacionamento trimestral.",
        contexto: "Nenhum contato comercial nos últimos meses além de itens operacionais.",
        dica: "Trate como uma visita de relacionamento, sem pauta comercial pesada.",
        produtos: ["Conta Corrente PJ"], riscos: "Baixo potencial comercial, mas o risco real é perder o cliente por desatenção.", tempo: "15 minutos", chance: "Alta"
      }
    },
    {
      id: "p14", nome: "Rogério Cordeiro", cargo: "Gerente Administrativo", area: "Controladoria",
      tempoRelacionamentoMeses: 40, tempoEmpresaAnos: 9, celular: "(81) 98223-9010",
      relationshipScore: 48, scoreReasons: ["Contato apenas operacional, sem poder de decisão comercial", "Boa via de acesso à sócia-diretora"],
      influenceScore: 40, decisionRole: "Ponte operacional", insight: null,
      lastInteractionDays: 47, lastInteractionType: "E-mail", lastInteractionSummary: "Trata assuntos operacionais de conta corrente por e-mail.",
      lastEmailDaysAgo: 47, lastEmailSubject: "Confirmação de dados cadastrais", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "3 horas",
      nextRecommended: "Usar como ponte para agendar contato com Sandra Cordeiro.",
      productsInterest: ["Conta Corrente PJ"],
      memory: [],
      timeline: [{ period: "Maio", text: "Confirmou por e-mail dados cadastrais para renovação de limite." }],
      aiSummary: "Gerente administrativo, ponte operacional útil para agendar com a sócia-diretora.",
      aiRecommendation: "Usar como canal para agendar a retomada de contato com Sandra.",
      approachSeed: {
        objetivo: "Agendar uma visita com Sandra Cordeiro através dele.",
        contexto: "É o contato mais responsivo no dia a dia da empresa.",
        dica: "Peça ajuda para encontrar um horário com a sócia-diretora.",
        produtos: [], riscos: "Baixo.", tempo: "10 minutos", chance: "Alta"
      }
    }
  ],
  c08: [
    {
      id: "p15", nome: "Antônio Vilela", cargo: "Diretor Financeiro", area: "Financeiro",
      tempoRelacionamentoMeses: 100, tempoEmpresaAnos: 12, celular: "(67) 99324-1188",
      relationshipScore: 78, scoreReasons: ["NPS em recuperação após ajuste no processo de crédito", "Sinalizou expansão de planta, aumentando engajamento"],
      influenceScore: 88, decisionRole: "Decisor financeiro", insight: "fortalecendo",
      lastInteractionDays: 18, lastInteractionType: "E-mail", lastInteractionSummary: "Sinalizou investimento em nova planta de processamento para o próximo ano.",
      lastEmailDaysAgo: 18, lastEmailSubject: "Expansão da planta — necessidade de CAPEX", lastMeetingDate: "01/06", lastCallDate: "15/05", avgResponseTime: "3 horas",
      nextRecommended: "Formalizar a apresentação da linha de Crédito CAPEX.",
      productsInterest: ["Crédito CAPEX"],
      memory: ["Reclamou anteriormente da demora na análise de crédito, mas reconheceu a melhoria depois."],
      timeline: [
        { period: "Janeiro", text: "Reclamou do tempo de resposta em uma solicitação de ampliação de limite." },
        { period: "Abril", text: "Reconheceu a melhoria após revisão do processo de crédito." }
      ],
      aiSummary: "Diretor Financeiro, relacionamento em recuperação e fortalecimento após ajuste no processo de crédito.",
      aiRecommendation: "Formalizar agora a proposta de Crédito CAPEX para a expansão da planta.",
      approachSeed: {
        objetivo: "Apresentar a estrutura de Crédito CAPEX para a expansão de planta.",
        contexto: "Sinalizou investimento em nova planta para o próximo ano.",
        dica: "Reconheça a melhoria recente no processo de crédito antes de avançar na proposta.",
        produtos: ["Crédito CAPEX"], riscos: "Ainda sensível a prazos de resposta — evite qualquer atraso na proposta.", tempo: "20 minutos", chance: "Alta"
      }
    },
    {
      id: "p16", nome: "Bianca Utsumi", cargo: "Gerente de Engenharia", area: "Operações",
      tempoRelacionamentoMeses: 0, tempoEmpresaAnos: 5, celular: "(67) 99324-7720",
      relationshipScore: 32, scoreReasons: ["Nenhum contato direto até o momento", "Responsável técnica pelo projeto que motiva a oportunidade de CAPEX"],
      influenceScore: 65, decisionRole: "Influenciadora técnica", insight: "novo",
      lastInteractionDays: 200, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Lidera o projeto da nova planta — ainda sem contato direto com o banco.",
      lastEmailDaysAgo: 200, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Envolver para detalhar o cronograma do CAPEX antes de fechar a proposta.",
      productsInterest: ["Crédito CAPEX"],
      memory: [],
      timeline: [{ period: "Junho", text: "Está estruturando o projeto técnico da nova planta de processamento." }],
      aiSummary: "Gerente de Engenharia, líder técnica do projeto de expansão que originou a oportunidade de CAPEX.",
      aiRecommendation: "Envolver para validar cronograma e valores antes de fechar a proposta com o Diretor Financeiro.",
      approachSeed: {
        objetivo: "Validar o cronograma técnico da nova planta.",
        contexto: "Lidera o projeto que motivou a oportunidade de CAPEX.",
        dica: "Trate como especialista técnica, não como decisora financeira.",
        produtos: ["Crédito CAPEX"], riscos: "Baixo.", tempo: "15 minutos", chance: "Alta"
      }
    }
  ],
  c09: [
    {
      id: "p17", nome: "Helena Duarte", cargo: "CFO", area: "Financeiro",
      tempoRelacionamentoMeses: 55, tempoEmpresaAnos: 7, celular: "(64) 99611-2233",
      relationshipScore: 50, scoreReasons: ["52 dias sem contato, padrão sazonal de atenção", "NPS em queda moderada no período"],
      influenceScore: 82, decisionRole: "Decisora financeira", insight: "esfriando",
      lastInteractionDays: 52, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Nenhuma interação desde o pico da última safra.",
      lastEmailDaysAgo: 52, lastEmailSubject: "Encerramento da linha de crédito rural da safra", lastMeetingDate: "20/04", lastCallDate: "—", avgResponseTime: "1 dia",
      nextRecommended: "Retomar contato antes da próxima janela de plantio.",
      productsInterest: ["Crédito Rural Estruturado"],
      memory: ["Utilizou linha de crédito rural para financiar compra antecipada de insumos da safra."],
      timeline: [
        { period: "Março", text: "Utilizou crédito rural para compra antecipada de insumos." },
        { period: "Junho", text: "Sem contato desde o período de safra." }
      ],
      aiSummary: "CFO decisora, relacionamento sazonal que esfria fora dos picos de safra.",
      aiRecommendation: "Retomar contato agora para não perder a janela da próxima safra.",
      approachSeed: {
        objetivo: "Antecipar a oferta de crédito rural para a próxima safra.",
        contexto: "Utilizou a linha na safra anterior e não há contato desde então.",
        dica: "Pergunte sobre o planejamento da próxima safra antes de oferecer crédito.",
        produtos: ["Crédito Rural Estruturado"], riscos: "Concorrência agrícola pode antecipar oferta similar.", tempo: "15 minutos", chance: "Média"
      }
    },
    {
      id: "p18", nome: "Tiago Duarte Meireles", cargo: "Gerente Agrícola", area: "Operações",
      tempoRelacionamentoMeses: 30, tempoEmpresaAnos: 6, celular: "(64) 99611-7790",
      relationshipScore: 45, scoreReasons: ["Contato técnico, sem poder de decisão financeira", "Boa fonte de informação sobre timing da próxima safra"],
      influenceScore: 50, decisionRole: "Influenciador técnico", insight: null,
      lastInteractionDays: 52, lastInteractionType: "E-mail", lastInteractionSummary: "Trocou e-mails sobre volumes de insumos da última safra.",
      lastEmailDaysAgo: 52, lastEmailSubject: "Volumes de insumos — safra atual", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "1 dia",
      nextRecommended: "Consultar sobre a previsão de plantio da próxima safra.",
      productsInterest: [],
      memory: [],
      timeline: [{ period: "Março", text: "Informou os volumes de insumos comprados na safra." }],
      aiSummary: "Gerente agrícola, boa fonte para antecipar o timing da próxima necessidade de crédito.",
      aiRecommendation: "Consultar antes de montar a proposta para a CFO.",
      approachSeed: {
        objetivo: "Entender a previsão de plantio da próxima safra.",
        contexto: "Acompanha diretamente o planejamento agrícola.",
        dica: "Pergunta técnica e direta sobre volumes esperados.",
        produtos: [], riscos: "Baixo.", tempo: "10 minutos", chance: "Alta"
      }
    }
  ],
  c10: [
    {
      id: "p19", nome: "Jorge Salvan", cargo: "Diretor Administrativo-Financeiro", area: "Financeiro",
      tempoRelacionamentoMeses: 60, tempoEmpresaAnos: 10, celular: "(48) 98437-5566",
      relationshipScore: 30, scoreReasons: ["73 dias sem contato", "Atraso de R$ 60 mil ainda em aberto"],
      influenceScore: 85, decisionRole: "Decisor financeiro", insight: "esfriando",
      lastInteractionDays: 73, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Não retornou contatos após o início do atraso.",
      lastEmailDaysAgo: 60, lastEmailSubject: "Regularização de parcela em atraso", lastMeetingDate: "—", lastCallDate: "01/05", avgResponseTime: "Sem resposta",
      nextRecommended: "Ação de recuperação antes de qualquer nova oferta comercial.",
      productsInterest: [],
      memory: ["Relatou retração no setor de construção civil afetando o faturamento."],
      timeline: [
        { period: "Fevereiro", text: "Relatou retração no setor afetando faturamento." },
        { period: "Maio", text: "Entrou em atraso e não retornou contatos." }
      ],
      aiSummary: "Diretor Administrativo-Financeiro, decisor único, em silêncio desde o início do atraso.",
      aiRecommendation: "Recuperar o contato antes de qualquer nova oferta comercial.",
      approachSeed: {
        objetivo: "Entender a real situação financeira e regularizar o atraso.",
        contexto: "Relatou retração do setor antes de parar de responder.",
        dica: "Demonstre entendimento do momento do setor antes de tratar do atraso.",
        produtos: [], riscos: "Baixo potencial adicional — risco de esforço desproporcional ao retorno.", tempo: "15 minutos", chance: "Baixa"
      }
    },
    {
      id: "p20", nome: "Simone Salvan", cargo: "Sócia", area: "Diretoria Executiva",
      tempoRelacionamentoMeses: 0, tempoEmpresaAnos: 10, celular: "(48) 98437-9920",
      relationshipScore: 15, scoreReasons: ["Nenhum contato direto até o momento", "Sócia com poder de decisão sobre o negócio"],
      influenceScore: 60, decisionRole: "Decisora — ainda não mapeada", insight: "novo",
      lastInteractionDays: 300, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Sócia da empresa, nunca contatada diretamente.",
      lastEmailDaysAgo: 300, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Via alternativa de contato, dado o silêncio do Diretor Financeiro.",
      productsInterest: [],
      memory: [],
      timeline: [{ period: "—", text: "Nenhum histórico de interação registrado." }],
      aiSummary: "Sócia da empresa, sem nenhum histórico de relacionamento com o banco.",
      aiRecommendation: "Tentar via alternativa de contato, já que o Diretor Financeiro está inacessível há 73 dias.",
      approachSeed: {
        objetivo: "Primeiro contato institucional.",
        contexto: "Diretor financeiro está inacessível.",
        dica: "Apresentação institucional, sem tratar do atraso de início.",
        produtos: [], riscos: "Pode não conhecer os detalhes operacionais do atraso.", tempo: "15 minutos", chance: "Baixa"
      }
    }
  ],
  c11: [
    {
      id: "p21", nome: "Fernanda Prado", cargo: "Vice-Presidente Financeira", area: "Financeiro",
      tempoRelacionamentoMeses: 190, tempoEmpresaAnos: 18, celular: "(21) 98505-7700",
      relationshipScore: 96, scoreReasons: ["Relacionamento consolidado há 16 anos", "NPS entre os mais altos da carteira"],
      influenceScore: 97, decisionRole: "Decisora estratégica", insight: "fortalecendo",
      lastInteractionDays: 2, lastInteractionType: "Registro de reunião por voz", lastInteractionSummary: "Renovou o contrato-guarda-chuva das principais operações de crédito do grupo.",
      lastEmailDaysAgo: 1, lastEmailSubject: "Próximo ciclo de investimento do grupo", lastMeetingDate: "05/07", lastCallDate: "29/06", avgResponseTime: "1 hora",
      nextRecommended: "Mapear as necessidades do próximo ciclo de investimento.",
      productsInterest: ["Seguro Empresarial", "Câmbio / NDF"],
      memory: ["Relacionamento consolidado há 16 anos com o banco."],
      timeline: [
        { period: "Janeiro", text: "Renovou o contrato-guarda-chuva do grupo." },
        { period: "Abril", text: "Venceu grande licitação de infraestrutura rodoviária." }
      ],
      aiSummary: "VP Financeira, decisora estratégica de um relacionamento de 16 anos, no mais alto nível de confiança.",
      aiRecommendation: "Manter cadência atual e já iniciar o mapeamento do próximo ciclo de investimento.",
      approachSeed: {
        objetivo: "Mapear as necessidades do próximo ciclo de investimento do grupo.",
        contexto: "Acabou de vencer grande licitação de infraestrutura, ampliando necessidade de garantias.",
        dica: "Trate como parceria estratégica de longo prazo, não como venda pontual.",
        produtos: ["Seguro Empresarial"], riscos: "Baixo — relacionamento extremamente consolidado.", tempo: "30 minutos", chance: "Alta"
      }
    },
    {
      id: "p22", nome: "Marcos Prado Neto", cargo: "Diretor de Novos Projetos", area: "Diretoria Executiva",
      tempoRelacionamentoMeses: 24, tempoEmpresaAnos: 5, celular: "(21) 98505-3320",
      relationshipScore: 70, scoreReasons: ["Boa cadência de contato, embora mais recente que Fernanda", "Papel crescente nas decisões de expansão do grupo"],
      influenceScore: 75, decisionRole: "Influenciador estratégico", insight: null,
      lastInteractionDays: 20, lastInteractionType: "Reunião presencial", lastInteractionSummary: "Apresentou o pipeline de novos projetos de infraestrutura do grupo para os próximos dois anos.",
      lastEmailDaysAgo: 15, lastEmailSubject: "Pipeline de novos projetos 2027–2028", lastMeetingDate: "15/06", lastCallDate: "—", avgResponseTime: "2 horas",
      nextRecommended: "Incluir na conversa sobre o próximo ciclo de investimento.",
      productsInterest: ["Crédito CAPEX", "Seguro Garantia"],
      memory: ["Lidera a expansão do grupo para novos contratos de infraestrutura."],
      timeline: [{ period: "Junho", text: "Apresentou o pipeline de novos projetos para os próximos dois anos." }],
      aiSummary: "Diretor de Novos Projetos, peça-chave para entender o pipeline de expansão do grupo.",
      aiRecommendation: "Envolver diretamente no mapeamento do próximo ciclo de investimento.",
      approachSeed: {
        objetivo: "Entender o pipeline de novos projetos para dimensionar necessidades futuras.",
        contexto: "Apresentou recentemente o plano de expansão para dois anos.",
        dica: "Peça detalhes do pipeline antes de sugerir produtos específicos.",
        produtos: ["Crédito CAPEX"], riscos: "Baixo.", tempo: "20 minutos", chance: "Alta"
      }
    }
  ],
  c12: [
    {
      id: "p23", nome: "Diego Almeida", cargo: "Diretor Financeiro", area: "Financeiro",
      tempoRelacionamentoMeses: 45, tempoEmpresaAnos: 8, celular: "(11) 92401-3300",
      relationshipScore: 48, scoreReasons: ["40 dias sem contato", "NPS em queda moderada"],
      influenceScore: 82, decisionRole: "Decisor financeiro", insight: "esfriando",
      lastInteractionDays: 40, lastInteractionType: "Nota de reunião", lastInteractionSummary: "Mencionou dificuldade de caixa por prazo longo de recebimento de fretes.",
      lastEmailDaysAgo: 40, lastEmailSubject: "Antecipação de recebíveis — condições", lastMeetingDate: "28/05", lastCallDate: "—", avgResponseTime: "5 horas",
      nextRecommended: "Retomar contato para avançar a antecipação de recebíveis.",
      productsInterest: ["Antecipação de Recebíveis"],
      memory: ["Sinalizou intenção de ampliar a frota de caminhões nos próximos meses."],
      timeline: [
        { period: "Março", text: "Sinalizou plano de ampliação de frota." },
        { period: "Junho", text: "Mencionou dificuldade de caixa por prazo de recebimento." }
      ],
      aiSummary: "Diretor Financeiro, decisor, com sinais de esfriamento apesar da oportunidade clara de antecipação de recebíveis.",
      aiRecommendation: "Retomar contato logo — a necessidade de caixa já foi verbalizada por ele.",
      approachSeed: {
        objetivo: "Estruturar a antecipação de recebíveis para aliviar o ciclo de caixa.",
        contexto: "Mencionou dificuldade de caixa pelo prazo longo de recebimento de fretes.",
        dica: "Comece retomando a dor de caixa que ele mesmo mencionou.",
        produtos: ["Antecipação de Recebíveis"], riscos: "Pode já estar avaliando alternativas com outro banco.", tempo: "15 minutos", chance: "Alta"
      }
    },
    {
      id: "p24", nome: "Camila Reis", cargo: "Gerente de Frota", area: "Operações",
      tempoRelacionamentoMeses: 0, tempoEmpresaAnos: 4, celular: "(11) 92401-7710",
      relationshipScore: 25, scoreReasons: ["Nenhum contato direto até o momento", "Responsável operacional pelo projeto que gera a necessidade de caixa"],
      influenceScore: 45, decisionRole: "Influenciadora operacional", insight: "novo",
      lastInteractionDays: 150, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Responsável pela ampliação de frota — ainda sem contato direto.",
      lastEmailDaysAgo: 150, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Consultar sobre o cronograma da ampliação de frota.",
      productsInterest: ["Cartão Corporativo"],
      memory: [],
      timeline: [{ period: "Março", text: "Está conduzindo o planejamento da ampliação de frota." }],
      aiSummary: "Gerente de Frota, responsável pelo projeto que está pressionando o caixa da empresa.",
      aiRecommendation: "Consultar o cronograma antes de fechar os termos da antecipação com Diego.",
      approachSeed: {
        objetivo: "Entender o cronograma de ampliação da frota.",
        contexto: "Lidera o projeto que motivou a necessidade de caixa.",
        dica: "Pergunta técnica e objetiva sobre prazos.",
        produtos: [], riscos: "Baixo.", tempo: "10 minutos", chance: "Alta"
      }
    }
  ],
  c13: [
    {
      id: "p25", nome: "Cecília Bastos", cargo: "CFO", area: "Financeiro",
      tempoRelacionamentoMeses: 65, tempoEmpresaAnos: 9, celular: "(85) 98261-4400",
      relationshipScore: 80, scoreReasons: ["Pagamentos sempre em dia", "Contato recente e relacionamento forte"],
      influenceScore: 85, decisionRole: "Decisora financeira", insight: "fortalecendo",
      lastInteractionDays: 9, lastInteractionType: "Registro de reunião por voz", lastInteractionSummary: "Conversa produtiva sobre planos de expansão para os próximos dois anos.",
      lastEmailDaysAgo: 7, lastEmailSubject: "Proteção patrimonial — novo campus", lastMeetingDate: "26/06", lastCallDate: "10/06", avgResponseTime: "2 horas",
      nextRecommended: "Avançar a proposta de proteção patrimonial para o novo campus.",
      productsInterest: ["Consórcio", "Seguro de Vida Empresarial"],
      memory: ["Inaugurou novo campus, ampliando necessidade de produtos de proteção patrimonial."],
      timeline: [
        { period: "Fevereiro", text: "Inaugurou novo campus." },
        { period: "Maio", text: "Conversou sobre planos de expansão para dois anos." }
      ],
      aiSummary: "CFO decisora, relacionamento forte, com nova necessidade gerada pela abertura do campus.",
      aiRecommendation: "Avançar a proposta de proteção patrimonial enquanto a expansão está em destaque.",
      approachSeed: {
        objetivo: "Ampliar a cobertura de proteção patrimonial para o novo campus.",
        contexto: "Inaugurou novo campus recentemente.",
        dica: "Conecte a proposta diretamente à expansão que ela mesma comentou.",
        produtos: ["Consórcio", "Seguro de Vida Empresarial"], riscos: "Baixo.", tempo: "15 minutos", chance: "Alta"
      }
    },
    {
      id: "p26", nome: "Eduardo Lima Bastos", cargo: "Diretor de Expansão", area: "Diretoria Executiva",
      tempoRelacionamentoMeses: 14, tempoEmpresaAnos: 4, celular: "(85) 98261-9010",
      relationshipScore: 58, scoreReasons: ["Contato pontual, mas estratégico para o plano de expansão", "Boa fonte para antecipar necessidades futuras"],
      influenceScore: 60, decisionRole: "Influenciador estratégico", insight: null,
      lastInteractionDays: 30, lastInteractionType: "E-mail", lastInteractionSummary: "Compartilhou o plano de abertura de novas unidades para os próximos dois anos.",
      lastEmailDaysAgo: 30, lastEmailSubject: "Plano de expansão — novas unidades", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "1 dia",
      nextRecommended: "Incluir na proposta de expansão de produtos de proteção.",
      productsInterest: ["Seguro Empresarial"],
      memory: [],
      timeline: [{ period: "Abril", text: "Compartilhou o plano de expansão de novas unidades." }],
      aiSummary: "Diretor de Expansão, dono do plano de crescimento que sustenta as novas oportunidades.",
      aiRecommendation: "Envolver na apresentação da proposta de proteção patrimonial ampliada.",
      approachSeed: {
        objetivo: "Entender o plano de abertura de novas unidades.",
        contexto: "Compartilhou recentemente o plano de expansão por e-mail.",
        dica: "Pergunte sobre prazos e localidades das novas unidades.",
        produtos: ["Seguro Empresarial"], riscos: "Baixo.", tempo: "15 minutos", chance: "Alta"
      }
    }
  ],
  c14: [
    {
      id: "p27", nome: "Rafael Coutinho", cargo: "Sócio-Diretor", area: "Presidência",
      tempoRelacionamentoMeses: 2, tempoEmpresaAnos: 8, celular: "(62) 98251-8877",
      relationshipScore: 20, scoreReasons: ["Nenhum histórico de relacionamento com a gerente atual", "85 dias sem contato e atraso em aberto"],
      influenceScore: 80, decisionRole: "Decisor único", insight: "novo",
      lastInteractionDays: 85, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Cliente foi transferido para esta carteira recentemente; nenhum contato direto ainda com a nova gerente.",
      lastEmailDaysAgo: 85, lastEmailSubject: "Nenhum e-mail trocado ainda com esta gerente.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Prioridade máxima de contato — ainda não há relacionamento construído.",
      productsInterest: ["Conta Corrente PJ"],
      memory: ["Empresa foi realocada para a carteira após reestruturação de equipe."],
      timeline: [
        { period: "Maio", text: "Carteira transferida para a nova gerente." },
        { period: "Junho", text: "Atraso identificado logo no primeiro mês da nova gestão." }
      ],
      aiSummary: "Sócio-diretor e decisor único — cliente recém-transferido, ainda sem relacionamento construído com esta gerente.",
      aiRecommendation: "Priorizar o primeiro contato, combinando apresentação institucional com a regularização do atraso.",
      approachSeed: {
        objetivo: "Fazer a primeira apresentação institucional e entender o atraso em aberto.",
        contexto: "Cliente foi transferido recentemente; não há relacionamento prévio construído com esta gerente.",
        dica: "Comece se apresentando como a nova gerente responsável, antes de tratar do atraso.",
        produtos: [], riscos: "Pode reagir mal por não ter sido contatado antes do atraso se instalar.", tempo: "20 minutos", chance: "Baixa"
      }
    },
    {
      id: "p28", nome: "Vanessa Coutinho", cargo: "Sócia", area: "Diretoria Executiva",
      tempoRelacionamentoMeses: 0, tempoEmpresaAnos: 8, celular: "(62) 98251-3320",
      relationshipScore: 15, scoreReasons: ["Nenhum contato direto até o momento", "Sócia com poder de decisão sobre o negócio"],
      influenceScore: 55, decisionRole: "Decisora — ainda não mapeada", insight: "novo",
      lastInteractionDays: 200, lastInteractionType: "Nenhuma interação registrada", lastInteractionSummary: "Sócia da empresa, sem nenhum contato registrado.",
      lastEmailDaysAgo: 200, lastEmailSubject: "Nenhum e-mail trocado ainda.", lastMeetingDate: "—", lastCallDate: "—", avgResponseTime: "—",
      nextRecommended: "Via alternativa de contato, caso Rafael não responda.",
      productsInterest: [],
      memory: [],
      timeline: [{ period: "—", text: "Nenhum histórico de interação registrado." }],
      aiSummary: "Sócia da empresa, sem nenhum histórico de relacionamento com o banco.",
      aiRecommendation: "Usar como via alternativa caso o contato principal não responda.",
      approachSeed: {
        objetivo: "Primeiro contato institucional.",
        contexto: "Nenhum relacionamento prévio com a nova gerente.",
        dica: "Apresentação institucional simples.",
        produtos: [], riscos: "Pode não estar envolvida no dia a dia financeiro.", tempo: "15 minutos", chance: "Baixa"
      }
    }
  ]
};

CLIENTS.forEach(c => {
  c.relationships = (RELATIONSHIP_SEEDS[c.id] || []).map(s => buildStakeholder(c, s));
});

/* ---------------------------------------------------------- */
/* Agenda / Reuniões                                            */
/* ---------------------------------------------------------- */

const MEETINGS = [
  {
    id: "m01", clientId: "c11", offsetDays: 0, time: "09:00", durationMin: 45, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Acompanhamento trimestral — relacionamento consolidado",
    whatChanged: ["Renovação de limite e cross-sell de seguros foi fechada com sucesso.", "Nenhuma mudança de risco identificada — cliente segue estável."],
    risks: ["Nenhum risco relevante identificado no momento."],
    suggestedProducts: [{ product: "Crédito CAPEX", justification: "Cliente de engenharia com histórico de expansão pode se beneficiar de uma linha de CAPEX para novos contratos." }],
    strategySuggestion: "Aproveite o bom momento do relacionamento para aprofundar a conversa sobre os próximos projetos de infraestrutura do cliente, sem necessidade de abordar riscos."
  },
  {
    id: "m02", clientId: "c01", offsetDays: 0, time: "11:30", durationMin: 60, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Renegociação — estruturação de dívida de longo prazo",
    whatChanged: ["Concentração de dívida de curto prazo cresceu 12% no trimestre.", "Oportunidade de Estruturação de Dívida avançou para o estágio de Proposta."],
    risks: ["Cliente crítico da carteira — o atraso pode se agravar se a estruturação não avançar."],
    suggestedProducts: [{ product: "Estruturação de Dívida", justification: "Alta aderência ao perfil de concentração de curto prazo identificado pela IA." }],
    strategySuggestion: "Priorize apresentar a proposta de estruturação de dívida logo no início da reunião, antes de qualquer outro assunto — este é o cliente de maior urgência comercial da carteira hoje."
  },
  {
    id: "m03", clientId: "c06", offsetDays: 0, time: "14:00", durationMin: 45, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Fechamento — proposta de hedge cambial",
    whatChanged: ["Proposta de Câmbio / NDF avançou para o estágio de Proposta.", "Novo contrato internacional do cliente aumentou o fluxo de recebíveis em dólar."],
    risks: ["Concorrência pode oferecer condições similares se a decisão demorar."],
    suggestedProducts: [{ product: "Cash Management", justification: "Fluxo internacional recorrente também é aderente a uma oferta de Cash Management integrado." }],
    strategySuggestion: "Leve a proposta de hedge cambial já formatada para assinatura — o cliente sinalizou abertura e o timing do novo contrato internacional é favorável."
  },
  {
    id: "m04", clientId: "c04", offsetDays: -1, time: "15:00", durationMin: 45, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "concluida", registrada: false,
    title: "Estruturação de capital de giro para expansão industrial",
    whatChanged: ["Oportunidade de Capital de Giro avançou para Negociação.", "Expansão da planta segue em curso, aumentando a necessidade de caixa."],
    risks: ["Sem registro da reunião, a IA ainda não conseguiu atualizar Planning e Timeline com o que foi discutido."],
    suggestedProducts: [{ product: "Capital de Giro", justification: "Já em negociação avançada — reforça a oferta principal desta reunião." }],
    strategySuggestion: "Registre esta reunião por voz assim que possível para que a IA capture as decisões sobre o capital de giro antes que os detalhes se percam."
  },
  {
    id: "m05", clientId: "c13", offsetDays: 1, time: "10:00", durationMin: 45, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Consórcio e seguro de vida empresarial — próximos passos",
    whatChanged: ["Abertura de novo campus aumentou o headcount da empresa.", "Oportunidade de Consórcio avançou para o estágio de Proposta."],
    risks: ["Interesse recém-demonstrado pode esfriar se a proposta demorar a avançar."],
    suggestedProducts: [{ product: "Consórcio + Seguro de Vida Empresarial", justification: "Alta aderência ao crescimento recente de headcount do cliente." }],
    strategySuggestion: "Leve a proposta de consórcio pronta para avançar — o briefing completo ainda está sendo preparado pela IA, mas os dados já indicam boa janela de decisão."
  },
  {
    id: "m06", clientId: "c08", offsetDays: -2, time: "09:30", durationMin: 45, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "concluida", registrada: true,
    title: "Estrutura de crédito CAPEX — nova planta de processamento",
    whatChanged: ["Proposta de Crédito CAPEX aguarda decisão do cliente.", "NPS em recuperação após ajuste no processo de crédito."],
    risks: ["Um novo atraso na resposta reabriria a percepção negativa recente sobre o tempo de resposta da equipe."],
    suggestedProducts: [{ product: "Crédito CAPEX", justification: "Proposta já enviada — reforço da oferta principal em andamento." }],
    strategySuggestion: "Nesta reunião já registrada, o próximo passo é aguardar a decisão do cliente sobre a proposta — evite pressionar, dado o histórico recente de sensibilidade a prazos."
  },
  {
    id: "m07", clientId: "c03", offsetDays: 2, time: "16:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Avanço da apólice de seguro garantia",
    whatChanged: ["Pendência documental que motivava a recusa anterior foi resolvida.", "Cliente pediu retorno para reabrir a proposta de seguro garantia."],
    risks: ["O compromisso de retornar contato já está em atraso — reforça a urgência desta reunião."],
    suggestedProducts: [{ product: "Seguro Garantia", justification: "Novo contrato público exige apólice de seguro garantia e a pendência documental que motivou a recusa anterior já foi resolvida." }],
    strategySuggestion: "Leve a proposta de seguro garantia já ajustada — o cliente está pedindo retorno proativamente, é uma janela de alta probabilidade de fechamento."
  },
  {
    id: "m08", clientId: "c05", offsetDays: -10, time: "09:00", durationMin: 30, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "concluida", registrada: true,
    title: "Tentativa de retomada de contato",
    whatChanged: ["Cliente foi classificado como risco severo pela IA.", "Nenhuma ação de recuperação havia sido iniciada até esta reunião."],
    risks: ["Atraso de R$ 950 mil segue em aberto — risco de deterioração adicional do relacionamento."],
    suggestedProducts: [{ product: "Capital de Giro", justification: "A regularização do atraso é pré-requisito antes de qualquer nova oferta comercial." }],
    strategySuggestion: "Priorize regularizar o atraso antes de qualquer nova oferta — este é o cliente de maior risco da carteira."
  },
  {
    id: "m09", clientId: "c02", offsetDays: -9, time: "11:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "concluida", registrada: false,
    title: "Revisão de limite de conta garantida",
    whatChanged: ["Nenhuma mudança relevante identificada desde a última interação.", "Relacionamento seguiu estável no período."],
    risks: ["A reunião ainda não foi registrada — histórico e Planning seguem desatualizados."],
    suggestedProducts: [{ product: "Conta Garantida", justification: "Baixa diversificação de produtos e expansão recente de produção indicam potencial necessidade de linha adicional." }],
    strategySuggestion: "Registre esta reunião por voz para manter o histórico deste cliente estável atualizado."
  },
  {
    id: "m10", clientId: "c09", offsetDays: -8, time: "14:30", durationMin: 45, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "concluida", registrada: true,
    title: "Planejamento de crédito rural — próxima safra",
    whatChanged: ["Padrão sazonal indicou nova necessidade de crédito rural.", "52 dias sem contato foram registrados antes desta reunião."],
    risks: ["Sem novo contato, o padrão sazonal de atenção tende a se repetir na próxima janela."],
    suggestedProducts: [{ product: "Crédito Rural Estruturado", justification: "Padrão sazonal indica nova necessidade de crédito rural na próxima janela de plantio." }],
    strategySuggestion: "Aproveite a reunião registrada para acompanhar o cronograma da próxima safra e antecipar o próximo contato antes que o padrão sazonal de silêncio se repita."
  },
  {
    id: "m11", clientId: "c07", offsetDays: -6, time: "10:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "concluida", registrada: false,
    title: "Retomada de cadência comercial",
    whatChanged: ["Nenhuma interação comercial havia sido registrada nos últimos meses.", "Cliente segue com baixa diversificação de produtos."],
    risks: ["A reunião ainda não foi registrada — a IA não conseguiu atualizar o Planning deste cliente."],
    suggestedProducts: [{ product: "Capital de Giro", justification: "Cliente possui apenas Conta Corrente PJ contratada — boa oportunidade de diversificação ainda não formalizada." }],
    strategySuggestion: "Registre esta reunião por voz para que a IA possa recomendar formalmente uma oportunidade de diversificação de produtos."
  },
  {
    id: "m12", clientId: "c14", offsetDays: -5, time: "09:00", durationMin: 30, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "concluida", registrada: true,
    title: "Primeiro contato após transferência de carteira",
    whatChanged: ["O cliente foi transferido para esta carteira recentemente.", "Um atraso de R$ 35 mil foi identificado logo após a transferência."],
    risks: ["85 dias sem contato antes desta reunião — relacionamento ainda em reconstrução."],
    suggestedProducts: [{ product: "Conta Corrente PJ", justification: "A regularização do atraso é o pré-requisito antes de qualquer oferta adicional." }],
    strategySuggestion: "Priorize reconhecer a transição de gerente e regularizar o atraso antes de qualquer nova oferta comercial."
  },
  {
    id: "m13", clientId: "c10", offsetDays: -4, time: "15:30", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "concluida", registrada: false,
    title: "Cobrança de atraso e reavaliação de limite",
    whatChanged: ["Atraso de R$ 60 mil segue em aberto há 15 dias.", "Cliente não retornou contatos desde o início do atraso."],
    risks: ["A reunião ainda não foi registrada — a IA não conseguiu atualizar o status deste atraso."],
    suggestedProducts: [{ product: "Conta Corrente PJ", justification: "Foco em regularização — sem espaço para nova oferta enquanto o atraso não for resolvido." }],
    strategySuggestion: "Registre esta reunião por voz com urgência — este é um cliente crítico e o atraso precisa ser refletido no Planning imediatamente."
  },
  {
    id: "m14", clientId: "c12", offsetDays: -3, time: "11:00", durationMin: 45, type: "Presencial", location: "Visita técnica às operações",
    calendar: "principal", status: "concluida", registrada: true,
    title: "Antecipação de recebíveis — ciclo de fretes",
    whatChanged: ["Ciclo de caixa apertado por prazo de recebimento de fretes foi identificado.", "Oportunidade de Antecipação de Recebíveis avançou para Em contato."],
    risks: ["Sem avanço rápido, o cliente pode buscar alternativa de crédito com um concorrente."],
    suggestedProducts: [{ product: "Antecipação de Recebíveis", justification: "Ciclo de caixa apertado por prazo de recebimento de fretes torna a antecipação altamente relevante." }],
    strategySuggestion: "Avance a proposta de antecipação de recebíveis rapidamente — o cliente já sinalizou a necessidade durante a visita técnica."
  },
  {
    id: "m15", clientId: "c05", offsetDays: 3, time: "10:30", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Follow-up crítico — regularização de atraso",
    whatChanged: ["Atraso de R$ 950 mil segue sem regularização.", "Ainda não há retorno do cliente desde a última tentativa de contato."],
    risks: ["Este é o cliente de maior risco da carteira — uma nova ausência de avanço pode exigir escalonamento."],
    suggestedProducts: [{ product: "Capital de Giro", justification: "Somente após a regularização do atraso uma renegociação de capital de giro pode ser considerada." }],
    strategySuggestion: "Esta é a reunião de maior prioridade da semana — trate a regularização do atraso como único objetivo, sem introduzir novos assuntos."
  },
  {
    id: "m16", clientId: "c02", offsetDays: 4, time: "09:00", durationMin: 30, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Follow-up — linha de garantia adicional",
    whatChanged: ["Nenhuma mudança relevante desde a última reunião.", "Relacionamento segue forte e estável."],
    risks: ["Nenhum risco relevante identificado no momento."],
    suggestedProducts: [{ product: "Conta Garantida", justification: "Expansão recente de produção mantém a aderência à linha de garantia adicional." }],
    strategySuggestion: "Aproveite o relacionamento forte já consolidado para formalizar a proposta de conta garantida nesta reunião."
  },
  {
    id: "m17", clientId: "c09", offsetDays: 5, time: "14:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Acompanhamento — crédito rural estruturado",
    whatChanged: ["A janela de plantio se aproxima, reforçando a sazonalidade identificada.", "Cliente segue com relacionamento neutro."],
    risks: ["O padrão sazonal de baixo contato pode se repetir se o acompanhamento não for mantido."],
    suggestedProducts: [{ product: "Crédito Rural Estruturado", justification: "A janela de plantio se aproxima, reforçando a necessidade sazonal identificada." }],
    strategySuggestion: "Aproveite a proximidade da janela de plantio para formalizar a proposta de crédito rural antes que o cliente busque outra instituição."
  },
  {
    id: "m18", clientId: "c14", offsetDays: 6, time: "11:30", durationMin: 30, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: true,
    title: "Acompanhamento pós-regularização",
    whatChanged: ["Atraso de R$ 35 mil segue em aberto.", "Relacionamento ainda em reconstrução após a transferência de carteira."],
    risks: ["Cliente ainda tem histórico curto com você — cautela ao avaliar sinais de confiança."],
    suggestedProducts: [{ product: "Conta Corrente PJ", justification: "Foco em reconstrução de relacionamento antes de qualquer nova oferta." }],
    strategySuggestion: "Use esta reunião para consolidar a confiança inicial — evite introduzir produtos novos antes de resolver o atraso em aberto."
  },
  {
    id: "m19", clientId: "c07", offsetDays: 8, time: "10:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Retomada comercial — diversificação de produtos",
    whatChanged: ["Cliente segue com apenas um produto contratado.", "A cadência de contato foi retomada na reunião anterior."],
    risks: ["O baixo potencial comercial pode limitar o interesse do cliente em novos produtos."],
    suggestedProducts: [{ product: "Capital de Giro", justification: "Produto de entrada natural para diversificar um cliente que hoje possui apenas Conta Corrente PJ." }],
    strategySuggestion: "Aprofunde a diversificação de produtos com uma oferta simples e de baixo atrito, dado o perfil mais conservador deste cliente."
  },
  {
    id: "m20", clientId: "c10", offsetDays: 9, time: "09:30", durationMin: 30, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Reavaliação de limite de crédito",
    whatChanged: ["Atraso de R$ 60 mil segue em aberto há mais tempo.", "Nenhuma resposta adicional do cliente desde a última reunião."],
    risks: ["Cliente crítico da carteira — o atraso persistente aumenta o risco de perda."],
    suggestedProducts: [{ product: "Conta Corrente PJ", justification: "Sem espaço para nova oferta até a regularização do atraso." }],
    strategySuggestion: "Trate esta reunião como última tentativa de negociação amigável antes de considerar medidas de recuperação de crédito mais formais."
  },
  {
    id: "m21", clientId: "c12", offsetDays: 11, time: "14:00", durationMin: 45, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Fechamento — antecipação de recebíveis",
    whatChanged: ["Proposta de Antecipação de Recebíveis segue no estágio Em contato.", "O ciclo de fretes do cliente continua pressionando o caixa."],
    risks: ["A concorrência pode oferecer condições similares se a decisão demorar."],
    suggestedProducts: [{ product: "Antecipação de Recebíveis", justification: "Ciclo de caixa apertado por prazo de recebimento de fretes segue sem solução formal." }],
    strategySuggestion: "Leve a proposta final de antecipação de recebíveis pronta para fechamento — o cliente já demonstrou interesse na visita técnica anterior."
  },
  {
    id: "m22", clientId: "c01", offsetDays: 13, time: "10:00", durationMin: 45, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Acompanhamento — estruturação de dívida",
    whatChanged: ["Proposta de estruturação de dívida segue em análise pelo cliente.", "Cliente segue em estado crítico da carteira."],
    risks: ["O atraso pode se agravar se a estruturação não for aprovada rapidamente."],
    suggestedProducts: [{ product: "Estruturação de Dívida", justification: "Proposta em andamento — reforço da oferta principal." }],
    strategySuggestion: "Confirme o cronograma de decisão interna do cliente para a estruturação de dívida — este cliente não pode ficar sem acompanhamento próximo."
  },
  {
    id: "m23", clientId: "c06", offsetDays: 15, time: "11:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Revisão pós-contratação do hedge cambial",
    whatChanged: ["Contrato de hedge cambial foi assinado.", "Relacionamento segue como um dos mais fortes da carteira."],
    risks: ["Nenhum risco relevante identificado no momento."],
    suggestedProducts: [{ product: "Cash Management", justification: "Bom momento para aprofundar a oferta de Cash Management dado o relacionamento forte e recém-reforçado." }],
    strategySuggestion: "Aproveite o momentum pós-contratação para apresentar a oferta de Cash Management, sem necessidade de abordar riscos."
  },
  {
    id: "m24", clientId: "c11", offsetDays: 17, time: "09:00", durationMin: 45, type: "Presencial", location: "Escritório do cliente",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Revisão semestral de relacionamento",
    whatChanged: ["Nenhuma mudança relevante identificada desde a última reunião.", "Relacionamento segue estável e consolidado."],
    risks: ["Nenhum risco relevante identificado no momento."],
    suggestedProducts: [{ product: "Crédito CAPEX", justification: "Cliente de engenharia com histórico de expansão — bom momento para uma conversa consultiva sobre CAPEX." }],
    strategySuggestion: "Use esta revisão semestral para aprofundar o relacionamento e explorar novos projetos do cliente, sem necessidade de abordar riscos."
  },
  {
    id: "m25", clientId: "c13", offsetDays: 20, time: "15:00", durationMin: 30, type: "Videochamada", location: "Videochamada — Teams",
    calendar: "principal", status: "agendada", briefingReady: false,
    title: "Fechamento — consórcio e seguro de vida",
    whatChanged: ["Proposta de consórcio segue no estágio de Proposta.", "O novo campus do cliente segue em expansão."],
    risks: ["O interesse pode esfriar se a decisão continuar sendo adiada."],
    suggestedProducts: [{ product: "Consórcio + Seguro de Vida Empresarial", justification: "Proposta já formatada — reforço para fechamento." }],
    strategySuggestion: "Leve a proposta final para assinatura — o cliente já sinalizou interesse há algumas semanas."
  },
  { id: "te01", clientId: null, offsetDays: 1, time: "09:00", durationMin: 60, type: "Presencial", location: "Sala de reuniões 4", calendar: "equipe", status: "agendada", title: "Reunião semanal de time comercial" },
  { id: "te02", clientId: null, offsetDays: -3, time: "14:00", durationMin: 90, type: "Presencial", location: "Sala de reuniões 2", calendar: "equipe", status: "concluida", title: "Comitê de crédito mensal" },
  { id: "te03", clientId: null, offsetDays: 6, time: "10:00", durationMin: 60, type: "Presencial", location: "Auditório", calendar: "equipe", status: "agendada", title: "Treinamento de produto — Hedge Cambial" },
  { id: "te04", clientId: null, offsetDays: 13, time: "15:30", durationMin: 45, type: "Videochamada", location: "Videochamada — Teams", calendar: "equipe", status: "agendada", title: "Alinhamento com Compliance" }
];

/* ---------------------------------------------------------- */
/* Feed Diário (curado)                                         */
/* ---------------------------------------------------------- */

const FEED_ITEMS = [
  { id: "f01", type: "risco", clientId: "c05", text: "Construtora Horizonte: atraso chegou a 45 dias e cliente segue sem contato há 91 dias.", isNew: true },
  { id: "f02", type: "oportunidade", clientId: "c04", text: "BioFarma Sul: nova oportunidade de Capital de Giro identificada (82% de probabilidade).", isNew: true },
  { id: "f03", type: "risco", clientId: "c14", text: "Ótica Prisma: atraso de R$ 35 mil identificado logo após a transferência de carteira.", isNew: true },
  { id: "f04", type: "contato", clientId: "c07", text: "Distribuidora Cordeiro: 47 dias sem nenhum contato comercial registrado.", isNew: true },
  { id: "f05", type: "pipeline", clientId: "c11", text: "Silva & Prado: oportunidade de renovação + cross-sell de seguros foi fechada.", isNew: false },
  { id: "f06", type: "oportunidade", clientId: "c08", text: "Frigorífico Santa Fé: identificada oportunidade de Crédito CAPEX de R$ 3,2 mi.", isNew: false },
  { id: "f07", type: "pipeline", clientId: "c06", text: "TechNova: proposta de hedge cambial avançou para a etapa de Proposta.", isNew: false },
  { id: "f08", type: "contato", clientId: "c09", text: "AgroVelo: 52 dias sem contato desde o pico da última safra.", isNew: false }
];

/* ---------------------------------------------------------- */
/* Histórico agregado de NPS da carteira (6 meses)               */
/* ---------------------------------------------------------- */

const PORTFOLIO_NPS_HISTORY = [
  { month: "Fev", score: 58 },
  { month: "Mar", score: 61 },
  { month: "Abr", score: 57 },
  { month: "Mai", score: 60 },
  { month: "Jun", score: 55 },
  { month: "Jul", score: 59 }
];

/* ---------------------------------------------------------- */
/* Funções derivadas                                             */
/* ---------------------------------------------------------- */

function getClient(id) {
  return CLIENTS.find(c => c.id === id) || CLIENTS[0];
}

function getAllOpportunities() {
  const list = [];
  CLIENTS.forEach(c => {
    (c.opportunities || []).forEach(o => list.push({ ...o, clientId: c.id, clientName: c.name }));
  });
  return list;
}

function getMeetingsSorted() {
  return [...MEETINGS].filter(m => m.calendar !== "equipe").sort((a, b) => a.offsetDays - b.offsetDays || a.time.localeCompare(b.time));
}

function getTodaysMeetings() {
  return MEETINGS.filter(m => m.offsetDays === 0 && m.calendar !== "equipe");
}

/* ---------------------------------------------------------- */
/* Agenda Inteligente (RFC-005) — funções derivadas do calendário */
/* ---------------------------------------------------------- */

/* Todos os eventos do calendário, incluindo os do calendário
   "equipe" — usado pelas visões Dia/Semana/Mês/Agenda do
   calendário. getMeetingsSorted()/getTodaysMeetings() continuam
   retornando apenas reuniões de cliente, preservando o
   comportamento already usado por home.js/agenda.js. */
function getAllCalendarEvents() {
  return [...MEETINGS].sort((a, b) => a.offsetDays - b.offsetDays || a.time.localeCompare(b.time));
}

function getMeetingsInRange(startOffset, endOffset) {
  return getAllCalendarEvents().filter(m => m.offsetDays >= startOffset && m.offsetDays <= endOffset);
}

function getMeetingParticipants(m) {
  if (!m.clientId) return [];
  const c = getClient(m.clientId);
  return (c && c.relationships) || [];
}

function meetingEndMinutes(m) {
  const [h, min] = m.time.split(":").map(Number);
  return h * 60 + min + (m.durationMin || 30);
}

/* Compara o horário real com as reuniões de hoje — detecção
   primária do Modo Reunião. A camada de UI (agenda.js) complementa
   com um controle de demonstração, já que dados fictícios raramente
   coincidem com o relógio real. */
function getNextImminentMeeting(thresholdMin = 15) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = null, bestDiff = Infinity;
  getTodaysMeetings().filter(m => m.status === "agendada").forEach(m => {
    const [h, min] = m.time.split(":").map(Number);
    const startMin = h * 60 + min;
    const diff = startMin - nowMin;
    if (diff >= -5 && diff <= thresholdMin && diff < bestDiff) { best = m; bestDiff = diff; }
  });
  return best ? { meeting: best, minutesUntil: Math.max(0, Math.round(bestDiff)) } : null;
}

function getCriticalClients() {
  return CLIENTS.filter(c => c.risk === "critical").sort((a, b) => b.priority - a.priority);
}

function getOverdueClients() {
  return CLIENTS.filter(c => c.delinquency).sort((a, b) => b.delinquency.value - a.delinquency.value);
}

function getUnattendedClients(minDays = 45) {
  return CLIENTS.filter(c => c.lastContactDays >= minDays).sort((a, b) => b.lastContactDays - a.lastContactDays);
}

function getTopOpportunities(n = 5) {
  return getAllOpportunities().sort((a, b) => (b.probabilityPct * b.impact) - (a.probabilityPct * a.impact)).slice(0, n);
}

function portfolioHealthAverage() {
  const sum = CLIENTS.reduce((acc, c) => acc + c.healthScore, 0);
  return Math.round(sum / CLIENTS.length);
}

function portfolioDelinquencyTotal() {
  return getOverdueClients().reduce((acc, c) => acc + c.delinquency.value, 0);
}

function portfolioPipelineTotal() {
  return getAllOpportunities().filter(o => o.stage !== "Perdido").reduce((acc, o) => acc + o.impact, 0);
}

function getMissionItems() {
  const overdue = getOverdueClients();
  const criticalClient = getCriticalClients()[0];
  const lateObjectivesCount = CLIENTS.reduce((acc, c) => acc + c.planning.objectives.filter(o => computeObjectiveStatus(o) === "atrasado").length, 0);
  const worstNps = [...CLIENTS].sort((a, b) => a.nps.score - b.nps.score)[0];
  const todaysMeetings = getTodaysMeetings();

  const topOpportunity = getTopOpportunities(1)[0];

  return [
    {
      id: "mi01", type: "atraso", icon: "⚠", done: false,
      title: `Recuperar cliente em atraso crítico: ${criticalClient.name}`,
      impact: `${formatCurrencyCompact(criticalClient.delinquency ? criticalClient.delinquency.value : 0)} em risco`,
      impactValue: criticalClient.delinquency ? criticalClient.delinquency.value : 0,
      link: `cliente.html?id=${criticalClient.id}`,
      clientId: criticalClient.id
    },
    {
      id: "mi02", type: "planning", icon: "📋", done: false,
      title: `Atualizar ${lateObjectivesCount} objetivos atrasados do Account Planning`,
      impact: `${lateObjectivesCount} clientes com planning desatualizado`,
      impactValue: null,
      link: "planning.html",
      clientId: null
    },
    {
      id: "mi03", type: "reuniao", icon: "🗓", done: false,
      title: `Realizar ${todaysMeetings.length} reuniões agendadas para hoje`,
      impact: "Contexto completo já preparado pela IA",
      impactValue: null,
      link: "agenda.html",
      clientId: null
    },
    {
      id: "mi04", type: "nps", icon: "📉", done: false,
      title: `Revisar NPS crítico de ${worstNps.name}`,
      impact: `NPS em ${worstNps.nps.score} pontos`,
      impactValue: null,
      link: `cliente.html?id=${worstNps.id}`,
      clientId: worstNps.id
    },
    {
      id: "mi05", type: "oportunidade", icon: "💡", done: false,
      title: "Avançar a oportunidade de maior impacto do pipeline",
      impact: formatCurrencyCompact(topOpportunity.impact) + " de potencial",
      impactValue: topOpportunity.impact,
      link: "pipeline.html",
      clientId: topOpportunity.clientId
    }
  ];
}

/* Impacto real agregado — soma o que cada item da Missão do Dia
   efetivamente representa, em vez de um texto genérico fixo. */
function getMissionImpactSummary() {
  const items = getMissionItems();
  const lateObjectivesCount = CLIENTS.reduce((acc, c) => acc + c.planning.objectives.filter(o => computeObjectiveStatus(o) === "atrasado").length, 0);
  const todaysMeetings = getTodaysMeetings();
  const totalMonetary = items.reduce((acc, i) => acc + (i.impactValue || 0), 0);

  return `${formatCurrencyCompact(totalMonetary)} de impacto financeiro direto, ${lateObjectivesCount} objetivos de Planning regularizados e ${todaysMeetings.length} reuniões realizadas com contexto completo.`;
}

/* Assistente Proativo — sugestões que a IA traz sem que o gerente
   precise perguntar (crm.md, item 12): lembrar follow-up, sugerir
   visita, atualizar Planning, avisar mudança importante. */
function getProactiveSuggestions() {
  const unattended = getUnattendedClients(45);
  const lateObjectiveClient = CLIENTS.find(c => c.planning.objectives.some(o => computeObjectiveStatus(o) === "atrasado") && c.risk !== "critical");
  const npsDrop = [...CLIENTS].filter(c => c.nps.delta <= -8).sort((a, b) => a.nps.delta - b.nps.delta)[0];
  const visitCandidate = unattended.find(c => c.relationship !== "forte");

  const suggestions = [];
  if (unattended[1]) {
    suggestions.push({
      id: "ps01", icon: "📞",
      text: `Lembrete de follow-up: ${unattended[1].name} está há ${unattended[1].lastContactDays} dias sem contato.`,
      link: `cliente.html?id=${unattended[1].id}`
    });
  }
  if (visitCandidate) {
    suggestions.push({
      id: "ps02", icon: "🧭",
      text: `Sugestão de visita: o relacionamento com ${visitCandidate.name} está neutro/fraco e sem contato recente — uma visita presencial pode ajudar.`,
      link: `cliente.html?id=${visitCandidate.id}`
    });
  }
  if (lateObjectiveClient) {
    suggestions.push({
      id: "ps03", icon: "📋",
      text: `Account Planning de ${lateObjectiveClient.name} tem objetivo atrasado — vale revisar antes do próximo contato.`,
      link: `cliente.html?id=${lateObjectiveClient.id}`
    });
  }
  if (npsDrop) {
    suggestions.push({
      id: "ps04", icon: "⚠",
      text: `Mudança importante: o NPS de ${npsDrop.name} caiu ${Math.abs(npsDrop.nps.delta)} pontos recentemente.`,
      link: `cliente.html?id=${npsDrop.id}`
    });
  }
  const imminent = getNextImminentMeeting(15);
  if (imminent) {
    suggestions.push({
      id: "ps05-" + imminent.meeting.id, icon: "🗓",
      text: `Modo Reunião: sua reunião com ${getClient(imminent.meeting.clientId).name} começa em ${imminent.minutesUntil} min — a IA já preparou o contexto completo.`,
      link: "agenda.html"
    });
  }
  return suggestions;
}

/* ---------------------------------------------------------- */
/* Compromissos (RFC-003)                                       */
/* Promessas assumidas com o cliente, identificadas pela IA a   */
/* partir de reuniões, e-mails e conversas no Teams.            */
/* ---------------------------------------------------------- */

const COMMITMENT_IMPACT_LABEL = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

const COMMITMENT_CONCLUDE_OPTIONS = [
  { id: "confirmou", label: "Cliente confirmou recebimento" },
  { id: "positivo", label: "Cliente respondeu positivamente" },
  {
    id: "nova_reuniao", label: "Cliente solicitou nova reunião",
    followUp: (c) => ({ title: `Agendar reunião com ${getClient(c.clientId).contato.nome}`, dueOffsetDays: 5, impact: c.impact })
  },
  {
    id: "novos_materiais", label: "Cliente pediu novos materiais",
    followUp: (c) => ({ title: `Enviar novos materiais solicitados por ${getClient(c.clientId).name}`, dueOffsetDays: 2, impact: c.impact })
  },
  { id: "sem_resposta", label: "Sem resposta" },
  { id: "outro", label: "Outro" }
];

const COMMITMENTS = [
  {
    id: "co01", clientId: "c05", title: "Enviar apresentação do Corporate Plus",
    dueOffsetDays: -2, impact: "alto", responsavel: "Rodrigo Lima",
    origin: { type: "reuniao", label: "Reunião realizada em 05/07" },
    aiSummary: "Identifiquei durante a reunião que foi assumido o compromisso de enviar a apresentação comercial até sexta-feira.",
    detail: {
      resumoInteracao: "Durante a reunião trimestral, o cliente pediu uma apresentação detalhada do produto Corporate Plus para avaliar internamente antes da próxima renovação de limite.",
      participantes: ["Rodrigo Lima", "Paulo Salomão (Diretor Financeiro)"],
      historico: "Nenhum outro compromisso em aberto com este cliente no momento.",
      impactoRelacionamento: "Cliente crítico da carteira, já com 91 dias sem contato anterior — o não cumprimento reforça a percepção de descaso.",
      riscos: "Atraso adicional pode comprometer a tentativa de retomada de relacionamento já em andamento com este cliente."
    }
  },
  {
    id: "co02", clientId: "c01", title: "Enviar simulação de estruturação de dívida",
    dueOffsetDays: 0, impact: "alto", responsavel: MANAGER.name,
    origin: { type: "email", label: "E-mail recebido" },
    aiSummary: "O cliente perguntou por e-mail: \"Vocês podem enviar uma simulação até sexta?\" — registrei o compromisso com prazo para hoje.",
    detail: {
      resumoInteracao: "Eduardo Marins solicitou por e-mail uma simulação de estruturação de dívida de longo prazo para reduzir a concentração de curto prazo identificada pela IA.",
      participantes: ["Eduardo Marins (Diretor Financeiro)"],
      historico: "Compromisso relacionado à oportunidade de Estruturação de Dívida já identificada no pipeline.",
      impactoRelacionamento: "Cliente em estado crítico com atraso em aberto — resposta rápida ajuda a demonstrar atenção durante um momento sensível.",
      riscos: "Sem a simulação hoje, o cliente pode adiar a decisão para o próximo ciclo orçamentário."
    }
  },
  {
    id: "co03", clientId: "c11", title: "Retomar contato em 30 dias",
    dueOffsetDays: 6, impact: "medio", responsavel: MANAGER.name,
    origin: { type: "reuniao", label: "Reunião realizada em 01/07" },
    aiSummary: "Ao final da reunião ficou combinado: \"Voltamos a conversar daqui a 30 dias.\" — criei o compromisso com o prazo indicado.",
    detail: {
      resumoInteracao: "Reunião de acompanhamento sobre o próximo ciclo de investimento. Fernanda Prado sugeriu retomar a conversa em um mês, quando o orçamento estiver mais definido.",
      participantes: ["Fernanda Prado (Vice-Presidente Financeira)"],
      historico: "Relacionamento consolidado há 16 anos, sem pendências em aberto.",
      impactoRelacionamento: "Cliente estratégico e de baixo risco — cumprir o prazo combinado mantém a cadência de confiança já estabelecida.",
      riscos: "Baixo risco imediato, mas atrasar o retorno pode fazer a IA perder o momento certo do ciclo de investimento do cliente."
    }
  },
  {
    id: "co04", clientId: "c04", title: "Enviar apresentação do produto Capital de Giro",
    dueOffsetDays: 1, impact: "alto", responsavel: MANAGER.name,
    origin: { type: "teams", label: "Conversa no Teams" },
    aiSummary: "No Teams, o cliente pediu: \"Pode me enviar a apresentação do produto?\" — registrei o material solicitado como compromisso.",
    detail: {
      resumoInteracao: "Luiza Hoffmann pediu, pelo Teams, a apresentação comercial da linha de Capital de Giro para sustentar o crescimento de estoque da expansão industrial.",
      participantes: ["Luiza Hoffmann (CFO)"],
      historico: "Compromisso relacionado à oportunidade de Capital de Giro já em estágio de Negociação.",
      impactoRelacionamento: "Cliente saudável e em expansão — atender rápido reforça a oportunidade já bem avançada.",
      riscos: "Demora pode dar tempo para um concorrente oferecer condições concorrentes durante a expansão."
    }
  },
  {
    id: "co05", clientId: "c08", title: "Finalizar proposta de Crédito CAPEX",
    dueOffsetDays: 3, impact: "alto", responsavel: MANAGER.name,
    origin: { type: "reuniao", label: "Reunião realizada em 06/07" },
    aiSummary: "Ficou acordado em reunião: \"Vamos finalizar isso até sexta-feira.\" — criei o compromisso com o prazo combinado.",
    detail: {
      resumoInteracao: "Discussão sobre a estrutura de crédito CAPEX para a nova planta de processamento. Antônio Vilela pediu a proposta final até sexta-feira.",
      participantes: ["Antônio Vilela (Diretor Financeiro)"],
      historico: "Oportunidade de Crédito CAPEX de R$ 3,2 mi ainda no estágio Identificado.",
      impactoRelacionamento: "Cliente em recuperação de NPS após reclamação de demora — cumprir o prazo é especialmente sensível agora.",
      riscos: "Um novo atraso reabriria a percepção negativa recente sobre o tempo de resposta da equipe."
    }
  },
  {
    id: "co06", clientId: "c07", title: "Aguardar documentação para renovação de limite",
    dueOffsetDays: -5, impact: "medio", responsavel: MANAGER.name,
    origin: { type: "email", label: "E-mail recebido" },
    aiSummary: "O e-mail registrava: \"Ficamos aguardando a documentação.\" — criei o compromisso de cobrar o documento pendente.",
    detail: {
      resumoInteracao: "Renovação de limite de conta garantida parada aguardando o envio de documentação societária atualizada pelo cliente.",
      participantes: ["Sandra Cordeiro (Sócia-Diretora)"],
      historico: "Cliente já está há 47 dias sem contato comercial registrado.",
      impactoRelacionamento: "Cliente com relacionamento neutro e baixa diversificação de produtos — pendência parada reforça a distância.",
      riscos: "Sem a documentação, a renovação de limite pode expirar antes de ser formalizada."
    }
  },
  {
    id: "co07", clientId: "c13", title: "Agendar reunião com Diretor Financeiro sobre consórcio",
    dueOffsetDays: 2, impact: "medio", responsavel: MANAGER.name,
    origin: { type: "teams", label: "Conversa no Teams" },
    aiSummary: "Durante a conversa no Teams o cliente sinalizou interesse em avançar com o consórcio — registrei o próximo passo como compromisso.",
    detail: {
      resumoInteracao: "Cecília Bastos demonstrou interesse na proposta de Consórcio + Seguro de Vida Empresarial e sugeriu marcar uma reunião específica sobre o tema.",
      participantes: ["Cecília Bastos (CFO)"],
      historico: "Oportunidade relacionada em estágio de Proposta.",
      impactoRelacionamento: "Cliente estável, com relacionamento forte — boa janela para avançar a oportunidade.",
      riscos: "Adiar demais pode esfriar o interesse recém-demonstrado pelo cliente."
    }
  },
  {
    id: "co08", clientId: "c06", title: "Enviar contrato de hedge cambial revisado",
    dueOffsetDays: 0, impact: "medio", responsavel: MANAGER.name,
    origin: { type: "email", label: "E-mail recebido" },
    aiSummary: "O cliente pediu por e-mail a revisão do contrato de hedge cambial ainda hoje — registrei como compromisso com prazo para hoje.",
    detail: {
      resumoInteracao: "Bruno Castilho pediu o contrato revisado da proteção cambial para o fluxo de recebíveis do novo contrato internacional.",
      participantes: ["Bruno Castilho (CEO)"],
      historico: "Oportunidade de Câmbio / NDF em estágio de Proposta.",
      impactoRelacionamento: "Cliente com o maior Health Score da carteira — manter a agilidade já é parte do motivo do relacionamento forte.",
      riscos: "Baixo risco imediato, mas atrasos pontuais já reduziriam a percepção de agilidade que o cliente valoriza."
    }
  },
  {
    id: "co09", clientId: "c03", title: "Retornar contato sobre seguro garantia",
    dueOffsetDays: -1, impact: "alto", responsavel: MANAGER.name,
    origin: { type: "reuniao", label: "Reunião realizada em 04/07" },
    aiSummary: "Ficou combinado retornar o contato assim que a pendência documental do seguro garantia fosse resolvida — o prazo já venceu.",
    detail: {
      resumoInteracao: "Ricardo Andrade resolveu a pendência documental que havia motivado a recusa anterior da apólice e pediu retorno para reabrir a proposta.",
      participantes: ["Ricardo Andrade (Diretor-Presidente)"],
      historico: "Oportunidade de Seguro Garantia com 78% de probabilidade, ligada ao novo contrato público vencido pelo cliente.",
      impactoRelacionamento: "Cliente já insatisfeito com o processo anterior — um segundo atraso pode comprometer a oportunidade de vez.",
      riscos: "Perder o prazo do processo licitatório do cliente, que exige a apólice para seguir com a obra."
    }
  }
];

function getCommitmentDoneMap() {
  return JSON.parse(localStorage.getItem("crm-commitments-done") || "{}");
}
function setCommitmentDone(id, outcomeId) {
  const map = getCommitmentDoneMap();
  map[id] = outcomeId;
  localStorage.setItem("crm-commitments-done", JSON.stringify(map));
}

function getExtraCommitments() {
  return JSON.parse(localStorage.getItem("crm-commitments-extra") || "[]");
}
function addExtraCommitment(commitment) {
  const list = getExtraCommitments();
  list.push(commitment);
  localStorage.setItem("crm-commitments-extra", JSON.stringify(list));
}

function getAllCommitmentsRaw() {
  return [...COMMITMENTS, ...getExtraCommitments()];
}

/* A IA calcula o status comparando o prazo (dueOffsetDays, relativo a
   hoje) com a data atual e com a conclusão registrada — não é um
   rótulo fixo no dado, assim como computeObjectiveStatus(). */
function commitmentBucket(c) {
  if (getCommitmentDoneMap()[c.id]) return "concluido";
  if (c.dueOffsetDays < 0) return "atrasado";
  if (c.dueOffsetDays === 0) return "hoje";
  if (c.dueOffsetDays <= 3) return "prox3";
  if (c.dueOffsetDays <= 7) return "semana";
  return "futuro";
}

function getCommitments() {
  const done = getCommitmentDoneMap();
  return getAllCommitmentsRaw().map(c => ({ ...c, bucket: commitmentBucket(c), done: !!done[c.id] }));
}

function concludeCommitment(id, outcomeId) {
  setCommitmentDone(id, outcomeId);
  const option = COMMITMENT_CONCLUDE_OPTIONS.find(o => o.id === outcomeId);
  const source = getAllCommitmentsRaw().find(c => c.id === id);
  if (option && option.followUp && source) {
    const followUp = option.followUp(source);
    addExtraCommitment({
      id: "co-fu-" + Date.now(),
      clientId: source.clientId,
      title: followUp.title,
      dueOffsetDays: followUp.dueOffsetDays,
      impact: followUp.impact,
      responsavel: source.responsavel,
      origin: { type: "reuniao", label: `Gerado automaticamente após concluir "${source.title}"` },
      aiSummary: `Criei este novo compromisso porque, ao concluir "${source.title}", você indicou: "${option.label}".`,
      detail: {
        resumoInteracao: `Compromisso gerado automaticamente a partir da conclusão de "${source.title}".`,
        participantes: source.detail.participantes,
        historico: `Compromisso anterior concluído com o desfecho: ${option.label}.`,
        impactoRelacionamento: source.detail.impactoRelacionamento,
        riscos: "Ainda não avaliado — compromisso recém-criado pela IA."
      }
    });
  }
}

function generateBriefing() {
  const critical = getCriticalClients();
  const meetings = getTodaysMeetings();
  const opportunities = getTopOpportunities(1)[0];
  return `Bom dia, ${MANAGER.name.split(" ")[0]}. Você tem ${meetings.length} reuniões hoje, todas já com briefing preparado. `
    + `${critical.length} clientes estão em estado crítico — o mais urgente é ${critical[0].name}, com atraso de ${formatCurrencyCompact(critical[0].delinquency.value)} há ${critical[0].delinquency.days} dias. `
    + `Identifiquei uma nova oportunidade de ${opportunities.product} em ${opportunities.clientName}, com ${opportunities.probabilityPct}% de probabilidade e impacto estimado de ${formatCurrencyCompact(opportunities.impact)}.`;
}
