(function() {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: "72", Arial, sans-serif;
                overflow: hidden;
                background: transparent;
                color: #333333;
            }
            .marquee-container {
                width: 100%;
                white-space: nowrap;
                overflow: hidden;
                padding: 10px 0;
            }
            .marquee-text {
                display: inline-block;
                padding-left: 100%;
                animation: marquee 25s linear infinite;
                font-weight: bold;
                font-size: 1.1rem;
            }
            .item { margin-right: 60px; }
            .highlight { color: #c0392b; text-transform: uppercase; } /* Red for TR days */
            .intl { color: #2980b9; } /* Blue for International days */
            @keyframes marquee {
                0%   { transform: translate(0, 0); }
                100% { transform: translate(-100%, 0); }
            }
        </style>
        <div class="marquee-container">
            <div id="ticker" class="marquee-text">Loading daily data...</div>
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
            
            // Turkish Holidays (English)
            const trDays = {
                "4-23": "National Sovereignty and Children's Day 🇹🇷",
                "5-19": "Atatürk Commemoration, Youth and Sports Day 🇹🇷",
                "8-30": "Victory Day 🇹🇷",
                "10-29": "Republic Day 🇹🇷"
            };

            // Selected International Days (Sample of major ones for every month)
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

            let message = "";
            if (trDays[key]) message += `<span class="highlight">✨ Today is ${trDays[key]}! </span>`;
            if (intlDays[key]) message += `<span class="intl">🌍 ${intlDays[key]} </span>`;
            
            return message || "✨ Have a wonderful day!";
        }

        async fetchData() {
            try {
                const response = await fetch('https://www.floatrates.com/daily/try.json');
                const data = await response.json();
                const usd = (1 / data.usd.rate).toFixed(4);
                const eur = (1 / data.eur.rate).toFixed(4);

                this.shadowRoot.getElementById("ticker").innerHTML = `
                    <span class="item">${this.getDailyCelebration()}</span>
                    <span class="item">💵 USD/TRY: <b>${usd}</b></span>
                    <span class="item">💶 EUR/TRY: <b>${eur}</b></span>
                    <span class="item">📅 ${new Date().toLocaleDateString('en-GB')}</span>
                `;
            } catch (e) { this.shadowRoot.getElementById("ticker").innerText = "Connection error."; }
        }
    }
    customElements.define("currency-ticker-widget", CurrencyTicker);
})();
