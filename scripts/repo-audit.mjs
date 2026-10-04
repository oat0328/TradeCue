import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const sourceRoots=["components","endpoints","helpers","pages"];
const extensions=[".ts",".tsx",".js",".jsx",".css",".json"];
const failures=[];

function walk(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}
function resolves(from,request){
  const base=path.resolve(path.dirname(from),request);
  if(fs.existsSync(base)&&fs.statSync(base).isFile())return true;
  for(const ext of extensions)if(fs.existsSync(base+ext))return true;
  for(const ext of extensions)if(fs.existsSync(path.join(base,"index"+ext)))return true;
  return false;
}

const files=sourceRoots.flatMap(dir=>walk(path.join(root,dir))).filter(file=>/\.(ts|tsx|js|jsx)$/.test(file));
for(const file of files){
  const text=fs.readFileSync(file,"utf8");
  for(const match of text.matchAll(/from\s+["'](\.[^"']+)["']/g)){
    const request=match[1];
    if(!resolves(file,request))failures.push("Missing relative import: "+path.relative(root,file)+" -> "+request);
  }
}

for(const file of walk(root)){
  const rel=path.relative(root,file);
  if(rel.startsWith(".git"+path.sep)||rel.startsWith("node_modules"+path.sep))continue;
  if(path.basename(file).startsWith(".env")&&path.basename(file)!==".env.example")failures.push("Environment secret file committed: "+rel);
  if(!/\.(ts|tsx|js|jsx|json|md|ya?ml|txt|example)$/.test(file))continue;
  const text=fs.readFileSync(file,"utf8");
  for(const pattern of [
    /sk_live_[A-Za-z0-9]{12,}/,
    /sk_test_[A-Za-z0-9]{12,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ]) if(pattern.test(text)) failures.push("Potential secret literal in "+rel);
}

if(failures.length){
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("TradeCUE repository audit passed: relative imports resolve and no obvious secret files/literals were found.");
