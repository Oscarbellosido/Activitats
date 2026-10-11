// Font: Diputació de Barcelona — API de dades obertes (do.diba.cat)
// Quatre agendes: turisme, biblioteques municipals, museus locals i parcs naturals de la província de Barcelona.
import { textNet, analitzaPreu, partData, fiRaonable, baixa, espera, PROVINCIA_PER_CP, categoritza } from '../comu.mjs';

export const nom = 'diba';
export const etiqueta = 'Diputació de Barcelona (turisme, biblioteques, museus i parcs)';
const API = 'https://do.diba.cat/api/dataset';
const PAGINA = 5000;

const AGENDES = [
  { dataset: 'actesturisme_ca', origen: 'Turisme', perDefecte: 'Turisme' },
  { dataset: 'actesbiblioteques_ca', origen: 'Biblioteques', perDefecte: 'Biblioteques' },
  { dataset: 'actesmuseus', origen: 'Museus', perDefecte: 'Museus' },
  { dataset: 'actesparcs', origen: 'Parcs naturals', perDefecte: 'Natura' },
];

const categories = (e, perDefecte) => categoritza([e.titol || '', ...(e.tipus || []), ...(e.public || []), ...(e.tags || [])], perDefecte);

function normalitza(e, ag) {
  const ini = partData(e.data_inici), fi = partData(e.data_fi);
  if (!ini.dia) return null;
  const adr = e.grup_adreca || {}, mun = e.rel_municipis || {};
  const [lat, lon] = String(adr.localitzacio || mun.centre_municipal || '').split(',').map(Number);
  const cp = String(adr.codi_postal || '').trim();
  const provincia = mun.grup_provincia?.provincia_nom || PROVINCIA_PER_CP[cp.slice(0, 2)] || 'Barcelona';
  const horari = textNet(e.observacions_horari, 200) || (ini.hora ? `${ini.hora} h` : '');
  const desc = textNet(e.descripcio || e.observacions || e.cos, 600);
  const imatge = (Array.isArray(e.imatge) ? e.imatge[0] : e.imatge) || '';
  return {
    id: `diba-${e.acte_id}`,
    titol: textNet(e.titol).replace(/^([A-ZÀ-Ú0-9 :'".,!?¡¿·-]{12,})$/, m => m.charAt(0) + m.slice(1).toLowerCase()),
    subtitol: textNet(e.acte_organitzadors, 120),
    desc,
    inici: ini.dia,
    fi: fiRaonable(ini.dia, fi.dia),
    horari,
    categories: categories(e, ag.perDefecte),
    ...analitzaPreu(e.preu, { textExtra: `${e.observacions || ''} ${e.descripcio || ''}`.slice(0, 1500) }),
    provincia: ['Barcelona', 'Girona', 'Lleida', 'Tarragona'].includes(provincia) ? provincia : 'Barcelona',
    comarca: mun.grup_comarca?.comarca_nom || '',
    municipi: textNet(adr.municipi_nom || mun.municipi_nom),
    espai: textNet(adr.adreca_nom),
    adreca: textNet(adr.adreca),
    lat: Number.isFinite(lat) && lat ? lat : null,
    lon: Number.isFinite(lon) && lon ? lon : null,
    // Sense imatge pròpia: la foto del municipi que publica la mateixa Diputació
    img: /^https?:\/\//.test(imatge) ? imatge : (/^https?:\/\//.test(mun.municipi_vista || '') ? mun.municipi_vista : ''),
    imgMunicipi: !/^https?:\/\//.test(imatge) && !!mun.municipi_vista,
    url: e.acte_url || e.url_general || '',
    entradesUrl: e.url_inscripcions || '',
    virtual: /virtual|en l[ií]nia|online/i.test((e.tipus || []).join(' ')) ? 'En línia' : '',
    origen: ag.origen,
  };
}

export async function baixaFont(avui, límit) {
  const totes = [];
  for (const ag of AGENDES) {
    // L'API no filtra per data: es baixa tot l'històric per pàgines i es filtra aquí
    for (let ini = 1; ini < 200000; ini += PAGINA) {
      const d = await baixa(`${API}/${ag.dataset}/format/json/pag-ini/${ini}/pag-fi/${ini + PAGINA - 1}`);
      const els = d.elements || [];
      for (const e of els) {
        const a = normalitza(e, ag);
        if (a && a.fi >= avui && a.inici <= límit && a.titol) totes.push(a);
      }
      if (els.length < PAGINA) break;
      await espera(500);
    }
  }
  return totes;
}
