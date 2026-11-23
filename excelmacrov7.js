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
            <div class="card-title">📊 Excel Pivot Dönüştürücü</div>
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

    class ParameterUnpivotWidget extends HTMLElement {
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

                    if (jsonData.length < 3) throw new Error("Excel dosyasında yeterli satır yapısı bulunamadı.");

                    let headerRowIdx = -1;
                    for (let r = 0; r < Math.min(6, jsonData.length); r++) {
                        const rowStr = JSON.stringify(jsonData[r]).toUpperCase();
                        if (
                            rowStr.includes("COMPANY") ||
                            rowStr.includes("PLANT") ||
                            rowStr.includes("COST CENTER") ||
                            rowStr.includes("EMPLOYEE") ||
                            rowStr.includes("ŞİRKET") ||
                            rowStr.includes("SIRKET") ||
                            rowStr.includes("ÜRÜN") ||
                            rowStr.includes("URUN")
                        ) {
                            headerRowIdx = r;
                            break;
                        }
                    }

                    if (headerRowIdx === -1) headerRowIdx = 1;

                    const mainHeaders = jsonData[headerRowIdx];
                    const rowAbove = headerRowIdx > 0 ? jsonData[headerRowIdx - 1] : [];
                    const rows = jsonData.slice(headerRowIdx + 1);

                    let keyColsCount = 0;
                    for (let c = 0; c < mainHeaders.length; c++) {
                        const val = String(mainHeaders[c] || "").trim();
                        if (!isNaN(val) && val !== "" && val.length >= 6) {
                            break;
                        }
                        if (mainHeaders[c] !== null && String(mainHeaders[c]).trim() !== "") {
                            keyColsCount = c + 1;
                        }
                    }
                    if (keyColsCount === 0) keyColsCount = 4;

                    const isZeroOrEmpty = (val) => {
                        if (val === null || val === undefined) return true;
                        const str = String(val).trim();
                        if (
                            str === "" ||
                            str === "0" ||
                            str === "0.0" ||
                            str === "0.00" ||
                            str === "0,00" ||
                            str === "0,0" ||
                            str === "0%" ||
                            str === "0.0%" ||
                            str === "0,0%" ||
                            str === "0.00%" ||
                            str === "0,00%"
                        ) {
                            return true;
                        }
                        const cleanStr = str.replace("%", "").replace(",", ".");
                        const num = parseFloat(cleanStr);
                        return !isNaN(num) && num === 0;
                    };

                    const formatCellValue = (val) => {
                        const str = String(val).trim();
                        if (str.endsWith("%")) {
                            return str;
                        }
                        const num = parseFloat(str.replace(",", "."));
                        return !isNaN(num) ? num : str;
                    };

                    let currentMetric = "";
                    const metricsOrder = [];
                    const matrixColumns = [];

                    for (let j = keyColsCount; j < mainHeaders.length; j++) {
                        const dateVal = String(mainHeaders[j] || "").trim();
                        let cellMetric = String(rowAbove[j] || "").trim();
                        if (cellMetric && !isNaN(cellMetric)) cellMetric = "";

                        if (cellMetric) {
                            currentMetric = cellMetric;
                        }

                        if (!dateVal || isNaN(dateVal) || dateVal.length < 6) continue;

                        const metricName = currentMetric || "VALUE";
                        if (!metricsOrder.includes(metricName)) {
                            metricsOrder.push(metricName);
                        }

                        matrixColumns.push({
                            colIndex: j,
                            date: dateVal,
                            metric: metricName
                        });
                    }

                    if (metricsOrder.length === 0) {
                        throw new Error("Dönüştürülecek tarih ve metrik sütunu bulunamadı.");
                    }

                    const metricToParam = {};
                    metricsOrder.forEach((m, idx) => {
                        metricToParam[m] = "EXP" + (1006 + idx);
                    });

                    const outputHeaders = [];
                    for (let k = 0; k < keyColsCount; k++) {
                        outputHeaders.push(String(mainHeaders[k] || ("COL_" + (k + 1))).trim());
                    }
                    outputHeaders.push("PARAMETER");
                    outputHeaders.push("DATE");
                    metricsOrder.forEach(m => outputHeaders.push(m));

                    const outputRows = [outputHeaders];

                    rows.forEach(row => {
                        if (!row || row.length === 0) return;

                        const keyParts = [];
                        let hasAnyKey = false;
                        for (let k = 0; k < keyColsCount; k++) {
                            const kVal = String(row[k] ?? "").trim();
                            if (kVal !== "") hasAnyKey = true;
                            keyParts.push(kVal);
                        }
                        if (!hasAnyKey) return;

                        const dateMetricMap = new Map();
                        const dateOrder = [];

                        matrixColumns.forEach(col => {
                            const rawVal = row[col.colIndex];
                            if (!isZeroOrEmpty(rawVal)) {
                                if (!dateMetricMap.has(col.date)) {
                                    dateMetricMap.set(col.date, {});
                                    dateOrder.push(col.date);
                                }
                                dateMetricMap.get(col.date)[col.metric] = formatCellValue(rawVal);
                            }
                        });

                        dateOrder.forEach(dateStr => {
                            const foundMetrics = dateMetricMap.get(dateStr);
                            metricsOrder.forEach(metricName => {
                                if (foundMetrics[metricName] !== undefined) {
                                    const newRow = [
                                        ...keyParts,
                                        metricToParam[metricName],
                                        dateStr
                                    ];

                                    metricsOrder.forEach(mCol => {
                                        if (mCol === metricName) {
                                            newRow.push(foundMetrics[metricName]);
                                        } else {
                                            newRow.push("");
                                        }
                                    });

                                    outputRows.push(newRow);
                                }
                            });
                        });
                    });

                    const newWs = XLSX.utils.aoa_to_sheet(outputRows);
                    const newWb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWb, newWs, "Donusturulmus_Veri");
                    XLSX.writeFile(newWb, "Donusturulmus_Veri.xlsx");

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

    if (!customElements.get("sac-parameter-unpivot-widget")) {
        customElements.define("sac-parameter-unpivot-widget", ParameterUnpivotWidget);
    }
})();