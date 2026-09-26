import re,html,json,glob
def cl(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
out=[]
for f in sorted(glob.glob('gp/m*.html'),key=lambda x:int(re.findall(r'\d+',x)[0])):
    s=open(f,encoding='utf-8').read()
    if 'ページが見つかりません' in s or '<small>/ ' not in s or 'btn-monster_rank-' not in s: continue
    gid=int(re.findall(r'\d+',f)[0])
    h2=re.search(r'<h2  class="">(.*?)<small>/ (.*?)</small>',s,re.S)
    name=cl(h2.group(1)); kana=cl(h2.group(2))
    rank=re.search(r'btn-monster_rank-(\w+)"',s).group(1)
    sp=re.search(r'btn-monster_species-(\S+?)"',s).group(1)
    feats=re.findall(r'btn-monster_feature-(\S+?)"',s)
    fav=re.search(r'好物</span>.*?<span>(.*?)</span>',s,re.S)
    stats=[int(x) for x in re.findall(r'<div style="margin:0 auto; width:30px;">(\d+)</div>',s)[:5]]
    d=dict(gid=gid,name=name,kana=kana,rank=rank,tribe=sp,feats=feats,fav=cl(fav.group(1)) if fav else None,stats=stats)
    for kind,key in [('skill','skill'),('attack','attack'),('magic','magic'),('possesion','insp'),('special','ult')]:
        m=re.search(r'media-monster-%s">\s*<a[^>]*>\s*<div[^>]*><span class="weak">[^<]*</span>(.*?)</div>(.*?)</a>'%kind,s,re.S)
        if m: d[key]=cl(m.group(1)); d[key+'_d']=cl(m.group(2))
    out.append(d)
print(len(out))
json.dump(out,open('gp.json','w'),ensure_ascii=False,indent=0)
for d in out[:3]+out[-3:]: print(d)
from collections import Counter
print(Counter(d['tribe'] for d in out))
