# Activitats a Catalunya — notes per a Claude

Agenda de concerts, teatre, exposicions, festes, fires i activitats de tot Catalunya, classificades per
**gratuïtes / preu**, **província**, **comarca**, **tipus** i **dia**. Marca les activitats **noves** de cada dia.

- App: https://oscarbellosido.github.io/Activitats/
- Fonts (totes oficials i públiques):
  - [Agenda Cultural de Catalunya](https://analisi.transparenciacatalunya.cat/d/rhpv-yr4f) — Generalitat, dades obertes (tot Catalunya).
  - [Diputació de Barcelona](https://dadesobertes.diba.cat/) — API de dades obertes: agendes de turisme, biblioteques, museus locals i parcs naturals (província de Barcelona).
  - [Dades obertes AOC](https://dadesobertes.seu-e.cat/) — agendes municipals publicades al portal comú dels ajuntaments: Tarragona, l'Hospitalet, Gavà, Sant Andreu de la Barca, Vilanova i la Geltrú i Pla d'Urgell (`scripts/fonts/aoc.mjs`; per afegir-ne una, n'hi ha prou amb l'id del recurs i un lector de camps).
  - [Guia Barcelona](https://guia.barcelona.cat/) — agenda de l'Ajuntament de Barcelona (els propers 30 dies).
  - [Agenda del Patrimoni Cultural](https://patrimoni.gencat.cat/ca/agenda) — Generalitat: visites, portes obertes i tallers a museus i monuments.

## Com funciona

```
GitHub Actions (cada dia, 6:00 de Catalunya, ~20 min)
  node scripts/actualitza.mjs
     ├─ fonts/generalitat.mjs  (API Socrata)
     ├─ fonts/patrimoni.mjs    (HTML de patrimoni.gencat.cat; fitxes en memòria a data/cache-patrimoni.json)
     ├─ fonts/diba.mjs         (API do.diba.cat)
     ├─ fonts/aoc.mjs          (API dadesobertes.seu-e.cat: agendes municipals)
     └─ fonts/guiabcn.mjs      (HTML de guia.barcelona.cat)
     → treu duplicats i activitats de fora de Catalunya → data/activitats.json → commit + push
                                                                    ↓
                                                    GitHub Pages: index.html (llegeix el JSON)
```

- **No cal tenir el PC encès** ni cap API de pagament: tot passa a GitHub (gratuït en repos públics).
- Si una font falla un dia, es mantenen les seves activitats de l'última actualització (i queda anotat a `fonts` del JSON).
- Si una activitat surt a dues fonts (mateix títol, dia i municipi), es queda la de la primera (Generalitat > Patrimoni > Diputació > Ajuntaments AOC > Guia).
- `scripts/actualitza.mjs` baixa les activitats vigents (fins a 6 mesos vista), les classifica i les compara amb
  les del dia anterior: les que no hi eren queden marcades com a **noves** (camp `vista` = data que es va veure per primer cop).
- **Despertador** (`despertador/`): un Cloudflare Worker amb cron (4:05 i 5:05 UTC) que crida l'API de GitHub per llançar
  el workflow, perquè les execucions programades de GitHub arriben amb hores de retard o no arriben. El workflow també té
  hores programades de reserva. L'script només actualitza quan ja són les 6 a Catalunya i avui encara no s'ha fet, així que
  els avisos repetits no fan res. El token de GitHub (fine-grained, només aquest repo, permís Actions: write) és un secret
  del worker (`npx wrangler secret put GITHUB_TOKEN`), mai al codi. Desplegar: `cd despertador && npx wrangler deploy`.
- Per actualitzar a mà: pestanya **Actions → Actualitza activitats → Run workflow** (pots indicar una sola font a "Només aquesta font").

## Classificació

| Camp | D'on surt |
|---|---|
| `gratuit` | Generalitat: camp `gratuita`; Diputació: "gratuït / entrada lliure" al preu o la descripció; Guia: filtre "Gratuït" |
| `preuMin`, `preuMax` | imports en € del text de preu; a la Guia, el tram del filtre (`preuRang: true`) |
| `provincia`, `comarca`, `municipi` | Generalitat: camí `agenda:ubicacions/...` (o codi postal); Diputació: municipi/comarca de l'API; Guia: Barcelona + `districte` |
| `categories` | etiquetes de cada font convertides a les de l'app (Concerts, Teatre, Exposicions, Infantil, Literatura…) |
| `font`, `origen` | `generalitat`, `diba` (origen: Turisme / Biblioteques / Museus) o `guiabcn` |
| `lat`, `lon`, `aprox` | coordenades; a la Guia només el centre del districte (`aprox: true`, no surten al mapa) |

A l'app, els filtres de preu són: Gratuïtes, Fins a 30 €, De 30 a 60 €, Més de 60 €, Preu sense indicar.

## Executar-ho al PC

```bash
node scripts/actualitza.mjs --forca     # Node 20 o superior, sense dependències
npx serve .                            # i obre http://localhost:3000
```

## Fitxers

| Fitxer | Què és |
|---|---|
| `index.html` | L'app (HTML/CSS/JS sense frameworks, mapa amb Leaflet). Instal·lable al mòbil (PWA). |
| `scripts/actualitza.mjs` | Combina les fonts, treu duplicats, marca les noves i escriu el JSON. |
| `scripts/fonts/*.mjs` | Una font per fitxer (`baixaFont(avui, límit)` → llista d'activitats normalitzades). |
| `scripts/comu.mjs` | Utilitats compartides (preus, dates, textos, comarques). |
| `data/activitats.json` | Les dades del dia (les escriu el workflow; no cal tocar-lo). |
| `.github/workflows/actualitza.yml` | L'actualització diària. |
| `sw.js`, `manifest.json`, `icon-*.png` | Instal·lació al mòbil i funcionament sense connexió. |

## Ampliar fonts
Crea `scripts/fonts/<nom>.mjs` que exporti `nom`, `etiqueta` i `baixaFont(avui, límit)` (mateix format que les altres) i
afegeix-lo a `FONTS` a `scripts/actualitza.mjs`.

Agendes AOC descartades (només activitats passades o tràmits): el Prat, Castellar del Vallès, Sant Just Desvern, Sant Quirze del Vallès,
Arenys de Munt i Santa Coloma de Gramenet. Fonts descartades: el fitxer d'agenda de dades obertes de l'Ajuntament de Barcelona (sense actualitzar des de 2021 i amb
antirobots: per això es fa servir la Guia Barcelona), TresC i 3Cat (no publiquen les dades).
La Guia Barcelona i patrimoni.gencat.cat tenen `Crawl-delay: 10` al robots.txt: no baixis la pausa entre peticions.
Les fonts es baixen alhora (Promise.all); la més lenta (Guia, ~15 min) marca la durada.

## Notes
- El repo és PÚBLIC: mai hi posis claus, correus personals ni secrets.
- La carpeta d'usuari `C:\Users\Carles` també és un repo git: aquesta carpeta té el seu propi `.git`. No facis `git add .` fora d'aquí.
- Canvis a `index.html` → `git push` (publica a GitHub Pages). Recorda fer `git pull` abans: el workflow fa un commit cada dia.
