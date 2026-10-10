#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
c() { curl -sSL -m 120 -A "$UA" "$@"; }
G="https://guia.barcelona.cat/ca/llistat?pg=search&af=code_prop&wtarget=la-meva-barcelona&nfwt=1&cerca=*:*&sort=proxdate,asc&c=00619*;00619*&tr=619&d=mes"
for nr in 200 1000 5000; do
  s=$(date +%s); c "$G&nr=$nr" -o /tmp/n; echo "nr=$nr: $(grep -c 'class="item"' /tmp/n) items, $(wc -c </tmp/n) B, $(( $(date +%s)-s )) s"; sleep 10
done
c "$G&nr=50" -o /tmp/p
python3 - <<'PY'
import re,html
h=open('/tmp/p',encoding='utf-8',errors='replace').read()
for m in re.finditer(r'<a[^>]+href="([^"]*)"[^>]*>\s*([^<]{1,25})\s*</a>', h):
    t=m.group(2).strip(); u=html.unescape(m.group(1))
    if re.fullmatch(r'\d+|›|»|següent|Següent|>|>>|Seg.*|Últim.*|Next', t): print('PAGLINK', t, '=>', u[:300])
for m in re.findall(r'<(?:ul|div|nav)[^>]+class="[^"]*(?:pag|pager)[^"]*"[^>]*>.{0,1500}', h, re.S)[:2]: print('PAGER', re.sub(r'\s+',' ',m)[:1500])
# item complet amb tots els camps
i=h.find('class="item"'); print('ITEM', re.sub(r'\s+',' ',h[i:i+1500]))
PY
