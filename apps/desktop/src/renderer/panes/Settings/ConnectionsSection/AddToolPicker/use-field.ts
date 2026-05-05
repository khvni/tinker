import { useCallback, useState, type ChangeEvent } from 'react';

export const useField = (
  initial = '',
): [string, (e: ChangeEvent<HTMLInputElement>) => void, () => void] => {
  const [value, setValue] = useState(initial);
  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value), []);
  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, onChange, reset];
};
