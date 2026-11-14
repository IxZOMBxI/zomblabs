import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCalendar,calendarOccurrences,calendarInstant,dateInZone,loadCalendar} from '../js/calendar-catalog.js';
const empty=()=>({version:1,events:[],schedules:[],exceptions:[]});
const event=(patch={})=>({id:'test-event',title:'Test only',description:'Automated fixture, not an announcement.',category:'Special Event',start:'2026-03-10T19:00:00',timeZone:'America/Chicago',status:'scheduled',visibility:'published',...patch});
const schedule=(patch={})=>({id:'test-stream',title:'Test stream',description:'Automated fixture only.',weekdays:[2,4],time:'19:00:00',durationMinutes:60,timeZone:'America/Chicago',startDate:'2026-03-01',endDate:'2026-03-31',visibility:'published',...patch});
const exception=(patch={})=>({id:'test-exception',scheduleId:'test-stream',originalDate:'2026-03-10',status:'canceled',visibility:'published',...patch});
const range=(data,from='2026-03-01',to='2026-04-01T06:00:00Z',options)=>calendarOccurrences(validateCalendar(data),Date.parse(from),Date.parse(to),options);
test('published announcement has one date-only record with no invented timing or URL',()=>{
 const data=validateCalendar(JSON.parse(readFileSync(new URL('../content/calendar.json',import.meta.url),'utf8')));
 assert.equal(data.events.length,1);const e=data.events[0];assert.equal(e.title,'GTA VI — First Kick Stream');assert.equal(e.date,'2026-11-19');assert.equal(e.visibility,'published');assert.equal(e.status,'scheduled');assert.equal(e.platform,'Kick');
 for(const field of ['start','end','timeZone','url'])assert.equal(field in e,false);
 assert.deepEqual(data.schedules,[]);assert.deepEqual(data.exceptions,[]);
 assert.deepEqual(range(empty()),{events:[],warnings:[]});
});
test('date-only events retain their date, have no instant, and remain upcoming on that date',()=>{
 const data=empty();const e=event({date:'2026-03-10'});delete e.start;delete e.timeZone;data.events=[e];
 for(const timeZone of ['America/Los_Angeles','Asia/Tokyo']) {
  const rows=range(data,'2026-03-10T10:00:00Z','2026-03-11T00:00:00Z',{activeOnly:true,timeZone}).events;
  assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-03-10');assert.equal(rows[0].startMs,null);assert.equal(rows[0].endMs,null);
 }
 assert.equal(range(data,'2026-03-11','2026-03-12').events.length,0);
 for(const patch of [{date:'2026-02-30'},{start:'2026-03-10T00:00:00'},{timeZone:'UTC'},{end:'2026-03-11T00:00:00'},{status:'rescheduled'}])assert.throws(()=>validateCalendar({...data,events:[{...e,...patch}]}));
 data.events=[{...e,visibility:'draft'}];assert.equal(range(data).events.length,0);
 data.events=[{...e,status:'canceled'}];assert.equal(range(data,'2026-03-01','2026-04-01',{activeOnly:true}).events.length,0);
 data.events=[e,event({id:'timed'})];assert.deepEqual(range(data,'2026-03-01','2026-04-01',{timeZone:'America/Chicago'}).events.map(e=>e.id),['timed','test-event']);
});
test('individual events, status, ends and browser-local calendar dates',()=>{
 const data=empty();data.events=[event({end:'2026-03-10T20:00:00',platform:'Test venue',url:'https://kick.com/zomblabs'})];const row=range(data).events[0];
 assert.equal(new Date(row.startMs).toISOString(),'2026-03-11T00:00:00.000Z');assert.equal(row.endMs-row.startMs,3600000);
 assert.equal(dateInZone(row.startMs,'America/Los_Angeles'),'2026-03-10');assert.equal(dateInZone(row.startMs,'Asia/Tokyo'),'2026-03-11');
});
test('weekly multi-day recurrence is bounded and source-local time survives DST',()=>{
 const data=empty();data.schedules=[schedule()];const rows=range(data).events;assert.equal(rows.length,9);
 assert.equal(new Date(rows[0].startMs).toISOString(),'2026-03-04T01:00:00.000Z');
 assert.equal(new Date(rows[2].startMs).toISOString(),'2026-03-11T00:00:00.000Z');
 assert.ok(rows.every(row=>row.start.endsWith('T19:00:00')));
 data.schedules[0]=schedule({startDate:'2026-03-10',endDate:'2026-03-12'});assert.equal(range(data).events.length,2);
 delete data.schedules[0].endDate;assert.ok(range(data).events.length<20);
 assert.throws(()=>calendarOccurrences(data,0,400*86400000),/366/);
});
test('fall DST preserves wall time; skipped and ambiguous weekly times warn without guessing',()=>{
 const data=empty();data.schedules=[schedule({weekdays:[0],time:'01:30:00',startDate:'2026-11-01',endDate:'2026-11-08'})];
 const ambiguous=range(data,'2026-11-01','2026-11-10');assert.equal(ambiguous.events.length,1);assert.equal(ambiguous.warnings.length,1);
 data.schedules=[schedule({weekdays:[0],time:'02:30:00',startDate:'2026-03-08',endDate:'2026-03-08'})];const skipped=range(data);assert.equal(skipped.events.length,0);assert.equal(skipped.warnings.length,1);
 assert.throws(()=>calendarInstant('2026-03-08T02:30:00','America/Chicago'));assert.throws(()=>calendarInstant('2026-11-01T01:30:00','America/Chicago'));
 data.schedules=[schedule({weekdays:[2],startDate:'2026-10-20',endDate:'2026-11-10'})];const rows=range(data,'2026-10-20','2026-11-12').events;
 assert.equal(new Date(rows[0].startMs).getUTCHours(),0);assert.equal(new Date(rows.at(-1).startMs).getUTCHours(),1);
});
test('cancel, update and cross-month reschedule replace original occurrence without duplicates',()=>{
 const data=empty();data.schedules=[schedule()];data.exceptions=[exception()];
 assert.equal(range(data).events.find(e=>e.occurrenceId.endsWith('2026-03-10')).status,'canceled');assert.equal(range(data,'2026-03-01','2026-04-01T06:00:00Z',{activeOnly:true}).events.length,8);
 data.exceptions=[exception({status:'rescheduled',start:'2026-04-02T20:00:00'})];assert.equal(range(data).events.length,8);
 const moved=range(data,'2026-04-01T05:00:00Z','2026-04-05').events;assert.equal(moved.length,1);assert.equal(moved[0].originalStart,'2026-03-10T19:00:00');assert.equal(new Set(moved.map(e=>e.occurrenceId)).size,1);
 data.exceptions=[exception({status:'updated',title:'Changed title'})];assert.equal(range(data).events.find(e=>e.occurrenceId.endsWith('2026-03-10')).title,'Changed title');
 data.events=[event({status:'canceled'})];assert.ok(range(data,'2026-03-01','2026-04-01T06:00:00Z',{activeOnly:true}).events.every(e=>e.status!=='canceled'));
 data.events=[event({status:'rescheduled',start:'2026-03-13T20:00:00',originalStart:'2026-03-10T19:00:00'})];assert.equal(range(data).events.filter(e=>e.occurrenceId==='event:test-event').length,1);
});
test('draft events, schedules and exceptions never change the public schedule',()=>{
 const data=empty();data.events=[event({visibility:'draft'})];data.schedules=[schedule({visibility:'draft'})];assert.equal(range(data).events.length,0);
 data.schedules=[schedule()];data.exceptions=[exception({visibility:'draft'})];assert.equal(range(data).events.length,9);assert.ok(range(data).events.every(e=>e.status==='scheduled'));
});
test('validator rejects malformed metadata, categories, dates, zones, ranges, URLs and exceptions',()=>{
 for(const patch of [{title:''},{description:null},{category:'Fake'},{status:'unknown'},{start:'2026-02-30T12:00:00'},{timeZone:'Mars/Orbit'},{end:'2026-01-01T12:00:00'},{url:'javascript:alert(1)'},{url:'https://user:secret@example.com'},{start:'2026-11-01T01:30:00'},{visibility:'hidden'}]){const d=empty();d.events=[event(patch)];assert.throws(()=>validateCalendar(d));}
 for(const patch of [{weekdays:[7]},{weekdays:[1,1]},{weekdays:[]},{time:'25:00:00'},{startDate:'2026-02-30'},{endDate:'2025-01-01'},{durationMinutes:0}]){const d=empty();d.schedules=[schedule(patch)];assert.throws(()=>validateCalendar(d));}
 for(const patch of [{scheduleId:'missing'},{originalDate:'2026-03-11'},{status:'rescheduled'},{start:'2026-03-10T18:00:00'},{originalDate:'2027-03-10'}]){const d=empty();d.schedules=[schedule()];d.exceptions=[exception(patch)];assert.throws(()=>validateCalendar(d));}
 const d=empty();d.events=[event(),event()];assert.throws(()=>validateCalendar(d));d.events=[];d.schedules=[schedule()];d.exceptions=[exception(),exception({id:'another'})];assert.throws(()=>validateCalendar(d));
 d.exceptions=[exception()];d.schedules[0].visibility='draft';assert.throws(()=>validateCalendar(d));
});
test('safe loading errors and no visitor mutation or HTML rendering APIs',async()=>{
 const original=globalThis.fetch;try {globalThis.fetch=async()=>({ok:false});await assert.rejects(loadCalendar(),/local data does not need resetting/);globalThis.fetch=async()=>({ok:true,json:async()=>({version:99})});await assert.rejects(loadCalendar());}finally{globalThis.fetch=original;}
 const code=readFileSync(new URL('../js/calendar-app.js',import.meta.url),'utf8');assert.doesNotMatch(code,/innerHTML|localStorage|\.setItem|Add Event|Add to Calendar/);
});
