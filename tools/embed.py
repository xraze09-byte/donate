#!/usr/bin/env python3
"""Embed tools/*.css|js into index.html between markers. Idempotent: run `python3 tools/embed.py` after editing any source.
Order matters for JS: brand.js (theme engine) -> guard.js (security) -> p5.js (skin runtime, uses DonationGuard)."""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
html_p = ROOT / 'index.html'
html = html_p.read_text(encoding='utf-8')
def src(name):
    t = (ROOT / 'tools' / name).read_text(encoding='utf-8').rstrip()
    if '</style' in t.lower() or '</script' in t.lower():
        sys.exit(name + ': contains a closing tag; refusing to embed')
    return t
def put(h, start, end, block, anchor):
    pat = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.S)
    new = f'{start}\n{block}\n{end}'
    if pat.search(h):
        return pat.sub(lambda m: new, h, count=1)
    if anchor not in h:
        sys.exit(f'anchor {anchor!r} not found')
    i = h.rindex(anchor)
    return h[:i] + new + '\n' + h[i:]
# CSS: theme.css then p5.css (p5 rules are scoped to html[data-skin="persona"], so order only matters for ties)
html = put(html, '<!-- @u-theme-css:start -->', '<!-- @u-theme-css:end -->', f'<style id="u-theme-css">\n{src("theme.css")}\n</style>', '</head>')
html = put(html, '<!-- @p5-css:start -->', '<!-- @p5-css:end -->', f'<style id="p5-css">\n{src("p5.css")}\n</style>', '</head>')
html = put(html, '<!-- @u-theme-js:start -->', '<!-- @u-theme-js:end -->', f'<script id="u-theme-js">\n{src("brand.js")}\n</script>', '</body>')
html = put(html, '<!-- @guard-js:start -->', '<!-- @guard-js:end -->', f'<script id="guard-js">\n{src("guard.js")}\n</script>', '</body>')
html = put(html, '<!-- @p5-js:start -->', '<!-- @p5-js:end -->', f'<script id="p5-js">\n{src("p5.js")}\n</script>', '</body>')
html_p.write_text(html, encoding='utf-8')
print('embedded: theme.css+p5.css, brand.js+guard.js+p5.js')
