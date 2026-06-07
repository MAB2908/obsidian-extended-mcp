// v0.2b:
import { spawn } from 'child_process';
import readline from 'readline';

const env = {
  ...process.env,
  ENABLE_EVAL: 'true',
  ENABLE_COMMANDS: 'true',
  ENABLE_BATCH_EDIT: 'true',
  SEMANTIC_ENABLED: 'false',
  DEFAULT_LLM_PROVIDER: 'none',
};

const proc = spawn('node', ['dist/index.js'], { env, stdio: ['pipe', 'pipe', 'inherit'] });
const rl = readline.createInterface({ input: proc.stdout });

let pending = new Map();
let id = 1;

rl.on('line', (line) => {
  console.log('LINE:', line.slice(0, 120));
  try {
    const j = JSON.parse(line);
    if (j.id != null && pending.has(j.id)) {
      pending.get(j.id)(j);
      pending.delete(j.id);
    }
  } catch {}
});

function send(req, expectResponse = true) {
  return new Promise((resolve, reject) => {
    const reqId = id++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id: reqId, ...req }) + '\n';
    console.log('SEND:', payload.slice(0, 120));
    if (!expectResponse) {
      proc.stdin.write(payload);
      resolve(null);
      return;
    }
    const t = setTimeout(() => { pending.delete(reqId); reject(new Error('timeout')); }, 20000);
    pending.set(reqId, (res) => { clearTimeout(t); resolve(res); });
    proc.stdin.write(payload);
  });
}

const valueMap = {
  path: 'concepts/attention-mechanism.md',
  from: 'concepts/attention-mechanism.md',
  to: 'concepts/neural-networks.md',
  content: '# t',
  query: 't',
  question: 't',
  code: '1+1',
  name: 't',
  action: 'read',
  file: 'concepts/attention-mechanism.md',
  target: 't',
  operation: 'replace',
  replacement: 'r',
  limit: 5,
  top_k: 5,
  sinceDays: 7,
  folder: '',
  direction: 'both',
  id: 't',
  hash: 'abc',
  artifactId: 't',
  sessionId: 't',
  profileId: 'd',
  backupJson: '{}',
  bundleJson: '{}',
  kinds: ['prune'],
  maxTokens: 100,
  dry_run: true,
  preview: true,
  soft: false,
  overwrite: false,
  includeContent: true,
  includeFrontmatter: true,
  searchContent: true,
  context: false,
  agnostic: false,
  prettyPrint: false,
  merge: true,
  mode: 'overwrite',
  page: 1,
  page_size: 20,
  per_page: 20,
  perPage: 20,
  offset: 0,
  recentCount: 5,
  hours: 24,
  enabled: true,
  portname: 'r1',
  port_type: 'bool',
  value: 'true',
  zone_id: 1,
  enable: true,
  sensor_ids: [],
  element_id: 1,
  command_id: 1,
  event_types: [],
  sub_issue_id: 1,
  after_id: 1,
  before_id: 1,
  replace_parent: false,
  duplicate_of: 1,
  milestone: 1,
  labels: [],
  assignees: [],
  reviewers: [],
  state: 'open',
  state_reason: 'completed',
  draft: false,
  maintainer_can_modify: true,
  merge_method: 'merge',
  commit_message: '',
  commit_title: '',
  expectedHeadSha: '',
  head: 'main',
  base: 'main',
  owner: 't',
  repo: 't',
  pullNumber: 1,
  issue_number: 1,
  commentId: 1,
  threadId: 't',
  side: 'RIGHT',
  startSide: 'RIGHT',
  line: 1,
  startLine: 1,
  subjectType: 'FILE',
  confirmPath: 't',
  confirmNewPath: 't',
  confirmOldPath: 't',
  oldPath: 't',
  newPath: 't',
  order_by: 'asc',
  sort: 'created_at',
  with_labels_details: false,
  include_descendants: false,
  include_ancestors: false,
  owned: false,
  min_access_level: 10,
  visibility: 'private',
  initialize_with_readme: false,
  allow_collaboration: false,
  remove_source_branch: false,
  merge_when_pipeline_succeeds: false,
  should_remove_source_branch: false,
  sha: '',
  message: 't',
  frontmatter: {},
  tags: [],
  ontology: [],
  variables: {},
  context: {},
  body: '',
  title: 't',
  description: 't',
  source_branch: 'main',
  target_branch: 'main',
  allow_conflicts: false,
  squash: false,
};

function genArgs(tool) {
  const s = tool.inputSchema || {};
  const p = s.properties || {};
  const r = s.required || [];
  const a = {};
  for (const k of r) {
    if (k === 'vaultPath') continue;
    if (valueMap[k] !== undefined) a[k] = valueMap[k];
    else if (p[k]?.type === 'boolean') a[k] = false;
    else if (p[k]?.type === 'number' || p[k]?.type === 'integer') a[k] = 0;
    else if (p[k]?.type === 'array') a[k] = [];
    else if (p[k]?.type === 'object') a[k] = {};
    else a[k] = 't';
  }
  return a;
}

await new Promise(r => setTimeout(r, 500));

console.log('Sending initialize...');
await send({ method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '1.0.0' } } });
console.log('Initialize done');

await send({ method: 'notifications/initialized' }, false);

console.log('Sending tools/list...');
const listRes = await send({ method: 'tools/list' });
console.log('tools/list done');

const tools = listRes.result?.tools || [];
console.log(`Testing ${tools.length} tools...\n`);

const results = [];
for (const tool of tools) {
  const args = genArgs(tool);
  try {
    const res = await send({ method: 'tools/call', params: { name: tool.name, arguments: args } });
    if (res.error) {
      results.push({ n: tool.name, s: 'RPC_ERROR', m: res.error.message });
    } else if (res.result?.isError) {
      const txt = res.result.content?.[0]?.text || '';
      results.push({ n: tool.name, s: 'TOOL_ERROR', m: txt.slice(0, 100) });
    } else {
      results.push({ n: tool.name, s: 'OK' });
    }
  } catch (err) {
    results.push({ n: tool.name, s: 'TIMEOUT', m: err.message });
  }
}

proc.kill();

const ok = results.filter(r => r.s === 'OK').length;
const te = results.filter(r => r.s === 'TOOL_ERROR').length;
const re = results.filter(r => r.s === 'RPC_ERROR').length;
const to = results.filter(r => r.s === 'TIMEOUT').length;

console.log(`\nOK: ${ok}, ToolError: ${te}, RPCError: ${re}, Timeout: ${to}\n`);

const unexpected = results.filter(r => r.s === 'TIMEOUT' || r.s === 'RPC_ERROR' || (r.s === 'TOOL_ERROR' && !/disabled|unavailable|not enabled|not initialized|not found|no such|missing|requires explicit|model profile|rest api|pipeline not|cli unavailable|security blocked/i.test(r.m)));
if (unexpected.length) {
  console.log('Unexpected failures:');
  for (const r of unexpected) console.log(`  ${r.n}: ${r.s} — ${r.m}`);
} else {
  console.log('No unexpected failures.');
}

process.exit(unexpected.length ? 1 : 0);
