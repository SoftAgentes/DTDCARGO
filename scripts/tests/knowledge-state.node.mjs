import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { documentTopic, publicationProblems, collectDocuments, repositoryState, snapshotKey, sha256 } from '../lib/knowledge-state.mjs';
import { parseArgs } from '../knowledge-sync.mjs';

const policy=JSON.parse(fs.readFileSync(fileURLToPath(new URL('../knowledge-policy.json',import.meta.url))));
const repo={isMain:true,dirty:[],sourcePaths:['README.md'],revision:'a'.repeat(40),branch:'main',mainRevision:'a'.repeat(40),remoteRevision:'a'.repeat(40)};
const graph={version:'0.9.61',structural:{status:'CURRENT'},semantic:{status:'CURRENT'},issues:[],files:{'README.md':{}},corpusHash:'corpus',graphHash:'graph'};

test('shared publication requires integrated main, no dirty or untracked sources and every evidence layer',()=>{
 assert.deepEqual(publicationProblems(repo,graph,policy),[]);
 for(const [changed, expected] of [[{...repo,isMain:false},'MAIN_REQUIRED'],[{...repo,dirty:['README.md']},'DIRTY_SOURCE']]){
  assert.ok(publicationProblems(changed,graph,policy).some(p=>p.startsWith(expected)));
 }
 for(const [patch, expected] of [[{version:'0.9.62'},'VERSION_MISMATCH'],[{semantic:{status:'PENDING'}},'SEMANTIC_PENDING'],[{structural:{status:'INVALID'}},'STRUCTURAL_PENDING'],[{issues:[{code:'dangling_edges'}]},'GRAPH_ISSUES'],[{files:{'new.md':{}}},'UNTRACKED_SOURCE']]){
  assert.ok(publicationProblems(repo,{...graph,...patch},policy).some(p=>p.startsWith(expected)));
 }
});
test('document selection cannot export a sensitive subtree, personal vault, binary or traversal',()=>{
 for(const p of ['docs/legal/contract.md','docs/archive/transcript.md','docs/design/test.md','DTD Cargo/personal.md','docs/architecture/a.pdf','../README.md','docs\\runbooks\\a.md','/README.md','other.md']) assert.equal(documentTopic(p,policy),null,p);
 assert.equal(documentTopic('docs/governance/README.md',policy),'gobernanza');
 assert.equal(documentTopic('.agents/handoffs/task.md',policy),'handoffs');
 assert.equal(documentTopic('docs/engineering/rules.md',policy),'ingenieria');
 assert.equal(new Set(policy.topics.map(t=>t.id)).size,8);
});
test('full-byte document collection rejects a source changed between inspect and export',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-state-'));
 try {
  const raw='---\nstatus: approved\n---\n# Decision\n';
  fs.writeFileSync(path.join(root,'README.md'),raw);
  const files={'README.md':{sha256:sha256(raw)}};
  assert.equal(collectDocuments(root,files,policy)[0].content,raw);
  fs.writeFileSync(path.join(root,'README.md'),raw.replace('approved','proposed'));
  assert.throws(()=>collectDocuments(root,files,policy),/cambió/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('a worktree cannot redirect shared publication and changed refs invalidate a snapshot',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-repo-'));
 const main=path.join(base,'main'), worker=path.join(base,'worker');
 fs.mkdirSync(main);
 const git=(...args)=>execFileSync('git',['-C',main,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
  fs.writeFileSync(path.join(main,'README.md'),'test\n');git('add','README.md');git('commit','-m','fixture');
  git('remote','add','origin','https://github.com/example/fixture.git');git('update-ref','refs/remotes/origin/main','HEAD');
  assert.equal(repositoryState(main).isMain,true);
  git('worktree','add','-b','codex/test',worker);
  assert.equal(repositoryState(worker).isMain,false);
  assert.equal(fs.realpathSync.native(repositoryState(worker).mainRoot),fs.realpathSync.native(main));
  assert.notEqual(snapshotKey(repo,graph,'policy'),snapshotKey({...repo,remoteRevision:'b'.repeat(40)},graph,'policy'));
  assert.notEqual(snapshotKey(repo,graph,'policy'),snapshotKey(repo,{...graph,corpusHash:'changed'},'policy'));
 }finally{
  assert.ok(path.resolve(base).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(base,{recursive:true,force:true});
 }
});
test('CLI does not accept an arbitrary vault path or implicit publication mode',()=>{
 assert.deepEqual(parseArgs(['publish','--preview']).preview,true);
 assert.throws(()=>parseArgs(['publish','--vault','somewhere']),/desconocida/);
 assert.throws(()=>parseArgs(['publish','--root']),/Falta/);
 assert.equal(parseArgs([]).command,'status');
});
