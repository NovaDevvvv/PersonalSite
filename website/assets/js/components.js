import { escapeHtml, formatDescription } from "./utils.js";

export function renderProjectCard(project) {
	const isComingSoon = project.comingSoon === true || Number(project.id) === -1;
	const stats = project.stats || {};
	const cheerCount = Number(stats.cheerCount || 0);
	const favoriteCount = Number(stats.favoriteCount || 0);
	const visitCount = Number(stats.visitCount || 0);
	const visitorCount = Number(stats.visitorCount || 0);
	const imageUrl = project.imageUrl || (project.imageName ? `https://img.rec.net/${project.imageName}` : "");
	const safeImageUrl = imageUrl || (isComingSoon ? "assets/comingSoon.jpg" : "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80");
	const title = escapeHtml(project.title || "Untitled Project");
	const description = formatDescription(
		isComingSoon
			? (project.description || "Still in progress — updates coming soon.")
			: (project.description || "No description added yet.")
	);
	const link = escapeHtml(project.link || "#");

	return `
		<div class="col-md-6 col-lg-4">
			<div class="card project-card h-100 border-0 glass-card ${isComingSoon ? "coming-soon-card" : ""}">
				<img src="${escapeHtml(safeImageUrl)}" class="card-img-top" alt="${title}">
				<div class="card-body d-flex flex-column">
					<h5 class="card-title">${title}</h5>
					<p class="card-text text-secondary project-description mb-3">${description}</p>
					${isComingSoon
						? `<div class="d-flex flex-wrap gap-2 mt-auto mb-3"><span class="badge text-bg-warning"><i class="bi bi-hourglass-split me-1"></i>Coming Soon</span></div>
						   <button class="btn btn-outline-secondary btn-sm" type="button" disabled>In Development</button>`
						: `<div class="d-flex flex-wrap gap-2 mt-auto mb-3 stats-badges">
							<span class="badge text-bg-primary-subtle"><i class="bi bi-stars me-1"></i><span class="smooth-count" data-target="${cheerCount}">0</span> Cheers</span>
							<span class="badge text-bg-info-subtle"><i class="bi bi-heart-fill me-1"></i><span class="smooth-count" data-target="${favoriteCount}">0</span> Favorites</span>
							<span class="badge text-bg-success-subtle"><i class="bi bi-activity me-1"></i><span class="smooth-count" data-target="${visitCount}">0</span> Visits</span>
							<span class="badge text-bg-secondary"><i class="bi bi-people-fill me-1"></i><span class="smooth-count" data-target="${visitorCount}">0</span> Players</span>
						 </div>
						 <a href="${link}" class="btn btn-outline-light btn-sm" target="_blank" rel="noopener noreferrer">View Project</a>`}
				</div>
			</div>
		</div>
	`;
}

export function renderProjectRow(project) {
	const isComingSoon = project.comingSoon === true || Number(project.id) === -1;
	const stats = project.stats || {};
	const cheerCount = Number(stats.cheerCount || 0);
	const favoriteCount = Number(stats.favoriteCount || 0);
	const visitCount = Number(stats.visitCount || 0);
	const visitorCount = Number(stats.visitorCount || 0);
	const imageUrl = project.imageUrl || (project.imageName ? `https://img.rec.net/${project.imageName}` : "");
	const safeImageUrl = imageUrl || (isComingSoon ? "assets/comingSoon.jpg" : "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80");
	const title = escapeHtml(project.title || "Untitled Project");
	const description = formatDescription(
		isComingSoon
			? (project.description || "Still in progress — updates coming soon.")
			: (project.description || "No description added yet.")
	);
	const link = escapeHtml(project.link || "#");

	return `
		<article class="glass-card p-4 ${isComingSoon ? "coming-soon-card" : ""}">
			<div class="row g-4 align-items-start">
				<div class="col-lg-4">
					<img src="${escapeHtml(safeImageUrl)}" alt="${title}" class="project-image">
				</div>
				<div class="col-lg-8">
					<h3 class="mb-3">${title}</h3>
					<p class="text-secondary project-description-full mb-3">${description}</p>
					${isComingSoon
						? `<div class="d-flex flex-wrap gap-2 mb-3"><span class="badge text-bg-warning"><i class="bi bi-hourglass-split me-1"></i>Coming Soon</span></div>
						   <button class="btn btn-outline-secondary" type="button" disabled>In Development</button>`
						: `<div class="d-flex flex-wrap gap-2 mb-3 stats-badges">
							<span class="badge text-bg-primary-subtle"><i class="bi bi-stars me-1"></i><span class="smooth-count" data-target="${cheerCount}">0</span> Cheers</span>
							<span class="badge text-bg-info-subtle"><i class="bi bi-heart-fill me-1"></i><span class="smooth-count" data-target="${favoriteCount}">0</span> Favorites</span>
							<span class="badge text-bg-success-subtle"><i class="bi bi-activity me-1"></i><span class="smooth-count" data-target="${visitCount}">0</span> Visits</span>
							<span class="badge text-bg-secondary"><i class="bi bi-people-fill me-1"></i><span class="smooth-count" data-target="${visitorCount}">0</span> Players</span>
						 </div>
						 <a href="${link}" class="btn btn-outline-light" target="_blank" rel="noopener noreferrer">Open Project</a>`}
				</div>
			</div>
		</article>
	`;
}
