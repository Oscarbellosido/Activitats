#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
c() { curl -sSL -m 90 -A "$UA" "$@"; }
echo "=== diba filtres"
for u in "actesbiblioteques_ca/format/json/pag-ini/1/pag-fi/3/camp-data_inici-gte/2026-10-10" \
         "actesbiblioteques_ca/format/json/pag-ini/1/pag-fi/3/ordre/data_inici/desc" \
         "actesbiblioteques_ca/format/json/pag-ini/1/pag-fi/3/camp-data_inici/2026-10-1" \
         "actesbiblioteques_ca/format/json/pag-ini/1/pag-fi/3/camp-data_fi-gte/2026-10-10" \
         "actesbiblioteques_ca/format/json/pag-ini/1/pag-fi/3/data_inici-gte/2026-10-10"; do
  echo "-- $u"; c "https://do.diba.cat/api/dataset/$u" | python3 -c "import json,sys;d=json.load(sys.stdin);e=d.get('elements') or [];print(d.get('error'),len(e),[x['data_inici'] for x in e])" 2>&1 | head -3
done
for ds in actesbiblioteques_ca actesmuseus; do
  tot=0; vig=0
  for i in 0 1 2 3 4 5 6 7 8 9 10 11; do
    a=$((i*5000+1)); b=$((a+4999))
    c "https://do.diba.cat/api/dataset/$ds/format/json/pag-ini/$a/pag-fi/$b" -o /tmp/p.json
    r=$(python3 -c "import json;d=json.load(open('/tmp/p.json'));e=d.get('elements') or [];print(len(e),sum(1 for x in e if (x.get('data_fi') or '')>='2026-10-10'),min([x['data_inici'] for x in e] or ['-']),max([x['data_inici'] for x in e] or ['-']))" 2>&1)
    echo "$ds pag $a: $r"; n=$(echo $r|cut -d' ' -f1); [ "$n" = "0" ] && break; [[ "$n" =~ ^[0-9]+$ ]] || break
  done
done
echo "=== guia agenda llistat"
c "https://guia.barcelona.cat/ca/llistat?pg=search&tipuscerca=agenda&cerca=*:*&tr=619&c=00619*&sort=proxdate,asc&nr=50&d=avui" -o /tmp/g; wc -c /tmp/g
grep -c 'detall/' /tmp/g; grep -oE 'Resultats[^<]{0,120}|[0-9.]+ resultats' /tmp/g | head -3
python3 - <<'PY'
import re
h=open('/tmp/g',encoding='utf-8',errors='replace').read()
i=h.find('detall/')
print(h[max(0,i-2500):i+2500])
PY
D=$(grep -oE 'detall/[^"]+_[0-9]+\.html' /tmp/g | head -1)
echo "=== detall $D"; c "https://guia.barcelona.cat/ca/$D" -o /tmp/det; wc -c /tmp/det
python3 - <<'PY'
import re
h=open('/tmp/det',encoding='utf-8',errors='replace').read()
for m in re.findall(r'<script[^>]*ld\+json[^>]*>(.*?)</script>', h, re.S)[:2]: print('LDJSON', m[:2500])
for m in re.findall(r'<meta[^>]+(?:og:|itemprop|geo)[^>]+>', h)[:15]: print(m[:200])
i=h.find('<h1'); print(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' | ',h[i:i+4000]))[:1800])
PY
echo "=== ckan reintent"; c -m 150 "https://opendata-ajuntament.barcelona.cat/data/api/action/package_search?q=agenda&rows=30" | python3 -c "
import json,sys
for r in json.load(sys.stdin)['result']['results']: print(r['name'], r.get('metadata_modified'), [x.get('format') for x in r['resources']])" 2>&1 | head -30
