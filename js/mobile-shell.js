export const MOBILE_QUERY = '(max-width: 750px), (pointer: coarse) and (max-width: 1100px)';
export function isStandalone(environment = window) {
    return environment.matchMedia('(display-mode: standalone)').matches || environment.navigator.standalone === true;
}
export function mountMobileShell({manager, installed, launch, workspace, environment = window}) {
    const root=document.documentElement, media=environment.matchMedia(MOBILE_QUERY);
    const standalone=environment.matchMedia('(display-mode: standalone)');
    const home=document.createElement('section'); home.id='mobileHome'; home.hidden=true;
    home.setAttribute('aria-label','ZombOS mobile home');
    const heading=document.createElement('h1'); heading.textContent='ZOMB LABS';
    const subtitle=document.createElement('p'); subtitle.textContent='ZombOS / APPLICATIONS';
    const grid=document.createElement('div'); grid.className='mobile-app-grid';
    for (const app of installed) {
        const button=document.createElement('button'); button.type='button'; button.dataset.app=app.id;
        const symbol=document.createElement('span'); symbol.textContent=app.symbol; symbol.setAttribute('aria-hidden','true');
        const title=document.createElement('span'); title.textContent=app.title; button.append(symbol,title);
        button.onclick=()=>launch(app.id); grid.append(button);
    }
    const help=document.createElement('details'), summary=document.createElement('summary'); summary.textContent='Install ZombOS';
    help.append(summary);
    for (const text of [
        'iPhone: Safari → Share → Add to Home Screen → Open as Web App → Add.',
        'Android: use the browser’s Install App or Add to Home Screen option, when supported.',
        'Online connection required. Browser tabs and installed apps may keep separate settings and history. Background audio and calls are not guaranteed.'
    ]) { const p=document.createElement('p'); p.textContent=text; help.append(p); }
    home.append(heading,subtitle,grid,help);
    const bar=document.createElement('nav'); bar.id='mobileNavigation'; bar.hidden=true; bar.setAttribute('aria-label','Mobile app navigation');
    const homeButton=document.createElement('button'); homeButton.type='button'; homeButton.textContent='Home';
    const label=document.createElement('label'); label.textContent='Running ';
    const switcher=document.createElement('select'); switcher.setAttribute('aria-label','Switch running application'); label.append(switcher);
    bar.append(homeButton,label); document.body.append(home,bar);
    let showHome=true;
    const focused=()=>[...manager.windows].reverse().find(([,state])=>!state.minimized && state.element.classList.contains('is-focused'));
    function render() {
        const mobile=media.matches, ready=!workspace.hidden;
        root.dataset.mobile=String(mobile); root.dataset.standalone=String(isStandalone(environment));
        root.dataset.mobileHome=String(showHome);
        home.hidden=!mobile || !ready || !showHome; bar.hidden=!mobile || !ready;
        homeButton.setAttribute('aria-pressed',String(showHome));
        const options=[...manager.windows].map(([id,state])=>[id,state.title]);
        const signature=JSON.stringify(options);
        if (switcher.dataset.signature!==signature) {
            switcher.replaceChildren(); const placeholder=document.createElement('option'); placeholder.value=''; placeholder.textContent='Choose app'; switcher.append(placeholder);
            for (const [id,title] of options) { const option=document.createElement('option'); option.value=id; option.textContent=title; switcher.append(option); }
            switcher.dataset.signature=signature;
        }
        switcher.disabled=!options.length; switcher.value=showHome ? '' : focused()?.[0] || '';
    }
    homeButton.onclick=()=>{showHome=true;render();};
    switcher.onchange=()=>{if(switcher.value)manager.focus(switcher.value,true);};
    const onFocus=()=>{showHome=false;render();};
    const onChange=()=>{
        if(!focused())showHome=true;
        render();
        if(media.matches && showHome && !workspace.hidden) homeButton.focus();
    };
    const viewport=environment.visualViewport;
    const onViewport=()=>{
        if (!media.matches) { root.style.removeProperty('--mobile-height');root.style.removeProperty('--mobile-top');return; }
        root.style.setProperty('--mobile-height',`${viewport?.height || environment.innerHeight}px`);
        root.style.setProperty('--mobile-top',`${viewport?.offsetTop || 0}px`);
    };
    const onMode=()=>{manager.mobile=media.matches;onViewport();render();for(const state of manager.windows.values())manager.place(state);};
    const observer=new MutationObserver(render); observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});
    manager.addEventListener('focus',onFocus); manager.addEventListener('change',onChange);
    media.addEventListener('change',onMode); standalone.addEventListener('change',render);
    viewport?.addEventListener('resize',onViewport);viewport?.addEventListener('scroll',onViewport);
    environment.addEventListener('resize',onViewport);
    onMode();
    return ()=>{observer.disconnect();manager.removeEventListener('focus',onFocus);manager.removeEventListener('change',onChange);media.removeEventListener('change',onMode);standalone.removeEventListener('change',render);viewport?.removeEventListener('resize',onViewport);viewport?.removeEventListener('scroll',onViewport);environment.removeEventListener('resize',onViewport);home.remove();bar.remove();};
}
