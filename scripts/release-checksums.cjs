const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const platform=process.argv[2];
if(!/^[a-z0-9-]+$/.test(platform||''))throw Error('Expected platform name');
const files=fs.readdirSync('release').filter(f=>/\.(exe|zip|dmg)$/.test(f)).sort();
if(!files.length)throw Error('No installers found');
fs.writeFileSync(path.join('release',`SHA256SUMS-${platform}.txt`),files.map(f=>`${createHash('sha256').update(fs.readFileSync(path.join('release',f))).digest('hex')}  ${f}`).join('\n')+'\n');
