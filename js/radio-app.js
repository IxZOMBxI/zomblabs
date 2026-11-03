import { protectArtwork } from './artwork-overlay.js';
const time = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
export function radioApp(service) {
    return {
        id: 'radio', title: 'Radio', width: 440, height: 620, minWidth: 300, minHeight: 420,
        mount(container) {
            container.classList.add('radio');
            container.innerHTML = `<div class="radio-heading">ZOMB LABS · RADIO / 01</div>
                <div class="radio-display"><div class="radio-cover"><span data-placeholder aria-hidden="true">ZL<br>FM</span><img data-art hidden alt="Recording artwork"></div>
                <div class="radio-now"><small>NOW PLAYING</small><strong data-track></strong><span data-artist></span><output data-time></output></div></div>
                <canvas data-spectrum width="320" height="40" aria-label="Live audio frequency spectrum"></canvas>
                <p data-status role="status"></p>
                <label class="radio-seek">Seek <input data-seek type="range" min="0" max="0" step="0.1" value="0"></label>
                <div class="radio-controls radio-transport"><button data-previous aria-label="Previous">|◀</button><button data-play aria-label="Play">▶</button><button data-pause aria-label="Pause">Ⅱ</button><button data-stop aria-label="Stop">■</button><button data-next aria-label="Next">▶|</button></div>
                <div class="radio-options"><label>Volume <input data-volume type="range" min="0" max="1" step="0.05" value="1"></label><button data-mute>Mute</button><button data-shuffle>Shuffle</button><button data-repeat>Repeat: off</button></div>
                <div class="radio-tabs" role="tablist" aria-label="Library section"><button data-tab="music" role="tab">Music</button><button data-tab="broadcasts" role="tab">Broadcasts</button></div>
                <div data-library role="tabpanel" aria-label="Music playlist"></div>`;
            const get = name => container.querySelector(`[data-${name}]`);
            for (const name of ['play','pause','stop','previous','next']) get(name).addEventListener('click', () => service[name]());
            for (const [name, method] of [['mute','toggleMute'],['shuffle','toggleShuffle'],['repeat','cycleRepeat']]) get(name).addEventListener('click', () => service[method]());
            get('seek').addEventListener('input', event => service.seek(Number(event.target.value)));
            get('volume').addEventListener('input', event => service.setVolume(Number(event.target.value)));
            let tracks = [];
            let catalog;
            let section = 'music';
            const tabs = [...container.querySelectorAll('[data-tab]')];
            function selectTab(tab) {
                section = tab.dataset.tab;
                renderLibrary();
                tracks.forEach(([button,index]) => button.setAttribute('aria-pressed', String(index === service.index)));
            }
            tabs.forEach((tab, index) => {
                tab.addEventListener('click', () => selectTab(tab));
                tab.addEventListener('keydown', event => {
                    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                    event.preventDefault(); const next = tabs[1 - index]; next.focus(); selectTab(next);
                });
            });
            function renderLibrary() {
            tracks = [];
            get('library').replaceChildren();
            tabs.forEach(tab => { tab.setAttribute('aria-selected', String(tab.dataset.tab === section)); tab.tabIndex = tab.dataset.tab === section ? 0 : -1; });
            get('library').setAttribute('aria-label', `${section} playlist`);
            {
                service.catalog.forEach((track, index) => {
                    if (track.section !== section) return;
                    const button = document.createElement('button'); button.textContent = track.title;
                    button.addEventListener('click', () => service.select(index, !service.audio.paused));
                    get('library').append(button); tracks.push([button,index]);
                });
            }
            }
            let artwork;
            let artworkTrack;
            function showArtwork(url, title) {
                // Each request owns its image; late events cannot hide a newer cover.
                const image = document.createElement('img');
                image.dataset.art = '';
                image.alt = title ? `${title} cover artwork` : 'Recording artwork';
                image.hidden = true;
                get('art').replaceWith(image);
                get('placeholder').hidden = false;
                const ready = () => {
                    if (get('art') !== image) return;
                    image.hidden = !(image.naturalWidth > 0);
                    get('placeholder').hidden = !image.hidden;
                };
                image.addEventListener('load', ready);
                image.addEventListener('error', () => {
                    if (get('art') !== image) return;
                    image.hidden = true; get('placeholder').hidden = false;
                });
                if (url) { image.src = url; if (image.complete) ready(); }
            }
            const unsubscribe = service.subscribe(() => {
                if (catalog !== service.catalog) { catalog = service.catalog; renderLibrary(); }
                const audio = service.audio, track = service.track;
                get('track').textContent = track?.title || 'No recordings available';
                get('artist').textContent = track?.artist || '';
                get('track').title = [track?.title, track?.album, track?.description].filter(Boolean).join(' / ');
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
                if (artwork !== track?.artwork || artworkTrack !== track?.id) {
                    artwork = track?.artwork; artworkTrack = track?.id;
                    showArtwork(artwork, track?.title);
                }
            });
            const canvas = get('spectrum');
            const context = canvas.getContext('2d');
            const bins = new Uint8Array(128);
            let frame;
            const unprotectArtwork = protectArtwork(container, () => get('art'));
            function draw() {
                if (context && container.isConnected && !container.closest('[hidden]')) {
                    const palette = getComputedStyle(container);
                    context.fillStyle = palette.getPropertyValue('--spectrum-bg').trim(); context.fillRect(0, 0, 320, 40);
                    const analyzer = service.visualizationUnavailable ? null : service.analyzer;
                    bins.fill(0);
                    if (analyzer && !service.audio.paused) analyzer.getByteFrequencyData(bins);
                    context.fillStyle = palette.getPropertyValue('--spectrum-fg').trim();
                    for (let i = 0; i < 32; i++) {
                        const height = Math.max(1, Math.max(...bins.subarray(i * 4, i * 4 + 4)) / 255 * 38);
                        context.fillRect(i * 10, 40 - height, 7, height);
                    }
                    canvas.setAttribute('aria-label', analyzer ? 'Live audio frequency spectrum' : 'Spectrum unavailable until playback or unsupported by this browser');
                }
                frame = requestAnimationFrame(draw);
            }
            draw();
            return () => { unsubscribe(); cancelAnimationFrame(frame); unprotectArtwork(); };
        }
    };
}
