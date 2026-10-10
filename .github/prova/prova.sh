#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
B1="https://guia.barcelona.cat/ca/llistat?pg=search&tipuscerca=agenda&cerca=*:*&tr=619&c=00619*&sort=proxdate,asc&d=mes&nr=500"
B2="https://guia.barcelona.cat/ca/llistat?pg=search&af=code_prop&wtarget=la-meva-barcelona&nfwt=1&cerca=*:*&sort=proxdate,asc&c=00619*;00619*&tr=619&d=mes&nr=500"
B3="https://guia.barcelona.cat/ca/llistat?pg=search&af=code_prop&wtarget=la-meva-barcelona&nfwt=1&cerca=*:*&sort=proxdate,asc&c=00619*;00619*&tr=619&nr=500"
m() { curl -sSL -m 120 -A "$UA" "$1" -o /tmp/q; python3 - "$2" <<'PY'
import re,sys
h=open('/tmp/q',encoding='utf-8',errors='replace').read()
its=re.findall(r'<h3><a href="detall/[^"]+_(\d+)\.html"',h)
fac=dict((k,int(v)) for k,v in re.findall(r'(districtstr=[^"&]+|code0=\d+)"[^>]*>[^<]*\((\d+)\)',h))
print(f"{sys.argv[1]:45s} items={len(its)} primers={its[:3]} Musica={fac.get('code0=0061901019')} Gracia={fac.get('districtstr=Gràcia')} CV={fac.get('districtstr=Ciutat+Vella')}")
PY
sleep 11; }
m "$B1&code0=0061901019" "B1 musica"
m "$B1&code0=0061901019&districtstr=Gr%C3%A0cia" "B1 musica+gracia (codificat)"
m "$B1&code0=0061901019&districtstr=Gràcia" "B1 musica+gracia (literal)"
m "$B2&code0=0061901019" "B2 musica"
m "$B2&code0=0061901019&districtstr=Gr%C3%A0cia" "B2 musica+gracia"
m "$B2&code0=0061901019&districtstr=Ciutat+Vella" "B2 musica+CV"
m "$B2&districtstr=Gr%C3%A0cia" "B2 gracia"
m "$B3" "B3 sense d (tot)"
m "$B3&code0=0061901019" "B3 musica sense d"
