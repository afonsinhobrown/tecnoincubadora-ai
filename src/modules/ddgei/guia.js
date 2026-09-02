/**
 * Gera um PDF "Ficha de Movimento de Equipamento" a partir de um movimento
 * da BD DDGEI (imita a ficha STAE). Retorna um Buffer para download.
 */
import PDFDocument from 'pdfkit';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DDGEI_DATABASE_URL);

export async function gerarGuiaPdf(guia) {
  // busca o movimento completo + nomes de setores/funcionários
  const m = await sql(`
    SELECT m.*, s_o.nome AS setor_origem_nome, s_d.nome AS setor_destino_nome
    FROM movimentos m
    LEFT JOIN setores s_o ON s_o.id = m.setor_origem_id
    LEFT JOIN setores s_d ON s_d.id = m.setor_destino_id
    WHERE m.guia = $1 LIMIT 1
  `, [guia]);
  if (!m[0]) return null;
  const r = m[0];

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const terminou = new Promise(resolve => doc.on('end', resolve));

  const W = 595; // A4 width points
  const cx = s => doc.widthOfString(s, { width: 200 });

  doc.font('Helvetica-Bold', 13).text('MOVIMENTO DE EQUIPAMENTO INFORMÁTICO', { align: 'center' });
  doc.font('Helvetica', 10).text('STAE — Secretariado Técnico de Administração Eleitoral', { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold', 12).text('Ficha de Controlo', { align: 'center' });
  doc.moveDown(1);

  const linhas = [
    ['Guia', r.guia || '—'],
    ['Tipo', r.tipo || '—'],
    ['Equipamento', `${r.equipamento || ''}${r.marca ? ' — ' + r.marca : ''}`],
    ['Nº de Série', r.numero_serie || '—'],
    ['Origem', r.origem_destino || r.setor_origem_nome || r.local_origem || '—'],
    ['Destino', r.setor_destino_nome || r.local_destino || '—'],
    ['Quantidade', r.quantidade || '1'],
    ['Data', r.data || '—'],
    ['Estado', r.status || r.estado_rastreio || '—'],
    ['Técnico', r.tecnico || '—'],
    ['Motivo', r.motivo || '—'],
    ['Observações', r.relatorio || r.observacoes || '—']
  ];
  linhas.forEach(([k, v]) => {
    doc.font('Helvetica-Bold', 10).text(k + ':', 50, doc.y, { continued: true, width: 120 });
    doc.font('Helvetica', 10).text(' ' + (v || '—'), { width: 430 });
  });

  doc.moveDown(1);
  doc.font('Helvetica', 9).text('Gerado pela TECNOINCUBADORA AI · ' + new Date().toLocaleString('pt-PT'), { align: 'center' });

  doc.end();
  await terminou;
  return Buffer.concat(chunks);
}
