import type {
  BoardAssemblyInput,
  BoardResponse,
  RegistryEntry,
} from '@agenticapps/dashboard-shared'

export type BoardProjectReference = Pick<RegistryEntry, 'id' | 'root'>

export declare function buildBoardSnapshot(
  input: BoardAssemblyInput,
  projects: readonly BoardProjectReference[],
): BoardResponse

export declare function createSyntheticBoardFixture(
  generatedAt: number,
  projects: readonly BoardProjectReference[],
): BoardResponse
