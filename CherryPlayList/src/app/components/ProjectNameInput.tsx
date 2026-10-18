import { useProjectStore } from '@shared/stores';
import { memo, useEffect, useState } from 'react';

interface ProjectNameInputProps {
  disabled: boolean;
  title: string;
  className?: string;
}

const ProjectNameInputComponent = ({
  disabled,
  title,
  className = 'project-name-input',
}: ProjectNameInputProps) => {
  const name = useProjectStore((state) => state.name);
  const setName = useProjectStore((state) => state.setName);
  const [isHydrated, setIsHydrated] = useState(() => useProjectStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useProjectStore.persist.onFinishHydration(() => setIsHydrated(true));
    if (useProjectStore.persist.hasHydrated()) setIsHydrated(true);
    return unsubscribe;
  }, []);

  const projectStoreLoading = !isHydrated;

  return (
    <input
      type="text"
      value={name}
      onChange={(event) => setName(event.target.value)}
      className={className}
      placeholder="Название проекта"
      disabled={disabled || projectStoreLoading}
      aria-label="Название проекта"
      aria-busy={projectStoreLoading}
      title={projectStoreLoading ? 'Загрузка проекта…' : title}
    />
  );
};

ProjectNameInputComponent.displayName = 'ProjectNameInputComponent';

export const ProjectNameInput = memo(ProjectNameInputComponent);
