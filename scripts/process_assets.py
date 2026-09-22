"""assets_raw/*.png -> public/assets/*.png (+ manifest.json).
Assets are stored at 2x world scale (world size = stored size / 2) so zoom 2x stays sharp.
Run: python3 scripts/process_assets.py
"""
import json, os
from PIL import Image, ImageDraw

RAW, OUT = 'assets_raw', 'public/assets'
S = 2  # storage scale over world units
os.makedirs(OUT, exist_ok=True)
manifest = {}


def load(n):
    return Image.open(f'{RAW}/{n}.png').convert('RGBA')


def trim(im, thr=24):
    a = im.getchannel('A').point(lambda v: 255 if v > thr else 0)
    return im.crop(a.getbbox())


def save(name, im, **meta):
    # WebP with alpha: ~4x smaller than PNG, supported by every current mobile browser.
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=90, method=4)
    manifest[name] = {'w': im.width / S, 'h': im.height / S, **meta}


def fit(im, w=None, h=None):
    if w: h = round(im.height * w / im.width)
    else: w = round(im.width * h / im.height)
    return im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)


# ---- ground tiles: 128x64 world diamonds, inner crop removes the drawn outline
TW, TH = 128 * S, 64 * S
mask = Image.new('L', (TW, TH), 0)
ImageDraw.Draw(mask).polygon([(TW / 2, 0), (TW, TH / 2), (TW / 2, TH), (0, TH / 2)], fill=255)
tile_scale = None
for n in ['tile_grass_a', 'tile_grass_b', 'tile_forest_floor', 'tile_cobble_a', 'tile_cobble_b',
          'tile_dirt_road', 'tile_soil', 'tile_water']:
    t = trim(load(n))
    if tile_scale is None: tile_scale = TW / t.width
    mx, my = t.width * .06, t.height * .06
    t = t.crop((mx, my, t.width - mx, t.height - my)).resize((TW, TH), Image.LANCZOS)
    t.putalpha(mask)
    save(n, t)

# ---- ground decals: split sheet by empty rows/columns
def bands(profile, gap=6):
    out, start, empty = [], None, 0
    for i, v in enumerate(profile + [0] * gap):
        if v:
            if start is None: start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= gap: out.append((start, i - empty + 1)); start = None
    return out

sheet = load('decals_ground')
A = sheet.getchannel('A').point(lambda v: 255 if v > 24 else 0)
W, H = sheet.size
px = A.load()
rows = bands([any(px[x, y] for x in range(0, W, 2)) for y in range(H)])
decals = []
for y0, y1 in rows:
    band = A.crop((0, y0, W, y1)); bp = band.load()
    for x0, x1 in bands([any(bp[x, y] for y in range(0, y1 - y0, 2)) for x in range(W)]):
        piece = trim(sheet.crop((x0, y0, x1, y1)))
        if piece.width < 12: continue
        name = f'decal_{len(decals)}'
        save(name, piece.resize((max(1, round(piece.width * tile_scale * .8)),
                                 max(1, round(piece.height * tile_scale * .8))), Image.LANCZOS))
        decals.append(name)
manifest['_decals'] = decals

# ---- objects: (name, 'w'|'h', world size). Groups share one scale so pieces match.
objects = [
    ('gate_main', 'w', 320), ('lamp_post', 'h', 105), ('torch_stand', 'h', 95), ('banner_bat', 'h', 105),
    ('pine_a', 'h', 240), ('pine_b', 'h', 210), ('pine_c', 'h', 150), ('dead_tree_a', 'h', 200),
    ('dead_tree_b', 'h', 140), ('bush_a', 'h', 62), ('bush_b', 'h', 50), ('rock_a', 'h', 78),
    ('rock_b', 'h', 64), ('rock_c', 'h', 46),
    ('bld_housing_1', 'w', 250), ('bld_housing_2', 'w', 270), ('bld_food_1', 'w', 250), ('bld_food_2', 'w', 290),
    ('bld_collect_1', 'w', 240), ('bld_collect_2', 'w', 320), ('bld_boarding', 'w', 330),
    ('bld_watchtower', 'h', 260), ('castle_cliff', 'w', 350),  # castle: far parallax layer, half resolution is plenty
    ('crates', 'w', 58), ('barrel', 'w', 30), ('bench', 'w', 62), ('carriage', 'w', 190), ('well', 'w', 88),
]
for n, k, v in objects:
    save(n, fit(trim(load(n)), **{k: v * S}))

groups = [(['fence_palisade_ne', 'fence_palisade_nw', 'fence_palisade_post'], 80),
          (['rail_fence_ne', 'rail_fence_nw', 'rail_fence_post'], 76),
          (['stone_wall_ne', 'stone_wall_nw'], 140)]
for names, w in groups:
    ims = [trim(load(n)) for n in names]
    sc = w * S / ims[0].width
    for n, im in zip(names, ims):
        save(n, im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS))

bg = load('backdrop_sky').convert('RGB')
bg.save(f'{OUT}/backdrop_sky.jpg', quality=88)
manifest['backdrop_sky'] = {'w': bg.width, 'h': bg.height}

# ---- human spritesheets: 4x4 grid, one shared bbox per sheet keeps feet aligned
HUMAN_H = 44 * S
for n, nrows in [('human_walk_front', 1), ('human_walk_back', 1), ('human_actions', 3)]:
    im = load(n); cw, ch = im.width / 4, im.height / 4
    cells = [im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
             for r in range(nrows) for c in range(4)]
    boxes = [c.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for c in cells]
    boxes = [b for b in boxes if b]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    frames = [c.crop(box) for c in cells]
    fw, fh = frames[0].size
    sc = HUMAN_H / fh
    fw2, fh2 = round(fw * sc), HUMAN_H
    out = Image.new('RGBA', (fw2 * len(frames), fh2))
    for i, f in enumerate(frames):
        out.alpha_composite(f.resize((fw2, fh2), Image.LANCZOS), (i * fw2, 0))
    save(n, out, frameW=fw2, frameH=fh2, frames=len(frames))


# ---- helpers for sheets whose items are separated by empty space (reading order)
def slice_sheet(im, gap=6, min_size=12):
    a = im.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    pa = a.load(); W, H = im.size
    out = []
    for y0, y1 in bands([any(pa[x, y] for x in range(0, W, 2)) for y in range(H)], gap):
        band = a.crop((0, y0, W, y1)); bp = band.load()
        for x0, x1 in bands([any(bp[x, y] for y in range(0, y1 - y0, 2)) for x in range(W)], gap):
            piece = trim(im.crop((x0, y0, x1, y1)))
            if piece.width >= min_size and piece.height >= min_size: out.append(piece)
    return out

def exists(n): return os.path.exists(f'{RAW}/{n}.png')

# ---- 4x4 character sheets (16 frames: walk front, walk back, 2 action rows). Scale from the walk frames.
CHARS = {'human_b': 44, 'human_c': 44, 'davi': 44, 'lia': 44, 'boris': 50, 'ghoul_worker': 46, 'ghoul_guard': 48,
         'vampire_buyer': 50, 'rubelia': 50, 'hematico': 48, 'aureliano': 50, 'vesper': 52, 'wolf_scout': 60,
         'wolf_hunter': 66, 'wolf_brute': 80, 'wolf_alpha': 88, 'sentinel_vampire': 48, 'gargoyle': 56,
         'alchemist_unit': 42, 'human_actions_2': 44}
for n, h in CHARS.items():
    if not exists(n): continue
    im = load(n); cw, ch = im.width / 4, im.height / 4
    cells = [im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))) for r in range(4) for c in range(4)]
    alpha = [c.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for c in cells]
    boxes = [b for b in alpha if b]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    walk = sorted(b[3] - b[1] for b in alpha[:8] if b) or sorted(b[3] - b[1] for b in boxes)
    sc = h * S / walk[len(walk) // 2]
    fw, fh = round((box[2] - box[0]) * sc), round((box[3] - box[1]) * sc)
    out = Image.new('RGBA', (fw * 16, fh))
    for i, c in enumerate(cells):
        out.alpha_composite(c.crop(box).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    save(n, out, frameW=fw, frameH=fh, frames=16)

# ---- effects: row 1 of a 4x4 grid = 4 frames sharing one box
for n in ['fx_dust', 'fx_hit', 'fx_smoke', 'fx_sparkle', 'fx_blood_drop', 'fx_bolt', 'fx_bomb', 'fx_bell_wave', 'fx_fear', 'fx_coins']:
    if not exists(n): continue
    im = load(n); cw = im.width / 4
    cells = [im.crop((round(c * cw), 0, round((c + 1) * cw), round(cw))) for c in range(4)]
    boxes = [b for b in (c.getchannel('A').getbbox() for c in cells) if b]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    sc = 0.5 * 1024 / im.width
    fw, fh = max(1, round((box[2] - box[0]) * sc)), max(1, round((box[3] - box[1]) * sc))
    out = Image.new('RGBA', (fw * 4, fh))
    for i, c in enumerate(cells): out.alpha_composite(c.crop(box).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    save(n, out, frameW=fw, frameH=fh, frames=4)

# ---- portraits (dialogue): square, not trimmed so framing stays identical
for n in ['vesper', 'boris', 'rubelia', 'hematico', 'aureliano', 'davi', 'lia', 'ulf', 'inspector', 'merchant']:
    k = f'portrait_{n}'
    if exists(k): save(k, load(k).resize((256, 256), Image.LANCZOS))

# ---- buildings II and props
more = [('bld_housing_3', 'w', 290), ('bld_lab', 'w', 260), ('bld_market', 'w', 270), ('bld_shelter', 'w', 230),
        ('bld_bell', 'h', 150), ('gate_reinforced', 'w', 320), ('bld_guard_post', 'w', 200), ('bld_sentinel_tower', 'h', 250),
        ('bld_site_small', 'w', 250), ('bld_site_large', 'w', 330), ('palisade_broken_ne', 'w', 150), ('palisade_broken_nw', 'w', 150),
        ('hand_cart', 'w', 90), ('fire_pit', 'w', 80), ('rubble', 'w', 200), ('plot_marker', 'w', 250), ('mattress_pile', 'w', 70),
        ('crate_vials', 'w', 60)]
for n, k, v in more:
    if exists(n): save(n, fit(trim(load(n)), **{k: v * S}))

def grid_pieces(im, cols, rows):
    cw, ch = im.width / cols, im.height / rows
    m = 0.05  # inset: drop any grid lines drawn between cells
    return [trim(im.crop((round((c + m) * cw), round((r + m) * ch), round((c + 1 - m) * cw), round((r + 1 - m) * ch))))
            for r in range(rows) for c in range(cols)]

def save_pieces(sheet, names, h=None, scale=None, grid=None):
    pieces = grid_pieces(load(sheet), *grid) if grid else slice_sheet(load(sheet))
    for name, pc in zip(names, pieces):
        save(name, fit(pc, h=h * S) if h else pc.resize((max(1, round(pc.width * scale)), max(1, round(pc.height * scale))), Image.LANCZOS))
    return len(pieces)

if exists('markers_sheet'):
    manifest['_markers'] = save_pieces('markers_sheet', ['mk_hungry', 'mk_sleep', 'mk_event', 'mk_happy', 'mk_angry',
                                                         'mk_contract', 'mk_recover', 'mk_talk', 'mk_star', 'mk_danger'], h=20)
if exists('props_misc'):
    im = load('props_misc')
    manifest['_props_misc'] = save_pieces('props_misc', [f'prop_{i}' for i in range(12)], scale=420 * S / im.width)
# UI icons: stored at 64px tall, used by the HTML HUD
if exists('icons_hud1'):
    save_pieces('icons_hud1', ['icon_blood', 'icon_gold', 'icon_prestige', 'icon_population', 'icon_morale',
                               'icon_tension', 'icon_defense', 'icon_vitality', 'icon_research', 'icon_time'], h=32, grid=(5, 2))
if exists('icons_hud3'):
    save_pieces('icons_hud3', ['blood_rubra', 'blood_lunar', 'blood_ambar', 'blood_umbra', 'blood_carmesim',
                               'quality_comum', 'quality_especial', 'quality_raro', 'quality_excepcional', 'icon_lock'], h=32, grid=(5, 2))
for n in ['icon_build', 'icon_contracts', 'icon_map', 'icon_codex', 'icon_settings', 'icon_bell', 'icon_collect',
          'icon_classify', 'icon_upgrade', 'icon_quest']:
    if exists(n): save(n, fit(trim(load(n)), h=32 * S))

json.dump(manifest, open(f'{OUT}/manifest.json', 'w'), indent=1)
print(len(manifest), 'assets; decals:', len(decals))
