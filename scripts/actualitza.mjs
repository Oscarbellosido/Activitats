// Activitats a Catalunya — actualització diària
// Baixa l'Agenda Cultural de Catalunya (dades obertes de la Generalitat), classifica cada activitat
// (gratuïta / preu, província, comarca, categories), marca les noves i escriu data/activitats.json.
//
//   node scripts/actualitza.mjs            → actualitza (només si avui encara no s'ha fet i són ≥ 6:00 a Catalunya)
//   node scripts/actualitza.mjs --força    → actualitza igualment
//   node scripts/actualitza.mjs --prova F  → fa servir el fitxer JSON F en lloc de l'API (proves sense xarxa)
//
// Sense dependències: Node 20 o superior.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARREL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIDA = join(ARREL, 'data', 'activitats.json');
const API = 'https://analisi.transparenciacatalunya.cat/resource/rhpv-yr4f.json';
const IMG_BASE = 'https://agenda.cultura.gencat.cat';
const DIES_ENDAVANT = 180;   // activitats que comencen com a molt d'aquí a 6 mesos
const PAGINA = 2000;
const HORA_ACTUALITZACIO = 6; // hora de Catalunya

const args = process.argv.slice(2);
const FORCA = args.includes('--força') || args.includes('--forca');
const PROVA = args.includes('--prova') ? args[args.indexOf('--prova') + 1] : null;

// ── Dates en hora de Catalunya ────────────────────────────────────────────────
function araCatalunya() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), text: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` };
}
const sumaDies = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ── Diccionaris ──────────────────────────────────────────────────────────────
const PROVINCIES = { barcelona: 'Barcelona', girona: 'Girona', lleida: 'Lleida', tarragona: 'Tarragona' };

const COMARQUES = {
  'alt-camp': 'Alt Camp', 'alt-emporda': 'Alt Empordà', 'alt-penedes': 'Alt Penedès', 'alt-urgell': 'Alt Urgell',
  'alta-ribagorca': 'Alta Ribagorça', 'anoia': 'Anoia', 'aran': 'Aran', 'val-d-aran': 'Aran', 'bages': 'Bages',
  'baix-camp': 'Baix Camp', 'baix-ebre': 'Baix Ebre', 'baix-emporda': 'Baix Empordà', 'baix-llobregat': 'Baix Llobregat',
  'baix-penedes': 'Baix Penedès', 'barcelones': 'Barcelonès', 'bergueda': 'Berguedà', 'cerdanya': 'Cerdanya',
  'conca-de-barbera': 'Conca de Barberà', 'garraf': 'Garraf', 'garrigues': 'Garrigues', 'les-garrigues': 'Garrigues',
  'garrotxa': 'Garrotxa', 'gironès': 'Gironès', 'girones': 'Gironès', 'maresme': 'Maresme', 'moianes': 'Moianès',
  'montsia': 'Montsià', 'noguera': 'Noguera', 'osona': 'Osona', 'pallars-jussa': 'Pallars Jussà',
  'pallars-sobira': 'Pallars Sobirà', 'pla-d-urgell': "Pla d'Urgell", 'pla-de-l-estany': "Pla de l'Estany",
  'priorat': 'Priorat', 'ribera-d-ebre': "Ribera d'Ebre", 'ripolles': 'Ripollès', 'segarra': 'Segarra',
  'segria': 'Segrià', 'selva': 'Selva', 'solsones': 'Solsonès', 'tarragones': 'Tarragonès', 'terra-alta': 'Terra Alta',
  'urgell': 'Urgell', 'valles-occidental': 'Vallès Occidental', 'valles-oriental': 'Vallès Oriental',
  'llucanes': 'Lluçanès',
};

const CATEGORIES = {
  'concerts': 'Concerts', 'teatre': 'Teatre', 'exposicions': 'Exposicions', 'dansa': 'Dansa', 'infantil': 'Infantil',
  'festivals-i-mostres': 'Festivals', 'opera': 'Òpera', 'circ': 'Circ', 'cicles': 'Cicles',
  'rutes-i-visites': 'Rutes i visites', 'commemoracions': 'Commemoracions', 'fires-i-mercats': 'Fires i mercats',
  'conferencies': 'Conferències', 'activitats-virtuals': 'Virtuals', 'cultura-digital': 'Cultura digital',
  'festes': 'Festes', 'magia': 'Màgia', 'cursos': 'Cursos', 'nadal': 'Nadal', 'any-gaudi': 'Any Gaudí',
  'cinema': 'Cinema', 'literatura': 'Literatura', 'sardanes': 'Sardanes', 'cultura-popular': 'Cultura popular',
};

const PETITES = new Set(['de', 'del', 'dels', 'la', 'les', 'el', 'els', 'i', 'a']);
const humanitza = slug => String(slug || '').replace(/-/g, ' ').replace(/\b(d|l) (?=[a-zàèéíòóú])/gi, "$1'").trim()
  .split(' ').map((w, i) => (i > 0 && PETITES.has(w)) ? w
    : w.replace(/^([dl]')?(.)/i, (m, ap, c) => (ap ? ap.toLowerCase() : '') + c.toUpperCase())).join(' ');

// ── Normalització d'un registre ──────────────────────────────────────────────
function textNet(s, max) {
  if (!s) return '';
  let t = String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
  if (max && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

function analitzaPreu(r) {
  const entrades = textNet(r.entrades, 160);
  const marcaGratis = /\bgratu[iï]t|entrada lliure|acc[eé]s lliure|\bgratis\b|lliure fins a exhaurir/i.test(entrades);
  const nums = [...entrades.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/gi)]
    .map(m => Number(m[1].replace(',', '.'))).filter(n => n > 0 && n < 2000);
  const gratuit = r.gratuita === 'Sí' || (marcaGratis && nums.length === 0);
  return {
    gratuit,
    preuMin: gratuit ? 0 : (nums.length ? Math.min(...nums) : null),
    preuMax: gratuit ? 0 : (nums.length ? Math.max(...nums) : null),
    preuText: entrades.replace(/^Preus?:?\s*/i, ''),
  };
}

function ubicacio(r) {
  const camí = String(r.comarca_i_municipi || r.municipi || '').split(',')[0].replace(/^agenda:ubicacions\//, '');
  let [prov, com, mun] = camí.split('/');
  // Alguns registres tenen el camí mal format (p. ex. "agenda:ubicacions/manresa"): es dedueix pel codi postal
  if (!PROVINCIES[prov]) {
    const perCP = { '08': 'barcelona', '17': 'girona', '25': 'lleida', '43': 'tarragona' }[String(r.codi_postal || '').trim().slice(0, 2)];
    if (perCP) { if (!com && prov && !/^fora/.test(prov)) mun = mun || prov; prov = perCP; }
  }
  return {
    provincia: PROVINCIES[prov] || (/^fora/.test(prov || '') ? 'Fora de Catalunya' : 'Sense ubicació'),
    comarca: com ? (COMARQUES[com] || humanitza(com)) : '',
    municipi: textNet(r.localitat) || (mun ? humanitza(mun) : ''),
  };
}

const urlImatge = p => p ? IMG_BASE + encodeURI(p.trim()) : '';

export function normalitza(r) {
  const cats = String(r.tags_categor_es || '').split(',').map(s => s.trim().replace(/^agenda:categories\//, ''))
    .filter(Boolean);
  const categories = [...new Set(cats.map(c => CATEGORIES[c] || humanitza(c)))];
  const imatge = r.imgapp || String(r.imatges || '').split(',')[0];
  const lat = Number(r.latitud), lon = Number(r.longitud);
  return {
    id: String(r.codi),
    titol: textNet(r.denominaci),
    subtitol: textNet(r.subt_tol, 160),
    desc: textNet(r.descripcio || r.descripcio_html, 600),
    inici: String(r.data_inici || '').slice(0, 10),
    fi: String(r.data_fi || r.data_inici || '').slice(0, 10),
    horari: textNet(r.horari, 200),
    categories: categories.length ? categories : ['Altres'],
    ...analitzaPreu(r),
    ...ubicacio(r),
    espai: textNet(r.espai),
    adreca: textNet(r.adre_a),
    lat: Number.isFinite(lat) && lat ? lat : null,
    lon: Number.isFinite(lon) && lon ? lon : null,
    img: urlImatge(imatge),
    url: r.urlactivitat || r.url || '',
    entradesUrl: r.linkbotoentrades || '',
    virtual: r.modalitat && r.modalitat !== 'Presencial' ? r.modalitat : '',
  };
}

// ── Descàrrega ───────────────────────────────────────────────────────────────
async function baixaTot(avui) {
  const límit = sumaDies(avui, DIES_ENDAVANT);
  const where = `data_fi >= '${avui}T00:00:00' AND data_inici <= '${límit}T23:59:59' AND (permanent IS NULL OR permanent != 'Sí')`;
  const tots = [];
  for (let offset = 0; ; offset += PAGINA) {
    const url = `${API}?$where=${encodeURIComponent(where)}&$order=codi&$limit=${PAGINA}&$offset=${offset}`;
    let resp, intents = 0;
    while (true) {
      try {
        resp = await fetch(url, { headers: { Accept: 'application/json' } });
        if (resp.ok) break;
        throw new Error(`HTTP ${resp.status}`);
      } catch (e) {
        if (++intents >= 4) throw new Error(`No s'ha pogut baixar l'agenda (${e.message})`);
        await new Promise(r => setTimeout(r, 5000 * intents));
      }
    }
    const pàgina = await resp.json();
    tots.push(...pàgina);
    if (pàgina.length < PAGINA) break;
  }
  return tots;
}

// ── Principal ────────────────────────────────────────────────────────────────
async function main() {
  const ara = araCatalunya();
  let anterior = null;
  try { anterior = JSON.parse(await readFile(SORTIDA, 'utf8')); } catch { /* primera vegada */ }

  if (!FORCA && !PROVA) {
    if (ara.hora < HORA_ACTUALITZACIO) { console.log(`Encara no són les ${HORA_ACTUALITZACIO}:00 a Catalunya (${ara.text}). No faig res.`); return; }
    if (anterior?.dia === ara.data) { console.log(`Avui (${ara.data}) ja s'ha actualitzat. No faig res.`); return; }
  }

  console.log(`Actualitzant activitats · ${ara.text} (hora de Catalunya)`);
  const crus = PROVA ? JSON.parse(await readFile(PROVA, 'utf8')) : await baixaTot(ara.data);
  console.log(`Registres baixats: ${crus.length}`);

  // Primera vegada que es veu cada activitat (per marcar les noves)
  const vistes = new Map((anterior?.activitats || []).map(a => [a.id, a.vista]));
  const primeraCàrrega = !anterior;

  const perId = new Map();
  for (const r of crus) {
    if (!r.codi || !r.denominaci) continue;
    const a = normalitza(r);
    if (!a.inici || a.fi < ara.data) continue;
    a.vista = vistes.get(a.id) || ara.data;
    perId.set(a.id, a); // l'API pot repetir el mateix codi en diverses ubicacions: ens quedem amb l'últim
  }
  // Les que no tenen ni camí ni codi postal: província i comarca de l'activitat amb ubicació més propera
  const ambLloc = [...perId.values()].filter(a => PROVINCIES[a.provincia.toLowerCase()] && a.lat != null);
  for (const a of perId.values()) {
    if (a.provincia !== 'Sense ubicació' || a.lat == null || !ambLloc.length) continue;
    let millor = null, dMin = Infinity;
    for (const b of ambLloc) { const d = (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2; if (d < dMin) { dMin = d; millor = b; } }
    if (dMin < 0.04) { a.provincia = millor.provincia; a.comarca = a.comarca || millor.comarca; } // ~20 km
  }
  const activitats = [...perId.values()].sort((x, y) => (x.inici.localeCompare(y.inici)) || x.titol.localeCompare(y.titol, 'ca'));
  const noves = primeraCàrrega ? 0 : activitats.filter(a => a.vista === ara.data).length;

  const compta = clau => activitats.reduce((m, a) => { for (const v of [].concat(a[clau])) m[v] = (m[v] || 0) + 1; return m; }, {});
  const resultat = {
    actualitzat: new Date().toISOString(),
    dia: ara.data,
    primeraCarrega: anterior?.primeraCarrega || ara.data,
    font: 'Agenda Cultural de Catalunya · Generalitat de Catalunya (dades obertes, rhpv-yr4f)',
    total: activitats.length,
    noves,
    gratuites: activitats.filter(a => a.gratuit).length,
    perProvincia: compta('provincia'),
    perCategoria: compta('categories'),
    activitats,
  };

  await mkdir(dirname(SORTIDA), { recursive: true });
  await writeFile(SORTIDA, JSON.stringify(resultat));
  console.log(`Fet: ${activitats.length} activitats (${noves} noves, ${resultat.gratuites} gratuïtes).`);
  console.log('Per província:', resultat.perProvincia);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
