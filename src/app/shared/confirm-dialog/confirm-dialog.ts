import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialog {
@Input() message = '';
  @Output() onConfirm = new EventEmitter<boolean>();

  confirm() {
    this.onConfirm.emit(true);
  }

  cancel() {
    this.onConfirm.emit(false);
  }
}
