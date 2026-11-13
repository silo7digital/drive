const route = document.querySelector('.route');
const road = document.querySelector('#road');
const scene = document.querySelector('.scene');
const menu = document.querySelector('.menu');
const advance = document.querySelector('#advance');
const restart = document.querySelector('#restart');
const fill = document.querySelector('#fill');
const motion = matchMedia('(min-width:801px) and (prefers-reduced-motion:no-preference)');
const direct = document.querySelector('.direct');
const routeLinks = [...menu.querySelectorAll('nav a')];
const sections = [...document.querySelectorAll('.destination')];
document.body.classList.add('interactive');

// Each keyframe contains progress through a stop, source-frame x and y,
// and the width of the sign as a fraction of the source frame.
const stops = [
  { range:[.02,.26], keys:[[0,.552,.468,.014],[.5,.598,.484,.046],[.72,.651,.503,.080],[1,.81,.55,.134]] },
  { range:[.28,.52], keys:[[0,.549,.459,.014],[.5,.597,.476,.046],[.72,.653,.507,.080],[1,.81,.55,.134]] },
  { range:[.54,.78], keys:[[0,.548,.457,.014],[.5,.593,.477,.046],[.72,.65,.505,.080],[1,.81,.55,.134]] },
  { range:[.8,1], keys:[[0,.544,.467,.014],[.5,.587,.482,.043],[.85,.65,.506,.080],[1,.666,.514,.090]] }
].map((stop, index) => {
  const sign = routeLinks[index].cloneNode(true);
  sign.className = 'sign';
  sign.hidden = true;
  const arrow = document.createElement('span');
  arrow.textContent = '↗';
  arrow.setAttribute('aria-hidden', 'true');
  sign.append(arrow);
  document.querySelector('.signs').append(sign);
  return {...stop, sign};
});

const frameCount = 228;
const frames = new Map();
let current = 0;
let pending = false;
const frameUrl = index => 'frames/' + String(index).padStart(3,'0') + '.jpg';
const bound = value => Math.min(1, Math.max(0, value));
const distance = () => Math.max(1, route.offsetHeight - scene.offsetHeight);

function requestFrame(index) {
  if (frames.has(index) || index < 0 || index >= frameCount) return;
  const image = new Image();
  frames.set(index, image);
  image.onload = schedule;
  image.src = frameUrl(index);
}

function paintSigns(progress) {
  const frameWidth = road.clientWidth;
  for (const {range:[start,end], keys, sign} of stops) {
    const visible = progress >= start && progress <= end;
    if (!visible && sign === document.activeElement) advance.focus({preventScroll:true});
    sign.hidden = !visible;
    if (!visible) continue;
    const t = bound((progress-start)/(end-start));
    const right = keys.findIndex(key => key[0] >= t);
    const a = keys[Math.max(0,right-1)];
    const b = keys[Math.max(1,right)];
    const blend = bound((t-a[0])/(b[0]-a[0]));
    const x = a[1] + (b[1]-a[1])*blend;
    const y = a[2] + (b[2]-a[2])*blend;
    const width = a[3] + (b[3]-a[3])*blend;
    const xScreen = (x-.5)*frameWidth + innerWidth/2;
    sign.hidden = xScreen < -20 || xScreen > innerWidth + 20;
    sign.tabIndex = width*frameWidth >= 90 && xScreen > 45 && xScreen < innerWidth-45 ? 0 : -1;
    const exitFade = end === 1 ? 1 : bound((1-t)*12);
    sign.style.opacity = String(Math.min(bound(t*15),exitFade));
    sign.style.left = x*100 + '%';
    sign.style.top = y*100 + '%';
    sign.style.setProperty('--scale',width*frameWidth/205);
  }
}

function render() {
  pending = false;
  if (!document.body.classList.contains('drive')) return;
  const progress = bound(scrollY/distance());
  const target = Math.round(progress*(frameCount-1));
  requestFrame(target);
  for (let offset=1; offset<=9; offset++) {
    requestFrame(target+offset);
    requestFrame(target-offset);
  }
  const image = frames.get(target);
  if (image?.complete && image.naturalWidth && current !== target) {
    road.src = image.src;
    current = target;
  }
  paintSigns(current/(frameCount-1));
  scene.style.setProperty('--intro', String(bound(1-progress*6)));
  fill.style.transform = 'scaleX(' + progress + ')';
  restart.hidden = progress < .02;
  const label = progress < .02 ? 'Scroll to drive' : progress < .954 ? 'Drive forward' : 'Drive again';
  if (advance.firstChild.textContent.trim() !== label) advance.firstChild.textContent = label + ' ';
}

function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(render);
}

function configure() {
  const active = motion.matches && frameCount > 1 && !!road.naturalWidth;
  document.body.classList.toggle('drive',active);
  if (!active) {
    current = 0;
    road.src = frameUrl(0);
    scene.style.removeProperty('--intro');
    for (const {sign} of stops) sign.hidden = true;
  }
  schedule();
}

let drivePosition = 0;
let opener;
let activeSection;
function navigate() {
  const section = sections.find(item => '#' + item.id === location.hash);
  for (const item of sections) item.classList.toggle('current', item === section);
  if (section) {
    if (!activeSection) drivePosition = scrollY;
    activeSection = section;
    document.body.classList.add('destination-open');
    route.inert = true;
    direct.inert = true;
    section.querySelector('h2').focus({preventScroll:true});
  } else if (activeSection) {
    activeSection = undefined;
    document.body.classList.remove('destination-open');
    route.inert = false;
    direct.inert = false;
    scrollTo(0,drivePosition);
    (opener?.getClientRects().length ? opener : menu.querySelector('summary')).focus({preventScroll:true});
    opener = undefined;
  }
}

for (const heading of document.querySelectorAll('.destination h2')) heading.tabIndex = -1;
document.addEventListener('click',event => {
  const link = event.target.closest('a');
  if (!link) return;
  if (sections.some(item => link.hash === '#' + item.id)) {
    opener = menu.contains(link) ? menu.querySelector('summary') : link;
    menu.open = false;
  }
  if (link.hash === '#home' && activeSection) {
    event.preventDefault();
    history.pushState(null,'','#home');
    navigate();
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (activeSection) {
    history.pushState(null,'','#home');
    navigate();
  } else if (menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});
advance.addEventListener('click',() => {
  const progress = bound(scrollY/distance());
  const next = [.18,.44,.70,.97].find(point => point > progress+.015);
  scrollTo({top:(next ?? 0)*distance(),behavior:'smooth'});
});
restart.addEventListener('click',() => {
  advance.focus({preventScroll:true});
  scrollTo({top:0,behavior:'smooth'});
});
addEventListener('scroll',schedule,{passive:true});
addEventListener('resize',schedule);
addEventListener('hashchange',navigate);
motion.addEventListener('change',configure);
road.addEventListener('load', () => {
  if (road.naturalWidth && !document.body.classList.contains('drive') && motion.matches) configure();
});
if (road.complete && road.naturalWidth) configure();
navigate();
