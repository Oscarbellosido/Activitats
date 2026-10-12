// Despertador de l'app Activitats
// Cada matí avisa GitHub perquè executi l'actualització ("Actualitza activitats").
// GitHub sovint retarda o se salta les execucions programades; Cloudflare és puntual.
// L'script de l'app ja comprova si avui ja s'ha actualitzat, així que avisar-lo dues vegades no fa mal.
//
// Secret necessari (no va mai al codi):  npx wrangler secret put GITHUB_TOKEN

const REPO = 'Oscarbellosido/Activitats';
const WORKFLOW = 'actualitza.yml';

async function desperta(env) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'activitats-despertador',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    // forca=false: l'script només actualitza si són ≥ 6:00 a Catalunya i avui encara no s'ha fet
    body: JSON.stringify({ ref: 'main', inputs: { forca: 'false' } }),
  });
  return { ok: r.status === 204, status: r.status, text: r.status === 204 ? '' : await r.text() };
}

export default {
  async scheduled(event, env, ctx) {
    const res = await desperta(env);
    console.log(`Despertador ${new Date().toISOString()}: ${res.ok ? 'avisat' : 'ERROR ' + res.status + ' ' + res.text}`);
  },
  // Visitar l'adreça del worker només mostra l'estat (no llança res)
  async fetch() {
    return new Response("Despertador d'Activitats: actiu. Avisa GitHub cada dia a les 6:05 i a les 7:05 (hora de Catalunya, a l'estiu).",
      { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
