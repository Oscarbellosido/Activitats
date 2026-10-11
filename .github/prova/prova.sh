#!/bin/bash
UA="Mozilla/5.0 (compatible; ActivitatsCatalunya/1.0; +https://github.com/Oscarbellosido/Activitats)"
c() { curl -sSL -m 90 -A "$UA" "$@"; }
echo "=== AOC: cerca de conjunts 'agenda'"
for q in agenda "agenda+activitats" activitats+culturals esdeveniments; do
c "https://dadesobertes.seu-e.cat/api/3/action/package_search?q=$q&rows=300" | python3 -c "
import json,sys
d=json.load(sys.stdin)['result']; print('Q','$q','count',d['count'])
for r in d['results']:
  o=(r.get('organization') or {}).get('title','?')
  t=r.get('title','')
  if 'agend' in (t+r['name']).lower() or 'activitat' in (t+r['name']).lower() or 'esdeven' in (t+r['name']).lower():
    print(' |',o,'|',t,'|',r['name'],'|',r.get('metadata_modified','')[:10],'|',[ (x.get('format'),x.get('id')) for x in r.get('resources',[])][:3])
" 2>&1 | head -120
done
echo "=== Tarragona datastore"
c "https://dadesobertes.seu-e.cat/api/action/datastore_search?resource_id=5368e11e-cfe3-4a8d-b3e9-936df0550d5b&limit=2" | python3 -c "
import json,sys;d=json.load(sys.stdin)['result'];print('total',d.get('total'));print([f['id'] for f in d['fields']]);[print(json.dumps(r,ensure_ascii=False)[:1500]) for r in d['records']]" 2>&1 | head -20
echo "=== Tarragona CSV"; c "https://opendatafiles.tarragona.cat/00302.csv" | head -c 1500; echo
echo "=== Diba parcs"
c "https://do.diba.cat/api/dataset/actesparcs/format/json/pag-ini/1/pag-fi/5000" | python3 -c "
import json,sys;d=json.load(sys.stdin);e=d.get('elements') or [];f=[x for x in e if (x.get('data_fi') or '')>='2026-10-12'];print('total',len(e),'vigents',len(f),d.get('error'));[print(' ',x['titol'][:60],x['data_inici'],x.get('preu','')[:30],bool(x.get('imatge'))) for x in f[:5]]" 2>&1 | head
for ds in actesparcs_ca actesdiba_ca; do c "https://do.diba.cat/api/dataset/$ds/format/json/pag-ini/1/pag-fi/3" | head -c 200; echo; done
