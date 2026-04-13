class IllustratorHost {
    constructor() {
        this._ai = null;
    }

    get ai() {
        if (!this._ai) {
            try {
                this._ai = require("illustrator");
            } catch (e) {
                console.warn("Illustrator module not available");
            }
        }
        return this._ai;
    }

    async importAsset(assetMetadata, binaryData) {
        if (!this.ai) throw new Error("Illustrator host not available");

        const { localFileSystem } = require('uxp').storage;
        const tempFolder = await localFileSystem.getTemporaryFolder();
        
        const isSvg = assetMetadata.type === 'illustrator' || assetMetadata.name.toLowerCase().endsWith('.svg');
        const fileName = isSvg ? "temp_import.svg" : "temp_import.png";
        
        const tempFile = await tempFolder.createFile(fileName, { overwrite: true });
        await tempFile.write(binaryData, { format: require('uxp').storage.formats.binary });

        const { app } = this.ai;
        const doc = app.activeDocument;
        if (!doc) throw new Error("No active document in Illustrator");

        const placedItem = doc.placedItems.add();
        placedItem.file = tempFile.nativePath; 

        const ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        const abRect = ab.artboardRect;
        
        const abCenter = [
            (abRect[0] + abRect[2]) / 2,
            (abRect[1] + abRect[3]) / 2
        ];

        const itemWidth = placedItem.width;
        const itemHeight = placedItem.height;

        placedItem.position = [
            abCenter[0] - (itemWidth / 2),
            abCenter[1] + (itemHeight / 2)
        ];
        
        if (!isSvg) {
            placedItem.embed();
        }
    }
}

window.aiHost = new IllustratorHost();
