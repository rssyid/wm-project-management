export type MasterListItem = {
  id: string;
  isActive: boolean;
  isComplete?: boolean;
  version?: number;
  [key: string]: unknown;
};

export type OptionItem = { id: string; name: string };

/** Ambil nilai berdasar path `company.name`, `defaultUnit.name`, `_count.spks`. */
export function pick(row: MasterListItem, source: string): unknown {
  return source.split(".").reduce<unknown>((value, key) => {
    if (value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}
