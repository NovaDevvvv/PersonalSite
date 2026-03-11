(function () {
	const TIME_ZONE = "Australia/Adelaide";
	const BANNER_ID = "availabilityBanner";
	const STORAGE_KEY = "availabilityBannerOverride";
	const CHECK_INTERVAL_MS = 60_000;
	let isInitialized = false;
	let intervalId = null;
	const BANNER_HTML =
		"I'm unavailable right now (Adelaide time). " +
		"<span class=\"availability-banner-time\">Available Mon-Fri 6:00 AM-10:00 PM, Sat-Sun 12:00 PM-12:00 AM.</span>";

	function getLocalParts(date) {
		const formatter = new Intl.DateTimeFormat("en-AU", {
			timeZone: TIME_ZONE,
			weekday: "short",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

		const parts = formatter.formatToParts(date);
		const result = { weekday: "", hour: 0, minute: 0 };

		for (const part of parts) {
			if (part.type === "weekday") {
				result.weekday = part.value;
			} else if (part.type === "hour") {
				result.hour = Number(part.value) || 0;
			} else if (part.type === "minute") {
				result.minute = Number(part.value) || 0;
			}
		}

		return result;
	}

	function isAvailableNow() {
		const { weekday, hour, minute } = getLocalParts(new Date());
		const minutes = hour * 60 + minute;
		const isWeekend = weekday === "Sat" || weekday === "Sun";

		if (isWeekend) {
			return minutes >= 12 * 60 && minutes < 24 * 60;
		}

		return minutes >= 6 * 60 && minutes < 22 * 60;
	}

	function getBannerOverride() {
		const mode = window.localStorage.getItem(STORAGE_KEY);
		return mode === "show" || mode === "hide" ? mode : null;
	}

	function setBannerOverride(mode) {
		if (mode === "show" || mode === "hide") {
			window.localStorage.setItem(STORAGE_KEY, mode);
		} else {
			window.localStorage.removeItem(STORAGE_KEY);
		}
	}

	function isBannerVisible() {
		return Boolean(document.getElementById(BANNER_ID));
	}

	function upsertBanner() {
		const override = getBannerOverride();
		const shouldShowBanner = override === "show" || (override !== "hide" && !isAvailableNow());
		let banner = document.getElementById(BANNER_ID);
		const navbar = document.querySelector("nav.navbar");

		if (!shouldShowBanner) {
			if (banner) {
				banner.remove();
			}
			return;
		}

		if (!banner) {
			banner = document.createElement("div");
			banner.id = BANNER_ID;
			banner.className = "availability-banner";
			banner.setAttribute("role", "status");
			banner.setAttribute("aria-live", "polite");
			banner.innerHTML = BANNER_HTML;
		}

		if (navbar) {
			navbar.insertAdjacentElement("afterend", banner);
		} else {
			document.body.prepend(banner);
		}
	}

	function initializeAvailabilityBanner() {
		if (!document.body || isInitialized) {
			return;
		}

		isInitialized = true;

		window.availabilityBannerControls = {
			isVisible: isBannerVisible,
			getOverride: getBannerOverride,
			setOverride: (mode) => {
				setBannerOverride(mode);
				upsertBanner();
			},
			toggleVisibility: () => {
				setBannerOverride(isBannerVisible() ? "hide" : "show");
				upsertBanner();
				return isBannerVisible();
			},
			clearOverride: () => {
				setBannerOverride(null);
				upsertBanner();
			},
		};

		upsertBanner();
		intervalId = window.setInterval(upsertBanner, CHECK_INTERVAL_MS);
	}

	if (document.body) {
		initializeAvailabilityBanner();
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeAvailabilityBanner);
	} else {
		initializeAvailabilityBanner();
	}
})();
