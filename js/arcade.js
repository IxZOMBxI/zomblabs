import { ArcadeScores } from './arcade-scores.js';
import { mountDeadSprint } from './dead-sprint.js';
let storage;
try { storage = window.localStorage; } catch { /* Scores can remain in memory. */ }
const scores = new ArcadeScores(storage);
export const arcadeGames = [{ id: 'dead-sprint', title: 'DEAD SPRINT', description: 'Be the zombie. Catch the runners. Keep your momentum.', mount: mountDeadSprint }];
export function mountArcade(container) {
    container.classList.add('arcade');
    let cleanup;
    function home() {
        cleanup?.(); cleanup = null; container.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='ZombNET Arcade';
        const intro=document.createElement('p');intro.textContent='One more run. Local scores. No accounts.';container.append(heading,intro);
        arcadeGames.filter(game=>!game.hidden && !game.unlock).forEach(game=>{
            const card=document.createElement('section');card.className='arcade-card';const title=document.createElement('h3');title.textContent=game.title;
            const text=document.createElement('p');text.textContent=game.description;const best=document.createElement('p');best.textContent=`Local best: ${scores.get(game.id)}`;
            const play=document.createElement('button');play.textContent='Play '+game.title;play.onclick=()=>{
                container.replaceChildren();const back=document.createElement('button');back.textContent='← Arcade';back.onclick=home;
                const area=document.createElement('section');area.className='arcade-game';container.append(back,area);cleanup=game.mount(area,scores);area.querySelector('canvas')?.focus({preventScroll:true});
            };card.append(title,text,best,play);container.append(card);
        });
    }
    home(); return ()=>{ cleanup?.(); container.classList.remove('arcade'); };
}
