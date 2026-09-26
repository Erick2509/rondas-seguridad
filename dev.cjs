const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const routes={'/api/sistema':require('../api/sistema.js'),'/api/procesar-notificaciones':require('../api/procesar-notificaciones.js'),'/api/notificar-ronda':require('../api/notificar-ronda.js')};
const securityHeaders=require('../vercel.json').headers[0].headers;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png'};
http.createServer(async(req,res)=>{
 res.status=n=>{res.statusCode=n;return res;};res.json=o=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o));};
 for(const {key,value} of securityHeaders){res.setHeader(key,key==='Content-Security-Policy'?value.replace("connect-src 'self'","connect-src 'self' http://127.0.0.1:9099 http://localhost:9099"):value);}
 const url=new URL(req.url,'http://localhost');
 if(routes[url.pathname]){let data='';for await(const chunk of req){data+=chunk;if(data.length>450000){res.status(413).json({ok:false});return;}}req.body=data;await routes[url.pathname](req,res);return;}
 let requested;try{requested=decodeURIComponent(url.pathname);}catch{res.statusCode=400;res.end();return;}
 const root=path.resolve('public'),file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end('No encontrado');return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('http://localhost:'+(process.env.PORT||4173)));
