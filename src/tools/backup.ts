// v0.1b:
import type { ToolHandler } from '../shared/types.js';
import { ModelAwareBackupService } from '../shared/ModelAwareBackupService.js';
import { safeJsonParse } from '../shared/utils.js';

export function createBackupTools(mabs: ModelAwareBackupService): ToolHandler[] {
  return [
    {
      name: 'mabs_list_models',
      description: 'List all registered AI model profiles in the backup system',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const models = mabs.listModels();
        return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] };
      },
    },
    {
      name: 'mabs_set_current_model',
      description: 'Set the active model profile for subsequent snapshots',
      inputSchema: {
        type: 'object',
        properties: { profileId: { type: 'string' } },
        required: ['profileId'],
      },
      handler: async (args) => {
        const { profileId } = args as { profileId: string };
        mabs.setCurrentModel(profileId);
        return { content: [{ type: 'text', text: `Current model set to: ${profileId}` }] };
      },
    },
    {
      name: 'mabs_snapshot_artifact',
      description: 'Manually snapshot an artifact by hash (import into current model)',
      inputSchema: {
        type: 'object',
        properties: { hash: { type: 'string' }, message: { type: 'string' } },
        required: ['hash'],
      },
      handler: async (args) => {
        const { hash, message } = args as { hash: string; message?: string };
        const newHash = await mabs.importArtifact(hash, { message });
        return { content: [{ type: 'text', text: `Imported artifact as: ${newHash}` }] };
      },
    },
    {
      name: 'mabs_list_artifacts',
      description: 'List artifact snapshots for the current or a specific model',
      inputSchema: {
        type: 'object',
        properties: { profileId: { type: 'string' }, agnostic: { type: 'boolean' } },
      },
      handler: async (args) => {
        const { profileId, agnostic } = args as { profileId?: string; agnostic?: boolean };
        let artifacts;
        if (agnostic) {
          artifacts = await mabs.listAgnosticArtifacts();
        } else if (profileId) {
          artifacts = await mabs.listModelArtifacts(profileId);
        } else {
          const current = mabs.getCurrentModel();
          if (!current) return { content: [{ type: 'text', text: 'No current model set' }], isError: true };
          artifacts = await mabs.listModelArtifacts(current.id);
        }
        return { content: [{ type: 'text', text: JSON.stringify(artifacts, null, 2) }] };
      },
    },
    {
      name: 'mabs_artifact_history',
      description: 'Get version history for a specific artifact by ID',
      inputSchema: {
        type: 'object',
        properties: { artifactId: { type: 'string' } },
        required: ['artifactId'],
      },
      handler: async (args) => {
        const { artifactId } = args as { artifactId: string };
        const history = await mabs.getArtifactHistory(artifactId);
        return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
      },
    },
    {
      name: 'mabs_list_sessions',
      description: 'List session context snapshots',
      inputSchema: {
        type: 'object',
        properties: { profileId: { type: 'string' } },
      },
      handler: async (args) => {
        const { profileId } = args as { profileId?: string };
        const sessions = await mabs.getSessionHistory(profileId);
        return { content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }] };
      },
    },
    {
      name: 'mabs_can_replay',
      description: 'Check if a session can be replayed with a different model',
      inputSchema: {
        type: 'object',
        properties: { sessionId: { type: 'string' }, targetProfileId: { type: 'string' } },
        required: ['sessionId', 'targetProfileId'],
      },
      handler: async (args) => {
        const { sessionId, targetProfileId } = args as { sessionId: string; targetProfileId: string };
        const result = await mabs.canReplaySession(sessionId, targetProfileId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    },
    {
      name: 'mabs_export_backup',
      description: 'Export a full backup manifest for a model (or all models)',
      inputSchema: {
        type: 'object',
        properties: { profileId: { type: 'string' } },
      },
      handler: async (args) => {
        const { profileId } = args as { profileId?: string };
        const backup = await mabs.exportBackup(profileId);
        return { content: [{ type: 'text', text: JSON.stringify(backup, null, 2) }] };
      },
    },
    {
      name: 'mabs_import_backup',
      description: 'Import a backup manifest JSON string',
      inputSchema: {
        type: 'object',
        properties: { backupJson: { type: 'string' } },
        required: ['backupJson'],
      },
      handler: async (args) => {
        const { backupJson } = args as { backupJson: string };
        let backup: unknown;
        try {
          backup = safeJsonParse(backupJson);
        } catch {
          return { content: [{ type: 'text', text: 'Error: Invalid backup JSON' }], isError: true };
        }
        await mabs.importBackup(backup as Parameters<typeof mabs.importBackup>[0]);
        return { content: [{ type: 'text', text: 'Backup imported successfully' }] };
      },
    },
    {
      name: 'mabs_export_agnostic_bundle',
      description: 'Export a portable bundle of model-agnostic artifacts',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const bundle = await mabs.exportAgnosticBundle();
        return { content: [{ type: 'text', text: bundle }] };
      },
    },
    {
      name: 'mabs_import_agnostic_bundle',
      description: 'Import a portable bundle of model-agnostic artifacts',
      inputSchema: {
        type: 'object',
        properties: { bundleJson: { type: 'string' } },
        required: ['bundleJson'],
      },
      handler: async (args) => {
        const { bundleJson } = args as { bundleJson: string };
        let imported: number;
        try {
          imported = await mabs.importAgnosticBundle(bundleJson);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `Imported ${imported} artifacts` }] };
      },
    },
  ];
}
