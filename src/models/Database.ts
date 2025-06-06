import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { DatabaseItem } from '../types';

export interface DatabaseSchema {
  [key: string]: DatabaseItem[];
}

export class Database<T = any> {
  private db: Low<DatabaseSchema>;
  private tableName: string;
  private initialized = false;

  constructor(tableName: string, filename = 'db.json') {
    this.tableName = tableName;
    const adapter = new JSONFile<DatabaseSchema>(filename);
    this.db = new Low(adapter, {});
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.db.read();
      this.db.data = this.db.data || {};
      if (!this.db.data[this.tableName]) {
        this.db.data[this.tableName] = [];
      }
      await this.db.write();
      this.initialized = true;
    }
  }

  public async add(id: string, data: T): Promise<void> {
    await this.ensureInitialized();
    const item: DatabaseItem = {
      id,
      data,
      timestamp: Date.now()
    };
    
    const table = this.db.data![this.tableName] || [];
    const existingIndex = table.findIndex(item => item.id === id);
    
    if (existingIndex >= 0) {
      table[existingIndex] = item;
    } else {
      table.push(item);
    }
    
    this.db.data![this.tableName] = table;
    await this.db.write();
  }

  public async get(id: string): Promise<T | null> {
    await this.ensureInitialized();
    // 重新读取数据以确保获取最新状态
    await this.db.read();
    const table = this.db.data![this.tableName] || [];
    const item = table.find(item => item.id === id);
    return item ? item.data : null;
  }

  public async getAll(): Promise<T[]> {
    await this.ensureInitialized();
    const table = this.db.data![this.tableName] || [];
    return table.map(item => item.data);
  }

  public async remove(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const table = this.db.data![this.tableName] || [];
    const initialLength = table.length;
    this.db.data![this.tableName] = table.filter(item => item.id !== id);
    
    if (this.db.data![this.tableName]?.length !== initialLength) {
      await this.db.write();
      return true;
    }
    return false;
  }

  public async exists(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const table = this.db.data![this.tableName] || [];
    return table.some(item => item.id === id);
  }

  public async clear(): Promise<void> {
    await this.ensureInitialized();
    this.db.data![this.tableName] = [];
    await this.db.write();
  }

  public async count(): Promise<number> {
    await this.ensureInitialized();
    return this.db.data![this.tableName]?.length || 0;
  }
} 