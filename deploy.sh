#!/bin/bash
npx expo export --platform web

BUNDLE=$(ls dist/_expo/static/js/web/*.js | head -1 | sed 's|dist/||')
sed "s|</body>|<script src=\"/$BUNDLE\" defer></script>\n</body>|" web/index.html > dist/index.html

echo "✅ dist/index.html generado con OG tags"
grep "og:image" dist/index.html
