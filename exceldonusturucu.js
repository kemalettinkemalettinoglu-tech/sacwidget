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
            <div class="card-title">📊 Excel Çok Katmanlı Unpivot Dönüştürücü</div>
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
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null });

                    if (jsonData.length < 4) throw new Error("Excel yapısı için yeterli satır bulunamadı.");

                    // Başlık satırları analizi (Örn: 0. satır metrikler, 1. veya 2. satır yıllar/aylar)
                    const row0 = jsonData[0]; // Metrikler (zam oranı, miktar vb.)
                    const row1 = jsonData[1]; // Yıllar veya üst başlıklar
                    const row2 = jsonData[2]; // Ay veya alt tarih bilgileri

                    // Anahtar (Key) sütun sayısını tespit et (sol taraftaki metrik/tarih barındırmayan sabit kolonlar)
                    let keyColsCount = 0;
                    for (let c = 0; c < row0.length; c++) {
                        const val0 = String(row0[c] || "").trim().toUpperCase();
                        const val1 = String(row1[c] || "").trim().toUpperCase();
                        const val2 = String(row2[c] || "").trim().toUpperCase();

                        if (val0.includes("MİKTAR") || val0.includes("MIKTAR") || val0.includes("ZAM") || val0.includes("TUTAR") || val0.includes("FİYAT") || (!isNaN(val0) && val0.length >= 4)) {
                            break;
                        }
                        if (val1.includes("MİKTAR") || val1.includes("MIKTAR") || val1.includes("ZAM") || val1.includes("TUTAR") || val1.includes("FİYAT") || (!isNaN(val1) && val1.length >= 4)) {
                            break;
                        }
                        if (row0[c] !== null && row0[c] !== "") {
                            keyColsCount = c + 1;
                        }
                    }

                    if (keyColsCount === 0) keyColsCount = 1;

                    const rows = jsonData.slice(3); // Gerçek veri satırları 3. satırdan itibaren başlıyor

                    const isZeroOrEmpty = (val) => {
                        if (val === null || val === undefined) return true;
                        const str = String(val).trim();
                        if (str === "" || str === "0" || str === "0.0" || str === "0.00" || str === "0,00" || str === "0,0" || str === "%0" || str === "0%") return true;
                        const cleanStr = str.replace("%", "").replace(",", ".");
                        const num = parseFloat(cleanStr);
                        return !isNaN(num) && num === 0;
                    };

                    let activeMetricsSet = new Set();
                    for (let j = keyColsCount; j < row0.length; j++) {
                        let mName = String(row0[j] || row2[j] || "").trim();
                        if (mName && !mName.match(/^\d+$/)) {
                            activeMetricsSet.add(mName);
                        }
                    }
                    const metrics = Array.from(activeMetricsSet);
                    if (metrics.length === 0) metrics.push("Değer");

                    const groupedData = {};

                    // Sütunları tarayarak tarih ve metrikleri birleştirme
                    for (let j = keyColsCount; j < row0.length; j++) {
                        let metricName = String(row0[j] || "").trim();
                        if (!metricName || !isNaN(metricName)) {
                            metricName = String(row2[j] || "Değer").trim();
                        }

                        // Üst satırlardan yıl ve ayı akıllıca yakala
                        let yearPart = String(row1[j] || "").trim();
                        let monthPart = String(row2[j] || "").trim();

                        // Eğer yıl boşsa ve önceki sütunlarda yıl yazılmışsa (merge edilmiş gibi) soldakinden al
                        if (!yearPart || isNaN(yearPart) || yearPart.length < 4) {
                            for (let prev = j - 1; prev >= keyColsCount; prev--) {
                                let pYear = String(row1[prev] || "").trim();
                                if (pYear && !isNaN(pYear) && pYear.length >= 4) {
                                    yearPart = pYear;
                                    break;
                                }
                            }
                        }

                        let combinedDate = "";
                        if (yearPart && monthPart && !isNaN(monthPart) && monthPart.length <= 2) {
                            // Yıl ve ay ayrı hücredeyse formatla (Örn: 2026 ve 8 -> 202608)
                            let mStr = monthPart.padStart(2, '0');
                            combinedDate = yearPart + mStr;
                        } else if (yearPart && !isNaN(yearPart) && yearPart.length === 6) {
                            // Direkt 202601 formatındaysa
                            combinedDate = yearPart;
                        } else {
                            combinedDate = yearPart || monthPart || ("Col_" + j);
                        }

                        rows.forEach(row => {
                            if (!row || row.length === 0) return;

                            let keyParts = [];
                            for (let k = 0; k < keyColsCount; k++) {
                                keyParts.push(String(row[k] || "").trim());
                            }

                            const groupKey = keyParts.join("|") + "|" + combinedDate;

                            if (!groupedData[groupKey]) {
                                groupedData[groupKey] = { keyParts, date: combinedDate, values: {} };
                            }

                            const rawVal = row[j];
                            if (!isZeroOrEmpty(rawVal)) {
                                const cleanVal = String(rawVal).replace("%", "").replace(",", ".");
                                const parsedVal = parseFloat(cleanVal);
                                groupedData[groupKey].values[metricName] = isNaN(parsedVal) ? rawVal : parsedVal;
                            }
                        });
                    }

                    // Çıktı başlıkları
                    const outputHeaders = [];
                    for (let k = 0; k < keyColsCount; k++) {
                        outputHeaders.push(row0[k] || ("Kolon_" + (k + 1)));
                    }
                    outputHeaders.push("Tarih");
                    metrics.forEach(m => outputHeaders.push(m));

                    const outputRows = [outputHeaders];

                    Object.keys(groupedData).forEach(gKey => {
                        const item = groupedData[gKey];
                        const rowData = [...item.keyParts, item.date];

                        metrics.forEach(m => {
                            const val = item.values[m];
                            if (isZeroOrEmpty(val)) {
                                rowData.push(""); // Sıfır veya boş değerler tamamen boş bırakılır
                            } else {
                                rowData.push(val);
                            }
                        });

                        outputRows.push(rowData);
                    });

                    const newWs = XLSX.utils.aoa_to_sheet(outputRows);
                    const newWb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWb, newWs, "Donusturulmus_Veri");
                    XLSX.writeFile(newWb, "Donusturulmus_Detayli_Veri.xlsx");

                    if (statusMsg) {
                        statusMsg.className = "status-msg success";
                        statusMsg.textContent = "✓ Başarıyla dönüştürüldü ve indirildi!";
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

        onCustomWidgetBeforeUpdate(oChangedProperties) {}
        onCustomWidgetAfterUpdate(oChangedProperties) {}
        onCustomWidgetDestroy() {}
    }

    if (!customElements.get("sac-simple-unpivot-widget")) {
        customElements.define("sac-simple-unpivot-widget", SimpleUnpivotWidget);
    }
})();