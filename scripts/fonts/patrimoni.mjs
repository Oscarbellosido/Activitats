// Font: Agenda del Patrimoni Cultural (patrimoni.gencat.cat) — Generalitat
// Visites guiades, portes obertes, tallers i activitats a museus i monuments de tot Catalunya.
// No té dades obertes: es llegeix l'HTML.
//  - Les pàgines del llistat (?page=N) donen els enllaços de totes les activitats.
//  - El mapa de la primera pàgina (Drupal.settings.gmap) dona les coordenades.
//  - Cada fitxa (/ca/activitat/...) dona dates, municipi, horari, preu, públic, tipus, descripció, foto i entrades.
// Les fitxes ja llegides es guarden a data/cache-patrimoni.json: cada dia només es llegeixen les noves
// (i les velles es refresquen de mica en mica). Es respecta el "Crawl-delay: 10" del seu robots.txt.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { textNet, analitzaPreu, espera, baixa, fiRaonable } from '../comu.mjs';

export const nom = 'patrimoni';
export const etiqueta = 'Agenda del Patrimoni Cultural (Generalitat)';

const WEB = 'https://patrimoni.gencat.cat';
const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'cache-patrimoni.json');
const PAUSA = Number(process.env.PAUSA_PATRIMONI ?? 10_000);
const MAX_PAGINES = 60;
const MAX_FITXES_NOVES = 220;   // per execució (la resta, l'endemà)
const MAX_REFRESCS = 25;        // fitxes ja conegudes que es tornen a llegir cada dia
const DIES_REFRESC = 10;

const TIPUS = {
  'visita guiada': 'Rutes i visites', 'visita teatralitzada': 'Teatre', 'portes obertes': 'Portes obertes',
  'conferència, curs': 'Conferències', 'espectacle': 'Teatre', 'taller': 'Cursos i tallers', 'exposició': 'Exposicions',
  'fira, festa popular': 'Festes', 'activitat virtual': 'Virtuals', 'altres': 'Patrimoni',
};

let darrera = 0;
async function pàgina(url) {
  const falta = darrera + PAUSA - Date.now();
  if (falta > 0) await espera(falta);
  try { return await baixa(url, { tipus: 'html', intents: 3 }); } finally { darrera = Date.now(); }
}

const absolut = u => !u ? '' : u.startsWith('//') ? 'https:' + u : u.startsWith('/') ? WEB + u : u;
const dataISO = s => { const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

// Coordenades i lloc des del mapa de la pàgina principal
function marcadors(html) {
  const out = new Map();
  const m = html.match(/jQuery\.extend\(Drupal\.settings,\s*(\{[\s\S]*?\})\);\s*<\/script>/);
  if (!m) return out;
  try {
    const s = JSON.parse(m[1]);
    for (const mk of s.gmap?.main_map?.markers || []) {
      const slug = (mk.text.match(/href="\/ca\/activitat\/([^"]+)"/) || [])[1];
      if (slug) out.set(slug, { lat: Number(mk.latitude) || null, lon: Number(mk.longitude) || null });
    }
  } catch { /* format canviat: sense coordenades */ }
  return out;
}

function llegeixFitxa(html) {
  const bloc = (html.match(/<div id="event-scrollable"[\s\S]*?<\/div>\s*<\/div>\s*<div class="col-sm-8/) || [html])[0];
  const camp = etiq => {
    const m = bloc.match(new RegExp(`<label>${etiq}:?<\\/label>\\s*([\\s\\S]*?)<\\/div>`, 'i'));
    return m ? textNet(m[1].replace(/<\/span>\s*,\s*<span>/g, ', ')) : '';
  };
  // Descripció: els <div> sense etiqueta del bloc
  const desc = [...bloc.matchAll(/<div>(?!\s*<label)([\s\S]*?)<\/div>/g)].map(m => textNet(m[1])).filter(t => t.length > 20).join(' ');
  return {
    titol: textNet((bloc.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1]),
    inici: dataISO(camp("Data d'inici")),
    fi: dataISO(camp('Data de fi') || camp('Data final') || camp("Data d'acabament")),
    espai: camp('Localització'),
    municipi: camp('Municipi'),
    horari: camp('Horari'),
    preu: camp('Preu'),
    public: camp('Audiència'),
    tipus: camp("Tipus d'activitat"),
    desc: textNet(desc, 600),
    img: absolut((html.match(/<img class="agenda-main-photo" src="([^"]+)"/) || [])[1]),
    entrades: textNet((html.match(/buy-ticket[^"]*">\s*<a href="([^"]+)"/) || [])[1]) ||
      textNet((bloc.match(/<a target\s*="_blank" href="([^"]+)" class="more">/) || [])[1]),
  };
}

export async function baixaFont(avui, límit) {
  let cache = {};
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { /* primera vegada */ }

  // 1. Llistat: tots els enllaços de fitxes (i coordenades del mapa)
  const slugs = new Map(); // slug → miniatura
  let coords = new Map();
  let darreraPàgina = 0;
  for (let p = 0; p <= Math.min(darreraPàgina, MAX_PAGINES); p++) {
    const html = await pàgina(`${WEB}/ca/agenda${p ? `?page=${p}` : ''}`);
    if (p === 0) {
      coords = marcadors(html);
      darreraPàgina = Math.max(0, ...[...html.matchAll(/agenda\?page=(\d+)/g)].map(m => Number(m[1])));
    }
    // Només els enllaços de la llista (amb miniatura); els del mapa ja hi surten
    for (const m of html.matchAll(/<a href="\/ca\/activitat\/([^"#?]+)">\s*<img src="([^"]+)"/g)) if (!slugs.has(m[1])) slugs.set(m[1], absolut(m[2]));
  }
  for (const slug of coords.keys()) if (!slugs.has(slug)) slugs.set(slug, '');
  if (!slugs.size) throw new Error("L'agenda del Patrimoni ha canviat el format (no es troben activitats)");
  console.log(`    Patrimoni: ${slugs.size} activitats al llistat, ${coords.size} amb coordenades`);

  // 2. Fitxes: les noves primer; després refresca les més antigues
  const noves = [...slugs.keys()].filter(s => !cache[s]);
  const velles = [...slugs.keys()].filter(s => cache[s] && cache[s].llegida < sumaDiesISO(avui, -DIES_REFRESC))
    .sort((a, b) => cache[a].llegida.localeCompare(cache[b].llegida));
  const aLlegir = [...noves.slice(0, MAX_FITXES_NOVES), ...velles.slice(0, MAX_REFRESCS)];
  let errors = 0;
  for (const slug of aLlegir) {
    try {
      const f = llegeixFitxa(await pàgina(`${WEB}/ca/activitat/${slug}`));
      if (f.titol) cache[slug] = { ...f, llegida: avui };
    } catch { if (++errors > 15) break; }
  }
  if (noves.length > MAX_FITXES_NOVES) console.log(`    Patrimoni: queden ${noves.length - MAX_FITXES_NOVES} fitxes per llegir demà`);

  // Neteja la memòria: fora les que ja no surten al llistat i han passat
  for (const s of Object.keys(cache)) if (!slugs.has(s) && (cache[s].fi || cache[s].inici) < avui) delete cache[s];
  await writeFile(CACHE, JSON.stringify(cache));

  // 3. Activitats
  const resultat = [];
  for (const [slug, mini] of slugs) {
    const f = cache[slug];
    if (!f || !f.inici) continue;
    const fi = fiRaonable(f.inici, f.fi || f.inici);
    if (fi < avui || f.inici > límit) continue;
    const tipus = f.tipus.toLowerCase();
    const cats = new Set(Object.entries(TIPUS).filter(([k]) => tipus.includes(k)).map(([, c]) => c));
    if (!cats.size) cats.add('Patrimoni');
    if (/famíl/i.test(f.public)) cats.add('Infantil');
    const c = coords.get(slug) || {};
    resultat.push({
      id: `pat-${slug}`,
      titol: f.titol,
      subtitol: '',
      desc: f.desc,
      inici: f.inici,
      fi,
      horari: f.horari,
      categories: [...cats],
      ...analitzaPreu(f.preu),
      provincia: '', // es completa per municipi o proximitat a actualitza.mjs
      comarca: '',
      municipi: f.municipi,
      espai: f.espai,
      adreca: '',
      lat: c.lat ?? null,
      lon: c.lon ?? null,
      img: f.img || mini,
      url: `${WEB}/ca/activitat/${slug}`,
      entradesUrl: f.entrades,
      virtual: /virtual/i.test(f.tipus) ? 'En línia' : '',
    });
  }
  return resultat;
}

function sumaDiesISO(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
