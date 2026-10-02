(function () {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: #ffffff;
                border: 1px solid #d9d9d9;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .card-title {
                margin: 0 0 12px 0;
                font-size: 15px;
                font-weight: 600;
                color: #1d2d3e;
            }
            .drop-zone {
                border: 2px dashed #b0c4de;
                border-radius: 6px;
                padding: 20px;
                text-align: center;
                background: #f8fafc;
                cursor: pointer;
            }
            .drop-zone:hover {
                border-color: #0070f2;
                background: #f0f7ff;
            }
            .drop-icon {
                font-size: 24px;
                margin-bottom: 6px;
                color: #0070f2;
            }
            .drop-text {
                font-size: 12px;
                color: #555555;
            }
            .file-name {
                font-size: 12px;
                font-weight: 600;
                color: #0070f2;
                margin-top: 6px;
            }
            input[type="file"] {
                display: none;
            }
            .btn-action {
                width: 100%;
                margin-top: 12px;
                padding: 10px;
                background-color: #0070f2;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            }
            .btn-action:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            .status-msg {
                margin-top: 10px;
                font-size: 12px;
                text-align: center;
            }
            .status-msg.success { color: #107e3e; }
            .status-msg.error { color: #bb0000; }
        </style>

        <div>
            <div class="card-title">📊 Excel Tablo Dönüştürücü</div>
            <div class="drop-zone" id="dropZone">
                <div class="drop-icon">📁</div>
                <div class="drop-text">Excel dosyanızı sürükleyin veya tıklayın</div>
                <div class="file-name" id="fileName"></div>
            </div>
            <input type="file" id="fileInput" accept=".xlsx, .xls, .csv" />
            <button class="btn-action" id="convertBtn" disabled>Dönüştür ve İndir</button>
            <div class="status-msg" id="statusMsg"></div>
        </div>
    `;

    class SimpleUnpivotWidget extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: "open" });
            this._shadowRoot.appendChild(template.content.cloneNode(true));
            this._selectedFile = null;
        }

        connectedCallback() {
            this.loadLibrary();

            const dropZone = this._shadowRoot.getElementById("dropZone");
            const fileInput = this._shadowRoot.getElementById("fileInput");
            const convertBtn = this._shadowRoot.getElementById("convertBtn");

            if (dropZone && fileInput) {
                dropZone.onclick = () => fileInput.click();
                dropZone.ondragover = (e) => e.preventDefault();
                dropZone.ondrop = (e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length > 0) {
                        this.handleFile(e.dataTransfer.files[0]);
                    }
                };
            }

            if (fileInput) {
                fileInput.onchange = (e) => {
                    if (e.target.files.length > 0) {
                        this.handleFile(e.target.files[0]);
                    }
                };
            }

            if (convertBtn) {
                convertBtn.onclick = () => {
                    if (this._selectedFile) {
                        this.processExcel(this._selectedFile);
                    }
                };
            }
        }

        loadLibrary() {
            if (!window.XLSX) {
                const script = document.createElement("script");
                script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
                document.head.appendChild(script);
            }
        }

        handleFile(file) {
            this._selectedFile = file;
            const fileNameDisplay = this._shadowRoot.getElementById("fileName");
            const convertBtn = this._shadowRoot.getElementById("convertBtn");

            if (fileNameDisplay) fileNameDisplay.textContent = file.name;
            if (convertBtn) convertBtn.disabled = false;
        }

        processExcel(file) {
            const statusMsg = this._shadowRoot.getElementById("statusMsg");
            if (statusMsg) {
                statusMsg.className = "status-msg";
                statusMsg.textContent = "İşleniyor...";
            }

            if (!window.XLSX) {
                if (statusMsg) {
                    statusMsg.className = "status-msg error";
                    statusMsg.textContent = "SheetJS kütüphanesi yükleniyor, tekrar deneyin.";
                }
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    if (jsonData.length < 2) throw new Error("Veri yetersiz.");

                    const headers = jsonData[0];
                    const rows = jsonData.slice(1);

                    let typeCol = -1;
                    for (let j = 0; j < headers.length; j++) {
                        const hVal = String(headers[j]).trim();
                        if (!isNaN(hVal) && hVal.length >= 6) {
                            typeCol = j - 1;
                            break;
                        }
                    }

                    if (typeCol === -1) {
                        for (let j = 0; j < headers.length; j++) {
                            const val = String(rows[0] ? rows[0][j] : "").toUpperCase();
                            if (val.includes("MİKTAR") || val.includes("MIKTAR") || val.includes("FİYAT") || val.includes("FIYAT") || val.includes("TUTAR")) {
                                typeCol = j;
                                break;
                            }
                        }
                    }

                    if (typeCol === -1) throw new Error("Gösterge sütunu bulunamadı.");

                    const keyColsCount = typeCol;
                    const dateStartCol = typeCol + 1;
                    const metrics = Array.from(new Set(rows.map(r => String(r[typeCol] || "").trim()).filter(Boolean)));
                    const groupedData = {};

                    rows.forEach(row => {
                        const metricName = String(row[typeCol] || "").trim();
                        if (!metricName) return;

                        for (let j = dateStartCol; j < headers.length; j++) {
                            const dateVal = String(headers[j]);
                            let keyParts = [];
                            for (let k = 0; k < keyColsCount; k++) {
                                keyParts.push(String(row[k] || "").trim());
                            }
                            const groupKey = keyParts.join("|") + "|" + dateVal;

                            if (!groupedData[groupKey]) {
                                groupedData[groupKey] = { keyParts, date: dateVal, values: {} };
                                metrics.forEach(m => groupedData[groupKey].values[m] = 0);
                            }

                            groupedData[groupKey].values[metricName] = parseFloat(row[j]) || 0;
                        }
                    });

                    const outputHeaders = [];
                    for (let k = 0; k < keyColsCount; k++) outputHeaders.push(headers[k]);
                    outputHeaders.push("Tarih");
                    metrics.forEach(m => outputHeaders.push(m));

                    const outputRows = [outputHeaders];
                    Object.keys(groupedData).forEach(gKey => {
                        const item = groupedData[gKey];
                        const rowData = [...item.keyParts, item.date];
                        metrics.forEach(m => rowData.push(item.values[m]));
                        outputRows.push(rowData);
                    });

                    const newWs = XLSX.utils.aoa_to_sheet(outputRows);
                    const newWb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWb, newWs, "Dönüştürülmüş_Veri");
                    XLSX.writeFile(newWb, "Donusturulmus_Veri.xlsx");

                    if (statusMsg) {
                        statusMsg.className = "status-msg success";
                        statusMsg.textContent = "✓ Başarıyla indirildi!";
                    }
                } catch (err) {
                    if (statusMsg) {
                        statusMsg.className = "status-msg error";
                        statusMsg.textContent = "Hata: " + err.message;
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        }

        // SAC Lifecycle boş metod tanımları (Hata almamak için gereklidir)
        onCustomWidgetBeforeUpdate(oChangedProperties) {}
        onCustomWidgetAfterUpdate(oChangedProperties) {}
        onCustomWidgetDestroy() {}
    }

    if (!customElements.get("sac-simple-unpivot-widget")) {
        customElements.define("sac-simple-unpivot-widget", SimpleUnpivotWidget);
    }
})();