const $ = id => document.getElementById(id);
let state, selectedId, tab='step', markerMode=false, updateChain=Promise.resolve(), undoState=null, toastTimer;
async function api(action,data) {const r=await window.stepfolio.call(action,data);if(!r.ok)throw new Error(r.error);return r.value;}
function toast(message,error=false,undo=false){$('toast-message').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;$('undo').hidden=!undo;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},error?12000:5000);}
function safe(fn){return async(...args)=>{try{await fn(...args);}catch(e){toast(e.message,true);}};}
function queueUpdate(){const snapshot=structuredClone(state.project);state.dirty=true;updateChain=updateChain.then(()=>api('update',snapshot)).catch(e=>toast(e.message,true));$('save-state').textContent='แก้ไขแล้ว · กู้คืนอัตโนมัติ';}
function current(){return state.project.steps.find(s=>s.id===selectedId);}
function renderList(){const list=$('step-list');list.replaceChildren();$('count').textContent=state.project.steps.length;if(!state.project.steps.length){list.innerHTML='<div class="list-empty"><span>▧</span>ยังไม่มีขั้นตอน<br>ภาพจากการสาธิตจะปรากฏที่นี่</div>';return;}state.project.steps.forEach((s,i)=>{const b=document.createElement('button');b.className='step-card'+(s.id===selectedId?' selected':'');b.setAttribute('aria-label',`ขั้นตอนที่ ${i+1} ${s.title}`);const num=document.createElement('span');num.className='step-num';num.textContent=String(i+1).padStart(2,'0');const img=document.createElement('img');img.className='step-thumb';img.src=s.image;img.alt='';const meta=document.createElement('div');meta.className='step-meta';const title=document.createElement('strong');title.textContent=s.title||`ขั้นตอนที่ ${i+1}`;const sub=document.createElement('small');sub.textContent=s.description?'มีคำอธิบายแล้ว':'เพิ่มคำอธิบาย';meta.append(title,sub);b.append(num,img,meta);b.onclick=()=>{selectedId=s.id;tab='step';markerMode=false;render();};list.append(b);});}
function render(){if(!state)return;if(!current())selectedId=state.project.steps[0]?.id;renderList();const s=current();$('tab-step').classList.toggle('active',tab==='step');$('tab-project').classList.toggle('active',tab==='project');$('empty').hidden=tab!=='step'||!!s;$('step-editor').hidden=tab!=='step'||!s;$('project-editor').hidden=tab!=='project';$('export').disabled=!state.project.steps.length||state.recording;$('record').disabled=state.recording||state.starting||state.stopping;$('save-state').textContent=state.dirty?'แก้ไขแล้ว · กู้คืนอัตโนมัติ':state.currentFile?'บันทึกโครงการแล้ว':'พร้อมเริ่มโครงการใหม่';$('step-position').textContent=s?`ขั้นตอน ${state.project.steps.indexOf(s)+1} จาก ${state.project.steps.length}`:'เริ่มสร้างคู่มือแรกของคุณ';document.title=(state.dirty?'● ':'')+state.project.title+' — Stepfolio';for(const key of ['title','description','author'])$('project-'+key).value=state.project[key];if(s){$('step-title').value=s.title;$('step-description').value=s.description;$('event-label').textContent=s.event;$('step-image').src=s.image;renderMarker();$('move-up').disabled=state.project.steps.indexOf(s)===0;$('move-down').disabled=state.project.steps.indexOf(s)===state.project.steps.length-1;}}
for(const key of ['title','description'])$('step-'+key).oninput=()=>{const s=current();if(!s)return;s[key]=$('step-'+key).value;queueUpdate();renderList();};
for(const key of ['title','description','author'])$('project-'+key).oninput=()=>{state.project[key]=$('project-'+key).value;queueUpdate();};
$('tab-step').onclick=()=>{tab='step';render();};$('tab-project').onclick=()=>{tab='project';render();};
for(const action of ['open','new','recover'])$(action).onclick=safe(async()=>{await updateChain;await api(action);if(action==='recover')$('recovery').hidden=true;});
$('dismiss-recovery').onclick=()=>{$('recovery').hidden=true;};
$('save').onclick=safe(async()=>{await updateChain;if(await api('save',false))toast('บันทึกไฟล์โครงการเรียบร้อย');});
$('save-as').onclick=safe(async()=>{await updateChain;if(await api('save',true))toast('บันทึกสำเนาโครงการเรียบร้อย');});
$('export').onclick=safe(async()=>{await updateChain;$('export').disabled=true;$('export').textContent='กำลังสร้าง PDF…';try{if(await api('export'))toast('ส่งออก PDF เรียบร้อยแล้ว');}finally{$('export').textContent='ส่งออก PDF ↗';$('export').disabled=false;}});
async function permissions(){const p=await api('permissions');const box=$('permissions');box.replaceChildren();if(state.platform!=='darwin'){box.textContent='พร้อมบันทึก · ไม่เก็บข้อความที่พิมพ์';return;}for(const [key,label]of [['screen','การบันทึกหน้าจอ'],['access','Accessibility']]){const row=document.createElement('div');row.className='permission-row';const text=document.createElement('span');text.textContent=(p[key]?'✓ ':'○ ')+label;row.append(text);if(!p[key]){const b=document.createElement('button');b.className='text-button';b.textContent='เปิดการตั้งค่า ↗';b.onclick=safe(()=>api('settings',key));row.append(b);}box.append(row);}const note=document.createElement('small');note.textContent='หลังอนุญาตสิทธิ์ อาจต้องปิดแล้วเปิดโปรแกรมใหม่';box.append(note);}
async function showRecorder(){await updateChain;const displays=await api('displays');$('display').replaceChildren();displays.forEach(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=d.label;$('display').append(o);});await permissions();$('record-dialog').showModal();}
$('record').onclick=safe(showRecorder);$('start-empty').onclick=safe(showRecorder);
window.addEventListener('focus',()=>{if($('record-dialog').open)permissions().catch(()=>{});});
$('start').onclick=safe(async()=>{$('start').disabled=true;$('start').textContent='กำลังเตรียมบันทึก…';try{await api('start',{displayId:$('display').value,scroll:$('capture-scroll').checked,keys:$('capture-keys').checked,delay:Number($('delay').value)});$('record-dialog').close();}finally{$('start').disabled=false;$('start').textContent='● เริ่มบันทึก';}});
function move(delta){const a=state.project.steps,i=a.findIndex(s=>s.id===selectedId);if(i+delta<0||i+delta>=a.length)return;[a[i],a[i+delta]]=[a[i+delta],a[i]];queueUpdate();render();}
$('move-up').onclick=()=>move(-1);$('move-down').onclick=()=>move(1);
$('delete-step').onclick=()=>{$('confirm-dialog').showModal();};$('cancel-delete').onclick=()=>{$('confirm-dialog').close();};
$('confirm-delete').onclick=()=>{undoState={projectId:state.project.id,index:state.project.steps.findIndex(s=>s.id===selectedId),step:structuredClone(current())};state.project.steps=state.project.steps.filter(s=>s.id!==selectedId);$('confirm-dialog').close();queueUpdate();render();toast('ลบขั้นตอนแล้ว',false,true);};
$('undo').onclick=()=>{if(undoState && undoState.projectId===state.project.id){state.project.steps.splice(undoState.index,0,undoState.step);selectedId=undoState.step.id;undoState=null;queueUpdate();render();$('toast').hidden=true;}};
$('toast-close').onclick=()=>{$('toast').hidden=true;};
$('zoom').onclick=()=>{const copy=$('image-wrap').cloneNode(true);copy.removeAttribute('id');copy.classList.remove('marking');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));$('zoom-content').replaceChildren(copy);$('zoom-dialog').showModal();};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}});
let annotationIndex=0, annotationStep=null, drawStart=null, draft=null;
function editableAnnotations(){const s=current();if(!s.annotations)s.annotations=structuredClone(Annotations.items(s));return s.annotations;}
function selectedAnnotation(){return current()&&Annotations.items(current())[annotationIndex];}
function renderMarker(){
  const s=current();if(!s)return;
  if(annotationStep!==s){annotationStep=s;annotationIndex=0;markerMode=false;drawStart=null;draft=null;}
  const list=Annotations.items(s);annotationIndex=Math.max(0,Math.min(annotationIndex,list.length-1));
  $('marker-layer').innerHTML=Annotations.svg(draft?{...s,annotations:[...list,draft]}:s);
  $('annotation-list').replaceChildren();let number=0;
  list.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=a.type==='point'?`จุดเน้น ${++number}`:a.type==='text'?`ข้อความ: ${a.text.slice(0,30)}`:a.type==='rectangle'?'กรอบสี่เหลี่ยม':'ไฮไลท์';$('annotation-list').append(o);});
  $('annotation-list').value=String(annotationIndex);
  const a=list[annotationIndex];if(a){$('annotation-color').value=a.color;if(a.type==='text'){$('annotation-text').value=a.text;$('annotation-size').value=a.fontSize;}}
  $('marker-mode').disabled=!a;$('marker-toggle').disabled=!a;$('marker-toggle').textContent='ลบรายการที่เลือก';
  $('annotation-up').disabled=!a||annotationIndex===0;$('annotation-down').disabled=!a||annotationIndex===list.length-1;
  $('image-wrap').classList.toggle('marking',!!markerMode);$('marker-hint').hidden=!markerMode;
  $('marker-hint').textContent=['rectangle','highlight'].includes(markerMode)?'ลากบนภาพเพื่อกำหนดกรอบ · Esc ยกเลิก':'คลิกบนภาพเพื่อกำหนดตำแหน่ง · Esc ยกเลิก';
  $('marker-mode').classList.toggle('primary',markerMode==='move');
  for(const type of ['point','rectangle','highlight','text'])$('add-'+type).classList.toggle('primary',markerMode===type);
}
function redraw(){const s=current();if(s)$('marker-layer').innerHTML=Annotations.svg(draft?{...s,annotations:[...Annotations.items(s),draft]}:s);}
function imagePoint(e){const r=$('step-image').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
function commitAnnotation(a){const list=editableAnnotations();if(list.length>=500){toast('รองรับไม่เกิน 500 รายการต่อภาพ',true);return;}list.push(a);annotationIndex=list.length-1;queueUpdate();renderMarker();}
for(const type of ['point','rectangle','highlight','text'])$('add-'+type).onclick=()=>{markerMode=markerMode===type?false:type;drawStart=null;draft=null;renderMarker();};
$('marker-mode').onclick=()=>{markerMode=markerMode==='move'?false:'move';renderMarker();};
$('marker-toggle').onclick=()=>{if(!selectedAnnotation())return;editableAnnotations().splice(annotationIndex,1);markerMode=false;queueUpdate();renderMarker();};
$('annotation-list').onchange=()=>{annotationIndex=Number($('annotation-list').value);markerMode=false;renderMarker();};
$('annotation-color').oninput=()=>{if(!selectedAnnotation())return;editableAnnotations()[annotationIndex].color=$('annotation-color').value;queueUpdate();redraw();};
$('annotation-text').oninput=()=>{if(selectedAnnotation()?.type!=='text')return;editableAnnotations()[annotationIndex].text=$('annotation-text').value;queueUpdate();redraw();};
$('annotation-size').oninput=()=>{const size=Number($('annotation-size').value);if(selectedAnnotation()?.type!=='text'||size<8||size>200)return;editableAnnotations()[annotationIndex].fontSize=size;queueUpdate();redraw();};
for(const [id,delta]of [['annotation-up',-1],['annotation-down',1]])$(id).onclick=()=>{const list=editableAnnotations(),j=annotationIndex+delta;if(j<0||j>=list.length)return;[list[j],list[annotationIndex]]=[list[annotationIndex],list[j]];annotationIndex=j;queueUpdate();renderMarker();};
$('step-image').ondragstart=e=>e.preventDefault();
$('image-wrap').onpointerdown=e=>{
  if(!markerMode||e.button!==0)return;e.preventDefault();const p=imagePoint(e);
  if(['rectangle','highlight'].includes(markerMode)){drawStart=p;draft=null;$('image-wrap').setPointerCapture(e.pointerId);return;}
  if(markerMode==='move'){const a=editableAnnotations()[annotationIndex];if(!a)return;a.x=Math.min(p.x,1-(a.width||0));a.y=Math.min(p.y,1-(a.height||0));markerMode=false;queueUpdate();renderMarker();return;}
  const a={type:markerMode,...p,color:$('annotation-color').value};
  if(markerMode==='text'){a.text=$('annotation-text').value;if(!a.text.trim()){toast('พิมพ์ข้อความก่อนคลิกบนภาพ',true);return;}a.fontSize=Math.max(8,Math.min(200,Number($('annotation-size').value)||32));}
  commitAnnotation(a);
};
$('image-wrap').onpointermove=e=>{if(!drawStart)return;const p=imagePoint(e);draft={type:markerMode,x:Math.min(p.x,drawStart.x),y:Math.min(p.y,drawStart.y),width:Math.abs(p.x-drawStart.x),height:Math.abs(p.y-drawStart.y),color:$('annotation-color').value};redraw();};
$('image-wrap').onpointerup=e=>{if(!drawStart)return;const a=draft;drawStart=null;draft=null;if($('image-wrap').hasPointerCapture(e.pointerId))$('image-wrap').releasePointerCapture(e.pointerId);if(a&&a.width>.002&&a.height>.002)commitAnnotation(a);else renderMarker();};
$('image-wrap').onpointercancel=()=>{drawStart=null;draft=null;renderMarker();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){markerMode=false;drawStart=null;draft=null;renderMarker();}});
window.stepfolio.onState(next=>{state=next;render();});window.stepfolio.onNotice(n=>toast(n.message,n.error));
(async()=>{state=await api('state');render();const mod=state.platform==='darwin'?'⌘':'Ctrl';$('shortcut').textContent=mod+' ⇧ S';$('stop-key').textContent=mod+' + Shift + S';$('capture-key').textContent=mod+' + Shift + Space';$('recovery').hidden=!(await api('hasRecovery'));})().catch(e=>toast(e.message,true));
