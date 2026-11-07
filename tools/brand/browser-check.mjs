import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const evidence=path.resolve(root,process.env.TRACEMIGO_BROWSER_EVIDENCE??'planning/evidence/P03.01');
await mkdir(evidence,{recursive:true});
const profile=await mkdtemp('/tmp/tracemigo-brand-chrome-');
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-sync',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeError='';chrome.stderr.on('data',chunk=>{chromeError+=chunk;});
let web;let ws;let preview;
const output={cases:[],errors:[],externalRequests:[]};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  let port;
  for(let i=0;i<450;i++) {
    try {port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{if(chrome.exitCode!==null)throw new Error('Chrome failed: '+chromeError);await sleep(100);}
  }
  assert.ok(port,'No Chrome debugging port');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},20000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.id){const item=pending.get(data.id);if(!item)return;clearTimeout(item.timer);pending.delete(data.id);data.error?item.reject(new Error(data.error.message)):item.resolve(data.result);}
    if(data.method==='Runtime.exceptionThrown')output.errors.push(data.params.exceptionDetails.text);
    if(data.method==='Network.requestWillBeSent'){
      const url=data.params.request.url;
      if(/^https?:/.test(url)&&!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))output.externalRequests.push(url);
    }
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  preview=createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const allowed=['/docs/design/preview.html','/packages/ui/src/tokens.css'];
      if(!allowed.includes(pathname)&&!pathname.startsWith('/apps/web/public/brand/')){res.writeHead(404);res.end();return;}
      const file=path.resolve(root,'.'+pathname);
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain'}[path.extname(file)]??'application/octet-stream';
      res.writeHead(200,{'content-type':type});res.end(await readFile(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>preview.listen(0,'127.0.0.1',resolve));const previewPort=preview.address().port;
  web=spawn(process.execPath,[path.join(root,'apps/web/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'],{cwd:path.join(root,'apps/web'),env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  let logs='';const webPort=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Web start timed out: '+logs)),60000);
    function collect(chunk){logs+=chunk;const match=logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match&&/Ready in/.test(logs)){clearTimeout(timeout);resolve(Number(match[1]));}}
    web.stdout.on('data',collect);web.stderr.on('data',collect);web.once('error',error=>{clearTimeout(timeout);reject(error);});web.once('exit',()=>{clearTimeout(timeout);reject(new Error('Web exited before readiness: '+logs));});
  });
  async function visit(url,width,height,scheme,name) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme}]});
    await send('Page.navigate',{url});
    for(let i=0;i<100;i++) {
      if(await evaluate(`document.readyState==='complete' && location.href===${JSON.stringify(url)}`))break;
      await sleep(50);
    }
    if(url.includes('/warmup/'))for(let i=0;i<200;i++){if(await evaluate(`document.querySelector('.save-note') && !document.querySelector('.save-note').textContent.includes('Opening')`))break;await sleep(50);}
    await evaluate(`(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));return true})()`);
    const metrics=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,images:Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),font:getComputedStyle(document.body).fontFamily,loadedFonts:Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family),background:getComputedStyle(document.body).backgroundColor,rootBackground:getComputedStyle(document.documentElement).backgroundColor,logo:document.querySelector('.brand-lockup img')?.currentSrc})`);
    assert.ok(metrics.scroll<=width,`${name} horizontal overflow: ${metrics.scroll} > ${width}`);assert.equal(metrics.images,true,`${name} broken image`);assert.ok(metrics.loadedFonts.length>0,`${name} font did not load`);
    const layout=await send('Page.getLayoutMetrics');
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:layout.cssContentSize.width,height:Math.max(height,layout.cssContentSize.height),scale:1}});
    await writeFile(path.join(evidence,name+'.png'),Buffer.from(screenshot.data,'base64'));
    output.cases.push({name,width,height,scheme,...metrics,screenshot:name+'.png'});
    return metrics;
  }
  for(const [width,height] of [[1280,800],[375,812],[320,720]])for(const scheme of ['light','dark']){
    const metrics=await visit(`http://127.0.0.1:${webPort}/`,width,height,scheme,`app-${width}-${scheme}`);
    assert.ok(metrics.logo.endsWith(scheme==='dark'?'lockup-reverse.svg':'lockup-primary.svg'));
    assert.equal(metrics.rootBackground,scheme==='dark'?'rgb(20, 45, 52)':'rgb(246, 248, 245)');
  }
  if(process.env.TRACEMIGO_CHECK_WARMUP==='1') {
    const url=`http://127.0.0.1:${webPort}/warmup/python/running-total`;
    const waitFor=async expression=>{for(let i=0;i<200;i++){if(await evaluate(`!!(${expression})`))return;await sleep(50);}throw new Error('Warmup condition timed out: '+expression+'; '+JSON.stringify(await evaluate(`({heading:document.querySelector('#step-heading')?.textContent,active:document.activeElement.outerHTML,body:document.querySelector('.question-panel')?.textContent})`)));};
    const click=async text=>{await evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Button unavailable');b.click()})()`);await sleep(100);};
    await visit(url,1280,900,'light','warmup-desktop');
    await waitFor(`document.querySelector('input[value="8"]')`);
    assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`),true);
    // Commit with the keyboard after selecting an intentionally incorrect prediction.
    await evaluate(`document.querySelector('input[value="8"]').click()`);
    await waitFor(`document.querySelector('button[type=submit]').disabled===false`);
    await evaluate(`document.querySelector('button[type=submit]').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await waitFor(`document.querySelector('.prediction-note')?.textContent.includes('8')`);
    assert.equal(await evaluate(`document.activeElement.id`),'step-heading');
    await click('Next');assert.equal(await evaluate(`document.querySelector('td strong').textContent`),'3');
    await click('Next');assert.equal(await evaluate(`document.querySelector('td strong').textContent`),'3');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Review the result')).disabled`),true);
    await click('Next');assert.equal(await evaluate(`document.querySelector('td strong').textContent`),'7');
    await click('Review the result');await waitFor(`document.querySelector('#explanation')`);
    assert.ok(await evaluate(`document.querySelector('.result-box').textContent.includes('You predicted 8')`));
    await evaluate(`(()=>{const t=document.querySelector('#explanation');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'One is not strictly greater than one.');t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await waitFor(`JSON.parse(sessionStorage.getItem('tracemigo:warmup:running-total:v1')).explanation.includes('strictly')`);
    await visit(url,375,812,'light','warmup-review-mobile');
    await waitFor(`document.querySelector('#explanation')?.value.includes('strictly')`);
    await evaluate(`document.querySelector('summary').click()`);
    assert.equal(await evaluate(`document.querySelector('details').open`),true);
    await visit(url,320,720,'dark','warmup-review-dark');
    await waitFor(`document.querySelector('#explanation')`);await click('Clear progress');
    await waitFor(`document.querySelector('button[type=submit]')?.disabled===true`);
    await visit(url,375,812,'light','warmup-reset');
    await waitFor(`document.querySelector('input')`);
    assert.equal(await evaluate(`document.querySelector('input:checked')`),null);
    await evaluate(`sessionStorage.setItem('tracemigo:warmup:running-total:v1','{broken')`);
    await visit(url,375,812,'light','warmup-invalid-data');
    await waitFor(`document.querySelector('button[type=submit]')?.disabled===true`);
    const injection=await send('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Unavailable','SecurityError')}})`});
    await visit(url,320,720,'dark','warmup-storage-denied');
    await waitFor(`document.querySelector('.save-note').textContent.includes('unavailable')`);
    await evaluate(`document.querySelector('input[value="7"]').click()`);await click('Commit prediction');
    for(let i=0;i<3;i++)await click('Next');await click('Review the result');
    await waitFor(`document.querySelector('.result-box')?.textContent.includes('matches')`);
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});
    if(process.env.TRACEMIGO_CHECK_LIBRARY==='1') {
      const catalog=`http://127.0.0.1:${webPort}/catalog`;
      const second=`http://127.0.0.1:${webPort}/warmup/python/list-references`;
      await visit(catalog,1280,900,'light','library-desktop');
      assert.equal(await evaluate(`document.querySelectorAll('[data-exercise]').length`),2);
      await evaluate(`sessionStorage.setItem('tracemigo:warmup:running-total:v1',JSON.stringify({stage:2,trace:3,prediction:'8',explanation:'Independent first note'}))`);
      await visit(catalog,375,812,'light','library-resume');
      await waitFor(`document.querySelector('[data-exercise="running-total"]').textContent.includes('Continue warmup')`);
      assert.ok(await evaluate(`document.querySelector('[data-exercise="list-references"]').textContent.includes('Begin warmup')`));
      await evaluate(`document.querySelector('[data-exercise="list-references"]').click()`);
      await waitFor(`location.pathname.endsWith('list-references') && document.querySelector('input[value="[9]"]')`);
      await visit(second,320,720,'dark','references-predict');
      await evaluate(`document.querySelector('input[value="[9]"]').click()`);
      await waitFor(`!document.querySelector('button[type=submit]').disabled`);
      await click('Commit prediction');
      for(const expected of ['[1, 2]','[1, 2, 3]','[1, 2, 3]']){await click('Next');assert.equal(await evaluate(`document.querySelector('td strong').textContent`),expected);}
      await click('Review the result');await waitFor(`document.querySelector('.output-value')?.textContent==='[1, 2, 3]'`);
      assert.ok(await evaluate(`document.querySelector('.result-box').textContent.includes('You predicted [9]')`));
      await visit(second,375,812,'light','references-review');
      await waitFor(`document.querySelector('#explanation')`);
      await click('Clear progress');
      await waitFor(`document.querySelector('button[type=submit]')?.disabled===true`);
      assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('tracemigo:warmup:running-total:v1')).explanation`),'Independent first note');
      await visit(catalog,320,720,'dark','library-dark');
      await waitFor(`document.querySelector('[data-exercise="running-total"]').textContent.includes('Continue warmup')`);
      assert.ok(await evaluate(`document.querySelector('[data-exercise="list-references"]').textContent.includes('Begin warmup')`));
      await evaluate(`document.querySelector('[data-exercise="running-total"]').click()`);
      await waitFor(`document.querySelector('#explanation')?.value==='Independent first note'`);
      const deniedLibrary=await send('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Unavailable','SecurityError')}})`});
      await visit(catalog,375,812,'light','library-storage-denied');
      await waitFor(`document.querySelector('.library-storage').textContent.includes('unavailable')`);
      assert.equal(await evaluate(`document.querySelectorAll('[data-exercise]').length`),2);
      await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:deniedLibrary.identifier});
      output.library={twoCards:true,cardNavigation:true,listReferenceTrace:true,wrongPredictionFeedback:true,reloadRestoresSecond:true,independentProgress:true,resetIsolation:true,returnToFirst:true,storageDeniedLibrary:true};
    }
    output.warmup={keyboardCommit:true,traceTotals:[0,3,3,7],wrongPredictionFeedback:true,correctPredictionFeedback:true,explanationRestored:true,resetPersists:true,invalidDataRecovered:true,storageDeniedJourney:true};
  }
  for(const width of [1280,375])await visit(`http://127.0.0.1:${previewPort}/docs/design/preview.html`,width,900,'light',`gallery-${width}`);
  const controls=await evaluate(`Array.from(document.querySelectorAll('.panel')).map(panel=>({theme:panel.dataset.theme,background:getComputedStyle(panel).backgroundColor,controls:Array.from(panel.querySelectorAll('button')).map(button=>{const s=getComputedStyle(button);return {label:button.textContent,disabled:button.disabled,foreground:s.color,background:s.backgroundColor,outline:s.outlineColor,outlineStyle:s.outlineStyle}})}))`);
  const luminance=color=>{
    const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  };
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  for(const panel of controls)for(const control of panel.controls)assert.ok(ratio(control.foreground,control.background)>=4.5,`${panel.theme} ${control.label} text contrast`);
  output.links=await evaluate(`Array.from(document.querySelectorAll('.panel')).map(p=>({theme:p.dataset.theme,foreground:getComputedStyle(p.querySelector('a')).color,background:getComputedStyle(p).backgroundColor}))`);
  for(const link of output.links)assert.ok(ratio(link.foreground,link.background)>=4.5,`${link.theme} link contrast: ${JSON.stringify(link)}`);
  output.controls=controls;
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  const focus=await evaluate(`({tag:document.activeElement.tagName,label:document.activeElement.textContent,style:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth})`);
  assert.equal(focus.tag,'BUTTON');assert.equal(focus.style,'solid');assert.equal(focus.width,'3px');output.keyboardFocus=focus;
  const manifest=await(await fetch(`http://127.0.0.1:${webPort}/manifest.webmanifest`)).json();
  assert.equal(manifest.icons.length,3);assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
  for(const icon of manifest.icons)assert.equal((await fetch(`http://127.0.0.1:${webPort}${icon.src}`)).status,200);
  const metadata=await(await fetch(`http://127.0.0.1:${webPort}/`)).text();
  assert.match(metadata,/favicon-96\.png/);assert.match(metadata,/apple-touch-icon\.png/);assert.match(metadata,/noindex/);assert.ok(!metadata.includes('fonts.googleapis.com'));
  output.manifest=manifest;
  assert.deepEqual(output.errors,[]);assert.deepEqual(output.externalRequests,[]);
  await writeFile(path.join(evidence,'browser.json'),JSON.stringify(output,null,2)+'\n');
  console.log('PASS: 6 real app viewports/themes, 2 gallery viewports, self-hosted fonts/images, dark assets, keyboard focus, icon metadata and manifest; no page errors or external page requests.');
  if(output.library)console.log('PASS: library navigation, list-reference trace and independent resume/reset.');
  if(output.warmup)console.log('PASS: keyboard warmup journey, trace, review, session restore/reset, invalid data and denied storage.');
  console.log('VERDICT: PASS');
} finally {
  if(ws)ws.close();
  if(preview)await new Promise(resolve=>preview.close(resolve));
  for(const child of [web,chrome])if(child&&child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(timer);}
}
