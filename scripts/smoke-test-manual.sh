#!/bin/bash
// v0.1b:
// v0.1b:
set -e

VAULT="tests/fixtures/extended-vault"
export VAULT_PATH="$VAULT"
export ENABLE_EVAL=true
export ENABLE_COMMANDS=true
export ENABLE_BATCH_EDIT=true
export SEMANTIC_ENABLED=false
export DEFAULT_LLM_PROVIDER=none

call_tool() {
  local name="$1"
  local args="$2"
  echo "--- Testing $name ---"
  local result
  result=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"'$name'","arguments":'$args'}}' | timeout 15 node dist/index.js 2>/dev/null | tail -1)
  if [ -z "$result" ]; then
    echo "TIMEOUT/EMPTY"
    return
  fi
  node -e "
    try {
      const r = JSON.parse(process.argv[1]);
      if (r.error) console.log('RPC_ERROR:', r.error.message);
      else if (r.result?.isError) console.log('TOOL_ERROR:', r.result.content?.[0]?.text?.slice(0,120));
      else console.log('OK:', r.result?.content?.[0]?.text?.slice(0,120) || 'OK');
    } catch(e) {
      console.log('PARSE_ERROR:', process.argv[1].slice(0,100));
    }
  " "$result"
}

echo "=== Filesystem Tools ==="
call_tool "read_note" '{"path":"concepts/api-design.md"}'
call_tool "list_directory" '{"path":""}'
call_tool "search_notes" '{"query":"API"}'
call_tool "get_vault_stats" '{}'
call_tool "list_all_tags" '{}'
call_tool "fs_list_notes" '{"folder":"concepts"}'
call_tool "fs_get_graph" '{}'
call_tool "fs_graph_find_path" '{"from":"concepts/api-design.md","to":"concepts/neural-networks.md"}'

echo "=== Semantic Tools ==="
call_tool "bm25_search" '{"query":"API"}'
call_tool "graph_neighbors" '{"path":"concepts/api-design.md"}'
call_tool "graph_analyze_centrality" '{}'
call_tool "graph_detect_communities" '{}'
call_tool "build_index" '{}'
call_tool "semantic_search_db" '{"query":"test"}'
call_tool "db_stats" '{}'

echo "=== AI Pipeline ==="
call_tool "ai_ingest" '{"path":"concepts/api-design.md"}'
call_tool "ai_query" '{"question":"What is API design?"}'
call_tool "ai_compile" '{"sinceDays":7}'

echo "=== CLI Tools ==="
call_tool "cli_backlinks" '{"path":"concepts/api-design.md"}'
call_tool "cli_eval" '{"code":"1+1"}'
call_tool "cli_command" '{"name":"app:reload"}'

echo "=== REST Tools ==="
call_tool "rest_active_note" '{}'
call_tool "rest_dataview" '{"query":"LIST FROM \"concepts\""}'

echo "=== Security & Backup ==="
call_tool "audit_log" '{"limit":5}'
call_tool "list_backups" '{}'
call_tool "batch_edit" '{"filter":{"folder":"concepts"},"operation":"replace","target":"API","replacement":"API","preview":true}'

echo "=== Pool ==="
call_tool "pool_list_vaults" '{}'

echo "=== Bootstrap ==="
call_tool "get_context_bootstrap" '{}'

echo "=== Dreaming ==="
call_tool "dream_scan" '{"kinds":["prune"]}'

echo "=== MABS ==="
call_tool "mabs_list_models" '{}'

echo "=== Dev System ==="
call_tool "dev_prompt_list" '{}'
call_tool "dev_skill_list" '{}'
call_tool "dev_agent_list" '{}'
call_tool "dev_workflow_list" '{}'
call_tool "dev_claude_md_get" '{}'

echo "=== All smoke tests completed ==="
