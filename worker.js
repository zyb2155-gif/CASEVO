/* CASEVO v4.2.4.3 Supplier Discovery Restore */

const CASEVO_VERSION = "v4.2.4.3";

function trace(){
  return {
    tavilyResults:0,
    parsedSuppliers:0,
    intelligenceProcessed:0,
    finalReturned:0
  };
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);

    if(url.pathname === "/api/health"){
      return Response.json({
        ok:true,
        service:"CASEVO AI Sourcing",
        version:CASEVO_VERSION,
        apiKeyConfigured:!!env.TAVILY_API_KEY
      });
    }

    if(url.pathname === "/api/debug-sourcing"){
      return Response.json({
        ok:true,
        version:CASEVO_VERSION,
        trace:trace()
      });
    }

    return Response.json({
      ok:true,
      service:"CASEVO AI Sourcing",
      version:CASEVO_VERSION,
      message:"Supplier Discovery Restore"
    });
  }
};
