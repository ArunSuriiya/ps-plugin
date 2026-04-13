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
    
    // Picker Elements
    const pickerOverlay = document.getElementById("picker-overlay");
    const pickerList = document.getElementById("picker-list");
    const cancelPicker = document.getElementById("cancel-picker");

    let currentFolderId = null;

    function updateStatus(msg) {
        if (statusBar) statusBar.innerText = "• " + msg;
    }

    // DYNAMIC LAYOUT ADJUSTER (Fixes the "Overlap" when header wraps)
    function adjustLayout() {
        if (!header || !assetGrid) return;
        const headerHeight = header.offsetHeight;
        const topMargin = 24; // Status bar height
        assetGrid.style.top = (headerHeight + topMargin) + "px";
    }

    // Measure every time the window resizes or buttons wrap
    window.addEventListener("resize", adjustLayout);
    const resizeObserver = new ResizeObserver(adjustLayout);
    resizeObserver.observe(header);

    // Initialize Storage
    try {
        updateStatus("Loading...");
        await window.storageManager.init();
        await refreshList();
    } catch (e) {
        updateStatus("Error: " + e.message);
    }

    async function refreshList() {
        try {
            const assets = await window.storageManager.getAssets();
            const folders = await window.storageManager.getFolders();
            const query = (searchInput.value || "").toLowerCase();

            // Navigation Update
            if (currentFolderId) {
                const folder = folders.find(f => f.id === currentFolderId);
                breadcrumb.innerText = "Library > " + (folder ? folder.name : "");
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
                breadcrumb.innerText = "Search Results";
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

            // FOLDERS
            displayFolders.forEach(folder => {
                html += `
                    <div class="list-item folder-item" id="item-${folder.id}">
                        <div class="item-thumb" style="font-size:24px;">📁</div>
                        <div class="item-name">${folder.name}</div>
                        <button class="item-del-btn" id="del-${folder.id}">✕</button>
                    </div>
                `;
            });

            // ASSETS
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
            updateStatus(query ? `Filtering...` : `Ready`);
            adjustLayout();

            // Event Delegation
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

            // Card Click Events
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
            updateStatus("Error Refreshing");
        }
    }

    newFolderBtn.onclick = async () => {
        const name = prompt("Folder Name:");
        if (name) {
            await window.storageManager.createFolder(name);
            await refreshList();
        }
    };

    backBtn.onclick = async () => {
        currentFolderId = null;
        await refreshList();
    };

    saveBtn.onclick = async () => {
        const folders = await window.storageManager.getFolders();
        let pickerHtml = `<div class="picker-option" data-id="null">🏠 Main Library</div>`;
        folders.forEach(f => { pickerHtml += `<div class="picker-option" data-id="${f.id}">📂 ${f.name}</div>`; });
        pickerList.innerHTML = pickerHtml;
        pickerOverlay.style.display = "flex";
        
        pickerList.querySelectorAll(".picker-option").forEach(opt => {
            opt.onclick = async () => {
                const fId = opt.getAttribute("data-id") === "null" ? null : opt.getAttribute("data-id");
                pickerOverlay.style.display = "none";
                await triggerSave(fId);
            };
        });
    };

    cancelPicker.onclick = () => pickerOverlay.style.display = "none";

    async function triggerSave(folderId) {
        updateStatus("Saving...");
        try {
            const { thumbBuffer, assetBuffer, metadata } = await window.psHost.extractAssetData();
            await window.storageManager.saveAsset({id: Date.now().toString(), name: metadata.name, folderId}, assetBuffer, thumbBuffer);
            updateStatus("Saved!");
            await refreshList();
        } catch (e) { alert(e.message); }
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
