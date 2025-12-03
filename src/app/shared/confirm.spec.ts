import { TestBed } from '@angular/core/testing';

import { Confirm } from './confirm';

describe('Confirm', () => {
  let service: Confirm;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Confirm);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
