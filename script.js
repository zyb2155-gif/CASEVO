/*
CASEVO v4.2.4.6 Button Event Binding Restore

Bind Analyze button and send sourcing request.
*/

async function runCASEVOSourcing() {
  const textarea = document.querySelector("textarea");
  const inputs = document.querySelectorAll("input");

  const payload = {
    description: textarea ? textarea.value : "",
    product: inputs[0]?.value || "",
    quantity: inputs[1]?.value || "",
    targetPrice: inputs[2]?.value || "",
    destination: inputs[3]?.value || ""
  };

  const res = await fetch("/api/sourcing", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("CASEVO sourcing result:", data);
  return data;
}

document.addEventListener("DOMContentLoaded", () => {
  const buttons = [...document.querySelectorAll("button")];
  const btn = buttons.find(b => 
    b.innerText.includes("Analyze") || 
    b.innerText.includes("Find Matches")
  );

  if (btn) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await runCASEVOSourcing();
      } finally {
        btn.disabled = false;
      }
    });
  }
});
