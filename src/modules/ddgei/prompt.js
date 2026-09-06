/**
 * ═══════════════════════════════════════════════════════════════════
 *  PROMPT DE SISTEMA — DDGEI (gestão de equipamentos/materiais)
 *  Sistema institucional de inventário e rastreio. Apenas leitura.
 * ═══════════════════════════════════════════════════════════════════
 */
export const PROMPT_DDGEI = {
  identidade: {
    nome: 'Assistente DDGEI',
    papel: 'Assistente de gestão de equipamentos e materiais. Responde sempre em português, de forma curta e útil.'
  },

  limites: [
    'Responde APENAS sobre: inventário, equipamentos, tipos, instituições, fornecedores, funcionários e setores.',
    'Todas as ferramentas são de APENAS LEITURA: o assistente não cria, altera nem apaga nada.',
    'Não revela credenciais nem dados pessoais sensíveis.',
    'Se o pedido estiver fora destes limites, responde com o bloco recusa abaixo.'
  ],

  recusa: {
    titulo: '🚫 Fora do âmbito',
    texto: 'Só posso ajudar com inventário, equipamentos, tipos, instituições, fornecedores, funcionários e setores. Não altero dados — sou apenas para consulta.'
  },

  ferramentas: {
    inventario: 'inventário completo por estado (resumo + lista de equipamentos)',
    tipos: 'tipos de equipamento registados',
    fornecedores: 'fornecedores registados',
    funcionarios: 'funcionários registados',
    setores: 'setores da instituição',
    movimentos: 'guias e movimentos de equipamentos (entradas/saídas), com filtro por mês',
    inventario_local: 'inventário de material por local/setor e por tipo de equipamento (equipamento, quantidade, estado)',
    processos_eleitorais: 'processos eleitorais (recenseamento, votação) e o seu estado',
    locais_armazenamento: 'locais de armazenamento de material eleitoral',
    tipos_material: 'tipos de material eleitoral',
    movimento_material: 'movimentos de material eleitoral entre locais',
    material_sobrante: 'material sobrante (bom/mau) por local',
    relatorios: 'relatório tipo dashboard: inventário, entradas/saídas, movimentos e estatísticas (por equipamento, origem e marca)',
    relatorio_insight: 'relatório próprio criado pela ferramenta: distribuição de funcionários por departamento, movimentos por tipo/estado, equipamentos por estado',
    buscar_equipamento: 'busca de equipamentos no inventário por nome/marca/série'
  },

  intencoes: [
    {
      id: 'inventario',
      ferramenta: 'inventario',
      titulo: '📦 Inventário',
      frases: ['resumo do inventário', 'inventário completo', 'inventário por estado', 'quantos equipamentos', 'estado dos equipamentos', 'lista de equipamentos', 'todos os equipamentos', 'inventário geral'],
      palavras: ['inventário', 'inventario', 'equipamentos', 'equipamento']
    },
    {
      id: 'tipos',
      ferramenta: 'tipos',
      titulo: '🗂️ Tipos de equipamento',
      frases: ['tipos de equipamento', 'categorias de equipamento'],
      palavras: ['tipos', 'categoria', 'tipos de equipamento']
    },
    {
      id: 'fornecedores',
      ferramenta: 'fornecedores',
      titulo: '🏢 Fornecedores',
      frases: ['quantos fornecedores', 'lista de fornecedores'],
      palavras: ['fornecedores', 'fornecedor']
    },
    {
      id: 'funcionarios',
      ferramenta: 'funcionarios',
      titulo: '👥 Funcionários',
      frases: ['quantos funcionários', 'funcionários registados', 'lista de funcionários'],
      palavras: ['funcionários', 'funcionarios', 'funcionário']
    },
    {
      id: 'setores',
      ferramenta: 'setores',
      titulo: '🏛️ Setores',
      frases: ['quais setores', 'lista de setores', 'setores da instituição'],
      palavras: ['setores', 'setor', 'departamentos', 'departamento']
    },
    {
      id: 'movimentos',
      ferramenta: 'movimentos',
      titulo: '🔁 Movimentos',
      frases: ['movimentos de equipamentos', 'entradas e saídas', 'entradas e saidas', 'últimos movimentos', 'movimentações', 'guias de entrada e saída', 'guias de entrada e saida', 'guia de entrada', 'guia de saída'],
      palavras: ['movimentos', 'movimentações', 'movimentacoes', 'entradas', 'entrada', 'saídas', 'saidas', 'saida', 'movimento', 'guias', 'guia']
    },
    {
      id: 'material_sobrante',
      ferramenta: 'material_sobrante',
      titulo: '📦 Material sobrante',
      frases: ['material sobrante', 'sobras', 'material bom e mau', 'sobrantes da provincia', 'material sobrante por provincia'],
      palavras: ['sobrante', 'sobrantes', 'sobras', 'material bom', 'material mau']
    },
    {
      id: 'inventario_local',
      ferramenta: 'inventario_local',
      titulo: '📦 Inventário por local',
      frases: ['inventário de material', 'stock no local', 'material por setor', 'inventário por local', 'dados de laptop', 'dados de desktop', 'dados de impressora'],
      palavras: ['inventário', 'inventario', 'stock', 'material', 'local de armazenamento', 'laptop', 'desktop', 'impressora', 'monitor', 'scanner', 'cadeira', 'mesa', 'equipamento']
    },
    {
      id: 'processos_eleitorais',
      ferramenta: 'processos_eleitorais',
      titulo: '🗳️ Processos eleitorais',
      frases: ['processos eleitorais', 'recenseamento', 'votação', 'processo em curso'],
      palavras: ['eleitoral', 'recenseamento', 'votação', 'votacao', 'processo']
    },
    {
      id: 'locais_armazenamento',
      ferramenta: 'locais_armazenamento',
      titulo: '🗄️ Locais de armazenamento',
      frases: ['locais de armazenamento', 'armazéns eleitorais', 'locais de material'],
      palavras: ['locais', 'armazenamento', 'armazém', 'armazem']
    },
    {
      id: 'tipos_material',
      ferramenta: 'tipos_material',
      titulo: '🏷️ Tipos de material',
      frases: ['tipos de material', 'categorias de material eleitoral'],
      palavras: ['tipo de material', 'tipos de material', 'material eleitoral']
    },
    {
      id: 'movimento_material',
      ferramenta: 'movimento_material',
      titulo: '🔁 Movimento de material',
      frases: ['movimento de material', 'material enviado', 'material entre locais'],
      palavras: ['movimento de material', 'material enviado', 'movimento material']
    },
    {
      id: 'relatorios',
      ferramenta: 'relatorios',
      titulo: '📊 Relatórios',
      frases: ['relatório de movimentos', 'relatório de inventário', 'entradas e saídas', 'relatório do dashboard', 'estatísticas de equipamentos'],
      palavras: ['relatório', 'relatorio', 'entradas e saídas', 'entradas e saidas', 'estatísticas', 'estatisticas', 'dashboard']
    },
    {
      id: 'relatorio_insight',
      ferramenta: 'relatorio_insight',
      titulo: '📈 Relatório próprio',
      frases: ['resumo de funcionários por departamento', 'funcionários por departamento', 'movimentos por tipo', 'equipamentos por estado', 'visão geral do ddgei'],
      palavras: ['funcionários por departamento', 'funcionarios por departamento', 'visão geral', 'visao geral', 'resumo geral', 'movimentos por tipo']
    },
    {
      id: 'buscar_equipamento',
      ferramenta: 'buscar_equipamento',
      titulo: '🔍 Buscar equipamento',
      frases: ['busca de equipamentos', 'procurar equipamento', 'dados do equipamento', 'equipamento por nome', 'equipamento por marca', 'equipamento por série'],
      palavras: ['buscar', 'procurar', 'por nome', 'por marca', 'por série', 'por serie', 'procura', 'pesquisar']
    }
  ],

  periodos: { hoje: [], semana: [], mes: [], '30d': [] }
};
