/**
 * ═══════════════════════════════════════════════════════════════════
 *  SISTEMAS — os SaaS que usam o TECNOINCUBADORA AI.
 *  Cada entrada tem o seu próprio login (credenciais do respetivo
 *  sistema). `apiPath` liga ao módulo backend; `implementado:false`
 *  marca os que ainda não têm integração ativa.
 * ═══════════════════════════════════════════════════════════════════
 */
export const SISTEMAS = [
  { slug: 'brokerhub',     nome: 'BrokerHubMZ',      emoji: '📈', desc: 'SaaS multi-tenant para corretoras (CRM, pipeline, deals, financeiro)', implementado: true, apiPath: '/api/brokerhub', url: 'https://brokerhubmz-sable.vercel.app',
    exemplos: ['carteira de negócios', 'quantos clientes tenho', 'clientes com maior volume', 'quantos corretores', 'resumo de leads'] },
  { slug: 'hefelgym',      nome: 'HefelGym',         emoji: '🏋️', desc: 'Gestão de ginásios',                                              implementado: true, apiPath: '/api/gym',
    exemplos: ['quantos alunos tenho', 'planos mais populares', 'vendas do mês', 'produtos com estoque baixo'] },
  { slug: 'gymar',         nome: 'GYMAR',            emoji: '💪', desc: 'Gestão de ginásios',                                              implementado: true, apiPath: '/api/gym',
    exemplos: ['quantos alunos tenho', 'planos mais populares', 'vendas do mês', 'produtos com estoque baixo'] },
  { slug: 'xonguile',      nome: 'XONGUILE APP',     emoji: '💇', desc: 'Gestão de salões de beleza',                                      implementado: true, apiPath: '/api/xonguile',
    exemplos: ['faturação do mês', 'serviços mais vendidos', 'produtos a repor', 'quantos clientes tenho'] },
  { slug: 'gestorfarma',   nome: 'GESTORFARMA',      emoji: '💊', desc: 'Gestão de farmácias',                                             implementado: true, apiPath: '/api/farmacia',
    exemplos: ['quantas vendas tive hoje', 'faturação do mês', 'produtos mais vendidos', 'o que repor no estoque', 'quero comprar 2 paracetamol em dinheiro'] },
  { slug: 'adegahub',      nome: 'ADEGAHUB',         emoji: '🍷', desc: 'Gestão de bottle stores / adegas',                                implementado: true, apiPath: '/api/adegahub',
    exemplos: ['vendas de hoje', 'produtos mais vendidos', 'produtos a repor', 'quantos clientes tenho'] },
  { slug: 'cafepoint',     nome: 'CAFÉPOINT',        emoji: '☕', desc: 'Gestão de restaurantes e cafés',                                  implementado: true, apiPath: '/api/cafepoint',
    exemplos: ['vendas de hoje', 'pratos mais vendidos', 'itens a repor', 'quantos clientes tenho'] },
  { slug: 'minahub',       nome: 'MINAHUB',          emoji: '⛏️', desc: 'Gestão de operações de mineração',                                implementado: false,
    exemplos: [] },
  { slug: 'smartschool',   nome: 'SmartschoolMZ',    emoji: '🎓', desc: 'Gestão escolar',                                                  implementado: true, apiPath: '/api/smartschool', url: 'https://smartschoolmz.vercel.app',
    exemplos: ['quantos alunos tenho', 'quais turmas', 'financeiro do mês', 'propinas pagas'] },
  { slug: 'credhub',       nome: 'CredHubMZ',        emoji: '🏦', desc: 'Microcrédito / microfinanças',                                    implementado: true, apiPath: '/api/credhub',
    exemplos: ['carteira de crédito', 'quantos clientes tenho', 'clientes com maior crédito', 'pagamentos recebidos'] },
  { slug: 'entregasmoz',   nome: 'EntregasMOZ',      emoji: '🛵', desc: 'Gestão de entregas / delivery',                                   implementado: true, apiPath: '/api/entregas',
    exemplos: ['quantas encomendas hoje', 'produtos mais encomendados', 'quantos clientes tenho', 'quais lojas'] },
  { slug: 'machambapro',   nome: 'MachambaPro',      emoji: '🌾', desc: 'Gestão de produtores / agricultura',                             implementado: true, apiPath: '/api/machamba',
    exemplos: ['vendas do mês', 'produtos em estoque', 'produtos a repor', 'quantos parceiros tenho'] },
  { slug: 'ddgei',         nome: 'DDGEI',            emoji: '⚙️', desc: 'Gestão de equipamentos e materiais',                            implementado: true, apiPath: '/api/ddgei',
    exemplos: ['resumo do inventário', 'tipos de equipamento', 'quantos fornecedores', 'quantos funcionários'] },
  { slug: 'wms',           nome: 'Smart Warehouse WMS', emoji: '📦', desc: 'Sistema de armazém (standalone)',                             implementado: true, apiPath: '/api/armazem',
    exemplos: ['quantas encomendas hoje', 'faturação do mês', 'produtos mais movimentados', 'produtos a repor'] },
  { slug: 'statse',        nome: 'StatsE',            emoji: '📊', desc: 'Análise e consulta de processos eleitorais',                    implementado: true, apiPath: '/api/statse',
    exemplos: ['quantas mesas de voto existem em Gaza?', 'quantos eleitores inscritos houve em Nampula?', 'quem ganhou as autárquicas de 2018 em Maputo?', 'resultados por partido em Gaza em 2023', 'procura o local de voto EP2', 'partido vencedor por província em 2023'] }
];

export function sistemaPorSlug(slug) {
  return SISTEMAS.find(s => s.slug === slug) || null;
}
