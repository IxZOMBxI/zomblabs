export const experimentStatuses = ['local-implementation','in-development','prototype','planned','public-release'];
export const experimentApps = ['radio','phone','zombnet','store','arcade','settings','explorer','social','updates'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value,max=20000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length<=100;
export function localReference(value) {
    return typeof value === 'string' && /^(?:assets|media|docs|js|tools|content)\/[A-Za-z0-9 _./()-]+$/.test(value) && !value.split('/').some(part=>!part || part==='.' || part==='..');
}
export function safeExternal(value) {
    try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password; } catch { return false; }
}
function requireValue(condition,message) { if (!condition) throw Error('Experiment catalog: '+message); }
export function validateExperimentCatalog(data) {
    requireValue(object(data) && data.version===1 && Array.isArray(data.projects) && Array.isArray(data.logs),'expected version 1 projects and logs');
    const projects=new Map(), logs=new Map();
    const base=(record,kind,map)=>{
        requireValue(object(record) && id(record.id) && !map.has(record.id),`invalid or duplicate ${kind} ID`);
        requireValue(text(record.title,160) && text(record.summary,1500) && experimentStatuses.includes(record.status),`${record.id}: title, summary and supported status required`);
        requireValue(['published','draft'].includes(record.visibility),`${record.id}: visibility required`);
        requireValue(Array.isArray(record.sources) && record.sources.length>0 && record.sources.every(source=>object(source) && text(source.label,160) && localReference(source.path)),`${record.id}: supporting sources required`);
        requireValue(Array.isArray(record.links) && record.links.every(link=>object(link) && text(link.label,160) && (link.type==='app' ? experimentApps.includes(link.appId) : link.type==='external' && safeExternal(link.url))),`${record.id}: invalid link`);
        requireValue(Array.isArray(record.media) && record.media.every(media=>object(media) && ['image','video'].includes(media.type) && localReference(media.src) && /^(assets|media)\//.test(media.src) && (media.type==='image' ? /\.(png|jpe?g|webp|gif|svg)$/i : /\.(mp4|webm|ogg)$/i).test(media.src) && text(media.alt,300) && text(media.caption,500)),`${record.id}: invalid media`);
        requireValue(Array.isArray(record.relatedProjects) && record.relatedProjects.every(id),`${record.id}: invalid related projects`);
        map.set(record.id,record);
    };
    for (const project of data.projects) {
        base(project,'project',projects);
        requireValue(text(project.category,80) && text(project.description) && Array.isArray(project.logIds) && project.logIds.every(id) && new Set(project.logIds).size===project.logIds.length,`${project.id}: project metadata required`);
    }
    for (const log of data.logs) {
        base(log,'log',logs);
        requireValue(id(log.projectId) && projects.has(log.projectId),`${log.id}: missing parent project`);
        requireValue(log.date===null || (typeof log.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(log.date) && Number.isFinite(Date.parse(log.date)) && new Date(log.date).toISOString().slice(0,10)===log.date && log.sources.some(source=>source.path===log.dateSource)),`${log.id}: invalid or unsupported date`);
        requireValue(Array.isArray(log.article) && log.article.length>0 && log.article.every(block=>object(block) && (['paragraph','heading'].includes(block.type) ? text(block.text) : block.type==='list' && Array.isArray(block.items) && block.items.length>0 && block.items.every(item=>text(item)))),`${log.id}: article blocks must be plain text`);
        requireValue(projects.get(log.projectId).logIds.includes(log.id),`${log.id}: absent from parent logIds`);
        requireValue(log.visibility!=='published' || projects.get(log.projectId).visibility==='published',`${log.id}: public log has draft parent`);
    }
    for (const project of projects.values()) for (const logId of project.logIds) requireValue(logs.has(logId) && logs.get(logId).projectId===project.id,`${project.id}: broken log reference`);
    for (const record of [...projects.values(),...logs.values()]) for (const related of record.relatedProjects) requireValue(projects.has(related),`${record.id}: broken related project`);
    return data;
}
export function publishedExperiments(data) {
    return {...data,projects:data.projects.filter(p=>p.visibility==='published'),logs:data.logs.filter(l=>l.visibility==='published')};
}
export function orderedLogs(logs) {
    return [...logs].sort((a,b)=>a.date && b.date ? b.date.localeCompare(a.date) || a.id.localeCompare(b.id) : a.date ? -1 : b.date ? 1 : a.id.localeCompare(b.id));
}
export function searchProjects(data,query='',category='') {
    const term=query.trim().toLowerCase();
    return data.projects.filter(project=>(!category || project.category===category) && [project.title,project.summary,project.description,project.category,...data.logs.filter(log=>log.projectId===project.id).flatMap(log=>[log.title,log.summary,...log.article.flatMap(block=>block.type==='list'?block.items:[block.text])])].join(' ').toLowerCase().includes(term));
}
export async function loadExperimentCatalog({signal}={}) {
    const response=await fetch(new URL('../content/experiments.json',import.meta.url),{cache:'no-cache',signal});
    if (!response.ok) throw Error('Archive file unavailable. Check the connection or deployment files; local storage does not need resetting.');
    return publishedExperiments(validateExperimentCatalog(await response.json()));
}
export function experimentRoute(hash) {
    const match=/^#experiments\/(project|log)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(hash);
    return match ? {kind:match[1],id:match[2]} : hash==='#experiments' || !hash.startsWith('#experiments') ? {kind:'archive'} : {kind:'missing'};
}
