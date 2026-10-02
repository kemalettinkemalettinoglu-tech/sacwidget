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
                padding: 20px;
                max-width: 480px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .card-title {
                margin: 0 0 16px 0;
                font-size: 16px;
                font-weight: 600;
                color: #1d2d3e;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .drop-zone {
                border: 2px dashed #b0c4de;
                border-radius: 6px;
                padding: 24px;
                text-align: center;
                background: #f8fafc;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .drop-zone:hover, .drop-zone.dragover {
                border-color: #0070f2;
                background: #f0f7ff;
            }
            .drop-icon {
                font-size: 28px;
                margin-bottom: 8px;
                color: #0070f2;
            }
            .drop-text {
                font-size: 13px;
                color: #555555;
                margin-bottom: 4px;
            }
            .file-name {
                font-size: 12px;
                font-weight: 600;
                color: #0070f2;
                margin-top: 6px;
                word-break: break-all;
            }
            input[type="file"] {
                display: none;
            }
            .btn-action {
                width: 100%;
                margin-top: 16px;
                padding: 10px;
                background-color: #0070f2;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            }
            .btn-action:hover {
                background-color: #0054b4;
            }
            .btn-action:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            .status-msg {
                margin-top: 12px;
                font-size: 12px;
                text-align: center;
            }
            .status-msg.success { color: #107e3e; }
            .status-msg.error { color: #bb0000; }
        </style>

        <div>
            <div class="card-title">
                📊 Excel Tablo Dönüştürücü
            </div>
            
            <div class="drop-zone" id="dropZone">
                <div class="drop-icon">📁</div>
                <div class="drop-text">Excel dosyanızı buraya sürükleyin</div>
                <div class="drop-text" style="font-size: 11px; color: #888;">veya dosya seçmek için tıklayın</div>
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

            // SheetJS Kütüphanesini Arka Planda Yükleme
            if (!window.XLSX) {
                const script = document.createElement("script");
                script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
                document.head.appendChild(script);
            }
        }

        connectedCallback() {
            const dropZone = this._shadowRoot.getElementById("dropZone");
            const fileInput = this._shadowRoot.getElementById("fileInput");
            const convertBtn = this._shadowRoot.getElementById("convertBtn");
            const fileNameDisplay = this._shadowRoot.getElementById("fileName");

            dropZone.addEventListener("click", () => fileInput.click());

            dropZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                dropZone.classList.add("dragover");
            });

            dropZone.addEventListener("dragleave", () => {
                dropZone.classList.remove("dragover");
            });

            dropZone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropZone.classList.remove("dragover");
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener("change", (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });

            convertBtn.addEventListener("click", () => {
                if (this._selectedFile) {
                    this.processExcel(this._selectedFile);
                }
            });
        }

        handleFileSelect(file) {
            this._selectedFile = file;
            const fileNameDisplay = this._shadowRoot.getElementById("fileName");
            const convertBtn = this._shadowRoot.getElementById("convertBtn");
            const statusMsg = this._shadowRoot.getElementById("statusMsg");

            fileNameDisplay.textContent = file.name;
            convertBtn.disabled = false;
            statusMsg.textContent = "";
        }

        processExcel(file) {
            const statusMsg = this._shadowRoot.getElementById("statusMsg");
            statusMsg.className = "status-msg";
            statusMsg.textContent = "İşleniyor...";

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    if (jsonData.length < 2) {
                        throw new Error("Dosyada yeterli veri bulunamadı.");
                    }

                    const headers = jsonData[0];
                    const rows = jsonData.slice(1);

                    // 1. Gösterge (Miktar/Fiyat/Tutar) Sütununu Tespit Et
                    let typeCol = -1;
                    for (let j = 0; j < headers.length; j++) {
                        const hVal = String(headers[j]).trim();
                        // 6 haneli sayısal tarih başlığı gördüğümüz sütunun bir öncesi tür sütunudur
                        if (!isNaN(hVal) && hVal.length >= 6) {
                            typeCol = j - 1;
                            break;
                        }
                    }

                    if (typeCol === -1) {
                        // Eğer başlıktan bulunamadıysa metin kontrolü yap
                        for (let j = 0; j < headers.length; j++) {
                            const val = String(rows[0][j] || "").toUpperCase();
                            if (val.includes("MİKTAR") || val.includes("MIKTAR") || val.includes("FİYAT") || val.includes("FIYAT") || val.includes("TUTAR")) {
                                typeCol = j;
                                break;
                            }
                        }
                    }

                    if (typeCol === -1) {
                        throw new Error("Gösterge (Miktar/Fiyat/Tutar) sütunu otomatik algılanamadı.");
                    }

                    const keyColsCount = typeCol;
                    const dateStartCol = typeCol + 1;

                    // 2. Metrik Türlerini Tespit Et
                    const metrics = Array.from(new Set(
                        rows.map(r => String(r[typeCol] || "").trim()).filter(Boolean)
                    ));

                    // 3. Dönüştürme/Gruplama Mantığı
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
                                groupedData[groupKey] = {
                                    keyParts: keyParts,
                                    date: dateVal,
                                    values: {}
                                };
                                metrics.forEach(m => groupedData[groupKey].values[m] = 0);
                            }

                            const cellVal = parseFloat(row[j]) || 0;
                            groupedData[groupKey].values[metricName] = cellVal;
                        }
                    });

                    // 4. Yeni Tablo Başlıkları ve Satırları
                    const outputHeaders = [];
                    for (let k = 0; k < keyColsCount; k++) {
                        outputHeaders.push(headers[k]);
                    }
                    outputHeaders.push("Tarih");
                    metrics.forEach(m => outputHeaders.push(m));

                    const outputRows = [outputHeaders];

                    Object.keys(groupedData).forEach(gKey => {
                        const item = groupedData[gKey];
                        const rowData = [...item.keyParts, item.date];
                        metrics.forEach(m => rowData.push(item.values[m]));
                        outputRows.push(rowData);
                    });

                    // 5. İndirme Dosyası Oluşturma
                    const newWs = XLSX.utils.aoa_to_sheet(outputRows);
                    const newWb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWb, newWs, "Dönüştürülmüş_Veri");

                    XLSX.writeFile(newWb, "Donusturulmus_Veri.xlsx");

                    statusMsg.className = "status-msg success";
                    statusMsg.textContent = "✓ Başarıyla dönüştürüldü ve indirildi!";
                } catch (err) {
                    statusMsg.className = "status-msg error";
                    statusMsg.textContent = "Hata: " + err.message;
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    customElements.define("sac-simple-unpivot-widget", SimpleUnpivotWidget);
})();