import {loadCalendar,calendarOccurrences,dateInZone} from './calendar-catalog.js';
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const day=86400000;
export function calendarApp(load=loadCalendar,{now=()=>Date.now(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}={}) {
 return {id:'calendar',title:'Calendar',width:680,height:600,minWidth:300,minHeight:300,
  mount(container) {
   container.classList.add('horde-calendar');
   let data,disposed=false,controller,view='month',selected=dateInZone(now(),timeZone),month=selected.slice(0,7),detail=null;
   const button=(label,action)=>{const b=node('button',label);b.type='button';b.onclick=action;return b;};
   const local=instant=>new Intl.DateTimeFormat(undefined,{timeZone,dateStyle:'full',timeStyle:'short'}).format(instant);
   const eventDate=event=>event.date || dateInZone(event.startMs,timeZone);
   const eventTime=event=>event.date?`${event.date} · Time TBA`:`${local(event.startMs)} · ${timeZone}`;
   function rows(events,parent) {
    if(!events.length){parent.append(node('p','No events announced for this date or range.'));return;}
    const list=node('ul',undefined,'calendar-events');
    for(const event of events){const li=node('li');li.dataset.status=event.status;li.append(button(event.title,()=>{detail=event;render();}),node('p',eventTime(event)),node('p',`${event.category} · ${event.status}`));list.append(li);}parent.append(list);
   }
   function render() {
    if(disposed || !data)return;
    container.replaceChildren();container.scrollTop=0;
    const header=node('header');header.append(node('p','ZOMB LABS // THE HORDE','calendar-eyebrow'),node('h1','CALENDAR'),node('p',`Read-only announcements · Times shown in ${timeZone}`));container.append(header);
    const nav=node('nav',undefined,'calendar-toolbar');nav.setAttribute('aria-label','Calendar views');
    for(const [key,label] of [['month','Monthly Calendar'],['upcoming','Upcoming Events']]){const b=button(label,()=>{view=key;detail=null;render();});b.setAttribute('aria-pressed',String(view===key));nav.append(b);}container.append(nav);
    if(detail) {
     const article=node('article',undefined,'calendar-detail');article.append(button('Back to '+(view==='month'?'month':'upcoming events'),()=>{detail=null;render();}),node('h2',detail.title),node('p',detail.description),node('p',`Category: ${detail.category}`),node('p',`Status: ${detail.status}`),node('p',eventTime(detail)));
     if(detail.endMs)article.append(node('p',`Ends: ${local(detail.endMs)} (${timeZone})`));
     if(!detail.date)article.append(node('p',`Source schedule: ${detail.start} (${detail.timeZone})`));
     if(detail.originalStart)article.append(node('p',`Rescheduled from: ${detail.originalStart} (${detail.timeZone})`));
     if(detail.platform)article.append(node('p',`Platform / venue: ${detail.platform}`));
     if(detail.url){const link=node('a','Open official event link');link.href=detail.url;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}container.append(article);return;
    }
    let generated;
    if(view==='upcoming') {
     generated=calendarOccurrences(data,now(),now()+90*day,{activeOnly:true,timeZone});container.append(node('h2','Upcoming · next 90 days'),node('p','Canceled occurrences are excluded here; browse their original dates in Monthly Calendar.'));rows(generated.events,container);
    } else {
     const [year,number]=month.split('-').map(Number),first=Date.UTC(year,number-1,1),next=Date.UTC(year,number,1);
     generated=calendarOccurrences(data,first-2*day,next+2*day,{timeZone});const events=generated.events.filter(event=>eventDate(event).startsWith(month));
     const toolbar=node('div',undefined,'calendar-toolbar');
     const move=delta=>{month=new Date(Date.UTC(year,number-1+delta,1)).toISOString().slice(0,7);selected=month+'-01';render();};
     toolbar.append(button('Previous month',()=>move(-1)),button('Today',()=>{selected=dateInZone(now(),timeZone);month=selected.slice(0,7);render();}),button('Next month',()=>move(1)));container.append(toolbar);
     const heading=node('h2',new Intl.DateTimeFormat(undefined,{timeZone:'UTC',month:'long',year:'numeric'}).format(first));heading.setAttribute('aria-live','polite');container.append(heading);
     container.append(node('p','L = Livestream · M = Music Release · E = other event. Canceled dates remain marked.','calendar-legend'));
     const grid=node('div',undefined,'calendar-month');grid.setAttribute('role','group');grid.setAttribute('aria-label','Choose a date');
     for(const weekday of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])grid.append(node('span',weekday,'calendar-weekday'));
     for(let i=0;i<new Date(first).getUTCDay();i++){const blank=node('span');blank.setAttribute('aria-hidden','true');grid.append(blank);}
     const today=dateInZone(now(),timeZone);
     for(let i=1;i<=new Date(next-day).getUTCDate();i++) {
      const key=month+'-'+String(i).padStart(2,'0'),matches=events.filter(event=>eventDate(event)===key);
      const b=button(String(i),()=>{selected=key;render();container.querySelector('.calendar-day-events')?.scrollIntoView({block:'nearest'});});b.dataset.date=key;b.setAttribute('aria-pressed',String(selected===key));b.setAttribute('aria-label',`${key}: ${matches.length} event${matches.length===1?'':'s'}`);if(key===today)b.setAttribute('aria-current','date');
      if(matches.length){b.classList.add('has-events');b.append(node('small',[...new Set(matches.map(event=>event.category==='Livestream'?'L':event.category==='Music Release'?'M':'E'))].join(' ')));}
      grid.append(b);
     }
     container.append(grid);const list=node('section',undefined,'calendar-day-events');list.append(node('h3',`Events on ${selected}`));rows(events.filter(event=>eventDate(event)===selected),list);container.append(list);
    }
    if(generated.warnings.length){const warning=node('p',generated.warnings.join(' '),'calendar-warning');warning.setAttribute('role','status');container.append(warning);}
   }
   async function start() {
    controller?.abort();controller=new AbortController();container.replaceChildren(node('p','Loading The Horde schedule…'));
    try {data=await load({signal:controller.signal});if(!disposed)render();}
    catch(error){if(disposed || error.name==='AbortError')return;container.replaceChildren(node('h1','CALENDAR'),node('p','Calendar unavailable: '+error.message),button('Retry',start));}
   }
   start();return ()=>{disposed=true;controller?.abort();};
  }
 };
}
