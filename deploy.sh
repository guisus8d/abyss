#!/bin/bash
npx expo export --platform web

BUNDLE=$(ls dist/_expo/static/js/web/*.js | head -1 | sed 's|dist/||')

python3 - << PYEOF
bundle = open('/dev/stdin').read().strip() if False else "$BUNDLE"
html = open('web/index.html').read()
script = f'<script src="/{bundle}" defer></script>'
html = html.replace('</body>', f'{script}\n</body>')
open('dist/index.html', 'w').write(html)
print("✅ OG tags inyectadas")
PYEOF

grep "og:image" dist/index.html || echo "❌ FALLÓ"
