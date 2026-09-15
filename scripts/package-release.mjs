import {mkdirSync,writeFileSync,mkdtempSync,cpSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const [version,image]=process.argv.slice(2);
if(!/^v\d+\.\d+\.\d+$/.test(version)||!/^ghcr\.io\/codeaix\/learning-portal@sha256:[a-f0-9]{64}$/.test(image))throw Error('用法：node scripts/package-release.mjs v1.0.0 ghcr.io/codeaix/learning-portal@sha256:...');
const stage=mkdtempSync(join(tmpdir(),'portal-release-'));const output=join('.local','release',version);mkdirSync(output,{recursive:true});
try{
 cpSync('scripts',join(stage,'scripts'),{recursive:true});cpSync('compose.yaml',join(stage,'compose.yaml'));cpSync('README.md',join(stage,'README.md'));
 const manifest={version,image,schema:1,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
 writeFileSync(join(stage,'release.json'),JSON.stringify(manifest,null,2)+'\n');
 const name=`learning-portal-${version}.tar.gz`;execFileSync('tar',['-czf',join(process.cwd(),output,name),'-C',stage,'.']);
 const sum=createHash('sha256').update(readFileSync(join(output,name))).digest('hex');writeFileSync(join(output,'SHA256SUMS'),`${sum}  ${name}\n`);
 cpSync('scripts/bootstrap.sh',join(output,'bootstrap.sh'));writeFileSync(join(output,'release.json'),JSON.stringify(manifest,null,2)+'\n');console.log(output);
}finally{rmSync(stage,{recursive:true,force:true});}
