class PhotoshopHost {
    constructor() {
        this._ps = null;
    }

    get ps() {
        if (!this._ps) {
            try { this._ps = require("photoshop"); } catch (e) { console.warn("PS not available"); }
        }
        return this._ps;
    }

    async getSelectedLayerInfo() {
        const { app, action } = this.ps;
        const activeDoc = app.activeDocument;
        if (!activeDoc || activeDoc.activeLayers.length === 0) {
            throw new Error("No layer selected");
        }

        const layer = activeDoc.activeLayers[0];
        const result = await action.batchPlay([
            {
                _obj: "get",
                _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                _options: { dialogOptions: "dontDisplay" }
            }
        ], { synchronousExecution: true });

        const desc = result[0];
        
        let extension = "png";
        let type = "raster";
        
        const kindStr = layer.kind.toString();
        if (kindStr.includes("SOLIDFILL")) {
            // Shapes are now saved as PSD to preserve native vector data
            extension = "psd";
            type = "shape";
        } else if (kindStr.includes("SMARTOBJECT")) {
            extension = "psb";
            type = "smartObject";
        }

        return {
            id: layer.id,
            name: layer.name,
            kind: layer.kind,
            type: type,
            extension: extension,
            width: layer.bounds.width,
            height: layer.bounds.height
        };
    }

    async extractAssetData() {
        const { app, core, action } = this.ps;
        const uxp = require('uxp');
        const fs = uxp.storage.localFileSystem;
        
        let thumbBuffer = null;
        let assetBuffer = null;
        let info = null;

        await core.executeAsModal(async () => {
            info = await this.getSelectedLayerInfo();
            const tempFolder = await fs.getTemporaryFolder();
            
            const assetFile = await tempFolder.createFile(`asset_${Date.now()}.${info.extension}`, { overwrite: true });
            const assetToken = await fs.createSessionToken(assetFile);

            const thumbFile = await tempFolder.createFile(`thumb_${Date.now()}.png`, { overwrite: true });
            const thumbToken = await fs.createSessionToken(thumbFile);

            let tempDoc = null;
            try {
                // 1. Export Main Asset
                if (info.type === "smartObject") {
                    await action.batchPlay([{ _obj: "placedLayerExportContents", null: { _path: assetToken } }], {});
                } else if (info.type === "shape") {
                    // Export Shape as PSD to preserve vectors
                    await action.batchPlay([{
                        _obj: "make",
                        _target: [{ _ref: "document" }],
                        using: { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
                    }], {});
                    tempDoc = app.activeDocument;
                    await action.batchPlay([{ _obj: "save", as: { _obj: "photoshop35Format" }, in: { _path: assetToken } }], {});
                } else {
                    await action.batchPlay([{
                        _obj: "make",
                        _target: [{ _ref: "document" }],
                        using: { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
                    }], {});
                    tempDoc = app.activeDocument;
                    await action.batchPlay([{ _obj: "trim", trimFreePixels: true }], {});
                    await action.batchPlay([{ 
                        _obj: "save", 
                        as: { _obj: "PNGFormat", method: { _enum: "PNGMethod", _value: "quick" } }, 
                        in: { _path: assetToken } 
                    }], {});
                }

                assetBuffer = await assetFile.read({ format: uxp.storage.formats.binary });

                // 2. Export Thumbnail
                if (!tempDoc) {
                    await action.batchPlay([{
                        _obj: "make",
                        _target: [{ _ref: "document" }],
                        using: { _ref: "layer", _id: info.id }
                    }], {});
                    tempDoc = app.activeDocument;
                }

                const thumbSize = 250;
                const scale = Math.min(thumbSize / tempDoc.width, thumbSize / tempDoc.height, 1);
                if (scale < 1) await tempDoc.resizeImage(tempDoc.width * scale, tempDoc.height * scale);

                await action.batchPlay([{
                    _obj: "save",
                    as: { _obj: "PNGFormat", method: { _enum: "PNGMethod", _value: "quick" } },
                    in: { _path: thumbToken }
                }], {});

                thumbBuffer = await thumbFile.read({ format: uxp.storage.formats.binary });

            } finally {
                if (tempDoc) try { await tempDoc.closeWithoutSaving(); } catch(e) {}
                try { await assetFile.delete(); } catch(e) {}
                try { await thumbFile.delete(); } catch(e) {}
            }
        }, { "commandName": "Capturing Asset" });

        return {
            thumbBuffer: thumbBuffer,
            assetBuffer: assetBuffer,
            metadata: info
        };
    }

    async importAsset(assetMetadata, binaryData) {
        const uxp = require('uxp');
        const fs = uxp.storage.localFileSystem;
        const tempFolder = await fs.getTemporaryFolder();
        
        const metadata = assetMetadata.metadata || {};
        const extension = metadata.extension || "png";
        
        const tempFile = await tempFolder.createFile(`temp_import.${extension}`, { overwrite: true });
        const fileToken = await fs.createSessionToken(tempFile);
        await tempFile.write(binaryData, { format: uxp.storage.formats.binary });

        const { app, action } = this.ps;
        const initialDoc = app.activeDocument;
        if (!initialDoc) throw new Error("No active document");

        await this.ps.core.executeAsModal(async () => {
            if (metadata.type === "shape") {
                // SPECIAL IMPORT: Duplicate layer from PSD to stay native
                const tempDoc = await app.open(tempFile);
                const layer = tempDoc.activeLayers[0];
                
                await action.batchPlay([{
                    _obj: "duplicate",
                    _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                    to: { _ref: "document", _id: initialDoc.id }
                }], {});
                
                await tempDoc.closeWithoutSaving();
            } else {
                // STANDARD IMPORT: Place as Smart Object
                await action.batchPlay([{
                    _obj: "placeEvent",
                    null: { _path: fileToken },
                    linked: false,
                    display: { _obj: "placeDisplay", offset: { _obj: "point", horizontal: 0, vertical: 0 } }
                }], {});
            }
        }, { "commandName": "Importing Asset" });
    }
}

window.psHost = new PhotoshopHost();
