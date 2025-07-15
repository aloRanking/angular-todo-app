import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from './todo.interface';

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

  constructor() {
    // Load todos from localStorage on init
    this.loadTodos();
  }

  // Create
  saveTodo() {
    if (!this.todoTitle.trim()) return;

    if (this.editingTodo) {
      // Update existing todo
      this.editingTodo.title = this.todoTitle.trim();
      this.editingTodo.description = this.todoDescription.trim();
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
    }

    this.todoTitle = '';
    this.todoDescription = '';
    this.saveTodos();
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
    this.saveTodos();
  }

  // Delete
  deleteTodo(id: number) {
    if (confirm('Are you sure you want to delete this todo?')) {
      this.todos = this.todos.filter(todo => todo.id !== id);
      this.saveTodos();
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
    this.saveTodos();
  }

  clearCompleted() {
    if (confirm('Are you sure you want to clear all completed todos?')) {
      this.todos = this.todos.filter(todo => !todo.completed);
      this.saveTodos();
    }
  }

  clearAll() {
    if (confirm('Are you sure you want to clear all todos?')) {
      this.todos = [];
      this.saveTodos();
    }
  }

  trackByTodo(index: number, todo: Todo): number {
    return todo.id;
  }

  // Storage methods
  private saveTodos() {
    localStorage.setItem('todos', JSON.stringify(this.todos));
    localStorage.setItem('nextId', this.nextId.toString());
  }

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
}