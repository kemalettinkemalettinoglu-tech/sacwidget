(function() {
    let template = document.createElement("template");
    template.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: "72", Arial, sans-serif;
                overflow: hidden;
                background: #2c3e50;
                color: #ffffff;
                border-radius: 4px;
            }
            .marquee-container {
                width: 100%;
                white-space: nowrap;
                overflow: hidden;
                box-sizing: border-box;
                padding: 10px 0;
            }
            .marquee-text {
                display: inline-block;
                padding-left: 100%;
                animation: marquee 15s linear infinite;
                font-weight: bold;
                font-size: 1.1rem;
            }
            .rate-item { margin-right: 50px; }
            .up { color: #2ecc71; } /* Green for positive display */
            @keyframes marquee {
                0%   { transform: translate(0, 0); }
                100% { transform: translate(-100%, 0); }
            }
        </style>
        <div class="marquee-container">
            <div id="ticker" class="marquee-text">Loading daily rates...</div>
        </div>
    `;

    class CurrencyTicker extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(template.content.cloneNode(true));
        }

        connectedCallback() {
            this.fetchRates();
        }

        async fetchRates() {
            try {
                // Fetching TRY relative to USD and EUR
                const response = await fetch('https://www.floatrates.com/daily/try.json');
                const data = await response.json();
                
                // Rates are inverse in this specific API (1 TRY = X USD), 
                // so we invert them to get 1 USD = X TRY
                const usdRate = (1 / data.usd.rate).toFixed(4);
                const eurRate = (1 / data.eur.rate).toFixed(4);
                const date = new Date().toLocaleDateString();

                this.shadowRoot.getElementById("ticker").innerHTML = `
                    <span class="rate-item">📅 ${date}</span>
                    <span class="rate-item">💵 USD/TRY: <span class="up">${usdRate}</span></span>
                    <span class="rate-item">💶 EUR/TRY: <span class="up">${eurRate}</span></span>
                `;
            } catch (error) {
                this.shadowRoot.getElementById("ticker").innerText = "Failed to load rates.";
            }
        }
    }

    customElements.define("currency-ticker-widget", CurrencyTicker);
})();