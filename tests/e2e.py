import sys, time
from playwright.sync_api import sync_playwright
URL='file:///home/claude/game/dist/index.html'
errs=[]
def run(viewport,prefix,mobile=False):
    with sync_playwright() as p:
        b=p.chromium.launch()
        ctx=b.new_context(viewport=viewport,has_touch=mobile,is_mobile=mobile,device_scale_factor=1)
        pg=ctx.new_page()
        pg.on('console',lambda m: errs.append(f'{prefix} console.{m.type}: {m.text}') if m.type in ('error','warning') and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
        pg.on('pageerror',lambda e: errs.append(f'{prefix} pageerror: {e}'))
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'shots/{prefix}_menu.png')
        pg.click('#btn-play'); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/{prefix}_levels.png')
        pg.click('.level-card'); pg.wait_for_timeout(500)
        if not mobile:
            pg.keyboard.down('KeyD'); pg.wait_for_timeout(900); pg.keyboard.up('KeyD')
            pg.keyboard.press('KeyF'); pg.wait_for_timeout(600)
            pg.screenshot(path=f'shots/{prefix}_game.png')
            pg.keyboard.press('Tab'); pg.wait_for_timeout(1500)
            pg.screenshot(path=f'shots/{prefix}_automata.png')
            pg.keyboard.press('KeyX'); pg.wait_for_timeout(300)
            pg.click('#ap-trace'); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/{prefix}_trace.png'); pg.click('#trace-close')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.screenshot(path=f'shots/{prefix}_pause.png'); pg.click('#p-resume')
            for lv in [1,2,3]:
                pg.evaluate(f'startLevel({lv})'); pg.wait_for_timeout(700); pg.screenshot(path=f'shots/{prefix}_level{lv}.png')
            # forzar victoria y derrota para ver overlays
            pg.evaluate("App.world.terminals.forEach(t=>t.done=true); App.world.player.x=App.world.exit.x; App.world.player.y=App.world.exit.y;"); pg.wait_for_timeout(500)
            pg.screenshot(path=f'shots/{prefix}_win.png')
            pg.click('#ch-opts button'); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/{prefix}_win2.png')
            pg.evaluate("startLevel(1)"); pg.wait_for_timeout(300)
            pg.evaluate("const g=App.world.guards[0]; App.world.player.x=g.x+Math.cos(g.dir)*40; App.world.player.y=g.y+Math.sin(g.dir)*40;"); pg.wait_for_timeout(2500)
            pg.screenshot(path=f'shots/{prefix}_caught.png')
            pg.evaluate("App.world=null; overlay(null); document.querySelector('#hud').hidden=true; show('lab'); labRender();"); pg.wait_for_timeout(300)
            pg.click('#lab-run'); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/{prefix}_lab.png',full_page=True)
            pg.select_option('#lab-select','defectuoso'); pg.wait_for_timeout(200); pg.click('#lab-minimize'); pg.screenshot(path=f'shots/{prefix}_lab_bad.png')
            pg.select_option('#lab-select','redundante'); pg.click('#lab-minimize'); pg.wait_for_timeout(200); pg.screenshot(path=f'shots/{prefix}_lab_min.png')
            pg.evaluate("show('howto')"); pg.wait_for_timeout(200); pg.screenshot(path=f'shots/{prefix}_howto.png')
        else:
            pg.wait_for_timeout(800); pg.screenshot(path=f'shots/{prefix}_game.png')
            pg.click('#t-auto'); pg.wait_for_timeout(800); pg.screenshot(path=f'shots/{prefix}_automata.png')
        b.close()
run({'width':1440,'height':860},'desk')
run({'width':390,'height':844},'mob',mobile=True)
run({'width':844,'height':390},'land',mobile=True)
print('\n'.join(errs) if errs else 'SIN ERRORES DE CONSOLA')
