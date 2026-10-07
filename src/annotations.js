(function(root){
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function items(step){return step.annotations ?? (step.marker ? [{type:'point',x:step.marker.x,y:step.marker.y,color:'#f04c2e'}] : []);}
  function validate(list){
    if(!Array.isArray(list)||list.length>500)throw new Error('รองรับเครื่องหมายไม่เกิน 500 รายการต่อภาพ');
    for(const a of list){
      if(!a||!['point','rectangle','highlight','text'].includes(a.type)||!/^#[0-9a-f]{6}$/i.test(a.color)||!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.x>1||a.y<0||a.y>1)throw new Error('เครื่องหมายบนภาพไม่ถูกต้อง');
      if(['rectangle','highlight'].includes(a.type)&&(!Number.isFinite(a.width)||!Number.isFinite(a.height)||a.width<=0||a.height<=0||a.x+a.width>1.000001||a.y+a.height>1.000001))throw new Error('ขนาดกรอบไม่ถูกต้อง');
      if(a.type==='text'&&(typeof a.text!=='string'||a.text.length>2000||!Number.isFinite(a.fontSize)||a.fontSize<8||a.fontSize>200))throw new Error('ข้อความบนภาพไม่ถูกต้อง');
    }
  }
  function svg(step){
    const w=step.width,h=step.height,r=Math.max(12,Math.min(w,h)*.025);let number=0;
    const shapes=items(step).map(a=>{const x=a.x*w,y=a.y*h,c=a.color;
      if(a.type==='point'){number++;const bx=Math.max(r,Math.min(w-r,x)),by=Math.max(r,Math.min(h-r,y));return `<g data-point="${number}"><circle cx="${bx}" cy="${by}" r="${r}" fill="${c}" stroke="white" stroke-width="${r*.15}"/><text x="${bx}" y="${by}" dy=".35em" font-family="Arial" font-size="${r}" font-weight="bold" text-anchor="middle" fill="white">${number}</text></g>`;}
      if(a.type==='text')return `<text x="${x}" y="${y}" font-family="Tahoma, sans-serif" font-size="${a.fontSize}" fill="${c}">${a.text.split('\n').map((line,i)=>`<tspan x="${x}" dy="${i?1.25:1}em">${escape(line)}</tspan>`).join('')}</text>`;
      return `<rect x="${x}" y="${y}" width="${a.width*w}" height="${a.height*h}" fill="${a.type==='highlight'?c:'none'}" fill-opacity=".3" stroke="${c}" stroke-width="${a.type==='highlight'?1:Math.max(2,w*.003)}"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" class="marker" viewBox="0 0 ${w} ${h}" aria-hidden="true">${shapes}</svg>`;
  }
  const api={items,validate,svg};if(typeof module!=='undefined')module.exports=api;else root.Annotations=api;
})(typeof globalThis!=='undefined'?globalThis:this);
