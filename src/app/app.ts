import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from './todo.interface';
import { NgZone } from '@angular/core';
import { ConfirmService } from './shared/confirm';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';


// declare global {
//   interface Window {
//     invokeCSharpAction?: (arg: string) => void;
//     HybridWebView?: {
//       InvokeDotNet: (methodName: string, args?: any) => void;
//     };
//   }
// }
declare global {
  interface Window {
    // Declaring the object injected by the MAUI host
    HybridWebView?: {
      InvokeDotNet: (methodName: string, args?: any) => void;
      // You can add other functions from the bridge here if you use them,
      // but 'InvokeDotNet' is the essential outbound method.
    };
    // Declaring the function implemented by Angular that the C# host calls (inbound method)
    globalSetData: (items: any[]) => void;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialog],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent {
  todos: Todo[] = [];
  todoTitle: string = '';
  todoDescription: string = '';
  editingTodo: Todo | null = null;
  currentFilter: 'all' | 'pending' | 'completed' = 'all';
  nextId: number = 1;
  message: string | null = null;
  resolver: ((value: boolean) => void) | null = null;

  constructor(private ngZone: NgZone, private confirmService: ConfirmService) {
    this.hookGlobalSetData();
    this.confirmService.message$.subscribe(msg => this.message = msg);
    this.confirmService.confirm$.subscribe(res => this.resolver = res);
  }

  ngOnInit() {
    this.loadTodosFromDotNet();
  }

  handleConfirm(result: boolean) {
    if (this.resolver) {
      this.resolver(result);
    }
    this.message = null;
  }

  private waitForHybridBridge(): Promise<void> {
    return new Promise((resolve) => {
      // 🚨 CRITICAL FIX 2: Increase the check interval
      const interval = setInterval(() => {
        const isReady =
          typeof window !== 'undefined' &&
          typeof (window as any).invokeCSharpAction === 'function';

        if (isReady) {
          console.log('HybridWebView is fully ready');
          clearInterval(interval);
          resolve();
        } else {
          // This log should now be less frequent
          console.log('Waiting for HybridWebView...');
        }
      }, 250); // Check every 250ms (up from 100ms)
    });
  }

  loadTodosFromDotNet() {
    if (window.HybridWebView?.InvokeDotNet) {
      console.log('Requesting todos from .NET');
      window.HybridWebView.InvokeDotNet('GetTodoItems');
    } else {
      console.warn('HybridWebView.InvokeDotNet not available');
    }
  }

  hookGlobalSetData() {
    (window as any).globalSetData = (items: any[]) => {
      console.log('Received items from MAUI:', JSON.stringify(items, null, 2));

      // 3. CRITICAL FIX: Run inside Angular's Zone
      this.ngZone.run(() => {
        if (!Array.isArray(items)) return;

        this.todos = items.map((item) => ({
          id: item.id ?? 0,
          title: item.title ?? '',
          description: item.description ?? '',
          isCompleted: item.isCompleted ?? false,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        }));

        console.log('UI Updated with count:', this.todos.length);
        console.log('UI Updated with:', JSON.stringify(this.todos, null, 2));

        // Recalculate IDs
        const maxId =
          this.todos.length > 0 ? Math.max(...this.todos.map((t) => t.id)) : 0;
        this.nextId = maxId + 1;
      });
    };
  }

  // Create
  saveTodo() {
    if (!this.todoTitle.trim()) return;

    console.log('Saving todo:', this.todos.toString());

    if (this.editingTodo) {
      // Update existing todo
      this.editingTodo.title = this.todoTitle.trim();
      this.editingTodo.description = this.todoDescription.trim();
      if (window.HybridWebView?.InvokeDotNet) {
        const newTodoPascal = this.toPascalCaseKeys(this.editingTodo);
        console.log(
          'New todo Pascal addedwith invoke:',
          JSON.stringify(newTodoPascal, null, 2)
        );

        window.HybridWebView.InvokeDotNet('UpdateDesc', newTodoPascal);
      }
      this.editingTodo = null;
    } else {
      // Create new todo
      const newTodo: Todo = {
        id: this.nextId++,
        title: this.todoTitle.trim(),
        description: this.todoDescription.trim(),
        isCompleted: false,
        createdAt: new Date(),
      };
      this.todos.push(newTodo);
      console.log('New todo added locally:', JSON.stringify(newTodo, null, 2));

      if (window.HybridWebView?.InvokeDotNet) {
        const newTodoPascal = this.toPascalCaseKeys(newTodo);
        console.log(
          'New todo Pascal addedwith invoke:',
          JSON.stringify(newTodoPascal, null, 2)
        );

        window.HybridWebView.InvokeDotNet('AddTodo', newTodoPascal);

        console.log('Added todo:', newTodo);
      }
    }

    this.todoTitle = '';
    this.todoDescription = '';
   
  }

  toPascalCaseKeys(obj: any) {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        result[pascalKey] = obj[key];
      }
    }
    return result;
  }

  // Read
  getFilteredTodos(): Todo[] {
    switch (this.currentFilter) {
      case 'completed':
        return this.todos.filter((todo) => todo.isCompleted);
      case 'pending':
        return this.todos.filter((todo) => !todo.isCompleted);
      default:
        return this.todos;
    }
  }

  // Update
  editTodo(todo: Todo) {
    this.editingTodo = todo;
    this.todoTitle = todo.title;
    this.todoDescription = todo.description;
  }

  toggleComplete(todo: Todo) {
    todo.isCompleted = !todo.isCompleted;
    if (window.HybridWebView?.InvokeDotNet) {
       const newTodoPascal = this.toPascalCaseKeys(todo);
        console.log(
          'New todo Pascal addedwith invoke:',
          JSON.stringify(newTodoPascal, null, 2)
        );
      window.HybridWebView.InvokeDotNet('UpdateDesc', newTodoPascal);
      console.log('Updated todo:', newTodoPascal);
    }
  }

  // Delete
  async deleteTodo(id: number) {
    const ok = await this.confirmService.confirm(
    'Are you sure you want to delete this todos?'
  );

  if (!ok) {
    console.log("Cancelled.");
    return;
  }

    const todo = this.todos.find((t) => t.id === id);
    this.todos = this.todos.filter((t) => t.id !== id);

    if (todo && window.HybridWebView?.InvokeDotNet) {
      window.HybridWebView.InvokeDotNet('RemoveTodoById', id.toString());
    }
    
  }

  markAllComplete() {
    this.todos.forEach((todo) => (todo.isCompleted = true));
    //this.saveTodos();
  }

async clearCompleted() {

  const ok = await this.confirmService.confirm(
    'Are you sure you want to clear all completed todos?'
  );

  if (!ok) {
    console.log("Cancelled.");
    return;
  }
   
   
      if (window.HybridWebView?.InvokeDotNet) {
        window.HybridWebView.InvokeDotNet('ClearCompleted');
      }
    
  }

  async clearAll() {
    const ok = await this.confirmService.confirm(
    'Are you sure you want to clear all todos?'
  );

  if (!ok) {
    console.log("Cancelled.");
    return;
  }

    this.todos = [];
    if (window.HybridWebView?.InvokeDotNet) {
      console.log('Clearing all todos via .NET');
      window.HybridWebView.InvokeDotNet('ClearAll');
    }
    // if (confirm('Are you sure you want to clear all todos?')) {
    //   this.todos = [];
    //   //this.saveTodos();
    // }
  }

  // Utility methods
  cancelEdit() {
    this.editingTodo = null;
    this.todoTitle = '';
    this.todoDescription = '';
  }

  setFilter(filter: 'all' | 'pending' | 'completed') {
    this.currentFilter = filter;
  }

  getCompletedCount(): number {
    return this.todos.filter((todo) => todo.isCompleted).length;
  }

  getPendingCount(): number {
    return this.todos.filter((todo) => !todo.isCompleted).length;
  }

  getEmptyMessage(): string {
    switch (this.currentFilter) {
      case 'completed':
        return 'No completed todos';
      case 'pending':
        return 'No pending todos';
      default:
        return 'No todos yet';
    }
  }

  getEmptySubMessage(): string {
    switch (this.currentFilter) {
      case 'completed':
        return 'Complete some todos to see them here';
      case 'pending':
        return 'All todos are completed!';
      default:
        return 'Add your first todo above';
    }
  }

  

  trackByTodo(index: number, todo: Todo): number {
    return todo.id;
  }

  // Storage methods
  // private saveTodos() {
  //   localStorage.setItem('todos', JSON.stringify(this.todos));
  //   localStorage.setItem('nextId', this.nextId.toString());
  // }

  private loadTodos() {
    const savedTodos = localStorage.getItem('todos');
    const savedNextId = localStorage.getItem('nextId');

    if (savedTodos) {
      this.todos = JSON.parse(savedTodos).map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
      }));
    }

    if (savedNextId) {
      this.nextId = parseInt(savedNextId);
    }
  }
}
