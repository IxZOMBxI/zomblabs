import {readFileSync,existsSync,realpathSync,statSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateExperimentCatalog} from '../js/experiment-catalog.js';
const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
export function validateLocalReferences(data,base=root) {
    for(const record of [...data.projects,...data.logs]) for(const path of [...record.sources.map(source=>source.path),...record.media.map(media=>media.src)]) {
        const file=resolve(base,path);
        if(!existsSync(file) || !realpathSync(file).startsWith(realpathSync(base)+sep) || !statSync(file).isFile()) throw Error(`${record.id}: missing or unsafe local file ${path}`);
    }
    return data;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
    const data=validateLocalReferences(validateExperimentCatalog(JSON.parse(readFileSync(resolve(root,process.argv[2] || 'content/experiments.json'),'utf8'))));
    console.log(`PASS Experiment Logs: ${data.projects.length} projects, ${data.logs.length} logs; schema, references and local files validated.`);
}
