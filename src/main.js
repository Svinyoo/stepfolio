const { app, BrowserWindow, ipcMain, desktopCapturer, screen, systemPreferences, dialog, globalShortcut, shell, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createProject, validateProject, pointOnDisplay, pdfHTML } = require('./project');
let win, bar, hook, project = createProject(), currentFile = null, dirty = false;
let recording = false, paused = false, starting = false, stopping = false, queue = Promise.resolve(), pending = 0, generation = 0;
let selectedDisplay, options = {}, lastScroll = 0, lastKey = 0, recoveryTimer, saveChain = Promise.resolve(), savedAt = null;
let fatalCapture = false;
const testMode = process.env.STEPFOLIO_TEST === '1';
if (testMode && process.env.STEPFOLIO_TEST_DATA) app.setPath('userData', process.env.STEPFOLIO_TEST_DATA);
let pendingOpen=process.argv.find(arg=>arg.toLowerCase().endsWith('.stepfolio'));
const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance)app.quit();
async function openRequested(file){
  if(!win || win.isDestroyed()){pendingOpen=file;return;}
  try{win.show();win.focus();if(await allowReplace())await loadProject(file);}catch(e){notice('เปิดโครงการไม่สำเร็จ: '+e.message,true);}
}
app.on('open-file',(e,file)=>{e.preventDefault();if(!app.isReady())pendingOpen=file;else openRequested(file);});
app.on('second-instance',(_,argv)=>{const file=argv.find(arg=>arg.toLowerCase().endsWith('.stepfolio'));if(file)openRequested(file);else win?.show();});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const draftPath = () => path.join(app.getPath('userData'), 'recovery.stepfolio');
function state() { return {project, currentFile, dirty, recording, paused, starting, stopping, pending, savedAt, platform:process.platform}; }
function publish() {
  const s=state();
  if(win && !win.isDestroyed() && (!recording || starting))win.webContents.send('state',s);
  if(bar && !bar.isDestroyed())bar.webContents.send('state',{...s,project:{steps:{length:project.steps.length}}});
}
function notice(message, error = false) { if (win && !win.isDestroyed()) win.webContents.send('notice', {message,error}); }
async function atomicWrite(file, text) {
  await fs.mkdir(path.dirname(file), {recursive:true});
  const temp = file + '.' + randomUUID() + '.tmp';
  try { await fs.writeFile(temp, text, {mode:0o600}); await fs.rename(temp,file); }
  catch(e) { await fs.rm(temp,{force:true}).catch(()=>{}); throw e; }
}
function persistRecovery() {
  clearTimeout(recoveryTimer);
  const snapshot = JSON.stringify(project);
  saveChain = saveChain.catch(()=>{}).then(()=>atomicWrite(draftPath(),snapshot)).catch(e=>notice('บันทึกฉบับกู้คืนไม่สำเร็จ: '+e.message,true));
  return saveChain;
}
function changed() { dirty = true; clearTimeout(recoveryTimer); recoveryTimer = setTimeout(persistRecovery,600); }
function createWindow() {
  win = new BrowserWindow({width:1280,height:850,minWidth:980,minHeight:680,backgroundColor:'#f5f6f2',title:'Stepfolio',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.once('did-finish-load',()=>{if(pendingOpen){const file=pendingOpen;pendingOpen=null;openRequested(file);}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.on('close', e=>{ if(recording || starting || stopping) {e.preventDefault();stopRecording();return;} if(dirty && !testMode){e.preventDefault();closeWithSave();} });
}
let closing = false;
async function closeWithSave() {
  if(closing) return; closing = true;
  const {response} = await dialog.showMessageBox(win,{type:'question',message:'บันทึกโครงการก่อนปิดหรือไม่?',detail:'เก็บภาพและคำบรรยายไว้แก้ไขต่อได้ในไฟล์ .stepfolio',buttons:['บันทึก','ปิดโดยไม่บันทึกไฟล์','กลับไปแก้ไข'],cancelId:2,defaultId:0});
  if(response===0 && !(await saveProject(false))) {closing=false;return;}
  if(response!==2) {await persistRecovery();dirty=false;win.close();}
  closing=false;
}
async function allowReplace() {
  if(recording || starting || stopping) throw new Error('กรุณาหยุดบันทึกก่อน');
  if(!dirty) return true;
  const {response} = await dialog.showMessageBox(win,{type:'question',message:'โครงการมีการแก้ไขที่ยังไม่ได้บันทึก',buttons:['บันทึกก่อน','ไม่บันทึก','ยกเลิก'],cancelId:2,defaultId:0});
  return response===1 || (response===0 && await saveProject(false));
}
async function saveProject(asNew) {
  let file = currentFile;
  if(!file || asNew) {const r=await dialog.showSaveDialog(win,{title:'บันทึกไฟล์โครงการ',defaultPath:(project.title.replace(/[\\/:*?"<>|]/g,'-')||'คู่มือ')+'.stepfolio',filters:[{name:'Stepfolio Project',extensions:['stepfolio']}]});if(r.canceled)return false;file=r.filePath;}
  const snapshot = JSON.stringify(project);
  await atomicWrite(file,snapshot);currentFile=file;dirty=JSON.stringify(project)!==snapshot;savedAt=new Date().toISOString();publish();return true;
}
async function loadProject(file) {
  const stat=await fs.stat(file);if(stat.size>500*1024*1024)throw new Error('ไฟล์มีขนาดเกิน 500 MB');
  const next=validateProject(JSON.parse(await fs.readFile(file,'utf8')));
  project=next;currentFile=file;dirty=false;savedAt=null;await persistRecovery();publish();
}
function getHook() { if(!hook) hook=require('uiohook-napi').uIOhook;return hook; }
function overBar(point) {if(!bar || !bar.isVisible())return false;const b=bar.getBounds();return !!pointOnDisplay(point,b);}
async function screenshot(display) {
  const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)}});
  const source=sources.find(s=>s.display_id===String(display.id));
  if(!source || source.thumbnail.isEmpty())throw new Error('ไม่สามารถจับภาพจอที่เลือกได้ กรุณาตรวจสอบสิทธิ์บันทึกหน้าจอและการเชื่อมต่อจอ');
  let image=source.thumbnail;const size=image.getSize();if(size.width>2560)image=image.resize({width:2560});
  return {image:image.toDataURL(),...image.getSize()};
}
function enqueueCapture(event, point = screen.getCursorScreenPoint(), withMarker = false) {
  if(!recording || paused || stopping) return;
  const marker=pointOnDisplay(point,selectedDisplay.bounds);
  if(event!=='เริ่มการสาธิต' && !marker)return;
  if(overBar(point) && event!=='ภาพเพิ่มเติม')return;
  if(project.steps.length + pending >= 500){notice('ครบ 500 ขั้นตอนแล้ว กรุณาเริ่มโครงการใหม่',true);stopRecording();return;}
  if(pending>=12){notice('จับภาพไม่ทันบางเหตุการณ์ กรุณาสาธิตช้าลง',true);return;}
  const token=generation, capturedAt=new Date().toISOString();pending++;publish();
  queue=queue.then(async()=>{
    if(token!==generation)return;
    try {
      await sleep(event==='เริ่มการสาธิต'?80:options.delay);
      if(bar && !bar.isDestroyed())bar.hide();
      await sleep(90);
      const image=await screenshot(selectedDisplay);
      project.steps.push({id:randomUUID(),title:event,description:'',event,capturedAt,marker:withMarker?marker:null,...image});changed();
    } catch(e) {fatalCapture=true;notice(e.message,true);}
    finally {pending--;if(recording && !stopping && bar && !bar.isDestroyed())bar.showInactive();publish();}
  });
  queue.then(()=>{if(fatalCapture){fatalCapture=false;stopRecording();}});
}
async function startRecording(data) {
  if(recording || starting || stopping)return;
  selectedDisplay=screen.getAllDisplays().find(d=>String(d.id)===String(data.displayId));if(!selectedDisplay)throw new Error('กรุณาเลือกหน้าจอ');
  if(process.platform==='darwin' && !systemPreferences.isTrustedAccessibilityClient(true))throw new Error('เปิดสิทธิ์ Accessibility ให้ Stepfolio ใน System Settings แล้วลองเริ่มอีกครั้ง');
  options={scroll:!!data.scroll,keys:!!data.keys,delay:Math.max(80,Math.min(1200,Number(data.delay)||250))};
  starting=true;publish();
  try {
    await screenshot(selectedDisplay); // Permission check before hiding the editor.
    const h=getHook();h.removeAllListeners();
    h.on('mousedown',e=>enqueueCapture(e.button===2?'คลิกขวา':'คลิก',screen.getCursorScreenPoint(),true));
    h.on('wheel',()=>{if(options.scroll && Date.now()-lastScroll>1000){lastScroll=Date.now();enqueueCapture('เลื่อนหน้าจอ');}});
    const {UiohookKey}=require('uiohook-napi');
    h.on('keydown',e=>{if(options.keys && [UiohookKey.Enter,UiohookKey.Tab,UiohookKey.Escape].includes(e.keycode) && Date.now()-lastKey>600){lastKey=Date.now();enqueueCapture(e.keycode===UiohookKey.Enter?'กด Enter':e.keycode===UiohookKey.Tab?'กด Tab':'กด Escape');}});
    h.start();
    bar=new BrowserWindow({width:440,height:76,x:Math.round(selectedDisplay.workArea.x+(selectedDisplay.workArea.width-440)/2),y:selectedDisplay.workArea.y+18,frame:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,backgroundColor:'#173c33',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    await bar.loadFile(path.join(__dirname,'recorder.html'));
    bar.on('closed',()=>{bar=null;if(recording)stopRecording();});
    win.hide(); await sleep(500);
    generation++;recording=true;starting=false;paused=false;bar.showInactive();publish();enqueueCapture('เริ่มการสาธิต', {x:selectedDisplay.bounds.x,y:selectedDisplay.bounds.y});
    const ok=globalShortcut.register('CommandOrControl+Shift+S',()=>stopRecording());
    globalShortcut.register('CommandOrControl+Shift+Space',()=>enqueueCapture('ภาพเพิ่มเติม'));
    if(!ok)notice('คีย์ลัด Stop ถูกใช้งานอยู่ กรุณาใช้ปุ่ม Stop บนแถบลอย',true);
  }catch(e){starting=false;recording=false;try{hook?.stop();}catch{};bar?.destroy();win.show();publish();throw e;}
}
async function stopRecording() {
  if(!recording || stopping)return;
  stopping=true;recording=false;try{hook?.stop();}catch{};globalShortcut.unregisterAll();publish();
  await queue;await persistRecovery();
  if(bar && !bar.isDestroyed())bar.destroy();bar=null;paused=false;stopping=false;win.show();win.focus();publish();
}
async function writePDF(file) {
  const output=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  try {
    await output.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(pdfHTML(project)));
    await output.webContents.executeJavaScript('Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode())])');
    const pdf=await output.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-family:Arial;font-size:9px;color:#819086;width:100%;padding:0 50px;display:flex;justify-content:space-between"><span>STEPFOLIO</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
    await atomicWrite(file,pdf);
  }finally{output.destroy();}
}
ipcMain.handle('stepfolio',async(e,action,data)=>{
  try {
    if(![win?.webContents.id,bar?.webContents.id].includes(e.sender.id))throw new Error('Unauthorized');
    if(e.sender.id===bar?.webContents.id && !['state','stop','pause','capture'].includes(action))throw new Error('Unauthorized');
    switch(action){
      case 'state':return {ok:true,value:state()};
      case 'displays':return {ok:true,value:screen.getAllDisplays().map((d,i)=>({id:String(d.id),label:`หน้าจอ ${i+1} · ${d.size.width} × ${d.size.height}${d.id===screen.getPrimaryDisplay().id?' (หลัก)':''}`}))};
      case 'permissions':return {ok:true,value:{screen:process.platform!=='darwin'||systemPreferences.getMediaAccessStatus('screen')==='granted',access:process.platform!=='darwin'||systemPreferences.isTrustedAccessibilityClient(false)}};
      case 'settings':if(process.platform==='darwin')await shell.openExternal(data==='screen'?'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture':'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');break;
      case 'update':if(recording || starting || stopping)throw new Error('กรุณาหยุดบันทึกก่อนแก้ไข');project=validateProject(data);changed();break;
      case 'new':if(await allowReplace()){project=createProject();currentFile=null;changed();await persistRecovery();publish();}break;
      case 'open':if(await allowReplace()){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Stepfolio Project',extensions:['stepfolio']}]});if(!r.canceled)await loadProject(r.filePaths[0]);}break;
      case 'recover':if(await allowReplace()){await loadProject(draftPath());currentFile=null;dirty=true;publish();}break;
      case 'hasRecovery':return {ok:true,value:await fs.stat(draftPath()).then(()=>true).catch(()=>false)};
      case 'save':return {ok:true,value:await saveProject(!!data)};
      case 'start':await startRecording(data);break;
      case 'stop':await stopRecording();break;
      case 'pause':paused=!paused;publish();break;
      case 'capture':enqueueCapture('ภาพเพิ่มเติม');break;
      case 'export':{
        if(!project.steps.length)throw new Error('เพิ่มอย่างน้อย 1 ขั้นตอนก่อนส่งออก PDF');
        const r=await dialog.showSaveDialog(win,{title:'ส่งออกคู่มือ PDF',defaultPath:(project.title.replace(/[\\/:*?"<>|]/g,'-')||'คู่มือ')+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
        if(!r.canceled){await writePDF(r.filePath);shell.showItemInFolder(r.filePath);return {ok:true,value:r.filePath};}break;
      }
      case 'testHook':if(!testMode)throw new Error('Unavailable');return {ok:true,value:!!require('uiohook-napi').uIOhook && !!require('uiohook-napi').UiohookKey.Enter};
      case 'testLoad':if(!testMode)throw new Error('Unavailable');project=validateProject(data);publish();break;
      case 'testPDF':if(!testMode)throw new Error('Unavailable');await writePDF(data);break;
      default:throw new Error('ไม่รู้จักคำสั่ง');
    }
    return {ok:true};
  }catch(e){return {ok:false,error:e.message};}
});
app.whenReady().then(()=>{
  if(!singleInstance)return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Stepfolio',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'แก้ไข',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]));
  createWindow();
  app.on('activate',()=>{if(win && !win.isDestroyed())win.show();else createWindow();});
});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{clearTimeout(recoveryTimer);globalShortcut.unregisterAll();try{hook?.stop();}catch{}});
