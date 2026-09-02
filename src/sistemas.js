/**
 * ═══════════════════════════════════════════════════════════════════
 *  SISTEMAS — os SaaS que usam o TECNOINCUBADORA AI.
 *  Cada entrada tem o seu próprio login (credenciais do respetivo
 *  sistema). `apiPath` liga ao módulo backend; `implementado:false`
 *  marca os que ainda não têm integração ativa.
 * ═══════════════════════════════════════════════════════════════════
 */
export const SISTEMAS = [
  { slug: 'brokerhub',     nome: 'BrokerHubMZ',      emoji: '📈', desc: 'SaaS multi-tenant para corretoras (CRM, pipeline, deals, financeiro)', implementado: true, apiPath: '/api/brokerhub', url: 'https://brokerhubmz-sable.vercel.app' },
  { slug: 'hefelgym',      nome: 'HefelGym',         emoji: '🏋️', desc: 'Gestão de ginásios',                                              implementado: true, apiPath: '/api/gym' },
  { slug: 'gymar',         nome: 'GYMAR',            emoji: '💪', desc: 'Gestão de ginásios',                                              implementado: true, apiPath: '/api/gym' },
  { slug: 'xonguile',      nome: 'XONGUILE APP',     emoji: '💇', desc: 'Gestão de salões de beleza',                                      implementado: true, apiPath: '/api/xonguile' },
  { slug: 'gestorfarma',   nome: 'GESTORFARMA',      emoji: '💊', desc: 'Gestão de farmácias',                                             implementado: true, apiPath: '/api/farmacia' },
  { slug: 'adegahub',      nome: 'ADEGAHUB',         emoji: '🍷', desc: 'Gestão de bottle stores / adegas',                                implementado: true, apiPath: '/api/adegahub' },
  { slug: 'cafepoint',     nome: 'CAFÉPOINT',        emoji: '☕', desc: 'Gestão de restaurantes e cafés',                                  implementado: true, apiPath: '/api/cafepoint' },
  { slug: 'minahub',       nome: 'MINAHUB',          emoji: '⛏️', desc: 'Gestão de operações de mineração',                                implementado: false },
  { slug: 'smartschool',   nome: 'SmartschoolMZ',    emoji: '🎓', desc: 'Gestão escolar',                                                  implementado: true, apiPath: '/api/smartschool', url: 'https://smartschoolmz.vercel.app' },
  { slug: 'credhub',       nome: 'CredHubMZ',        emoji: '🏦', desc: 'Microcrédito / microfinanças',                                    implementado: true, apiPath: '/api/credhub' },
  { slug: 'entregasmoz',   nome: 'EntregasMOZ',      emoji: '🛵', desc: 'Gestão de entregas / delivery',                                   implementado: true, apiPath: '/api/entregas' },
  { slug: 'machambapro',   nome: 'MachambaPro',      emoji: '🌾', desc: 'Gestão de produtores / agricultura',                             implementado: true, apiPath: '/api/machamba' },
  { slug: 'ddgei',         nome: 'DDGEI',            emoji: '⚙️', desc: 'Gestão de equipamentos e materiais',                            implementado: true, apiPath: '/api/ddgei' },
  { slug: 'wms',           nome: 'Smart Warehouse WMS', emoji: '📦', desc: 'Sistema de armazém (standalone)',                             implementado: true, apiPath: '/api/armazem' }
];

export function sistemaPorSlug(slug) {
  return SISTEMAS.find(s => s.slug === slug) || null;
}
