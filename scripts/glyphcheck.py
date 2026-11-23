from fontTools.ttLib import TTFont
import glob, sys

sample = "ێڵۆڕەڤئەنتیکەبەخێربێیتوەسڵیسندقبضمحمدکارزان"
chars = sorted(set(sample))
files = sorted(glob.glob("apps/web/public/fonts/arkan/*.woff2"))
for path in files:
    f = TTFont(path)
    cmap = f.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    print(path.split("\\")[-1], "glyphs:", len(cmap), "missing:", "".join(missing) or "-",
          "| U+06C7:", 0x06C7 in cmap, "| U+06CE:", 0x06CE in cmap)
