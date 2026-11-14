import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateCalendar} from '../js/calendar-catalog.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const data=validateCalendar(JSON.parse(readFileSync(resolve(root,process.argv[2] || 'content/calendar.json'),'utf8')));
console.log(`PASS Calendar: ${data.events.length} events, ${data.schedules.length} schedules, ${data.exceptions.length} exceptions.`);
