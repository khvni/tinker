import { describe, expect, it } from 'vitest';
import { Model } from 'flexlayout-react';
import { createDefaultLayoutJson } from './layout.default.js';

describe('createDefaultLayoutJson', () => {
  it('returns a valid FlexLayout model JSON with a single chat tab', () => {
    const json = createDefaultLayoutJson();
    const model = Model.fromJson(json);

    const tabs: string[] = [];
    model.visitNodes((node) => {
      if (node.getType() === 'tab') {
        tabs.push(node.getId());
      }
    });

    expect(tabs).toHaveLength(1);
  });

  it('returns a fresh layout JSON each time with unique IDs', () => {
    const left = createDefaultLayoutJson();
    const right = createDefaultLayoutJson();

    const leftModel = Model.fromJson(left);
    const rightModel = Model.fromJson(right);

    const getFirstTabId = (model: Model): string | null => {
      let id: string | null = null;
      model.visitNodes((node) => {
        if (!id && node.getType() === 'tab') {
          id = node.getId();
        }
      });
      return id;
    };

    expect(getFirstTabId(leftModel)).not.toBe(getFirstTabId(rightModel));
  });
});
