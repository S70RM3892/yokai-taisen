#!/usr/bin/env python3
# 本家（妖怪ウォッチ2 元祖/本家/真打）の妖怪で、このゲームにまだいない妖怪を src/ext/honke_roster_data.js に書き出す。
#   python3 tools/gen_honke.py
#
# もとのデータ（2026-09 取得。tools/honke_data/ に保存）:
#   gamepedia_yw2.json … 攻略大百科「妖怪大辞典」1 体ずつのページ（ランク・種族・Lv60 の能力値・スキル・こうげき・ようじゅつ・とりつき・必殺技・好物）
#                         https://gamepedia.jp/youkai-yw2/monsters/<id>
#   hrs_yw2.json       … 攻略の部屋（HRS）「妖怪大辞典 全妖怪データ一覧」（わざの威力（わざレベル最大）・弱点）
#                         http://hrs-game.main.jp/youkai_watch2/data/list_00-0.html
#   game8_souls.json   … ゲームエイト「魂一覧」（その妖怪の魂の効果・レア魂）
#                         https://game8.jp/youkai-watch2/504902
import json, re, os, hashlib

ROOT = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(ROOT, "tools", "honke_data")
gp = json.load(open(os.path.join(D, "gamepedia_yw2.json"), encoding="utf-8"))
hrs = {d["name"]: d for d in json.load(open(os.path.join(D, "hrs_yw2.json"), encoding="utf-8"))}
souls = json.load(open(os.path.join(D, "game8_souls.json"), encoding="utf-8"))
SOUL_ALIAS = {"U.S.O.": "USO", "大ヤモリ": "大やもり"}

# このゲームにもういる本家の妖怪（honke_names.js で名前を変えた妖怪と、もとからいる同じ名前の妖怪）
PRESENT = set("""さきがけの助 万尾獅子 ブリー隊長 オオクワノ神 化け草履 ばか頭巾 天狗 むりだ城 シロカベ ガマンモス あせっか鬼 大ガマ びきゃく
河童 から傘お化け 草くいおとこ 肉くいおとこ ひとまか仙人 ミツマタノヅチ ドケチング ろくろ首 しどろもどろ ブシニャン マスクドニャーン 赤鬼 黒鬼""".split())

# 本家の種族 → このゲームの族（陣の効果が同じものに合わせる）
#   イサマシ=ちから・フシギ=ようじゅつ・ゴーケツ=まもり・プリチー=すばやさ・ポカポカ=回復・
#   ウスラカゲ=能力を下げるとりつき・ブキミー=状態のとりつき・ニョロロン=とりつかれにくさ（攻略大百科「種族・陣形」）
TRIBE = {"イサマシ": "takeru", "フシギ": "ayashi", "ゴーケツ": "tsuwamono", "プリチー": "kage", "ポカポカ": "nagomi",
         "ウスラカゲ": "miyabi", "ブキミー": "tatari", "ニョロロン": "shizume", "怪魔": "maga"}
ELEM = {"火": "fire", "水": "water", "雷": "thunder", "土": "earth", "氷": "ice", "風": "wind"}
# 弱点がわからない妖怪は、ようじゅつの属性に弱い属性を弱点、ようじゅつの属性を耐性にする（本家の傾向に寄せた推定）
WEAK_OF = {"fire": "water", "water": "thunder", "thunder": "earth", "earth": "wind", "wind": "fire", "ice": "fire"}
FOOD = {"おにぎり": "onigiri", "パン": "pan", "駄菓子": "dagashi", "チョコボー": "chocobar", "牛乳": "milk", "ジュース": "juice",
        "ハンバーガー": "burger", "ラーメン": "ramen", "寿司": "sushi", "中華": "chuka", "野菜": "yasai", "肉": "niku",
        "魚介": "gyokai", "カレー": "curry", "スイーツ": "sweets", "おでん": "oden", "スナック": "snack", "そば": "soba"}
SG_RANK = {"S": 2, "A": 3, "B": 4, "C": 5, "D": 5, "E": 6}


def tier(s):
    return 2 if ("超" in s or "究極" in s or "どんどん" in s) else 1 if ("大" in s or "だんだん" in s) else 0


def curse_of(s):
    t = tier(s)
    if "混乱" in s: return ("confuse", t)
    if "行動不能" in s or "じゃま" in s: return ("stun", t)
    if "全ステータス" in s: return ("allDown", 0 if "小" in s else t)
    if "ちから" in s or "ようりょく" in s or "ようりょう" in s: return ("weaken", t)
    if "まもり" in s: return ("brittle", t)
    if "すばやさ" in s: return ("slow", t)
    if "HP" in s and ("減" in s): return ("poison", 0 if "少し" in s else t)
    if "さぼ" in s: return ("lazy", t)
    if "お金" in s or "びんぼう" in s: return ("money", 0)
    if "超ダウン" in s: return ("allDown", 2)
    return None


def bless_of(s):
    t = tier(s)
    if "常に敵からねらわれる" in s or "一身" in s: return ("taunt", t)
    if "ねらわれなく" in s or "狙われなく" in s or "相手にされなく" in s or "無視" in s: return ("hide", t)
    if "全ステータス" in s: return ("allUp", 0 if "小" in s else t)
    if "ちから" in s or "ようりょく" in s: return ("rally", t)
    if "まもり" in s: return ("fortify", t)
    if "すばやさ" in s: return ("haste", t)
    if "HP" in s and "回復" in s: return ("regen", 0 if ("少し" in s) else t)
    return None


def num(s, pat=r"いりょく (\d+)(?: x (\d+))?"):
    m = re.search(pat, s)
    return (int(m.group(1)), int(m.group(2) or 1)) if m else (0, 1)


def ult_of(d):
    u = d.get("ult_d", "")
    m = re.match(r"いりょく (\d+)(?: x (\d+))? \((.*?)\)\s*(.*)", u)
    if not m:
        # いりょくのない必殺技（とりつき・回復・解除など）
        if "一身" in u:
            return {"kind": "selfBless", "blessing": "taunt", "tier": tier(u)}, 1
        if "解除" in u: return {"kind": "dispel"}, 1
        if "おはらい" in u: return {"kind": "purifyAll"}, 1
        if "戦闘不能" in u or "復活" in u: return {"kind": "revive", "power": 120}, 1
        if "全回復" in u: return {"kind": "heal", "full": 1}, 1
        if "最強の状態" in u: return {"kind": "heal", "power": 110, "bless": "allUp"}, 1
        if "味方全体の全ステータス" in u: return {"kind": "blessAll", "blessing": "allUp", "tier": 1}, 1
        b = bless_of(u)
        if b and ("アップ" in u or "回復" in u): return {"kind": "blessAll", "blessing": b[0], "tier": b[1]}, 1
        c = curse_of(u)
        if c: return {"kind": "curseAll", "curse": c[0], "tier": c[1]}, 1
        raise SystemExit(f"unknown ult: {d['name']} {u}")
    p, h, tgt, extra = int(m.group(1)), int(m.group(2) or 1), m.group(3), m.group(4)
    total = p * h
    if "回復" in tgt or "味方効果" in tgt or tgt == "味方全体に攻撃":
        o = {"kind": "heal", "power": max(60, min(200, total))}
        if "おはらい" in extra: o["purify"] = 1
        return o, 1
    if "吸収" in tgt:
        return {"kind": "single", "power": total, "drain": 1}, h
    if "一体" in tgt:
        o = {"kind": "single", "power": max(80, total)}
        hits = h
    else:
        o = {"kind": "all", "power": max(60, min(170, round(total * 0.55)))}
        hits = max(1, round(h / 3))
        if "味方" in tgt: o["blast"] = 1
    if "自爆" in extra: o["selfKo"] = 1
    if "キャンセル" in extra: o["cancel"] = 1
    if "外れやすい" in extra: o["gamble"] = 1
    elif "クリティカルが出やすい" in extra: o["crit"] = 1
    if "反動" in extra: o["recoil"] = 250
    if "何が起こるか" in extra or "霊魂" in extra: o["randPow"] = 1
    c = curse_of(extra) if extra else None
    if c and not o.get("selfKo"): o["curse"], o["tier"] = c
    return o, hits


# ---- 魂の効果（ゲームエイトの文）→ このゲームの効果 ----
def soul_fx(text):
    t = text
    s = 0 if ("少し" in t) else 2 if ("大きく" in t or "とても" in t or "どんどん" in t) else 1
    three = lambda a, b, c: [a, b, c][s]
    m = re.match(r"(ちから|力|ようりょく|まもり|すばやさ)[＋+](\d+)", t)
    if m:
        k = {"ちから": "atk", "力": "atk", "ようりょく": "spa", "まもり": "def", "すばやさ": "spd"}[m.group(1)]
        return {}, {k: int(m.group(2))}
    if "HP1で耐える" in t or "HPで1で耐える" in t: return {"endureChance": 350}, {}
    if "さぼったとき" in t: return {"loafHeal": three(50, 100, 150)}, {}
    if "ようきゲージ" in t and ("自分" in t or "じぶん" in t): return {"sgRate": three(120, 250, 400)}, {}
    if "となり" in t and "ようきゲージ" in t: return {"spiritSmoke": three(200, 350, 500)}, {}
    if "両どなり" in t and "吸収" in t: return {"leech": three(10, 20, 30)}, {}
    if "どなり" in t and "HP" in t and "回復" in t: return {"prayer": three(10, 15, 25)}, {}
    if "となり" in t and "HP" in t: return {"prayer": three(10, 15, 25)}, {}
    m = re.search(r"となりにいる妖怪の(ちから|ようりょく|まもり|すばやさ|全ステータス)", t)
    if m:
        k = {"ちから": "atk", "ようりょく": "spa", "まもり": "def", "すばやさ": "spd", "全ステータス": "all"}[m.group(1)]
        return {"aura_" + k: 50 if "少し" in t else 100}, {}
    if "とりつかれにくく" in t: return {"curseResist": three(120, 220, 350)}, {}
    if "とりつくが" in t and "成功" in t: return {"curseHit": 50 if "少し" in t else 100}, {}
    if "ガード中に攻撃" in t: return {"guardThorns": 300}, {}
    if "クリティカルの威力" in t: return {"critDmg": 300}, {}
    if "クリティカル" in t: return {"critEye": three(4, 8, 14)}, {}
    if "ドレイン" in t: return {"drainUp": 250 if "少し" in t else 500}, {}
    if "お金" in t or "経験値" in t or "アイテムを" in t: return {"noBattle": 1}, {}
    if "ピンチ" in t: return {"pinchHeal": 300}, {}
    if "全ての属性" in t: return {f"resist_{e}": 100 for e in ELEM.values()}, {}
    if "味方が気絶" in t: return {"allyKoAtk": 100}, {}
    if "さぼりにくく" in t: return {"teamNoLoaf": 400}, {}
    m = re.match(r"([火水雷土氷風・]+)属性のダメージを(少し|大きく)?軽減", t)
    if m:
        v = {"少し": 150, None: 250, "大きく": 400}[m.group(2)]
        return {f"resist_{ELEM[c]}": v for c in m.group(1).replace("・", "")}, {}
    if "必殺技の" in t and "アップ" in t: return {"ultUp": three(80, 150, 250)}, {}
    if "必殺技を" in t and ("よけ" in t or "避け" in t): return {"ultEvade": 250}, {}
    if "命中" in t: return {"accuracy": three(200, 350, 600)}, {}
    if "吸収" in t or ("HPを大きく回復" in t and "攻撃" in t): return {"drain": three(80, 150, 250)}, {}
    if "よけ" in t or "避け" in t: return {"evade": three(50, 90, 140)}, {}
    if "とりつかれたとき" in t: return {"cursedHeal": 150}, {}
    if "ガードの効果" in t: return {"guardPierce": 300 if "少し" in t else 600}, {}
    if "妖術で受けた" in t: return {"mirror": 150 if "少し" in t else 250}, {}
    if "攻撃で受けた" in t: return {"thorns": 120 if "少し" in t else 200}, {}
    if "ちからとようりょく" in t: return {"conqueror": 60, "conqSpa": 1}, {}
    if "倒したとき" in t: return {"conqueror": 120 if "大" in t else 70}, {}
    if "気絶したとき" in t and "味方" in t: return {"deathHeal": 100 if "少し" in t else 180}, {}
    if "気絶したとき" in t and "敵" in t: return {"grudge": 100 if "小" in t else 180}, {}
    m = re.search(r"真ん中に立.*?(ちから|ちかた|ようりょく|妖力|まもり|すばやさ|全ステータス)", t)
    if m:
        k = {"ちから": "atk", "ちかた": "atk", "ようりょく": "spa", "妖力": "spa", "まもり": "def", "すばやさ": "spd", "全ステータス": "all"}[m.group(1)]
        return {"center_" + k: 60 if "少し" in t else 120}, {}
    if "良いとりつく" in t: return {"blessLong": 500}, {}
    if "自分のHP" in t: return {"regen": three(15, 25, 40)}, {}
    raise SystemExit(f"unknown soul text: {t}")


def nature(d, st, skill_mode, insp_kind):
    hp, atk, spa, df, spd = st
    if skill_mode == "heal" or (insp_kind == "bless" and spa >= atk): return "devoted"
    if df >= max(atk, spa) * 1.05: return "stalwart"
    if insp_kind == "curse" and spd >= max(atk, spa): return "hinder"
    if atk >= spa * 1.3: return "fierce"
    if spa >= atk * 1.3: return "arcane"
    if atk >= spa: return "wild"
    return "balanced"


def seed_of(name):
    return int(hashlib.md5(("honke:" + name).encode()).hexdigest()[:8], 16)


out, skills_used = [], {}
for d in gp:
    if d["name"] in PRESENT: continue
    h = hrs.get(d["name"])
    no = h["no"] if h else d["gid"] - 137  # 怪魔（No.355〜369）は HRS にない
    tribe = TRIBE[d["tribe"]]
    st = d["stats"] if len(d["stats"]) == 5 else h["stats"]  # 攻略大百科に能力値がないときは HRS の Lv60
    # こうげき：威力は HRS（わざレベル最大）。段数は攻略大百科
    ab, ah = num(d["attack_d"])
    if h:
        mm = re.search(r"\((\d+)\)", h["atk"])
        apow = int(mm.group(1)) if mm else int(re.match(r"\d+", h["atk"]).group(0))
    else:
        apow = max(45, min(150, round(ab * ah * 2.2)))
    # ようじゅつ
    mp = d["magic_d"].split(" ")[0]
    mb = num(d["magic_d"])[0]
    spow = int(re.search(r"\d+", h["yojutsu"]).group(0)) if h else {50: 110, 80: 120}.get(mb, 90)
    skill_mode = "heal" if mp == "回復" else "drain" if mp == "吸収" else "dmg"
    selem = ELEM.get(mp)
    # 弱点・耐性
    weak = None
    if h and h["etc"]:
        last = h["etc"][0].split(",")[-1].strip()
        if last.endswith("×") and last[0] in ELEM: weak = ELEM[last[0]]
    if weak is None: weak = WEAK_OF.get(selem)
    resist = selem if selem and selem != weak else None
    # とりつき
    c, b = curse_of(d["insp_d"]), bless_of(d["insp_d"])
    if "アップ" in d["insp_d"] or "回復" in d["insp_d"] or "ねらわれ" in d["insp_d"] or "相手にされ" in d["insp_d"] or "無視" in d["insp_d"] or "狙われ" in d["insp_d"]:
        insp_kind, insp = "bless", b
    else:
        insp_kind, insp = "curse", c
    if insp is None: raise SystemExit(f"unknown insp {d['name']} {d['insp_d']}")
    ult, uhits = ult_of(d)
    # 魂
    sname = SOUL_ALIAS.get(d["name"], d["name"])
    stext = souls.get(sname)
    sfx, smods = soul_fx(stext) if stext else ({}, {})
    e = {
        "id": f"y{no:03d}", "no": no, "name": d["name"], "kana": d["kana"], "rank": d["rank"], "tribe": tribe,
        "hp": st[0], "atk": st[1], "spa": st[2], "def": st[3], "spd": st[4], "sgRank": SG_RANK[d["rank"]],
        "weak": weak, "resist": resist, "skillElement": selem, "attackPower": apow, "skillPower": spow,
        "curse": insp[0] if insp_kind == "curse" else "weaken", "blessing": insp[0] if insp_kind == "bless" else "rally",
        "inspKind": insp_kind, "inspTier": insp[1], "ult": ult, "ultName": d["ult"], "loafPermil": 25,
        "defaultNature": nature(d, st, skill_mode, insp_kind), "trait": "honke", "hskill": d["skill"],
        "attackName": d["attack"], "skillName": d["magic"], "inspName": d["insp"],
    }
    if ah > 1: e["attackHits"] = ah
    if uhits > 1: e["ultHits"] = uhits
    if skill_mode != "dmg": e["skillMode"] = skill_mode
    if d.get("fav") in FOOD: e["fav"] = FOOD[d["fav"]]
    if "元祖" in d["feats"]: e["camp"] = "ganso"
    if "本家" in d["feats"]: e["camp"] = "honke"
    if stext:
        e["soulText"] = stext
        if sfx: e["soulFx"] = sfx
        if smods: e["soulMods"] = smods
    e["seed"] = seed_of(d["name"])
    skills_used[d["skill"]] = d["skill_d"]
    out.append(e)

# レア魂（2 つの魂を合わせてできる魂）
RARE = []
for k, v in souls.items():
    if "【合成】" not in v: continue
    k = k.lstrip("*")
    if not k.endswith("魂"): k += "の魂"
    m = re.search(r"「\s*(.+?)\s*」×「\s*(.+?)\s*」.*【効果】\s*(.*)", v)
    RARE.append({"name": k, "from": [m.group(1), m.group(2)], "text": m.group(3)})

js = ["// このファイルは tools/gen_honke.py が作る（手で直さない）。",
      "// 本家（妖怪ウォッチ2 元祖/本家/真打）の妖怪のうち、このゲームにいなかった分。出典は tools/gen_honke.py の先頭。",
      "var HONKE_ROSTER = ["]
for e in out: js.append("  " + json.dumps(e, ensure_ascii=False) + ",")
js.append("];")
js.append("// 本家のスキル名 → 本家の説明")
js.append("var HONKE_SKILL_TEXT = " + json.dumps(skills_used, ensure_ascii=False, indent=0) + ";")
js.append("// レア魂（合成）")
js.append("var HONKE_RARE_SOULS = " + json.dumps(RARE, ensure_ascii=False, indent=0) + ";")
open(os.path.join(ROOT, "src", "ext", "honke_roster_data.js"), "w", encoding="utf-8").write("\n".join(js) + "\n")
print(f"{len(out)} yokai, {len(skills_used)} skills, {len(RARE)} rare souls")
