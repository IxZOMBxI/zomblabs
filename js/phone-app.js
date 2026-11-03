import { protectArtwork } from './artwork-overlay.js';
const time = value => `${Math.floor((value || 0)/60)}:${String(Math.floor((value || 0)%60)).padStart(2,'0')}`;
export function phoneApp(service) {
    return {id:'phone', title:'Phone', width:360, height:500, minWidth:280, minHeight:300,
        mount(container) {
            container.classList.add('phone');
            container.innerHTML = `<div class="phone-heading">PHONE</div>
                <p data-status role="status"></p><strong data-caller></strong><span data-extension></span>
                <div class="phone-art"><span data-icon aria-label="Caller">☎</span><img data-art hidden alt="Caller artwork"></div>
                <output data-time aria-label="Recording time"></output>
                <div class="phone-controls"><button data-answer class="phone-answer">Answer</button><button data-decline class="phone-end">Decline</button><button data-end class="phone-end">End Call</button><button data-resume>Resume</button><button data-pause>Pause</button><button data-stop>Stop Replay</button></div>
                <label data-seek-label>Seek <input data-seek type="range" min="0" max="0" step="0.1" value="0"></label>
                <p data-storage role="status"></p><h2>Call History</h2><p data-empty></p><ol data-history></ol>`;
            const get = name => container.querySelector(`[data-${name}]`);
            get('answer').onclick = () => service.answer(); get('decline').onclick = () => service.decline();
            get('end').onclick = () => service.end(); get('resume').onclick = () => service.play();
            get('pause').onclick = () => service.pause(); get('stop').onclick = () => service.stopReplay();
            get('seek').oninput = event => service.seek(Number(event.target.value));
            const unprotectArtwork = protectArtwork(container, () => get('art'));
            let artwork, historySignature;
            const unsubscribe = service.subscribe(() => {
                const call = service.current, mode = service.mode, playing = ['connected','replay'].includes(mode);
                get('status').textContent = service.error || (mode === 'ringing' ? 'Incoming Call' : playing ? `${mode === 'replay' ? 'Replay' : 'Connected'} · ${service.audio.paused ? 'Paused' : 'Playing'}` : service.ready ? 'Line idle' : 'Loading call service…');
                get('caller').textContent = call?.caller || '';
                get('extension').textContent = call?.extension ? `Extension ${call.extension}` : '';
                get('time').textContent = playing ? `${time(service.audio.currentTime)} / ${time(Number.isFinite(service.audio.duration) ? service.audio.duration : 0)}` : '';
                for (const name of ['answer','decline']) get(name).hidden = mode !== 'ringing';
                get('end').hidden = mode !== 'connected'; get('stop').hidden = mode !== 'replay';
                get('resume').hidden = !playing || !service.audio.paused; get('pause').hidden = !playing || service.audio.paused;
                // Live calls cannot be skipped to completion; seeking belongs to replay.
                get('seek-label').hidden = mode !== 'replay';
                get('seek').max = Number.isFinite(service.audio.duration) ? service.audio.duration : 0;
                get('seek').value = service.audio.currentTime || 0;
                const url = playing ? call?.artwork : null;
                if (artwork !== url) {
                    artwork = url;
                    const image = document.createElement('img'); image.dataset.art = ''; image.hidden = true;
                    image.alt = call ? `${call.caller} artwork` : 'Caller artwork';
                    get('art').replaceWith(image); get('icon').hidden = false;
                    image.onload = () => { if (get('art') === image) { image.hidden = false; get('icon').hidden = true; } };
                    image.onerror = () => { if (get('art') === image) { image.hidden = true; get('icon').hidden = false; } };
                    if (url) image.src = url;
                }
                get('storage').textContent = service.state.persistent ? '' : 'History is available for this visit; local storage is unavailable.';
                get('empty').textContent = service.state.history.length ? '' : service.catalog.length ? 'No calls encountered yet.' : 'No calls available. Call History will appear here after a call arrives.';
                const signature = JSON.stringify([service.state.history, [...service.state.delivery], service.mode, service.catalog.map(call => call.callId)]);
                if (signature === historySignature) return;
                historySignature = signature; get('history').replaceChildren();
                for (const row of [...service.state.history].reverse()) {
                    const item = document.createElement('li'), info = document.createElement('span');
                    info.textContent = `${row.caller}${row.extension ? ` · ${row.extension}` : ''} — ${row.status}${row.answered && row.status !== 'answered' ? ' (answered)' : ''} · ${new Date(row.at).toLocaleString()}`;
                    const replay = document.createElement('button');
                    const unlocked = service.state.get(row.callId).unlocked;
                    const available = service.catalog.some(call => call.callId === row.callId);
                    replay.textContent = !unlocked ? 'Locked' : available ? 'Replay' : 'Recording unavailable';
                    replay.disabled = !unlocked || !available || ['ringing','connected'].includes(mode);
                    replay.setAttribute('aria-label', `${replay.textContent}: ${row.caller}`);
                    replay.onclick = () => service.replay(row.callId);
                    item.append(info,replay); get('history').append(item);
                }
            });
            return () => { unsubscribe(); unprotectArtwork(); service.closeWindow(); };
        }
    };
}

export function mountPhoneNotice(service, launch) {
    const notice = document.createElement('aside'); notice.className = 'phone-notice'; notice.hidden = true;
    notice.setAttribute('aria-label','Incoming phone call');
    const status = document.createElement('p'); status.setAttribute('role','status');
    const answer = document.createElement('button'); answer.textContent = 'Answer'; answer.className = 'phone-answer';
    const decline = document.createElement('button'); decline.textContent = 'Decline'; decline.className = 'phone-end';
    answer.onclick = () => { service.answer(); launch('phone'); };
    decline.onclick = () => service.decline();
    notice.append(status,answer,decline); document.body.append(notice);
    const unsubscribe = service.subscribe(() => {
        notice.hidden = service.mode !== 'ringing';
        status.textContent = service.mode === 'ringing' ? `☎ Incoming Call — ${service.current.caller}${service.current.extension ? ` · Extension ${service.current.extension}` : ''}` : '';
    });
    return () => { unsubscribe(); notice.remove(); };
}
