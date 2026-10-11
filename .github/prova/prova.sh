#!/bin/bash
UA="Mozilla/5.0 (compatible; ActivitatsCatalunya/1.0; +https://github.com/Oscarbellosido/Activitats)"
curl -sSL -m 60 -A "$UA" "https://patrimoni.gencat.cat/ca/agenda" -o /tmp/l
python3 - <<'PY'
import re,json
h=open('/tmp/l',encoding='utf-8',errors='replace').read()
m=re.search(r'jQuery\.extend\(Drupal\.settings,\s*(\{.*?\})\);\s*</script>',h,re.S) or re.search(r'Drupal\.settings,\s*(\{.*\})\);',h)
if not m: print('NO SETTINGS'); 
else:
  s=json.loads(m.group(1)); g=s.get('gmap',{})
  print('gmap keys', list(g.keys()))
  for k,v in g.items():
    mk=v.get('markers') or []
    print(k,'markers',len(mk)); 
    for x in mk[:3]: print(json.dumps(x,ensure_ascii=False)[:900])
PY
sleep 11
curl -sSL -m 60 -A "$UA" "https://patrimoni.gencat.cat/ca/activitat/visita-guiada-gratuita-fonts-i-patrimoni" -o /tmp/d
python3 - <<'PY'
import re,html
h=open('/tmp/d',encoding='utf-8',errors='replace').read()
i=h.find('region-content'); body=h[i:i+30000]
body=re.sub(r'<script.*?</script>|<style.*?</style>','',body,flags=re.S)
print(re.sub(r'\n\s*\n+','\n',re.sub(r'[ \t]+',' ',body))[:6000])
PY
