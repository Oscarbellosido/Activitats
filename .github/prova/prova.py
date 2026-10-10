import json, re, urllib.request, urllib.parse
UA = {'User-Agent': 'Mozilla/5.0 (Activitats Catalunya; https://github.com/Oscarbellosido/Activitats)'}
def get(url, n=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)
        b = r.read() if n is None else r.read(n)
        return r.status, r.headers.get('content-type'), r.geturl(), b.decode('utf-8', 'replace')
    except Exception as e:
        return 'ERR', str(e)[:200], url, ''
def show(t, url, n=1500):
    s, ct, u, b = get(url)
    print(f'\n=== {t}\n{s} {ct} {u} {len(b)}B\n{b[:n]}')
    return b

# 1. Barcelona CKAN: recursos i descripcio
for pid in ['agenda-cultural', 'agenda-diaria']:
    s, ct, u, b = get(f'https://opendata-ajuntament.barcelona.cat/data/api/action/package_show?id={pid}')
    try:
        d = json.loads(b)['result']
        print(f'\n=== CKAN {pid} modificat {d.get("metadata_modified")}')
        print('DESC:', (d.get('dataset_fields_description') or '')[:1500])
        for x in d['resources']:
            print('RES', x.get('id'), x.get('name'), x.get('format'), x.get('last_modified'), x.get('datastore_active'), x.get('url'))
            if x.get('datastore_active'):
                show('datastore ' + x['id'], f'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search?resource_id={x["id"]}&limit=1', 2500)
    except Exception as e:
        print('ERR', pid, e, b[:300])

# 2. Guia Barcelona: enllaços d'exportacio
s, ct, u, b = get('https://guia.barcelona.cat/ca/agenda')
print('\n=== guia links', s)
for m in sorted(set(re.findall(r'(?:href|src|action)="([^"]+)"', b))):
    if re.search(r'rss|ics|json|api|xml|feed|export|cerca|search|agenda', m, re.I): print('  ', m)
for t, url in [('guia rss', 'https://guia.barcelona.cat/ca/rss'), ('guia agenda.xml', 'https://guia.barcelona.cat/agenda.xml'),
               ('guia api', 'https://guia.barcelona.cat/api/agenda'), ('guia sitemap', 'https://guia.barcelona.cat/sitemap.xml'),
               ('guia robots', 'https://guia.barcelona.cat/robots.txt')]:
    show(t, url, 800)

# 3. Diputacio: un element sencer i llistat de datasets d'agenda
show('diba turisme 1 element', 'https://do.diba.cat/api/dataset/actesturisme_ca/format/json/pag-ini/1/pag-fi/1', 6000)
for ds in ['museus-agenda-dactivitats', 'biblioteques-i-bibliobusos-agenda-dactivitats', 'agenda-general-de-la-diputacio', 'turisme-agenda-dactivitats']:
    s, ct, u, b = get('https://dadesobertes.diba.cat/datasets/' + ds)
    print(f'\n=== diba pagina {ds}', s, sorted(set(re.findall(r'do\.diba\.cat/api/dataset/[a-z0-9_]+', b)))[:10])
for name in ['actesmuseus_ca', 'actesbiblioteques_ca', 'agenda_ca', 'actes_ca']:
    show('diba ' + name, f'https://do.diba.cat/api/dataset/{name}/format/json/pag-ini/1/pag-fi/1', 600)
