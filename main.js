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

    const deleteOverlay = document.getElementById("delete-overlay");
    const deleteMsg = document.getElementById("delete-msg");
    const deleteConfirm = document.getElementById("delete-confirm");
    const deleteCancel = document.getElementById("delete-cancel");

    let currentFolderId = null;

    function updateStatus(msg) {
        if (statusBar) statusBar.innerText = "• " + msg;
    }

    let layoutTimer = null;
    function adjustLayout() {
        try {
            if (!header || !assetGrid) return;
            const headerHeight = header.offsetHeight || 140;
            const topMargin = 24; 
            assetGrid.style.top = (headerHeight + topMargin) + "px";
        } catch (e) {}
    }

    function debouncedLayout() {
        if (layoutTimer) clearTimeout(layoutTimer);
        layoutTimer = setTimeout(adjustLayout, 100);
    }

    if (typeof ResizeObserver !== "undefined") {
        try {
            const resizeObserver = new ResizeObserver(debouncedLayout);
            resizeObserver.observe(header);
        } catch (e) {}
    }
    window.addEventListener("resize", debouncedLayout);

    try {
        updateStatus("Loading...");
        await window.storageManager.init();
        await refreshList();
    } catch (e) {
        updateStatus("Init Error");
    }

    // CUSTOM PROMISE-BASED CONFIRMATION
    let deleteResolver = null;
    function showDeleteModal(name) {
        deleteMsg.innerText = `Are you sure you want to delete "${name}"? This cannot be undone.`;
        deleteOverlay.style.display = "flex";
        return new Promise(resolve => {
            deleteResolver = resolve;
        });
    }

    deleteConfirm.onclick = () => {
        deleteOverlay.style.display = "none";
        if (deleteResolver) deleteResolver(true);
    };
    deleteCancel.onclick = () => {
        deleteOverlay.style.display = "none";
        if (deleteResolver) deleteResolver(false);
    };

    async function refreshList() {
        try {
            const assets = await window.storageManager.getAssets();
            const folders = await window.storageManager.getFolders();
            const query = (searchInput.value || "").trim().toLowerCase();

            console.log(`Refreshing UI... Total Assets: ${assets.length}, Total Folders: ${folders.length}`);

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
                breadcrumb.innerText = "Search";
            } else {
                if (currentFolderId === null) {
                    displayFolders = folders;
                    displayAssets = assets.filter(a => !a.folderId || a.folderId === 'root');
                } else {
                    displayAssets = assets.filter(a => a.folderId === currentFolderId);
                }
            }

            if (displayFolders.length === 0 && displayAssets.length === 0) {
                assetGrid.innerHTML = `<div style="width:100%; padding:40px; color:#666; text-align:center;">Empty</div>`;
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

            [...displayFolders, ...displayAssets].forEach(item => {
                const delBtn = document.getElementById(`del-${item.id}`);
                const card = document.getElementById(`item-${item.id}`);

                if (delBtn) {
                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        console.log("Custom Delete requested for:", item.id);
                        if (await showDeleteModal(item.name)) {
                            updateStatus("Deleting...");
                            if (item.id.startsWith("folder_")) await window.storageManager.deleteFolder(item.id);
                            else await window.storageManager.deleteAsset(item.id);
                            await refreshList();
                        }
                    };
                }
                
                if (card) {
                    card.ondblclick = async () => {
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
                }
            });

        } catch (e) {
            updateStatus("Refresh Error");
            console.error(e);
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
        updateStatus("Capturing...");
        try {
            const data = await window.psHost.extractAssetData();
            if (!data || !data.assetBuffer) throw new Error("Capture fail");
            
            updateStatus("Saving...");
            const id = Date.now().toString();
            await window.storageManager.saveAsset({id, name: data.metadata.name, folderId, metadata: data.metadata}, data.assetBuffer, data.thumbBuffer);
            
            await refreshList();
            updateStatus("Saved Successfully!");
        } catch (e) { 
            updateStatus("Save Failed");
            alert("Error: " + e.message);
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
