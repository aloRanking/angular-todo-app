import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from './todo.interface'; // Ensure this path is correct and the interface matches C# TodoItem

// Declare the MAUI host objects interface
declare global {
  interface Window {
    MauiHybrid: {
      TodoJSInvokeTarget: {
        getTodoItems: () => Promise<Todo[]>;
        addTodo: (todo: Todo) => Promise<void>;
        removeTodoById: (id: number) => Promise<void>;
        updateDesc: (id: number, title: string, description: string, isCompleted: boolean) => Promise<void>;
        toggleComplete: (id: number) => Promise<void>; // Assuming this now takes an 'id'
        clearCompleted: () => Promise<void>;
        showToast: (message: string) => Promise<void>;
      };
    };
    globalSetData: (data: Todo[]) => void;
    chrome?: {
      webview?: {
        hostObjects?: any; // The raw hostObjects collection for direct check
      }
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
export class AppComponent implements OnInit {
  todos: Todo[] = [];
  todoTitle: string = '';
  todoDescription: string = '';
  editingTodo: Todo | null = null;
  currentFilter: 'all' | 'pending' | 'completed' = 'all';

  private mauiHostReady: boolean = false; // Flag to track readiness

  constructor(private ngZone: NgZone) {
    console.log('AppComponent constructor called.');

    // Expose a global function for C# to call
    (window as any).globalSetData = (data: Todo[]) => {
      this.ngZone.run(() => { // Ensure Angular change detection runs
        console.log('C# called globalSetData with data:', data);
        this.todos = data.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt) // Convert createdAt string to Date object
        }));
        console.log('Todos updated:', this.todos);
      });
    };
  }

  ngOnInit() {
    console.log('AppComponent ngOnInit called.');
    this.waitForMauiHostObjects(); // Start waiting for the host objects
  }

  /**
   * Continuously checks for the availability of MAUI Hybrid host objects.
   * Once available, sets `mauiHostReady` to true and initiates data loading.
   */
  private waitForMauiHostObjects() {
    if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects) {
      this.mauiHostReady = true;
      console.log('MAUI Hybrid host objects are available! Initializing communication.');
      this.loadTodosFromMaui(); // Load initial data from MAUI database
    } else {
      console.warn("MAUI Hybrid host objects not yet available. Retrying in 100ms...");
      setTimeout(() => this.waitForMauiHostObjects(), 100);
    }
  }

  /**
   * Calls the C# method to get all todo items from the database.
   * The C# side will then push the data back via `globalSetData`.
   */
  async loadTodosFromMaui() {
    console.log('Attempting to load todos from MAUI...');
    if (!this.mauiHostReady) {
      console.warn("MAUI host not ready when loadTodosFromMaui was called directly. Delaying or falling back.");
      // This should ideally not be hit if called from waitForMauiHostObjects
      // You could add a setTimeout here too if needed, or simply return.
      this.loadTodosFromLocalStorage(); // Fallback if for some reason it's called too early
      return;
    }

    try {
      console.log('Calling C# GetTodoItems...');
      await window.MauiHybrid.TodoJSInvokeTarget.getTodoItems();
      // The actual data update happens in globalSetData, which C# calls
    } catch (error) {
      console.error("Error loading todos from MAUI. Falling back to local storage.", error);
      this.loadTodosFromLocalStorage();
    }
  }

  /**
   * Handles saving or updating a todo item by communicating with the C# backend.
   */
  async saveTodo() {
    console.log('saveTodo called. Current todoTitle:', this.todoTitle);
    if (!this.todoTitle.trim()) {
      console.warn('Todo title is empty, not saving.');
      return;
    }

    if (!this.mauiHostReady) {
      console.warn('MAUI host not ready for saveTodo. Falling back to local storage (or consider disabling UI interaction).');
      this.saveTodosFromLocalStorage(); // Fallback for testing without MAUI connection
      this.loadTodosFromLocalStorage(); // Reload from local storage immediately
      this.todoTitle = '';
      this.todoDescription = '';
      return;
    }

    if (this.editingTodo) {
      console.log('Updating existing todo:', this.editingTodo.id);
      await window.MauiHybrid.TodoJSInvokeTarget.updateDesc(
        this.editingTodo.id,
        this.todoTitle.trim(),
        this.todoDescription.trim(),
        this.editingTodo.completed
      );
    } else {
      console.log('Creating new todo.');
      const newTodo: Todo = {
        id: 0, // ID will be set by C#
        title: this.todoTitle.trim(),
        description: this.todoDescription.trim(),
        completed: false,
        createdAt: new Date()
      };
      await window.MauiHybrid.TodoJSInvokeTarget.addTodo(newTodo);
    }

    this.todoTitle = '';
    this.todoDescription = '';
    console.log('Todo saved/updated. Refreshing list from MAUI.');
    await this.loadTodosFromMaui(); // Request updated list from MAUI
  }

  /**
   * Filters the todos based on the current filter setting.
   * @returns An array of filtered Todo items.
   */
  getFilteredTodos(): Todo[] {
    console.log('getFilteredTodos called. Current filter:', this.currentFilter);
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
   * Sets the currently selected todo for editing.
   * @param todo The Todo item to be edited.
   */
  editTodo(todo: Todo) {
    console.log('editTodo called for todo ID:', todo.id);
    this.editingTodo = todo;
    this.todoTitle = todo.title;
    this.todoDescription = todo.description;
  }

  /**
   * Toggles the completion status of a todo item in the C# backend.
   * @param todo The Todo item to toggle.
   */
  async toggleComplete(todo: Todo) {
    if (!this.mauiHostReady) {
      console.warn('MAUI host not ready for toggleComplete. Falling back to local storage.');
      todo.completed = !todo.completed;
      this.saveTodosFromLocalStorage();
      return;
    }
    console.log('toggleComplete called for todo ID:', todo.id, 'New state will be:', !todo.completed);
    await window.MauiHybrid.TodoJSInvokeTarget.toggleComplete(todo.id);
    await this.loadTodosFromMaui(); // Refresh data after update
  }

  /**
   * Deletes a todo item by its ID using the C# backend.
   * @param id The ID of the todo item to delete.
   */
  async deleteTodo(id: number) {
    console.log('deleteTodo called for todo ID:', id);
    if (confirm('Are you sure you want to delete this todo?')) {
      if (!this.mauiHostReady) {
        console.warn('MAUI host not ready for deleteTodo. Falling back to local storage.');
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodosFromLocalStorage();
        return;
      }
      await window.MauiHybrid.TodoJSInvokeTarget.removeTodoById(id);
      console.log('Todo deleted. Refreshing list from MAUI.');
      await this.loadTodosFromMaui(); // Refresh data after deletion
    } else {
      console.log('Todo deletion cancelled.');
    }
  }

  /**
   * Cancels the current todo editing session and clears input fields.
   */
  cancelEdit() {
    console.log('cancelEdit called.');
    this.editingTodo = null;
    this.todoTitle = '';
    this.todoDescription = '';
  }

  /**
   * Sets the filter for displaying todos (all, pending, or completed).
   * @param filter The filter type.
   */
  setFilter(filter: 'all' | 'pending' | 'completed') {
    console.log('setFilter called. New filter:', filter);
    this.currentFilter = filter;
  }

  /**
   * Gets the count of completed todo items.
   * @returns The number of completed todos.
   */
  getCompletedCount(): number {
    return this.todos.filter(todo => todo.completed).length;
  }

  /**
   * Gets the count of pending (incomplete) todo items.
   * @returns The number of pending todos.
   */
  getPendingCount(): number {
    return this.todos.filter(todo => !todo.completed).length;
  }

  /**
   * Provides a message when there are no todos based on the current filter.
   * @returns A string message.
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
   * Provides a sub-message when there are no todos.
   * @returns A string sub-message.
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
   * Marks all current todos as complete. (Currently uses local storage fallback)
   * This would need a C# method to implement fully.
   */
  markAllComplete() {
    console.log('markAllComplete called. (Currently uses local storage fallback)');
    this.todos.forEach(todo => todo.completed = true);
    this.saveTodosFromLocalStorage(); // Still using local storage for this action
    this.loadTodosFromLocalStorage(); // Refresh immediately from local storage
  }

  /**
   * Clears all completed todo items using the C# backend.
   */
  async clearCompleted() {
    console.log('clearCompleted called.');
    if (confirm('Are you sure you want to clear all completed todos?')) {
      if (!this.mauiHostReady) {
        console.warn('MAUI host not ready for clearCompleted. Falling back to local storage.');
        this.todos = this.todos.filter(todo => !todo.completed);
        this.saveTodosFromLocalStorage();
        return;
      }
      await window.MauiHybrid.TodoJSInvokeTarget.clearCompleted();
      console.log('Completed todos cleared. Refreshing list from MAUI.');
      await this.loadTodosFromMaui(); // Refresh data after clearing
    } else {
      console.log('Clear completed cancelled.');
    }
  }

  /**
   * Clears all todo items. (Currently uses local storage fallback)
   * This would need a C# method to implement fully.
   */
  clearAll() {
    console.log('clearAll called. (Currently uses local storage fallback)');
    if (confirm('Are you sure you want to clear all todos?')) {
      this.todos = [];
      this.saveTodosFromLocalStorage(); // Still using local storage for this action
    }
  }

  /**
   * TrackBy function for NgFor loops to improve performance.
   * @param index The index of the item.
   * @param todo The Todo item.
   * @returns The ID of the todo item.
   */
  trackByTodo(index: number, todo: Todo): number {
    return todo.id;
  }

  // --- Local Storage Fallback Methods (for development/testing without MAUI connection or unimplemented C# features) ---
  private saveTodosFromLocalStorage() {
    console.log('Saving todos to local storage (fallback).');
    localStorage.setItem('todos', JSON.stringify(this.todos));
    // If you need nextId for local storage, reintroduce it here
  }

  private loadTodosFromLocalStorage() {
    console.log('Loading todos from local storage (fallback).');
    const savedTodos = localStorage.getItem('todos');
    // const savedNextId = localStorage.getItem('nextId'); // If you reintroduce nextId for local

    if (savedTodos) {
      this.todos = JSON.parse(savedTodos).map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt)
      }));
    }
    // if (savedNextId) {
    //   this.nextId = parseInt(savedNextId);
    // }
  }
}