import { recordZip } from '@/app/base/zip';
import { JollySelect, JollySelectProps, SelectItem } from '@/components/ui/select';
import { Key } from 'react-aria-components';

export function Select<T extends Key>(
  props: {
    label: string;
    labels: Record<T, string>;
    values: [T, ...T[]];
    value?: T;
    onChange: (v: T) => void;
    errorMessage?: string;
  } & Omit<
    JollySelectProps<{
      [V in T]: { id: T; name: string };
    }>,
    'children'
  >
) {
  return (
    <JollySelect
      selectedKey={props.value}
      label={props.label}
      onSelectionChange={(k: Key) => props.onChange(k as T)}
    >
      {recordZip(props.values, props.labels).map(([label, value]) => (
        <SelectItem key={value} id={value}>
          {label}
        </SelectItem>
      ))}
    </JollySelect>
  );
}
