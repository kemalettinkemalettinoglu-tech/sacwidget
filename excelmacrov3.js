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
            <div class="card-title">📊 Excel Evrensel Unpivot Dönüştürücü</div>
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

                    if (jsonData.length < 3) throw new Error("Excel dosyasında yeterli satır yapısı bulunamadı.");

                    // Başlık satırlarını otomatik tespit et
                    let headerRowIdx = -1;
                    for (let r = 0; r < Math.min(5, jsonData.length); r++) {
                        const rowStr = JSON.stringify(jsonData[r]).toUpperCase();
                        if (rowStr.includes("ŞİRKET") || rowStr.includes("SIRKET") || rowStr.includes("ÜRÜN") || rowStr.includes("URUN") || rowStr.includes("PARA") || rowStr.includes("KOD")) {
                            headerRowIdx = r;
                            break;
                        }
                    }

                    if (headerRowIdx === -1) headerRowIdx = 1; // Varsayılan 2. satır

                    const mainHeaders = jsonData[headerRowIdx]; // Örn: Şirket Kodu, Ürün, Müşteri...
                    const rowAbove = headerRowIdx > 0 ? jsonData[headerRowIdx - 1] : []; // Üst satır (Metrik blokları: Miktar, Fiyat)
                    const rowTwoAbove = headerRowIdx > 1 ? jsonData[headerRowIdx - 2] : []; // 2 üst satır (Yıl/Ay bilgisi olabilir)
                    const rows = jsonData.slice(headerRowIdx + 1); // Gerçek veri satırları

                    // Anahtar (Key) sütun sayısını tespit et (Tarih veya sayısal başlık barındırmayan sol sütunlar)
                    let keyColsCount = 0;
                    for (let c = 0; c < mainHeaders.length; c++) {
                        const val = String(mainHeaders[c] || "").trim();
                        const upperVal = val.toUpperCase();
                        // Eğer hücre 6 haneli tarih (örn: 202602) veya metrik adıysa anahtar bitmiştir
                        if ((!isNaN(val) && val.length >= 6) || upperVal.includes("MIKTAR") || upperVal.includes("MİKTAR") || upperVal.includes("FIYAT") || upperVal.includes("FİYAT") || upperVal.includes("TUTAR")) {
                            break;
                        }
                        if (mainHeaders[c] !== null && mainHeaders[c] !== "") {
                            keyColsCount = c + 1;
                        }
                    }
                    if (keyColsCount === 0) keyColsCount = 5; // Güvenlik payı

                    const isZeroOrEmpty = (val) => {
                        if (val === null || val === undefined) return true;
                        const str = String(val).trim();
                        if (str === "" || str === "0" || str === "0.0" || str === "0.00" || str === "0,00" || str === "0,0") return true;
                        const num = parseFloat(str.replace(",", "."));
                        return !isNaN(num) && num === 0;
                    };

                    let activeMetricsSet = new Set();
                    for (let j = keyColsCount; j < mainHeaders.length; j++) {
                        let mName = String(rowAbove[j] || mainHeaders[j] || "").trim();
                        // Eğer üst satırda metrik yazıyorsa onu al, yoksa sola doğru tara (merge edilmiş blok)
                        if (!mName || !isNaN(mName) || mName.length >= 6) {
                            for (let p = j; p >= keyColsCount; p--) {
                                let candidate = String(rowAbove[p] || "").trim();
                                if (candidate && isNaN(candidate) && candidate.length < 6) {
                                    mName = candidate;
                                    break;
                                }
                            }
                        }
                        if (mName && isNaN(mName)) activeMetricsSet.add(mName);
                    }
                    const metrics = Array.from(activeMetricsSet);
                    if (metrics.length === 0) metrics.push("Değer");

                    const groupedData = {};

                    // Her sütunu (tarih/metrik kolonlarını) tara
                    for (let j = keyColsCount; j < mainHeaders.length; j++) {
                        let dateVal = String(mainHeaders[j] || "").trim();
                        let metricName = "";

                        // Üst satırdan metrik adını bulmaya çalış
                        for (let p = j; p >= keyColsCount; p--) {
                            let candidate = String(rowAbove[p] || "").trim();
                            if (candidate && isNaN(candidate) && candidate.length < 6) {
                                metricName = candidate;
                                break;
                            }
                        }
                        if (!metricName) metricName = "Değer";

                        // Eğer ana başlıkta tarih yazmıyorsa (örn sadece ay yazıyorsa) alt alta iki katmanlı kontrol et
                        if (!dateVal || isNaN(dateVal) || dateVal.length < 6) {
                            let yearPart = String(rowTwoAbove[j] || "").trim();
                            let monthPart = String(mainHeaders[j] || "").trim();
                            if (yearPart && monthPart && !isNaN(monthPart) && monthPart.length <= 2) {
                                dateVal = yearPart + monthPart.padStart(2, '0');
                            }
                        }

                        if (!dateVal || isNaN(dateVal)) continue; // Tarih çözülemediyse atla

                        rows.forEach(row => {
                            if (!row || row.length === 0) return;

                            let keyParts = [];
                            for (let k = 0; k < keyColsCount; k++) {
                                keyParts.push(String(row[k] || "").trim());
                            }

                            const groupKey = keyParts.join("|") + "|" + dateVal;

                            if (!groupedData[groupKey]) {
                                groupedData[groupKey] = { keyParts, date: dateVal, values: {} };
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
                        outputHeaders.push(mainHeaders[k] || ("Kolon_" + (k + 1)));
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
                                rowData.push(""); // Sıfır veya boş değerler boş bırakılır
                            } else {
                                rowData.push(val);
                            }
                        });

                        outputRows.push(rowData);
                    });

                    const newWs = XLSX.utils.aoa_to_sheet(outputRows);
                    const newWb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWb, newWs, "Dönüştürülmüş_Veri");
                    XLSX.writeFile(newWb, "Donusturulmus_Evrensel_Veri.xlsx");

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

    if (!customElements.get("sac-simple-unpivot-widget2")) {
        customElements.define("sac-simple-unpivot-widget2", SimpleUnpivotWidget2);
    }
})();