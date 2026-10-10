# Activitats a Catalunya

Agenda de concerts, teatre, exposicions, festes, fires i activitats de tot Catalunya, classificades per
**gratuïtes / preu**, **província**, **comarca**, **tipus** i **dia**. Marca les activitats **noves** de cada dia.

- App: https://oscarbellosido.github.io/Activitats/
- Fonts (totes oficials i públiques):
  - [Agenda Cultural de Catalunya](https://analisi.transparenciacatalunya.cat/d/rhpv-yr4f) — Generalitat, dades obertes (tot Catalunya).
  - [Diputació de Barcelona](https://dadesobertes.diba.cat/) — API de dades obertes: agendes de turisme, biblioteques i museus locals (província de Barcelona).
  - [Guia Barcelona](https://guia.barcelona.cat/) — agenda de l'Ajuntament de Barcelona (els propers 30 dies).

## Com funciona

```
GitHub Actions (cada dia, 6:00 de Catalunya, ~20 min)
  node scripts/actualitza.mjs
     ├─ fonts/generalitat.mjs  (API Socrata)
     ├─ fonts/diba.mjs         (API do.diba.cat)
     └─ fonts/guiabcn.mjs      (HTML de guia.barcelona.cat)
     → treu duplicats i activitats de fora de Catalunya → data/activitats.json → commit + push
                                                                    ↓
                                                    GitHub Pages: index.html (llegeix el JSON)
```

- **No cal tenir el PC encès** ni cap API de pagament: tot passa a GitHub (gratuït en repos públics).
- Si una font falla un dia, es mantenen les seves activitats de l'última actualització (i queda anotat a `fonts` del JSON).
- Si una activitat surt a dues fonts (mateix títol, dia i municipi), es queda la de la primera (Generalitat > Diputació > Guia).
- `scripts/actualitza.mjs` baixa les activitats vigents (fins a 6 mesos vista), les classifica i les compara amb
  les del dia anterior: les que no hi eren queden marcades com a **noves** (camp `vista` = data que es va veure per primer cop).
- El workflow `.github/workflows/actualitza.yml` s'executa a les 4:00 i 5:00 UTC; l'script només actualitza quan
  ja són les 6 a Catalunya i avui encara no s'ha fet (així sempre és a les 6, sigui horari d'estiu o d'hivern).
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

Fonts descartades: el fitxer d'agenda de dades obertes de l'Ajuntament de Barcelona (sense actualitzar des de 2021 i amb
antirobots: per això es fa servir la Guia Barcelona), TresC i 3Cat (no publiquen les dades).
La Guia Barcelona té `Crawl-delay: 10` al robots.txt: no baixis la pausa entre peticions.
