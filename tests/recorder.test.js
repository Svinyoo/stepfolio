const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');

// Exercise the actual recorder lifecycle with deterministic OS adapters.
// This does not replace an on-device test of screen/privacy permissions.
async function harness(){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stepfolio-recorder-'));
  const hook=new EventEmitter();hook.start=()=>{};hook.stop=()=>{};
  const notices=[];let cursor={x:500,y:500},captureFails=false;
  class Window extends EventEmitter{
    constructor(){super();this.visible=false;this.dead=false;this.webContents={id:1,send:(kind,data)=>{if(kind==='notice')notices.push(data);}};}
    isDestroyed(){return this.dead;}isVisible(){return this.visible;}show(){this.visible=true;}showInactive(){this.visible=true;}hide(){this.visible=false;}focus(){}destroy(){this.dead=true;this.emit('closed');}
    getBounds(){return {x:740,y:18,width:440,height:76};}async loadFile(){}
  }
  const display={id:1,size:{width:1920,height:1080},scaleFactor:2,bounds:{x:0,y:0,width:1920,height:1080},workArea:{x:0,y:0,width:1920,height:1080}};
  const app={getPath:()=>dir,setPath(){},requestSingleInstanceLock:()=>true,on(){},whenReady:()=>({then(){}}),quit(){}};
  const image={isEmpty:()=>false,getSize:()=>({width:1920,height:1080}),toDataURL:()=> 'data:image/png;base64,AA=='};
  const electron={app,BrowserWindow:Window,ipcMain:{handle(){}},screen:{getAllDisplays:()=>[display],getCursorScreenPoint:()=>cursor},systemPreferences:{isTrustedAccessibilityClient:()=>true},globalShortcut:{register:()=>true,unregisterAll(){}},desktopCapturer:{getSources:async()=>{if(captureFails)throw new Error('Capture unavailable');return [{display_id:'1',thumbnail:image}];}}};
  const source=await fs.readFile(path.resolve('src/main.js'),'utf8');
  const sandbox={require:name=>name==='electron'?electron:name==='uiohook-napi'?{uIOhook:hook,UiohookKey:{Enter:28,Tab:15,Escape:1}}:name==='./project'?require('../src/project'):require(name),process:{env:{},platform:'darwin',argv:[]},module:{exports:{}},__dirname:path.resolve('src'),console,setTimeout,clearTimeout};
  vm.runInNewContext(source+'\nwin=new BrowserWindow();module.exports={startRecording,stopRecording,enqueueCapture,state,pause:()=>{paused=!paused;},cleanup:()=>{clearTimeout(recoveryTimer);return saveChain;}};',sandbox);
  return {...sandbox.module.exports,hook,notices,setCursor:p=>{cursor=p;},fail:()=>{captureFails=true;},dispose:async()=>{await sandbox.module.exports.cleanup();await fs.rm(dir,{recursive:true,force:true});}};
}
test('recording drains pending frames on Stop and ignores off-display/paused input',async()=>{
  const h=await harness();try{
    await h.startRecording({displayId:'1',scroll:true,keys:true,delay:80});
    h.hook.emit('mousedown',{button:1});
    h.setCursor({x:3000,y:500});h.hook.emit('mousedown',{button:1});
    h.setCursor({x:960,y:540});h.hook.emit('keydown',{keycode:28});
    h.pause();h.hook.emit('mousedown',{button:1});h.pause();
    await h.stopRecording();
    const s=h.state();assert.equal(s.recording,false);assert.equal(s.stopping,false);assert.equal(s.pending,0);assert.equal(s.project.steps.length,3);
    assert.equal(s.project.steps[0].event,'เริ่มการสาธิต');assert.equal(s.project.steps[1].event,'คลิก');assert.equal(s.project.steps[2].event,'กด Enter');
    assert.equal(s.project.steps[1].marker.x,500/1920);assert.equal(s.project.steps[1].marker.y,500/1080);assert.equal(s.project.steps[2].marker,null);
    h.hook.emit('mousedown',{button:1});assert.equal(h.state().project.steps.length,3);
  }finally{await h.dispose();}
});
test('capture error stops safely and reports the failure',async()=>{
  const h=await harness();try{
    await h.startRecording({displayId:'1',delay:80});h.fail();await h.stopRecording();
    assert.equal(h.state().pending,0);assert.equal(h.state().project.steps.length,0);assert.equal(h.notices[0].error,true);assert.match(h.notices[0].message,/Capture unavailable/);
  }finally{await h.dispose();}
});
