import { DeadSprint } from './dead-sprint-engine.js';
export function mountDeadSprint(container, scores) {
    const model = new DeadSprint();
    container.innerHTML = `<div class="sprint-hud" aria-live="off"></div><canvas class="sprint-canvas" width="640" height="260" tabindex="0" role="button" aria-label="Dead Sprint. Space or tap to start and accelerate. Escape pauses."></canvas><div class="sprint-controls"><button data-pause>Pause</button><button data-restart>Restart</button></div><p class="sprint-status" role="status">Space or tap to start. Keep a steady rhythm to catch runners.</p>`;
    const canvas = container.querySelector('canvas'), context = canvas.getContext('2d');
    const hud = container.querySelector('.sprint-hud'), status = container.querySelector('.sprint-status');
    let frame, last = performance.now(), held = false, lastTap = -Infinity, high = scores.get('dead-sprint'), previousScore = 0, previousMode = '', saved = true;
    if (!context) { status.textContent = 'Canvas is unavailable in this browser.'; container.querySelectorAll('button').forEach(button => { button.disabled = true; }); canvas.tabIndex = -1; return () => {}; }
    function input() { model.input(); }
    function keydown(event) {
        if (event.code === 'Space') { event.preventDefault(); if (!event.repeat && !held) { held = true; input(); } }
        if (event.key === 'Escape') { event.preventDefault(); model.pause(); }
    }
    function keyup(event) { if (event.code === 'Space') { held = false; event.preventDefault(); } }
    function pointer(event) {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault(); canvas.focus({preventScroll:true});
        const now = performance.now(); if (now - lastTap < 55) return; lastTap = now; input();
    }
    function blur() { held = false; model.pause(); }
    function visibility() { if (document.hidden) blur(); }
    canvas.addEventListener('keydown', keydown); canvas.addEventListener('keyup', keyup);
    canvas.addEventListener('pointerdown', pointer); canvas.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    const pause = container.querySelector('[data-pause]');
    let pauseWasRunning = false;
    pause.onpointerdown = () => { pauseWasRunning = model.mode === 'running'; };
    pause.onclick = () => { if (pauseWasRunning) { model.pause(); pauseWasRunning = false; return; } if (model.mode === 'paused') { canvas.focus(); model.input(); } else model.pause(); };
    container.querySelector('[data-restart]').onclick = () => { canvas.focus(); model.start(); };
    function character(x, zombie, time) {
        const stride = Math.sin(time * 15), y = 176 + Math.abs(stride) * 2;
        context.fillStyle = zombie ? '#8aff6a' : '#d2c0ef'; context.fillRect(x, y - 30, 15, 15);
        context.fillStyle = '#070b09'; context.fillRect(x + 10, y - 25, 3, 3);
        context.fillStyle = zombie ? '#486047' : '#8060ab'; context.fillRect(x + 2, y - 15, 12, 18);
        context.fillStyle = zombie ? '#8aff6a' : '#d2c0ef'; context.fillRect(x + 9, y - 12, zombie ? 18 : 12, 5);
        context.fillStyle = '#b3bca8'; context.fillRect(x + 2 + stride * 4, y + 3, 5, 16); context.fillRect(x + 10 - stride * 4, y + 3, 5, 16);
    }
    function draw() {
        context.fillStyle = '#0b1010'; context.fillRect(0,0,640,260);
        context.fillStyle = '#30263e';
        for (let i=0;i<12;i++) { const x=(i*70-model.elapsed*model.speed*2)%840; context.fillRect(x,108-(i%3)*17,35,85); }
        context.fillStyle = '#28352b'; context.fillRect(0,199,640,61);
        context.fillStyle = '#61745b';
        for(let i=0;i<20;i++){const x=((i*43-model.elapsed*model.speed*13)%860+860)%860;context.fillRect(x,211+(i%3)*13,9,2);}
        character(62,true,model.elapsed); character(90+Math.max(0,model.gap)*10,false,model.elapsed*1.13);
        context.font = 'bold 15px monospace'; context.fillStyle = '#caa1ff';
        if(model.capture>0)context.fillText('TAG! +10  Brain break!',100,140);
        if(model.mode!=='running'){
            context.fillStyle='rgba(4,8,6,.88)';context.fillRect(60,55,520,105);context.textAlign='center';context.fillStyle='#8aff6a';
            context.font='bold 26px monospace';context.fillText(model.mode==='over'?'THE SNACK ESCAPED':model.mode==='paused'?'PAUSED':'DEAD SPRINT',320,95);
            context.font='15px monospace';context.fillText(model.mode==='over'?`Score ${model.score} · Space / tap to restart`:model.mode==='paused'?'Space / tap to resume':'Space / tap to run. Keep tapping!',320,130);context.textAlign='left';
        }
    }
    function tick(now) {
        const inactive = document.hidden || container.closest('[hidden]') || !container.isConnected || !container.closest('.zomb-window')?.classList.contains('is-focused');
        if (inactive) model.pause();
        const delta = (now-last)/1000; last = now;
        if (!inactive) model.step(delta);
        if (model.score > previousScore) { previousScore = model.score; saved = scores.record('dead-sprint', model.score); high = scores.get('dead-sprint'); }
        if (model.score === 0) previousScore = 0;
        hud.textContent = `SCORE ${model.score}  /  BEST ${high}  ·  SPEED ${model.speed.toFixed(1)}  ·  GAP ${Math.ceil(model.gap)}m`;
        canvas.dataset.mode = model.mode; canvas.dataset.score = model.score;
        pause.textContent = model.mode === 'paused' ? 'Resume' : 'Pause'; pause.disabled = ['ready','over'].includes(model.mode);
        if (previousMode !== model.mode) { status.textContent = model.mode === 'over' ? `Game over. Score ${model.score}. Space or tap to restart.` : model.mode === 'paused' ? 'Paused. Space or tap to resume.' : model.mode === 'running' ? 'Tap steadily. Holding Space does not accelerate.' : 'Space or tap to start.'; previousMode = model.mode; }
        if (!saved) status.textContent = 'High score retained for this visit; browser storage is unavailable.';
        if (!inactive) draw();
        frame = requestAnimationFrame(tick);
    }
    draw(); frame = requestAnimationFrame(tick);
    return () => {
        cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility);
        canvas.removeEventListener('keydown',keydown); canvas.removeEventListener('keyup',keyup); canvas.removeEventListener('pointerdown',pointer); canvas.removeEventListener('blur',blur);
    };
}
