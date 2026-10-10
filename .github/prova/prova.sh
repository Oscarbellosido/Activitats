#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
c() { curl -sSL -m 120 -A "$UA" -w "  [HTTP %{http_code} %{size_download}B %{time_total}s %{url_effective}]\n" "$@"; }
B="https://guia.barcelona.cat/ca/llistat?pg=search&tipuscerca=agenda&cerca=*:*&tr=619&c=00619*&sort=proxdate,asc"
for q in "nr=50" "nr=50&d=mes" "nr=200&d=mes" "nr=1000&d=mes"; do
  c "$B&$q" -o /tmp/n; echo "$q: $(grep -c 'class="item"' /tmp/n) items"; sleep 12
done
c "$B&nr=50&d=mes" -o /tmp/p
python3 - <<'PY'
import re,html
h=open('/tmp/p',encoding='utf-8',errors='replace').read()
for m in re.finditer(r'<a[^>]+href="([^"]*)"[^>]*>\s*([^<]{1,25})\s*</a>', h):
    t=m.group(2).strip(); u=html.unescape(m.group(1))
    if re.fullmatch(r'\d+|›|»|següent|Següent|>|>>|Seg.*|Últim.*|Next|Consulta.*', t): print('PAGLINK', t, '=>', u[:300])
for m in re.findall(r'<(?:ul|div|nav)[^>]+class="[^"]*(?:pag|pager)[^"]*"[^>]*>.{0,1500}', h, re.S)[:2]: print('PAGER', re.sub(r'\s+',' ',m)[:1500])
i=h.find('class="item"'); print('ITEM', re.sub(r'\s+',' ',h[i:i+1500]))
PY
