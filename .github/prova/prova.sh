#!/bin/bash
UA="Mozilla/5.0 (compatible; ActivitatsCatalunya/1.0; +https://github.com/Oscarbellosido/Activitats)"
for pair in "hospitalet:fd1d251a-fa70-4522-b805-a964f063c6c8" "gava:f2caf121-c752-4347-8f70-9f633954be5e" "vilanova:22d7de56-2769-401b-ae03-4c2fee0e92d1" "santandreu:e7a5b4c8-c0ef-4de4-b462-ef816144aa18" "pladurgell1:c49378f3-3b8b-4506-b0e7-7dff80ee9e10" "pladurgell2:008f0e20-d2ae-41f1-8ade-0061bd28395f" "stacoloma:a5e2d374-2548-45f1-960f-c39fe10e9ba6" "santfeliu:6353e8e8-53ea-47d9-b121-c4bdeac915a5" "arenys:f1b28caf-63d5-4234-8ccb-49c9e9a45893" "castellar:a43451c8-a27a-42dd-91ff-28538de892f7" "prat:07dff259-89ab-4540-b5f8-aa59f9dcd24e" "santjust:c548687b-bca6-4b22-ad4a-96771adfd114" "stquirze:bd83115d-98fa-4fba-b5f2-7cf1e3d9718f" "lleida:26d2cce7-a7a1-4b67-8180-1cea9baff456"; do
  n=${pair%%:*}; id=${pair#*:}
  echo "=== $n $id"
  curl -sSL -m 90 -A "$UA" "https://dadesobertes.seu-e.cat/api/action/datastore_search?resource_id=$id&limit=32000" -o /tmp/d.json
  python3 - <<'PY'
import json,re
try: d=json.load(open('/tmp/d.json'))['result']
except Exception as e:
  print('NO DATASTORE', open('/tmp/d.json',errors='replace').read()[:300]); raise SystemExit
f=[x['id'] for x in d['fields']]; recs=d['records']; print('total',d.get('total'),'fields',f)
# troba camps de data
dates=[k for k in f if any(isinstance(r.get(k),str) and re.match(r'\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}',r.get(k) or '') for r in recs[:50])]
print('camps data',dates)
def iso(v):
  v=str(v or ''); m=re.match(r'(\d{4})-(\d{2})-(\d{2})',v) or None
  if m: return m.group(0)
  m=re.match(r'(\d{2})/(\d{2})/(\d{4})',v); return f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else ''
if dates:
  k=dates[-1] if len(dates)>1 else dates[0]
  fut=[r for r in recs if iso(r.get(k))>='2026-10-12']
  print('futures segons',k,':',len(fut))
  for r in (fut[:2] or recs[-2:]): print(json.dumps(r,ensure_ascii=False)[:900])
else:
  for r in recs[:2]: print(json.dumps(r,ensure_ascii=False)[:900])
PY
done
echo "=== resources lleida (RSS)"; curl -sSL -m 60 -A "$UA" "https://dadesobertes.seu-e.cat/api/3/action/package_show?id=lleida-turisme-lleida" | python3 -c "import json,sys;r=json.load(sys.stdin)['result'];[print(x.get('format'),x.get('url')) for x in r['resources']]"
