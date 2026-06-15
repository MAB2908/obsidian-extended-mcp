import http from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8787';
const TOKEN = 'testtoken1234567890123456789012345678';
let sessionId = '';
let requestId = 0;

function request(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const reqHeaders = {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...headers,
    };
    if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      `${BASE}${path}`,
      { method: body ? 'POST' : 'GET', headers: reqHeaders },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const sid = res.headers['mcp-session-id'];
          if (sid) sessionId = sid;
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function callTool(name, args) {
  return request('/mcp', {
    jsonrpc: '2.0',
    id: ++requestId,
    method: 'tools/call',
    params: { name, arguments: args },
  }, { 'mcp-session-id': sessionId });
}

function assert(cond, msg) {
  if (cond) console.log(`  ✅ ${msg}`);
  else console.log(`  ❌ ${msg}`);
}

async function main() {
  console.log('=== Real-vault smoke tests ===\n');

  // Health
  console.log('1. Health check');
  const health = await request('/health');
  assert(health.status === 200 && health.body?.version === '0.3.4', 'health returns version 0.3.4');

  // Initialize
  console.log('\n2. MCP initialize');
  const init = await request('/mcp', {
    jsonrpc: '2.0',
    id: ++requestId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-runner', version: '1.0.0' },
    },
  });
  assert(init.status === 200 && !!sessionId, `session established: ${sessionId}`);

  // Tools list
  console.log('\n3. tools/list');
  const toolsList = await request('/mcp', { jsonrpc: '2.0', id: ++requestId, method: 'tools/list', params: {} }, { 'mcp-session-id': sessionId });
  const toolNames = toolsList.body?.result?.tools?.map((t) => t.name) || [];
  assert(toolNames.includes('read_note'), 'read_note is registered');
  assert(toolNames.includes('semantic_search_db'), 'semantic_search_db is registered');
  assert(toolNames.includes('audit_log'), 'audit_log is registered');
  assert(toolNames.includes('rest_get_note'), 'rest_get_note is registered');
  console.log(`   Total tools: ${toolNames.length}`);

  // Read note
  console.log('\n4. read_note');
  const read = await callTool('read_note', { path: 'index.md' });
  const readContent = read.body?.result?.content?.[0]?.text || '';
  assert(read.status === 200 && readContent.includes('Home'), 'read_note returns Home note content');

  // Search notes
  console.log('\n5. search_notes');
  const search = await callTool('search_notes', { query: 'artificial intelligence', limit: 10 });
  const searchContent = search.body?.result?.content?.[0]?.text || '';
  assert(searchContent.includes('AI Research'), 'search_notes finds AI Research');

  // Build index
  console.log('\n6. build_index');
  const build = await callTool('build_index', {});
  assert(build.status === 200, 'build_index succeeds');

  // Wait for indexer
  await new Promise((r) => setTimeout(r, 3000));

  // Semantic search DB
  console.log('\n7. semantic_search_db');
  const semSearch = await callTool('semantic_search_db', { query: 'machine learning', limit: 5 });
  const semContent = semSearch.body?.result?.content?.[0]?.text || '';
  assert(semContent.includes('Machine Learning') || semContent.includes('AI Research'), 'semantic_search_db returns relevant results');

  // Graph neighbors
  console.log('\n8. graph_neighbors');
  const graph = await callTool('graph_neighbors', { path: 'AI Research.md', direction: 'both' });
  const graphContent = graph.body?.result?.content?.[0]?.text || '';
  assert(graphContent.includes('Machine Learning') || graphContent.includes('Projects'), 'graph_neighbors shows linked notes');

  // Write note
  console.log('\n9. write_note');
  const write = await callTool('write_note', { path: 'New Note.md', content: '# New Note\n\nCreated by smoke test.\n' });
  assert(write.status === 200, 'write_note succeeds');
  assert(existsSync('test-real-vault/New Note.md'), 'New Note.md file exists on disk');

  // Patch note
  console.log('\n10. patch_note');
  const patch = await callTool('patch_note', { path: 'New Note.md', operation: 'append', target: 'end', replacement: '\nAppended line.\n' });
  assert(patch.status === 200, 'patch_note succeeds');
  await new Promise((r) => setTimeout(r, 500));
  const backupDirExists = existsSync('test-real-vault/.mcp-cache/backups/New Note.md');
  console.log(`    backup dir exists: ${backupDirExists}`);
  assert(backupDirExists, 'patch_note created backup dir');

  // Move note + backlink update
  console.log('\n11. move_note + backlink update');
  const move = await callTool('move_note', { from: 'New Note.md', to: 'renamed/New Note.md' });
  assert(move.status === 200, 'move_note succeeds');
  assert(!existsSync('test-real-vault/New Note.md'), 'old path removed');
  assert(existsSync('test-real-vault/renamed/New Note.md'), 'new path exists');

  // Audit log
  console.log('\n12. audit_log');
  const audit = await callTool('audit_log', { query: 'write_note', limit: 10 });
  assert(audit.status === 200, 'audit_log succeeds');

  // Soft delete
  console.log('\n13. delete_note (soft)');
  const del = await callTool('delete_note', { path: 'Web App.md', soft: true });
  assert(del.status === 200, 'delete_note succeeds');
  assert(!existsSync('test-real-vault/Web App.md'), 'Web App.md removed');
  assert(existsSync('test-real-vault/.trash/Web App.md'), 'Web App.md moved to .trash');

  // REST bridge (expected to fail without Local REST API plugin)
  console.log('\n14. rest_get_note (without plugin)');
  const rest = await callTool('rest_get_note', { path: 'index.md' });
  const restContent = rest.body?.result?.content?.[0]?.text || '';
  assert(rest.status === 200, 'rest_get_note is classified and callable');
  console.log(`    rest_get_note result: ${restContent.substring(0, 120)}`);

  console.log('\n=== Smoke tests completed ===');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
