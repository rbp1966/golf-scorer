import base64, json, urllib.parse
png = base64.b64encode(open('icon-180.png','rb').read()).decode()
svg = open('icon.svg').read().strip()
svguri = 'data:image/svg+xml,' + urllib.parse.quote(svg)
manifest = {"name":"Golf Game Scorer","short_name":"Golf Scorer","display":"standalone","background_color":"#0e1411","theme_color":"#1f7a44","start_url":".","icons":[{"src":"data:image/png;base64,"+png,"sizes":"180x180","type":"image/png"}]}
muri = 'data:application/manifest+json,' + urllib.parse.quote(json.dumps(manifest))
html = f'''<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Golf Scorer">
<meta name="theme-color" content="#1f7a44">
<meta name="color-scheme" content="light dark">
<title>Golf Game Scorer</title>
<link rel="icon" href="{svguri}">
<link rel="apple-touch-icon" href="data:image/png;base64,{png}">
<link rel="manifest" href="{muri}">
<style>
{open('style.css').read()}
</style></head>
<body><div id="app"></div><div id="toast"></div>
<script>
{open('engine.js').read()}
{open('courses.js').read()}
{open('app.js').read()}
</script>
</body></html>
'''
open('index.html','w').write(html)
sw = """// Optional: only used when index.html is served over http(s) from the same folder. Caches the app for offline launch.
var C='golf-scorer-v2';
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html']);}));self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C;}).map(function(x){return caches.delete(x);}));}));});
self.addEventListener('fetch',function(e){e.respondWith(fetch(e.request).then(function(r){var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp);});return r;}).catch(function(){return caches.match(e.request).then(function(m){return m||caches.match('index.html');});}));});
"""
open('sw.js','w').write(sw)
print(len(html))
