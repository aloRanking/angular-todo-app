import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private confirmSubject = new Subject<(result: boolean) => void>();
  private messageSubject = new Subject<string>();

  message$ = this.messageSubject.asObservable();
  confirm$ = this.confirmSubject.asObservable();

  confirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
      this.messageSubject.next(message);
      this.confirmSubject.next(resolve);
    });
  }
}
