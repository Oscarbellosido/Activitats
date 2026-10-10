#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
for q in "amics+de+les+arts" "tete+bebo" "park+g%C3%BCell" "festival+de+jazz"; do
  curl -sSL -m 90 -A "$UA" "https://guia.barcelona.cat/ca/llistat?pg=search&tipuscerca=agenda&cerca=$q&tr=619&c=00619*&sort=proxdate,asc&nr=100" -o /tmp/q
  echo "=== $q"
  python3 - <<'PY'
import re,html
h=open('/tmp/q',encoding='utf-8',errors='replace').read()
for b in h.split('<div class="item"')[1:]:
    t=re.search(r'<h3><a href="([^"]+)">(.*?)</a>',b,re.S); q=re.search(r'Quan:</dt>\s*<dd>(.*?)</dd>',b,re.S); o=re.search(r'On:</dt>\s*<dd>(.*?)</dd>',b,re.S)
    if t: print(' -', html.unescape(re.sub('<[^>]+>','',t.group(2))).strip(), '|', re.sub('<[^>]+>','',q.group(1)).strip() if q else '', '|', re.sub('<[^>]+>','',o.group(1)).strip()[:60] if o else '', '|', t.group(1))
codes=re.findall(r'code0=(\d+)"[^>]*>([^<]*\(\d+\))',h)
print('  tipus:', codes[:12])
PY
  sleep 11
done
