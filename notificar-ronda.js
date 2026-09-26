// Ruta antigua retirada: los eventos se crean atómicamente en el servidor.
module.exports=async(req,res)=>res.status(410).json({ok:false,error:'Actualiza la aplicación. Utiliza el registro autenticado de rondas.'});
