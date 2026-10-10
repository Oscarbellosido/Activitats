#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
c() { curl -sSL -m 90 -A "$UA" "$@"; }
G="https://guia.barcelona.cat/ca/llistat"
c "$G?pg=search&tipuscerca=agenda&cerca=*:*&tr=619&c=00619*&sort=proxdate,asc&nr=50" -o /tmp/g; wc -c /tmp/g
python3 - <<'PY'
import re,html
h=open('/tmp/g',encoding='utf-8',errors='replace').read()
print('TITLE', re.search(r'<title>(.*?)</title>',h,re.S).group(1)[:150])
for m in re.finditer(r'<a[^>]+href="([^"]*pg=search[^"]*)"[^>]*>(.*?)</a>', h, re.S):
    t=re.sub(r'<[^>]+>','',m.group(2)).strip()
    u=html.unescape(m.group(1))
    if t: print('LINK', t[:60], '=>', re.sub(r'.*?\?','?',u)[:260])
for m in re.findall(r'(?:Pàgina|pàgina|Següent|seguent|next|page)[^<]{0,80}', h)[:10]: print('PAG', m)
i=h.find('class="item"'); j=h.rfind('class="item"'); print('ULTIM ITEM+PEU', re.sub(r'\s+',' ',h[j:j+3500]))
print('NITEMS', h.count('class="item"'))
PY
echo "=== amb dates i pàgina 2"
for q in "d=setmana" "d=mes" "df=10/10/2026&dt=10/11/2026" "dini=10/10/2026&dfi=10/11/2026" "pagina=2" "page=2" "pg=search&st=50" "start=50"; do
  c "$G?pg=search&tipuscerca=agenda&cerca=*:*&tr=619&c=00619*&sort=proxdate,asc&nr=50&$q" -o /tmp/q
  echo "$q : $(grep -c 'class="item"' /tmp/q) items, primer: $(grep -o 'detall/[^"]*' /tmp/q | sed -n 1p) | quan: $(grep -o 'Quan:</dt><dd>[^<]*' /tmp/q | sed -n 1p) | total: $(grep -oE '[0-9.]+ resultats' /tmp/q | head -1)"
done
