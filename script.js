function joinList(e){
  e.preventDefault();
  const email=document.getElementById("email").value.trim();
  const message=document.getElementById("message");
  if(email){
    message.textContent="Thank you — your request has been received.";
    e.target.reset();
  }
  return false;
}
