import { apiSend } from './index'
import { SetItemTagsSchema } from './schemas'

export type TagTargetKind = 'entry' | 'preset' | 'stage_group' | 'resource'

export async function setItemTags(kind: TagTargetKind, id: number, categoryIds: number[]): Promise<number[]> {
  return (await apiSend(`/comfytv/tags/${kind}/${id}`, 'PUT', SetItemTagsSchema, { category_ids: categoryIds })).category_ids
}
