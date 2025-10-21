import * as fs from "node:fs";

/**
 * FileStore - Single JSON file key/value store (like localStorage)
 * Loads entire file on init, updates in-memory, writes on modification
 */
export class FileStore<T = unknown> {
   private filePath: string;
   private data: Map<string, T>;
   private writeScheduled = false;
   private isWriting = false;

   constructor(filePath: string) {
      this.filePath = filePath;
      this.data = new Map();

      // Load from file if exists
      if (fs.existsSync(filePath)) {
         try {
            const content = fs.readFileSync(filePath, "utf-8");
            const obj = JSON.parse(content);
            this.data = new Map(Object.entries(obj));
         } catch (err) {
            console.error(`Failed to load ${filePath}:`, err);
         }
      }
   }

   getItem(key: string): T | null {
      return this.data.get(key) ?? null;
   }

   setItem(key: string, value: T): void {
      this.data.set(key, value);
      this.scheduleSave();
   }

   removeItem(key: string): void {
      this.data.delete(key);
      this.scheduleSave();
   }

   clear(): void {
      this.data.clear();
      this.scheduleSave();
   }

   keys(): string[] {
      return Array.from(this.data.keys());
   }

   values(): T[] {
      return Array.from(this.data.values());
   }

   get length(): number {
      return this.data.size;
   }

   private scheduleSave(): void {
      if (this.writeScheduled) return;
      this.writeScheduled = true;
      this.processWrites();
   }

   private async processWrites(): Promise<void> {
      if (this.isWriting) return;
      this.isWriting = true;

      while (this.writeScheduled) {
         this.writeScheduled = false;
         const obj = Object.fromEntries(this.data);
         await fs.promises.writeFile(this.filePath, JSON.stringify(obj, null, 2), "utf-8");
      }

      this.isWriting = false;
   }
}

