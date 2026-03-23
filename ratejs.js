(function() {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: "72", Arial, sans-serif;
                background: transparent;
                width: 100%;
            }
            .container {
                display: flex;
                justify-content: flex-end; /* Align to the right */
                align-items: center;
                padding: 10px 20px;
                gap: 25px;
                color: #333333;
                font-size: 0.95rem;
                font-weight: 500;
            }
            .section {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .divider {
                width: 1px;
                height: 20px;
                background-color: rgba(0,0,0,0.1);
            }
            .highlight { color: #c0392b; font-weight: bold; } /* Red for TR Days */
            .intl { color: #2980b9; font-style: italic; }    /* Blue for Intl Days */
            .rate-val { font-weight: 700; color: #27ae60; }
        </style>
        <div class="container" id="widget-container">
            <div id="celebration" class="section">Loading...</div>
            <div class="divider"></div>
            <div id="rates" class="section"></div>
            <div class="divider"></div>
            <div id="date" class="section"></div>
        </div>
    `;

    class CurrencyTicker extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(template.content.cloneNode(true));
        }

        connectedCallback() { this.fetchData(); }

        getDailyCelebration() {
            const now = new Date();
            const key = `${now.getMonth() + 1}-${now.getDate()}`;
            
            const trDays = {
                "4-23": "National Sovereignty and Children's Day 🇹🇷",
                "5-19": "Atatürk Commemoration, Youth and Sports Day 🇹🇷",
                "8-30": "Victory Day 🇹🇷",
                "10-29": "Republic Day 🇹🇷"
            };

            const intlDays = {
                "1-1": "New Year's Day", "2-14": "Valentine's Day ❤️",
                "3-8": "Intl. Women's Day", "3-22": "World Water Day",
                "3-23": "World Meteorological Day 🌤️", // Added for today!
                "4-22": "Earth Day 🌍", "5-1": "Labour Day",
                "10-29": "Republic Day 🇹🇷", "12-25": "Christmas"
            };

            if (trDays[key]) return `<span class="highlight">${trDays[key]}</span>`;
            if (intlDays[key]) return `<span class="intl">${intlDays[key]}</span>`;
            return "✨ Have a great day!";
        }

        async fetchData() {
            try {
                const response = await fetch('https://www.floatrates.com/daily/try.json');
                const data = await response.json();
                const usd = (1 / data.usd.rate).toFixed(4);
                const eur = (1 / data.eur.rate).toFixed(4);

                this.shadowRoot.getElementById("celebration").innerHTML = this.getDailyCelebration();
                this.shadowRoot.getElementById("rates").innerHTML = `
                    <span>USD/TRY <span class="rate-val">${usd}</span></span>
                    <span>EUR/TRY <span class="rate-val">${eur}</span></span>
                `;
                this.shadowRoot.getElementById("date").innerHTML = `📅 ${new Date().toLocaleDateString('en-GB')}`;
            } catch (e) {
                this.shadowRoot.getElementById("celebration").innerText = "Connection Error";
            }
        }
    }
    customElements.define("currency-ticker-widget", CurrencyTicker);
})();
