#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
c() { curl -sSL -m 60 -A "$UA" "$@"; }
B=https://opendata-ajuntament.barcelona.cat/data/api/action
for p in agenda-cultural agenda-diaria; do
  echo "=== CKAN $p"
  c "$B/package_show?id=$p" | python3 -c "
import json,sys
d=json.load(sys.stdin)['result']
print('mod',d.get('metadata_modified')); print('DESC',(d.get('dataset_fields_description') or '')[:2500])
for x in d['resources']: print('RES',x.get('id'),x.get('name'),x.get('format'),x.get('last_modified'),x.get('datastore_active'),x.get('url'))
" 2>&1 | head -40
done
for id in 877ccf66-9106-4ae2-be51-95a9f6469e4c da9e71de-0f8e-417d-928a-56380bfd0231 3abb2414-1ee0-446e-9c25-380e938adb73 59b9c807-f6c1-4c10-ac51-1ace65485079; do
  echo "=== datastore $id"; c "$B/datastore_search?resource_id=$id&limit=1" | head -c 1500; echo
done
echo "=== download amb curl per defecte"; curl -sSL -m 60 -o /tmp/d -w "%{http_code} %{content_type} %{size_download} %{url_effective}\n" "https://opendata-ajuntament.barcelona.cat/data/dataset/a25e60cd-3083-4252-9fce-81f733871cb1/resource/877ccf66-9106-4ae2-be51-95a9f6469e4c/download"; head -c 300 /tmp/d; echo
echo "=== guia llistat agenda"
c "https://guia.barcelona.cat/ca/llistat?pg=search&cerca=*:*&tr=618,619&sort=proxdate,asc&af=code_prop&c=00618*,00619*&nr=50&d=avui" -o /tmp/g; wc -c /tmp/g
grep -o 'href="[^"]*detall/[^"]*"' /tmp/g | sort -u | head -8; grep -c 'detall/' /tmp/g
grep -oiE '(application/ld\+json|ical|\.ics|format=json|data-lat[^ ]*|data-lng[^ ]*|resultats[^<]{0,80})' /tmp/g | sort | uniq -c | head -20
D=$(grep -o 'https\?://guia.barcelona.cat/ca/detall/[^"]*' /tmp/g | head -1); [ -z "$D" ] && D="https://guia.barcelona.cat$(grep -o '/ca/detall/[^"]*' /tmp/g | head -1)"
echo "=== detall $D"; c "$D" -o /tmp/det; wc -c /tmp/det
grep -oiE '(application/ld\+json.{0,1500}|[^"]*\.ics[^"]*|og:[a-z]+" content="[^"]{0,120})' /tmp/det | head -15
echo "=== diba recomptes"
for ds in actesturisme_ca actesbiblioteques_ca actesmuseus actesmuseus_ca; do
  c "https://do.diba.cat/api/dataset/$ds/format/json/pag-ini/1/pag-fi/5000" -o /tmp/$ds.json
  python3 - "$ds" <<'PY'
import json,sys
ds=sys.argv[1]
try: d=json.load(open('/tmp/'+ds+'.json'))
except Exception as e: print(ds,'ERR',e); sys.exit()
el=d.get('elements') or []
fut=[e for e in el if (e.get('data_fi') or e.get('data_inici') or '')>='2026-10-10']
print(ds,'total',len(el),'vigents',len(fut),'error',d.get('error'))
if fut:
  e=fut[0]; print(' claus',list(e.keys()))
  for k in ('titol','data_inici','data_fi','preu','tipus','public','tags','categoria','imatge','acte_url','grup_adreca'): print('  ',k,'=',json.dumps(e.get(k),ensure_ascii=False)[:250])
  import collections
  print(' preus',collections.Counter((x.get('preu') or '')[:30] for x in fut).most_common(8))
  print(' tipus',collections.Counter(t for x in fut for t in (x.get('tipus') or [])).most_common(12))
  print(' amb imatge',sum(1 for x in fut if x.get('imatge')),'amb coords',sum(1 for x in fut if (x.get('grup_adreca') or {}).get('localitzacio')))
PY
done
