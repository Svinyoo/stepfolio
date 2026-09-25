const $=id=>document.getElementById(id);
for(const action of ['stop','pause','capture'])$(action).onclick=()=>window.stepfolio.call(action);
function render(s){$('status').textContent=s.stopping?'กำลังเก็บภาพสุดท้าย…':s.paused?'พักการบันทึก':'กำลังบันทึก';$('count').textContent=s.project.steps.length+' ขั้นตอน'+(s.pending?' · กำลังเก็บ '+s.pending+' ภาพ':'');$('pause').textContent=s.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',s.paused?'บันทึกต่อ':'พักการบันทึก');for(const id of ['stop','pause','capture'])$(id).disabled=s.stopping;$('capture').disabled=s.stopping||s.paused;}
window.stepfolio.onState(render);window.stepfolio.call('state').then(r=>render(r.value));
