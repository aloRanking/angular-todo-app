import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from './todo.interface';

// Declare the MAUI host objects interface
declare global {
  interface Window {
    chrome: {
      webview: {
        hostObjects: {
          TodoJSInvokeTarget: {
            GetTodoItems: () => Promise<void>;
            AddTodo: (todo: Todo) => Promise<void>;
            RemoveTodoById: (id: number) => Promise<void>;
            UpdateDesc: (id: number, title: string, description: string, isCompleted: boolean) => Promise<void>;
            ToggleComplete: (id: number) => Promise<void>;
            ClearCompleted: () => Promise<void>;
          };
        };
      };
    };
    globalSetData: (data: Todo[]) => void;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  todos: Todo[] = [];
  todoTitle: string = '';
  todoDescription: string = '';
  editingTodo: Todo | null = null;
  currentFilter: 'all' | 'pending' | 'completed' = 'all';

  private mauiHostReady: boolean = false;

  constructor(private ngZone: NgZone) {
    console.log('AppComponent constructor called.');

    // Expose a global function for C# to call
    (window as any).globalSetData = (data: Todo[]) => {
      this.ngZone.run(() => {
        console.log('C# called globalSetData with data:', data);
        this.todos = data.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt)
        }));
        console.log('Todos updated:', this.todos);
      });
    };
  }

  ngOnInit() {
    console.log('AppComponent ngOnInit called.');
    this.waitForMauiHostObjects();
  }

  /**
   * Wait for MAUI HybridWebView to be ready
   */
  private waitForMauiHostObjects() {
    if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects && window.chrome.webview.hostObjects.TodoJSInvokeTarget) {
      this.mauiHostReady = true;
      console.log('MAUI HybridWebView host objects are available! Initializing communication.');
      this.loadTodosFromMaui();
    } else {
      console.warn("MAUI HybridWebView host objects not yet available. Retrying in 100ms...");
      setTimeout(() => this.waitForMauiHostObjects(), 100);
    }
  }

  /**
   * Load todos from MAUI backend
   */
  async loadTodosFromMaui() {
    console.log('Attempting to load todos from MAUI...');
    if (!this.mauiHostReady) {
      console.warn("MAUI host not ready. Using local storage fallback.");
      this.loadTodosFromLocalStorage();
      return;
    }

    try {
      console.log('Calling C# GetTodoItems...');
      await window.chrome.webview.hostObjects.TodoJSInvokeTarget.GetTodoItems();
    } catch (error) {
      console.error("Error loading todos from MAUI. Falling back to local storage.", error);
      this.loadTodosFromLocalStorage();
    }
  }

  /**
   * Save or update a todo
   */
  async saveTodo() {
    console.log('saveTodo called. Current todoTitle:', this.todoTitle);
    if (!this.todoTitle.trim()) {
      console.warn('Todo title is empty, not saving.');
      return;
    }

    if (!this.mauiHostReady) {
      console.warn('MAUI host not ready for saveTodo. Using local storage fallback.');
      this.saveTodosFromLocalStorage();
      this.loadTodosFromLocalStorage();
      this.todoTitle = '';
      this.todoDescription = '';
      return;
    }

    try {
      if (this.editingTodo) {
        console.log('Updating existing todo:', this.editingTodo.id);
        await window.chrome.webview.hostObjects.TodoJSInvokeTarget.UpdateDesc(
          this.editingTodo.id,
          this.todoTitle.trim(),
          this.todoDescription.trim(),
          this.editingTodo.completed
        );
        this.editingTodo = null;
      } else {
        console.log('Creating new todo.');
        const newTodo: Todo = {
          id: 0, // ID will be set by C#
          title: this.todoTitle.trim(),
          description: this.todoDescription.trim(),
          completed: false,
          createdAt: new Date()
        };
        await window.chrome.webview.hostObjects.TodoJSInvokeTarget.AddTodo(newTodo);
      }

      this.todoTitle = '';
      this.todoDescription = '';
      console.log('Todo saved/updated. Refreshing list from MAUI.');
    } catch (error) {
      console.error('Error saving todo:', error);
    }
  }

  /**
   * Filter todos based on current filter
   */
  getFilteredTodos(): Todo[] {
    switch (this.currentFilter) {
      case 'completed':
        return this.todos.filter(todo => todo.completed);
      case 'pending':
        return this.todos.filter(todo => !todo.completed);
      case 'all':
      default:
        return this.todos;
    }
  }

  /**
   * Edit a todo
   */
  editTodo(todo: Todo) {
    console.log('editTodo called for todo ID:', todo.id);
    this.editingTodo = todo;
    this.todoTitle = todo.title;
    this.todoDescription = todo.description;
  }

  /**
   * Toggle completion status
   */
  async toggleComplete(todo: Todo) {
    if (!this.mauiHostReady) {
      console.warn('MAUI host not ready for toggleComplete. Using local storage fallback.');
      todo.completed = !todo.completed;
      this.saveTodosFromLocalStorage();
      return;
    }

    try {
      console.log('toggleComplete called for todo ID:', todo.id);
      await window.chrome.webview.hostObjects.TodoJSInvokeTarget.ToggleComplete(todo.id);
    } catch (error) {
      console.error('Error toggling todo completion:', error);
    }
  }

  /**
   * Delete a todo
   */
  async deleteTodo(id: number) {
    console.log('deleteTodo called for todo ID:', id);
    if (confirm('Are you sure you want to delete this todo?')) {
      if (!this.mauiHostReady) {
        console.warn('MAUI host not ready for deleteTodo. Using local storage fallback.');
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodosFromLocalStorage();
        return;
      }

      try {
        await window.chrome.webview.hostObjects.TodoJSInvokeTarget.RemoveTodoById(id);
        console.log('Todo deleted successfully.');
      } catch (error) {
        console.error('Error deleting todo:', error);
      }
    }
  }

  /**
   * Cancel editing
   */
  cancelEdit() {
    console.log('cancelEdit called.');
    this.editingTodo = null;
    this.todoTitle = '';
    this.todoDescription = '';
  }

  /**
   * Set filter
   */
  setFilter(filter: 'all' | 'pending' | 'completed') {
    console.log('setFilter called. New filter:', filter);
    this.currentFilter = filter;
  }

  /**
   * Get completed count
   */
  getCompletedCount(): number {
    return this.todos.filter(todo => todo.completed).length;
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.todos.filter(todo => !todo.completed).length;
  }

  /**
   * Get empty message
   */
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

  /**
   * Get empty sub-message
   */
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

  /**
   * Mark all complete (local storage fallback only for now)
   */
  markAllComplete() {
    console.log('markAllComplete called. (Using local storage fallback)');
    this.todos.forEach(todo => todo.completed = true);
    this.saveTodosFromLocalStorage();
    this.loadTodosFromLocalStorage();
  }

  /**
   * Clear completed todos
   */
  async clearCompleted() {
    console.log('clearCompleted called.');
    if (confirm('Are you sure you want to clear all completed todos?')) {
      if (!this.mauiHostReady) {
        console.warn('MAUI host not ready for clearCompleted. Using local storage fallback.');
        this.todos = this.todos.filter(todo => !todo.completed);
        this.saveTodosFromLocalStorage();
        return;
      }

      try {
        await window.chrome.webview.hostObjects.TodoJSInvokeTarget.ClearCompleted();
        console.log('Completed todos cleared.');
      } catch (error) {
        console.error('Error clearing completed todos:', error);
      }
    }
  }

  /**
   * Clear all todos (local storage fallback only)
   */
  clearAll() {
    console.log('clearAll called. (Using local storage fallback)');
    if (confirm('Are you sure you want to clear all todos?')) {
      this.todos = [];
      this.saveTodosFromLocalStorage();
    }
  }

  /**
   * TrackBy function for NgFor performance
   */
  trackByTodo(index: number, todo: Todo): number {
    return todo.id;
  }

  // Local Storage Fallback Methods
  private saveTodosFromLocalStorage() {
    console.log('Saving todos to local storage (fallback).');
    localStorage.setItem('todos', JSON.stringify(this.todos));
  }

  private loadTodosFromLocalStorage() {
    console.log('Loading todos from local storage (fallback).');
    const savedTodos = localStorage.getItem('todos');

    if (savedTodos) {
      this.todos = JSON.parse(savedTodos).map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt)
      }));
    }
  }
}