// Font: Guia Barcelona (guia.barcelona.cat) — agenda oficial de l'Ajuntament de Barcelona
// L'Ajuntament no publica l'agenda actualitzada en dades obertes (el fitxer és de 2021 i té antirobots),
// però la Guia mostra els resultats en HTML senzill amb filtres (tipus, districte, gratuït, preu).
// Cada consulta retorna com a molt 500 resultats, així que es divideix per tipus i, si cal, per districte.
// Es respecta el "Crawl-delay: 10" del seu robots.txt.
import { textNet, espera, baixa } from '../comu.mjs';

export const nom = 'guiabcn';
export const etiqueta = "Guia Barcelona (Ajuntament de Barcelona)";

const BASE = 'https://guia.barcelona.cat/ca/llistat?pg=search&tipuscerca=agenda&cerca=*:*&tr=619&c=00619*&sort=proxdate,asc&d=mes&nr=500';
const MAX = 500;
const PAUSA = Number(process.env.PAUSA_GUIA ?? 10_000); // robots.txt: Crawl-delay: 10

// Tipus de la Guia (code0) → categories de l'app
const TIPUS = {
  '0061901002': 'Cinema', '0061901003': 'Conferències', '0061901008': 'Esports', '0061901009': 'Exposicions',
  '0061901023': 'Festes', '0061901010': 'Fires i mercats', '0061901026': 'Jocs', '0061901013': 'Literatura',
  '0061901019': 'Concerts', '0061901001': 'Infantil', '0061901018': 'Premis i concursos', '0061901029': 'Solidaritat',
  '0061901014': 'Teatre', '0061901012': 'Rutes i visites', '0061901004': 'Infantil', '0061901017': 'Moda',
};
// Centre aproximat de cada districte (per ordenar "Prop meu"; no es mostren al mapa)
const DISTRICTES = {
  'Ciutat Vella': [41.3809, 2.1757], 'Eixample': [41.3916, 2.1636], 'Sants-Montjuïc': [41.3653, 2.1404],
  'Les Corts': [41.3851, 2.1307], 'Sarrià-Sant Gervasi': [41.4017, 2.1213], 'Gràcia': [41.4036, 2.1563],
  'Horta-Guinardó': [41.4255, 2.1557], 'Nou Barris': [41.4404, 2.1779], 'Sant Andreu': [41.4352, 2.1897],
  'Sant Martí': [41.4069, 2.1983],
};

let darrera = 0;
async function pàgina(filtres) {
  const espera_ = darrera + PAUSA - Date.now();
  if (espera_ > 0) await espera(espera_);
  darrera = Date.now();
  const html = await baixa(BASE + filtres, { tipus: 'html', intents: 3 });
  darrera = Date.now();
  return html;
}

// Recomptes dels filtres que ofereix la pàgina: { 'code0=0061901019': 1292, 'districtstr=Eixample': 886, ... }
function facetes(html) {
  const f = {};
  for (const m of html.matchAll(/<a[^>]+href="[^"]*?[?&](?:amp;)?[^"]*?(code0=\d+|districtstr=[^"&]+|ticket=\d|p=[a-z0-9]+)"[^>]*>([^<]*?)\((\d+)\)\s*<\/a>/g)) {
    f[m[1].replace(/&amp;/g, '&')] = Number(m[3]);
  }
  return f;
}

function dates(quan) {
  const ds = [...String(quan).matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].map(m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  if (!ds.length) return null;
  return { inici: ds[0], fi: ds[ds.length - 1] < ds[0] ? ds[0] : ds[ds.length - 1] };
}

function items(html) {
  const out = [];
  for (const bloc of html.split('<div class="item"').slice(1)) {
    const a = bloc.match(/<h3><a href="(detall\/[^"]+?_(\d+)\.html)">([\s\S]*?)<\/a>/);
    if (!a) continue;
    const camp = nom => { const m = bloc.match(new RegExp(`<dt>${nom}:<\\/dt>\\s*<dd>([\\s\\S]*?)(?:<\\/dd>|<\\/dl>)`)); return m ? textNet(m[1]) : ''; };
    const img = (bloc.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
    out.push({ id: a[2], url: 'https://guia.barcelona.cat/ca/' + a[1], titol: textNet(a[3]), on: camp('On'), quan: camp('Quan'), adreca: camp('Adreça'), img });
  }
  return out;
}

export async function baixaFont(avui) {
  const perId = new Map();
  const afegeix = (llista, extra = {}) => {
    for (const it of llista) {
      const a = perId.get(it.id) || { ...it, cats: new Set() };
      if (extra.cat) a.cats.add(extra.cat);
      if (extra.preu) a.preu = extra.preu;
      perId.set(it.id, a);
    }
  };
  // Baixa un filtre; si té més de 500 resultats, el divideix per districte (i després per gratuït/pagament)
  async function recull(filtres, extra, nivell = 0) {
    const html = await pàgina(filtres);
    const its = items(html), f = facetes(html);
    const dists = Object.entries(f).filter(([k]) => k.startsWith('districtstr='));
    const total = dists.reduce((s, [, n]) => s + n, 0);
    afegeix(its, extra);
    if (its.length < MAX || total <= MAX) return;
    const divisions = nivell === 0 ? dists : Object.entries(f).filter(([k]) => k.startsWith('ticket='));
    for (const [k, n] of divisions) {
      if (!n || nivell > 1) continue;
      await recull(`${filtres}&${k.replace(/ /g, '+')}`, extra, nivell + 1);
    }
  }

  const inici = await pàgina('');
  const fac = facetes(inici);
  console.log(`    Guia Barcelona: ${Object.keys(fac).length} filtres trobats`);
  if (!Object.keys(fac).some(k => k.startsWith('code0='))) throw new Error('La Guia Barcelona ha canviat el format (no es troben els tipus)');
  afegeix(items(inici));

  for (const [k, n] of Object.entries(fac).filter(([k]) => k.startsWith('code0='))) {
    const cat = TIPUS[k.slice(6)];
    if (!cat || !n) continue;
    await recull(`&${k}`, { cat });
  }
  // Preus: gratuït i trams (es processen de més car a més barat; el gratuït preval)
  for (const [k, preu] of [['p=mes60', 'mes60'], ['p=de30a60', 'de30a60'], ['p=de1a30', 'de1a30'], ['ticket=3', 'gratis']]) {
    if (fac[k]) await recull(`&${k}`, { preu });
  }

  const resultat = [];
  for (const a of perId.values()) {
    const d = dates(a.quan);
    if (!d || d.fi < avui) continue; // "Acte permanent" o sense data: fora
    const entreParèntesis = (a.adreca.match(/\(([^()]+)\)\s*$/) || [])[1] || '';
    const districte = DISTRICTES[entreParèntesis] ? entreParèntesis : '';
    // Algunes activitats de la Guia són de municipis veïns (p. ex. "(Hospitalet de llobregat, l')")
    const municipi = /hospitalet/i.test(entreParèntesis) ? "L'Hospitalet de Llobregat"
      : (!districte && entreParèntesis && !/\d|\b(c|pl|av|des|entre|davant)\b\.?/i.test(entreParèntesis) && entreParèntesis !== 'Barcelona')
        ? entreParèntesis.replace(/\b\w/g, c => c.toUpperCase()) : 'Barcelona';
    const centre = DISTRICTES[districte];
    const preu = {
      gratis: { gratuit: true, preuMin: 0, preuMax: 0, preuText: 'Gratuït' },
      de1a30: { gratuit: false, preuMin: 1, preuMax: 30, preuText: "D'1 a 30 €" },
      de30a60: { gratuit: false, preuMin: 30, preuMax: 60, preuText: 'De 30 a 60 €' },
      mes60: { gratuit: false, preuMin: 60, preuMax: null, preuText: 'Més de 60 €' },
    }[a.preu] || { gratuit: false, preuMin: null, preuMax: null, preuText: '' };
    resultat.push({
      id: `bcn-${a.id}`,
      titol: a.titol,
      subtitol: '',
      desc: '',
      inici: d.inici,
      fi: d.fi,
      horari: '',
      categories: a.cats.size ? [...a.cats] : ['Altres'],
      ...preu,
      preuRang: !!a.preu && a.preu !== 'gratis',
      provincia: 'Barcelona',
      comarca: municipi === 'Barcelona' || municipi.startsWith("L'Hospitalet") ? 'Barcelonès' : '',
      municipi,
      districte,
      espai: a.on,
      adreca: districte || municipi !== 'Barcelona' ? a.adreca.replace(/\s*\([^()]+\)\s*$/, '') : a.adreca,
      lat: centre ? centre[0] : null,
      lon: centre ? centre[1] : null,
      aprox: !!centre,
      img: a.img,
      url: a.url,
      entradesUrl: '',
      virtual: '',
    });
  }
  return resultat;
}
