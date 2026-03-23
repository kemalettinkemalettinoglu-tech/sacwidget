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
                  "1-1": "New Year's Day", "1-24": "International Day of Education",
                "2-11": "Women & Girls in Science Day", "2-13": "World Radio Day 📻", "2-14": "Valentine's Day ❤️", "2-21": "Mother Language Day",
                "3-8": "International Women's Day", "3-20": "International Day of Happiness", "3-21": "World Poetry Day", "3-22": "World Water Day",
                "4-7": "World Health Day", "4-22": "Earth Day 🌍",
                "5-1": "Labour Day", "5-3": "World Press Freedom Day", "5-20": "World Bee Day 🐝",
                "6-5": "World Environment Day", "6-8": "World Oceans Day", "6-21": "International Day of Yoga",
                "7-11": "World Population Day", "7-18": "Nelson Mandela Day",
                "8-12": "International Youth Day", "8-19": "World Humanitarian Day",
                "9-15": "International Day of Democracy", "9-21": "International Day of Peace",
                "10-5": "World Teachers' Day", "10-16": "World Food Day", "10-24": "United Nations Day",
                "11-16": "International Day for Tolerance", "11-20": "World Children's Day",
                "12-1": "World AIDS Day", "12-10": "Human Rights Day"
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
