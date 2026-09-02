/*
CASEVO v4.2.4.5 Frontend API Bridge Fix

Purpose:
- Capture sourcing form fields
- Send complete payload to Worker
- Restore frontend -> backend data flow
*/

async function submitSourcingRequest() {
  const description =
    document.querySelector("textarea")?.value || "";

  const inputs = document.querySelectorAll("input");

  const payload = {
    description,
    product: inputs[0]?.value || "",
    quantity: inputs[1]?.value || "",
    targetPrice: inputs[2]?.value || "",
    destination: inputs[3]?.value || ""
  };

  const response = await fetch("/api/sourcing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}
