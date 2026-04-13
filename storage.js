const { localFileSystem } = require('uxp').storage;
const { formats } = require('uxp').storage;

class StorageManager {
    constructor() {
        this.metadataFileName = "assets.json";
        this.data = {
            assets: [],
            folders: []
        };
    }

    async init() {
        console.log("Initializing storage...");
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            let file;
            try {
                file = await dataFolder.getEntry(this.metadataFileName);
                const jsonText = await file.read();
                if (!jsonText || jsonText.trim() === "") throw new Error("Empty file");
                
                const rawData = JSON.parse(jsonText);
                if (Array.isArray(rawData)) {
                    console.log("Migrating legacy data...");
                    this.data.assets = rawData.map(a => ({ ...a, folderId: null }));
                    this.data.folders = [];
                    await this._saveMetadata();
                } else {
                    this.data = {
                        assets: rawData.assets || [],
                        folders: rawData.folders || []
                    };
                }
            } catch (e) {
                console.warn("Starting with fresh metadata");
                this.data = { assets: [], folders: [] };
                await this._saveMetadata();
            }
            console.log(`Storage Ready: ${this.data.assets.length} assets.`);
            return true;
        } catch (e) {
            console.error("Critical Storage Init Error", e);
            return false;
        }
    }

    async getAssets() { return this.data.assets || []; }
    async getFolders() { return this.data.folders || []; }

    async createFolder(name) {
        if (!name) return null;
        console.log("Creating folder:", name);
        const folder = { id: "folder_" + Date.now(), name: name, type: "folder" };
        this.data.folders.push(folder);
        await this._saveMetadata();
        return folder;
    }

    async deleteFolder(id) {
        this.data.folders = this.data.folders.filter(f => f.id !== id);
        this.data.assets = this.data.assets.map(a => (a.folderId === id ? { ...a, folderId: null } : a));
        await this._saveMetadata();
        return true;
    }

    async getThumbnailUrl(id) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            const thumbFile = await dataFolder.getEntry(`thumb_${id}.png`);
            const buffer = await thumbFile.read({ format: formats.binary });
            return this._arrayBufferToBase64(buffer);
        } catch (e) {
            return null;
        }
    }

    // ROBUST BASE64 CONVERSION
    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return `data:image/png;base64,${window.btoa(binary)}`;
    }

    async saveAsset(assetMetadata, assetBinary, thumbBinary) {
        console.log("StorageManager: Saving binary data...");
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            
            // 1. Save Main Binary
            const assetFile = await dataFolder.createFile(`${assetMetadata.id}.dat`, { overwrite: true });
            await assetFile.write(assetBinary, { format: formats.binary });
            console.log("Main binary written.");

            // 2. Save Thumbnail Binary
            if (thumbBinary) {
                const thumbFile = await dataFolder.createFile(`thumb_${assetMetadata.id}.png`, { overwrite: true });
                await thumbFile.write(thumbBinary, { format: formats.binary });
                console.log("Thumbnail binary written.");
            }

            // 3. Save Metadata
            this.data.assets.push(assetMetadata);
            await this._saveMetadata();
            return true;
        } catch (e) {
            console.error("Save Binary Error:", e);
            throw e;
        }
    }

    async _saveMetadata() {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            const metadataFile = await dataFolder.createFile(this.metadataFileName, { overwrite: true });
            await metadataFile.write(JSON.stringify(this.data, null, 2));
            console.log("Metadata updated successfully.");
        } catch (e) {
            console.error("Metadata Write Fail:", e);
            throw e;
        }
    }

    async getAssetBinary(id) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            const file = await dataFolder.getEntry(`${id}.dat`);
            return await file.read({ format: formats.binary });
        } catch (e) { return null; }
    }

    async deleteAsset(id) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            try { (await dataFolder.getEntry(`${id}.dat`)).delete(); } catch(e) {}
            try { (await dataFolder.getEntry(`thumb_${id}.png`)).delete(); } catch(e) {}
            this.data.assets = this.data.assets.filter(a => a.id !== id);
            await this._saveMetadata();
            return true;
        } catch (e) { return false; }
    }
}

window.storageManager = new StorageManager();
