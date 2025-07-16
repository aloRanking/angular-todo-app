import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from './todo.interface';


declare global {
  interface Window {
    invokeCSharpAction?: ((arg: string) => void);
    HybridWebView?: {
      InvokeDotNet: (methodName: string, args?: any) => void;
    };
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  todos: Todo[] = [];
  todoTitle: string = '';
  todoDescription: string = '';
  editingTodo: Todo | null = null;
  currentFilter: 'all' | 'pending' | 'completed' = 'all';
  nextId: number = 1;

  // constructor() {
  //   // Load todos from localStorage on init
  //   this.loadTodos();
  // }
  constructor() {
  this.hookGlobalSetData();
  this.waitForHybridBridge().then(() => {
  this.loadTodosFromDotNet();
});
}


private waitForHybridBridge(): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const isReady =
        typeof window !== "undefined" &&
        typeof window.invokeCSharpAction === "function" &&
        typeof window.HybridWebView?.InvokeDotNet === "function";

      if (isReady) {
        console.log("HybridWebView is ready");
        clearInterval(interval);
        resolve();
      } else {
        console.log("Waiting for HybridWebView...");
      }
    }, 100); // Check every 100ms
  });
}
  // Create
  saveTodo() {
    if (!this.todoTitle.trim()) return;

    console.log("Saving todo:", this.todos.toString());

    if (this.editingTodo) {
      // Update existing todo
      this.editingTodo.title = this.todoTitle.trim();
      this.editingTodo.description = this.todoDescription.trim();
      if (window.HybridWebView?.InvokeDotNet) {
  window.HybridWebView.InvokeDotNet("UpdateDesc", this.editingTodo);
}
      this.editingTodo = null;
    } else {
      // Create new todo
      const newTodo: Todo = {
        id: this.nextId++,
        title: this.todoTitle.trim(),
        description: this.todoDescription.trim(),
        completed: false,
        createdAt: new Date()
      };
      this.todos.push(newTodo);

      if (window.HybridWebView?.InvokeDotNet) {
        console.log("Adding todo:", newTodo);
    window.HybridWebView.InvokeDotNet("AddTodo", newTodo);

    console.log("Added todo:", newTodo);
  }
    }

    this.todoTitle = '';
    this.todoDescription = '';
    //this.saveTodos();
  }

  // Read
  getFilteredTodos(): Todo[] {
    switch (this.currentFilter) {
      case 'completed':
        return this.todos.filter(todo => todo.completed);
      case 'pending':
        return this.todos.filter(todo => !todo.completed);
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
    todo.completed = !todo.completed;
    if (window.HybridWebView?.InvokeDotNet) {
    window.HybridWebView.InvokeDotNet("UpdateDesc", todo);
    console.log("Updated todo:", todo);
  }
  }

  // Delete
  deleteTodo(id: number) {
    if (confirm('Are you sure you want to delete this todo?')) {
      console.log("filter todos:", this.todos);

      const todo = this.todos.find(t => t.id === id);
    this.todos = this.todos.filter(todo => todo.id !== id);
    console.log("filter todos:", this.todos);

    if (todo && window.HybridWebView?.InvokeDotNet) {
      window.HybridWebView.InvokeDotNet("RemoveTodoById", todo.id);
      console.log("Removed todo:", todo);
    }
      //this.saveTodos();
    }
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
    return this.todos.filter(todo => todo.completed).length;
  }

  getPendingCount(): number {
    return this.todos.filter(todo => !todo.completed).length;
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

  markAllComplete() {
    this.todos.forEach(todo => todo.completed = true);
    //this.saveTodos();
  }

  clearCompleted() {
    if (confirm('Are you sure you want to clear all completed todos?')) {
      if (window.HybridWebView?.InvokeDotNet) {
      window.HybridWebView.InvokeDotNet("ClearCompleted");
    }
    }
  }

  clearAll() {
    if (confirm('Are you sure you want to clear all todos?')) {
      this.todos = [];
      //this.saveTodos();
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
        createdAt: new Date(todo.createdAt)
      }));
    }
    
    if (savedNextId) {
      this.nextId = parseInt(savedNextId);
    }
  }

  loadTodosFromDotNet() {
  if (window.HybridWebView?.InvokeDotNet) {
    console.log("Requesting todos from .NET");
    window.HybridWebView.InvokeDotNet("GetTodoItems");
  } else {
    console.warn("HybridWebView.InvokeDotNet not available");
  }
}

hookGlobalSetData() {
  // Make sure 'this' context remains bound
  (window as any).globalSetData = (items: any[]) => {
    if (!Array.isArray(items)) return;

    console.log("Received items from .NET:", items );

    this.todos = items.map((item) => ({
      id: item.Id ?? 0,
      title: item.Title ?? '',
      description: item.Description ?? '',
      completed: item.isCompleted ?? false,
      createdAt: item.CreatedAt ? new Date(item.CreatedAt) : new Date() 
    }));

    console.log("Todos loaded from .NET:", this.todos);

    // Also update nextId (optional but useful for keeping ID serial)
    const maxId = this.todos.length > 0 ? Math.max(...this.todos.map(t => t.id)) : 0;
    this.nextId = maxId + 1;
  };
}
}