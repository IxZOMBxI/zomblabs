import { scheduledInstant } from './phone-rules.js';
export const calendarCategories=['Livestream','Special Event','Music Release','Community Event','Other'];
export const calendarStatuses=['scheduled','canceled','rescheduled','updated'];
const day=86400000;
const text=(value,max=10000)=>typeof value==='string' && value.trim().length>0 && value.length<=max;
const id=value=>typeof value==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length<=100;
const assert=(condition,message)=>{if(!condition)throw Error('Calendar catalog: '+message);};
function keys(record,allowed) {assert(record && typeof record==='object' && !Array.isArray(record) && Object.keys(record).every(key=>allowed.includes(key)),'unknown fields or invalid record');}
export function validDate(value) {return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function zone(value){assert(text(value,100) && !/^[+-]/.test(value),'IANA time zone required');try {new Intl.DateTimeFormat('en',{timeZone:value}).format(0);}catch{throw Error('Calendar catalog: invalid IANA time zone');}}
export function calendarInstant(value,timeZone) {return scheduledInstant({at:value,timeZone});}
export function dateInZone(instant,timeZone) {const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
function url(value) {if(value==null)return;let parsed;try{parsed=new URL(value);}catch{}assert(typeof value==='string' && parsed?.protocol==='https:' && !parsed.username && !parsed.password,'official URL must be HTTPS without credentials');}
function base(record) {assert(text(record.title,200) && text(record.description),'title and description required');assert(['draft','published'].includes(record.visibility),'visibility must be draft or published');if(record.platform!=null)assert(text(record.platform,200),'invalid platform or venue');url(record.url);}
function span(start,end,timeZone) {const instant=calendarInstant(start,timeZone);if(end!=null)assert(calendarInstant(end,timeZone)>instant,'end must follow start');return instant;}
function occurrenceDate(schedule,date) {return validDate(date) && date>=schedule.startDate && (!schedule.endDate || date<=schedule.endDate) && schedule.weekdays.includes(new Date(date+'T00:00:00Z').getUTCDay());}
export function validateCalendar(data) {
 keys(data,['version','events','schedules','exceptions']);assert(data.version===1 && ['events','schedules','exceptions'].every(key=>Array.isArray(data[key])),'expected version 1 events, schedules and exceptions');
 const ids=new Set(),schedules=new Map(),exceptions=new Set();const unique=record=>{assert(id(record.id) && !ids.has(record.id),'invalid or duplicate ID');ids.add(record.id);};
 for(const event of data.events) {
  keys(event,['id','title','description','category','start','end','timeZone','platform','url','status','visibility','originalStart','date']);unique(event);base(event);
  assert(calendarCategories.includes(event.category) && calendarStatuses.includes(event.status),'invalid event category or status');
  if(event.date!==undefined) {
   assert(validDate(event.date),'invalid date-only event date');
   assert(['start','end','timeZone','originalStart'].every(key=>!(key in event)) && event.status!=='rescheduled','date-only events cannot include confirmed times or rescheduling metadata');
   continue;
  }
  zone(event.timeZone);span(event.start,event.end,event.timeZone);
  if(event.status==='rescheduled')calendarInstant(event.originalStart,event.timeZone);else assert(event.originalStart==null,'originalStart is only for rescheduled events');
 }
 for(const schedule of data.schedules) {
  keys(schedule,['id','title','description','weekdays','time','durationMinutes','timeZone','startDate','endDate','platform','url','visibility']);unique(schedule);base(schedule);zone(schedule.timeZone);
  assert(Array.isArray(schedule.weekdays) && schedule.weekdays.length>0 && schedule.weekdays.every(n=>Number.isInteger(n)&&n>=0&&n<=6) && new Set(schedule.weekdays).size===schedule.weekdays.length,'weekdays must be unique integers 0 (Sunday) through 6');
  assert(typeof schedule.time==='string' && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(schedule.time),'time must be HH:mm:ss');
  assert(validDate(schedule.startDate) && (schedule.endDate==null || validDate(schedule.endDate) && schedule.endDate>=schedule.startDate),'invalid recurrence date range');
  assert(schedule.durationMinutes==null || Number.isInteger(schedule.durationMinutes) && schedule.durationMinutes>0 && schedule.durationMinutes<=10080,'duration must be 1–10080 minutes');schedules.set(schedule.id,schedule);
 }
 for(const exception of data.exceptions) {
  keys(exception,['id','scheduleId','originalDate','status','visibility','start','end','title','description','category','platform','url']);unique(exception);
  const schedule=schedules.get(exception.scheduleId);assert(schedule && occurrenceDate(schedule,exception.originalDate),'exception must reference an original scheduled day within its range');
  const key=exception.scheduleId+':'+exception.originalDate;assert(!exceptions.has(key),'duplicate occurrence exception');exceptions.add(key);
  assert(['canceled','rescheduled','updated'].includes(exception.status) && ['draft','published'].includes(exception.visibility),'invalid exception status or visibility');
  assert(exception.visibility!=='published' || schedule.visibility==='published','published exception has draft schedule');
  for(const field of ['title','description','platform'])if(exception[field]!=null)assert(text(exception[field],field==='description'?10000:200),'invalid exception '+field);
  if(exception.category!=null)assert(calendarCategories.includes(exception.category),'invalid exception category');url(exception.url);
  if(exception.status==='rescheduled')span(exception.start,exception.end,schedule.timeZone);
  else {assert(exception.start==null,'only a rescheduled exception may change start');if(exception.end!=null)span(exception.originalDate+'T'+schedule.time,exception.end,schedule.timeZone);}
 }
 return data;
}
export function calendarOccurrences(data,from,to,{activeOnly=false,timeZone='UTC'}={}) {
 assert(Number.isFinite(from)&&Number.isFinite(to)&&to>from&&to-from<=366*day,'generation range must be positive and at most 366 days');
 const result=new Map(),warnings=[];
 const add=event=>{if((event.date ? event.date>=dateInZone(from,timeZone) && event.date<=dateInZone(to-1,timeZone) : event.startMs>=from && event.startMs<to) && (!activeOnly || event.status!=='canceled'))result.set(event.occurrenceId,event);};
 for(const event of data.events.filter(e=>e.visibility==='published'))add({...event,occurrenceId:'event:'+event.id,startMs:event.date?null:calendarInstant(event.start,event.timeZone),endMs:event.end?calendarInstant(event.end,event.timeZone):null});
 for(const schedule of data.schedules.filter(s=>s.visibility==='published')) {
  const overrides=new Map(data.exceptions.filter(e=>e.scheduleId===schedule.id && e.visibility==='published').map(e=>[e.originalDate,e]));
  const dates=new Set();
  // Source dates may fall on the preceding/following UTC day. Bound work to this view.
  for(let time=Math.floor(from/day)*day-2*day;time<to+2*day;time+=day){const date=new Date(time).toISOString().slice(0,10);if(occurrenceDate(schedule,date))dates.add(date);}
  // Moved events can originate outside the visible range; include each once at its new start.
  for(const [date,exception] of overrides)if(exception.status==='rescheduled')dates.add(date);
  for(const date of dates) {
   const exception=overrides.get(date),originalStart=date+'T'+schedule.time;
   const start=exception?.status==='rescheduled'?exception.start:originalStart;
   let startMs;try {startMs=calendarInstant(start,schedule.timeZone);}catch {warnings.push(`${schedule.title}: ${originalStart} (${schedule.timeZone}) is skipped or ambiguous at a daylight-saving transition; no occurrence generated.`);continue;}
   const event={...schedule,category:'Livestream',status:'scheduled',...exception,start,originalStart:exception?.status==='rescheduled'?originalStart:null,occurrenceId:`schedule:${schedule.id}:${date}`,startMs,endMs:exception?.end?calendarInstant(exception.end,schedule.timeZone):schedule.durationMinutes?startMs+schedule.durationMinutes*60000:null};
   add(event);
  }
 }
 return {events:[...result.values()].sort((a,b)=>(a.date || dateInZone(a.startMs,timeZone)).localeCompare(b.date || dateInZone(b.startMs,timeZone)) || (a.date && b.date?0:a.date?1:b.date?-1:a.startMs-b.startMs) || a.occurrenceId.localeCompare(b.occurrenceId)),warnings};
}
export async function loadCalendar({signal}={}) {
 const response=await fetch(new URL('../content/calendar.json',import.meta.url),{cache:'no-cache',signal});
 if(!response.ok)throw Error('Calendar file unavailable. Check the connection or deployment; local data does not need resetting.');
 return validateCalendar(await response.json());
}
