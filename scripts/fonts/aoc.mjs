// Font: agendes municipals publicades al portal comú de dades obertes de l'AOC (dadesobertes.seu-e.cat)
// Cada ajuntament fa servir els seus propis camps, així que cada agenda té el seu "lector".
// Per afegir-ne una: busca-la a https://dadesobertes.seu-e.cat (cerca "agenda"), copia l'id del recurs i afegeix-la a AGENDES.
import { textNet, analitzaPreu, partData, fiRaonable, baixa, espera, categoritza } from '../comu.mjs';

export const nom = 'aoc';
export const etiqueta = 'Agendes municipals (dades obertes AOC)';
const API = 'https://dadesobertes.seu-e.cat/api/action/datastore_search';

const json = v => { try { return JSON.parse(v); } catch { return []; } };
const net = v => (v == null || v === 'NULL' ? '' : String(v));
const dataDe = v => { // "2026-10-16T00:00:00", "2026-10-16 17:00:00.0" o " 29/01/2026 10:00"
  const s = net(v).trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  return m ? { dia: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] && m[4] !== '00' ? `${m[4]}:${m[5]}` : '' } : partData(s);
};
const hora = h => { const m = net(h).match(/(\d{1,2}):(\d{2})/); return m && !(m[1] === '00' && m[2] === '00') ? `${m[1].padStart(2, '0')}:${m[2]} h` : ''; };

const AGENDES = [
  {
    clau: 'tarragona', etiqueta: 'Ajuntament de Tarragona', recurs: '5368e11e-cfe3-4a8d-b3e9-936df0550d5b',
    provincia: 'Tarragona', comarca: 'Tarragonès', municipi: 'Tarragona',
    llegeix: r => ({
      id: r.UID, titol: r.TITOL, inici: dataDe(r.inici), fi: dataDe(r.fi), espai: r.ADRECA, url: r.URL,
      lat: r.latitud, lon: r.longitud, cats: json(r.categories),
    }),
  },
  {
    clau: 'hospitalet', etiqueta: "Ajuntament de l'Hospitalet", recurs: 'fd1d251a-fa70-4522-b805-a964f063c6c8',
    provincia: 'Barcelona', comarca: 'Barcelonès', municipi: "L'Hospitalet de Llobregat",
    llegeix: r => {
      const [lat, lon] = net(r.CoordenadesEquipament).split(/[,;\s]+/).map(Number);
      const entrada = net(r.TipusEntrada);
      return {
        id: r.IdActe, titol: r.NomActe, desc: r.Descripcio, inici: dataDe(r.DataInici), fi: dataDe(r.DataFi),
        horari: hora(r.HoraInici), espai: r.NomEquipament, adreca: r.AdrecaEquipament, districte: r.BarriEquipament,
        url: r.PaginaWeb, lat, lon, cats: [net(r.LlistaTemes), net(r.TipusPublic)],
        preu: /gratu|lliure/i.test(entrada) ? 'Gratuït' : Number(r.Preu) > 0 ? `${r.Preu} €` : entrada,
      };
    },
  },
  {
    clau: 'gava', etiqueta: 'Ajuntament de Gavà', recurs: 'f2caf121-c752-4347-8f70-9f633954be5e',
    provincia: 'Barcelona', comarca: 'Baix Llobregat', municipi: 'Gavà',
    llegeix: r => ({
      titol: r.Titol, desc: r.descripcio, inici: dataDe(r.Data_inici), fi: dataDe(r.Data_fi),
      horari: hora(r.hora_inici), espai: r.ubicacio, cats: json(r.seccio),
    }),
  },
  {
    clau: 'santandreu', etiqueta: 'Ajuntament de Sant Andreu de la Barca', recurs: 'e7a5b4c8-c0ef-4de4-b462-ef816144aa18',
    provincia: 'Barcelona', comarca: 'Baix Llobregat', municipi: 'Sant Andreu de la Barca',
    llegeix: r => ({ id: r.AGENDA, titol: r.TITOL, desc: r['DESCRIPCIÓ'], inici: dataDe(r.DATA), url: r.URL }),
  },
  {
    clau: 'vilanova', etiqueta: 'Ajuntament de Vilanova i la Geltrú', recurs: '22d7de56-2769-401b-ae03-4c2fee0e92d1',
    provincia: 'Barcelona', comarca: 'Garraf', municipi: 'Vilanova i la Geltrú',
    llegeix: r => ({ titol: r.ACTIVITAT, inici: dataDe(r.INICI), fi: dataDe(r.FI), espai: r['ADREÇA'], lat: r.LAT, lon: r.LON }),
  },
  {
    clau: 'pladurgell', etiqueta: "Consell Comarcal del Pla d'Urgell", recurs: 'c49378f3-3b8b-4506-b0e7-7dff80ee9e10',
    provincia: 'Lleida', comarca: "Pla d'Urgell",
    llegeix: r => ({
      titol: r.TITOL_EVENT, desc: r.DESCRIP_EVENT, inici: dataDe(r.DATA_INICI), fi: dataDe(r.DATA_FI), horari: hora(r.HORA_INICI),
      municipi: r.NOM_ENS, adreca: r['ADREÇA'] || r.ADRECA, url: r.URL_EVENT, img: r.URL_IMATGE, subtitol: r.ORGANITZADOR,
    }),
  },
];

export async function baixaFont(avui, límit) {
  const totes = [], errors = [];
  for (const ag of AGENDES) {
    try {
      const d = await baixa(`${API}?resource_id=${ag.recurs}&limit=32000`);
      if (!d.success) throw new Error('resposta sense èxit');
      let n = 0;
      for (const r of d.result.records) {
        const x = ag.llegeix(r);
        const ini = x.inici?.dia;
        if (!ini || !net(x.titol).trim()) continue;
        const fi = fiRaonable(ini, x.fi?.dia || ini);
        if (fi < avui || ini > límit) continue;
        const lat = Number(x.lat), lon = Number(x.lon);
        const desc = textNet(x.desc, 600);
        let url = net(x.url).trim(); if (url && !/^https?:/.test(url)) url = 'https://' + url;
        totes.push({
          id: `aoc-${ag.clau}-${x.id ?? r._id}`,
          titol: textNet(x.titol),
          subtitol: textNet(x.subtitol, 120),
          desc,
          inici: ini,
          fi,
          horari: x.horari || (x.inici.hora ? `${x.inici.hora} h` : ''),
          categories: categoritza([x.titol, ...(x.cats || []), desc.slice(0, 200)], 'Altres'),
          ...analitzaPreu(x.preu, { textExtra: desc }),
          provincia: ag.provincia,
          comarca: ag.comarca,
          municipi: textNet(x.municipi || ag.municipi),
          districte: textNet(x.districte),
          espai: textNet(x.espai),
          adreca: textNet(x.adreca),
          lat: Number.isFinite(lat) && lat > 40 && lat < 43 ? lat : null,
          lon: Number.isFinite(lon) && lon > 0 && lon < 4 ? lon : null,
          img: /^https?:\/\//.test(net(x.img)) ? net(x.img) : '',
          url,
          entradesUrl: '',
          virtual: '',
          origen: ag.etiqueta,
        });
        n++;
      }
      console.log(`    AOC ${ag.etiqueta}: ${n} activitats`);
    } catch (e) {
      errors.push(`${ag.clau}: ${e.message}`);
      console.log(`    AOC ${ag.etiqueta}: error (${e.message})`);
    }
    await espera(1000);
  }
  if (errors.length === AGENDES.length) throw new Error(errors.join('; '));
  return totes;
}
