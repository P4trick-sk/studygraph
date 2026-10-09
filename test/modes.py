"""Standalone vs viewer behaviour. Needs a server: studygraph serve /tmp/demo-site --port 8765"""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); NM = os.path.join(ROOT, 'node_modules') + '/'
MAP = {'marked.min.js': NM + 'marked/marked.min.js', 'katex.min.js': NM + 'katex/dist/katex.min.js', 'cytoscape.min.js': NM + 'cytoscape/dist/cytoscape.min.js'}
def handler(route):
    u = route.request.url
    for k, v in MAP.items():
        if u.endswith(k): return route.fulfill(path=v, content_type='application/javascript')
    if u.startswith('file:') or u.startswith('http://localhost'): return route.continue_()
    return route.abort()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 800}); pg.route('**/*', handler)
    pg.goto('http://localhost:8765/index.html#/'); pg.wait_for_timeout(800)
    print('standalone open button:', pg.evaluate("!!document.querySelector('#openCourse')"), '| footer:', pg.inner_text('.page p.faint.small:last-child'))
    pg.goto('http://localhost:8765/index.html#/stats'); pg.wait_for_timeout(300); print('stats open button:', pg.evaluate("!!document.querySelector('#cOpen')"))
    pg.goto('file://' + os.path.join(ROOT, 'dist-demo/index.html') + '#/'); pg.wait_for_timeout(600); print('viewer open button:', pg.evaluate("!!document.querySelector('#openCourse')"))
    pg.goto('file:///tmp/demo-site/index.html#/'); pg.wait_for_timeout(800); print('file:// standalone:', pg.inner_text('h1'))
    b.close()
