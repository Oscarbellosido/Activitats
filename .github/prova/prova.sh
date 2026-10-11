#!/bin/bash
UA="Mozilla/5.0 (compatible; ActivitatsCatalunya/1.0; +https://github.com/Oscarbellosido/Activitats)"
c() { curl -sSL -m 60 -A "$UA" -w "  [HTTP %{http_code} %{size_download}B %{url_effective}]\n" "$@"; }
echo "=== robots"; c https://patrimoni.gencat.cat/robots.txt -o /tmp/r; grep -iE "crawl|disallow: /ca/agenda|disallow: /ca/activ|sitemap|^user" /tmp/r | head -20
echo "=== llistat"; c "https://patrimoni.gencat.cat/ca/agenda" -o /tmp/l
python3 - <<'PY'
import re,html
h=open('/tmp/l',encoding='utf-8',errors='replace').read()
links=sorted(set(re.findall(r'href="(/ca/(?:agenda|activitat|activitats|actes)/[^"#?]+)"',h)))
print('LINKS',len(links)); [print(' ',l) for l in links[:15]]
for m in re.findall(r'<(?:link|a)[^>]+(?:rss|ical|ics|feed|json)[^>]*>',h,re.I)[:5]: print('FEED',m)
i=h.find('Avui destaquem'); print('BLOC', re.sub(r'\s+',' ',h[i:i+2500]))
PY
D=$(python3 -c "
import re;h=open('/tmp/l',encoding='utf-8',errors='replace').read()
l=[x for x in re.findall(r'href=\"(/ca/[^\"#?]+)\"',h) if re.search(r'/(agenda|activitat)[^/]*/.+',x)]
print('https://patrimoni.gencat.cat'+l[0] if l else '')")
echo "=== detall $D"; [ -n "$D" ] && c "$D" -o /tmp/d && python3 - <<'PY'
import re
h=open('/tmp/d',encoding='utf-8',errors='replace').read()
for m in re.findall(r'<script[^>]*ld\+json[^>]*>(.*?)</script>',h,re.S)[:2]: print('LDJSON',m[:2000])
for m in re.findall(r'<meta[^>]+(?:og:|name="description")[^>]+>',h)[:8]: print(m[:250])
i=h.find('<h1'); t=re.sub(r'\s+',' ',re.sub(r'<script.*?</script>|<style.*?</style>','',h[i:i+20000],flags=re.S))
print('TEXT', re.sub(r'<[^>]+>',' | ',t)[:3500])
PY
echo "=== sitemap"; c "https://patrimoni.gencat.cat/sitemap.xml" -o /tmp/s; head -c 1200 /tmp/s; echo; grep -o '<loc>[^<]*</loc>' /tmp/s | head -5
