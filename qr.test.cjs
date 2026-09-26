const {test}=require('node:test'),assert=require('node:assert/strict'),QRCode=require('qrcode'),decode=require('jsqr');
test('QR de alta corrección conserva URL después de cubrir el sello central',()=>{
 const url='https://rondas-seguridad.vercel.app/ronda.html?punto=P01',qr=QRCode.create(url,{errorCorrectionLevel:'H'}),n=qr.modules.size,scale=8,width=(n+8)*scale,data=new Uint8ClampedArray(width*width*4);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){const mx=Math.floor(x/scale)-4,my=Math.floor(y/scale)-4,v=mx>=0&&my>=0&&mx<n&&my<n&&qr.modules.get(my,mx)?0:255,idx=(y*width+x)*4;data[idx]=data[idx+1]=data[idx+2]=v;data[idx+3]=255;}
 // Área equivalente al sello 80x22 sobre el canvas de 320px.
 for(let y=Math.floor(width*149/320);y<Math.ceil(width*171/320);y++)for(let x=Math.floor(width*120/320);x<Math.ceil(width*200/320);x++){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=255;}
 assert.equal(decode(data,width,width)?.data,url);
});
