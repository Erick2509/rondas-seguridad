const {timingSafeEqual}=require('node:crypto');
const {services}=require('../lib/firebase.cjs');
const {push}=require('../lib/push.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
 const secret=process.env.CRON_SECRET||'',h=req.headers.authorization||'',expected='Bearer '+secret;
 if(secret.length<32||Buffer.byteLength(h)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(h),Buffer.from(expected)))return res.status(401).json({ok:false});
 try{return res.status(200).json({ok:true,...await push(services()).pending()});}catch(e){console.error('scheduler',e.code||'error');return res.status(500).json({ok:false});}
};
