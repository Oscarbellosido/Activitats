// Utilitats compartides per totes les fonts

export const DIES_ENDAVANT = 180; // activitats que comencen com a molt d'aquí a 6 mesos
export const UA = 'Mozilla/5.0 (compatible; ActivitatsCatalunya/1.0; +https://github.com/Oscarbellosido/Activitats)';

export const sumaDies = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const espera = ms => new Promise(r => setTimeout(r, ms));

export const PROVINCIES = { barcelona: 'Barcelona', girona: 'Girona', lleida: 'Lleida', tarragona: 'Tarragona' };
export const PROVINCIA_PER_CP = { '08': 'Barcelona', '17': 'Girona', '25': 'Lleida', '43': 'Tarragona' };

export const COMARQUES = {
  'alt-camp': 'Alt Camp', 'alt-emporda': 'Alt Empordà', 'alt-penedes': 'Alt Penedès', 'alt-urgell': 'Alt Urgell',
  'alta-ribagorca': 'Alta Ribagorça', 'anoia': 'Anoia', 'aran': 'Aran', 'val-d-aran': 'Aran', 'bages': 'Bages',
  'baix-camp': 'Baix Camp', 'baix-ebre': 'Baix Ebre', 'baix-emporda': 'Baix Empordà', 'baix-llobregat': 'Baix Llobregat',
  'baix-penedes': 'Baix Penedès', 'barcelones': 'Barcelonès', 'bergueda': 'Berguedà', 'cerdanya': 'Cerdanya',
  'conca-de-barbera': 'Conca de Barberà', 'garraf': 'Garraf', 'garrigues': 'Garrigues', 'les-garrigues': 'Garrigues',
  'garrotxa': 'Garrotxa', 'girones': 'Gironès', 'maresme': 'Maresme', 'moianes': 'Moianès',
  'montsia': 'Montsià', 'noguera': 'Noguera', 'osona': 'Osona', 'pallars-jussa': 'Pallars Jussà',
  'pallars-sobira': 'Pallars Sobirà', 'pla-d-urgell': "Pla d'Urgell", 'pla-de-l-estany': "Pla de l'Estany",
  'priorat': 'Priorat', 'ribera-d-ebre': "Ribera d'Ebre", 'ripolles': 'Ripollès', 'segarra': 'Segarra',
  'segria': 'Segrià', 'selva': 'Selva', 'solsones': 'Solsonès', 'tarragones': 'Tarragonès', 'terra-alta': 'Terra Alta',
  'urgell': 'Urgell', 'valles-occidental': 'Vallès Occidental', 'valles-oriental': 'Vallès Oriental',
  'llucanes': 'Lluçanès',
};

const PETITES = new Set(['de', 'del', 'dels', 'la', 'les', 'el', 'els', 'i', 'a']);
export const humanitza = slug => String(slug || '').replace(/[-_]/g, ' ').replace(/\b(d|l) (?=[a-zàèéíòóú])/gi, "$1'").trim()
  .split(' ').map((w, i) => (i > 0 && PETITES.has(w)) ? w
    : w.replace(/^([dl]')?(.)/i, (m, ap, c) => (ap ? ap.toLowerCase() : '') + c.toUpperCase())).join(' ');

export function textNet(s, max) {
  if (!s) return '';
  let t = String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();
  if (max && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

// Preu a partir d'un text lliure ("Preus: de 6 a 18 €", "Entrada lliure", "Gratuït")
// gratuitDeclarat: la font ho diu explícitament; textExtra: descripció on buscar "gratuït" si no hi ha preu
export function analitzaPreu(textPreu, { gratuitDeclarat = false, textExtra = '' } = {}) {
  const entrades = textNet(textPreu, 160);
  const reGratis = /\bgratu[iï]t|entrada lliure|acc[eé]s lliure|\bgratis\b|lliure fins a exhaurir|sense cost/i;
  const nums = [...entrades.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/gi)]
    .map(m => Number(m[1].replace(',', '.'))).filter(n => n > 0 && n < 2000);
  const gratuit = gratuitDeclarat || (nums.length === 0 && (reGratis.test(entrades) || reGratis.test(textNet(textExtra))));
  return {
    gratuit,
    preuMin: gratuit ? 0 : (nums.length ? Math.min(...nums) : null),
    preuMax: gratuit ? 0 : (nums.length ? Math.max(...nums) : null),
    preuText: entrades.replace(/^Preus?:?\s*/i, ''),
  };
}

// Dates: "2026-10-26 17:00:00" → { dia: '2026-10-26', hora: '17:00' }
export function partData(s) {
  const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return { dia: '', hora: '' };
  return { dia: m[1], hora: m[2] && !(m[2] === '00' && m[3] === '00') ? `${m[2]}:${m[3]}` : '' };
}

// Corregeix dates de fi absurdes (p. ex. any 5202) o anteriors a l'inici
export function fiRaonable(inici, fi) {
  if (!fi || fi < inici) return inici;
  if (Number(fi.slice(0, 4)) > Number(inici.slice(0, 4)) + 2) return inici;
  return fi;
}

// Fetch amb reintents
export async function baixa(url, { tipus = 'json', intents = 4, capçaleres = {} } = {}) {
  let darrer;
  for (let i = 1; i <= intents; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: tipus === 'json' ? 'application/json' : 'text/html', ...capçaleres } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return tipus === 'json' ? await r.json() : await r.text();
    } catch (e) { darrer = e; if (i < intents) await espera(4000 * i); }
  }
  throw new Error(`${url.slice(0, 90)}… → ${darrer.message}`);
}

// Clau per detectar la mateixa activitat publicada a dues fonts
export const clauDuplicat = a => `${a.inici}|${String(a.municipi || '').toLowerCase()}|${a.titol.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40)}`;

// Paraules clau → categories de l'app (per a fonts que no fan servir les mateixes categories)
const MAPA = [
  [/concert|m[uú]sica|recital|coral|cobla|orquestra/i, 'Concerts'], [/teatr|espectacle|monòleg|titelles|pallass/i, 'Teatre'], [/dansa|\bball/i, 'Dansa'],
  [/exposici|\bexpo\b/i, 'Exposicions'], [/conte|infantil|familiar|en fam[ií]lia|nadó|nens|nenes|activitats familiars/i, 'Infantil'],
  [/club de lectura|presentaci[oó] de(l)? llibre|lectura|poesia|literari|tert[uú]lia|literatura/i, 'Literatura'],
  [/taller|\bcurs|formaci|aula de/i, 'Cursos i tallers'], [/xerrada|confer[eè]ncia|col·loqui|jornad|debat/i, 'Conferències'],
  [/projecci|cinema|cinef|pel·l[ií]cula/i, 'Cinema'], [/fira|mercat/i, 'Fires i mercats'], [/festa|tradici|cultura popular|carnaval|castells|gegants/i, 'Festes'],
  [/visit|ruta|senderisme|excursi|itinerari|patrimoni|paisatges|passejada/i, 'Rutes i visites'], [/festival/i, 'Festivals'],
  [/gastron[oò]m|\btast|degustaci/i, 'Gastronomia'], [/esport|cursa|bicicleta|caminada/i, 'Esports'], [/videojoc|digital|robòtica/i, 'Cultura digital'],
  [/natura|parc natural|ocells|bolets|bosc|medi ambient/i, 'Natura'],
];
export function categoritza(textos, perDefecte = 'Altres') {
  const cats = new Set();
  for (const t of [].concat(textos).map(x => String(x || ''))) for (const [re, c] of MAPA) if (re.test(t)) cats.add(c);
  if (!cats.size) cats.add(perDefecte);
  return [...cats].slice(0, 4);
}
