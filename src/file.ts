export interface File {
  filename: string;
  status: ChangeStatus;
}

export enum ChangeStatus {
  Added = 'added',
  Copied = 'copied',
  Deleted = 'deleted',
  Modified = 'modified',
  Renamed = 'renamed',
  Unmerged = 'unmerged'
}

export const statusMap: { [char: string]: ChangeStatus } = {
  A: ChangeStatus.Added,
  C: ChangeStatus.Copied,
  D: ChangeStatus.Deleted,
  M: ChangeStatus.Modified,
  R: ChangeStatus.Renamed,
  U: ChangeStatus.Unmerged
};
