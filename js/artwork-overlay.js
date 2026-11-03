// One overlay mask for all mounted media windows; no competing clipPath writers.
const viewers = new Set();
let frame;
function draw() {
    const scanlines = document.querySelector('.scanlines');
    const holes = [];
    for (const {container, image} of viewers) {
        const element = image();
        if (!element || element.hidden || !container.isConnected || container.closest('[hidden]')) continue;
        const bounds = element.getBoundingClientRect();
        let left = Math.max(0,bounds.left), top = Math.max(0,bounds.top), right = Math.min(innerWidth,bounds.right), bottom = Math.min(innerHeight,bounds.bottom);
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
            if (style.overflowX !== 'visible') { left = Math.max(left,box.left); right = Math.min(right,box.right); }
            if (style.overflowY !== 'visible') { top = Math.max(top,box.top); bottom = Math.min(bottom,box.bottom); }
        }
        if (right > left && bottom > top) holes.push(`${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px, 0 0`);
    }
    if (scanlines) scanlines.style.clipPath = holes.length ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${holes.join(', ')})` : '';
    if (viewers.size) frame = requestAnimationFrame(draw);
}
export function protectArtwork(container, image) {
    const viewer = {container,image}; viewers.add(viewer);
    if (viewers.size === 1) draw();
    return () => {
        viewers.delete(viewer);
        if (!viewers.size) { cancelAnimationFrame(frame); const overlay = document.querySelector('.scanlines'); if (overlay) overlay.style.clipPath = ''; }
    };
}
