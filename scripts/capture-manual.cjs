const { _electron: electron }=require('@playwright/test');
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const out=path.resolve('docs/manual/images');await fs.mkdir(out,{recursive:true});
 await fs.mkdir('tmp/pdfs',{recursive:true});
 const data=await fs.mkdtemp(path.join(path.resolve('tmp/pdfs'),'manual-session-'));
 const app=await electron.launch({args:['.'],env:{...process.env,STEPFOLIO_TEST:'1',STEPFOLIO_TEST_DATA:data}});
 const metadata={};
 try{
  const page=await app.firstWindow();await page.waitForSelector('#start-empty');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,1050));
  async function snap(name,selector,marks=[]){
   const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await el.screenshot({path:path.join(out,name+'.png')});
   const bounds=await el.boundingBox();const annotations=[];
   for(const [label,target] of marks){const b=await page.locator(target).boundingBox();annotations.push({label,x:b.x-bounds.x,y:b.y-bounds.y,width:b.width,height:b.height});}
   metadata[name]={width:bounds.width,height:bounds.height,annotations};
  }
  await snap('welcome','main',[['1','#start-empty']]);
  await page.locator('#start-empty').click();await page.waitForSelector('#record-dialog[open]');
  await snap('record-settings','#record-dialog',[['1','#display'],['2','.check-row'],['3','#delay'],['4','#start']]);
  await page.locator('#record-dialog .dialog-close').click();
  const p=JSON.parse(await fs.readFile('docs/manual/example.stepfolio','utf8'));
  p.title='คู่มือสร้างเอกสารสำหรับทีม';p.author='ทีมปฏิบัติการ';
  p.steps[0].title='เลือกเอกสารที่ต้องการ';p.steps[0].description='เลือกเอกสารจากรายการ เพื่อเปิดดูรายละเอียดและแก้ไขข้อมูล';
  p.steps[1].title='สร้างเอกสารใหม่สำหรับทีม';p.steps[1].description='คลิกปุ่มสีเขียว “สร้างเอกสารใหม่” ที่มุมขวาบน\nระบุชื่อเอกสารให้สื่อความหมาย แล้วตรวจสอบข้อมูลก่อนบันทึก';p.steps[1].marker={x:.84,y:.15};
  p.steps[1].annotations=[
   {type:'highlight',x:.21,y:.28,width:.22,height:.38,color:'#ffcc00'},
   {type:'rectangle',x:.74,y:.09,width:.21,height:.12,color:'#22694f'},
   {type:'point',x:.84,y:.15,color:'#f04c2e'},
   {type:'point',x:.34,y:.44,color:'#f04c2e'},
   {type:'point',x:.59,y:.44,color:'#f04c2e'},
   {type:'text',x:.24,y:.73,text:'เลือกเอกสาร แล้วสร้างรายการใหม่',fontSize:32,color:'#22694f'}
  ];
  const r=await page.evaluate(p=>window.stepfolio.call('testLoad',p),p);if(!r.ok)throw new Error(r.error);
  await page.locator('.step-card').nth(1).click();
  await snap('workspace','.workspace',[['1','.steps-panel'],['2','.description-form']]);
  await snap('editor','#step-editor',[['1','#step-title'],['2','#step-description']]);
  await snap('caption','.description-form',[['1','#step-title'],['2','#step-description'],['3','#delete-step']]);
  await snap('marker','#step-editor',[['1','#marker-mode'],['2','#marker-toggle'],['3','#zoom']]);
  await snap('annotation-tools','.annotation-tools');
  await snap('annotation-preview','.preview');
  await snap('steps','.steps-panel');
  await snap('reorder','.edit-bottom > div');
  await page.locator('#delete-step').click();await snap('delete','#confirm-dialog');await page.locator('#cancel-delete').click();
  await snap('file-actions','.header-actions',[['1','#open'],['2','#save'],['3','#export']]);
  await page.locator('#tab-project').click();
  await page.locator('#project-author').fill('ทีมปฏิบัติการ / ฝ่ายเอกสาร');
  await snap('project','#project-editor',[['1','#project-title'],['2','#project-description'],['3','#project-author']]);
  await page.evaluate(()=>updateChain);
  const pdf=await page.evaluate(file=>window.stepfolio.call('testPDF',file),path.resolve('tmp/pdfs/sample-guide.pdf'));if(!pdf.ok)throw new Error(pdf.error);
  await page.evaluate(()=>updateChain);await page.waitForTimeout(900);
  await page.reload();await page.locator('#recovery:not([hidden])').waitFor();await snap('recovery','#recovery',[['1','#recover']]);
  const preload=path.join(data,'toolbar-preload.cjs');
  await fs.writeFile(preload,`require('electron').contextBridge.exposeInMainWorld('stepfolio',{call:async()=>({value:{project:{steps:[{},{},{}]},recording:true,paused:false,pending:0}}),onState:()=>{}});`);
  const windowReady=app.waitForEvent('window',{timeout:10000});
  await app.evaluate(({BrowserWindow},{file,preload})=>{const w=new BrowserWindow({width:440,height:76,frame:false,show:false,webPreferences:{preload,sandbox:true,contextIsolation:true,nodeIntegration:false}});w.loadFile(file);},{file:path.resolve('src/recorder.html'),preload});
  const toolbar=await windowReady;
  await toolbar.waitForFunction(()=>document.getElementById('count')?.textContent==='3 ขั้นตอน',null,{timeout:10000});
  await toolbar.screenshot({path:path.join(out,'toolbar.png')});
  metadata.toolbar={width:440,height:76,annotations:[]};
  await fs.writeFile(path.join(out,'positions.json'),JSON.stringify(metadata,null,2));
  console.log('Captured '+Object.keys(metadata).length+' guide screenshots with sample data');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
