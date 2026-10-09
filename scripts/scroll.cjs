const {_electron:electron}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createProject}=require('../src/project');
(async()=>{
 const out=path.resolve('test-results');await fs.mkdir(out,{recursive:true});
 const data=await fs.mkdtemp(path.join(out,'scroll-'));
 const executablePath=process.env.STEPFOLIO_EXECUTABLE;
 const app=await electron.launch({...(executablePath?{executablePath,args:[]}:{args:['.']}),env:{...process.env,STEPFOLIO_TEST:'1',STEPFOLIO_TEST_DATA:data}});
 try{
  const page=await app.firstWindow();await page.waitForSelector('#start-empty');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=500;return c.toDataURL();});
  const p=createProject();p.steps=Array.from({length:70},(_,i)=>({id:`step-${i}`,title:`ภาพที่ ${i+1}`,description:'',event:'คลิก',capturedAt:p.createdAt,image,width:800,height:500,marker:{x:.5,y:.5}}));
  assert.equal((await page.evaluate(p=>window.stepfolio.call('testLoad',p),p)).ok,true);
  const list=page.locator('#step-list');await list.scrollIntoViewIfNeeded();await list.hover();await page.mouse.wheel(0,3000);
  await page.waitForFunction(()=>document.getElementById('step-list').scrollTop>2000);
  // Wait for wheel scrolling to finish before taking the user's position.
  await page.evaluate(()=>new Promise(resolve=>{const el=document.getElementById('step-list');let last=el.scrollTop,stable=0;function tick(){const next=el.scrollTop;stable=next===last?stable+1:0;last=next;if(stable>=5)resolve();else requestAnimationFrame(tick);}tick();}));
  const top=()=>list.evaluate(el=>el.scrollTop);
  const expectPosition=async(expected,label)=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.ok(Math.abs(await top()-expected)<=1,`${label}: expected ${expected}, got ${await top()}`);};
  const visible=await list.evaluate(el=>{const r=el.getBoundingClientRect();return [...el.children].map((b,i)=>({i,r:b.getBoundingClientRect()})).filter(b=>b.r.top>r.top+20&&b.r.bottom<r.bottom-20).slice(0,2).map(b=>b.i);});
  assert.equal(visible.length,2);assert.ok(visible[0]>20);
  const before=await top();
  for(const i of [visible[0],visible[1],visible[0]]){await page.locator('.step-card').nth(i).click();await expectPosition(before,'select lower image');}
  await page.locator('#step-title').fill('แก้ไขภาพท้ายรายการ');await expectPosition(before,'edit title');
  await page.locator('#step-description').fill('คำอธิบายเพิ่มเติม');await expectPosition(before,'edit description');
  await page.locator('#move-up').click();await expectPosition(before,'reorder');
  await page.locator('#delete-step').click();await page.locator('#confirm-delete').click();await expectPosition(before,'delete');
  await page.locator('#undo').click();await expectPosition(before,'undo');
  await page.locator('#tab-project').click();await expectPosition(before,'project tab');
  await page.locator('#tab-step').click();await expectPosition(before,'step tab');
  await list.scrollIntoViewIfNeeded();await list.hover();await page.mouse.wheel(0,-600);
  await page.waitForFunction(before=>document.getElementById('step-list').scrollTop<before-100,before);
  await page.evaluate(()=>updateChain);
  const next={...p,id:'another-project'};assert.equal((await page.evaluate(p=>window.stepfolio.call('testLoad',p),next)).ok,true);
  await expectPosition(0,'different project starts at top');assert.deepEqual(errors,[]);
  console.log('PASS: 70 images retain user scroll through selection, editing, reorder, delete/undo and tabs; manual scrolling and project reset work');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
