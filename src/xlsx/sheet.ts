import JSZip from 'jszip';

// Leitura e escrita mínima de .xlsx direto no XML, para não perder
// formatação, fórmulas e gráficos da planilha original.

export interface Celula {
  valor: string | number | null;
  formula: string | null;
}

export interface Aba {
  caminho: string;
  doc: Document;
  celulas: Map<string, Celula>;
}

export interface Pasta {
  zip: JSZip;
  abas: Map<string, Aba>; // pelo nome da aba
  workbook: Document;
}

const parser = () => new DOMParser();

export function colParaNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numParaCol(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function separarRef(ref: string): { col: string; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error('Referência inválida: ' + ref);
  return { col: m[1], row: Number(m[2]) };
}

function filhos(el: Element, nome: string): Element[] {
  return Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === nome);
}

function textoDe(el: Element): string {
  return Array.from(el.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
}

export async function abrir(buf: ArrayBuffer | Uint8Array): Promise<Pasta> {
  const zip = await JSZip.loadAsync(buf);
  const ler = async (p: string) => {
    const f = zip.file(p);
    if (!f) throw new Error('Arquivo não parece uma planilha .xlsx (faltou ' + p + ')');
    return f.async('string');
  };
  const workbook = parser().parseFromString(await ler('xl/workbook.xml'), 'application/xml');
  const rels = parser().parseFromString(await ler('xl/_rels/workbook.xml.rels'), 'application/xml');
  const alvos = new Map<string, string>();
  for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
    const alvo = r.getAttribute('Target') ?? '';
    alvos.set(r.getAttribute('Id') ?? '', alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo);
  }

  const strings: string[] = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) {
    const doc = parser().parseFromString(await ss.async('string'), 'application/xml');
    for (const si of Array.from(doc.documentElement.childNodes)) {
      if (si.nodeType === 1 && (si as Element).localName === 'si') strings.push(textoDe(si as Element));
    }
  }

  const abas = new Map<string, Aba>();
  for (const s of Array.from(workbook.getElementsByTagName('sheet'))) {
    const id = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    const caminho = alvos.get(id);
    if (!caminho) continue;
    const doc = parser().parseFromString(await ler(caminho), 'application/xml');
    const celulas = new Map<string, Celula>();
    for (const c of Array.from(doc.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      if (!ref) continue;
      const t = c.getAttribute('t');
      const v = filhos(c, 'v')[0]?.textContent ?? null;
      const f = filhos(c, 'f')[0]?.textContent ?? null;
      let valor: string | number | null = null;
      if (t === 's' && v !== null) valor = strings[Number(v)] ?? '';
      else if (t === 'inlineStr') valor = filhos(c, 'is')[0] ? textoDe(filhos(c, 'is')[0]) : '';
      else if (t === 'str' || t === 'e') valor = v;
      else if (v !== null && v !== '') valor = Number(v);
      celulas.set(ref, { valor, formula: f });
    }
    abas.set(s.getAttribute('name') ?? caminho, { caminho, doc, celulas });
  }
  return { zip, abas, workbook };
}

export function acharAba(p: Pasta, prefixo: string): Aba {
  for (const [nome, aba] of p.abas) if (nome.toUpperCase().startsWith(prefixo)) return aba;
  throw new Error(`A planilha não tem a aba ${prefixo}. Use a planilha de controle da Estratégia.`);
}

export function texto(aba: Aba, ref: string): string {
  const v = aba.celulas.get(ref)?.valor;
  return v === null || v === undefined ? '' : String(v).trim();
}

export function numero(aba: Aba, ref: string): number | null {
  const v = aba.celulas.get(ref)?.valor;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v.replace(',', '.')))) return Number(v.replace(',', '.'));
  return null;
}

export function linhas(aba: Aba): number[] {
  const set = new Set<number>();
  for (const ref of aba.celulas.keys()) set.add(separarRef(ref).row);
  return [...set].sort((a, b) => a - b);
}

// Escreve um valor numa célula, criando linha e célula se faltar.
// Mantém o estilo (atributo s); null apaga o valor.
export function escrever(aba: Aba, ref: string, valor: string | number | null) {
  const doc = aba.doc;
  const ns = doc.documentElement.namespaceURI;
  const sheetData = doc.getElementsByTagName('sheetData')[0];
  const { col, row } = separarRef(ref);

  let linha = filhos(sheetData, 'row').find((r) => Number(r.getAttribute('r')) === row);
  if (!linha) {
    linha = doc.createElementNS(ns, 'row');
    linha.setAttribute('r', String(row));
    const depois = filhos(sheetData, 'row').find((r) => Number(r.getAttribute('r')) > row);
    sheetData.insertBefore(linha, depois ?? null);
  }
  linha.removeAttribute('spans');

  let cel = filhos(linha, 'c').find((c) => c.getAttribute('r') === ref);
  if (!cel) {
    if (valor === null) return;
    cel = doc.createElementNS(ns, 'c');
    cel.setAttribute('r', ref);
    const n = colParaNum(col);
    const depois = filhos(linha, 'c').find((c) => colParaNum(separarRef(c.getAttribute('r') ?? 'A1').col) > n);
    linha.insertBefore(cel, depois ?? null);
  }
  for (const k of [...filhos(cel, 'v'), ...filhos(cel, 'is'), ...filhos(cel, 'f')]) cel.removeChild(k);
  cel.removeAttribute('t');
  if (typeof valor === 'number') {
    const v = doc.createElementNS(ns, 'v');
    v.textContent = String(valor);
    cel.appendChild(v);
  } else if (typeof valor === 'string') {
    cel.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(ns, 'is');
    const t = doc.createElementNS(ns, 't');
    t.textContent = valor;
    is.appendChild(t);
    cel.appendChild(is);
  }
  aba.celulas.set(ref, { valor, formula: null });
}

export async function gerar(p: Pasta): Promise<Uint8Array> {
  const s = new XMLSerializer();
  // Pede ao Excel/Sheets para recalcular as fórmulas ao abrir.
  const wb = p.workbook;
  let calc = wb.getElementsByTagName('calcPr')[0];
  if (!calc) {
    calc = wb.createElementNS(wb.documentElement.namespaceURI, 'calcPr');
    wb.documentElement.appendChild(calc);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  p.zip.file('xl/workbook.xml', s.serializeToString(wb));
  for (const aba of p.abas.values()) p.zip.file(aba.caminho, s.serializeToString(aba.doc));
  return p.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
