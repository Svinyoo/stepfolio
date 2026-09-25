const { test }=require('node:test');
const assert=require('node:assert/strict');
const {createProject,validateProject,pointOnDisplay,markerSVG,pdfHTML}=require('../src/project');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function fixture(){const p=createProject();p.title='คู่มือทดสอบภาษาไทย';p.steps.push({id:'one',title:'คลิกเพื่อเริ่ม',description:'เลือกเมนู แล้วกด Enter',event:'คลิก',capturedAt:new Date().toISOString(),image,width:1920,height:1080,marker:{x:.4,y:.3}});return p;}
test('project round-trip retains raw image, Thai text and normalized marker',()=>{const p=fixture();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);});
test('coordinates on monitors with negative origins and mixed DPI use display bounds',()=>{assert.deepEqual(pointOnDisplay({x:-960,y:540},{x:-1920,y:0,width:1920,height:1080}),{x:.5,y:.5});assert.equal(pointOnDisplay({x:1920,y:10},{x:0,y:0,width:1920,height:1080}),null);});
test('reject unsupported versions, executable image sources and malformed markers',()=>{const p=fixture();p.version=999;assert.throws(()=>validateProject(p));p.version=1;p.steps[0].image='https://tracker.example/image.png';assert.throws(()=>validateProject(p));p.steps[0].image=image;p.steps[0].marker.x=NaN;assert.throws(()=>validateProject(p));});
test('duplicate step IDs are rejected',()=>{const p=fixture();p.steps.push({...p.steps[0]});assert.throws(()=>validateProject(p));});
test('PDF escapes user text and embeds screenshots without external requests',()=>{const p=fixture();p.title='<script>alert(1)</script>';p.steps[0].description='คำอธิบาย <img src=x onerror=alert(1)>';const html=pdfHTML(p);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes(p.steps[0].image));assert.ok(html.includes('ขั้นตอนที่ 1 / 1'));});
test('marker has contrasting ring and arrow and supports all corners',()=>{for(const x of [0,.5,1])for(const y of [0,.5,1])assert.match(markerSVG({x,y},1920,1080,1),/<path/);assert.equal(markerSVG(null,100,100),'');});
