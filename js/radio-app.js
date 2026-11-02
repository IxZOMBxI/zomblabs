const time = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
export function radioApp(service) {
    return {
        id: 'radio', title: 'RADIO.exe',
        mount(container) {
            container.classList.add('radio');
            container.innerHTML = `<p class="radio-heading">ZOMB LABS / SIGNAL RECEIVER</p>
                <p data-track></p><p data-artist></p><img data-art hidden alt="Recording artwork">
                <p data-status role="status"></p>
                <div class="radio-controls"><button data-play>Play</button><button data-pause>Pause</button><button data-previous>Previous</button><button data-next>Next</button></div>
                <label>Seek <input data-seek type="range" min="0" max="0" step="0.1" value="0"></label><output data-time></output>
                <label>Volume <input data-volume type="range" min="0" max="1" step="0.05" value="1"></label>
                <div class="radio-controls"><button data-mute>Mute</button><button data-shuffle>Shuffle</button><button data-repeat>Repeat: off</button></div>
                <p>Playback continues after closing this window.</p><div data-library></div>`;
            const get = name => container.querySelector(`[data-${name}]`);
            for (const name of ['play','pause','previous','next']) get(name).addEventListener('click', () => service[name]());
            for (const [name, method] of [['mute','toggleMute'],['shuffle','toggleShuffle'],['repeat','cycleRepeat']]) get(name).addEventListener('click', () => service[method]());
            get('seek').addEventListener('input', event => service.seek(Number(event.target.value)));
            get('volume').addEventListener('input', event => service.setVolume(Number(event.target.value)));
            let tracks = [];
            let catalog;
            function renderLibrary() {
            tracks = [];
            get('library').replaceChildren();
            for (const section of ['music','broadcasts']) {
                const heading = document.createElement('h3'); heading.textContent = section === 'music' ? 'MUSIC' : 'BROADCASTS'; get('library').append(heading);
                service.catalog.forEach((track, index) => {
                    if (track.section !== section) return;
                    const button = document.createElement('button'); button.textContent = track.title;
                    button.addEventListener('click', () => service.select(index, !service.audio.paused));
                    get('library').append(button); tracks.push([button,index]);
                });
            }
            }
            get('art').addEventListener('error', () => { get('art').hidden = true; });
            let artwork;
            return service.subscribe(() => {
                if (catalog !== service.catalog) { catalog = service.catalog; renderLibrary(); }
                const audio = service.audio, track = service.track;
                get('track').textContent = track?.title || 'No recordings available';
                get('artist').textContent = [track?.artist, track?.album, track?.description].filter(value => typeof value === 'string' && value).join(' / ');
                get('status').textContent = service.error || (service.loading ? 'ACQUIRING SIGNAL…' : audio.paused ? 'STANDBY' : 'TRANSMITTING');
                get('time').textContent = `${time(audio.currentTime)} / ${time(audio.duration || track?.duration)}`;
                get('seek').max = Number.isFinite(audio.duration) ? audio.duration : 0;
                get('seek').value = audio.currentTime;
                get('volume').value = audio.volume;
                get('mute').setAttribute('aria-pressed', String(audio.muted));
                get('mute').textContent = audio.muted ? 'Unmute' : 'Mute';
                get('shuffle').setAttribute('aria-pressed', String(service.shuffle));
                get('repeat').textContent = `Repeat: ${service.repeat}`;
                tracks.forEach(([button,index]) => button.setAttribute('aria-pressed', String(index === service.index)));
                if (artwork !== track?.artwork) {
                    artwork = track?.artwork; get('art').hidden = !artwork;
                    if (artwork) get('art').src = artwork;
                }
            });
        }
    };
}
