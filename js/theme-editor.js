const label = key => key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
export function mountThemeEditor(container, settings) {
    container.classList.add('theme-editor');
    container.innerHTML = `<label>Theme <select data-theme-choice></select></label><label>Custom theme name <input data-theme-name maxlength="60"></label><p>Changes preview immediately. Apply to keep them; Cancel or closing Settings reverts unsaved changes.</p><div data-colors></div><p data-contrast role="status"></p><div class="settings-actions"><button data-apply>Apply</button><button data-save>Save custom theme</button><button data-reset>Cancel</button><button data-default>Reset to default</button><button data-export>Export JSON</button><label class="theme-import">Import JSON<input data-import type="file" accept="application/json,.json"></label></div><p data-result role="status"></p>`;
    const get = name => container.querySelector(`[data-${name}]`);
    const crtLabel = document.createElement('label');
    const crtEffects = document.createElement('input'); crtEffects.type = 'checkbox';
    crtEffects.checked = settings.get().crtEffects;
    crtLabel.append(crtEffects, 'Enable CRT Effects'); container.prepend(crtLabel);
    crtEffects.onchange = () => {
        const saved = settings.apply({crtEffects:crtEffects.checked});
        preview();
        get('result').textContent = saved ? 'CRT preference saved on this device.' : 'Applied for this visit; storage unavailable.';
    };
    const schema = settings.schema;
    let draft, active = true;
    const controls = new Map();
    Object.entries(settings.themes).forEach(([id,title])=>get('theme-choice').add(new Option(title,id)));
    function colors() { return draft.theme === 'custom' ? draft.custom.colors : schema.palette(draft.theme); }
    function asCustom() { if(draft.theme !== 'custom') draft.custom={version:schema.version,name:'',colors:schema.palette(draft.theme)}; draft.theme='custom'; get('theme-choice').value='custom'; }
    function contrast(a,b) {
        const luminance = hex => { const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; };
        const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
    }
    function warn() { const c=colors();const pairs=[['Store text','storeText','storeBackground'],['Store buttons','storeButtonText','storeButtonBackground'],['Store hover','storeHoverText','storeHoverBackground'],['Store inputs','storeInputText','storeInputBackground'],['Window text','textPrimary','windowBackground'],['Buttons','buttonText','buttonBackground'],['Inputs','inputText','inputBackground'],['Title bar','titleText','titleActive'],['Selection','selectionText','selectionBackground'],['Desktop labels','desktopLabels','desktopBackground'],['Menus','textPrimary','menu'],['Taskbar buttons','taskbarButtonText','taskbarButtonBackground'],['Active taskbar buttons','taskbarButtonActiveText','taskbarButtonActiveBackground'],['Hovered taskbar buttons','taskbarButtonHoverText','taskbarButtonHoverBackground'],['System tray','trayText','trayBackground'],['Clock','clockText','trayBackground'],['Connection status','connectionText','trayBackground'],['Radio status','radioStatusText','taskbarButtonBackground'],['Selected desktop labels','desktopSelectionText','desktopSelectionBackground']];const low=pairs.filter(([,a,b])=>contrast(c[a],c[b])<4.5).map(([name])=>name);const edges=[['Taskbar focus','taskbarButtonFocus','taskbar'],['Taskbar button border','taskbarButtonBorder','taskbar'],['Tray border','trayBorder','trayBackground'],['Desktop selection border','desktopSelectionBorder','desktopBackground']];const lowEdges=edges.filter(([,a,b])=>contrast(c[a],c[b])<3).map(([name])=>name);get('contrast').textContent=low.length?'Low contrast: '+low.join(', ')+'. You may still apply these colors.':'Checked text/background pairs meet 4.5:1 contrast.';if(lowEdges.length)get('contrast').textContent+=' Below 3:1 for UI boundaries: '+lowEdges.join(', ')+'. Colors are unchanged.'; }
    function preview() { settings.preview({theme:draft.theme,custom:draft.custom});warn(); }
    function sync() { draft=settings.get();get('theme-choice').value=draft.theme;get('theme-name').value=draft.custom?.name||'';fill(); }
    function fill() { const c=colors();controls.forEach(([picker,hex],key)=>{picker.value=c[key];hex.value=c[key];hex.setCustomValidity('');});warn(); }
    for(const [group,keys] of Object.entries(schema.groups)) {
        const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=group;details.append(summary);
        for(const key of Object.keys(keys)) {
            const row=document.createElement('label');row.className='theme-color-row';const title=document.createElement('span');title.textContent=label(key);
            const picker=document.createElement('input');picker.type='color';picker.setAttribute('aria-label',label(key)+' color');
            const hex=document.createElement('input');hex.type='text';hex.maxLength=7;hex.pattern='#[0-9a-fA-F]{6}';hex.setAttribute('aria-label',label(key)+' hex');
            const change=value=>{asCustom();draft.custom.colors[key]=value.toLowerCase();picker.value=value;hex.value=value;hex.setCustomValidity('');preview();};
            picker.oninput=()=>change(picker.value);hex.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value))change(hex.value);else hex.setCustomValidity('Use #RRGGBB.');};
            row.append(title,picker,hex);details.append(row);controls.set(key,[picker,hex]);
        }
        get('colors').append(details);
    }
    get('theme-choice').onchange=()=>{draft.theme=get('theme-choice').value;if(draft.theme==='custom'&&!draft.custom)draft.custom={version:schema.version,name:'',colors:schema.palette()};fill();preview();};
    get('theme-name').oninput=()=>{asCustom();draft.custom.name=get('theme-name').value;preview();};
    function save(custom=false) {
        const invalid=[...controls.values()].map(([,hex])=>hex).find(hex=>!hex.checkValidity());if(invalid){invalid.closest('details').open=true;invalid.reportValidity();return;}
        if(custom)asCustom();
        const saved=settings.apply({theme:draft.theme,custom:draft.custom});sync();get('result').textContent=saved?'Theme saved on this device.':'Applied for this visit; storage unavailable.';
    }
    get('apply').onclick=()=>save();get('save').onclick=()=>save(true);
    get('reset').onclick=()=>{settings.cancelPreview();sync();get('result').textContent='Unsaved changes reverted.';};
    get('default').onclick=()=>{draft.theme='toxic';get('theme-choice').value='toxic';fill();preview();get('result').textContent='Default previewed. Apply to save.';};
    get('export').onclick=()=>{const theme=schema.validate(draft.theme==='custom'?draft.custom:{version:schema.version,name:settings.themes[draft.theme],colors:colors()});const url=URL.createObjectURL(new Blob([JSON.stringify(theme,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='zombos-theme.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    get('import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>32768)throw Error('Theme file exceeds 32 KB.');const theme=schema.validate(JSON.parse(await file.text()));if(!active)return;draft.custom=theme;draft.theme='custom';get('theme-choice').value='custom';get('theme-name').value=theme.name;fill();preview();get('result').textContent='Imported preview. Apply to save.';}catch(error){if(active)get('result').textContent='Import rejected: '+error.message;}finally{event.target.value='';}};
    sync();
    return ()=>{active=false;settings.cancelPreview();};
}
