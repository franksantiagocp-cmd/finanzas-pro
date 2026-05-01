/* ── Constantes ─────────────────────────────────────────────────────── */
const SUBS = ['ahorro','personal','matrimonio','hijos','deudas'];
const SUB_META = {
  ahorro:     { label:'Ahorro',     color:'#3b82f6' },
  personal:   { label:'Personal',   color:'#10b981' },
  matrimonio: { label:'Matrimonio', color:'#ec4899' },
  hijos:      { label:'Hijos',      color:'#f59e0b' },
  deudas:     { label:'Deudas',     color:'#a78bfa' },
};
const PALETTE = ['#3b82f6','#10b981','#ec4899','#f59e0b','#a78bfa','#f97316','#06b6d4','#84cc16'];

/* ── Estado ─────────────────────────────────────────────────────────── */
const S = {
  cfg: null,
  dark: true,
  charts: {},
  gastoSub: null,
  confirmCb: null,
  previewTimer: null,
};

/* ── Utilidades ─────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(n||0);
const fmtD = d => {
  if (!d) return '';
  const s = (d+'').split('T')[0];
  const [y,m,dd] = s.split('-');
  return `${dd}/${m}/${y}`;
};

async function api(method, url, body) {
  const o = { method, headers:{'Content-Type':'application/json'} };
  if (body !== undefined) o.body = JSON.stringify(body);
  const r = await fetch(url, o);
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

/* ── Tema ────────────────────────────────────────────────────────────── */
function applyTheme() {
  document.body.classList.toggle('lm', !S.dark);
  $('theme-btn').textContent = S.dark ? '☀' : '☾';
}
async function toggleTheme() {
  S.dark = !S.dark; applyTheme();
  try { await api('PUT','/api/config/dark-mode',{darkMode:S.dark}); } catch(e) {}
  renderCharts();
}

/* ── Nav ─────────────────────────────────────────────────────────────── */
function goPage(name, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'));
  const pg = $('page-'+name); if (!pg) return;
  pg.classList.add('on');
  if (btn) btn.classList.add('on');
  else { const b=document.querySelector(`.nb[data-page="${name}"]`); if(b) b.classList.add('on'); }
  if (name==='inicio')         renderInicio();
  else if (name==='ingresos')  { buildCatIngSelect(); renderTablaIng(); }
  else if (SUBS.includes(name)) renderSub(name);
  else if (name==='graficas')  setTimeout(renderCharts,120);
  else if (name==='config')    renderConfig();
}

function switchTab(el, tabId) {
  el.closest('.tab-bar').querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  ['gt-ing','gt-gas','gt-sub'].forEach(id=>{ const e=$(id); if(e) e.style.display=id===tabId?'':'none'; });
  setTimeout(renderCharts,80);
}

/* ── INICIO ──────────────────────────────────────────────────────────── */
async function renderInicio() {
  let data; try { data=await api('GET','/api/dashboard'); } catch(e){ console.error(e); return; }

  const total = SUBS.reduce((a,s)=>a+parseFloat(data.saldos?.[s]?.saldo||0),0);
  $('saldo-total').textContent = fmt(total);
  $('fecha-display').textContent = new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const grid = $('sub-grid');
  if (grid) grid.innerHTML = SUBS.map(s=>{
    const m=SUB_META[s], sd=data.saldos?.[s]||{};
    const saldo=parseFloat(sd.saldo||0);
    const base =parseFloat(sd.inicial||0)+parseFloat(sd.ingresado||0);
    const pct  =base>0?Math.max(0,Math.min(100,saldo/base*100)).toFixed(0):0;
    return `<div class="sub-card" onclick="goPage('${s}')">
      <div class="sub-card-top">
        <span class="sub-label">${m.label}</span>
        <div class="sub-dot" style="background:${m.color}"></div>
      </div>
      <div class="sub-amt" style="color:${m.color}">${fmt(saldo)}</div>
      <div class="sub-bar"><div class="sub-bar-fill" style="width:${pct}%;background:${m.color}"></div></div>
      <div class="sub-meta">${pct}% disponible</div>
    </div>`;
  }).join('');

  const ti=$('t-ult-ing');
  if(ti) ti.innerHTML=data.ultIngresos?.length
    ? data.ultIngresos.map(r=>`<tr><td>${fmtD(r.fecha)}</td><td>${r.categoria}</td><td class="tp" style="text-align:right">${fmt(r.monto)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="empty">Sin registros</td></tr>`;

  const tg=$('t-ult-gas');
  if(tg) tg.innerHTML=data.ultGastos?.length
    ? data.ultGastos.map(r=>`<tr><td>${fmtD(r.fecha)}</td><td>${SUB_META[r.subcuenta]?.label||r.subcuenta}</td><td class="tn" style="text-align:right">-${fmt(r.monto)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="empty">Sin registros</td></tr>`;

  S.dashData = data;
}

/* ── INGRESOS ────────────────────────────────────────────────────────── */
function buildCatIngSelect() {
  const sel=$('ing-cat'); if(!sel||!S.cfg) return;
  const prev=sel.value;
  sel.innerHTML='<option value="">— Seleccionar —</option>'+
    S.cfg.catIngresos.map(c=>`<option value="${c.id}" ${c.id==prev?'selected':''}>${c.nombre}</option>`).join('');
}

async function renderTablaIng() {
  const tb=$('t-ing'); if(!tb) return;
  try {
    const rows=await api('GET','/api/ingresos');
    tb.innerHTML=rows.length
      ? rows.map(r=>`<tr>
          <td>${fmtD(r.fecha)}</td>
          <td><span class="badge badge-ing">${r.categoria}</span></td>
          <td class="tm">${r.descripcion||'—'}</td>
          <td class="tp" style="text-align:right">${fmt(r.monto)}</td>
          <td><button class="btn btn-d btn-ico btn-sm" onclick="delIng(${r.id})">✕</button></td>
        </tr>`).join('')
      : `<tr><td colspan="5" class="empty">Sin ingresos registrados</td></tr>`;
  } catch(e) { tb.innerHTML=`<tr><td colspan="5" class="empty">Error al cargar</td></tr>`; }
}

async function registrarIngreso() {
  const fecha=$('ing-fecha').value, cat_id=$('ing-cat').value;
  const monto=parseFloat($('ing-monto').value), desc=$('ing-desc').value.trim();
  if (!fecha)         { alert('Selecciona una fecha.'); return; }
  if (!cat_id)        { alert('Selecciona una categoría.'); return; }
  if (!monto||monto<=0){ alert('Ingresa un monto válido.'); return; }
  try {
    await api('POST','/api/ingresos',{fecha,categoria_id:parseInt(cat_id),monto,descripcion:desc});
    $('ing-fecha').value=''; $('ing-monto').value=''; $('ing-desc').value=''; $('ing-cat').value='';
    const dw=$('dist-wrap'); if(dw) dw.style.display='none';
    await renderTablaIng(); await renderInicio();
  } catch(e) { alert(e.message); }
}

async function delIng(id) {
  confirm2('¿Eliminar este ingreso? Se ajustarán los saldos.', async()=>{
    await api('DELETE',`/api/ingresos/${id}`);
    await renderTablaIng(); await renderInicio();
  });
}

let prevTimer;
async function previewDist() {
  const monto=parseFloat($('ing-monto')?.value)||0, cat_id=$('ing-cat')?.value;
  const dw=$('dist-wrap'); if(!dw) return;
  if (!monto||!cat_id) { dw.style.display='none'; return; }
  clearTimeout(prevTimer);
  prevTimer=setTimeout(async()=>{
    try {
      const d=await api('GET',`/api/ingresos/preview?monto=${monto}&categoria_id=${cat_id}`);
      const max=Math.max(...Object.values(d),1);
      dw.style.display='block';
      $('dist-prev').innerHTML=SUBS.map(s=>`
        <div class="dp-row">
          <span class="dp-lbl">${SUB_META[s].label}</span>
          <div class="dp-bar"><div class="dp-fill" style="width:${((d[s]||0)/max*100).toFixed(1)}%;background:${SUB_META[s].color}"></div></div>
          <span class="dp-amt" style="color:${SUB_META[s].color}">${fmt(d[s]||0)}</span>
        </div>`).join('');
    } catch(e){ dw.style.display='none'; }
  },350);
}

/* ── CATEGORÍAS INGRESO ──────────────────────────────────────────────── */
function renderChipsIng() {
  const chips=$('chips-ing'); if(!chips||!S.cfg) return;
  chips.innerHTML=S.cfg.catIngresos.map(c=>`<span class="chip">
    ${c.nombre}
    ${c.especial ? `<span class="chip-esp">★</span>` : `<span class="chip-x" onclick="delCatIng(${c.id})">×</span>`}
  </span>`).join('');
}
async function addCatIng() {
  const inp=$('new-ing-name'), nombre=inp?.value.trim(); if(!nombre) return;
  try {
    await api('POST','/api/config/categorias-ingresos',{nombre});
    S.cfg=await api('GET','/api/config');
    inp.value=''; closeM('m-cat-ing'); renderChipsIng(); buildCatIngSelect();
  } catch(e){ alert(e.message); }
}
async function delCatIng(id) {
  confirm2('¿Eliminar esta categoría de ingreso?', async()=>{
    await api('DELETE',`/api/config/categorias-ingresos/${id}`);
    S.cfg=await api('GET','/api/config'); renderChipsIng(); buildCatIngSelect();
  });
}

/* ── SUBCUENTA PAGE ──────────────────────────────────────────────────── */
async function renderSub(sub) {
  const c=$('c-'+sub); if(!c) return;
  c.innerHTML='<div class="empty">Cargando...</div>';
  let dash,gastos;
  try { [dash,gastos]=await Promise.all([api('GET','/api/dashboard'),api('GET',`/api/gastos?subcuenta=${sub}`)]); }
  catch(e){ c.innerHTML='<div class="empty">Error al cargar</div>'; return; }
  const m=SUB_META[sub], sd=dash.saldos?.[sub]||{};
  const saldo=parseFloat(sd.saldo||0),ini=parseFloat(sd.inicial||0),
        ing=parseFloat(sd.ingresado||0),gas=parseFloat(sd.gastado||0);

  c.innerHTML=`
    <div class="sub-hero">
      <div class="eyebrow">${m.label}</div>
      <div>
        <span class="sub-hero-amount" style="color:${m.color}">${fmt(saldo)}</span>
        <span class="sub-hero-currency">MXN</span>
      </div>
      <div class="sub-hero-meta">
        <span>Inicial: <strong style="color:var(--t2);font-family:var(--mono)">${fmt(ini)}</strong></span>
        <span>Ingresado: <strong style="color:var(--t2);font-family:var(--mono)">${fmt(ing)}</strong></span>
        <span>Gastado: <strong style="color:var(--rd);font-family:var(--mono)">${fmt(gas)}</strong></span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="sec-hdr">
      <span class="sec-label">Historial de gastos</span>
      <button class="btn btn-p" onclick="openGasto('${sub}')">+ Registrar gasto</button>
    </div>
    <div class="tbox">
      <table>
        <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th style="text-align:right">Monto</th><th></th></tr></thead>
        <tbody id="t-gas-${sub}"></tbody>
      </table>
    </div>`;

  const tb=$('t-gas-'+sub);
  if(tb) tb.innerHTML=gastos.length
    ? gastos.map(r=>`<tr>
        <td>${fmtD(r.fecha)}</td>
        <td><span class="badge badge-gas">${r.categoria||'—'}</span></td>
        <td class="tm">${r.descripcion||'—'}</td>
        <td class="tn" style="text-align:right">-${fmt(r.monto)}</td>
        <td><button class="btn btn-d btn-ico btn-sm" onclick="delGas(${r.id},'${sub}')">✕</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty">Sin gastos registrados</td></tr>`;
}

function openGasto(sub) {
  S.gastoSub=sub;
  $('m-gasto-title').textContent=`Registrar gasto — ${SUB_META[sub].label}`;
  const sel=$('g-cat');
  if(sel) sel.innerHTML=(S.cfg?.catGastos||[]).map(c=>`<option value="${c.nombre}">${c.nombre}</option>`).join('');
  ['g-fecha','g-desc','g-monto'].forEach(id=>{ const e=$(id); if(e) e.value=''; });
  openM('m-gasto');
}

async function registrarGasto() {
  const sub=S.gastoSub; if(!sub) return;
  const fecha=$('g-fecha')?.value, cat=$('g-cat')?.value;
  const desc=$('g-desc')?.value.trim(), monto=parseFloat($('g-monto')?.value);
  if (!fecha)          { alert('Selecciona una fecha.'); return; }
  if (!monto||monto<=0){ alert('Ingresa un monto válido.'); return; }
  try {
    await api('POST','/api/gastos',{subcuenta:sub,fecha,categoria:cat||'',descripcion:desc||'',monto});
    closeM('m-gasto'); await renderSub(sub); await renderInicio();
  } catch(e){ alert(e.message); }
}

async function delGas(id,sub) {
  confirm2('¿Eliminar este gasto?', async()=>{
    await api('DELETE',`/api/gastos/${id}`); await renderSub(sub); await renderInicio();
  });
}

/* ── CATEGORÍAS GASTO ────────────────────────────────────────────────── */
function renderChipsGas() {
  const chips=$('chips-gas'); if(!chips||!S.cfg) return;
  chips.innerHTML=S.cfg.catGastos.map(c=>`<span class="chip">
    ${c.nombre}<span class="chip-x" onclick="delCatGas(${c.id})">×</span>
  </span>`).join('');
}
async function addCatGas() {
  const inp=$('new-gas-name'), nombre=inp?.value.trim(); if(!nombre) return;
  try {
    await api('POST','/api/config/categorias-gastos',{nombre});
    S.cfg=await api('GET','/api/config');
    inp.value=''; closeM('m-cat-gas'); renderChipsGas();
  } catch(e){ alert(e.message); }
}
async function delCatGas(id) {
  confirm2('¿Eliminar esta categoría de gasto?', async()=>{
    await api('DELETE',`/api/config/categorias-gastos/${id}`);
    S.cfg=await api('GET','/api/config'); renderChipsGas();
  });
}

/* ── CONFIG ──────────────────────────────────────────────────────────── */
async function renderConfig() {
  try { S.cfg=await api('GET','/api/config'); } catch(e){ return; }
  const pi=$('pension-inp'); if(pi) pi.value=S.cfg.pension||1997;
  renderSaldosGrid(); renderChipsIng(); renderChipsGas();
}

function renderSaldosGrid() {
  const grid=$('si-grid'); if(!grid||!S.cfg) return;
  grid.innerHTML=SUBS.map(s=>{
    const m=SUB_META[s], val=parseFloat(S.cfg.saldosIniciales?.[s]||0);
    return `<div class="si-card">
      <span class="si-lbl" style="color:${m.color}">${m.label}</span>
      <input type="number" class="si-inp" id="si-${s}" value="${val>0?val:''}" placeholder="0.00"
        style="border-color:${m.color}33">
      <div class="si-saved" id="si-sv-${s}">${val>0?fmt(val):''}</div>
    </div>`;
  }).join('');
}

async function guardarSaldos() {
  const saldos={};
  SUBS.forEach(s=>{ saldos[s]=parseFloat($('si-'+s)?.value)||0; });
  try {
    await api('PUT','/api/config/saldos-iniciales',{saldos});
    S.cfg=await api('GET','/api/config');
    const ok=$('si-ok');
    if(ok){ ok.style.display='inline-block'; setTimeout(()=>ok.style.display='none',2500); }
    renderSaldosGrid(); renderInicio();
  } catch(e){ alert(e.message); }
}

async function guardarPension() {
  const monto=parseFloat($('pension-inp')?.value);
  if (!monto||monto<0){ alert('Monto inválido'); return; }
  try {
    await api('PUT','/api/config/pension',{monto});
    S.cfg=await api('GET','/api/config');
    alert(`Pensión actualizada: ${fmt(monto)}`);
  } catch(e){ alert(e.message); }
}

/* ── MODALES ─────────────────────────────────────────────────────────── */
function openM(id)  { const e=$(id); if(e) e.classList.add('on'); }
function closeM(id) { const e=$(id); if(e) e.classList.remove('on'); }
function confirm2(msg,cb) {
  const b=$('m-confirm-body'); if(b) b.textContent=msg;
  S.confirmCb=cb; openM('m-confirm');
}

/* ── GRÁFICAS ────────────────────────────────────────────────────────── */
function destroyChart(k) { if(S.charts[k]){ try{S.charts[k].destroy();}catch(e){} delete S.charts[k]; } }

async function renderCharts() {
  let data; try { data=await api('GET','/api/dashboard'); } catch(e){ return; }
  const tc=S.dark?'#3d4f68':'#94a3b8';
  const gc=S.dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)';
  const bc=S.dark?'#090c10':'#ffffff';
  const yTick = { ticks:{color:tc,callback:v=>'$'+Number(v).toLocaleString('es-MX')}, grid:{color:gc} };
  const xTick = { ticks:{color:tc}, grid:{color:gc} };

  // Ingresos dona
  const c1=$('ch-ing-cat');
  if(c1&&data.graficas?.ingPorCat?.length){
    destroyChart('ic');
    S.charts['ic']=new Chart(c1,{type:'doughnut',data:{
      labels:data.graficas.ingPorCat.map(r=>r.categoria),
      datasets:[{data:data.graficas.ingPorCat.map(r=>parseFloat(r.total)),
        backgroundColor:PALETTE,borderWidth:2,borderColor:bc}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'right',labels:{color:tc,boxWidth:11,font:{size:11,family:'DM Sans'}}}}}});
  }

  // Ingresos barras mes
  const c2=$('ch-ing-mes');
  if(c2&&data.graficas?.ingPorMes?.length){
    destroyChart('im');
    S.charts['im']=new Chart(c2,{type:'bar',data:{
      labels:data.graficas.ingPorMes.map(r=>r.mes),
      datasets:[{label:'MXN',data:data.graficas.ingPorMes.map(r=>parseFloat(r.total)),
        backgroundColor:'rgba(37,99,235,.7)',borderRadius:5,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},scales:{x:xTick,y:yTick}}});
  }

  // Gastos dona
  const c3=$('ch-gas-cat');
  if(c3&&data.graficas?.gasPorCat?.length){
    destroyChart('gc');
    S.charts['gc']=new Chart(c3,{type:'doughnut',data:{
      labels:data.graficas.gasPorCat.map(r=>r.categoria||'Sin categoría'),
      datasets:[{data:data.graficas.gasPorCat.map(r=>parseFloat(r.total)),
        backgroundColor:PALETTE,borderWidth:2,borderColor:bc}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'right',labels:{color:tc,boxWidth:11,font:{size:11,family:'DM Sans'}}}}}});
  }

  // Gastos barras subcuenta
  const c4=$('ch-gas-sub');
  if(c4){
    destroyChart('gs');
    S.charts['gs']=new Chart(c4,{type:'bar',data:{
      labels:SUBS.map(s=>SUB_META[s].label),
      datasets:[{label:'Gastos MXN',data:SUBS.map(s=>parseFloat(data.saldos?.[s]?.gastado||0)),
        backgroundColor:SUBS.map(s=>SUB_META[s].color),borderRadius:5,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},scales:{x:xTick,y:yTick}}});
  }

  // Saldos agrupado
  const c5=$('ch-saldos');
  if(c5){
    destroyChart('sl');
    S.charts['sl']=new Chart(c5,{type:'bar',data:{
      labels:SUBS.map(s=>SUB_META[s].label),
      datasets:[
        {label:'Base total',data:SUBS.map(s=>parseFloat(data.saldos?.[s]?.inicial||0)+parseFloat(data.saldos?.[s]?.ingresado||0)),
          backgroundColor:SUBS.map(s=>SUB_META[s].color+'44'),borderRadius:4,borderSkipped:false},
        {label:'Saldo actual',data:SUBS.map(s=>parseFloat(data.saldos?.[s]?.saldo||0)),
          backgroundColor:SUBS.map(s=>SUB_META[s].color),borderRadius:4,borderSkipped:false},
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:tc,boxWidth:11,font:{size:11,family:'DM Sans'}}}},
        scales:{x:xTick,y:yTick}}});
  }
}

/* ── ARRANQUE ────────────────────────────────────────────────────────── */
(async()=>{
  // Confirm modal
  $('m-confirm-ok').onclick=()=>{
    closeM('m-confirm');
    if(S.confirmCb){ S.confirmCb(); S.confirmCb=null; }
  };

  // Nav
  document.querySelectorAll('#nav .nb').forEach(btn=>{
    btn.onclick=()=>goPage(btn.dataset.page,btn);
  });

  // Config inicial
  try { S.cfg=await api('GET','/api/config'); } catch(e){ console.error('Config error',e); }
  S.dark = S.cfg?.darkMode ?? true;
  applyTheme();

  // Render inicio
  await renderInicio();
})();
