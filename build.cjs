const esbuild=require('esbuild');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
(async()=>{
 fs.rmSync('public/assets',{recursive:true,force:true});
 await esbuild.build({entryPoints:['src/login.js','src/admin.js','src/agent.js','src/round.js','src/camera.js','src/install.js'],outdir:'public/assets',bundle:true,splitting:true,format:'esm',target:['es2020'],minify:true,entryNames:'[name]',chunkNames:'chunks/[name]-[hash]',legalComments:'none'});
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(dir,d.name)):[path.join(dir,d.name)]);
 const assets=walk('public').filter(p=>!p.endsWith('service-worker.js')).map(p=>'/'+p.slice('public/'.length));
 const hash=crypto.createHash('sha256');for(const p of assets)hash.update(fs.readFileSync('public'+p));const version=hash.digest('hex').slice(0,12);
 let source=fs.readFileSync('src/service-worker.js','utf8').replace('__BUILD_VERSION__',version).replace('__PRECACHE__',JSON.stringify(assets));
 await esbuild.build({stdin:{contents:source,resolveDir:path.resolve('src'),sourcefile:'service-worker.js'},outfile:'public/service-worker.js',bundle:true,format:'iife',target:['es2020'],minify:true,legalComments:'none'});
 console.log('Build listo:',version,assets.length,'recursos locales.');
})().catch(e=>{console.error(e);process.exit(1);});
