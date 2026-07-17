// ===== Scroll progress bar =====
const scrollProgress = document.getElementById('scrollProgress');
function updateProgress(){
  const h = document.documentElement;
  const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
  scrollProgress.style.width = pct + '%';
}
window.addEventListener('scroll', updateProgress);
updateProgress();

// ===== Staggered reveal delays =====
(function staggerReveals(){
  const seen = new Map();
  document.querySelectorAll('.reveal').forEach(el=>{
    const parent = el.parentElement;
    const count = seen.get(parent) || 0;
    el.style.transitionDelay = Math.min(count, 6) * 90 + 'ms';
    seen.set(parent, count+1);
  });
})();

// ===== Magnetic buttons =====
document.querySelectorAll('.hero-btns .btn, .btn-nav-cta').forEach(btn=>{
  btn.style.transition = 'transform .2s cubic-bezier(.16,.8,.24,1)';
  btn.addEventListener('mousemove', (e)=>{
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width/2;
    const y = e.clientY - r.top - r.height/2;
    btn.style.transform = `translate(${x*0.22}px, ${y*0.35}px)`;
  });
  btn.addEventListener('mouseleave', ()=>{ btn.style.transform=''; });
});

// ===== 3D tilt on cards =====
function addTilt(selector, intensity){
  document.querySelectorAll(selector).forEach(el=>{
    el.addEventListener('mousemove', (e)=>{
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -intensity;
      const ry = (px - 0.5) * intensity;
      el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
    });
    el.addEventListener('mouseleave', ()=>{ el.style.transform=''; });
  });
}
addTilt('.proj-card', 5);
addTilt('.skill-card', 3.5);
addTilt('.focus-item', 3.5);

// ===== Blob parallax (mouse + scroll) =====
const blob1 = document.querySelector('.blob1');
const blob2 = document.querySelector('.blob2');
window.addEventListener('mousemove', (e)=>{
  const cx = (e.clientX / window.innerWidth - 0.5);
  const cy = (e.clientY / window.innerHeight - 0.5);
  if(blob1) blob1.style.marginLeft = (cx*40)+'px';
  if(blob2) blob2.style.marginRight = (cy*-40)+'px';
});
window.addEventListener('scroll', ()=>{
  const s = window.scrollY;
  if(blob1) blob1.style.marginTop = (s*0.08)+'px';
  if(blob2) blob2.style.marginBottom = (s*0.05)+'px';
});

// ===== Loader =====
window.addEventListener('load', ()=>{
  setTimeout(()=>document.getElementById('loader').classList.add('hide'), 700);
});

// ===== Custom cursor =====
const dot = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx=0,my=0, rx=0, ry=0;
window.addEventListener('mousemove', e=>{
  mx=e.clientX; my=e.clientY;
  dot.style.left=mx+'px'; dot.style.top=my+'px';
});
function animRing(){
  rx += (mx-rx)*0.15; ry += (my-ry)*0.15;
  ring.style.left=rx+'px'; ring.style.top=ry+'px';
  requestAnimationFrame(animRing);
}
animRing();
document.querySelectorAll('a,button,.skill-card,.proj-card').forEach(el=>{
  el.addEventListener('mouseenter', ()=>{ring.style.width='50px'; ring.style.height='50px'; ring.style.opacity='.25';});
  el.addEventListener('mouseleave', ()=>{ring.style.width='32px'; ring.style.height='32px'; ring.style.opacity='.5';});
});

// ===== Header scroll state =====
const header = document.getElementById('siteHeader');
const backTop = document.getElementById('backTop');
window.addEventListener('scroll', ()=>{
  header.classList.toggle('scrolled', window.scrollY>40);
  backTop.classList.toggle('show', window.scrollY>500);
});
backTop.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));

// ===== Mobile menu =====
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
burger.addEventListener('click', ()=>{
  mobileMenu.classList.toggle('open');
  burger.classList.toggle('open');
});
mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>mobileMenu.classList.remove('open')));

// ===== Theme toggle =====
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;
themeToggle.addEventListener('click', ()=>{
  const isLight = root.getAttribute('data-theme')==='light';
  root.setAttribute('data-theme', isLight ? 'dark' : 'light');
  themeToggle.textContent = isLight ? '🌙' : '☀️';
});

// ===== Typing animation (roles) =====
const roles = [
  'AI/ML Developer',
  'Generative AI Developer',
  'Full Stack Developer',
  'Computer Science Engineer'
];
const typedEl = document.getElementById('typedRole');
let ri=0, ci=0, deleting=false;
function typeLoop(){
  const current = roles[ri];
  if(!deleting){
    ci++;
    typedEl.textContent = current.slice(0,ci);
    if(ci===current.length){ deleting=true; setTimeout(typeLoop,1400); return; }
  } else {
    ci--;
    typedEl.textContent = current.slice(0,ci);
    if(ci===0){ deleting=false; ri=(ri+1)%roles.length; }
  }
  setTimeout(typeLoop, deleting?40:80);
}
typeLoop();

// ===== Terminal boot sequence =====
const termLines = [
  {p:true, t:'whoami'},
  {t:'Deekshith Vataparthi — CSE Student'},
  {p:true, t:'cat career_goal.txt'},
  {t:'Aspiring AI Engineer @ product-based companies'},
  {p:true, t:'ls ./skills'},
  {t:'python  react  langchain  pytorch  fastapi  sql'},
  {p:true, t:'echo $STATUS'},
  {t:'Open to internships & new grad roles ✓'}
];
const termBody = document.getElementById('terminalBody');
function typeTerminal(i){
  if(i>=termLines.length) return;
  const line = termLines[i];
  const div = document.createElement('div');
  div.className='tl';
  termBody.appendChild(div);
  let txt = line.p ? '$ ' : '';
  let idx=0;
  const full = line.t;
  function step(){
    if(idx<=full.length){
      div.innerHTML = (line.p? '<span class="prompt">$</span> ':'') + '<span class="'+(line.p?'':'out')+'">'+full.slice(0,idx)+'</span>';
      idx++;
      setTimeout(step, line.p?55:18);
    } else {
      setTimeout(()=>typeTerminal(i+1), 260);
    }
  }
  step();
}
setTimeout(()=>typeTerminal(0), 900);

// ===== Scroll reveal =====
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      en.target.classList.add('in');
      io.unobserve(en.target);
    }
  });
},{threshold:0.15});
revealEls.forEach(el=>io.observe(el));

// ===== Skill bar animation =====
const skillBars = document.querySelectorAll('.skill-bar span');
const barIO = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      en.target.style.width = en.target.dataset.w+'%';
      barIO.unobserve(en.target);
    }
  });
},{threshold:0.4});
skillBars.forEach(b=>barIO.observe(b));

// ===== Counters =====
const counters = document.querySelectorAll('.counter-num');
const cIO = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      const el = en.target;
      const target = +el.dataset.target;
      let cur = 0;
      const step = Math.max(1, Math.ceil(target/60));
      const tick = ()=>{
        cur = Math.min(target, cur+step);
        el.textContent = cur;
        if(cur<target) requestAnimationFrame(tick);
      };
      tick();
      cIO.unobserve(el);
    }
  });
},{threshold:0.5});
counters.forEach(c=>cIO.observe(c));

// ===== Particle network background =====
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let W,H, particles=[];
function resize(){
  W = canvas.width = canvas.parentElement.offsetWidth;
  H = canvas.height = canvas.parentElement.offsetHeight;
}
resize();
window.addEventListener('resize', resize);
const COUNT = Math.min(70, Math.floor(W/22));
for(let i=0;i<COUNT;i++){
  particles.push({
    x:Math.random()*W, y:Math.random()*H,
    vx:(Math.random()-0.5)*0.35, vy:(Math.random()-0.5)*0.35
  });
}
function draw(){
  ctx.clearRect(0,0,W,H);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  particles.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy;
    if(p.x<0||p.x>W)p.vx*=-1;
    if(p.y<0||p.y>H)p.vy*=-1;
  });
  for(let i=0;i<particles.length;i++){
    for(let j=i+1;j<particles.length;j++){
      const a=particles[i], b=particles[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if(d<130){
        ctx.strokeStyle = accent; ctx.globalAlpha = (1-d/130)*0.25;
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha=1;
  particles.forEach(p=>{
    ctx.fillStyle=accent; ctx.beginPath(); ctx.arc(p.x,p.y,1.6,0,Math.PI*2); ctx.fill();
  });
  requestAnimationFrame(draw);
}
draw();

// ===== Resume button (placeholder) =====
document.getElementById('resumeBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  alert('Add your resume PDF and link it here — e.g. href="/resume-deekshith.pdf" download.');
});

// ===== Contact form (UI only) =====
document.getElementById('contactForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  alert('Message ready! Connect this form to Formspree/EmailJS to send it — or email vataparthideekshith18@gmail.com directly for now.');
  e.target.reset();
});

document.getElementById('year').textContent = new Date().getFullYear();