const uxp = window.require ? require("uxp") : null;
const host = uxp ? uxp.host : { name: "Unknown" };

document.addEventListener("DOMContentLoaded", async () => {
    const assetGrid = document.getElementById("asset-grid");
    const saveBtn = document.getElementById("save-btn");
    const statusBar = document.getElementById("status-bar");
    const searchInput = document.getElementById("search");

    function updateStatus(msg) {
        if (statusBar) statusBar.innerText = "• " + msg;
        console.log("Status:", msg);
    }

    // Initialize Storage
    try {
        updateStatus("Loading assets...");
        await window.storageManager.init();
        await refreshList();
        // AUTO-FOCUS Search Bar for "Automatic" feel
        if (searchInput) searchInput.focus();
    } catch (e) {
        updateStatus("Init Error: " + e.message);
    }

    async function refreshList() {
        try {
            const assets = await window.storageManager.getAssets();
            const query = (searchInput.value || "").toLowerCase();
            const filtered = assets.filter(a => (a.name || "").toLowerCase().includes(query));
            
            if (filtered.length === 0) {
                assetGrid.innerHTML = `<div style="padding:40px; color:#666; text-align:center;">${query ? "No matches found." : "No assets saved yet."}</div>`;
                updateStatus(query ? "No matches" : "Ready (0 assets)");
                return;
            }

            let html = "";
            filtered.forEach(asset => {
                const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
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
            updateStatus(query ? `Filtering... (${filtered.length} found)` : `Library Ready (${assets.length} items)`);

            // --- ADVANCED EVENT DELEGATION (Bulletproof Deletes) ---
            assetGrid.onclick = async (e) => {
                const delBtn = e.target.closest(".item-del-btn");
                if (delBtn) {
                    const id = delBtn.id.replace("del-", "");
                    updateStatus("Deleting...");
                    const success = await window.storageManager.deleteAsset(id);
                    if (success) {
                        updateStatus("Deleted successfully.");
                        await refreshList();
                    }
                    return;
                }
            };

            // Apply Listeners for Double-Click Import
            filtered.forEach(asset => {
                const item = document.getElementById(`item-${asset.id}`);
                if (item) {
                    item.addEventListener("dblclick", () => importAsset(asset));
                }

                // Load Thumb in background
                window.storageManager.getThumbnailUrl(asset.id).then(url => {
                    const img = document.getElementById(`img-${asset.id}`);
                    if (img && url) img.src = url;
                }).catch(e => console.warn("Thumb fail", e));
            });

        } catch (e) {
            updateStatus("Render Error: " + e.message);
        }
    }

    // SEARCH LISTENER
    searchInput.addEventListener("input", () => refreshList());

    saveBtn.addEventListener("click", async () => {
        updateStatus("Saving Selection...");
        try {
            if (host.name.toLowerCase() === "photoshop") {
                const { thumbBuffer, assetBuffer, metadata } = await window.psHost.extractAssetData();
                const id = Date.now().toString();
                await window.storageManager.saveAsset({id, name: metadata.name}, assetBuffer, thumbBuffer);
                updateStatus("Saved!");
                await refreshList();
            }
        } catch (e) {
            alert("Save Fail: " + e.message);
        } finally {
            setTimeout(() => {
                if (statusBar.innerText.includes("Saved")) updateStatus(`Ready`);
            }, 3000);
        }
    });

    async function importAsset(asset) {
        updateStatus(`Importing ${asset.name}...`);
        try {
            const binary = await window.storageManager.getAssetBinary(asset.id);
            if (binary) {
                await window.psHost.importAsset(asset, binary);
                updateStatus("Imported!");
            }
        } catch (e) {
            alert("Import Fail: " + e.message);
        } finally {
            setTimeout(() => updateStatus(`Ready`), 3000);
        }
    }
});
