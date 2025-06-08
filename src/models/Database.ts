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
  private writeQueue: Promise<void> = Promise.resolve();
  private cacheTimeout: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 60000; // 1分钟缓存

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
      this.scheduleDataRefresh();
    }
  }

  private scheduleDataRefresh(): void {
    if (this.cacheTimeout) {
      clearTimeout(this.cacheTimeout);
    }
    
    this.cacheTimeout = setTimeout(() => {
      this.initialized = false;
    }, this.CACHE_DURATION);
  }

  public async add(id: string, data: T): Promise<void> {
    await this.ensureInitialized();
    
    // 使用队列确保写入操作的原子性
    this.writeQueue = this.writeQueue.then(async () => {
      const item: DatabaseItem = {
        id,
        data,
        timestamp: Date.now()
      };
      
      // 重新读取数据以获取最新状态
      await this.db.read();
      
      const table = this.db.data![this.tableName] || [];
      const existingIndex = table.findIndex(item => item.id === id);
      
      if (existingIndex >= 0) {
        table[existingIndex] = item;
      } else {
        table.push(item);
      }
      
      this.db.data![this.tableName] = table;
      await this.db.write();
      
      this.scheduleDataRefresh();
    });
    
    await this.writeQueue;
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