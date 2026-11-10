import { MOBILE_QUERY } from './mobile-shell.js';
// Metadata only: no service worker, cache interception, install prompt or auto reload.
export function mountPwaChrome(environment = window, doc = document) {
    const mobile=environment.matchMedia(MOBILE_QUERY), root=doc.documentElement;
    const meta=doc.querySelector('meta[name="theme-color"]');
    function sync() {
        if (!mobile.matches || !meta) return;
        const color=environment.getComputedStyle(root).getPropertyValue('--ui-windowBackground').trim();
        if (/^#[0-9a-f]{6}$/i.test(color)) meta.content=color;
    }
    const observer=new environment.MutationObserver(sync);
    observer.observe(root,{attributes:true,attributeFilter:['style','data-theme']});
    mobile.addEventListener('change',sync); sync();
    return ()=>{observer.disconnect();mobile.removeEventListener('change',sync);};
}
