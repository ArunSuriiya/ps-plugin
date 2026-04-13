const { localFileSystem } = require('uxp').storage;

class StorageManager {
    constructor() {
        this.metadataFileName = "assets.json";
        this.assets = [];
    }

    async init() {
        console.log("Initializing storage...");
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            let file;
            try {
                file = await dataFolder.getEntry(this.metadataFileName);
                const jsonText = await file.read();
                this.assets = JSON.parse(jsonText);
                console.log(`Loaded ${this.assets.length} assets.`);
            } catch (e) {
                this.assets = [];
            }
            return true;
        } catch (e) {
            console.error("Storage Init Error", e);
            return false;
        }
    }

    async getAssets() {
        return this.assets;
    }

    /**
     * Get a persistent local URL for an asset thumbnail
     */
    async getThumbnailUrl(id) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            const thumbFile = await dataFolder.getEntry(`thumb_${id}.png`);
            // In UXP, we can point img src directly to the nativePath if permitted, 
            // OR use data URLs for persistence if small. 
            // For stability across reloads, we'll read as Base64 for the grid.
            const buffer = await thumbFile.read({ format: require('uxp').storage.formats.binary });
            return this._arrayBufferToBase64(buffer);
        } catch (e) {
            return null;
        }
    }

    _arrayBufferToBase64(buffer) {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return `data:image/png;base64,${window.btoa(binary)}`;
    }

    async saveAsset(assetMetadata, assetBinary, thumbBinary) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            
            // 1. Save Main Binary
            const assetFile = await dataFolder.createFile(`${assetMetadata.id}.dat`, { overwrite: true });
            await assetFile.write(assetBinary, { format: require('uxp').storage.formats.binary });

            // 2. Save Thumbnail Binary
            if (thumbBinary) {
                const thumbFile = await dataFolder.createFile(`thumb_${assetMetadata.id}.png`, { overwrite: true });
                await thumbFile.write(thumbBinary, { format: require('uxp').storage.formats.binary });
            }

            // 3. Save Metadata
            this.assets.push(assetMetadata);
            const metadataFile = await dataFolder.createFile(this.metadataFileName, { overwrite: true });
            await metadataFile.write(JSON.stringify(this.assets, null, 2));

            return true;
        } catch (e) {
            console.error("Save Error", e);
            throw e;
        }
    }

    async getAssetBinary(id) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            const file = await dataFolder.getEntry(`${id}.dat`);
            return await file.read({ format: require('uxp').storage.formats.binary });
        } catch (e) {
            return null;
        }
    }

    async deleteAsset(id) {
        try {
            const dataFolder = await localFileSystem.getDataFolder();
            try { (await dataFolder.getEntry(`${id}.dat`)).delete(); } catch(e) {}
            try { (await dataFolder.getEntry(`thumb_${id}.png`)).delete(); } catch(e) {}
            
            this.assets = this.assets.filter(a => a.id !== id);
            const metadataFile = await dataFolder.createFile(this.metadataFileName, { overwrite: true });
            await metadataFile.write(JSON.stringify(this.assets, null, 2));
            return true;
        } catch (e) {
            return false;
        }
    }
}

window.storageManager = new StorageManager();
