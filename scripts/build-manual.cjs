const {_electron:electron}=require('@playwright/test');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 await fs.mkdir('tmp/pdfs',{recursive:true});await fs.mkdir('output/pdf',{recursive:true});
 const css=await fs.readFile('docs/manual/manual.css','utf8');const content=require('../docs/manual/content.cjs')();
 const html=path.resolve('tmp/pdfs/manual.html');await fs.writeFile(html,`<!doctype html><html lang="th"><meta charset="utf-8"><title>คู่มือใช้งาน Stepfolio 1.0.1</title><style>${css}</style>${content}</html>`);
 const data=await fs.mkdtemp(path.join(path.resolve('tmp/pdfs'),'print-session-'));
 const app=await electron.launch({args:['.'],env:{...process.env,STEPFOLIO_TEST:'1',STEPFOLIO_TEST_DATA:data}});
 try{
  const result=await app.evaluate(async({BrowserWindow},html)=>{
   const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
   try{await w.loadFile(html);await w.webContents.executeJavaScript('Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode())])');
    const overflow=await w.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.page')).map((p,i)=>({page:i+1,overflow:p.scrollHeight>p.clientHeight+2,contentBottom:Math.max(...Array.from(p.children).filter(e=>!e.classList.contains('footer')).map(e=>e.getBoundingClientRect().bottom-p.getBoundingClientRect().top)),limit:p.clientHeight-45})).filter(p=>p.overflow||p.contentBottom>p.limit)`);
    if(overflow.length)throw new Error('Page overflow: '+JSON.stringify(overflow));
    const pdf=await w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,generateTaggedPDF:true});return pdf.toString('base64');
   }finally{w.destroy();}
  },html);
  await fs.writeFile('output/pdf/Stepfolio-User-Guide-TH-1.0.1.pdf',Buffer.from(result,'base64'));console.log('Created 12-page Thai user guide');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
