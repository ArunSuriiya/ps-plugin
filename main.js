const uxp = window.require ? require("uxp") : null;
const host = uxp ? uxp.host : { name: "Unknown" };

document.addEventListener("DOMContentLoaded", async () => {
    const assetGrid = document.getElementById("asset-grid");
    const saveBtn = document.getElementById("save-btn");
    const newFolderBtn = document.getElementById("new-folder-btn");
    const searchInput = document.getElementById("search");
    const statusBar = document.getElementById("status-bar");
    const backBtn = document.getElementById("back-btn");
    const breadcrumb = document.getElementById("breadcrumb");
    const header = document.getElementById("header");
    
    const pickerOverlay = document.getElementById("picker-overlay");
    const pickerList = document.getElementById("picker-list");
    const cancelPicker = document.getElementById("cancel-picker");

    const folderOverlay = document.getElementById("folder-overlay");
    const folderNameInput = document.getElementById("folder-name-input");
    const confirmFolder = document.getElementById("confirm-folder");
    const cancelFolder = document.getElementById("cancel-folder");

    let currentFolderId = null;

    function updateStatus(msg) {
        if (statusBar) statusBar.innerText = "• " + msg;
    }

    function adjustLayout() {
        try {
            if (!header || !assetGrid) return;
            const headerHeight = header.offsetHeight || 140;
            const topMargin = 24; 
            assetGrid.style.top = (headerHeight + topMargin) + "px";
        } catch (e) {}
    }

    if (typeof ResizeObserver !== "undefined") {
        try {
            const resizeObserver = new ResizeObserver(adjustLayout);
            resizeObserver.observe(header);
        } catch (e) {}
    }
    window.addEventListener("resize", adjustLayout);

    try {
        updateStatus("Loading Storage...");
        await window.storageManager.init();
        await refreshList();
    } catch (e) {
        updateStatus("Error Init");
    }

    async function refreshList() {
        try {
            const assets = await window.storageManager.getAssets();
            const folders = await window.storageManager.getFolders();
            const query = (searchInput.value || "").trim().toLowerCase();

            if (currentFolderId) {
                const folder = folders.find(f => f.id === currentFolderId);
                breadcrumb.innerText = "Library > " + (folder ? folder.name : "Folder");
                backBtn.style.display = "block";
            } else {
                breadcrumb.innerText = "Main Library";
                backBtn.style.display = "none";
            }

            let displayFolders = [];
            let displayAssets = [];

            if (query) {
                displayFolders = folders.filter(f => f.name.toLowerCase().includes(query));
                displayAssets = assets.filter(a => a.name.toLowerCase().includes(query));
                breadcrumb.innerText = "Search Result";
                backBtn.style.display = "block";
            } else {
                if (currentFolderId === null) {
                    displayFolders = folders;
                    displayAssets = assets.filter(a => a.folderId === null);
                } else {
                    displayAssets = assets.filter(a => a.folderId === currentFolderId);
                }
            }

            if (displayFolders.length === 0 && displayAssets.length === 0) {
                assetGrid.innerHTML = `<div style="grid-column:1/-1; padding:40px; color:#666; text-align:center;">Empty</div>`;
                return;
            }

            let html = "";
            const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

            displayFolders.forEach(folder => {
                html += `
                    <div class="list-item folder-item" id="item-${folder.id}">
                        <div class="item-thumb" style="font-size:24px;">📁</div>
                        <div class="item-name">${folder.name}</div>
                        <button class="item-del-btn" id="del-${folder.id}">✕</button>
                    </div>
                `;
            });

            displayAssets.forEach(asset => {
                html += `
                    <div class="list-item" id="item-${asset.id}">
                        <div class="item-thumb">
                            <img id="img-${asset.id}" src="${placeholder}">
                        </div>
                        <div class="item-name">${asset.name || "Untitled"}</div>
                        <button class="item-del-btn" id="del-${asset.id}">✕</button>
                    </div>
                `;
            });

            assetGrid.innerHTML = html;
            updateStatus(query ? `Filtered` : `Ready`);
            adjustLayout();

            assetGrid.onclick = async (e) => {
                const delBtn = e.target.closest(".item-del-btn");
                if (delBtn) {
                    const id = delBtn.id.replace("del-", "");
                    if (confirm("Delete permanently?")) {
                        if (id.startsWith("folder_")) await window.storageManager.deleteFolder(id);
                        else await window.storageManager.deleteAsset(id);
                        await refreshList();
                    }
                    return;
                }
            };

            [...displayFolders, ...displayAssets].forEach(item => {
                const dom = document.getElementById(`item-${item.id}`);
                if (!dom) return;
                
                dom.ondblclick = async () => {
                    if (item.id.startsWith("folder_")) {
                        currentFolderId = item.id;
                        searchInput.value = "";
                        await refreshList();
                    } else {
                        await importAsset(item);
                    }
                };

                if (!item.id.startsWith("folder_")) {
                    window.storageManager.getThumbnailUrl(item.id).then(url => {
                        const img = document.getElementById(`img-${item.id}`);
                        if (img && url) img.src = url;
                    }).catch(() => {});
                }
            });

        } catch (e) {
            updateStatus("Error Refresh");
        }
    }

    newFolderBtn.onclick = () => {
        folderNameInput.value = "";
        folderOverlay.style.display = "flex";
        folderNameInput.focus();
    };

    cancelFolder.onclick = () => folderOverlay.style.display = "none";

    confirmFolder.onclick = async () => {
        const name = folderNameInput.value.trim();
        if (name) {
            await window.storageManager.createFolder(name);
            folderOverlay.style.display = "none";
            await refreshList();
        }
    };

    saveBtn.onclick = async () => {
        try {
            const folders = await window.storageManager.getFolders();
            let pickerHtml = `<div class="picker-option" data-id="root">🏠 Main Library</div>`;
            folders.forEach(f => { pickerHtml += `<div class="picker-option" data-id="${f.id}">📂 ${f.name}</div>`; });
            pickerList.innerHTML = pickerHtml;
            pickerOverlay.style.display = "flex";
            
            pickerList.onclick = async (e) => {
                const opt = e.target.closest(".picker-option");
                if (opt) {
                    const fId = opt.getAttribute("data-id") === "root" ? null : opt.getAttribute("data-id");
                    pickerOverlay.style.display = "none";
                    await triggerSave(fId);
                }
            };
        } catch (e) { updateStatus("Save Error"); }
    };

    cancelPicker.onclick = () => pickerOverlay.style.display = "none";
    backBtn.onclick = () => { currentFolderId = null; refreshList(); };

    async function triggerSave(folderId) {
        updateStatus("Step 1: Capturing...");
        try {
            const data = await window.psHost.extractAssetData();
            if (!data || !data.assetBuffer) throw new Error("Capture fail");
            
            updateStatus("Step 2: Writing to disk...");
            const id = Date.now().toString();
            await window.storageManager.saveAsset({id, name: data.metadata.name, folderId, metadata: data.metadata}, data.assetBuffer, data.thumbBuffer);
            
            updateStatus("Step 3: Updating view...");
            await refreshList();
            updateStatus("Saved Successfully!");
        } catch (e) { 
            console.error(e);
            updateStatus("FAILED to Save Selection");
            alert("Save Failed: " + e.message);
        }
    }

    async function importAsset(asset) {
        updateStatus(`Importing...`);
        try {
            const binary = await window.storageManager.getAssetBinary(asset.id);
            if (binary) await window.psHost.importAsset(asset, binary);
            updateStatus("Imported!");
        } catch (e) { alert("Import Fail"); }
    }

    searchInput.addEventListener("input", () => refreshList());
});
