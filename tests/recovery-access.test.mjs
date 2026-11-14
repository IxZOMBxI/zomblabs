import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../js/recovery-access.js',import.meta.url),'utf8');
for (const status of ['healthy','empty','recovered','protected','unavailable']) {
    test(`startup recovery access: ${status}`,()=>{
        const button={}, notice={hidden:true,querySelector:()=>button}; let ready;
        const context=vm.createContext({document:{getElementById:()=>notice,addEventListener:(event,callback)=>{assert.equal(event,'DOMContentLoaded');ready=callback;}},ZombStorage:{browserStorage:()=>null,inspect:()=>[{status}]}});
        vm.runInContext(code,context); assert.equal(notice.hidden,true); ready();
        assert.equal(notice.hidden,!['protected','unavailable'].includes(status));
        button.onclick(); assert.equal(notice.hidden,true);
    });
}
test('missing deployment script is not labelled a storage failure',()=>{
    const notice={hidden:true}; let ready;
    vm.runInNewContext(code,{document:{getElementById:()=>notice,addEventListener:(_,callback)=>{ready=callback;}}});
    ready(); assert.equal(notice.hidden,true);
});
