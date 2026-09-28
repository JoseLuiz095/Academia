-- Índices das chaves estrangeiras adicionadas no fluxo de aprovação.
create index if not exists workspace_requests_reviewed_by_idx
  on public.workspace_requests (reviewed_by);

create index if not exists workspaces_approved_by_idx
  on public.workspaces (approved_by);
