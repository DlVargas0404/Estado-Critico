import re
html=open('src/index.html').read()
parts=['core.js','levels.js','game.js','render.js','audio.js','main.js']
scripts='\n'.join(f'<script>\n{open("src/"+p).read()}\n</script>' for p in parts)
open('dist/index.html','w').write(html.replace('<!--SCRIPTS-->',scripts))
print('built',len(html)+len(scripts))
