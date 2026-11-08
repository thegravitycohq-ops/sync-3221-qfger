# every word the script may use must be drawn by art.tsx (catches drift between vocab.json and the engine)
import json, os, re
d = os.path.join(os.path.dirname(__file__), "..", "src", "r")
v, art = json.load(open(os.path.join(d, "vocab.json"))), open(os.path.join(d, "art.tsx")).read()
miss = []
for k in ("sky", "land", "things"):
    for n in v[k]:
        if not re.search(rf"\b{n}\b\s*:", art) and not (k == "things" and n == "group"):
            miss.append((k, n))
for n in v["fx"]:
    if f"includes('{n}')" not in art:
        miss.append(("fx", n))
for k in ("frame", "cam"):
    for n in v[k]:
        if f"'{n}'" not in art:
            miss.append((k, n))
assert not miss, miss
print("vocab tests ok")
