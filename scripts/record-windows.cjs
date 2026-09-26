const { _electron: electron }=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  assert.equal(process.platform,'win32','Run the native recording check on Windows');
  const out=path.resolve('test-results/windows-recording');await fs.mkdir(out,{recursive:true});
  const executablePath=process.env.STEPFOLIO_EXECUTABLE;
  const app=await electron.launch({...(executablePath?{executablePath,args:[]}:{args:['.']}),env:{...process.env,STEPFOLIO_TEST:'1',STEPFOLIO_TEST_DATA:path.join(out,'app-data')}});
  try{
    const page=await app.firstWindow();await page.waitForSelector('#start-empty');
    const call=async(action,data)=>{const r=await page.evaluate(({action,data})=>window.stepfolio.call(action,data),{action,data});assert.equal(r.ok,true,r.error);return r.value;};
    const displayId=await app.evaluate(({screen})=>String(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id));
    await call('start',{displayId,scroll:true,keys:true,delay:250});
    await call('testNativeEnter');
    let s=await call('state');assert.equal(s.recording,true);assert.ok(s.project.steps.some(step=>step.event==='กด Enter'),'Native Enter must produce a screenshot');
    await call('pause');const before=s.project.steps.length;
    await call('testNativeEnter');s=await call('state');assert.equal(s.project.steps.length,before,'Pause must ignore native input');
    await call('pause');await call('testNativeEnter');await call('stop');
    s=await call('state');assert.equal(s.recording,false);assert.equal(s.pending,0);assert.ok(s.project.steps.length>before);
    for(const step of s.project.steps){assert.ok(step.width>0 && step.height>0);assert.ok(step.image.startsWith('data:image/png;base64,'));}
    await call('testPDF',path.join(out,'recorded.pdf'));
    assert.ok((await fs.stat(path.join(out,'recorded.pdf'))).size>10000);
    console.log('PASS: Windows desktop capture, native Enter event, Pause/Resume, Stop, recorded screenshots to PDF');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
