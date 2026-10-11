// Activitats a Catalunya — actualització diària
// Baixa totes les fonts (scripts/fonts/*.mjs), les classifica (gratuïta / preu, província, comarca, categories),
// treu duplicats, marca les noves i escriu data/activitats.json.
//
//   node scripts/actualitza.mjs              → actualitza (només si avui encara no s'ha fet i són ≥ 6:00 a Catalunya)
//   node scripts/actualitza.mjs --forca      → actualitza igualment
//   node scripts/actualitza.mjs --nomes diba → només aquesta font (la resta es manté de l'última actualització)
//
// Sense dependències: Node 20 o superior.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sumaDies, clauDuplicat, PROVINCIES, DIES_ENDAVANT } from './comu.mjs';
import * as generalitat from './fonts/generalitat.mjs';
import * as diba from './fonts/diba.mjs';
import * as guiabcn from './fonts/guiabcn.mjs';
import * as patrimoni from './fonts/patrimoni.mjs';

// L'ordre importa: si una activitat surt a dues fonts, es queda la de la primera
const FONTS = [generalitat, patrimoni, diba, guiabcn];

const ARREL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIDA = join(ARREL, 'data', 'activitats.json');
const HORA_ACTUALITZACIO = 6; // hora de Catalunya

const args = process.argv.slice(2);
const FORCA = args.includes('--força') || args.includes('--forca');
const NOMES = args.includes('--nomes') ? args[args.indexOf('--nomes') + 1] : null;

function araCatalunya() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), text: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` };
}

// Dins de Catalunya (aprox.): per descartar activitats de fora que algunes fonts inclouen
const dinsCatalunya = a => a.lat == null || (a.lat > 40.45 && a.lat < 42.9 && a.lon > 0.1 && a.lon < 3.4);

async function main() {
  const ara = araCatalunya();
  const límit = sumaDies(ara.data, DIES_ENDAVANT);
  let anterior = null;
  try { anterior = JSON.parse(await readFile(SORTIDA, 'utf8')); } catch { /* primera vegada */ }

  if (!FORCA && !NOMES) {
    if (ara.hora < HORA_ACTUALITZACIO) { console.log(`Encara no són les ${HORA_ACTUALITZACIO}:00 a Catalunya (${ara.text}). No faig res.`); return; }
    if (anterior?.dia === ara.data) { console.log(`Avui (${ara.data}) ja s'ha actualitzat. No faig res.`); return; }
  }
  console.log(`Actualitzant activitats — ${ara.text} (hora de Catalunya)`);

  // 1. Baixa cada font. Si una falla, es reaprofiten les seves activitats de l'última actualització.
  // Totes les fonts es baixen alhora (són webs diferents i cadascuna respecta les seves pauses)
  const perFont = {}, estatFonts = {};
  await Promise.all(FONTS.map(async f => {
    const prèvies = (anterior?.activitats || []).filter(a => (a.font || 'generalitat') === f.nom && a.fi >= ara.data);
    if (NOMES && NOMES !== f.nom) { perFont[f.nom] = prèvies; estatFonts[f.nom] = anterior?.fonts?.[f.nom] || { ok: true }; return; }
    const t0 = Date.now();
    try {
      const llista = (await f.baixaFont(ara.data, límit)).map(a => ({ ...a, font: f.nom }));
      perFont[f.nom] = llista;
      estatFonts[f.nom] = { ok: true, etiqueta: f.etiqueta, activitats: llista.length, segons: Math.round((Date.now() - t0) / 1000) };
      console.log(`  ✓ ${f.etiqueta}: ${llista.length} activitats (${estatFonts[f.nom].segons} s)`);
    } catch (e) {
      perFont[f.nom] = prèvies;
      estatFonts[f.nom] = { ok: false, etiqueta: f.etiqueta, error: e.message, activitats: prèvies.length };
      console.log(`  ✗ ${f.etiqueta}: ${e.message} — es mantenen ${prèvies.length} activitats d'ahir`);
    }
  }));
  if (FONTS.every(f => !estatFonts[f.nom].ok)) throw new Error("Cap font ha funcionat: no s'actualitza res.");

  // 2. Fusiona, filtra i treu duplicats
  const vistes = new Map((anterior?.activitats || []).map(a => [a.id, a.vista]));
  const perId = new Map(), claus = new Set();
  let duplicats = 0, fora = 0;
  for (const f of FONTS) {
    for (const a of perFont[f.nom]) {
      if (!a.inici || !a.titol || a.fi < ara.data || a.inici > límit) continue;
      if (a.provincia === 'Fora de Catalunya' || !dinsCatalunya(a)) { fora++; continue; }
      if (perId.has(a.id)) continue;
      const clau = clauDuplicat(a);
      if (claus.has(clau)) { duplicats++; continue; }
      claus.add(clau);
      a.vista = vistes.get(a.id) || ara.data;
      perId.set(a.id, a);
    }
  }

  // 3. Les que no tenen província o comarca:
  //    a) les d'una altra activitat del mateix municipi; b) les de l'activitat més propera (~15 km)
  const completa = a => !!(PROVINCIES[String(a.provincia || '').toLowerCase()] && a.comarca);
  const normMun = m => String(m || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const perMunicipi = new Map();
  for (const a of perId.values()) if (completa(a) && a.municipi && !perMunicipi.has(normMun(a.municipi))) perMunicipi.set(normMun(a.municipi), a);
  const ambLloc = [...perId.values()].filter(a => completa(a) && a.lat != null);
  for (const a of perId.values()) {
    if (completa(a)) continue;
    let millor = perMunicipi.get(normMun(a.municipi));
    if (!millor && a.lat != null && ambLloc.length) {
      let dMin = Infinity;
      for (const b of ambLloc) { const d = (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2; if (d < dMin) { dMin = d; millor = b; } }
      // Comarca només si és a prop (~15 km); província fins a ~35 km
      if (dMin >= 0.1) millor = null;
      else if (dMin >= 0.02) { if (!PROVINCIES[String(a.provincia || '').toLowerCase()]) a.provincia = millor.provincia; millor = null; }
    }
    if (millor) { if (!PROVINCIES[String(a.provincia || '').toLowerCase()]) a.provincia = millor.provincia; a.comarca = a.comarca || millor.comarca; }
    if (!a.provincia) a.provincia = 'Sense ubicació';
  }

  const activitats = [...perId.values()].sort((x, y) => x.inici.localeCompare(y.inici) || x.titol.localeCompare(y.titol, 'ca'));
  // Si és la primera vegada que es veu una font, les seves activitats no compten com a noves
  const fontsNoves = new Set(FONTS.map(f => f.nom).filter(n => anterior && !(anterior.activitats || []).some(a => (a.font || 'generalitat') === n)));
  for (const a of activitats) if (fontsNoves.has(a.font) && a.vista === ara.data) a.vista = anterior?.primeraCarrega || ara.data;
  const primeraCarrega = anterior?.primeraCarrega || ara.data;
  // El primer dia (o el primer dia d'una font) no hi ha "noves": tot és nou
  const noves = ara.data !== primeraCarrega ? activitats.filter(a => a.vista === ara.data).length : 0;

  const compta = clau => activitats.reduce((m, a) => { for (const v of [].concat(a[clau])) m[v] = (m[v] || 0) + 1; return m; }, {});
  const resultat = {
    actualitzat: new Date().toISOString(),
    dia: ara.data,
    primeraCarrega,
    fonts: estatFonts,
    total: activitats.length,
    noves,
    gratuites: activitats.filter(a => a.gratuit).length,
    perFont: compta('font'),
    perProvincia: compta('provincia'),
    perCategoria: compta('categories'),
    activitats,
  };

  await mkdir(dirname(SORTIDA), { recursive: true });
  await writeFile(SORTIDA, JSON.stringify(resultat));
  console.log(`Fet: ${activitats.length} activitats (${noves} noves, ${resultat.gratuites} gratuïtes; ${duplicats} duplicats i ${fora} de fora de Catalunya descartats).`);
  console.log('Per font:', resultat.perFont);
  console.log('Per província:', resultat.perProvincia);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
