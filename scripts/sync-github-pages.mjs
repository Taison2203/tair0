/** Publish only the public frontend at the custom domain root. No server or secret files are copied. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const [sourceArg,targetArg]=process.argv.slice(2);
if(!sourceArg || !targetArg)throw new Error('Usage: node sync-github-pages.mjs <frontend-source> <git-checkout>');
const source=path.resolve(sourceArg),target=path.resolve(targetArg);
if(!fs.existsSync(path.join(target,'.git')))throw new Error('Target must be the selected Git checkout.');
const cleanText=text=>text.replace(/\r\n?/g,'\n').replace(/[\t ]+$/gm,'');
const html=cleanText(fs.readFileSync(path.join(source,'index.html'),'utf8'));
if(!html.includes('id="language-screen"') || /http-equiv=["']refresh/i.test(html))throw new Error('Source must contain the complete portfolio frontend.');
for(const name of ['assets','css','js']){
  const publicSource=path.join(source,name);
  const relative=path.relative(publicSource,target);
  if(relative==='' || (!relative.startsWith('..') && !path.isAbsolute(relative)))throw new Error('Target cannot be inside a public asset directory.');
  for(const prefix of ['', 'papers-portfolio', 'Tair.site/papers-portfolio']){
    const destination=path.join(target,prefix,name);
    if(path.resolve(publicSource)!==path.resolve(destination))fs.cpSync(publicSource,destination,{recursive:true});
  }
}
function cleanPublicText(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isDirectory())cleanPublicText(file);else if(/\.(?:js|css)$/.test(file))fs.writeFileSync(file,cleanText(fs.readFileSync(file,'utf8')));}}
for(const name of ['css','js'])cleanPublicText(path.join(target,name));
fs.writeFileSync(path.join(target,'index.html'),html);
const redirect=`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="canonical" href="https://tair0.me/">
  <title>Таир — Портфолио инспектора</title>
  <script>location.replace('/' + location.search + location.hash);</script>
  <noscript><meta http-equiv="refresh" content="0;url=/"></noscript>
</head>
<body style="background:#1d221c;color:#d8cf9b;font-family:monospace;text-align:center;padding:20vh 20px">
  <p><a href="/" style="color:#d8cf9b">Открыть личное дело Таира</a></p>
</body>
</html>
`;
for(const prefix of ['papers-portfolio','Tair.site/papers-portfolio'])fs.writeFileSync(path.join(target,prefix,'index.html'),redirect);
fs.mkdirSync(path.join(target,'scripts'),{recursive:true});
const helper=path.join(target,'scripts/sync-github-pages.mjs');
if(path.resolve(helper)!==path.resolve(fileURLToPath(import.meta.url)))fs.copyFileSync(fileURLToPath(import.meta.url),helper);
fs.writeFileSync(path.join(target,'PUBLISHING.md'),`# Frontend publishing

The live entry point is /index.html at https://tair0.me/. Public assets, CSS and modules are served from /assets/, /css/ and /js/.

The old /papers-portfolio/ and /Tair.site/papers-portfolio/ entry pages redirect to / while preserving the query and fragment. Keep these redirects in place during future updates.

To synchronise a complete frontend source directory into this checkout, run:

    node scripts/sync-github-pages.mjs <frontend-source-directory> <this-checkout>

Only public frontend directories and entry pages are copied. Commit and push the resulting changes to publish through GitHub Pages. CNAME and .nojekyll must remain in the repository root.
`);
console.log('Root frontend prepared; legacy entry URLs redirect to /.');
