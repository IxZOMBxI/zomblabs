import { loadExperimentCatalog, experimentRoute, orderedLogs, searchProjects } from './experiment-catalog.js';
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const routeLink=(kind,id,title)=>{const a=node('a',title);a.href=kind==='archive'?'#experiments':`#experiments/${kind}/${id}`;return a;};
const statusLabel=value=>({'local-implementation':'Implemented locally · public release not verified','in-development':'In development',prototype:'Prototype',planned:'Planned','public-release':'Public release (see sources)'}[value]);
export function experimentApp(launch, load=loadExperimentCatalog) {
 return {id:'experiments',title:'Experiment Logs',width:720,height:600,minWidth:300,minHeight:280,
  mount(container) {
   container.classList.add('experiment-logs');
   let data,disposed=false,query='',category='',controller;
   const clear=()=>{for(const video of container.querySelectorAll('video')){video.pause();video.removeAttribute('src');video.load();}container.replaceChildren();};
   const button=(title,action)=>{const b=node('button',title);b.type='button';b.onclick=action;return b;};
   const header=()=>{const top=node('header');top.append(node('p','ZOMB LABS // RESEARCH ARCHIVE','experiment-eyebrow'),node('h1','EXPERIMENT LOGS'),node('p','Real projects and development records. Dates are shown only when supported by a source.'));container.append(top);};
   function extras(record,parent) {
    for(const item of record.media) {
     const figure=node('figure'),asset=node(item.type==='image'?'img':'video');asset.src=new URL('../'+item.src,import.meta.url).href;
     if(item.type==='image'){asset.alt=item.alt;asset.loading='lazy';asset.decoding='async';}
     else {asset.controls=true;asset.preload='none';asset.playsInline=true;asset.setAttribute('aria-label',item.alt);}
     asset.onerror=()=>asset.replaceWith(node('p','Media unavailable. The development record remains readable.'));
     figure.append(asset,node('figcaption',item.caption));parent.append(figure);
    }
    const links=node('div',undefined,'experiment-links');
    for(const link of record.links) {
     if(link.type==='app')links.append(button(link.label,()=>launch(link.appId)));
     else {const a=node('a',link.label);a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
    }
    parent.append(links);
    const related=record.relatedProjects.map(id=>data.projects.find(p=>p.id===id)).filter(Boolean);
    if(related.length){parent.append(node('h3','Related projects'));for(const project of related)parent.append(routeLink('project',project.id,project.title),node('br'));}
    const sources=node('details');sources.append(node('summary','Supporting repository sources'));
    const list=node('ul');for(const source of record.sources){const li=node('li'),a=node('a',source.label);a.href=new URL('../'+source.path,import.meta.url).href;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);}sources.append(list);parent.append(sources);
   }
   function timeline(logs,parent) {
    const list=node('ol',undefined,'experiment-timeline');
    for(const log of orderedLogs(logs)){const li=node('li');li.append(node('p',log.date || 'Undated · development date not verified'),routeLink('log',log.id,log.title),node('p',log.summary));list.append(li);}
    parent.append(logs.length?list:node('p','No published development entries yet.'));
   }
   function render() {
    if(disposed || !data)return;
    clear();header();container.scrollTop=0;const route=experimentRoute(location.hash);
    if(route.kind==='archive') {
     const controls=node('div',undefined,'experiment-filters'),input=node('input');input.type='search';input.value=query;input.placeholder='Search projects and updates';
     const label=node('label','Search ');label.append(input);const select=node('select'),catLabel=node('label','Category '),all=node('option','All categories');all.value='';select.append(all);
     for(const value of [...new Set(data.projects.map(p=>p.category))].sort()){const option=node('option',value);option.value=value;select.append(option);}select.value=category;catLabel.append(select);controls.append(label,catLabel);
     const result=node('p');result.setAttribute('role','status');const cards=node('div',undefined,'experiment-cards'),journal=node('section');
     const filter=()=>{
      query=input.value;category=select.value;const projects=searchProjects(data,query,category);
      result.textContent=`${projects.length} project${projects.length===1?'':'s'}`;cards.replaceChildren();journal.replaceChildren(node('h2','Development journal'));
      if(!projects.length)cards.append(node('p','No matching projects. Try another search or category.'));
      for(const project of projects){const card=node('article');card.append(node('p',project.category,'experiment-eyebrow'),node('h2',project.title),node('p',project.summary),node('p',statusLabel(project.status),'experiment-status'),routeLink('project',project.id,'View project'));cards.append(card);}
      timeline(data.logs.filter(log=>projects.some(project=>project.id===log.projectId)),journal);
     };
     input.oninput=filter;select.onchange=filter;container.append(controls,result,cards,journal);filter();return;
    }
    const record=(route.kind==='project'?data.projects:route.kind==='log'?data.logs:[]).find(row=>row.id===route.id);
    container.append(routeLink('archive',null,'← Archive'));
    if(!record){container.append(node('h2','Record not found'),node('p','This record is unavailable or has not been published in the archive.'));return;}
    const article=node('article',undefined,'experiment-detail');article.append(node('h2',record.title),node('p',statusLabel(record.status),'experiment-status'));
    if(route.kind==='project') {
     article.append(node('p',record.category),node('p',record.description));extras(record,article);article.append(node('h3','Development history · newest verified dates first'));timeline(data.logs.filter(log=>log.projectId===record.id),article);
    } else {
     const project=data.projects.find(p=>p.id===record.projectId);
     article.append(routeLink('project',project.id,'← '+project.title),node('p',record.date || 'Development date not verified'),node('p',record.summary));
     for(const block of record.article){if(block.type==='list'){const list=node('ul');for(const item of block.items)list.append(node('li',item));article.append(list);}else article.append(node(block.type==='heading'?'h3':'p',block.text));}
     extras(record,article);article.append(node('h3','More from this project'));timeline(data.logs.filter(log=>log.projectId===project.id && log.id!==record.id),article);
    }
    article.append(routeLink(route.kind,record.id,'Permanent link to this record'));container.append(article);
   }
   async function start() {
    controller?.abort();controller=new AbortController();clear();header();container.append(node('p','Loading research archive…'));
    try{data=await load({signal:controller.signal});if(!disposed)render();}
    catch(error){if(disposed || error.name==='AbortError')return;clear();header();container.append(node('p','The archive could not be loaded. '+error.message),button('Retry',start));}
   }
   window.addEventListener('hashchange',render);start();
   return ()=>{disposed=true;controller?.abort();window.removeEventListener('hashchange',render);clear();};
  }
 };
}
