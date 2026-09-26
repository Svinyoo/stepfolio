const { _electron: electron }=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createProject}=require('../src/project');
(async()=>{
  const out=path.resolve('test-results');await fs.mkdir(out,{recursive:true});
  const executablePath=process.env.STEPFOLIO_EXECUTABLE;
  const app=await electron.launch({...(executablePath?{executablePath,args:[]}:{args:['.']}),env:{...process.env,STEPFOLIO_TEST:'1',STEPFOLIO_TEST_DATA:path.join(out,'app-data')}});
  const errors=[];
  try{
    const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#start-empty');
    await page.screenshot({path:path.join(out,'empty.png')});
    const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1440;c.height=900;const x=c.getContext('2d');x.fillStyle='#f1f4ef';x.fillRect(0,0,1440,900);x.fillStyle='#173c33';x.fillRect(0,0,240,900);x.fillStyle='#fff';x.font='bold 30px Arial';x.fillText('WORKSPACE',30,68);x.font='22px Arial';x.fillText('Documents',30,160);x.fillText('Templates',30,218);x.fillText('Settings',30,276);x.fillStyle='#274c3d';x.font='bold 42px Tahoma';x.fillText('เอกสารของทีม',310,130);x.fillStyle='#8b9989';x.font='24px Tahoma';x.fillText('เลือกเอกสาร หรือสร้างเอกสารใหม่',310,180);x.fillStyle='#267052';x.beginPath();x.roundRect(1080,100,270,70,12);x.fill();x.fillStyle='#fff';x.font='24px Tahoma';x.fillText('+ สร้างเอกสารใหม่',1105,145);for(let i=0;i<3;i++){x.fillStyle='#fff';x.beginPath();x.roundRect(310+i*350,270,310,340,12);x.fill();x.fillStyle='#e7edde';x.fillRect(336+i*350,300,258,165);x.fillStyle='#375442';x.font='24px Tahoma';x.fillText(['คู่มือเริ่มต้น','ขั้นตอนอนุมัติ','ข้อมูลสมาชิก'][i],338+i*350,518);}return c.toDataURL();});
    const p=createProject();p.title='คู่มือสร้างเอกสารสำหรับทีม';p.description='เรียนรู้วิธีสร้างเอกสารใหม่และส่งให้ทีมตรวจสอบ\nตัวอย่างสำหรับทดสอบภาษาไทยและตำแหน่งคลิก';p.author='ทีมปฏิบัติการ';
    p.steps=[{id:'step-one',title:'คลิกสร้างเอกสารใหม่',description:'ไปที่มุมขวาบนของหน้าจอ แล้วคลิกปุ่ม “สร้างเอกสารใหม่” เพื่อเริ่มต้น\nตรวจสอบว่าคุณอยู่ในพื้นที่ทำงานของทีมที่ต้องการ',event:'คลิก',capturedAt:new Date().toISOString(),image,width:1440,height:900,marker:{x:.84,y:.15}},{id:'step-two',title:'เลือกเอกสารที่ต้องการ',description:'เลือกเอกสารจากรายการ เพื่อเปิดดูรายละเอียดและแก้ไขข้อมูล',event:'คลิก',capturedAt:new Date().toISOString(),image,width:1440,height:900,marker:{x:.34,y:.44}}];
    const loaded=await page.evaluate(p=>window.stepfolio.call('testLoad',p),p);assert.equal(loaded.ok,true);
    await page.waitForSelector('#step-editor:not([hidden])');await page.locator('#step-title').fill('สร้างเอกสารใหม่สำหรับทีม');await page.locator('#step-description').fill('คลิกปุ่มสีเขียวที่มุมขวาบน แล้วระบุชื่อเอกสาร\nสามารถกลับมาแก้ไขรายละเอียดได้ภายหลัง');
    await page.locator('#marker-mode').click();await page.locator('#step-image').click({position:{x:150,y:100}});await page.locator('#move-down').click();
    await page.locator('#delete-step').click();await page.locator('#confirm-delete').click();assert.equal(await page.locator('.step-card').count(),1);await page.locator('#undo').click();assert.equal(await page.locator('.step-card').count(),2);
    await page.screenshot({path:path.join(out,'editor.png')});
    await page.evaluate(()=>updateChain);
    const now=await page.evaluate(()=>window.stepfolio.call('state'));assert.equal(now.value.project.steps.length,2);assert.equal(now.value.project.steps[1].title,'สร้างเอกสารใหม่สำหรับทีม');assert.ok(now.value.project.steps[1].marker.x>0&&now.value.project.steps[1].marker.x<1);
    await fs.writeFile(path.join(out,'example.stepfolio'),JSON.stringify(now.value.project,null,2));
    const pdf=await page.evaluate(file=>window.stepfolio.call('testPDF',file),path.join(out,'example.pdf'));assert.equal(pdf.ok,true,JSON.stringify(pdf));
    await page.locator('#tab-project').click();await page.locator('#project-title').fill('คู่มือทดสอบการบันทึกภาษาไทย');await page.evaluate(()=>updateChain);
    await page.screenshot({path:path.join(out,'project.png')});
    await page.waitForTimeout(1200);const recovered=JSON.parse(await fs.readFile(path.join(out,'app-data','recovery.stepfolio'),'utf8'));assert.equal(recovered.title,'คู่มือทดสอบการบันทึกภาษาไทย');
    const native=await page.evaluate(()=>window.stepfolio.call('testHook'));assert.equal(native.value,true);
    const file=path.join(out,'saved-and-reopened.stepfolio');
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
    const save=await page.evaluate(()=>window.stepfolio.call('save',true));assert.equal(save.value,true);
    const opened=await page.evaluate(()=>window.stepfolio.call('open'));assert.equal(opened.ok,true);
    const reopened=await page.evaluate(()=>window.stepfolio.call('state'));assert.equal(reopened.value.project.title,recovered.title);assert.equal(reopened.value.currentFile,file);assert.equal(reopened.value.dirty,false);
    const permission=await page.evaluate(()=>window.stepfolio.call('permissions'));console.log('Recording permission status:',JSON.stringify(permission.value));
    assert.deepEqual(errors,[]);console.log('PASS: editor, Thai text, move marker, reorder, delete/undo, recovery, save/open file, native hook module, PDF export');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
