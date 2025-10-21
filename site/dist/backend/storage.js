import * as fs from "node:fs";
/**
 * FileStore - Single JSON file key/value store (like localStorage)
 * Loads entire file on init, updates in-memory, writes on modification
 */
export class FileStore {
    constructor(filePath) {
        this.writeScheduled = false;
        this.isWriting = false;
        this.filePath = filePath;
        this.data = new Map();
        // Load from file if exists
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, "utf-8");
                const obj = JSON.parse(content);
                this.data = new Map(Object.entries(obj));
            }
            catch (err) {
                console.error(`Failed to load ${filePath}:`, err);
            }
        }
    }
    getItem(key) {
        return this.data.get(key) ?? null;
    }
    setItem(key, value) {
        this.data.set(key, value);
        this.scheduleSave();
    }
    removeItem(key) {
        this.data.delete(key);
        this.scheduleSave();
    }
    clear() {
        this.data.clear();
        this.scheduleSave();
    }
    keys() {
        return Array.from(this.data.keys());
    }
    values() {
        return Array.from(this.data.values());
    }
    get length() {
        return this.data.size;
    }
    scheduleSave() {
        if (this.writeScheduled)
            return;
        this.writeScheduled = true;
        this.processWrites();
    }
    async processWrites() {
        if (this.isWriting)
            return;
        this.isWriting = true;
        while (this.writeScheduled) {
            this.writeScheduled = false;
            const obj = Object.fromEntries(this.data);
            await fs.promises.writeFile(this.filePath, JSON.stringify(obj, null, 2), "utf-8");
        }
        this.isWriting = false;
    }
}
