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
            <div class="card-title">📊 Excel Matris Unpivot Dönüştürücü</div>
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

                    if (jsonData.length < 4) throw new Error("Excel dosyasında yeterli satır yapısı bulunamadı.");

                    // Satır Tanımları (Görseldeki yapıya birebir uygun):
                    const rowMetric = jsonData[0]; // 1. Satır: metrik (miktar vb.)
                    const rowYear = jsonData[1];   // 2. Satır: yıl (2026, 2027)
                    const rowMonth = jsonData[2];  // 3. Satır: ay numaraları ve anahtar başlıkları (Şirket Kodu, Ürün Numarası...)
                    const rows = jsonData.slice(3); // 4. Satırdan itibaren gerçek veriler

                    // Anahtar (Key) sütun sayısını bul (3. satırda metrik/ay barındırmayan sol sütunlar)
                    let keyColsCount = 0;
                    for (let c = 0; c < rowMonth.length; c++) {
                        const val = String(rowMonth[c] || "").trim().toUpperCase();
                        // Eğer hücre bir ay numarasıysa (1 ile 12 arası) veya boş değilse kontrol et
                        if (val && !isNaN(val) && parseInt(val) >= 1 && parseInt(val) <= 12) {
                            break;
                        }
                        if (rowMonth[c] !== null && rowMonth[c] !== "") {
                            keyColsCount = c + 1;
                        }
                    }
                    if (keyColsCount === 0) keyColsCount = 4; // Güvenlik (Şirket Kodu, Ürün, Alt Grup, Üst Grup için 4)

                    const isZeroOrEmpty = (val) => {
                        if (val === null || val === undefined) return true;
                        const str = String(val).trim();
                        if (str === "" || str === "0" || str === "0.0" || str === "0.00" || str === "0,00" || str === "0,0") return true;
                        const num = parseFloat(str.replace(",", "."));
                        return !isNaN(num) && num === 0;
                    };

                    // Metrik isimlerini topla (Örn: miktar)
                    let activeMetricsSet = new Set();
                    for (let j = keyColsCount; j < rowMonth.length; j++) {
                        let mName = String(rowMetric[j] || "").trim();
                        // Eğer üst satır boşsa solindakinden veya ana başlıktan al
                        if (!mName || !isNaN(mName)) {
                            for (let p = j; p >= keyColsCount; p--) {
                                if (rowMetric[p] &&isNaN(rowMetric[p])) {
                                    mName = String(rowMetric[p]).trim();
                                    break;
                                }
                            }
                        }
                        if (mName) activeMetricsSet.add(mName);
                    }
                    const metrics = Array.from(activeMetricsSet);
                    if (metrics.length === 0) metrics.push("Değer");

                    const groupedData = {};

                    // Sütunları tarayıp unpivot (dikeyleştirme) işlemi
                    for (let j = keyColsCount; j < rowMonth.length; j++) {
                        let metricName = String(rowMetric[j] || "").trim();
                        if (!metricName || !isNaN(metricName)) {
                            for (let p = j; p >= keyColsCount; p--) {
                                if (rowMetric[p] && isNaN(rowMetric[p])) {
                                    metricName = String(rowMetric[p]).trim();
                                    break;
                                }
                            }
                        }
                        if (!metricName) metricName = "Değer";

                        // Yıl bilgisini al (Merge edilmiş olabilir, sola doğru tara)
                        let yearPart = String(rowYear[j] || "").trim();
                        if (!yearPart || isNaN(yearPart) || yearPart.length < 4) {
                            for (let prev = j; prev >= keyColsCount; prev--) {
                                let pYear = String(rowYear[prev] || "").trim();
                                if (pYear && !isNaN(pYear) && pYear.length >= 4) {
                                    yearPart = pYear;
                                    break;
                                }
                            }
                        }

                        let monthPart = String(rowMonth[j] || "").trim();
                        if (!monthPart || isNaN(monthPart)) continue; // Ay bilgisi yoksa atla

                        // Yıl ve ayı birleştir (Örn: 2026 + 08 -> 202608)
                        let combinedDate = yearPart + monthPart.padStart(2, '0');

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
                                const cleanVal = String(rawVal).replace(",", ".");
                                const parsedVal = parseFloat(cleanVal);
                                groupedData[groupKey].values[metricName] = isNaN(parsedVal) ? rawVal : parsedVal;
                            }
                        });
                    }

                    // Çıktı Tablosu Başlıkları
                    const outputHeaders = [];
                    for (let k = 0; k < keyColsCount; k++) {
                        outputHeaders.push(rowMonth[k] || ("Kolon_" + (k + 1)));
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
                                rowData.push(""); // 0 veya boş değerler tamamen boş bırakılır
                            } else {
                                rowData.push(val);
                            }
                        });

                        outputRows.push(rowData);
                    });

                    const newWs = XLSX.utils.aoa_to_sheet(outputRows);
                    const newWb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWb, newWs, "Dönüştürülmüş_Veri");
                    XLSX.writeFile(newWb, "Donusturulmus_Matris_Veri.xlsx");

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