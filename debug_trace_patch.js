/*
 CASEVO v4.2.4.2.1 Debug Trace Fix Patch

 IMPORTANT:
 Merge this patch into the existing CASEVO worker.js.
 Do NOT replace the entire worker.js file.

 Purpose:
 - Keep existing export default fetch handler
 - Add debug trace information
 - Avoid Cloudflare error 10021
*/

const CASEVO_DEBUG_VERSION = "4.2.4.2.1";

function createCasevoDebugTrace() {
  return {
    version: CASEVO_DEBUG_VERSION,
    tavilyResults: 0,
    parsedSuppliers: 0,
    intelligenceProcessed: 0,
    finalReturned: 0
  };
}

/*
 Add trace object inside your existing fetch() sourcing flow.

 Example:

 const debugTrace = createCasevoDebugTrace();

 Update:
 debugTrace.tavilyResults = results.length;
 debugTrace.parsedSuppliers = suppliers.length;
 debugTrace.intelligenceProcessed = verified.length;
 debugTrace.finalReturned = output.length;

 Return together with API response during testing.
*/
