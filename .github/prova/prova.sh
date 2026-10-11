#!/bin/bash
UA="Mozilla/5.0 (compatible; ActivitatsCatalunya/1.0; +https://github.com/Oscarbellosido/Activitats)"
c() { curl -sSL -m 60 -A "$UA" -w "  [HTTP %{http_code} %{size_download}B]\n" "$@"; }
for u in /ca/activitat/visita-guiada-gratuita-fonts-i-patrimoni /ca/activitat/portes-obertes-al-museu-del-barroc-de-catalunya-4; do
echo "=== detall $u"; c "https://patrimoni.gencat.cat$u" -o /tmp/d
python3 - <<'PY'
import re,html
h=open('/tmp/d',encoding='utf-8',errors='replace').read()
for m in re.findall(r'<script[^>]*ld\+json[^>]*>(.*?)</script>',h,re.S)[:2]: print('LDJSON',m[:1500])
for m in re.findall(r'<meta[^>]+(?:og:image|og:title|og:description|name="description")[^>]+>',h)[:6]: print(m[:300])
# camps Drupal
for m in re.finditer(r'<div class="(field[^"]*field-name-[^"]+)"[^>]*>(.*?)</div>\s*</div>\s*</div>',h,re.S):
    t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',m.group(2))).strip()
    if t: print('FIELD', m.group(1)[:90], '=>', html.unescape(t)[:250])
for m in re.findall(r'<(?:span|div)[^>]+class="date-display[^"]*"[^>]*(?:content="[^"]*")?[^>]*>[^<]*',h)[:6]: print('DATE',m[:200])
for m in re.findall(r'(?:data-lat|latitude|lat)["\s:=]+[\'"]?(-?\d+\.\d+)',h)[:3]: print('LAT',m)
PY
sleep 11; done
echo "=== llistat pagina 2 i filtre gratuit"
c "https://patrimoni.gencat.cat/ca/agenda?page=1" -o /tmp/l2; grep -o 'href="/ca/activitat/[^"]*"' /tmp/l2 | sort -u | wc -l
python3 - <<'PY'
import re
h=open('/tmp/l2',encoding='utf-8',errors='replace').read()
i=h.find('/ca/activitat/'); print(re.sub(r'\s+',' ',h[i-1500:i+1200]))
print('PRICE OPTIONS', re.findall(r'<option value="([^"]+)"[^>]*>(Gratuït|Fins a 5 euros|Fins a 10 euros|Més de 10 euros)</option>',h))
print('LAST', re.findall(r'href="([^"]*page=\d+[^"]*)"[^>]*>(?:últim|last|&raquo;|»)',h)[:2])
PY
