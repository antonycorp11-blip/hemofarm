"""Generate a game asset with Google's image model (Nano Banana) and drop it in assets_raw/ with a transparent background.
The key is read from .env.local (GEMINI_API_KEY), never from the command line.

  python3 scripts/gen_image.py NAME "prompt" [--ref raw1,raw2] [--model gemini-2.5-flash-image] [--aspect 1:1] [--keep-bg]

--ref: existing sprites in assets_raw/ sent as style references (the model matches palette, outline and proportions).
The model is asked for a flat magenta (#FF00FF) background, which is keyed out here.
"""
import argparse, base64, io, json, os, sys, time, urllib.error, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets_raw')


def key():
    for line in open(os.path.join(ROOT, '.env.local')):
        if line.startswith('GEMINI_API_KEY='): return line.split('=', 1)[1].strip()
    sys.exit('GEMINI_API_KEY missing in .env.local')


def ref_part(name, size=768):
    im = Image.open(os.path.join(RAW, f'{name}.png')).convert('RGBA')
    im.thumbnail((size, size))
    bg = Image.new('RGBA', im.size, (255, 0, 255, 255))   # show references on the same magenta we ask for
    bg.alpha_composite(im)
    buf = io.BytesIO(); bg.convert('RGB').save(buf, 'PNG')
    return {'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(buf.getvalue()).decode()}}


def generate(prompt, refs, model, aspect, tries=3):
    body = {'contents': [{'parts': [{'text': prompt}] + [ref_part(r) for r in refs]}],
            'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': aspect}}}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    for attempt in range(tries):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'x-goog-api-key': key(), 'Content-Type': 'application/json'})
        try:
            d = json.load(urllib.request.urlopen(req, timeout=240))
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:500]
            if e.code in (429, 500, 503) and attempt < tries - 1:
                time.sleep(20 * (attempt + 1)); continue
            sys.exit(f'HTTP {e.code}: {msg}')
        for c in d.get('candidates', []):
            for p in c.get('content', {}).get('parts', []):
                data = p.get('inlineData') or p.get('inline_data')
                if data: return Image.open(io.BytesIO(base64.b64decode(data['data']))).convert('RGBA')
        if attempt == tries - 1: sys.exit(f'no image in response: {json.dumps(d)[:500]}')
    return None


def key_magenta(im):
    """Magenta → transparent, with a soft edge and de-spill so outlines don't keep a pink fringe."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            m = min(r, b) - g                       # how "magenta" the pixel is
            if m > 150 and r > 170 and b > 170: px[x, y] = (0, 0, 0, 0)
            elif m > 60 and r > 120 and b > 120:
                k = (m - 60) / 90                   # partial: fade and pull the pink out
                px[x, y] = (int(r - (r - g) * k), g, int(b - (b - g) * k), int(a * (1 - k)))
    return im


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('name'); ap.add_argument('prompt')
    ap.add_argument('--ref', default=''); ap.add_argument('--model', default='gemini-2.5-flash-image')
    ap.add_argument('--aspect', default='1:1'); ap.add_argument('--keep-bg', action='store_true')
    a = ap.parse_args()
    im = generate(a.prompt, [r for r in a.ref.split(',') if r], a.model, a.aspect)
    if not a.keep_bg: im = key_magenta(im)
    out = os.path.join(RAW, f'{a.name}.png')
    im.save(out)
    print(f'{out} {im.size}')
