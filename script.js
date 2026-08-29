const nav=document.querySelector('.nav'),menuBtn=document.querySelector('.menu-btn');
menuBtn?.addEventListener('click',()=>{const open=nav.classList.toggle('mobile-open');menuBtn.setAttribute('aria-expanded',open);menuBtn.textContent=open?'×':'☰'});
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('mobile-open')));

const modal=document.getElementById('productModal'),title=document.getElementById('modalTitle'),text=document.getElementById('modalText'),price=document.getElementById('modalPrice'),visual=document.getElementById('modalVisual');
const products={
"Mist Mountain":["$39","Inspired by shan shui landscape painting — layered mountains, mist and deliberate negative space.","山水","visual-mountain"],
"Red Seal":["$39","A modern study of the Chinese seal: compact, graphic and rooted in the language of identity.","福","visual-seal"],
"Jade Bloom":["$42","A botanical composition inspired by the restrained beauty of classical Chinese flower painting.","花","visual-bloom"],
"Ink River":["$39","Flowing ink and empty space become a calm, tactile interpretation of water and movement.","水","visual-river"],
"Crimson Crane":["$42","The crane is a traditional symbol of longevity and grace, reduced to a bold contemporary gesture.","鶴","visual-crane"],
"Moon Gate":["$39","Inspired by the circular moon gate found in classical Chinese gardens — architecture as a frame for stillness.","月","visual-moon"]};
function openProduct(name){const p=products[name];title.textContent=name;price.textContent=p[0];text.textContent=p[1];visual.className='modal-visual '+p[3];visual.innerHTML='<span>'+p[2]+'</span>';modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeProduct(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
document.querySelectorAll('.product-card').forEach(c=>c.addEventListener('click',()=>openProduct(c.dataset.product)));
document.querySelector('.modal-close')?.addEventListener('click',closeProduct);document.querySelector('.modal-backdrop')?.addEventListener('click',closeProduct);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProduct()});
document.getElementById('newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();const email=document.getElementById('email').value.trim();if(!email)return;document.getElementById('formMessage').textContent=`Thank you — ${email} is on the CASEVO list.`;e.target.reset()});
