import { describe, expect, it } from 'vitest';
import { serviceOrder } from './services';

describe('serviceOrder', () => {
  it('puts Services in content order: by `order`, then by id', () => {
    const entry = (id: string, order: number) => ({ id, data: { order } });
    const sorted = serviceOrder([entry('ml', 4), entry('b', 2), entry('a', 2), entry('first', 1)]);
    expect(sorted.map((s) => s.id)).toEqual(['first', 'a', 'b', 'ml']);
  });
});
