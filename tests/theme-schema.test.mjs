import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const properties=new Map();const document={documentElement:{dataset:{},style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)}}};let saved=null;
const context=vm.createContext({window:{},document,localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v}});
const schemaCode=readFileSync(new URL('../js/theme-schema.js',import.meta.url),'utf8');const stateCode=readFileSync(new URL('../js/settings-state.js',import.meta.url),'utf8');
vm.runInContext(schemaCode,context);vm.runInContext(stateCode,context);
const schema=context.window.ZombThemeSchema,store=context.window.ZombSettings;
const theme={version:3,name:'Test',colors:schema.palette('amber')};assert.equal(schema.validate(theme).name,'Test');
for(const invalid of [{...theme,version:4},{...theme,extra:1},{...theme,colors:{...theme.colors,accent:'red'}},{...theme,colors:{accent:'#123456'}},{...theme,name:'x'.repeat(61)}])assert.throws(()=>schema.validate(invalid));
store.preview({theme:'custom',custom:theme});assert.equal(document.documentElement.dataset.theme,'custom');assert.equal(saved,null);store.cancelPreview();assert.equal(document.documentElement.dataset.theme,'toxic');store.apply({theme:'custom',custom:theme});assert.equal(JSON.parse(saved).custom.name,'Test');store.apply({showHiddenFiles:true});assert.equal(store.get().theme,'custom');
vm.runInContext(stateCode,context);assert.equal(context.window.ZombSettings.get().theme,'custom');
saved='{"theme":"custom","custom":{"version":999}}';vm.runInContext(stateCode,context);assert.equal(context.window.ZombSettings.get().theme,'toxic');
console.log('PASS strict theme schema, preview/cancel, persistence, independent hidden preference, outdated fallback');

// A frozen pre-M12.3 export exercises the actual legacy format, not today's key list.
const legacy = JSON.parse(readFileSync(new URL('./fixtures/theme-v1.json', import.meta.url), 'utf8'));
const migrated = schema.validate(legacy);
assert.equal(migrated.version, 3);
assert.equal(migrated.name, legacy.name);
for (const [key, color] of Object.entries(legacy.colors)) assert.equal(migrated.colors[key], color);
assert.equal(migrated.colors.trayBackground, legacy.colors.taskbar);
assert.equal(migrated.colors.taskbarButtonActiveText, legacy.colors.selectionText);
assert.equal(migrated.colors.desktopSelectionBackground, legacy.colors.hoverBackground);
assert.equal(Object.keys(legacy.colors).length < schema.keys.length, true);
assert.equal(Object.hasOwn(legacy.colors, 'trayBackground'), false);
for (const invalid of [
    {...legacy, colors:{...legacy.colors, trayBackground:'#123456'}},
    {...legacy, colors:{...legacy.colors, accent:undefined}},
    {...migrated, colors:{...migrated.colors, clockText:undefined}},
    {...migrated, colors:{...migrated.colors, trayText:'red'}}
]) assert.throws(()=>schema.validate(invalid));
saved=JSON.stringify({theme:'custom', custom:legacy, showHiddenFiles:true, crtEffects:false});
vm.runInContext(stateCode,context);
const restored=context.window.ZombSettings;
assert.equal(restored.get().custom.version,3);
assert.equal(restored.get().custom.name,legacy.name);
assert.equal(restored.get().crtEffects,false);
assert.equal(restored.get().showHiddenFiles,true);
assert.equal(JSON.parse(saved).custom.version,1); // Reading/migrating never overwrites storage.
const distinctive={...migrated,colors:Object.fromEntries(schema.keys.map((key,i)=>[key,'#'+(0x123456+i*113).toString(16)]))};
restored.apply({custom:distinctive});
assert.deepEqual(JSON.parse(JSON.stringify(schema.validate(JSON.parse(JSON.stringify(distinctive))))),distinctive);
restored.apply({theme:'ice'});restored.apply({theme:'custom'});
assert.equal(restored.get().custom.colors.clockText,distinctive.colors.clockText);
assert.equal(properties.get('--ui-taskbarButtonFocus'),distinctive.colors.taskbarButtonFocus);
restored.preview({theme:'violet'});restored.cancelPreview();
assert.equal(restored.get().crtEffects,false);
vm.runInContext(stateCode,context);
assert.equal(context.window.ZombSettings.get().custom.colors.trayBackground,distinctive.colors.trayBackground);
context.localStorage.setItem=()=>{throw Error('Storage denied');};
assert.equal(context.window.ZombSettings.apply({crtEffects:true}),false);
assert.equal(context.window.ZombSettings.get().custom.colors.clockText,distinctive.colors.clockText);
console.log('PASS legacy migration, strict v3 validation, all-color JSON round trip, selection/reload, independent CRT and storage denial');

const v2 = JSON.parse(readFileSync(new URL('./fixtures/theme-v2.json', import.meta.url), 'utf8'));
const v3 = schema.validate(v2);
assert.equal(v3.version,3);
for(const [key,color] of Object.entries(v2.colors)) assert.equal(v3.colors[key],color);
assert.equal(v3.colors.storeBackground,v2.colors.windowBackground);
assert.equal(v3.colors.storeButtonText,v2.colors.buttonText);
assert.throws(()=>schema.validate({...v2,colors:{...v2.colors,storeText:'#123456'}}));
assert.throws(()=>schema.validate({...v3,colors:{...v3.colors,storeText:undefined}}));
console.log('PASS v2 Store migration preserves all custom colors and strict schema');
