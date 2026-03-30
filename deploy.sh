#!/bin/bash
npx expo export --platform web

# Obtener el nombre del bundle generado
BUNDLE=$(ls dist/_expo/static/js/web/*.js | head -1 | sed 's|dist/||')

# Agregar el script tag al final del body en web/index.html
sed "s|</body>|<script src=\"/$BUNDLE\" defer></script>\n</body>|" web/index.html > dist/index.html

echo "✅ dist/index.html generado con OG tags"
grep "og:image" dist/index.html

git add .
git commit -m "fix: og meta tags"
git push origin master:main --force
