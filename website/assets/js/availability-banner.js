(function () {
	const TIME_ZONE = "Australia/Adelaide";
	const BANNER_ID = "availabilityBanner";
	const STORAGE_KEY = "availabilityBannerDisabled";
	const CHECK_INTERVAL_MS = 60_000;
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

	function isBannerDisabled() {
		return window.localStorage.getItem(STORAGE_KEY) === "1";
	}

	function setBannerDisabled(disabled) {
		if (disabled) {
			window.localStorage.setItem(STORAGE_KEY, "1");
		} else {
			window.localStorage.removeItem(STORAGE_KEY);
		}
	}

	function upsertBanner() {
		const shouldShowBanner = !isAvailableNow() && !isBannerDisabled();
		let banner = document.getElementById(BANNER_ID);

		if (!shouldShowBanner) {
			if (banner) {
				banner.remove();
			}
			document.body.classList.remove("availability-banner-visible");
			return;
		}

		if (!banner) {
			banner = document.createElement("div");
			banner.id = BANNER_ID;
			banner.className = "availability-banner";
			banner.setAttribute("role", "status");
			banner.setAttribute("aria-live", "polite");
			banner.innerHTML = BANNER_HTML;
			document.body.prepend(banner);
		}

		document.body.classList.add("availability-banner-visible");
	}

	function initializeAvailabilityBanner() {
		if (!document.body) {
			return;
		}

		window.availabilityBannerControls = {
			isDisabled: isBannerDisabled,
			setDisabled: (disabled) => {
				setBannerDisabled(Boolean(disabled));
				upsertBanner();
			},
			toggle: () => {
				setBannerDisabled(!isBannerDisabled());
				upsertBanner();
				return isBannerDisabled();
			},
		};

		upsertBanner();
		window.setInterval(upsertBanner, CHECK_INTERVAL_MS);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeAvailabilityBanner);
	} else {
		initializeAvailabilityBanner();
	}
})();
