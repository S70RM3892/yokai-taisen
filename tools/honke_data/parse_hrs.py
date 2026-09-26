import re,json,html
def clean(x): return html.unescape(re.sub(r'<[^>]+>','',x)).strip()
def parse(fn, tribe0=None):
    s=open(fn,encoding='utf-8-sig').read()
    tribe=tribe0; rows=[]
    for m in re.finditer(r'<!--/ (\S+) /-->|<tr><th class="c\d">(.*?)</tr>',s,re.S):
        if m.group(1): tribe=m.group(1); continue
        r=m.group(2); head,rest=r.split('</th>',1)
        num=re.match(r'(\d+)-(\w+):',head)
        name=clean(head.split(':',1)[1]).lstrip('★◎☆◆').strip()
        mark=re.match(r'[★◎☆◆]*',clean(head.split(':',1)[1])).group(0)
        tds=re.findall(r'<td>(.*?)</td>',rest,re.S)
        def lis(x): return [clean(y) for y in re.findall(r'<li>(.*?)</li>',x,re.S)]
        skill=re.search(r'<u>\[(.*?)\]</u><br>(.*?)</li>',tds[3],re.S)
        rows.append(dict(no=int(num.group(1)),rank=num.group(2),name=name,mark=mark,tribe=tribe,atk=clean(tds[0]),yojutsu=clean(tds[1]),ult=lis(tds[2]),skill=clean(skill.group(1)) if skill else None,skilldesc=clean(skill.group(2)) if skill else None,etc=lis(tds[3])[1:],stats=[int(x) if x.isdigit() else x for x in lis(tds[5])]))
    return rows
rows=parse('l00_0.html')
print(len(rows))
from collections import Counter
print(Counter(r['tribe'] for r in rows)); print(Counter(r['rank'] for r in rows))
json.dump(rows,open('yw2.json','w'),ensure_ascii=False,indent=0)
print(rows[-1]); print(max(r['no'] for r in rows))
nos=set(r['no'] for r in rows); print([i for i in range(1,388) if i not in nos])
