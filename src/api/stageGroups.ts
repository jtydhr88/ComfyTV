import { apiFetch, apiSend } from './index'
import { ListStageGroupsSchema, MutateStageGroupSchema, OkSchema } from './schemas'
import type { StageGroup } from './schemas'

export async function listStageGroups(): Promise<StageGroup[]> {
  return (await apiFetch('/comfytv/stage_groups', ListStageGroupsSchema)).groups
}

export async function saveStageGroup(
  name: string,
  data: Record<string, unknown>,
  thumbnail: string | null,
): Promise<StageGroup> {
  return (await apiSend('/comfytv/stage_groups', 'POST', MutateStageGroupSchema, { name, data, thumbnail })).group
}

export async function renameStageGroup(id: number, name: string): Promise<StageGroup> {
  return (await apiSend(`/comfytv/stage_groups/${id}`, 'PATCH', MutateStageGroupSchema, { name })).group
}

export async function deleteStageGroup(id: number): Promise<void> {
  await apiSend(`/comfytv/stage_groups/${id}`, 'DELETE', OkSchema)
}
