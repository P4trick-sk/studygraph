from playwright.sync_api import sync_playwright
import os
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM=os.path.join(ROOT,'node_modules')+'/'
APP=os.environ.get('SG_URL') or 'file://'+os.path.join(ROOT,'dist-demo','index.html')
MAP={'marked.min.js':NM+'marked/marked.min.js','katex.min.js':NM+'katex/dist/katex.min.js','cytoscape.min.js':NM+'cytoscape/dist/cytoscape.min.js'}
def handler(route):
    u=route.request.url
    for k,v in MAP.items():
        if u.endswith(k): return route.fulfill(path=v, content_type='application/javascript')
    if u.startswith('file:') or u.startswith('http://localhost'): return route.continue_()
    return route.abort()
os.makedirs(os.path.join(ROOT,'test','shots'),exist_ok=True)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,vp,dark in [('desk',{'width':1360,'height':900},True),('mob',{'width':390,'height':844},False)]:
        ctx=b.new_context(viewport=vp,color_scheme='dark' if dark else 'light')
        pg=ctx.new_page(); pg.route('**/*',handler)
        pg.on('console',lambda m: errs.append((name,m.text)) if m.type=='error' else None)
        pg.on('pageerror',lambda e: errs.append((name,'PAGEERR '+str(e))))
        pg.goto(APP+''); pg.wait_for_timeout(800)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-home.png',full_page=True)
        pg.goto(APP+'#/n/thm.cantor'); pg.wait_for_timeout(500)
        pg.click('#stepNext'); pg.click('#stepNext'); pg.click('[data-why="0"]')
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-item.png',full_page=True)
        pg.goto(APP+'#/n/def.injection'); pg.wait_for_timeout(400)
        pg.click('[data-g=next]'); pg.click('[data-g=next]'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-fig.png',full_page=True)
        pg.goto(APP+'#/t/cardinality'); pg.wait_for_timeout(400)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-topic.png',full_page=True)
        pg.goto(APP+'#/map'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-map.png')
        pg.goto(APP+'#/quiz/sets'); pg.wait_for_timeout(600)
        for i in range(4):
            if pg.query_selector('.opt'): pg.click('.opt >> nth=0'); pg.click('#qnext')
            elif pg.query_selector('#reveal'): pg.click('#reveal'); pg.click('[data-g="3"]')
            pg.wait_for_timeout(100)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-quiz.png',full_page=True)
        pg.goto(APP+'#/review?status=flagged'); pg.wait_for_timeout(300)
        pg.click('.rv-item summary'); pg.click('[data-v=checked]'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-review.png',full_page=True)
        pg.goto(APP+'#/stats'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-stats.png',full_page=True)
        pg.goto(APP+'#/'); pg.wait_for_timeout(300)
        pg.keyboard.press('Control+k'); pg.keyboard.type('bijekc'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-search.png')
        pg.keyboard.press('Escape')
        pg.goto(APP+'#/path/cor.pn-uncountable'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{ROOT}/test/shots/{name}-path.png',full_page=True)
        if name=='desk':
            pg.goto(APP+'#/n/thm.de-morgan'); pg.wait_for_timeout(400)
            pg.click('#stepAll'); pg.hover('.step a[data-pv="thm.de-morgan-logic"]'); pg.wait_for_timeout(700)
            pg.screenshot(path=f'{ROOT}/test/shots/desk-hover.png')
        ctx.close()
    b.close()
bad=[e for e in errs if 'ERR_FAILED' not in e[1]]
print('page errors:', bad or 'none (font requests are blocked offline)')
raise SystemExit(1 if bad else 0)
