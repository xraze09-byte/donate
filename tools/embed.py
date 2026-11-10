#!/usr/bin/env python3
"""Embed tools/theme.css + tools/brand.js into index.html between markers.
Idempotent: run `python3 tools/embed.py` after editing either source file."""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
html_p = ROOT / 'index.html'
html = html_p.read_text(encoding='utf-8')
css = (ROOT / 'tools/theme.css').read_text(encoding='utf-8').rstrip()
js = (ROOT / 'tools/brand.js').read_text(encoding='utf-8').rstrip()
if '</style' in css.lower() or '</script' in js.lower():
    sys.exit('source contains a closing tag; refusing to embed')
CSS_BLOCK = f'<style id="u-theme-css">\n{css}\n</style>'
JS_BLOCK = f'<script id="u-theme-js">\n{js}\n</script>'
def put(h, start, end, block, anchor):
    pat = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.S)
    new = f'{start}\n{block}\n{end}'
    if pat.search(h):
        return pat.sub(lambda m: new, h, count=1)
    if anchor not in h:
        sys.exit(f'anchor {anchor!r} not found')
    i = h.rindex(anchor)
    return h[:i] + new + '\n' + h[i:]
html = put(html, '<!-- @u-theme-css:start -->', '<!-- @u-theme-css:end -->', CSS_BLOCK, '</head>')
html = put(html, '<!-- @u-theme-js:start -->', '<!-- @u-theme-js:end -->', JS_BLOCK, '</body>')
html_p.write_text(html, encoding='utf-8')
print('embedded: css %d bytes, js %d bytes' % (len(css), len(js)))
