import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { TestZoneView } from './TestZoneView';

const testZoneTypes = ['test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7', 'test8'];

testZoneTypes.forEach((type) => {
  const TestZoneModule: IWorkspaceModule = {
    id: `${type}-placeholder`,
    type,
    name: `Test Zone ${type.slice(-1)}`,
    component: TestZoneView,
    minWidth: 150,
    minHeight: 100,
  };

  workspaceRegistry.register(TestZoneModule);
});

export { TestZoneView };
export default TestZoneView;
