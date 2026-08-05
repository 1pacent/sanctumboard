/* ============================================================
   Prices, from the catalogue that charges them.

   This site used to hardcode A$99/199/499. The API returned USD 59/149/299.
   Stripe charged A$89/229/799. Three price lists, none agreeing, on the page
   where a customer decides what to pay — and the site's copy was the only one
   a customer ever saw.

   So nothing here is written down. Every figure, every plan name and the
   availability of the trial come from demo.sanctumboard.com/api/plans, which
   reads the same table checkout charges from. A shopfront that keeps its own
   copy of the prices is how that happened, and the only fix that holds is not
   keeping one.

   IF THE FETCH FAILS we show a link, never a number. A stale price is worse
   than no price: one of them is an inconvenience, the other is quoting a
   figure we will not honour.
   ============================================================ */

(function () {
  "use strict";

  var API = "https://demo.sanctumboard.com/api/plans";
  var START = "https://demo.sanctumboard.com/start";

  var el = function (id) { return document.getElementById(id); };

  function money(n) {
    return "A$" + Number(n).toLocaleString("en-AU", {
      minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2
    });
  }

  /** The saving, computed from the two real numbers rather than asserted. */
  function saving(p) {
    if (!p.priceAudMonth || !p.priceAudYear) return null;
    var full = p.priceAudMonth * 12;
    if (full <= p.priceAudYear) return null;
    return Math.round(((full - p.priceAudYear) / full) * 100);
  }

  function planCard(p, term, trial) {
    var card = document.createElement("div");
    card.className = "plan" + (p.key === "professional" ? " plan--feature" : "");

    var h = document.createElement("h3");
    h.textContent = p.displayName;
    card.appendChild(h);

    // A tier we set up by hand must never show a price and a Buy button — the
    // signup route turns that into "we'll be in touch", which reads as a
    // failure when the page has just quoted a figure and taken a click.
    if (p.selfServe === false) {
      var talk = document.createElement("p");
      talk.className = "plan__price plan__price--talk";
      talk.textContent = "Let's talk";
      card.appendChild(talk);
    } else {
      var annual = term === "year" && p.priceAudYear;
      var amount = annual ? p.priceAudYear : p.priceAudMonth;
      var price = document.createElement("p");
      price.className = "plan__price";
      if (amount == null) {
        price.textContent = "—";
      } else {
        price.appendChild(document.createTextNode(money(amount)));
        var per = document.createElement("span");
        per.textContent = annual ? "/year" : "/mo";
        price.appendChild(per);
      }
      card.appendChild(price);

      // GST is exclusive on every Stripe Price and immutable there, so a
      // figure shown without "ex GST" is simply the wrong number.
      var tax = document.createElement("p");
      tax.className = "plan__tax";
      tax.textContent = "ex GST";
      var s = saving(p);
      if (annual && s) tax.textContent = "ex GST · save " + s + "%";
      card.appendChild(tax);
    }

    if (p.blurb) {
      var blurb = document.createElement("p");
      blurb.textContent = p.blurb;
      card.appendChild(blurb);
    }

    if (p.includedCredits) {
      var cr = document.createElement("p");
      cr.className = "plan__credits";
      cr.textContent = p.includedCredits.toLocaleString() + " AI credits a month";
      card.appendChild(cr);
    }

    var cta = document.createElement("a");
    cta.className = "btn btn--small " + (p.key === "professional" ? "btn--solid" : "btn--ghost");
    cta.style.marginTop = "14px";
    if (p.selfServe === false) {
      cta.href = START + "?plan=" + encodeURIComponent(p.key);
      cta.textContent = "Talk to us →";
    } else if (trial && trial.open) {
      // The trial is the CTA wherever it is available. Somebody who can have
      // the whole product for thirty days without a card should not be asked
      // to choose a billing term first.
      cta.href = START + "?plan=" + encodeURIComponent(p.key) + "&trial=1";
      cta.textContent = "Start free trial →";
    } else {
      cta.href = START + "?plan=" + encodeURIComponent(p.key) + "&term=" + term;
      cta.textContent = "Get started →";
    }
    card.appendChild(cta);

    return card;
  }

  function render(data) {
    var plans = (data && data.plans) || [];
    if (!plans.length) return fallback();

    var mount = el("plans");
    var toggle = el("term-toggle");
    var note = el("pricing-note");
    var banner = el("trial-banner");
    var term = "month";

    // Only offer the toggle if some plan can actually be bought annually.
    // /api/plans nulls priceAudYear when no Stripe Price exists, so this is
    // the same fact checkout uses rather than a guess.
    var anyAnnual = plans.some(function (p) { return p.priceAudYear && p.selfServe !== false; });

    function draw() {
      mount.innerHTML = "";
      plans.forEach(function (p) { mount.appendChild(planCard(p, term, data.trial)); });
      if (toggle) {
        Array.prototype.forEach.call(toggle.querySelectorAll("button"), function (b) {
          var on = b.getAttribute("data-term") === term;
          b.className = "termbtn" + (on ? " termbtn--on" : "");
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
    }

    if (anyAnnual && toggle) {
      toggle.hidden = false;
      Array.prototype.forEach.call(toggle.querySelectorAll("button"), function (b) {
        b.addEventListener("click", function () { term = b.getAttribute("data-term"); draw(); });
      });
    }

    if (banner && data.trial && data.trial.open) {
      banner.hidden = false;
      banner.querySelector("[data-days]").textContent = data.trial.days;
      banner.querySelector("[data-credits]").textContent = Number(data.trial.credits).toLocaleString();
      banner.querySelector("a").href = START + "?plan=professional&trial=1";
    }

    if (note) {
      note.textContent = data.signupsOpen
        ? "Every plan includes unlimited board members. Prices in Australian dollars, excluding GST."
        : "We are taking on boards a few at a time. Leave your details and we will come to you first.";
    }

    draw();
  }

  /** No numbers. A link to the one page that always knows the real price. */
  function fallback() {
    var mount = el("plans");
    if (!mount) return;
    mount.innerHTML = "";
    var box = document.createElement("div");
    box.className = "plan plan--fallback";
    var h = document.createElement("h3");
    h.textContent = "See current pricing";
    var p = document.createElement("p");
    p.textContent = "Our plans and prices are shown on the signup page, where they are read from the same catalogue we bill from.";
    var a = document.createElement("a");
    a.className = "btn btn--solid btn--small";
    a.style.marginTop = "14px";
    a.href = START;
    a.textContent = "View plans →";
    box.appendChild(h); box.appendChild(p); box.appendChild(a);
    mount.appendChild(box);
  }

  function start() {
    fetch(API, { mode: "cors" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { j ? render(j) : fallback(); })
      .catch(fallback);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
