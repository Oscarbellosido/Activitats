// Font: Agenda Cultural de Catalunya (Generalitat) — dades obertes, dataset rhpv-yr4f (Socrata)
import { PROVINCIES, PROVINCIA_PER_CP, COMARQUES, humanitza, textNet, analitzaPreu, sumaDies, baixa, DIES_ENDAVANT } from '../comu.mjs';

export const nom = 'generalitat';
export const etiqueta = 'Agenda Cultural de Catalunya (Generalitat)';
const API = 'https://analisi.transparenciacatalunya.cat/resource/rhpv-yr4f.json';
const IMG_BASE = 'https://agenda.cultura.gencat.cat';
const PAGINA = 2000;

const CATEGORIES = {
  'concerts': 'Concerts', 'teatre': 'Teatre', 'exposicions': 'Exposicions', 'dansa': 'Dansa', 'infantil': 'Infantil',
  'festivals-i-mostres': 'Festivals', 'opera': 'Òpera', 'circ': 'Circ', 'cicles': 'Cicles',
  'rutes-i-visites': 'Rutes i visites', 'commemoracions': 'Commemoracions', 'fires-i-mercats': 'Fires i mercats',
  'conferencies': 'Conferències', 'activitats-virtuals': 'Virtuals', 'cultura-digital': 'Cultura digital',
  'festes': 'Festes', 'magia': 'Màgia', 'cursos': 'Cursos i tallers', 'nadal': 'Nadal', 'any-gaudi': 'Any Gaudí',
  'cinema': 'Cinema', 'literatura': 'Literatura', 'sardanes': 'Sardanes', 'cultura-popular': 'Cultura popular',
};

function ubicacio(r) {
  const camí = String(r.comarca_i_municipi || r.municipi || '').split(',')[0].replace(/^agenda:ubicacions\//, '');
  let [prov, com, mun] = camí.split('/');
  let provincia = PROVINCIES[prov];
  // Camins mal formats (p. ex. "agenda:ubicacions/manresa"): província pel codi postal
  if (!provincia) {
    const perCP = PROVINCIA_PER_CP[String(r.codi_postal || '').trim().slice(0, 2)];
    if (perCP) { if (!com && prov && !/^fora/.test(prov)) mun = mun || prov; provincia = perCP; }
  }
  return {
    provincia: provincia || (/^fora/.test(prov || '') ? 'Fora de Catalunya' : 'Sense ubicació'),
    comarca: provincia && com ? (COMARQUES[com] || humanitza(com)) : '',
    municipi: textNet(r.localitat) || (mun ? humanitza(mun) : ''),
  };
}

export function normalitza(r) {
  const cats = String(r.tags_categor_es || '').split(',').map(s => s.trim().replace(/^agenda:categories\//, '')).filter(Boolean);
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
    ...analitzaPreu(r.entrades, { gratuitDeclarat: r.gratuita === 'Sí' }),
    ...ubicacio(r),
    espai: textNet(r.espai),
    adreca: textNet(r.adre_a),
    lat: Number.isFinite(lat) && lat ? lat : null,
    lon: Number.isFinite(lon) && lon ? lon : null,
    img: imatge ? IMG_BASE + encodeURI(imatge.trim()) : '',
    url: r.urlactivitat || r.url || '',
    entradesUrl: r.linkbotoentrades || '',
    virtual: r.modalitat && r.modalitat !== 'Presencial' ? r.modalitat : '',
  };
}

export async function baixaFont(avui) {
  const límit = sumaDies(avui, DIES_ENDAVANT);
  const where = `data_fi >= '${avui}T00:00:00' AND data_inici <= '${límit}T23:59:59' AND (permanent IS NULL OR permanent != 'Sí')`;
  const crus = [];
  for (let offset = 0; ; offset += PAGINA) {
    const pàgina = await baixa(`${API}?$where=${encodeURIComponent(where)}&$order=codi&$limit=${PAGINA}&$offset=${offset}`);
    crus.push(...pàgina);
    if (pàgina.length < PAGINA) break;
  }
  return crus.filter(r => r.codi && r.denominaci).map(normalitza);
}
