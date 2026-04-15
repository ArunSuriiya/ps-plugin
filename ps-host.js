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
        // FIX 1: Removed synchronousExecution:true — caused hangs on some layers
        const result = await action.batchPlay([
            {
                _obj: "get",
                _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                _options: { dialogOptions: "dontDisplay" }
            }
        ], {});

        if (!result || !result[0]) throw new Error("Layer info fail");

        let extension = "png";
        let type = "raster";

        const kindStr = layer.kind.toString();
        if (kindStr.includes("SOLIDFILL")) {
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

        console.log("PhotoshopHost: Starting capture...");

        await core.executeAsModal(async () => {
            info = await this.getSelectedLayerInfo();
            const tempFolder = await fs.getTemporaryFolder();

            const assetFile = await tempFolder.createFile(`asset_${Date.now()}.${info.extension}`, { overwrite: true });
            const assetToken = await fs.createSessionToken(assetFile);

            const thumbFile = await tempFolder.createFile(`thumb_${Date.now()}.png`, { overwrite: true });
            const thumbToken = await fs.createSessionToken(thumbFile);

            // FIX 2: Track ALL created temp docs in an array (original only tracked one,
            // but two docs can be created — one for asset, one for thumbnail —
            // leaving a dangling open doc that corrupts PS state on exit/crash)
            const tempDocs = [];

            try {
                // 1. Export Main Asset
                console.log(`Exporting ${info.type}...`);
                if (info.type === "smartObject") {
                    await action.batchPlay([{ _obj: "placedLayerExportContents", null: { _path: assetToken } }], {});
                } else if (info.type === "shape") {
                    await action.batchPlay([{
                        _obj: "make",
                        _target: [{ _ref: "document" }],
                        using: { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
                    }], {});
                    tempDocs.push(app.activeDocument);
                    await action.batchPlay([{ _obj: "save", as: { _obj: "photoshop35Format" }, in: { _path: assetToken } }], {});
                } else {
                    await action.batchPlay([{
                        _obj: "make",
                        _target: [{ _ref: "document" }],
                        using: { _ref: "layer", _enum: "ordinal", _value: "targetEnum" }
                    }], {});
                    tempDocs.push(app.activeDocument);
                    // FIX 3: Wrap trim in try/catch — it throws on certain layer types
                    // causing the whole modal to fail and leave the temp doc open
                    try {
                        await action.batchPlay([{ _obj: "trim", trimFreePixels: true }], {});
                    } catch (trimErr) {
                        console.warn("Trim skipped (non-fatal):", trimErr.message);
                    }
                    await action.batchPlay([{
                        _obj: "save",
                        as: { _obj: "PNGFormat", method: { _enum: "PNGMethod", _value: "quick" } },
                        in: { _path: assetToken }
                    }], {});
                }

                assetBuffer = await assetFile.read({ format: uxp.storage.formats.binary });
                console.log("Main asset binary captured.");

                // 2. Export Thumbnail
                if (tempDocs.length === 0) {
                    // smartObject path — create a doc for thumbnail
                    await action.batchPlay([{
                        _obj: "make",
                        _target: [{ _ref: "document" }],
                        using: { _ref: "layer", _id: info.id }
                    }], {});
                    tempDocs.push(app.activeDocument);
                }

                const thumbDoc = tempDocs[tempDocs.length - 1];
                const thumbSize = 250;
                const scale = Math.min(thumbSize / thumbDoc.width, thumbSize / thumbDoc.height, 1);
                if (scale < 1) {
                    try {
                        await thumbDoc.resizeImage(thumbDoc.width * scale, thumbDoc.height * scale);
                    } catch (e) {
                        console.warn("Resize skipped:", e.message);
                    }
                }

                await action.batchPlay([{
                    _obj: "save",
                    as: { _obj: "PNGFormat", method: { _enum: "PNGMethod", _value: "quick" } },
                    in: { _path: thumbToken }
                }], {});

                thumbBuffer = await thumbFile.read({ format: uxp.storage.formats.binary });
                console.log("Thumbnail binary captured.");

            } catch (e) {
                console.error("Capture Logic Fail", e);
                throw e;
            } finally {
                // FIX 2 (cont): Close ALL tracked temp docs, not just the last one
                await new Promise(r => setTimeout(r, 300));
                for (const doc of tempDocs) {
                    try { await doc.closeWithoutSaving(); } catch (e) {}
                }
                try { await assetFile.delete(); } catch (e) {}
                try { await thumbFile.delete(); } catch (e) {}
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

        // FIX 4: Defensive metadata access — was crashing with
        // "Cannot read properties of undefined (reading 'extension')"
        // when assetMetadata.metadata was undefined
        const metadata = (assetMetadata && assetMetadata.metadata) ? assetMetadata.metadata : (assetMetadata || {});
        const extension = metadata.extension || "png";

        const tempFile = await tempFolder.createFile(`temp_import.${extension}`, { overwrite: true });
        const fileToken = await fs.createSessionToken(tempFile);
        await tempFile.write(binaryData, { format: uxp.storage.formats.binary });

        const { app, action } = this.ps;
        const initialDoc = app.activeDocument;
        if (!initialDoc) throw new Error("No active document");

        await this.ps.core.executeAsModal(async () => {
            const tempDocs = [];
            try {
                if (metadata.type === "shape") {
                    const tempDoc = await app.open(tempFile);
                    if (tempDoc) tempDocs.push(tempDoc);
                    await action.batchPlay([{
                        _obj: "duplicate",
                        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                        to: { _ref: "document", _id: initialDoc.id }
                    }], {});
                } else {
                    await action.batchPlay([{
                        _obj: "placeEvent",
                        null: { _path: fileToken },
                        linked: false,
                        display: { _obj: "placeDisplay", offset: { _obj: "point", horizontal: 0, vertical: 0 } }
                    }], {});
                }
            } catch (e) {
                console.error("Import action failed:", e.message);
                throw e;
            } finally {
                await new Promise(r => setTimeout(r, 300));
                for (const doc of tempDocs) {
                    try { await doc.closeWithoutSaving(); } catch (e) {}
                }
                try { await tempFile.delete(); } catch (e) {}
            }
        }, { "commandName": "Importing Asset" });
    }
}

window.psHost = new PhotoshopHost();
