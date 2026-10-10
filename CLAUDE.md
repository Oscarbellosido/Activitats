# Activitats a Catalunya — notes per a Claude

Agenda de concerts, teatre, exposicions, festes, fires i activitats de tot Catalunya, classificades per
**gratuïtes / preu**, **província**, **comarca**, **tipus** i **dia**. Marca les activitats **noves** de cada dia.

- App: https://oscarbellosido.github.io/Activitats/
- Dades: [Agenda Cultural de Catalunya](https://analisi.transparenciacatalunya.cat/d/rhpv-yr4f) (dades obertes de la Generalitat).

## Com funciona

```
GitHub Actions (cada dia, 6:00 de Catalunya)
  node scripts/actualitza.mjs → API dades obertes Generalitat → data/activitats.json → commit + push
                                                                         ↓
                                                         GitHub Pages: index.html (llegeix el JSON)
```

- **No cal tenir el PC encès** ni cap API de pagament: tot passa a GitHub (gratuït en repos públics).
- `scripts/actualitza.mjs` baixa les activitats vigents (fins a 6 mesos vista), les classifica i les compara amb
  les del dia anterior: les que no hi eren queden marcades com a **noves** (camp `vista` = data que es va veure per primer cop).
- El workflow `.github/workflows/actualitza.yml` s'executa a les 4:00 i 5:00 UTC; l'script només actualitza quan
  ja són les 6 a Catalunya i avui encara no s'ha fet (així sempre és a les 6, sigui horari d'estiu o d'hivern).
- Per actualitzar a mà: pestanya **Actions → Actualitza activitats → Run workflow**.

## Classificació

| Camp | D'on surt |
|---|---|
| `gratuit` | camp `gratuita` = "Sí", o "entrada lliure / gratuït" al text d'entrades sense cap preu |
| `preuMin`, `preuMax` | imports en € del text d'entrades ("Preus: de 6 a 18 €") |
| `provincia`, `comarca`, `municipi` | camí `agenda:ubicacions/<província>/<comarca>/<municipi>` |
| `categories` | etiquetes `agenda:categories/...` (Concerts, Teatre, Exposicions, Dansa, Infantil, Festivals…) |

A l'app, els filtres de preu són: Gratuïtes, Fins a 10 €, De 10 a 25 €, Més de 25 €, Preu sense indicar.

## Executar-ho al PC

```bash
node scripts/actualitza.mjs --forca     # Node 20 o superior, sense dependències
npx serve .                            # i obre http://localhost:3000
```

## Fitxers

| Fitxer | Què és |
|---|---|
| `index.html` | L'app (HTML/CSS/JS sense frameworks, mapa amb Leaflet). Instal·lable al mòbil (PWA). |
| `scripts/actualitza.mjs` | Baixa, classifica i marca les noves. |
| `data/activitats.json` | Les dades del dia (les escriu el workflow; no cal tocar-lo). |
| `.github/workflows/actualitza.yml` | L'actualització diària. |
| `sw.js`, `manifest.json`, `icon-*.png` | Instal·lació al mòbil i funcionament sense connexió. |

## Ampliar fonts
La de Barcelona ciutat (opendata-ajuntament.barcelona.cat) té protecció antirobots i no es pot baixar automàticament.
Per afegir una font nova: baixa-la a `baixaTot()` i converteix cada registre al mateix format que `normalitza()`.

## Notes
- El repo és PÚBLIC: mai hi posis claus, correus personals ni secrets.
- La carpeta d'usuari `C:\Users\Carles` també és un repo git: aquesta carpeta té el seu propi `.git`. No facis `git add .` fora d'aquí.
- Canvis a `index.html` → `git push` (publica a GitHub Pages). Recorda fer `git pull` abans: el workflow fa un commit cada dia.
