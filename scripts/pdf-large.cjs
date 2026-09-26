const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createProject } = require('../src/project');

(async () => {
  const out = path.resolve('test-results/pdf-large');
  await fs.mkdir(out, { recursive: true });
  const executablePath=process.env.STEPFOLIO_EXECUTABLE;
  const app = await electron.launch({ ...(executablePath?{executablePath,args:[]}:{args:['.']}), env: { ...process.env, STEPFOLIO_TEST: '1', STEPFOLIO_TEST_DATA: path.join(out, 'app-data') } });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('#start-empty');
    const tempRoot=await app.evaluate(({app})=>app.getPath('temp'));
    const tempFiles=async()=>(await fs.readdir(tempRoot)).filter(name=>name.startsWith('stepfolio-pdf-')).sort();
    const before=await tempFiles();
    const image = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 768;
      const context = canvas.getContext('2d');
      const pixels = context.createImageData(canvas.width, canvas.height);
      let seed = 123456789;
      for (let i = 0; i < pixels.data.length; i += 4) {
        for (let j = 0; j < 3; j++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[i + j] = seed >>> 24; }
        pixels.data[i + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
      context.fillStyle = '#173c33'; context.fillRect(0, 0, 1024, 150);
      context.fillStyle = 'white'; context.font = 'bold 32px Tahoma';
      context.fillText('ทดสอบส่งออก PDF จากภาพขนาดใหญ่', 40, 85);
      return canvas.toDataURL('image/png');
    });
    const p = createProject(); p.title = 'ทดสอบคู่มือภาพขนาดใหญ่'; p.author = 'Stepfolio regression test';
    p.steps = Array.from({ length: 6 }, (_, i) => ({ id: `large-${i}`, title: `ขั้นตอนที่ ${i + 1}`, description: 'ภาพจำลองรายละเอียดสูง เพื่อตรวจการส่งออกที่เคยเกิด ERR_INVALID_URL', event: 'คลิก', capturedAt: new Date().toISOString(), image, width: 1024, height: 768, marker: { x: .45, y: .55 } }));
    assert.ok(image.length * 6 > 10 * 1024 * 1024);
    const loaded = await page.evaluate(p => window.stepfolio.call('testLoad', p), p);
    assert.equal(loaded.ok, true);
    const result = await page.evaluate(file => window.stepfolio.call('testPDF', file), path.join(out, 'large.pdf'));
    if (!result.ok) throw new Error('Large PDF export failed: ' + result.error.slice(0, 120));
    assert.ok((await fs.stat(path.join(out, 'large.pdf'))).size > 1000000);
    // Repeat export to prove temporary files do not interfere with subsequent exports.
    const second = await page.evaluate(file => window.stepfolio.call('testPDF', file), path.join(out, 'large-second.pdf'));
    if (!second.ok) throw new Error(second.error.slice(0, 120));
    // A directory is not a valid PDF destination; cleanup must also run on failure.
    const failed=await page.evaluate(file=>window.stepfolio.call('testPDF',file),out);
    assert.equal(failed.ok,false);assert.ok(failed.error.length<250);assert.ok(!failed.error.includes('data:'));
    assert.deepEqual(await tempFiles(),before);
    const finalState=await page.evaluate(()=>window.stepfolio.call('state'));
    assert.equal(finalState.value.project.steps.length,6);
    console.log(`PASS: six large images (${(image.length * 6 / 1024 / 1024).toFixed(1)} MB), Thai captions, repeated PDF export, failure cleanup, unchanged project`);
  } finally { await app.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
