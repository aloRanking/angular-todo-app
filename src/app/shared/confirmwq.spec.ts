import { TestBed } from '@angular/core/testing';

import { Confirmwq } from './confirmwq';

describe('Confirmwq', () => {
  let service: Confirmwq;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Confirmwq);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
