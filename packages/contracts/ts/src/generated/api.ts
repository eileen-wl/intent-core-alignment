// GENERATED FILE — DO NOT HAND-EDIT.
//
// Bootstrap placeholder. The real content is produced by running:
//
//   uv run --project apps/api python -m intent_core_api.export_openapi > apps/api/openapi.json
//   pnpm --filter @intent-core/contracts generate
//
// which regenerates this file from apps/api's live OpenAPI document via
// openapi-typescript. This placeholder mirrors today's
// intent_core_contracts.api.production_context schemas by hand so that
// apps/web can typecheck before the toolchain has been run once.

export type RecordSource = "manual" | "ftrack";

export interface ProjectRead {
  id: string;
  name: string;
  source: RecordSource;
  created_at: string;
  updated_at: string;
}

export interface ShotRead {
  id: string;
  project_id: string;
  name: string;
  source: RecordSource;
  created_at: string;
  updated_at: string;
}

export interface TaskRead {
  id: string;
  shot_id: string;
  name: string;
  department: string | null;
  source: RecordSource;
  created_at: string;
  updated_at: string;
}
