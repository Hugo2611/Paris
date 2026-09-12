import { TestBed } from '@angular/core/testing';

import { SouvenirsService } from './souvenirs.service';

describe('SouvenirsService', () => {
  let service: SouvenirsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SouvenirsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
