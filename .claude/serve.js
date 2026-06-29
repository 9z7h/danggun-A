const http=require('http'),fs=require('fs'),p=require('path');
const root=__dirname.replace(/\/\.claude$/,'');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  let f=decodeURIComponent(req.url.split('?')[0]); if(f==='/')f='/index.html';
  const fp=p.join(root,f);
  fs.readFile(fp,(e,d)=>{ if(e){res.writeHead(404);res.end('404');return;}
    res.writeHead(200,{'Content-Type':types[p.extname(fp)]||'application/octet-stream'}); res.end(d); });
}).listen(4599,()=>console.log('serving '+root+' on 4599'));
