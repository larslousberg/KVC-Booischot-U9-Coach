(() => {'use strict';
const P=['Ruimte herkennen / vrijlopen','1v1 oplossen / man uitschakelen','Vrije speler vinden / vrijspelen','Aannemen / balcontrole','Kijken vóór spelen','Passing / inspelen','Omschakelen'];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],id=()=>crypto.randomUUID();let db;
const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
function status(ok,msg){$('#storageHealth').className='health '+(ok?'ok':'error');$('#storageHealth').textContent=msg;$('#storageTitle').textContent=ok?'Opslag werkt':'Opslag niet beschikbaar';$('#storageText').textContent=ok?'Elke wijziging is in IndexedDB bewaard én teruggelezen.':msg}
async function open(){let r=indexedDB.open('kvc-u9-coach',1);r.onupgradeneeded=()=>{let d=r.result;d.createObjectStore('trainings',{keyPath:'id'});let f=d.createObjectStore('feedback',{keyPath:'id'});f.createIndex('trainingId','trainingId')};return req(r)}
async function all(s){return req(db.transaction(s).objectStore(s).getAll())}async function one(s,k){return req(db.transaction(s).objectStore(s).get(k))}async function put(s,v){let t=db.transaction(s,'readwrite');t.objectStore(s).put(v);await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error)});let confirmed=await one(s,v.id);if(!confirmed)throw Error('Opslag kon niet worden bevestigd.');status(true,'Opslag in orde')}
const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));const date=d=>new Intl.DateTimeFormat('nl-BE',{dateStyle:'long'}).format(new Date(d+'T12:00:00'));
const createdDate=d=>new Intl.DateTimeFormat('nl-BE',{dateStyle:'long'}).format(new Date(d));
function score(items){let v=Object.fromEntries(P.map(x=>[x,0]));items.forEach(x=>{x.good.forEach(p=>v[p]--);x.difficult.forEach(p=>v[p]+=3);x.repeat.forEach(p=>v[p]+=2)});let best=Math.max(...Object.values(v));if(best<=0)return null;let leaders=P.filter(p=>v[p]===best);return[leaders.length===1?leaders[0]:`Gelijke prioriteit: ${leaders.join(' + ')}`,best]}function picked(g){return $$(`[data-group="${g}"] input:checked`).map(x=>x.value)}
async function refresh(){
	let ts=(await all('trainings')).sort((a,b)=>b.date.localeCompare(a.date));
	let fs=await all('feedback');
	// Bepaal huidige hoofdfocus: meest recent expliciet gekozen `primary`
	let recentWithPrimary = fs.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).find(f=>f.primary);
	if(recentWithPrimary){
		$('#priorityTitle').textContent = recentWithPrimary.primary;
		let training = ts.find(t=>t.id===recentWithPrimary.trainingId);
		let trainingLabel = training? `${esc(training.title)} · ${date(training.date)}` : 'Onbekende training';
		$('#priorityText').textContent = `Gekozen door trainer op ${createdDate(recentWithPrimary.createdAt)} bij ${trainingLabel}. Secundaire observaties — Goed: ${esc(recentWithPrimary.good.join(', ')||'—')} · Moeilijk: ${esc(recentWithPrimary.difficult.join(', ')||'—')} · Terug: ${esc(recentWithPrimary.repeat.join(', ')||'—')}`;
	}else{
		$('#priorityTitle').textContent = 'Geen hoofdfocus gekozen';
		$('#priorityText').textContent = 'Er is geen recente expliciete hoofdfocus gekozen.';
	}

	$('#trainingList').innerHTML = ts.length?ts.map(t=>`<article class="training-item"><span class="tag">Concept</span><h3>${esc(t.title)}</h3><p>${date(t.date)} · ${esc(t.priority)}</p><p>${fs.filter(f=>f.trainingId===t.id).length} feedback-item(s)</p></article>`).join(''):'<p>Nog geen training bewaard.</p>';

	let form=$('#feedbackForm'),gate=$('#feedbackGate'),sel=$('#feedbackTraining');
	if(!ts.length){
		gate.textContent='Maak en bewaar eerst een training. Daarna kun je er feedback aan koppelen.';form.classList.add('hidden')
	}else{
		gate.textContent='Kies hieronder de training waarover je feedback geeft.';form.classList.remove('hidden');let old=sel.value;sel.innerHTML=ts.map(t=>`<option value="${t.id}">${date(t.date)} — ${esc(t.title)}</option>`).join('');if(ts.some(t=>t.id===old))sel.value=old
	}

	// Historiek: markeer feedbacks met een expliciete hoofdfocus
	$('#historyList').innerHTML = ts.length?ts.map(t=>{let q=fs.filter(f=>f.trainingId===t.id);return `<article class="training-item"><h3>${esc(t.title)}</h3><p>${date(t.date)} · ${esc(t.priority)}</p>${q.length?`<p><strong>${q.length} feedback-item(s)</strong></p>`+q.map(f=>{let primaryHtml = f.primary?`<p><strong>Hoofdfocus gekozen: ${esc(f.primary)}</strong></p>`:'';return `${primaryHtml}<p>✓ Goed: ${esc(f.good.join(', ')||'—')}<br>! Moeilijk: ${esc(f.difficult.join(', ')||'—')}<br>↺ Terug: ${esc(f.repeat.join(', ')||'—')}</p>`}).join(''):'<p>Nog geen feedback bij deze training.</p>'}</article>`}).join(''):'<p>Nog geen trainingsdossiers.</p>'}
function view(x){$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===x));$$('.view').forEach(v=>v.classList.toggle('active',v.id===x));refresh()}
async function init(){
	P.forEach(p=>$('#trainingPriority').insertAdjacentHTML('beforeend',`<option>${esc(p)}</option>`));
	// populate checkbox lists
	['good','difficult','repeat'].forEach(g=>{$(`[data-group="${g}"]`).innerHTML=P.map(p=>`<label><input type="checkbox" value="${esc(p)}">${esc(p)}</label>`).join('')});
	// ensure feedback primary selector exists (inject if not present) and populate its options
	let primaryOptions = `<option value="">Geen hoofdfocus</option>` + P.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
	if($('#feedbackPrimary')){
		$('#feedbackPrimary').innerHTML = primaryOptions;
	}else{
		let liveEl = $('#livePriority');
		if(liveEl) liveEl.parentElement.insertAdjacentHTML('beforebegin', `<label>Hoofdfocus voor de volgende training<select id="feedbackPrimary" name="primary">${primaryOptions}</select></label>`);
	}

	$('#trainingForm [name=date]').value=new Date().toISOString().slice(0,10);
	try{if(!window.indexedDB)throw Error();db=await open();await put('trainings',{id:'healthcheck',date:'2099-01-01',title:'__healthcheck__',priority:P[0]});let tx=db.transaction('trainings','readwrite');tx.objectStore('trainings').delete('healthcheck');status(true,'Opslag in orde');await refresh()}catch(e){console.error(e);status(false,'Opslag niet beschikbaar');$$('form button,input,select').forEach(x=>x.disabled=true)}$$('.nav').forEach(x=>x.onclick=()=>view(x.dataset.view));$$('[data-go]').forEach(x=>x.onclick=()=>view(x.dataset.go));
$('#trainingForm').onsubmit=async e=>{e.preventDefault();let s=$('#trainingStatus'),f=new FormData(e.target);try{s.textContent='Bewaren…';await put('trainings',{id:id(),type:'training',date:f.get('date'),title:f.get('title').trim(),priority:f.get('priority'),notes:f.get('notes').trim(),createdAt:new Date().toISOString()});s.textContent='✓ Training bewaard en gecontroleerd.';e.target.reset();$('#trainingForm [name=date]').value=new Date().toISOString().slice(0,10);await refresh()}catch(x){s.textContent='⚠ Training kon niet bevestigd worden.';s.className='form-status error'}};
$('#feedbackForm').onsubmit=async e=>{e.preventDefault();let s=$('#feedbackStatus'),trainingId=$('#feedbackTraining').value;try{if(!await one('trainings',trainingId))throw Error('De gekozen training bestaat niet.');let primary = $('#feedbackPrimary')?$('#feedbackPrimary').value:null; if(primary==='') primary=null;let f={id:id(),type:'feedback',parentType:'training',parentId:trainingId,trainingId,good:picked('good'),difficult:picked('difficult'),repeat:picked('repeat'),primary:primary,createdAt:new Date().toISOString()};if(!f.good.length&&!f.difficult.length&&!f.repeat.length)throw Error('Kies minstens één feedbackpunt.');s.textContent='Bewaren…';await put('feedback',f);if(!await one('feedback',f.id))throw Error('Feedback niet teruggevonden.');s.textContent='✓ Feedback opgeslagen bij de gekozen training en gecontroleerd.';$$('#feedbackForm input').forEach(x=>x.checked=false);if($('#feedbackPrimary'))$('#feedbackPrimary').value='';await live();await refresh()}catch(x){s.textContent='⚠ '+x.message;s.className='form-status error'}};$('#feedbackForm').onchange=live}
async function live(){
	let sel = $('#feedbackPrimary')?$('#feedbackPrimary').value:'';
	if(sel && sel!=='') $('#livePriority').textContent = esc(sel);
	else $('#livePriority').textContent = 'Geen hoofdfocus gekozen.';
}
init();
})();
