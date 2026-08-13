const { app, BrowserWindow, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const isolatedUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'prevision-dom-probe-'));
app.setPath('userData', isolatedUserData);
const appFile = path.join(root, '预见PreVision.html');
const preload = path.join(root, 'electron', 'preload.cjs');
const marker = '<img src=x onerror="globalThis.__previsionProbeExecuted=1">';
const sentinelSource = `globalThis.__previsionProbeExecuted=0;globalThis.__probeErrors=[];globalThis.alert=message=>globalThis.__probeErrors.push('alert:'+String(message));globalThis.addEventListener('error',event=>globalThis.__probeErrors.push('error:'+String(event.message)));`;
const liveWindows = [];
let electronOpenPayload = null;
let electronSaveOutcomes = [];
const electronSavePayloads = [];
const deadline = setTimeout(() => {
  console.error('Project input DOM probe timed out.');
  app.exit(1);
}, 90000);

function cleanupIsolatedUserData() {
  try { fs.rmSync(isolatedUserData, { recursive: true, force: true }); } catch { /* Electron may release files after exit. */ }
}

async function dispatchMouse(win, type, x, y, buttons = 0) {
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
    type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0,
  });
}

const keyDefinitions = {
  ' ': { code: 'Space', virtualKey: 32, text: ' ' },
  Enter: { code: 'Enter', virtualKey: 13, text: '\r' },
  Tab: { code: 'Tab', virtualKey: 9 },
  Escape: { code: 'Escape', virtualKey: 27 },
  Delete: { code: 'Delete', virtualKey: 46 },
  ArrowRight: { code: 'ArrowRight', virtualKey: 39 },
  z: { code: 'KeyZ', virtualKey: 90 },
};

async function dispatchKey(win, key, modifiers = 0, commands = []) {
  const definition = keyDefinitions[key];
  if (!definition) throw new Error(`No key definition for ${key}`);
  const base = {
    key, code: definition.code, modifiers,
    windowsVirtualKeyCode: definition.virtualKey, nativeVirtualKeyCode: definition.virtualKey,
  };
  const keyDown = { type: 'keyDown', ...base };
  if (commands.length) keyDown.commands = commands;
  if (definition.text !== undefined && modifiers === 0) {
    keyDown.text = definition.text;keyDown.unmodifiedText = definition.text;
  }
  await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', keyDown);
  await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

async function dispatchText(win, value) {
  for (const key of String(value)) {
    const virtualKey = key.toUpperCase().charCodeAt(0);
    const code = /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : (key === '-' ? 'Minus' : '');
    const base = { key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey };
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type:'keyDown', ...base, text:key, unmodifiedText:key });
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type:'keyUp', ...base });
  }
}

async function realPointerDrag(win, start, end) {
  await dispatchMouse(win, 'mouseMoved', start.x, start.y);
  await dispatchMouse(win, 'mousePressed', start.x, start.y, 1);
  for (let step = 1; step <= 4; step++) {
    const ratio = step / 4;
    await dispatchMouse(win, 'mouseMoved', start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio, 1);
  }
  await dispatchMouse(win, 'mouseReleased', end.x, end.y);
}

async function realPointerClick(win, point) {
  await dispatchMouse(win, 'mouseMoved', point.x, point.y);
  await dispatchMouse(win, 'mousePressed', point.x, point.y, 1);
  await dispatchMouse(win, 'mouseReleased', point.x, point.y);
}

function projectPayload(source) {
  return {
    app: 'PreVision', version: 1, name: `${marker}::${source}`, aspect: '16:9', assets: {}, settings: { collision: true, labels: true }, unknownRoot: 'drop-me',
    scenes: [{
      name: marker, desc: '', script: marker,
      actors: [
        { kind: 'prop', label: marker, pose: 'stand', pos: [0, 0], rotY: 0, height: 0, scale: 1, pathMode: 'curve', timeLink: 'independent', timeOffset: 0, path: [], pathTimes: [99], pathEase: ['easeIn'] },
        { kind: 'prop', label: 'modal-delete-sentinel', pose: 'stand', pos: [2, 0], rotY: 0, height: 0, scale: 1, pathMode: 'curve', timeLink: 'independent', timeOffset: 0, path: [], pathTimes: [], pathEase: [] },
      ],
      shots: [{ name: marker, desc: '', dur: 5, lock: marker, fov: 40, camMode: 'curve', timingMode: 'pointSync', syncActor: '', yaw: 0, pitch: 0, cam: [[-8, 3, 8], [-4, 2, 6]], camTimes: [99], camAim: [[1, 2, 40]] }],
    }],
  };
}

async function modalCommandProbe(win, mode) {
  const initial = await win.webContents.executeJavaScript(`(() => {
    if (!document.getElementById('storyDlg').open) document.getElementById('aiStoryboard').click();
    const button=document.getElementById('storyGen'),text=document.getElementById('storyText');
    globalThis.__modalProbeButtonClicks=0;
    button.addEventListener('click',()=>globalThis.__modalProbeButtonClicks++);
    text.value='native undo baseline';text.dispatchEvent(new Event('input',{bubbles:true}));
    button.focus();
    return {project:JSON.stringify(project),undo:undoStack.length,autosave:localStorage.getItem('previz_autosave_v3')};
  })()`);
  await dispatchKey(win, ' ');
  await dispatchKey(win, 'Enter');
  const buttonClicks = await win.webContents.executeJavaScript('globalThis.__modalProbeButtonClicks');

  await win.webContents.executeJavaScript(`document.getElementById('storyText').focus()`);
  await dispatchKey(win, 'Tab');
  const tabFocus = await win.webContents.executeJavaScript(`(() => ({id:document.activeElement?.id||'',inside:document.getElementById('storyDlg').contains(document.activeElement)}))()`);
  await dispatchKey(win, 'Tab', 8);
  const reverseTabFocus = await win.webContents.executeJavaScript(`(() => ({id:document.activeElement?.id||'',inside:document.getElementById('storyDlg').contains(document.activeElement)}))()`);

  await win.webContents.executeJavaScript(`(() => {const text=document.getElementById('storyText');text.focus();text.setSelectionRange(text.value.length,text.value.length);})()`);
  await dispatchText(win, '-typed');
  const typedValue = await win.webContents.executeJavaScript(`document.getElementById('storyText').value`);
  for (let index=0;index<'-typed'.length;index++) await dispatchKey(win, 'z', 4, ['Undo']);
  const undoValue = await win.webContents.executeJavaScript(`document.getElementById('storyText').value`);

  const scrollPoint = await win.webContents.executeJavaScript(`(() => {
    const scroll=document.getElementById('storyPlanScroll'),filler=document.createElement('div');
    filler.style.height='2400px';filler.textContent='modal scroll probe';scroll.replaceChildren(filler);scroll.scrollTop=0;
    const rect=scroll.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+Math.min(rect.height/2,120)};
  })()`);
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type:'mouseMoved', x:scrollPoint.x, y:scrollPoint.y });
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type:'mouseWheel', x:scrollPoint.x, y:scrollPoint.y, deltaX:0, deltaY:420 });
  await new Promise(resolve => setTimeout(resolve, 120));
  const scrollTop = await win.webContents.executeJavaScript(`document.getElementById('storyPlanScroll').scrollTop`);

  const isolationBefore = await win.webContents.executeJavaScript(`(() => {
    document.getElementById('storyDlg').close();
    if(actors.length<2)throw new Error('modal probe requires at least two actors');
    globalThis.__modalProbeSelected=actors[0];globalThis.__modalProbeDeleteClicks=0;
    document.getElementById('delActor').addEventListener('click',()=>globalThis.__modalProbeDeleteClicks++);
    select(globalThis.__modalProbeSelected);document.getElementById('keys').click();
    const dialog=document.getElementById('keysDlg');dialog.tabIndex=-1;dialog.focus();
    return {project:JSON.stringify(project),undo:undoStack.length,autosave:localStorage.getItem('previz_autosave_v3'),actors:actors.length,
      selectedIndex:actors.indexOf(selected),selectedLabel:selected?.label||null,selectedIdentity:selected===globalThis.__modalProbeSelected,
      deleteClicks:globalThis.__modalProbeDeleteClicks,probeErrors:globalThis.__probeErrors.slice(),time,playing};
  })()`);
  await dispatchKey(win, ' ');
  await dispatchKey(win, 'Delete');
  const isolationAfter = await win.webContents.executeJavaScript(`(() => ({project:JSON.stringify(project),undo:undoStack.length,autosave:localStorage.getItem('previz_autosave_v3'),actors:actors.length,
    selectedIndex:actors.indexOf(selected),selectedLabel:selected?.label||null,selectedIdentity:selected===globalThis.__modalProbeSelected,
    deleteClicks:globalThis.__modalProbeDeleteClicks,probeErrors:globalThis.__probeErrors.slice(),time,playing}))()`);
  const noModalSpace = await win.webContents.executeJavaScript(`(() => {document.getElementById('keysDlg').close();return playing;})()`);
  await dispatchKey(win, ' ');
  const noModalPlaying = await win.webContents.executeJavaScript('playing');
  await dispatchKey(win, ' ');

  const topology = await win.webContents.executeJavaScript(`(() => {
    const first=document.createElement('dialog'),second=document.createElement('dialog'),third=document.createElement('dialog');document.body.append(first,second,third);
    first.show();const nonmodal=currentModalCommandOwner()===null;first.close();
    first.showModal();const direct=currentModalCommandOwner()===first;
    second.showModal();const nested=currentModalCommandOwner()===second;second.close();
    const fallback=currentModalCommandOwner()===first;third.showModal();const thirdOwned=currentModalCommandOwner()===third;
    second.showModal();const reopenedAboveNewerOwner=currentModalCommandOwner()===second;
    second.close();const reopenedFallback=currentModalCommandOwner()===third;third.close();first.close();
    const nativeHost=document.createElement('div'),nativeInHiddenHost=document.createElement('dialog');nativeHost.style.display='none';nativeHost.append(nativeInHiddenHost);document.body.append(nativeHost);
    nativeInHiddenHost.showModal();const nativeTopLayerIgnoresHiddenAncestor=currentModalCommandOwner()===nativeInHiddenHost;nativeInHiddenHost.close();nativeHost.remove();
    const ariaFirstHost=document.createElement('div'),ariaSecondHost=document.createElement('div'),ariaFirst=document.createElement('div'),ariaSecond=document.createElement('div');
    for(const [host,aria] of [[ariaFirstHost,ariaFirst],[ariaSecondHost,ariaSecond]]){aria.setAttribute('role','dialog');aria.setAttribute('aria-modal','true');aria.tabIndex=0;host.append(aria);document.body.append(host);}
    ariaFirst.focus();const ariaFirstOwned=currentModalCommandOwner()===ariaFirst;
    ariaSecond.focus();const ariaSecondOwned=currentModalCommandOwner()===ariaSecond;
    ariaSecondHost.style.display='none';const ariaDisplayAncestorFallback=currentModalCommandOwner()===ariaFirst;
    ariaSecondHost.style.display='';ariaSecond.focus();const ariaDisplayAncestorRestored=currentModalCommandOwner()===ariaSecond;
    ariaSecondHost.setAttribute('aria-hidden','true');const ariaHiddenAncestorFallback=currentModalCommandOwner()===ariaFirst;
    ariaSecondHost.removeAttribute('aria-hidden');ariaSecond.focus();const ariaHiddenAncestorRestored=currentModalCommandOwner()===ariaSecond;
    ariaSecondHost.setAttribute('aria-hidden','true');ariaFirstHost.setAttribute('aria-hidden','true');const ariaReleased=currentModalCommandOwner()===null;
    ariaFirstHost.remove();ariaSecondHost.remove();first.remove();second.remove();third.remove();
    return {nonmodal,direct,nested,fallback,thirdOwned,reopenedAboveNewerOwner,reopenedFallback,nativeTopLayerIgnoresHiddenAncestor,ariaFirstOwned,ariaSecondOwned,ariaDisplayAncestorFallback,ariaDisplayAncestorRestored,ariaHiddenAncestorFallback,ariaHiddenAncestorRestored,ariaReleased};
  })()`);
  const finalState = await win.webContents.executeJavaScript(`(() => ({project:JSON.stringify(project),undo:undoStack.length,
    autosave:localStorage.getItem('previz_autosave_v3'),probeErrors:globalThis.__probeErrors.slice()}))()`);

  const localControls = buttonClicks === 2 && tabFocus.inside && tabFocus.id !== 'storyText' && reverseTabFocus.inside && reverseTabFocus.id === 'storyText' &&
    typedValue === 'native undo baseline-typed' && undoValue === 'native undo baseline' && scrollTop > 0;
  const isolation = isolationBefore.actors>=2&&isolationBefore.selectedIndex===0&&isolationBefore.selectedIdentity&&
    JSON.stringify(isolationAfter) === JSON.stringify(isolationBefore) && noModalPlaying !== noModalSpace;
  const topologyPassed = Object.values(topology).every(Boolean);
  const dataStable = finalState.project === initial.project && finalState.undo === initial.undo && finalState.autosave === initial.autosave&&finalState.probeErrors.length===0;
  if (!localControls || !isolation || !topologyPassed || !dataStable) {
    throw new Error(`${mode} modal command probe failed: ${JSON.stringify({buttonClicks,tabFocus,reverseTabFocus,typedValue,undoValue,scrollTop,isolationBefore,isolationAfter,noModalSpace,noModalPlaying,topology,initial,finalState})}`);
  }
  console.log(`✓ ${mode}: modal local Space/Enter + Tab/Shift+Tab + native textarea undo + scroll; workspace isolation + live top-layer ownership`);
}

async function projectSaveSettlementProbe(win, mode) {
  if (mode === 'web') {
    const result = await win.webContents.executeJavaScript(`(async () => {
      const status=document.getElementById('saveState'),statuses=[],runtimeErrors=[],unhandled=[];
      const observer=new MutationObserver(()=>statuses.push(status.textContent));
      observer.observe(status,{subtree:true,childList:true,characterData:true});
      const onError=event=>runtimeErrors.push(String(event.message||event.error));
      const onUnhandled=event=>{unhandled.push(String(event.reason));event.preventDefault();};
      addEventListener('error',onError);addEventListener('unhandledrejection',onUnhandled);
      const originalAppend=document.body.appendChild,originalClick=HTMLAnchorElement.prototype.click;
      const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
      let revokeCalls=0,clickCalls=0;
      URL.createObjectURL=()=> 'blob:web-project-save-probe';
      URL.revokeObjectURL=url=>{if(url==='blob:web-project-save-probe')revokeCalls++;};
      try {
        document.body.appendChild=function(node){if(node?.tagName==='A')throw new Error('probe append blocked');return originalAppend.call(this,node);};
        const failed=await document.getElementById('btnSave').onclick();
        await new Promise(resolve=>setTimeout(resolve,0));
        const failureStatuses=statuses.splice(0);
        document.body.appendChild=originalAppend;
        HTMLAnchorElement.prototype.click=function(){clickCalls++;};
        const retried=await document.getElementById('btnSave').onclick();
        await new Promise(resolve=>setTimeout(resolve,1100));
        const successStatuses=statuses.splice(0);
        return {
          failed,retried,failureStatuses,successStatuses,revokeCalls,clickCalls,
          anchors:document.querySelectorAll('a[download]').length,
          runtimeErrors,unhandled,
          failureExpected:PreVisionI18n.t('project.saveFailed',{message:'probe append blocked'}),
          successExpected:PreVisionI18n.t('project.savedLocal')
        };
      } finally {
        observer.disconnect();removeEventListener('error',onError);removeEventListener('unhandledrejection',onUnhandled);
        document.body.appendChild=originalAppend;HTMLAnchorElement.prototype.click=originalClick;
        URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
      }
    })()`);
    const passed=result.failed===false&&result.retried===true&&
      JSON.stringify(result.failureStatuses)===JSON.stringify([result.failureExpected])&&
      JSON.stringify(result.successStatuses)===JSON.stringify([result.successExpected])&&
      result.revokeCalls===2&&result.clickCalls===1&&result.anchors===0&&result.runtimeErrors.length===0&&result.unhandled.length===0;
    if (!passed) throw new Error(`web project save settlement failed: ${JSON.stringify(result)}`);
    console.log('✓ web: project save append failure settled once; immediate DOM download retry succeeded with 0 error/unhandled');
    return;
  }

  electronSaveOutcomes = [
    { kind:'ok', value:{ canceled:false,path:'isolated/project-ok.previz.json' } },
    { kind:'cancel', value:{ canceled:true } },
    { kind:'error', message:'isolated Electron save failure' },
  ];
  electronSavePayloads.length=0;
  const result = await win.webContents.executeJavaScript(`(async () => {
    const status=document.getElementById('saveState'),alerts=[],runtimeErrors=[],unhandled=[];
    const originalAlert=globalThis.alert,onError=event=>runtimeErrors.push(String(event.message||event.error));
    const onUnhandled=event=>{unhandled.push(String(event.reason));event.preventDefault();};
    globalThis.alert=message=>alerts.push(String(message));
    addEventListener('error',onError);addEventListener('unhandledrejection',onUnhandled);
    try {
      const ok=await saveProjectFile(),okStatus=status.textContent;
      status.textContent='electron-cancel-sentinel';
      const canceled=await saveProjectFile(),cancelStatus=status.textContent;
      status.textContent='electron-error-sentinel';
      const errored=await saveProjectFile(),errorStatus=status.textContent;
      await new Promise(resolve=>setTimeout(resolve,0));
      return {
        ok,canceled,errored,okStatus,cancelStatus,errorStatus,alerts,runtimeErrors,unhandled,
        okExpected:PreVisionI18n.t('project.savedPath',{path:'isolated/project-ok.previz.json'}),
        errorPrefix:PreVisionI18n.t('project.saveFailed',{message:''}).replace(/\\s*$/,'')
      };
    } finally {
      globalThis.alert=originalAlert;removeEventListener('error',onError);removeEventListener('unhandledrejection',onUnhandled);
    }
  })()`);
  const payloadsValid=electronSavePayloads.length===3&&electronSavePayloads.every(payload=>
    typeof payload.suggestedName==='string'&&payload.suggestedName.endsWith('.previz.json')&&JSON.parse(payload.contents).version===5);
  const passed=result.ok===true&&result.canceled===false&&result.errored===false&&result.okStatus===result.okExpected&&
    result.cancelStatus==='electron-cancel-sentinel'&&result.errorStatus==='electron-error-sentinel'&&result.alerts.length===1&&
    result.alerts[0].includes('isolated Electron save failure')&&result.runtimeErrors.length===0&&result.unhandled.length===0&&payloadsValid;
  if (!passed) throw new Error(`electron project save settlement failed: ${JSON.stringify({result,electronSavePayloads})}`);
  console.log('✓ electron: actual preload/IPC save ok/cancel/error preserved in isolated userData with 0 error/unhandled');
}

async function nativeFovRangeProbe(win, mode) {
  const setup = await win.webContents.executeJavaScript(`(() => {
    const input=document.getElementById('fov'),section=input.closest('details'),target=actors[0],shot=curShot();
    if(!target||!shot)throw new Error('native FOV range probe requires a lock target and shot');
    const storyDialog=document.getElementById('storyDlg');if(storyDialog?.open)storyDialog.close();
    if(section)section.open=true;
    shot.lock=target.label;shot.timingMode='custom';shot.syncActor='';shot.fov=39;
    const keys=ensureCamKeys(shot);keys[0].fov=39;ensureCamTimes(shot)[0]=0;ensureCamAimTimes(shot)[0]=0;ensureCamFovTimes(shot)[0]=0;
    selCamPt=0;time=0;clearPointPreview();updateShotCam();refreshShotPanel();
    globalThis.__nativeFovRangeEvents={input:0,change:0};
    input.addEventListener('input',()=>globalThis.__nativeFovRangeEvents.input++);
    input.addEventListener('change',()=>globalThis.__nativeFovRangeEvents.change++);
    input.scrollIntoView({block:'center'});input.focus();
    const rect=input.getBoundingClientRect();
    return {rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},value:+input.value,yawDisabled:document.getElementById('yaw').disabled,
      activeId:document.activeElement?.id||'',disabled:input.disabled,hitId:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.id||'',userAgent:navigator.userAgent};
  })()`);
  if(setup.value!==39||!setup.yawDisabled||setup.rect.width<20||setup.rect.height<1)throw new Error(`${mode} native FOV range setup failed: ${JSON.stringify(setup)}`);
  for(let value=39;value<79;value++){
    const event={key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39};
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'rawKeyDown',...event});
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...event});
  }
  await new Promise(resolve=>setTimeout(resolve,120));
  const result=await win.webContents.executeJavaScript(`(() => {
    updateShotCam();refreshShotPanel();
    const input=document.getElementById('fov'),shot=curShot(),value=+input.value;
    return {value,events:globalThis.__nativeFovRangeEvents,scalar:shot.fov,key:ensureCamKeys(shot)[0].fov,runtime:shotCam.fov,
      monitor:document.getElementById('monLens').textContent,expectedFocal:focalOf(value),draft:!!currentUnifiedCameraDraftPose(),
      electronChromium:navigator.userAgent.includes('Electron/'),activeId:document.activeElement?.id||'',userAgent:navigator.userAgent};
  })()`);
  const passed=result.value===79&&result.events.input>0&&result.events.change>0&&!result.draft&&
    result.scalar===result.value&&result.key===result.value&&result.runtime===result.value&&result.monitor.includes(`${result.expectedFocal}mm`)&&result.electronChromium;
  if(!passed)throw new Error(`${mode} Electron Chromium native FOV range probe failed: ${JSON.stringify({setup,result})}`);
  console.log(`✓ ${mode}: Electron Chromium native range 39°→${result.value}° emitted input/change and synchronized scalar/key/shotCam/monitor (not independent Chrome evidence)`);
}

async function probe(mode) {
  const partition = `project-input-probe-${mode}-${Date.now()}`;
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition,
      ...(mode === 'electron' ? { preload } : {}),
    },
  });
  liveWindows.push(win);
  try {
    const nextDomReady = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${mode} dom-ready timed out`)), 15000);
      win.webContents.once('dom-ready', () => { clearTimeout(timer); resolve(); });
      win.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timer); reject(new Error(`${mode} load failed ${code}: ${description}`)); });
      win.webContents.once('render-process-gone', (_event, details) => { clearTimeout(timer); reject(new Error(`${mode} renderer gone: ${JSON.stringify(details)}`)); });
    });
    const domReady = nextDomReady();
    void win.loadFile(appFile).catch(() => {});
    await domReady;
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Page.enable');
    await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: sentinelSource });
    try { await win.webContents.executeJavaScript(`localStorage.setItem('previz_autosave_v3', ${JSON.stringify(JSON.stringify(projectPayload('startup')))})`); }
    catch (error) { throw new Error(`${mode} startup seed failed: ${error.message}`); }
    const startupDomReady = nextDomReady();win.webContents.reload();await startupDomReady;
    if (mode === 'electron') electronOpenPayload = projectPayload('ipc');
    let startupNormalized;try { startupNormalized = await win.webContents.executeJavaScript(`project.name.endsWith('::startup') && project.version === 5 && !('unknownRoot' in project) && project.scenes[0].shots[0].camTimes.length === 2 && globalThis.__previsionProbeExecuted === 0 && globalThis.__probeErrors.length === 0`); }
    catch (error) { throw new Error(`${mode} startup assertion failed: ${error.message}`); }
    await win.webContents.executeJavaScript(sentinelSource);
    let entryOpened;try { entryOpened = await win.webContents.executeJavaScript(`(async () => {
      const waitFor = async predicate => { for (let i = 0; i < 500; i++) { if (predicate()) return true; await new Promise(resolve => setTimeout(resolve, 20)); } return false; };
      if (${JSON.stringify(mode)} === 'web') {
        const transfer = new DataTransfer();
        transfer.items.add(new File([${JSON.stringify(JSON.stringify(projectPayload('file')))}], 'probe.previz.json', { type: 'application/json' }));
        const input = document.getElementById('fileOpen');input.files = transfer.files;input.dispatchEvent(new Event('change', { bubbles: true }));
        return waitFor(() => project.name.endsWith('::file'));
      }
      document.getElementById('btnOpen').click();
      return waitFor(() => project.name.endsWith('::ipc'));
    })()`); } catch (error) { throw new Error(`${mode} entry drive failed: ${error.message}`); }
    let result;try { result = await win.webContents.executeJavaScript(`(() => {
      refreshSceneRail();
      refreshObjList();
      refreshShotPanel();
      document.getElementById('aiStoryboard').click();
      document.getElementById('storyGen').click();
      const storyboardText = Array.from(document.querySelectorAll('.story-beat-text')).map(node => node.textContent).join(' ');
      const text = [
        document.getElementById('projname').value,
        document.getElementById('scenelist').textContent,
        document.getElementById('objlist').textContent,
      ].join('\\n');
      return {
        entryNormalized: project.version === 5 && !('unknownRoot' in project) && project.scenes[0].shots[0].camTimes.length === 2,
        storyboardText: storyboardText.includes('<img src=x onerror=') && storyboardText.includes('__previsionProbeExecuted=1">'),
        markerCount: text.split(${JSON.stringify(marker)}).length - 1,
        injectedNodes: document.querySelectorAll('img[src="x"],script[src="x"],iframe[src="x"]').length,
        executed: globalThis.__previsionProbeExecuted,
        errors: globalThis.__probeErrors,
        desktop: !!globalThis.previsionDesktop,
      };
    })()`); } catch (error) { throw new Error(`${mode} sink assertion failed: ${error.message}`); }
    result.startupNormalized = startupNormalized;result.entryOpened = entryOpened;
    if (!result.startupNormalized || !result.entryOpened || !result.entryNormalized || !result.storyboardText || result.markerCount < 3 || result.injectedNodes !== 0 || result.executed !== 0 || result.errors.length !== 0) {
      throw new Error(`${mode} DOM probe failed: ${JSON.stringify(result)}`);
    }
    if (result.desktop !== (mode === 'electron')) {
      throw new Error(`${mode} boundary mismatch: ${JSON.stringify(result)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 900));
    await modalCommandProbe(win, mode);
    await projectSaveSettlementProbe(win, mode);
    await nativeFovRangeProbe(win, mode);
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    console.log(`✓ ${mode}: startup + ${mode === 'web' ? 'FileReader' : 'Electron IPC'} normalized; project/storyboard markup stayed text-only`);
  } catch (error) {
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    win.destroy();
    throw error;
  }
}

async function autosaveTerminalProbe(mode) {
  const partition = `autosave-terminal-${mode}-${Date.now()}`;
  const makeWindow = () => new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition,
      ...(mode === 'electron' ? { preload } : {}),
    },
  });
  const load = async win => {
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${mode} autosave dom-ready timed out`)), 15000);
      win.webContents.once('dom-ready', () => { clearTimeout(timer); resolve(); });
      win.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timer); reject(new Error(`${mode} autosave load failed ${code}: ${description}`)); });
    });
    void win.loadFile(appFile).catch(() => {});await ready;
  };
  const edit = (win, name) => win.webContents.executeJavaScript(`(() => {
    document.getElementById('projname').value=${JSON.stringify(name)};
    markDirty();return !!dirtyTimer;
  })()`);
  const restored = (win, name) => win.webContents.executeJavaScript(`project.name===${JSON.stringify(name)}`);

  let win = makeWindow();liveWindows.push(win);await load(win);
  if (!await edit(win, `${mode}-reload`)) throw new Error(`${mode} reload did not create pending autosave`);
  let ready = new Promise(resolve => win.webContents.once('dom-ready', resolve));win.webContents.reload();await ready;
  if (!await restored(win, `${mode}-reload`)) throw new Error(`${mode} reload lost terminal autosave`);
  if (!await edit(win, `${mode}-force-reload`)) throw new Error(`${mode} force reload did not create pending autosave`);
  ready = new Promise(resolve => win.webContents.once('dom-ready', resolve));win.webContents.reloadIgnoringCache();await ready;
  if (!await restored(win, `${mode}-force-reload`)) throw new Error(`${mode} force reload lost terminal autosave`);
  if (!await edit(win, `${mode}-close`)) throw new Error(`${mode} close did not create pending autosave`);
  const closed = new Promise(resolve => win.once('closed', resolve));win.close();await closed;
  win = makeWindow();liveWindows.push(win);await load(win);
  if (!await restored(win, `${mode}-close`)) throw new Error(`${mode} close/relaunch lost terminal autosave`);
  win.destroy();
  console.log(`✓ ${mode}: pending autosave survived reload + force reload + close/relaunch in isolated partition`);
}

async function timelineHitProbe() {
  const partition = `timeline-hit-probe-${Date.now()}`;
  const win = new BrowserWindow({
    show: false,
    width: 1316,
    height: 768,
    useContentSize: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, partition },
  });
  liveWindows.push(win);
  try {
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeline dom-ready timed out')), 15000);
      win.webContents.once('dom-ready', () => { clearTimeout(timer); resolve(); });
      win.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timer); reject(new Error(`timeline load failed ${code}: ${description}`)); });
    });
    void win.loadFile(appFile).catch(() => {});await ready;
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Page.enable');
    const fixture = await win.webContents.executeJavaScript(`(() => {
      document.getElementById('addSemanticProxy').click();
      selected.label='timeline-native-probe-actor';selected.pathPts=[new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0)];selected.pathTimes=[2,4];selected.pathEase=[{type:'linear'}];
      const scale=document.getElementById('objScale');scale.value=String(Number(scale.value)+.05);scale.dispatchEvent(new Event('input',{bubbles:true}));scale.dispatchEvent(new Event('change',{bubbles:true}));
      const add=document.getElementById('motionAddKey');if(!add.disabled)add.click();
      const scope=document.getElementById('motionTimeScope');if(scope.getAttribute('aria-pressed')!=='true')scope.click();refreshMotionTimeline();
      const counts={previewKey:document.querySelectorAll('[data-role="preview-key"]').length,previewGroup:document.querySelectorAll('[data-role="preview-group"]').length,
        legacyKey:document.querySelectorAll('.motion-key[data-role="key"]').length,clipGrip:document.querySelectorAll('.motion-clip-grip').length};
      return {addDisabled:add.disabled,counts,ready:Object.values(counts).every(Boolean)};
    })()`);
    if (!fixture.ready) throw new Error(`timeline fixture did not create every target: ${JSON.stringify(fixture)}`);

    const computed = await win.webContents.executeJavaScript(`(() => {
      const z=selector=>getComputedStyle(document.querySelector(selector)).zIndex;
      const playhead=getComputedStyle(document.getElementById('motionPlayhead'));
      return {key:z('.motion-key'),group:z('.motion-group-key'),grip:z('.motion-clip-grip'),playhead:playhead.zIndex,width:playhead.width,pointerEvents:playhead.pointerEvents};
    })()`);
    if (JSON.stringify(computed) !== JSON.stringify({ key: '10', group: '10', grip: '9', playhead: '8', width: '13px', pointerEvents: 'auto' })) {
      throw new Error(`timeline computed style mismatch: ${JSON.stringify(computed)}`);
    }

    const targetSpecs = [
      { name: 'preview-group', selector: '[data-role="preview-group"]', role: 'preview-group', delta: 44 },
      { name: 'preview-key', selector: '[data-role="preview-key"]', role: 'preview-key', delta: 40 },
      { name: 'legacy-key', selector: '.motion-key[data-role="key"]:not(.foundation)', role: 'key', delta: -40 },
      { name: 'clip', selector: '.motion-row[data-type="actor"][data-label="timeline-native-probe-actor"] .motion-clip-grip', role: 'clip', delta: 40 },
    ];
    const results = [];
    for (const spec of targetSpecs) {
      const geometry = await win.webContents.executeJavaScript(`(() => {
        const rows=document.getElementById('motionRows'),target=document.querySelector(${JSON.stringify(spec.selector)});if(!target)return null;
        const row=target.closest('.motion-row');rows.scrollTop=Math.max(0,row.offsetTop-24);
        const rect=target.getBoundingClientRect(),ruler=document.getElementById('motionRuler').getBoundingClientRect();
        return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,rulerY:ruler.top+ruler.height/2,beforeLeft:target.style.left};
      })()`);
      if (!geometry) throw new Error(`timeline target missing: ${spec.name}`);
      await realPointerClick(win, { x: geometry.x, y: geometry.rulerY });
      const hit = await win.webContents.executeJavaScript(`(() => {const target=document.querySelector(${JSON.stringify(spec.selector)}),rect=target.getBoundingClientRect(),node=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return {role:node?.dataset?.role||'',id:node?.id||'',x:rect.left+rect.width/2,y:rect.top+rect.height/2,beforeLeft:target.style.left};})()`);
      if (hit.role !== spec.role) throw new Error(`${spec.name} elementFromPoint hit ${JSON.stringify(hit)}`);
      await realPointerDrag(win, { x: hit.x, y: hit.y }, { x: hit.x + spec.delta, y: hit.y });
      const after = await win.webContents.executeJavaScript(`(() => {const target=document.querySelector(${JSON.stringify(spec.selector)}),rect=target.getBoundingClientRect();return {left:target.style.left,x:rect.left+rect.width/2,hitRole:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.dataset?.role||''};})()`);
      if (after.left === hit.beforeLeft || Math.abs(after.x-hit.x) <= 10 || after.hitRole !== spec.role) throw new Error(`${spec.name} real pointer drag failed: ${JSON.stringify({ hit, after })}`);
      results.push({ name: spec.name, hitRole: hit.role, moved: true });
    }

    const blank = await win.webContents.executeJavaScript(`(() => {const rows=document.getElementById('motionRows');rows.scrollTop=0;const ruler=document.getElementById('motionRuler').getBoundingClientRect(),lane=document.querySelector('.motion-lane').getBoundingClientRect();return {x:ruler.left+ruler.width*.72,rulerY:ruler.top+ruler.height/2,laneY:lane.top+lane.height/2};})()`);
    await realPointerClick(win, { x: blank.x, y: blank.rulerY });
    const laneBefore = await win.webContents.executeJavaScript(`(() => {const ph=document.getElementById('motionPlayhead').getBoundingClientRect(),node=document.elementFromPoint(ph.left+ph.width/2,${blank.laneY});return {x:ph.left+ph.width/2,y:${blank.laneY},id:node?.id||'',time};})()`);
    if (laneBefore.id !== 'motionPlayhead') throw new Error(`blank lane did not hit playhead: ${JSON.stringify(laneBefore)}`);
    await realPointerDrag(win, { x: laneBefore.x, y: laneBefore.y }, { x: laneBefore.x + 35, y: laneBefore.y });
    const laneAfter = await win.webContents.executeJavaScript('time');
    if (!(laneAfter > laneBefore.time)) throw new Error(`blank lane scrub failed: ${laneBefore.time} -> ${laneAfter}`);
    const rulerBefore = await win.webContents.executeJavaScript('time');
    await realPointerDrag(win, { x: blank.x - 80, y: blank.rulerY }, { x: blank.x - 40, y: blank.rulerY });
    const rulerAfter = await win.webContents.executeJavaScript('time');
    if (rulerAfter === rulerBefore) throw new Error(`blank ruler scrub failed: ${rulerBefore} -> ${rulerAfter}`);
    console.log(`✓ timeline: computed stacking + elementFromPoint + real pointer drag (${results.map(item => item.name).join(', ')}) + blank lane/ruler scrub`);
  } catch (error) {
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    win.destroy();throw error;
  }
  if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
  win.destroy();
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function inspectorQuickEntryScrollProbe() {
  const viewports = [
    { width: 1316, height: 768 },
    { width: 1440, height: 900 },
    { width: 1600, height: 900 },
  ];
  const entries = ['rightRailCamera', 'rightRailActors', 'rightRailPath', 'rightRailLighting'];
  const evidenceDir = process.env.PREVISION_QA_EVIDENCE_DIR;
  const allMetrics = [];
  const qaEvidence = [];
  const modes = ['rail', 'peek', 'expanded', 'director-focus'];
  if (evidenceDir) fs.mkdirSync(evidenceDir, { recursive: true });

  const captureQaEvidence = async (win, filename, steps, result) => {
    if (!evidenceDir) return;
    const image = await win.capturePage(), png = image.toPNG(), screenshotSize = image.getSize();
    const runtime = await win.webContents.executeJavaScript(`({url:location.href,title:document.title,innerSize:[innerWidth,innerHeight],dpr:devicePixelRatio})`);
    fs.writeFileSync(path.join(evidenceDir, filename), png);
    const record = {
      owner: 'inspectorQuickEntryScrollProbe BrowserWindow', windowTitle: win.getTitle(), url: runtime.url,
      contentSize: win.getContentSize(), innerSize: runtime.innerSize, dpr: runtime.dpr,
      screenshot: filename, screenshotSize: [screenshotSize.width, screenshotSize.height],
      sha256: crypto.createHash('sha256').update(png).digest('hex'), steps, result,
    };
    qaEvidence.push(record);
    return record;
  };
  const writeQaMetadata = compactObservation => {
    if (!evidenceDir) return;
    const metadataFile = path.join(evidenceDir, 'inspector-qa-metadata.json');
    const temporaryFile = `${metadataFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify({
      owner: 'inspectorQuickEntryScrollProbe', matrix: '3 desktop viewports × 4 modes × 4 entries',
      samples: allMetrics.length, evidence: qaEvidence, compactObservation,
    }, null, 2));
    fs.renameSync(temporaryFile, metadataFile);
  };

  const runMode = async (viewport, mode) => {
    const partition = `inspector-quick-entry-${viewport.width}x${viewport.height}-${mode}-${Date.now()}`;
    const win = new BrowserWindow({
      show: true,
      width: viewport.width,
      height: viewport.height,
      useContentSize: true,
      // Four mode windows run concurrently so every 2s stability read fits the
      // 90s probe deadline; Chromium must not pause their rAF layout checks
      // merely because one window has focus.
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, partition, backgroundThrottling: false },
    });
    liveWindows.push(win);
    try {
      const ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`inspector ${viewport.width}x${viewport.height} dom-ready timed out`)), 15000);
        win.webContents.once('dom-ready', () => { clearTimeout(timer); resolve(); });
        win.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timer); reject(new Error(`inspector load failed ${code}: ${description}`)); });
      });
      void win.loadFile(appFile).catch(() => {});await ready;
      win.webContents.debugger.attach('1.3');
      const waitForInitialScrollport = async () => {
        let lastMetric, stableSamples = 0;
        for (let attempt = 0; attempt < 200; attempt++) {
          const metric = await win.webContents.executeJavaScript(`(() => {
            const scroll=document.getElementById('rightScroll'),pip=document.getElementById('pip'),outer=scroll.getBoundingClientRect();
            return {top:outer.top,bottom:outer.bottom,pipWidth:pip.clientWidth,pipHeight:pip.clientHeight};
          })()`);
          if (metric.pipWidth > 0 && metric.pipHeight > 0 && lastMetric && metric.top === lastMetric.top && metric.bottom === lastMetric.bottom) stableSamples++;
          else stableSamples = 0;
          if (stableSamples >= 8) return;
          lastMetric = metric;
          await wait(25);
        }
        throw new Error(`inspector ${viewport.width}x${viewport.height} ${mode} initial scrollport did not stabilize: ${JSON.stringify(lastMetric)}`);
      };
      await waitForInitialScrollport();
      const waitForInspectorSettled = async index => {
        let lastMetric;
        for (let attempt = 0; attempt < 200; attempt++) {
          const metric = await win.webContents.executeJavaScript(`(() => {
            const scroll=document.getElementById('rightScroll'),summary=document.querySelectorAll('#rightScroll > details.sec')[${index}].querySelector('summary'),outer=scroll.getBoundingClientRect(),rect=summary.getBoundingClientRect(),max=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
            return {scrollTop:scroll.scrollTop,max,outer:{top:outer.top,bottom:outer.bottom},summary:{top:rect.top,bottom:rect.bottom},visible:outer.height>20&&rect.height>0&&rect.top>=outer.top-1&&rect.bottom<=outer.bottom+1,productSettled:typeof inspectorScrollIsSettled==='function'&&inspectorScrollIsSettled()};
          })()`);
          lastMetric = metric;
          if (metric.productSettled && metric.visible && (metric.max<=1 || metric.scrollTop<metric.max-1)) return metric;
          await wait(25);
        }
        throw new Error(`inspector ${viewport.width}x${viewport.height} ${mode} target ${entries[index]} did not reach the product settled scrollport: ${JSON.stringify(lastMetric)}`);
      };
      const openEntry = async index => {
        await win.webContents.executeJavaScript(`(() => {
          const scroll=document.getElementById('rightScroll');
          setDirectorFocus(false);setRightPanelState('expanded',false);
          document.querySelectorAll('#rightScroll > details.sec').forEach(section=>{section.open=true;});scroll.scrollTop=0;
          if (${JSON.stringify(mode)}==='rail') setRightPanelState('rail',false);
          if (${JSON.stringify(mode)}==='peek') setRightPanelState('peek',false);
          if (${JSON.stringify(mode)}==='director-focus') { setRightPanelState('rail',false);setDirectorFocus(true); }
        })()`);
        await win.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(entries[index])}).click()`);
        const settled = await waitForInspectorSettled(index);
        await wait(2000);
        const afterTwoSeconds = await win.webContents.executeJavaScript(`(() => {
          const scroll=document.getElementById('rightScroll'),summary=document.querySelectorAll('#rightScroll > details.sec')[${index}].querySelector('summary'),outer=scroll.getBoundingClientRect(),rect=summary.getBoundingClientRect(),max=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
          return {scrollTop:scroll.scrollTop,max,outer:{top:outer.top,bottom:outer.bottom},summary:{top:rect.top,bottom:rect.bottom},visible:outer.height>20&&rect.height>0&&rect.top>=outer.top-1&&rect.bottom<=outer.bottom+1};
        })()`);
        if (!settled.productSettled || !afterTwoSeconds.visible || (settled.max>1&&settled.scrollTop>=settled.max-1) || (afterTwoSeconds.max>1&&afterTwoSeconds.scrollTop>=afterTwoSeconds.max-1) || afterTwoSeconds.scrollTop!==settled.scrollTop) {
          throw new Error(`inspector ${viewport.width}x${viewport.height} ${mode} ${entries[index]} unstable: ${JSON.stringify({ settled, afterTwoSeconds })}`);
        }
        allMetrics.push({ viewport, mode, entry:entries[index], settled, afterTwoSeconds });
      };

      for (let index = 0; index < entries.length; index++) await openEntry(index);

      // Capture while the final quick-entry target is still visibly positioned.
      // Ownership probes below intentionally alter the panel state and must not
      // determine the evidence screenshot.
      const screenshotTarget = await waitForInspectorSettled(3);
      if (!screenshotTarget.visible) throw new Error(`inspector ${viewport.width}x${viewport.height} screenshot target is not visible`);
      const evidenceRecord = await captureQaEvidence(win, `inspector-${viewport.width}x${viewport.height}-${mode}.png`,
        `Set ${mode}; open camera, actors, path, then lighting; wait for product settled; verify lighting summary visible and non-bottom.`,
        { pass: true, target: entries[3], settled: screenshotTarget });

      const ownership = await win.webContents.executeJavaScript(`(() => {
        const scroll=document.getElementById('rightScroll');setDirectorFocus(false);setRightPanelState('rail',false);scroll.scrollTop=37;
        document.getElementById('rightRailCamera').click();document.getElementById('rightRailLighting').click();
        const consecutiveTarget=document.querySelectorAll('#rightScroll > details.sec')[3].querySelector('summary');
        return {before:scroll.scrollTop,consecutiveTop:consecutiveTarget.getBoundingClientRect().top};
      })()`);
      await waitForInspectorSettled(3);
      const lastIntent = await win.webContents.executeJavaScript(`(() => {
        const scroll=document.getElementById('rightScroll'),summary=document.querySelectorAll('#rightScroll > details.sec')[3].querySelector('summary'),outer=scroll.getBoundingClientRect(),rect=summary.getBoundingClientRect();
        return {scrollTop:scroll.scrollTop,visible:rect.top>=outer.top-1&&rect.bottom<=outer.bottom+1};
      })()`);
      if (!lastIntent.visible) throw new Error(`inspector ${viewport.width}x${viewport.height} last intent lost: ${JSON.stringify({ ownership, lastIntent })}`);

      const manual = await win.webContents.executeJavaScript(`(() => {
        const scroll=document.getElementById('rightScroll');setRightPanelState('rail',false);document.getElementById('rightRailLighting').click();
        const rect=scroll.getBoundingClientRect();const x=rect.left+rect.width/2,y=rect.top+Math.min(rect.height/2,80);
        const hit=document.elementFromPoint(x,y);return {x,y,before:scroll.scrollTop,hitRightScroll:hit?.closest('#rightScroll')?.id==='rightScroll'};
      })()`);
      if (!manual.hitRightScroll) throw new Error(`inspector ${viewport.width}x${viewport.height} CDP wheel missed #rightScroll: ${JSON.stringify(manual)}`);
      await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',x:manual.x,y:manual.y,deltaX:0,deltaY:120});
      await wait(350);
      const wheelAfter = await win.webContents.executeJavaScript(`document.getElementById('rightScroll').scrollTop`);
      if (wheelAfter <= manual.before) throw new Error(`inspector ${viewport.width}x${viewport.height} CDP wheel did not move #rightScroll: ${JSON.stringify({ manual, wheelAfter })}`);
      await wait(300);
      const wheelSettled = await win.webContents.executeJavaScript(`document.getElementById('rightScroll').scrollTop`);
      if (wheelSettled !== wheelAfter) throw new Error(`inspector ${viewport.width}x${viewport.height} manual scroll ownership lost: ${JSON.stringify({ manual, wheelAfter, wheelSettled })}`);
      console.log(`✓ inspector wheel ownership ${viewport.width}x${viewport.height} ${mode}: #rightScroll ${manual.before} -> ${wheelAfter} -> ${wheelSettled}`);

      const panelChange = await win.webContents.executeJavaScript(`(() => {
        const scroll=document.getElementById('rightScroll');setRightPanelState('rail',false);scroll.scrollTop=Math.min(29,Math.max(0,scroll.scrollHeight-scroll.clientHeight));
        const before=scroll.scrollTop;document.getElementById('rightRailPath').click();setRightPanelState('rail',false);return before;
      })()`);
      await wait(300);
      const panelChangeAfter = await win.webContents.executeJavaScript(`(() => ({scrollTop:document.getElementById('rightScroll').scrollTop,right:document.getElementById('appWorkspace').dataset.right}))()`);
      if (panelChangeAfter.scrollTop !== panelChange || panelChangeAfter.right !== 'rail') {
        throw new Error(`inspector ${viewport.width}x${viewport.height} panel ownership lost: ${JSON.stringify({ panelChange, panelChangeAfter })}`);
      }
      if (evidenceRecord) evidenceRecord.result = { pass: true, target: entries[3], settled: screenshotTarget, lastIntent, wheel: { before: manual.before, after: wheelAfter, settled: wheelSettled }, panelChange: panelChangeAfter };
    } catch (error) {
      if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
      win.destroy();throw error;
    }
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    win.destroy();
  };
  for (const viewport of viewports) {
    await Promise.all(modes.map(mode=>runMode(viewport,mode)));
  }
  if(allMetrics.length!==48)throw new Error(`inspector matrix expected 48 samples, received ${allMetrics.length}`);
  writeQaMetadata({ status: 'N/A', reason: '390×844 is a non-blocking observation and is not part of the desktop owner matrix.' });
  console.log(`✓ inspector quick entries: 3 viewports × 4 modes × 4 entries; 48 stable rect/scroll samples + last intent and user/panel scroll ownership`);
}

app.whenReady().then(async () => {
  try {
    ipcMain.handle('project:open', async () => ({ canceled: false, contents: JSON.stringify(electronOpenPayload), path: 'probe.previz.json' }));
    ipcMain.handle('project:save', async (_event, payload = {}) => {
      electronSavePayloads.push(payload);
      const outcome=electronSaveOutcomes.shift();
      if (!outcome) throw new Error('Unexpected project save probe call');
      if (outcome.kind==='error') throw new Error(outcome.message);
      return outcome.value;
    });
    await probe('web');
    await probe('electron');
    await autosaveTerminalProbe('web');
    await autosaveTerminalProbe('electron');
    await timelineHitProbe();
    await inspectorQuickEntryScrollProbe();
    liveWindows.forEach(win => { if (!win.isDestroyed()) win.destroy(); });
    clearTimeout(deadline);
    cleanupIsolatedUserData();
    await app.quit();
  } catch (error) {
    liveWindows.forEach(win => { if (!win.isDestroyed()) win.destroy(); });
    cleanupIsolatedUserData();
    console.error(error?.stack || error);
    app.exit(1);
  }
});
