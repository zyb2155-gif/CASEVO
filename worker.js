/*
CASEVO v4.2.4.6 Button + Tavily Restore Base
*/

const VERSION="v4.2.4.6";

export default {
 async fetch(request,env){

  const url=new URL(request.url);

  if(url.pathname==="/api/health"){
   return Response.json({
    ok:true,
    service:"CASEVO AI Sourcing",
    version:VERSION,
    apiKeyConfigured:!!env.TAVILY_API_KEY
   });
  }

  if(request.method==="POST"){
   const body=await request.json();

   return Response.json({
    ok:true,
    version:VERSION,
    brief:{
     product:body.product||body.description||"Sourcing requirement",
     quantity:body.quantity||"Not specified",
     destination:body.destination||"Not specified",
     targetPrice:body.targetPrice||"Not specified"
    },
    suppliers:[]
   });
  }

  return Response.json({
   ok:true,
   version:VERSION
  });
 }
};
