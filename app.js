/* ============================================================
   당근부동산 프로토타입 — 로직 레이어
   data.js 의 전역 배열(clusters, pois, POOL, FILTERS, WISH …)을 사용합니다.
   ============================================================ */

/* ===== render markers ===== */
var cWrap = document.getElementById('clusters');
clusters.forEach(function(c){
  var d = Math.min(84, Math.round(40 + Math.sqrt(c.v)*4.2));
  var el = document.createElement('div');
  el.className = 'cluster';
  el.dataset.x = c.x; el.dataset.y = c.y; el.dataset.v = c.v;
  el.style.cssText = 'left:'+c.x+'px;top:'+c.y+'px;width:'+d+'px;height:'+d+'px;font-size:'+Math.round(d*0.34)+'px';
  el.textContent = c.v;
  cWrap.appendChild(el);
});
var pWrap = document.getElementById('pois');
pois.forEach(function(p){
  var el = document.createElement('div');
  el.className = 'poi ' + (p.k==='area'?'area':p.k);
  var ic = (p.k==='area') ? '' : '<span class="ic">'+(ICON[p.k]||ICON.b)+'</span>';
  el.style.cssText = 'left:'+p.x+'px;top:'+p.y+'px';
  el.innerHTML = ic + '<span>'+p.t+'</span>';
  pWrap.appendChild(el);
});

/* ===== pan / zoom ===== */
var vp = document.getElementById('mapvp');
var world = document.getElementById('world');
var W = 900, H = 1500;
var scale = 1, tx = -262, ty = -150;
var MIN = 0.75, MAX = 4;

function vw(){ return vp.clientWidth; }
function vh(){ return vp.clientHeight; }
function clamp(){
  scale = Math.min(MAX, Math.max(MIN, scale));
  var sw = W*scale, sh = H*scale;
  tx = Math.min(0, Math.max(vw()-sw, tx));
  ty = Math.min(0, Math.max(vh()-sh, ty));
}
function apply(){ world.style.transform = 'translate('+tx+'px,'+ty+'px) scale('+scale+')'; }
function zoomAt(px,py,ns){
  ns = Math.min(MAX, Math.max(MIN, ns));
  var wx = (px-tx)/scale, wy = (py-ty)/scale;
  scale = ns; tx = px-wx*scale; ty = py-wy*scale; clamp(); apply();
}
function smoothTo(nx,ny,ns){
  world.classList.add('anim');
  scale = Math.min(MAX, Math.max(MIN, ns)); tx = nx; ty = ny; clamp(); apply();
  setTimeout(function(){ world.classList.remove('anim'); }, 360);
}
clamp(); apply();

var pointers = {}, count = 0;
var dragging = false, lastX = 0, lastY = 0;
var pinchPrev = null;
var downX = 0, downY = 0, downT = 0, moved = false, multi = false;

function rect(){ return vp.getBoundingClientRect(); }
function rel(e){ var r = rect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
function plist(){ var a=[]; for(var k in pointers) a.push(pointers[k]); return a; }

vp.addEventListener('pointerdown', function(e){
  vp.setPointerCapture(e.pointerId);
  pointers[e.pointerId] = e; count++;
  if(count>=2){ multi = true; dragging = false; pinchPrev = null; }
  else { dragging = true; lastX = e.clientX; lastY = e.clientY;
         downX = e.clientX; downY = e.clientY; downT = Date.now(); moved = false; multi = false; }
});
vp.addEventListener('pointermove', function(e){
  if(!(e.pointerId in pointers)) return;
  pointers[e.pointerId] = e;
  if(count>=2){
    var a = plist();
    var d = Math.hypot(a[0].clientX-a[1].clientX, a[0].clientY-a[1].clientY);
    var r = rect();
    var mx = (a[0].clientX+a[1].clientX)/2 - r.left;
    var my = (a[0].clientY+a[1].clientY)/2 - r.top;
    if(pinchPrev) zoomAt(mx, my, scale*(d/pinchPrev));
    pinchPrev = d;
  } else if(dragging){
    if(Math.hypot(e.clientX-downX, e.clientY-downY) > 8) moved = true;
    tx += e.clientX-lastX; ty += e.clientY-lastY;
    lastX = e.clientX; lastY = e.clientY; clamp(); apply();
  }
});
function up(e){
  var doTap = (count===1 && !multi && !moved && (Date.now()-downT) < 350);
  if(e.pointerId in pointers){ delete pointers[e.pointerId]; count--; }
  if(count<2) pinchPrev = null;
  if(count<1) dragging = false;
  if(doTap) handleTap(e.clientX, e.clientY);
}
vp.addEventListener('pointerup', up);
vp.addEventListener('pointercancel', up);
vp.addEventListener('wheel', function(e){
  e.preventDefault(); var p = rel(e);
  zoomAt(p.x, p.y, scale*(e.deltaY<0 ? 1.12 : 0.89));
}, {passive:false});
vp.addEventListener('dblclick', function(e){ var p = rel(e); zoomAt(p.x, p.y, scale*1.6); });
vp.addEventListener('touchmove', function(e){ if(e.touches.length>1) e.preventDefault(); }, {passive:false});

/* ===== tap routing ===== */
function handleTap(cx, cy){
  var el = document.elementFromPoint(cx, cy);
  if(!el || !el.closest) return;
  var cl = el.closest('.cluster');
  if(cl){ clusterTap(cl); return; }
  var ls = el.closest('.listing');
  if(ls){ openListSheet('관심 매물 · 원룸 월 35만', 1); return; }
}
function clusterTap(el){
  document.querySelectorAll('.cluster.sel').forEach(function(c){ c.classList.remove('sel'); });
  el.classList.add('sel');
  var x = +el.dataset.x, y = +el.dataset.y, v = +el.dataset.v;
  var ns = Math.min(MAX, Math.max(2.2, scale*1.35));
  smoothTo(vw()/2 - x*ns, vh()*0.34 - y*ns, ns);
  setTimeout(function(){ openListSheet('매물 '+v+'개', 20); }, 240);
}

/* ===== bottom sheet ===== */
var overlay = document.getElementById('overlay');
var sheet = document.getElementById('sheet');
var shTitle = document.getElementById('shTitle');
var shBody = document.getElementById('shBody');
var shSub = document.getElementById('shSub');
function openSheet(){ overlay.classList.add('open'); sheet.classList.add('open'); }
function closeSheet(){ overlay.classList.remove('open'); sheet.classList.remove('open'); }
overlay.addEventListener('click', closeSheet);
document.getElementById('shClose').addEventListener('click', closeSheet);

function roomSVG(i){
  var r = ROOMS[i % ROOMS.length];
  return '<svg width="96" height="96" viewBox="0 0 96 96" preserveAspectRatio="none">'
    +'<rect width="96" height="96" fill="'+r.w+'"/>'
    +'<rect y="58" width="96" height="38" fill="'+r.f+'"/>'
    +'<rect x="9" y="14" width="30" height="34" rx="2" fill="#fff" opacity=".85"/>'
    +'<rect x="44" y="20" width="20" height="28" rx="2" fill="#fff" opacity=".55"/>'
    +'<rect x="70" y="24" width="18" height="24" rx="2" fill="#fff" opacity=".35"/>'
    +'<rect x="0" y="56" width="96" height="3" fill="rgba(0,0,0,.06)"/></svg>';
}

/* 썸네일: 실사진(imgs) 있으면 첫 컷, 없으면 SVG 일러스트 폴백 */
function thumbImg(it, i){
  if(it && it.imgs && it.imgs.length)
    return '<img src="'+it.imgs[0]+'" alt="" draggable="false" loading="lazy">';
  return roomSVG(i);
}

var areaMode = true;  /* true = 평수로 보기 */
var listState = { title:'', n:0 };

var EYE_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><ellipse cx="12" cy="12" rx="9" ry="6"/><circle cx="12" cy="12" r="2.5" fill="#fff" stroke="none"/></svg>';
function listingCard(it, i){
  var area = areaMode ? it.py : it.m2;
  var stats = '';
  if(it.chat>0) stats += '<span class="st">'+IC_CHAT+it.chat+'</span>';
  stats += '<span class="st">'+IC_HEART_F+it.like+'</span>';
  var viewedOverlay = viewedPool.has(i)
    ? '<div class="ph-viewed"><span class="badge-viewed">'+EYE_SVG+'본 매물</span></div>'
    : '';
  return '<div class="lst" data-i="'+i+'">'
    + '<div class="ph">'+thumbImg(it, i)+viewedOverlay+'</div>'
    + '<div class="info">'
    +   '<div class="ptop"><div class="price">'+it.p+'</div>'
    +     '<button class="fav" aria-label="찜">'+IC_HEART_O+'</button></div>'
    +   '<div class="meta">'+it.k+' · '+area+' · '+it.fl+'</div>'
    +   '<div class="meta sub">'+it.mg+' · '+it.dist+'</div>'
    +   (it.best ? '<div class="badge2">우수 중개소</div>' : '')
    +   '<div class="pbot"><span class="dong">'+it.dong+'</span>'
    +     '<span class="stats">'+stats+'</span></div>'
    + '</div></div>';
}
function footerHTML(){
  return '<div class="lst-foot">'
    + '<div class="fhead"><h4>관악구 이웃의 관심 매물</h4>'
    +   '<span class="ad">광고<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaadb4" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1" fill="#aaadb4" stroke="none"/></svg></span></div>'
    + '<div class="alert"><b>관악구 봉천동 매물 알림 받기</b>'
    +   '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#bcbfc6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></div>'
    + '</div>';
}
var viewedPool = new Set();
function renderListBody(){
  var html = '';
  for(var i=0;i<listState.n;i++) html += listingCard(POOL[i % POOL.length], i);
  html += footerHTML();
  shBody.innerHTML = html;
  shBody.querySelectorAll('.lst').forEach(function(c){
    c.addEventListener('click', function(){
      var idx = +c.dataset.i;
      viewedPool.add(idx);
      openDetail(POOL[idx % POOL.length]);
    });
  });
  shBody.querySelectorAll('.fav').forEach(function(f, fi){
    var poolItem = POOL[fi % POOL.length];
    if(WISH.some(function(w){ return w._pool === poolItem; })) f.classList.add('on');
    f.addEventListener('click', function(e){
      e.stopPropagation();
      var wasOn = f.classList.contains('on');
      f.classList.toggle('on');
      if(!wasOn){
        lastFavEl = f;
        openReasonModal(poolItem);
      } else {
        var wi = WISH.filter(function(w){ return w._pool === poolItem; })[0];
        if(wi) WISH.splice(WISH.indexOf(wi), 1);
      }
    });
  });
  var al = shBody.querySelector('.alert');
  if(al) al.addEventListener('click', function(){ toast('매물 알림을 설정했어요'); });
}
function openListSheet(title, count){
  listState.title = title;
  listState.n = Math.min(count||6, 20);
  shTitle.textContent = title;
  shSub.style.display = 'block';
  sheet.classList.add('tall');
  renderListBody();
  shBody.scrollTop = 0;
  openSheet();
}
document.getElementById('areaSw').addEventListener('click', function(){
  areaMode = !areaMode;
  this.classList.toggle('on', areaMode);
  this.classList.toggle('off', !areaMode);
  renderListBody();
});

/* ===== filters ===== */
function caret(dark){
  return ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+(dark?'#26282D':'#5A5E66')
    +'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
}
function chipByBase(base){
  var found = null;
  document.querySelectorAll('.chip').forEach(function(c){ if(c.dataset.base===base) found = c; });
  return found;
}
function updateChip(base){
  var cfg = FILTERS[base], chip = chipByBase(base);
  var label, active;
  if(cfg.multi){ active = cfg.sel.length>0; label = active ? cfg.sel.join('·') : base; }
  else { active = (cfg.sel && cfg.sel!=='전체'); label = active ? cfg.sel : base; }
  chip.innerHTML = label + caret(active);
  chip.classList.toggle('on', active);
}
function openOptionSheet(base){
  var cfg = FILTERS[base];
  shSub.style.display = 'none';
  sheet.classList.remove('tall');
  shTitle.textContent = cfg.title;
  function rows(){
    return cfg.opts.map(function(o){
      var on = cfg.multi ? (cfg.sel.indexOf(o)>=0) : (o===cfg.sel);
      return '<div class="opt'+(on?' sel':'')+'" data-v="'+o+'">'+o+'<span class="ck">✓</span></div>';
    }).join('');
  }
  shBody.innerHTML = rows() + (cfg.multi ? '<button class="apply">적용하기</button>' : '');
  shBody.scrollTop = 0;
  function bind(){
    shBody.querySelectorAll('.opt').forEach(function(r){
      r.addEventListener('click', function(){
        var v = r.dataset.v;
        if(cfg.multi){
          var i = cfg.sel.indexOf(v);
          if(i>=0) cfg.sel.splice(i,1); else cfg.sel.push(v);
          shBody.innerHTML = rows() + '<button class="apply">적용하기</button>';
          bind();
        } else {
          cfg.sel = v; updateChip(base); closeSheet();
        }
      });
    });
    var ap = shBody.querySelector('.apply');
    if(ap) ap.addEventListener('click', function(){ updateChip(base); closeSheet(); });
  }
  bind();
  openSheet();
}
document.querySelectorAll('.chip').forEach(function(c){
  c.addEventListener('click', function(){ openOptionSheet(c.dataset.base); });
});

/* ===== segment (매물/단지/중개) ===== */
var current = { seg:'매물', count:635 };
var bottomPill = document.getElementById('bottomPill');
document.querySelectorAll('.rail button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.rail button').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on');
    var name = b.textContent.trim();
    current.seg = name; current.count = COUNTS[name];
    bottomPill.innerHTML = name + ' <b>' + COUNTS[name] + '개</b>';
    toast(name + ' ' + COUNTS[name] + '개를 지도에 표시했어요');
  });
});

/* ===== misc buttons ===== */
bottomPill.addEventListener('click', function(){
  openListSheet(current.seg + ' ' + current.count + '개', current.count);
});
var refresh = document.getElementById('refresh');
refresh.addEventListener('click', function(){
  var ic = refresh.querySelector('svg');
  ic.classList.remove('spin'); void ic.offsetWidth; ic.classList.add('spin');
  toast('현 지도에서 검색했어요');
});
document.getElementById('locate').addEventListener('click', function(){
  var ns = 1.8;
  smoothTo(vw()/2 - 470*ns, vh()*0.46 - 720*ns, ns);
  toast('내 위치로 이동했어요');
});
document.getElementById('xbtn').addEventListener('click', function(){ toast('검색을 닫았어요'); });

/* ===== toast ===== */
var toastEl = document.getElementById('toast'), toastT = null;
function toast(msg){
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(function(){ toastEl.classList.remove('show'); }, 1800);
}
setTimeout(function(){ toast('주황색 원을 눌러 매물을 확인하세요'); }, 500);

/* ===== detail page ===== */
var detail = document.getElementById('detail');
var dtScroll = document.getElementById('dtScroll');
var dtAppbar = document.getElementById('dtAppbar');
var dtTabs = document.getElementById('dtTabs');
var SECS = ['desc','fac','loc','info','live','agent'];

document.getElementById('facGrid').innerHTML = APPL.map(function(a){
  return '<div class="fi'+(a[1]?'':' off')+'"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+a[2]+'</svg>'+a[0]+'</div>';
}).join('');

function setActiveTab(sec){
  dtTabs.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.sec===sec); });
}

/* ----- 상세 사진 캐러셀 (placeholder 일러스트 3장 → 실제 이미지 URL로 교체 가능) ----- */
var dtPhoto = document.getElementById('dtPhoto');
var dtTrack = document.getElementById('dtTrack');
var dtCnt = document.getElementById('dtCnt');
var dtDots = document.getElementById('dtDots');
var PHOTO_N = 3;
var dtImgs = null;  /* 현재 상세 매물의 실사진 배열(없으면 null → SVG 폴백) */

function dtPhotoSVG(i){
  var base = '<rect width="375" height="250" fill="#EFEAE2"/><rect width="375" height="40" fill="#F3EFE9"/>';
  var floor = '<polygon points="0,150 375,135 375,250 0,250" fill="#C9A06B"/>'
    + '<g stroke="#b98f5a" stroke-width="1" opacity=".45"><line x1="0" y1="178" x2="375" y2="165"/><line x1="0" y1="208" x2="375" y2="197"/><line x1="0" y1="236" x2="375" y2="227"/></g>';
  var scenes = [
    /* 0 · 거실/창문 */
    '<rect x="6" y="48" width="78" height="150" fill="#F7F4EF" stroke="#e3ddd2"/><line x1="45" y1="48" x2="45" y2="198" stroke="#e3ddd2"/>'
    +'<rect x="92" y="60" width="120" height="82" fill="#fff" stroke="#e6e0d5"/><g stroke="#e6e0d5"><line x1="92" y1="88" x2="212" y2="88"/><line x1="92" y1="116" x2="212" y2="116"/><line x1="132" y1="60" x2="132" y2="142"/><line x1="172" y1="60" x2="172" y2="142"/></g>'
    +'<rect x="224" y="120" width="44" height="72" fill="#fbfaf7" stroke="#e2dccf"/><line x1="224" y1="150" x2="268" y2="150" stroke="#e2dccf"/><rect x="322" y="70" width="40" height="122" fill="#ded8cc"/><circle cx="180" cy="22" r="11" fill="#fcf7e8"/>',
    /* 1 · 침실 */
    '<rect x="40" y="118" width="180" height="82" rx="4" fill="#fbf8f3" stroke="#e2dccf"/><rect x="40" y="118" width="180" height="26" rx="4" fill="#efe7da" stroke="#e2dccf"/><rect x="54" y="96" width="46" height="28" rx="4" fill="#fff" stroke="#e6e0d5"/>'
    +'<rect x="250" y="66" width="92" height="126" fill="#fff" stroke="#e6e0d5"/><line x1="296" y1="66" x2="296" y2="192" stroke="#e6e0d5"/><circle cx="318" cy="130" r="3" fill="#cfc7ba"/><circle cx="274" cy="130" r="3" fill="#cfc7ba"/><circle cx="190" cy="24" r="10" fill="#fcf7e8"/>',
    /* 2 · 주방/욕실 */
    '<rect x="28" y="120" width="152" height="72" fill="#f0ece5" stroke="#ddd6c9"/><rect x="28" y="120" width="152" height="14" fill="#e7e0d4" stroke="#ddd6c9"/><circle cx="70" cy="160" r="9" fill="#eef1f3" stroke="#dfe3e6"/><circle cx="122" cy="160" r="9" fill="#eef1f3" stroke="#dfe3e6"/>'
    +'<rect x="210" y="60" width="56" height="132" fill="#fbfaf7" stroke="#e2dccf"/><line x1="210" y1="120" x2="266" y2="120" stroke="#e2dccf"/><rect x="292" y="80" width="62" height="62" fill="#fff" stroke="#e6e0d5"/><circle cx="323" cy="111" r="13" fill="#eef1f3" stroke="#dfe3e6"/>'
  ];
  return '<svg viewBox="0 0 375 250" preserveAspectRatio="xMidYMid slice">'+base+floor+scenes[i%scenes.length]+'</svg>';
}

function renderPhotos(){
  var html = '';
  for(var i=0;i<PHOTO_N;i++){
    var inner = dtImgs ? '<img src="'+dtImgs[i]+'" alt="" draggable="false">' : dtPhotoSVG(i);
    html += '<div class="dt-slide">'+inner+'</div>';
  }
  dtTrack.innerHTML = html;
  var dots = '';
  for(var j=0;j<PHOTO_N;j++) dots += '<i'+(j===0?' class="on"':'')+'></i>';
  dtDots.innerHTML = dots;
}

var pc = { down:false, active:false, x0:0, y0:0, dx:0, idx:0 };
function goSlide(i, animate){
  pc.idx = Math.max(0, Math.min(PHOTO_N-1, i));
  dtTrack.classList.toggle('anim', !!animate);
  dtTrack.style.transform = 'translateX('+(-pc.idx*100)+'%)';
  dtCnt.textContent = (pc.idx+1)+' / '+PHOTO_N+' 전체보기';
  dtDots.querySelectorAll('i').forEach(function(d,j){ d.classList.toggle('on', j===pc.idx); });
}
dtTrack.addEventListener('pointerdown', function(e){
  pc.down=true; pc.active=false; pc.x0=e.clientX; pc.y0=e.clientY; pc.dx=0;
  dtTrack.classList.remove('anim');
});
dtTrack.addEventListener('pointermove', function(e){
  if(!pc.down) return;
  var dx=e.clientX-pc.x0, dy=e.clientY-pc.y0;
  if(!pc.active){
    if(Math.abs(dx)<8 && Math.abs(dy)<8) return;
    if(Math.abs(dy)>Math.abs(dx)){ pc.down=false; return; } /* 세로 스크롤은 그대로 통과 */
    pc.active=true;
    try{ dtTrack.setPointerCapture(e.pointerId); }catch(_){}
  }
  pc.dx=dx;
  var w=dtPhoto.clientWidth||375;
  dtTrack.style.transform = 'translateX('+((-pc.idx*100)+(dx/w*100))+'%)';
});
function endDrag(){
  if(!pc.down) return;
  var wasActive=pc.active; pc.down=false; pc.active=false;
  if(!wasActive) return;
  var w=dtPhoto.clientWidth||375;
  if(pc.dx < -w*0.18) goSlide(pc.idx+1, true);
  else if(pc.dx > w*0.18) goSlide(pc.idx-1, true);
  else goSlide(pc.idx, true);
}
dtTrack.addEventListener('pointerup', endDrag);
dtTrack.addEventListener('pointercancel', endDrag);
/* ----- 진입 스켈레톤: 마크업 주입 + 0.3s 노출 후 콘텐츠 ----- */
document.getElementById('dtSkel').innerHTML =
  '<div class="sk sk-photo"></div><div class="sk-body">'
  + '<div class="sk sk-ln sk-w35"></div><div class="sk sk-ln big sk-w65"></div><div class="sk sk-ln sk-w45"></div>'
  + '<div class="sk-grid"><div class="sk sk-ln"></div><div class="sk sk-ln"></div><div class="sk sk-ln"></div><div class="sk sk-ln"></div></div>'
  + '<div class="sk sk-ln sk-w80" style="margin-top:22px"></div><div class="sk sk-ln sk-w90"></div><div class="sk sk-ln sk-w60"></div></div>';
document.getElementById('wishSkel').innerHTML = (function(){
  var row = '<div class="sk-wrow"><div class="sk sk-thumb"></div><div class="sk-wcol">'
    + '<div class="sk sk-ln sk-w80"></div><div class="sk sk-ln sk-w45"></div><div class="sk sk-ln sk-w35"></div></div></div>';
  return row + row + row + row + row;
})();
function openPage(page){
  page.classList.add('open', 'loading');
  clearTimeout(page._skelT);
  page._skelT = setTimeout(function(){ page.classList.remove('loading'); }, 500);
}

var currentDetailItem = null;
function openDetail(it){
  currentDetailItem = it;
  document.getElementById('dtKind').textContent = it.kindFull || (it.k + (it.bldg ? ' (' + it.bldg + ')' : ''));
  document.getElementById('dtPrice').textContent = it.p;
  document.getElementById('dtSub').textContent = it.dist;
  document.getElementById('dtCtaPrice').textContent = it.p.replace('만원','');
  var db = detail.querySelector('.desc-body');
  if(db && it.descHi){
    db.innerHTML =
      '<div class="desc-hi">'+it.descHi+'</div>'
      +'<div style="font-weight:700;margin-bottom:12px;">매물 정보</div>'
      +'<div class="desc-row"><span><b>교통</b> : '+it.traffic+'</span></div>'
      +'<div class="desc-row"><span><b>옵션</b> : '+it.opts+'</span></div>'
      +'<div class="desc-row"><span><b>입주시기</b> : '+it.avail+'</span></div>'
      +'<div class="desc-row"><span><b>주차</b> : '+it.parking+'</span></div>'
      +'<div class="desc-row"><span><b>주변시설</b> : '+it.nearby+'</span></div>'
      +'<div class="imm">📅 '+it.avail+'</div>';
  }
  // 추천 매물 / 이웃의 관심 매물 섹션 채우기
  (function(){
    var recMain = document.getElementById('recMain');
    var recNbr  = document.getElementById('recNbr');
    if(!recMain || !recNbr) return;
    var others = POOL.slice().filter(function(p){ return p !== it; });
    var sorted = others.slice().sort(function(a,b){ return b.like - a.like; });
    var top3 = sorted.slice(0, 3);
    var nbr1 = sorted.slice(3, 4);
    function adCard(p){
      var idx = POOL.indexOf(p);
      return '<div class="lst rec-card" data-ridx="'+idx+'">'
        +'<div class="ph">'+thumbImg(p, idx)+'</div>'
        +'<div class="info">'
        +'<div class="ptop"><div class="price">'+p.p+'</div>'
        +'<span>'+IC_HEART_O+'</span></div>'
        +'<div class="meta">'+p.k+' · '+p.py+' · '+p.fl+'</div>'
        +'<div class="meta sub">'+p.mg+' · '+p.dist+'</div>'
        +'<div class="pbot"><span class="dong">'+p.dong+' · <span class="rec-dong-ad">광고</span></span>'
        +'<span class="stats"><span class="st">'+IC_HEART_F+p.like+'</span></span></div>'
        +'</div></div>';
    }
    recMain.innerHTML = top3.map(adCard).join('');
    recNbr.innerHTML  = nbr1.map(adCard).join('');
    [recMain, recNbr].forEach(function(el){
      el.querySelectorAll('.rec-card').forEach(function(card){
        card.addEventListener('click', function(){
          openDetail(POOL[+card.dataset.ridx]);
        });
      });
    });
  })();
  dtImgs = (it.imgs && it.imgs.length) ? it.imgs : null;
  PHOTO_N = dtImgs ? dtImgs.length : 3;
  renderPhotos();
  goSlide(0, false);
  var dtFavEl = document.getElementById('dtFav');
  if(dtFavEl) dtFavEl.classList.toggle('on', WISH.some(function(w){ return w._pool === it; }));
  openPage(detail);
  dtScroll.scrollTop = 0;
  dtAppbar.classList.remove('solid');
  setActiveTab('desc');
}
function closeDetail(){
  detail.classList.remove('open');
  if(sheet.classList.contains('open') && listState.n > 0) renderListBody();
}

function on(id, fn){ var e = document.getElementById(id); if(e) e.addEventListener('click', fn); }
on('dtBack', closeDetail);
on('dtShare', function(){ toast('매물을 공유해요'); });
on('dtReport', function(){ toast('신고 사유를 선택해주세요'); });
on('dtInquiry', function(){ toast('중개소와 채팅을 시작해요'); });
on('dtAlert', function(){ toast('매물 알림을 설정했어요'); });
on('dtCall', function(){ toast('중개소로 전화를 걸어요'); });
on('dtList', function(){ toast('이 중개소의 매물을 모아봐요'); });
on('dtReviewAll', function(){ toast('중개소 후기를 모두 봐요'); });

var snackbar = document.getElementById('snackbar');
var snackText = document.getElementById('snackText');
var snackAction = document.getElementById('snackAction');
var snackT = null, snackCb = null;
function hideSnackbar(){
  snackbar.style.transition = 'transform .25s, opacity .25s';
  snackbar.style.opacity = '0';
  snackbar.style.transform = 'translateY(16px)';
  clearTimeout(snackbar._visT);
  snackbar._visT = setTimeout(function(){ snackbar.style.visibility = 'hidden'; }, 260);
}
function showSnackbar(text, action, cb, dur, bottomPx){
  snackText.textContent = text;
  if(action){ snackAction.textContent = action; snackAction.classList.remove('hide'); }
  else { snackAction.classList.add('hide'); }
  snackCb = cb || null;
  snackbar.style.bottom = (bottomPx !== undefined ? bottomPx : 24) + 'px';
  clearTimeout(snackT);
  clearTimeout(snackbar._visT);
  snackbar.style.transition = 'none';
  snackbar.style.visibility = 'visible';
  snackbar.style.opacity = '0';
  snackbar.style.transform = 'translateY(16px)';
  snackbar.getBoundingClientRect();
  setTimeout(function(){
    snackbar.style.transition = 'transform .25s, opacity .25s';
    snackbar.style.opacity = '1';
    snackbar.style.transform = 'translateY(0)';
  }, 20);
  snackT = setTimeout(hideSnackbar, dur || 3000);
}
snackAction.addEventListener('click', function(){
  clearTimeout(snackT);
  hideSnackbar();
  if(snackCb) snackCb();
});
on('dtFav', function(){
  this.classList.toggle('on');
  if(this.classList.contains('on')){
    openReasonModal(null);
  } else {
    var wi = WISH.filter(function(w){ return w._pool === currentDetailItem; })[0];
    if(wi) WISH.splice(WISH.indexOf(wi), 1);
  }
});

/* ----- 관심 기록 모달 ----- */
var reasonModal = document.getElementById('reasonModal');
var rmOverlay = document.getElementById('rmOverlay');
var rmChips = document.getElementById('rmChips');
var rmMemo = document.getElementById('rmMemo');
var rmCount = document.getElementById('rmCount');
rmChips.innerHTML = REASONS.map(function(r){
  return '<button class="rm-chip" type="button">'+r+'</button>';
}).join('');
rmChips.querySelectorAll('.rm-chip').forEach(function(c){
  c.addEventListener('click', function(){ c.classList.toggle('on'); });
});
rmMemo.addEventListener('input', function(){ rmCount.textContent = rmMemo.value.length + ' / 200'; });
var rmCard = reasonModal.querySelector('.rm-card');
var reasonModalItem = null;
var lastFavEl = null;
var rmOriginalReasons = [];
var rmOriginalMemo = '';
function openReasonModal(item){
  reasonModalItem = item || null;
  /* 칩 초기화 후 아이템 또는 전역 저장값으로 pre-select */
  var preReasons = item ? (item.reasons || []) : (savedReasons || []);
  rmChips.querySelectorAll('.rm-chip').forEach(function(c){
    c.classList.toggle('on', preReasons.indexOf(c.textContent) !== -1);
  });
  /* 메모 초기화 */
  var preMemo = item ? (item.memo || '') : (savedMemo || '');
  rmMemo.value = preMemo;
  rmCount.textContent = preMemo.length + ' / 200';
  /* 변경 감지용 스냅샷 */
  rmOriginalReasons = preReasons.slice();
  rmOriginalMemo = preMemo;
  rmOverlay.classList.add('open');
  reasonModal.style.visibility = 'visible';
  reasonModal.style.pointerEvents = 'auto';
  rmCard.style.transition = 'none';
  rmCard.style.transform = 'translateY(100%)';
  rmCard.getBoundingClientRect(); /* reflow: 초기값 확정 */
  setTimeout(function(){
    rmCard.style.transition = 'transform .3s cubic-bezier(.22,.61,.36,1)';
    rmCard.style.transform = 'translateY(0)';
  }, 20);
}
function closeReasonModal(){
  rmOverlay.classList.remove('open');
  rmCard.style.transition = 'transform .3s cubic-bezier(.22,.61,.36,1)';
  rmCard.style.transform = 'translateY(100%)';
  clearTimeout(reasonModal._closeT);
  reasonModal._closeT = setTimeout(function(){
    reasonModal.style.visibility = '';
    reasonModal.style.pointerEvents = '';
  }, 320);
}
var savedReasons = [];
var savedMemo = '';
function poolToWish(it, reasons, memo){
  return {
    img: (it.imgs && it.imgs.length) ? it.imgs[0] : null,
    ph: 'room',
    t: it.k + ' · ' + it.m2 + ' · ' + it.fl,
    desc: it.mg + ' · ' + it.dist,
    loc: '관악구 ' + (it.dong || '봉천동'),
    tm: '방금 전',
    p: it.p,
    chat: it.chat || 0,
    like: it.like || 0,
    reasons: reasons,
    memo: memo,
    _pool: it
  };
}
on('rmConfirm', function(){
  var reasons = [];
  rmChips.querySelectorAll('.rm-chip.on').forEach(function(c){ reasons.push(c.textContent); });
  var memo = rmMemo.value.trim();
  var changed = memo !== rmOriginalMemo
    || reasons.length !== rmOriginalReasons.length
    || reasons.some(function(r){ return rmOriginalReasons.indexOf(r) === -1; });
  if(reasonModalItem){
    var isWishEdit = !!reasonModalItem.ph;
    if(isWishEdit){
      /* 기존 관심 아이템 편집 */
      reasonModalItem.reasons = reasons;
      reasonModalItem.memo = memo;
      closeReasonModal();
      renderWish();
      if(changed) showSnackbar('관심 기록이 저장되었어요.', null, null, 3000);
    } else {
      /* 리스트 카드 하트 → WISH에 추가 */
      var already = WISH.some(function(w){ return w._pool === reasonModalItem; });
      if(!already) WISH.unshift(poolToWish(reasonModalItem, reasons, memo));
      closeReasonModal();
      if(changed || !already) showSnackbar('관심목록에 추가했어요.', '바로가기', openWishlist, 4000);
    }
  } else {
    /* 상세 페이지 하트 → WISH에 추가 */
    var src = currentDetailItem;
    if(src){
      var alreadyDt = WISH.some(function(w){ return w._pool === src; });
      if(!alreadyDt) WISH.unshift(poolToWish(src, reasons, memo));
      closeReasonModal();
      showSnackbar('관심목록에 추가했어요.', '바로가기', openWishlist, 4000, 98);
    } else {
      closeReasonModal();
    }
  }
});
function cancelReasonModal(){
  /* 리스트 카드 하트 → 취소 시 하트 OFF 복원 (WISH에 없으면) */
  if(lastFavEl && reasonModalItem && !reasonModalItem.ph){
    if(!WISH.some(function(w){ return w._pool === reasonModalItem; }))
      lastFavEl.classList.remove('on');
  }
  /* 상세 하트 → 취소 시 WISH 상태로 복원 */
  if(!reasonModalItem){
    var dtFavEl2 = document.getElementById('dtFav');
    if(dtFavEl2) dtFavEl2.classList.toggle('on', WISH.some(function(w){ return w._pool === currentDetailItem; }));
  }
  lastFavEl = null;
  closeReasonModal();
}
rmOverlay.addEventListener('click', cancelReasonModal);
reasonModal.addEventListener('click', function(e){
  if(!reasonModal.querySelector('.rm-card').contains(e.target)) cancelReasonModal();
});
detail.querySelectorAll('.locseg button').forEach(function(b){
  b.addEventListener('click', function(){
    detail.querySelectorAll('.locseg button').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on');
  });
});

var tabClicked = 0;
dtTabs.querySelectorAll('button').forEach(function(b){
  b.addEventListener('click', function(){
    var el = document.getElementById('sec-'+b.dataset.sec);
    if(!el) return;
    tabClicked = Date.now();
    setActiveTab(b.dataset.sec);
    /* 세로: 섹션 상단을 스티키 헤더 아래로 (scroll-margin-top 이 오프셋 처리) */
    dtScroll.scrollTo({ top: el.offsetTop - 104, behavior:'smooth' });
    /* 가로: 탭바 안에서만 가운데 정렬 (세로 영향 없음) */
    var target = b.offsetLeft - (dtTabs.clientWidth - b.offsetWidth) / 2;
    dtTabs.scrollTo({ left: Math.max(0, target), behavior:'smooth' });
  });
});
dtScroll.addEventListener('scroll', function(){
  var st = dtScroll.scrollTop;
  dtAppbar.classList.toggle('solid', st > 230);
  /* 방금 누른 탭과 스크롤 스파이가 충돌하지 않도록 잠깐 무시 */
  if(Date.now() - tabClicked < 600) return;
  var cur = 'desc';
  SECS.forEach(function(s){
    var el = document.getElementById('sec-'+s);
    if(el && el.offsetTop - 130 <= st) cur = s;
  });
  setActiveTab(cur);
});

/* ===== wishlist page ===== */
var wish = document.getElementById('wish');
var wishList = document.getElementById('wishList');
function wPhoto(t){
  if(t==='poster') return '<svg viewBox="0 0 104 104" preserveAspectRatio="none"><rect width="104" height="104" fill="#1B2A4A"/><rect y="30" width="104" height="20" fill="#E8B23A"/><rect x="14" y="58" width="76" height="6" rx="3" fill="#cdd3df" opacity=".5"/><rect x="14" y="70" width="58" height="5" rx="2" fill="#cdd3df" opacity=".35"/><rect x="62" y="84" width="30" height="12" rx="3" fill="#E8B23A"/></svg>';
  if(t==='shop') return '<svg viewBox="0 0 104 104" preserveAspectRatio="none"><rect width="104" height="104" fill="#cdd6da"/><rect x="0" y="18" width="30" height="86" fill="#7fa86a"/><rect x="84" y="28" width="20" height="76" fill="#8fb37a"/><rect x="22" y="34" width="60" height="70" fill="#e8ebed"/><rect x="30" y="48" width="44" height="42" fill="#3a4750"/></svg>';
  if(t==='land') return '<svg viewBox="0 0 104 104" preserveAspectRatio="none"><rect width="104" height="62" fill="#9CC7E8"/><rect y="58" width="104" height="46" fill="#C9B98E"/><circle cx="86" cy="20" r="10" fill="#FBE9A0"/><rect x="20" y="26" width="46" height="40" fill="#D9DBDD"/></svg>';
  var w = t==='room2' ? '#E7D9C8' : '#EDE7DD', f = t==='room2' ? '#C49A6C' : '#CDB389';
  return '<svg viewBox="0 0 104 104" preserveAspectRatio="none"><rect width="104" height="104" fill="'+w+'"/><rect y="64" width="104" height="40" fill="'+f+'"/><rect x="10" y="16" width="32" height="38" fill="#fff" opacity=".85"/><rect x="48" y="24" width="22" height="30" fill="#fff" opacity=".5"/><rect x="76" y="28" width="18" height="26" fill="#fff" opacity=".35"/></svg>';
}
function witemHTML(it){
  var reasons = it.reasons || [];
  var chips = reasons.slice(0, 3).map(function(r){ return '<span class="wrchip">'+r+'</span>'; }).join('');
  var rest = reasons.length - Math.min(reasons.length, 3);
  if(rest > 0) chips += '<span class="wrchip wrmore">+'+rest+'</span>';
  return '<div class="witem">'
    + '<div class="wcard-top">'
    +   '<div class="wph">'+(it.img ? '<img src="'+it.img+'" alt="" draggable="false" loading="lazy">' : wPhoto(it.ph))+'</div>'
    +   '<div class="winfo">'
    +     '<div class="wtop">'
    +       '<div class="wprice">'+it.p+'</div>'
    +       '<button class="wheart" aria-label="찜 취소"><svg width="24" height="24" viewBox="0 0 24 24" fill="#FF6F0F"><path d="M12 20.5s-7-4.4-9.3-8.4C1 8.7 3.2 5.5 6.5 5.5 8.7 5.5 12 8 12 8s3.3-2.5 5.5-2.5C20.8 5.5 23 8.7 21.3 12.1 19 16.1 12 20.5 12 20.5z"/></svg></button>'
    +     '</div>'
    +     '<div class="wsub1">'+it.t+'</div>'
    +     (it.desc ? '<div class="wsub2">'+it.desc+'</div>' : '')
    +     (chips ? '<div class="wrchips">'+chips+'</div>' : '')
    +     '<div class="wfoot"><span class="wloc">'+it.loc+' · '+it.tm+'</span>'
    +       '<span class="wlike">'+GRAY_HEART+it.like+'</span>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="wcard-btns">'
    +   '<button class="wchat">채팅하기</button>'
    +   '<button class="wmemo">'+IC_MEMO+'</button>'
    + '</div>'
    + '</div>';
}
function renderWish(){
  if(WISH.length === 0){
    wishList.innerHTML = '<div style="text-align:center; padding:80px 0; color:var(--ink-3); font-size:15px; line-height:1.6;">관심목록이 비었어요.<br>마음에 드는 매물에 하트를 눌러보세요.</div>';
    return;
  }
  var sorted = WISH.slice().sort(function(a, b){
    return (b.reasons || []).length - (a.reasons || []).length;
  });
  wishList.innerHTML = sorted.map(witemHTML).join('');
  var nodes = wishList.querySelectorAll('.witem');
  nodes.forEach(function(node, i){
    var it = sorted[i];
    node.querySelector('.wheart').addEventListener('click', function(e){
      e.stopPropagation();
      var idx = WISH.indexOf(it);
      if(idx !== -1) WISH.splice(idx, 1);
      renderWish();
      showSnackbar('관심목록에서 삭제했어요.', null, null, 3000);
    });
    node.querySelector('.wmemo').addEventListener('click', function(e){
      e.stopPropagation();
      openReasonModal(it);
    });
    node.querySelector('.wchat').addEventListener('click', function(e){
      e.stopPropagation();
    });
    node.addEventListener('click', function(){
      openDetail(it._pool || { kindFull: it.t, p: it.p, dist: it.loc });
    });
  });
}
function openWishlist(){ closeDetail(); renderWish(); wishList.scrollTop = 0; openPage(wish); setTab('wish'); }
function closeWishlist(){ wish.classList.remove('open'); setTab('map'); }
on('wishBack', closeWishlist);

/* ----- 탭바 ----- */
function setTab(name){
  document.getElementById('tabMap').classList.toggle('on', name === 'map');
  document.getElementById('tabWish').classList.toggle('on', name === 'wish');
}
document.getElementById('tabMap').addEventListener('click', function(){ closeWishlist(); closeDetail(); });
document.getElementById('tabWish').addEventListener('click', openWishlist);
wish.querySelectorAll('.wchip').forEach(function(c){
  c.addEventListener('click', function(){
    wish.querySelectorAll('.wchip').forEach(function(x){ x.classList.remove('on'); });
    c.classList.add('on');
  });
});
