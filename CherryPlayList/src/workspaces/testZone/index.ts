import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import { WorkspaceId } from '@core/types/workspace';

import { TestZoneView } from './TestZoneView';

// Register test zone modules for test1-test8
const testZoneTypes = ['test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7', 'test8'];

testZoneTypes.forEach((type) => {
  const TestZoneModule: IWorkspaceModule = {
    id: `${type}-placeholder` as WorkspaceId,
    type,
    name: `Test Zone ${type.slice(-1)}`,
    component: TestZoneView,
  };

  workspaceRegistry.register(TestZoneModule);
});

export { TestZoneView };
export default TestZoneView;
