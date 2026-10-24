// Local-only Supabase boundary adapter for browser UAT. Postgres functions/RLS are real PGlite;
// Auth/Storage HTTP APIs are emulated, so this never substitutes for hosted DEV verification.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
export async function serveFixture(db,port=55441) {
 const objects=new Map(); const signed=new Map(); let queue=Promise.resolve();
 const server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://localhost:2242');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-upsert,cache-control');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const run=async()=>{
   const url=new URL(req.url,'http://127.0.0.1'); let subject;
   try { subject=JSON.parse(Buffer.from((req.headers.authorization||'').split('.')[1]||'','base64url').toString()).sub; } catch {}
   if(!/^00000000-0000-0000-0000-00000000000[1-8]$/.test(subject||'')){res.writeHead(401);res.end(JSON.stringify({message:'Test fixture auth required'}));return;}
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[subject]);await db.exec('set role authenticated');
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks);
   try {
    if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:subject,aud:'authenticated',role:'authenticated',email:'fixture@test.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}));return;}
    if(url.pathname.startsWith('/rest/v1/rpc/')) {
     const name=url.pathname.split('/').at(-1); if(!/^finance_(pilot|next)_[a-z_]+$/.test(name)){throw new Error('RPC outside fixture scope');}
     const args=JSON.parse(raw.toString()||'{}'); if(Object.keys(args).some(k=>!/^p_[a-z_]+$/.test(k)))throw new Error('Invalid arg');
     const placeholders=Object.keys(args).map((key,i)=>`${key} => $${i+1}`).join(',');
     const result=await db.query(`select public.${name}(${placeholders}) as data`,Object.values(args));
     res.end(JSON.stringify(result.rows[0].data));return;
    }
    const prefix='/storage/v1/object/finance-pilot-evidence/';
    if(url.pathname.startsWith(prefix)) {
     const path=decodeURIComponent(url.pathname.slice(prefix.length));
     await db.query("insert into storage.objects(bucket_id,name) values('finance-pilot-evidence',$1)",[path]);objects.set(path,raw);res.end(JSON.stringify({Key:'finance-pilot-evidence/'+path}));return;
    }
    const signing='/storage/v1/object/sign/finance-pilot-evidence/';
    if(url.pathname.startsWith(signing)) {
     const path=decodeURIComponent(url.pathname.slice(signing.length));
     const found=await db.query("select name from storage.objects where bucket_id='finance-pilot-evidence' and name=$1",[path]);if(!found.rows.length)throw new Error('Evidence denied');
     const token=randomUUID();signed.set(token,{path,expires:Date.now()+60000});res.end(JSON.stringify({signedURL:'/object/sign/finance-pilot-evidence/'+encodeURIComponent(path)+'?token='+token}));return;
    }
    res.writeHead(404);res.end(JSON.stringify({message:'Endpoint outside isolated test boundary'}));
   } catch(e){res.writeHead(400);res.end(JSON.stringify({code:e.code||'TEST_ERROR',message:e.message}));}
  };
  queue=queue.then(run).catch(e=>{res.writeHead(500);res.end(JSON.stringify({message:e.message}));});
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));console.log(`ISOLATED_FINANCE_API_READY:${port}`);return server;
}
