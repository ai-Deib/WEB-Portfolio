import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_GROUPS,
  deleteGroup,
  deleteProject,
  deleteSocial,
  deleteUploadedFiles,
  getPublicPortfolio,
  getGroups,
  getProjects,
  getSocials,
  resetSocialsToDefault,
  saveGroup,
  saveProject,
  saveSocial,
  subscribeToPortfolioChange,
  uploadMediaFile,
} from "./mediaStore";
import {
  DEFAULT_SOCIALS,
  SOCIAL_PRESETS,
  SocialLogo,
  SocialPresetIcon,
  formatDirectoryLabel,
  sanitizeLinkUrl,
} from "./socialIcons";
import { getLegacyPortfolioContent } from "./legacyMediaStore";
import { parseProjectUrl } from "../shared/projectLinks.js";
import "./styles.css";

const ALL_WORK = "All work";
const LEGACY_MIGRATION_KEY = "xairo-legacy-import-complete";
const LEGACY_DEFAULT_GROUPS = ["Brand film", "Motion design", "Documentary", "Photography"];
const GROUP_CAPTIONS = {
  Documentary: "Human stories, shaped with care.",
  Longform: "Full-length storytelling built to hold attention.",
  "Motion Graphics": "Design, type, and imagery brought to life.",
  SaaS: "Clear product stories for digital tools.",
  Shortform: "Fast, focused edits made for the scroll.",
  Typography: "Letters finding rhythm through motion.",
  "Brand film": "Brand stories with a cinematic point of view.",
  "Motion design": "Visual identities and ideas set in motion.",
  Photography: "Still frames with a strong point of view.",
};
const VIDEO_FILE_EXTENSION = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;

function isVideoFile(file) {
  return file.type.startsWith("video/") || VIDEO_FILE_EXTENSION.test(file.name);
}

function getFolderName(file) {
  const parts = (file.webkitRelativePath || "").split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : "";
}

function formatFileSize(size) {
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getShowcaseGroups(groups, projects) {
  return groups.filter((group) =>
    DEFAULT_GROUPS.includes(group) ||
    projects.some((project) => !project.archived && project.category === group));
}

function isDefaultSocial(social, defaults) {
  return Boolean(defaults) &&
    social.name === defaults.name &&
    (social.handle || "") === defaults.handle &&
    social.url === defaults.url &&
    (social.logoPreset || "website") === defaults.logoPreset &&
    (social.order ?? 0) === defaults.order &&
    !social.logoBlob;
}

function hasLegacyContentToImport(content) {
  const legacyGroups = content.groups.map((group) => group.name);
  const groupsChanged = legacyGroups.length > 0 && ![DEFAULT_GROUPS, LEGACY_DEFAULT_GROUPS].some((defaults) =>
    legacyGroups.length === defaults.length &&
    defaults.every((name) => legacyGroups.includes(name)));
  const socialsChanged = content.socials.length > 0 &&
    (content.socials.length !== DEFAULT_SOCIALS.length ||
      content.socials.some((social) =>
        !isDefaultSocial(social, DEFAULT_SOCIALS.find((item) => item.id === social.id))));
  return content.projects.length > 0 || groupsChanged || socialsChanged;
}

function Arrow({ diagonal = false }) {
  return (
    <svg aria-hidden="true" className="arrow" viewBox="0 0 24 24">
      {diagonal ? (
        <path d="M7 17 17 7M7 7h10v10" />
      ) : (
        <path d="M4 12h15m-7-7 7 7-7 7" />
      )}
    </svg>
  );
}

function ExternalProjectPreview({ project }) {
  const projectLink = parseProjectUrl(project.externalUrl);
  if (!projectLink) {
    return <div className="external-project-card"><span>PROJECT LINK UNAVAILABLE</span></div>;
  }

  if (projectLink.embedUrl) {
    return (
      <iframe
        className={`external-project-embed external-project-embed-${projectLink.provider.toLowerCase()}`}
        src={projectLink.embedUrl}
        title={`${project.title} on ${projectLink.provider}`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <a className="external-project-card" href={projectLink.url} target="_blank" rel="noopener noreferrer">
      <span>EXTERNAL PROJECT · {projectLink.provider}</span>
      <strong>{project.title}</strong>
      <span className="external-project-cta">OPEN PROJECT <Arrow diagonal /></span>
    </a>
  );
}

function SocialsModal({ open, onClose, socials }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="socials-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="socials-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="socials-modal-header">
          <div>
            <p className="eyebrow">CONNECT WITH XAIRO</p>
            <h3 id="socials-modal-title">Find me online<span className="green-dot">.</span></h3>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close social links popup"
          >
            ×
          </button>
        </div>

        <p className="socials-modal-subtitle">
          Choose a platform below to reach out or explore more work.
        </p>

        {socials.length === 0 ? (
          <p className="socials-empty">No social media links have been added yet.</p>
        ) : (
          <ul className="socials-list">
            {socials.map((social) => {
              const safeHref = sanitizeLinkUrl(social.url) || "#";
              const isExternal = /^https?:/i.test(safeHref);
              return (
                <li key={social.id}>
                  <a
                    className="social-row"
                    href={safeHref}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                  >
                    <SocialLogo social={social} />
                    <div className="social-row-text">
                      <strong>{social.name}</strong>
                      <span>{social.handle || formatDirectoryLabel(safeHref)}</span>
                    </div>
                    <Arrow diagonal />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PublicPortfolio() {
  const publicSiteRef = useRef(null);
  const [uploaded, setUploaded] = useState([]);
  const [groups, setGroups] = useState([]);
  const [socials, setSocials] = useState([]);
  const [filter, setFilter] = useState(ALL_WORK);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [socialsOpen, setSocialsOpen] = useState(false);
  const categoryWheelRef = useRef(null);
  const categoryOptionRefs = useRef(new Map());
  const wheelScrollTimeout = useRef(null);
  const wheelTargetIndexRef = useRef(0);

  useEffect(() => {
    const site = publicSiteRef.current;
    if (!site) return undefined;
    const sections = Array.from(site.querySelectorAll("[data-focus-section]"));
    if (!sections.length) return undefined;
    site.classList.add("has-section-focus");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sections.forEach((section) => section.classList.add("is-focused"));
      return () => site.classList.remove("has-section-focus");
    }

    let frame = 0;

    function updateFocus() {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportCenter = viewportHeight / 2;
      const rankedSections = sections
        .map((section, index) => {
          const rect = section.getBoundingClientRect();
          const visibleTop = Math.max(0, rect.top);
          const visibleBottom = Math.min(viewportHeight, rect.bottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          return {
            section,
            index,
            visibility: visibleHeight / viewportHeight,
            centerDistance: Math.abs((visibleTop + visibleBottom) / 2 - viewportCenter),
          };
        })
        .filter((entry) => entry.visibility > 0)
        .sort((a, b) => b.visibility - a.visibility
          || a.centerDistance - b.centerDistance
          || a.index - b.index);
      const focusedSections = new Set(rankedSections.slice(0, 2).map((entry) => entry.section));

      sections.forEach((section) => {
        section.classList.toggle("is-focused", focusedSections.has(section));
      });
    }

    function scheduleFocusUpdate() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateFocus();
      });
    }

    const resizeObserver = "ResizeObserver" in window
      ? new ResizeObserver(scheduleFocusUpdate)
      : null;
    if (resizeObserver) sections.forEach((section) => resizeObserver.observe(section));

    updateFocus();
    window.addEventListener("scroll", scheduleFocusUpdate, { passive: true });
    window.addEventListener("resize", scheduleFocusUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleFocusUpdate);
      window.removeEventListener("resize", scheduleFocusUpdate);
      if (resizeObserver) resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      site.classList.remove("has-section-focus");
    };
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll(".public-site [data-reveal]");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [uploaded, groups, filter, selectedProjectIndex, socialsOpen]);

  useEffect(() => {
    const site = publicSiteRef.current;
    if (!site) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let frame = 0;

    function updateGradient() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollableHeight > 0
          ? Math.max(0, Math.min(window.scrollY / scrollableHeight, 1))
          : 0;
        site.style.setProperty("--scroll-phase", `${(progress * 100).toFixed(2)}%`);
        frame = 0;
      });
    }

    updateGradient();
    window.addEventListener("scroll", updateGradient, { passive: true });
    window.addEventListener("resize", updateGradient);
    return () => {
      window.removeEventListener("scroll", updateGradient);
      window.removeEventListener("resize", updateGradient);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [uploaded, groups]);

  useEffect(() => {
    let active = true;

    function loadPortfolio() {
      getPublicPortfolio()
        .then(({ projects: nextProjects, groups: nextGroups, socials: nextSocials }) => {
          if (!active) return;
          setUploaded(nextProjects);
          setGroups(nextGroups);
          setSocials(nextSocials);
          const availableCategories = [ALL_WORK, ...getShowcaseGroups(nextGroups, nextProjects)];
          setFilter((current) => availableCategories.includes(current) ? current : ALL_WORK);
          setSelectedProjectIndex(0);
          setLoadError("");
        })
        .catch(() => {
          if (active) setLoadError("Public portfolio content could not be loaded. Please try again later.");
        });
    }

    loadPortfolio();
    const unsubscribe = subscribeToPortfolioChange(loadPortfolio);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const projects = useMemo(() => {
    const allProjects = uploaded.filter((project) => !project.archived);
    return filter === ALL_WORK
      ? allProjects
      : allProjects.filter((project) => project.category === filter);
  }, [filter, uploaded]);
  const showcaseGroups = useMemo(() => getShowcaseGroups(groups, uploaded), [groups, uploaded]);
  const categoryOptions = useMemo(() => [ALL_WORK, ...showcaseGroups], [showcaseGroups]);
  const activeProjectIndex = projects.length ? selectedProjectIndex % projects.length : 0;
  const activeProject = projects[activeProjectIndex];

  useEffect(() => {
    const viewport = categoryWheelRef.current;
    const option = categoryOptionRefs.current.get(filter);
    if (!viewport || !option) return;
    wheelTargetIndexRef.current = Math.max(0, categoryOptions.indexOf(filter));
    const top = option.offsetTop - (viewport.clientHeight - option.offsetHeight) / 2;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    viewport.scrollTo({ top, behavior });
    setSelectedProjectIndex(0);
  }, [categoryOptions, filter]);

  useEffect(() => () => window.clearTimeout(wheelScrollTimeout.current), []);

  useEffect(() => {
    const viewport = categoryWheelRef.current;
    if (!viewport) return undefined;
    let accumulatedDelta = 0;
    let resetTimeout = 0;

    function handleWheel(event) {
      if (event.ctrlKey) return;
      event.preventDefault();

      const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? viewport.clientHeight
          : 1;
      accumulatedDelta += event.deltaY * deltaScale;
      window.clearTimeout(resetTimeout);
      resetTimeout = window.setTimeout(() => {
        accumulatedDelta = 0;
      }, 140);

      if (Math.abs(accumulatedDelta) < 80) return;
      const direction = Math.sign(accumulatedDelta);
      accumulatedDelta = 0;

      const nextIndex = Math.max(
        0,
        Math.min(categoryOptions.length - 1, wheelTargetIndexRef.current + direction),
      );
      if (nextIndex === wheelTargetIndexRef.current) return;
      wheelTargetIndexRef.current = nextIndex;
      selectCategory(categoryOptions[nextIndex]);
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      window.clearTimeout(resetTimeout);
    };
  }, [categoryOptions, filter]);

  function selectCategory(category) {
    if (category === filter) return;
    wheelTargetIndexRef.current = categoryOptions.indexOf(category);
    setFilter(category);
    setSelectedProjectIndex(0);
  }

  function selectNearestCategory() {
    const viewport = categoryWheelRef.current;
    if (!viewport) return;
    const center = viewport.scrollTop + viewport.clientHeight / 2;
    let closestCategory = filter;
    let closestDistance = Infinity;
    for (const [category, option] of categoryOptionRefs.current) {
      const distance = Math.abs(option.offsetTop + option.offsetHeight / 2 - center);
      if (distance < closestDistance) {
        closestCategory = category;
        closestDistance = distance;
      }
    }
    wheelTargetIndexRef.current = categoryOptions.indexOf(closestCategory);
    selectCategory(closestCategory);
  }

  function handleCategoryWheelScroll(event) {
    if ("onscrollend" in event.currentTarget) return;
    window.clearTimeout(wheelScrollTimeout.current);
    wheelScrollTimeout.current = window.setTimeout(() => {
      selectNearestCategory();
    }, 240);
  }

  useEffect(() => {
    const viewport = categoryWheelRef.current;
    if (!viewport || !("onscrollend" in viewport)) return undefined;
    function handleScrollEnd() {
      window.clearTimeout(wheelScrollTimeout.current);
      selectNearestCategory();
    }
    viewport.addEventListener("scrollend", handleScrollEnd);
    return () => viewport.removeEventListener("scrollend", handleScrollEnd);
  }, [categoryOptions, filter]);

  function handleCategoryKeyDown(event) {
    const currentIndex = Math.max(0, categoryOptions.indexOf(filter));
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(categoryOptions.length - 1, currentIndex + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = categoryOptions.length - 1;
    else return;
    event.preventDefault();
    selectCategory(categoryOptions[nextIndex]);
  }

  function showProject(direction) {
    if (projects.length < 2) return;
    setSelectedProjectIndex((current) => (current + direction + projects.length) % projects.length);
  }

  return (
    <main ref={publicSiteRef} className="public-site">
      <header className="site-header" data-reveal="block">
        <a className="wordmark" href="#top" aria-label="Xairo home">XAIRO<span>®</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#work">Projects</a>
          <a href="#about">About</a>
          <a href="#contact">Contact <Arrow diagonal /></a>
        </nav>
        <a className="availability" href="#contact"><span /> Available for projects</a>
      </header>

      <section className="hero" id="top" data-focus-section>
        <div className="hero-kicker" data-reveal="block"><span>INDEPENDENT CREATIVE</span><span>BASED ANYWHERE · WORKING EVERYWHERE</span></div>
        <h1>
          <span data-reveal="word" style={{ "--reveal-delay": "0ms" }}>Making</span><br />
          <span data-reveal="word" style={{ "--reveal-delay": "70ms" }}>good</span>{" "}
          <span data-reveal="word" style={{ "--reveal-delay": "140ms" }}>things</span>{" "}
          <span className="hero-accent" data-reveal="word" style={{ "--reveal-delay": "210ms" }}>move.</span>
        </h1>
        <div className="hero-bottom">
          <p data-reveal="paragraph">Creative direction, films &amp; images<br />for people with something to say.</p>
          <a href="#work" className="round-link" aria-label="Scroll to selected work" data-reveal="block"><Arrow /></a>
          <span className="hero-index" data-reveal="block">SCROLL TO EXPLORE&nbsp; ↓</span>
        </div>
        <div className="hero-orbit" aria-hidden="true" data-reveal="block"><span>X</span></div>
      </section>

      <section className="work-section section-wrap" id="work" data-focus-section>
        <div className="section-heading">
          <div data-reveal="block"><p className="eyebrow">A FEW RECENT FAVORITES</p><h2>Projects I've Made<span className="green-dot">.</span></h2></div>
          <p className="work-count" data-reveal="block">{String(projects.length).padStart(2, "0")} <span>PROJECTS</span></p>
        </div>
        {loadError && <p className="notice" role="status">{loadError}</p>}
        <div className="work-showcase">
          <div className="category-wheel" data-reveal="block">
            <p className="wheel-label">SCROLL TO EXPLORE</p>
            <div
              className="category-wheel-viewport"
              ref={categoryWheelRef}
              role="listbox"
              aria-label="Portfolio categories"
              tabIndex="0"
              onScroll={handleCategoryWheelScroll}
              onKeyDown={handleCategoryKeyDown}
            >
              {categoryOptions.map((category, index) => {
                const distance = Math.abs(index - categoryOptions.indexOf(filter));
                const opacity = Math.max(0.18, 1 - distance * 0.27);
                const scale = Math.max(0.88, 1 - distance * 0.04);
                const count = category === ALL_WORK
                  ? uploaded.filter((project) => !project.archived).length
                  : uploaded.filter((project) => !project.archived && project.category === category).length;
                return (
                  <button
                    className={filter === category ? "category-option active" : "category-option"}
                    key={category}
                    ref={(element) => {
                      if (element) categoryOptionRefs.current.set(category, element);
                      else categoryOptionRefs.current.delete(category);
                    }}
                    role="option"
                    aria-selected={filter === category}
                    type="button"
                    style={{ opacity, transform: `scale(${scale})` }}
                    onClick={() => selectCategory(category)}
                  >
                    <span>{category}</span>
                    <small>{String(count).padStart(2, "0")}</small>
                  </button>
                );
              })}
            </div>
            <p className="wheel-caption">
              {filter === ALL_WORK
                ? "Browse every selected project."
                : GROUP_CAPTIONS[filter] || "A focused collection of selected work."}
            </p>
            <p className="wheel-hint">Use scroll or ↑ ↓</p>
          </div>

          <div className="work-preview" data-reveal="block">
            {activeProject ? (
              <>
                <div className="work-preview-media">
                  {activeProject.externalUrl ? (
                    <ExternalProjectPreview project={activeProject} />
                  ) : activeProject.fileType?.startsWith("video/") ? (
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      src={activeProject.mediaUrl}
                      poster={activeProject.posterUrl || undefined}
                    />
                  ) : (
                    <img src={activeProject.image || activeProject.mediaUrl} alt={activeProject.title} />
                  )}
                  <span className="preview-number">
                    {String(activeProjectIndex + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="work-preview-info">
                  <div className="work-preview-copy">
                    <p className="eyebrow">{activeProject.category} · {activeProject.year || "2025"}</p>
                    <h3>{activeProject.title}</h3>
                    <p>{activeProject.description || activeProject.client || "Selected creative work."}</p>
                    {activeProject.externalUrl && parseProjectUrl(activeProject.externalUrl)?.embedUrl && (
                      <a className="external-source-link" href={activeProject.externalUrl} target="_blank" rel="noopener noreferrer">
                        Open original on {parseProjectUrl(activeProject.externalUrl).provider} <Arrow diagonal />
                      </a>
                    )}
                  </div>
                  {projects.length > 1 && (
                    <div className="preview-controls" aria-label="Preview navigation">
                      <button type="button" onClick={() => showProject(-1)} aria-label="Previous project">
                        <Arrow />
                      </button>
                      <button type="button" onClick={() => showProject(1)} aria-label="Next project">
                        <Arrow />
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="work-preview-empty">
                <span className="eyebrow">{filter === ALL_WORK ? "YOUR NEXT FEATURE" : "SELECTED CATEGORY"}</span>
                <h3>{filter === ALL_WORK ? "The work goes here." : filter}</h3>
                <p>{filter === ALL_WORK
                  ? "Publish a project in Studio to see its preview here."
                  : GROUP_CAPTIONS[filter] || "A focused collection of selected work."}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="about-section section-wrap" id="about" data-focus-section>
        <div className="about-label" data-reveal="block"><p className="eyebrow">A BIT ABOUT ME</p><span>01 — 03</span></div>
        <div className="about-copy">
          <h2>
            <span className="about-quote" data-reveal="word" style={{ "--reveal-delay": "0ms" }}>“</span>
            <span data-reveal="word" style={{ "--reveal-delay": "60ms" }}>Curious</span>{" "}
            <span data-reveal="word" style={{ "--reveal-delay": "120ms" }}>by</span>{" "}
            <span data-reveal="word" style={{ "--reveal-delay": "180ms" }}>nature.</span><br />
            <span className="about-highlight" data-reveal="word" style={{ "--reveal-delay": "0ms" }}>Intentional</span>{" "}
            <span data-reveal="word" style={{ "--reveal-delay": "60ms" }}>by</span>{" "}
            <span data-reveal="word" style={{ "--reveal-delay": "120ms" }}>design.</span>
            <span className="about-quote" data-reveal="word" style={{ "--reveal-delay": "180ms" }}>”</span>
          </h2>
          <p data-reveal="paragraph">Hi, I’m Alexander L. de Guzman, also known as Xairo—a Filipino motion graphics editor based in the Philippines, specializing in motion editing, visual composition, and purposeful storytelling. With a strong foundation in editing fundamentals and design principles, I turn raw ideas into cohesive, engaging visuals.
            By combining technical know-how with a streamlined production workflow, I focus on thoughtful pacing, clear visual hierarchy, and the finer details of every frame. I enjoy collaborating with creators and brands to deliver polished, memorable work that feels intentional from start to finish.</p>
          <a className="text-link" href="#contact" data-reveal="block">A little more about me <Arrow diagonal /></a>
        </div>
        <div className="about-stamp" aria-hidden="true" data-reveal="block">GOOD<br />WORK<br /><span>ONLY</span></div>
      </section>

      <section className="contact-section" id="contact" data-focus-section>
        <p className="eyebrow" data-reveal="block">HAVE A GOOD ONE IN MIND?</p>
        <h2>
          <span data-reveal="word" style={{ "--reveal-delay": "0ms" }}>Let’s</span>{" "}
          <span data-reveal="word" style={{ "--reveal-delay": "80ms" }}>make</span><br />
          <span data-reveal="word" style={{ "--reveal-delay": "0ms" }}>it</span>{" "}
          <span className="contact-highlight" data-reveal="word" style={{ "--reveal-delay": "80ms" }}>happen.</span>
        </h2>
        <button
          className="contact-link contact-trigger"
          type="button"
          onClick={() => setSocialsOpen(true)}
          data-reveal="block"
        >
          contact me@xairo.socials <Arrow diagonal />
        </button>
        <footer className="site-footer" data-reveal="block">
          <a className="wordmark" href="#top">XAIRO<span>®</span></a>
          <span>INDEPENDENT BY DESIGN.</span>
          <span>© {new Date().getFullYear()} XAIRO STUDIO</span>
        </footer>
      </section>

      <SocialsModal
        open={socialsOpen}
        onClose={() => setSocialsOpen(false)}
        socials={socials}
      />
    </main>
  );
}

const emptySocialForm = {
  id: null,
  name: "",
  handle: "",
  url: "",
  logoPreset: "instagram",
  logoBlob: null,
  logoUrl: "",
  logoPath: "",
  order: null,
};

function Studio() {
  const [authStatus, setAuthStatus] = useState("checking");
  const [accessCode, setAccessCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [legacyContent, setLegacyContent] = useState(null);
  const [legacyImporting, setLegacyImporting] = useState(false);
  const [legacyError, setLegacyError] = useState("");
  const [legacySuccess, setLegacySuccess] = useState("");
  const [activeTab, setActiveTab] = useState("projects");
  const [projectView, setProjectView] = useState("published");
  const [projects, setProjects] = useState([]);
  const [sourceVideos, setSourceVideos] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [projectActionSuccess, setProjectActionSuccess] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupDeleteTargets, setGroupDeleteTargets] = useState({});
  const [groupError, setGroupError] = useState("");
  const [groupSuccess, setGroupSuccess] = useState("");
  const [form, setForm] = useState({ title: "", category: DEFAULT_GROUPS[0], description: "", client: "" });
  const [mediaSource, setMediaSource] = useState("file");
  const [externalUrl, setExternalUrl] = useState("");

  const [socials, setSocials] = useState([]);
  const [socialForm, setSocialForm] = useState(emptySocialForm);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [socialSuccess, setSocialSuccess] = useState("");
  const logoInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const sourceFolderInputRef = useRef(null);
  const visibleProjects = projects.filter((project) => Boolean(project.archived) === (projectView === "archived"));
  const publishedCount = projects.filter((project) => !project.archived).length;
  const archivedCount = projects.length - publishedCount;

  useEffect(() => {
    let active = true;
    fetch("/api/studio/session")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          if (active) setAuthStatus("locked");
          return;
        }
        if (!response.ok) throw new Error(payload.error || "Could not check studio access.");
        if (active) setAuthStatus("authorized");
      })
      .catch((sessionError) => {
        if (!active) return;
        setAuthError(sessionError.message);
        setAuthStatus("error");
      });

    function handleExpiredSession() {
      setAuthError("Your studio session expired. Enter the access code to continue.");
      setAuthStatus("locked");
    }
    window.addEventListener("xairo:studio-expired", handleExpiredSession);
    return () => {
      active = false;
      window.removeEventListener("xairo:studio-expired", handleExpiredSession);
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "authorized") return;
    let active = true;
    getProjects().then((items) => {
      if (active) setProjects(items);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Could not load studio projects.");
    });
    getSocials().then((items) => {
      if (active) setSocials(items);
    }).catch((loadError) => {
      if (active) setSocialError(loadError.message || "Could not load social links.");
    });
    getGroups().then((items) => {
      if (!active) return;
      setGroups(items);
      setForm((current) => items.includes(current.category)
        ? current
        : { ...current, category: items[0] || "" });
    }).catch((loadError) => {
      if (active) setGroupError(loadError.message || "Could not load portfolio groups.");
    });
    getLegacyPortfolioContent().then((content) => {
      if (!active) return;
      try {
        if (localStorage.getItem(LEGACY_MIGRATION_KEY) !== "1" && hasLegacyContentToImport(content)) {
          setLegacyContent(content);
        }
      } catch {
        setLegacyError("Could not check the previous browser library.");
      }
    }).catch(() => {
      if (active) setLegacyError("Could not read the previous browser library.");
    });
    return () => {
      active = false;
    };
  }, [authStatus]);

  async function handleAccessCodeSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const response = await fetch("/api/studio/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not unlock the studio.");
      setAccessCode("");
      setAuthStatus("authorized");
    } catch (loginError) {
      setAuthError(loginError.message || "Could not unlock the studio.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleStudioLogout() {
    setAuthError("");
    try {
      const response = await fetch("/api/studio/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not lock the studio.");
      setAuthStatus("locked");
    } catch (logoutError) {
      setAuthError(logoutError.message || "Could not lock the studio.");
    }
  }

  async function handleImportLegacyContent() {
    if (!legacyContent) return;
    setLegacyImporting(true);
    setLegacyError("");
    setLegacySuccess("");

    try {
      const [currentProjects, currentGroups, currentSocials] = await Promise.all([
        getProjects(),
        getGroups(),
        getSocials(),
      ]);
      const knownProjectIds = new Set(currentProjects.map((project) => project.id));
      const knownSocials = new Map(currentSocials.map((social) => [social.id, social]));
      const knownGroups = [...currentGroups];
      setProjects(currentProjects);
      setSocials(currentSocials);
      setGroups(currentGroups);

      for (const group of legacyContent.groups) {
        if (knownGroups.some((name) => name.toLocaleLowerCase() === group.name.toLocaleLowerCase())) continue;
        await saveGroup(group.name);
        knownGroups.push(group.name);
      }
      if (currentProjects.length === 0) {
        const legacyGroupNames = new Set(legacyContent.groups.map((group) => group.name));
        for (const name of DEFAULT_GROUPS) {
          if (legacyGroupNames.has(name) || !knownGroups.includes(name) || knownGroups.length <= 1) continue;
          await deleteGroup(name);
          knownGroups.splice(knownGroups.indexOf(name), 1);
        }
      }
      setGroups(knownGroups);

      for (const project of legacyContent.projects) {
        if (knownProjectIds.has(project.id)) continue;
        if (!(project.mediaBlob instanceof Blob)) {
          throw new Error(`Could not import “${project.title}” because its original media file is unavailable.`);
        }

        const uploadedPaths = [];
        try {
          const mediaUpload = await uploadMediaFile(project.mediaBlob, "project");
          uploadedPaths.push(mediaUpload.path);
          let posterPath = "";
          if (project.posterBlob instanceof Blob && project.posterBlob.size > 0) {
            const posterUpload = await uploadMediaFile(project.posterBlob, "poster");
            posterPath = posterUpload.path;
            uploadedPaths.push(posterPath);
          }
          const saved = await saveProject({
            id: project.id,
            title: project.title,
            category: knownGroups.includes(project.category) ? project.category : knownGroups[0],
            description: project.description || "",
            client: project.client || "",
            year: project.year || String(new Date().getFullYear()),
            fileType: mediaUpload.file.type,
            mediaPath: mediaUpload.path,
            posterPath,
            archived: Boolean(project.archived),
            createdAt: project.createdAt || Date.now(),
          });
          knownProjectIds.add(saved.id);
          setProjects((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        } catch (importError) {
          if (uploadedPaths.length > 0) {
            if (importError.status && importError.status < 500) {
              try {
                await deleteUploadedFiles(uploadedPaths);
              } catch {
                throw new Error(`${importError.message} Some uploaded files may need to be removed from Supabase Storage.`);
              }
            } else {
              throw new Error(`${importError.message} Uploaded files may remain in storage if the import did not complete.`);
            }
          }
          throw importError;
        }
      }

      for (const social of legacyContent.socials) {
        const existing = knownSocials.get(social.id);
        const defaultSocial = DEFAULT_SOCIALS.find((item) => item.id === social.id);
        if (existing && (!defaultSocial || !isDefaultSocial(existing, defaultSocial))) continue;
        if (existing && isDefaultSocial(social, defaultSocial)) continue;

        let logoPath = social.logoPath || "";
        let uploadedLogoPath = "";
        try {
          if (social.logoBlob instanceof Blob && social.logoBlob.size > 0) {
            const logoUpload = await uploadMediaFile(social.logoBlob, "social-logo");
            uploadedLogoPath = logoUpload.path;
            logoPath = uploadedLogoPath;
          }
          const saved = await saveSocial({
            id: social.id,
            name: social.name,
            handle: social.handle || "",
            url: social.url,
            logoPreset: social.logoPreset || "website",
            logoPath,
            order: social.order ?? 0,
          });
          knownSocials.set(saved.id, saved);
          setSocials((current) => {
            const next = current.filter((item) => item.id !== saved.id);
            next.push(saved);
            return next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          });
        } catch (importError) {
          if (uploadedLogoPath) {
            if (importError.status && importError.status < 500) {
              try {
                await deleteUploadedFiles([uploadedLogoPath]);
              } catch {
                throw new Error(`${importError.message} The uploaded logo may need to be removed from Supabase Storage.`);
              }
            } else {
              throw new Error(`${importError.message} The uploaded logo may remain in storage if the import did not complete.`);
            }
          }
          throw importError;
        }
      }

      localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
      setLegacyContent(null);
      setLegacySuccess("Previous browser content was imported into the shared portfolio.");
      const refreshedGroups = await getGroups();
      setGroups(refreshedGroups);
    } catch (importError) {
      setLegacyError(importError.message || "Could not import the previous browser content.");
    } finally {
      setLegacyImporting(false);
    }
  }

  function handleSourceFolderSelection(event) {
    const files = Array.from(event.currentTarget.files || []).filter(isVideoFile);
    event.currentTarget.value = "";
    if (mediaInputRef.current) mediaInputRef.current.value = "";
    setError("");
    setSuccess("");
    setSelectedMedia(null);
    if (files.length === 0) {
      setSourceVideos([]);
      setError("No supported video clips were found in that folder.");
      return;
    }
    setSourceVideos(files);
    setSuccess(`${files.length} local video clip(s) ready to select. Nothing uploads until you publish it.`);
  }

  function handleSelectSourceVideo(file) {
    const folderName = getFolderName(file);
    const matchingGroup = groups.find((group) => group.toLocaleLowerCase() === folderName.toLocaleLowerCase());
    setSelectedMedia(file);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
    setForm((current) => ({
      ...current,
      title: file.name.replace(VIDEO_FILE_EXTENSION, ""),
      category: matchingGroup || current.category,
    }));
    setError("");
    setSuccess(matchingGroup || !folderName
      ? ""
      : `Add the “${folderName}” group in Portfolio Groups, or choose another group before publishing.`);
  }

  function handleRemoveSourceVideo(file) {
    setSourceVideos((current) => current.filter((item) => item !== file));
    if (selectedMedia === file) {
      setSelectedMedia(null);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const file = mediaSource === "file" ? selectedMedia || data.get("media") : null;
    const link = mediaSource === "url" ? parseProjectUrl(externalUrl) : null;
    const poster = data.get("poster");
    if (mediaSource === "url" && !link) {
      setError("Enter a valid HTTPS social or project URL.");
      return;
    }
    if (mediaSource === "file") {
      if (!(file instanceof File) || file.size === 0) {
        setError("Choose a video or photo to upload.");
        return;
      }
      if (!isVideoFile(file) && !file.type.startsWith("image/")) {
        setError("Choose a supported video or image file.");
        return;
      }
    }

    const uploadedPaths = [];
    setSaving(true);
    setUploadStatus("");
    try {
      let mediaUpload = null;
      let posterPath = "";
      if (mediaSource === "file") {
        mediaUpload = await uploadMediaFile(file, "project", ({ phase, progress }) => {
          setUploadStatus(phase === "compressing"
            ? `Optimizing video for web${progress ? ` · ${Math.round(progress * 100)}%` : "…"}`
            : "Uploading optimized media…");
        });
        uploadedPaths.push(mediaUpload.path);
        if (poster instanceof File && poster.size > 0) {
          const posterUpload = await uploadMediaFile(poster, "poster");
          posterPath = posterUpload.path;
          uploadedPaths.push(posterPath);
        }
      }

      const project = await saveProject({
        id: crypto.randomUUID(),
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        client: form.client.trim(),
        year: String(new Date().getFullYear()),
        fileType: mediaUpload ? mediaUpload.file.type : "external",
        mediaPath: mediaUpload ? mediaUpload.path : "",
        externalUrl: link?.url || "",
        posterPath,
        createdAt: Date.now(),
      });
      setProjects((current) => [project, ...current]);
      if (file) setSourceVideos((current) => current.filter((item) => item !== file));
      setSelectedMedia(null);
      setExternalUrl("");
      setMediaSource("file");
      setForm({ title: "", category: groups[0] || DEFAULT_GROUPS[0], description: "", client: "" });
      formElement.reset();
      setSuccess(mediaUpload ? "Project published to your portfolio." : "Social project link published to your portfolio.");
      setUploadStatus("");
    } catch (uploadError) {
      let message = uploadError.message || "The project could not be saved.";
      if (uploadedPaths.length > 0) {
        if (uploadError.status && uploadError.status < 500) {
          try {
            await deleteUploadedFiles(uploadedPaths);
          } catch {
            message += " Some uploaded files may need to be removed from Supabase Storage.";
          }
        } else {
          message += " Uploaded files may remain in storage if the project save did not complete.";
        }
      }
      setError(message);
    } finally {
      setSaving(false);
      setUploadStatus("");
    }
  }

  async function handleDelete(project) {
    if (!window.confirm(`Remove “${project.title}” from your portfolio?`)) return;
    setError("");
    setSuccess("");
    try {
      const result = await deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setSuccess(result.warning || "Project removed.");
    } catch (deleteError) {
      setError(deleteError.message || "The project could not be removed.");
    }
  }

  async function handleArchiveToggle(project) {
    setProjectActionError("");
    setProjectActionSuccess("");
    const updatedProject = { ...project, archived: !project.archived };

    try {
      await saveProject(updatedProject);
      setProjects((current) => current.map((item) => item.id === project.id ? updatedProject : item));
      setProjectActionSuccess(updatedProject.archived
        ? "Project archived and removed from the public portfolio."
        : "Project restored to the public portfolio.");
    } catch {
      setProjectActionError("Could not update this project’s archive status.");
    }
  }

  async function handleAddGroup(event) {
    event.preventDefault();
    setGroupError("");
    setGroupSuccess("");
    const name = newGroupName.trim();
    if (!name) {
      setGroupError("Enter a name for the new group.");
      return;
    }
    if (name.toLocaleLowerCase() === ALL_WORK.toLocaleLowerCase()) {
      setGroupError(`“${ALL_WORK}” is reserved for the public portfolio filter.`);
      return;
    }
    if (groups.some((group) => group.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setGroupError("A group with that name already exists.");
      return;
    }

    try {
      await saveGroup(name);
      setGroups((current) => [...current, name]);
      setForm((current) => ({ ...current, category: name }));
      setNewGroupName("");
      setGroupSuccess(`“${name}” is ready to use.`);
    } catch (saveError) {
      setGroupError(saveError.message || "Could not save the new group.");
    }
  }

  async function handleDeleteGroup(name) {
    setGroupError("");
    setGroupSuccess("");
    if (groups.length <= 1) {
      setGroupError("Keep at least one group so new projects can be organized.");
      return;
    }

    const assignedCount = projects.filter((project) => project.category === name).length;
    const destination = groupDeleteTargets[name] || groups.find((group) => group !== name);
    if (assignedCount > 0 && !destination) {
      setGroupError("Choose another group for the projects assigned here.");
      return;
    }

    const effects = [];
    if (assignedCount > 0) {
      effects.push(`${assignedCount} uploaded project(s) will move to “${destination}”`);
    }
    const confirmation = effects.length > 0 ? ` ${effects.join(" and ")}.` : "";
    if (!window.confirm(`Remove the “${name}” group?${confirmation}`)) return;

    try {
      await deleteGroup(name, assignedCount > 0 ? destination : undefined);
      const remainingGroups = groups.filter((group) => group !== name);
      setGroups(remainingGroups);
      setProjects((current) => current.map((project) => project.category === name
        ? { ...project, category: destination || remainingGroups[0] }
        : project));
      setForm((current) => current.category === name
        ? { ...current, category: destination || remainingGroups[0] }
        : current);
      setGroupDeleteTargets((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
      setGroupSuccess(`“${name}” was removed.`);
    } catch (removeError) {
      setGroupError(removeError?.message || "Could not remove the group.");
    }
  }

  function resetSocialEditor() {
    setSocialForm(emptySocialForm);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type)) {
      setSocialError("Choose a JPG, PNG, WebP, GIF, or AVIF image for the logo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSocialError("Custom logos must be smaller than 5 MB.");
      return;
    }
    setSocialError("");
    setSocialForm((current) => ({
      ...current,
      logoBlob: file,
      logoUrl: URL.createObjectURL(file),
      logoPath: "",
    }));
  }

  function handleClearCustomLogo() {
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    setSocialForm((current) => ({
      ...current,
      logoBlob: null,
      logoUrl: "",
      logoPath: "",
    }));
  }

  function handleEditSocial(social) {
    setSocialError("");
    setSocialSuccess("");
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    setSocialForm({
      id: social.id,
      name: social.name,
      handle: social.handle || "",
      url: social.url,
      logoPreset: social.logoPreset || "website",
      logoBlob: social.logoBlob || null,
      logoUrl: social.logoUrl || "",
      logoPath: social.logoPath || "",
      order: social.order ?? 0,
    });
  }

  async function handleSocialSubmit(event) {
    event.preventDefault();
    setSocialError("");
    setSocialSuccess("");

    const name = socialForm.name.trim();
    const sanitizedUrl = sanitizeLinkUrl(socialForm.url);
    if (!name) {
      setSocialError("Enter a platform name.");
      return;
    }
    if (!sanitizedUrl) {
      setSocialError("Enter a valid link directory (such as https://... or mailto:...).");
      return;
    }

    setSocialSaving(true);
    const isEditing = Boolean(socialForm.id);
    const nextOrder = isEditing
      ? socialForm.order
      : socials.reduce((max, item) => Math.max(max, item.order ?? 0), -1) + 1;
    let uploadedLogoPath = "";
    try {
      if (socialForm.logoBlob) {
        const logoUpload = await uploadMediaFile(socialForm.logoBlob, "social-logo");
        uploadedLogoPath = logoUpload.path;
      }
      const record = await saveSocial({
        id: socialForm.id || crypto.randomUUID(),
        name,
        handle: socialForm.handle.trim(),
        url: sanitizedUrl,
        logoPreset: socialForm.logoPreset,
        logoPath: uploadedLogoPath || socialForm.logoPath,
        order: nextOrder,
      });
      setSocials((current) => {
        const next = isEditing
          ? current.map((item) => (item.id === record.id ? record : item))
          : [...current, record];
        return next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      });
      resetSocialEditor();
      setSocialSuccess(record.warning || (isEditing
        ? "Social link updated on your public popup."
        : "Social link added to your public popup."));
    } catch (saveError) {
      let message = saveError.message || "Could not save the social link.";
      if (uploadedLogoPath) {
        if (saveError.status && saveError.status < 500) {
          try {
            await deleteUploadedFiles([uploadedLogoPath]);
          } catch {
            message += " The uploaded logo may need to be removed from Supabase Storage.";
          }
        } else {
          message += " The uploaded logo may remain in storage if the save did not complete.";
        }
      }
      setSocialError(message);
    } finally {
      setSocialSaving(false);
    }
  }

  async function handleDeleteSocial(social) {
    if (!window.confirm(`Remove “${social.name}” from your public social popup?`)) return;
    setSocialError("");
    setSocialSuccess("");
    try {
      const result = await deleteSocial(social.id);
      setSocials((current) => current.filter((item) => item.id !== social.id));
      if (socialForm.id === social.id) {
        resetSocialEditor();
      }
      setSocialSuccess(result.warning || "Social link removed.");
    } catch (deleteError) {
      setSocialError(deleteError.message || "Could not remove social link.");
    }
  }

  async function handleMoveSocial(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= socials.length) return;
    setSocialError("");
    const reordered = [...socials];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((item, idx) => ({ ...item, order: idx }));
    setSocials(normalized);
    try {
      await Promise.all(normalized.map((item) => saveSocial(item)));
    } catch {
      setSocialError("Could not save the new link order.");
    }
  }

  async function handleResetSocials() {
    if (!window.confirm("Restore the default XAIRO social links?")) return;
    setSocialError("");
    setSocialSuccess("");
    try {
      const result = await resetSocialsToDefault();
      setSocials(result.socials);
      resetSocialEditor();
      setSocialSuccess(result.warning || "Default social links restored.");
    } catch (resetError) {
      setSocialError(resetError.message || "Could not restore default social links.");
    }
  }

  if (authStatus !== "authorized") {
    return (
      <main className="studio-page">
        <header className="studio-header">
          <a className="wordmark" href="/">XAIRO<span>®</span></a>
          <div className="studio-header-right"><a href="/">View portfolio <Arrow diagonal /></a></div>
        </header>
        <section className="studio-access">
          <p className="eyebrow">PRIVATE CONTENT STUDIO</p>
          <h1>Studio<br /><span>access.</span></h1>
          <p className="studio-subtitle">
            {authStatus === "checking"
              ? "Checking your studio session…"
              : "Enter your access code to manage the public portfolio."}
          </p>
          {authStatus !== "checking" && (
            <form className="studio-access-form" onSubmit={handleAccessCodeSubmit}>
              <label className="field-label" htmlFor="studio-access-code">Access code</label>
              <input
                id="studio-access-code"
                type="password"
                autoComplete="current-password"
                required
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
              />
              <button className="publish-button" type="submit" disabled={authBusy}>
                {authBusy ? "Checking…" : "Unlock studio"} <Arrow />
              </button>
            </form>
          )}
          {authError && <p className="form-message error" role="alert">{authError}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="studio-page">
      <header className="studio-header">
        <a className="wordmark" href="/">XAIRO<span>®</span></a>
        <div className="studio-header-right">
          <span className="studio-indicator"><i /> CONTENT STUDIO</span>
          <a href="/">View portfolio <Arrow diagonal /></a>
          <button type="button" className="studio-logout" onClick={handleStudioLogout}>Lock studio</button>
        </div>
      </header>
      <section className="studio-intro">
        <p className="eyebrow">YOUR CREATIVE CONTROL ROOM</p>
        <h1>Make it<br /><span>public.</span></h1>
        <p className="studio-subtitle">Manage the media, groups, and social links published on your public portfolio. Changes are shared with visitors.</p>
        <div className="studio-tabs" role="tablist" aria-label="Studio sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "projects"}
            className={activeTab === "projects" ? "studio-tab active" : "studio-tab"}
            onClick={() => setActiveTab("projects")}
          >
            <span>01</span> Projects &amp; Media
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "socials"}
            className={activeTab === "socials" ? "studio-tab active" : "studio-tab"}
            onClick={() => setActiveTab("socials")}
          >
            <span>02</span> Socials &amp; Links
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "groups"}
            className={activeTab === "groups" ? "studio-tab active" : "studio-tab"}
            onClick={() => setActiveTab("groups")}
          >
            <span>03</span> Portfolio Groups
          </button>
        </div>
      </section>

      {legacyContent && (
        <aside className="legacy-migration">
          <div>
            <p className="eyebrow">PREVIOUS BROWSER CONTENT</p>
            <p>Found {legacyContent.projects.length} project(s), {legacyContent.groups.length} group(s), and {legacyContent.socials.length} social link(s) saved in this browser. Import them into Supabase?</p>
            {legacyError && <p className="form-message error" role="alert">{legacyError}</p>}
          </div>
          <button type="button" className="archive-button" onClick={handleImportLegacyContent} disabled={legacyImporting}>
            {legacyImporting ? "Importing…" : "Import content"}
          </button>
        </aside>
      )}
      {legacySuccess && <p className="form-message success legacy-migration-status" role="status">{legacySuccess}</p>}

      {activeTab === "projects" ? (
        <section className="studio-layout">
          <form className="upload-panel" onSubmit={handleSubmit}>
            <div className="panel-title"><span>01</span><h2>New project</h2></div>
            <label className="field-label" htmlFor="project-title">Project name <span>*</span></label>
            <input id="project-title" required maxLength="80" placeholder="Give it a name" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

            <label className="field-label" htmlFor="project-category">Portfolio group</label>
            <select id="project-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {groups.map((group) => <option key={group}>{group}</option>)}
            </select>
            <p className="field-help">Choose the group where this project appears on the public portfolio.</p>

            <div className="source-video-import">
              <div>
                <strong>Choose from your portfolio folder</strong>
                <p>Select <code>Downloads\portfolio</code>. Clips stay on this device until you publish them.</p>
              </div>
              <button
                className="archive-button"
                type="button"
                onClick={() => sourceFolderInputRef.current?.click()}
                disabled={saving}
              >Choose folder</button>
              <input
                ref={sourceFolderInputRef}
                className="visually-hidden"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-msvideo,video/x-matroska"
                multiple
                webkitdirectory=""
                aria-label="Choose a folder of portfolio videos"
                onChange={handleSourceFolderSelection}
              />
            </div>
            {sourceVideos.length > 0 && (
              <div className="source-video-list" aria-label="Videos from the selected folder">
                <div className="source-video-list-heading">
                  <strong>Local clips</strong>
                  <span>{sourceVideos.length}</span>
                </div>
                {sourceVideos.map((file) => (
                  <div className="source-video-item" key={file.webkitRelativePath || `${file.name}-${file.lastModified}`}>
                    <div className="source-video-details">
                      <strong>{getFolderName(file) || "Video"}</strong>
                      <span title={file.name}>{file.name} · {formatFileSize(file.size)}</span>
                    </div>
                    <button
                      className="mini-action"
                      type="button"
                      disabled={saving}
                      onClick={() => handleSelectSourceVideo(file)}
                    >{selectedMedia === file ? "Selected" : "Use clip"}</button>
                    <button
                      className="delete-button"
                      type="button"
                      disabled={saving}
                      onClick={() => handleRemoveSourceVideo(file)}
                      aria-label={`Remove ${file.name} from local clips`}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <label className="field-label" htmlFor="project-description">A few words <span className="optional">OPTIONAL</span></label>
            <textarea id="project-description" maxLength="240" rows="3" placeholder="What makes this one special?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />

            <label className="field-label" htmlFor="project-client">Client / credit <span className="optional">OPTIONAL</span></label>
            <input id="project-client" maxLength="60" placeholder="Who was it for?" value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} />

            <div className="media-source-switch" role="group" aria-label="Project media source">
              <button
                type="button"
                className={mediaSource === "file" ? "project-view-button active" : "project-view-button"}
                aria-pressed={mediaSource === "file"}
                disabled={saving}
                onClick={() => {
                  setMediaSource("file");
                  setError("");
                  setSuccess("");
                }}
              >Upload a file</button>
              <button
                type="button"
                className={mediaSource === "url" ? "project-view-button active" : "project-view-button"}
                aria-pressed={mediaSource === "url"}
                disabled={saving}
                onClick={() => {
                  setMediaSource("url");
                  setError("");
                  setSuccess("");
                }}
              >Use a social URL</button>
            </div>
            {mediaSource === "file" ? (
              <>
                <label className="field-label" htmlFor="project-media">Video or photo <span>*</span></label>
                <label className="file-drop" htmlFor="project-media">
                  <span className="file-icon">↥</span><strong>{selectedMedia?.name || "Choose a file"}</strong>
                  <span>{selectedMedia ? `${formatFileSize(selectedMedia.size)} · selected` : "Videos are converted to MP4 and compressed to 1080p before upload."}</span>
                </label>
                <input
                  ref={mediaInputRef}
                  className="visually-hidden"
                  id="project-media"
                  name="media"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif,image/avif"
                  required={!selectedMedia}
                  onChange={(event) => setSelectedMedia(event.target.files?.[0] || null)}
                />
                <label className="field-label poster-label" htmlFor="project-poster">Video cover image <span className="optional">OPTIONAL</span></label>
                <input className="poster-input" id="project-poster" name="poster" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="project-url">Public project URL <span>*</span></label>
                <input
                  id="project-url"
                  type="url"
                  required
                  maxLength="2048"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                />
                <p className="field-help">YouTube, TikTok, and Vimeo videos can embed here. Other HTTPS social links appear as a safe link card.</p>
              </>
            )}
            <button className="publish-button" type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish project"} <Arrow /></button>
            {uploadStatus && <p className="form-message upload-status" role="status">{uploadStatus}</p>}
            {error && <p className="form-message error" role="alert">{error}</p>}
            {success && <p className="form-message success" role="status">{success}</p>}
            <p className="storage-note">{mediaSource === "file"
              ? "Each clip is converted to browser-compatible H.264 MP4, capped at 1080p, then uploaded. The optimized file must be 50 MB or smaller. Publishing makes it public."
              : "The URL is saved as a project link. YouTube, TikTok, and Vimeo may show an embedded preview; other platforms open in a new tab."}</p>
          </form>

          <div className="library-panel">
            <div className="panel-title"><span>02</span><h2>Your projects</h2><span className="library-count">{String(projects.length).padStart(2, "0")}</span></div>
            <div className="project-view-switch" aria-label="Filter projects by archive status">
              <button
                type="button"
                className={projectView === "published" ? "project-view-button active" : "project-view-button"}
                aria-pressed={projectView === "published"}
                onClick={() => setProjectView("published")}
              >Published <span>{publishedCount}</span></button>
              <button
                type="button"
                className={projectView === "archived" ? "project-view-button active" : "project-view-button"}
                aria-pressed={projectView === "archived"}
                onClick={() => setProjectView("archived")}
              >Archived <span>{archivedCount}</span></button>
            </div>
            {projectActionError && <p className="form-message error" role="alert">{projectActionError}</p>}
            {projectActionSuccess && <p className="form-message success" role="status">{projectActionSuccess}</p>}
            {visibleProjects.length === 0 ? (
              <div className="library-empty">
                <span>✳</span>
                <h3>{projectView === "archived" ? <>No archived projects<br />yet.</> : <>Your next favorite<br />starts here.</>}</h3>
                <p>{projectView === "archived" ? "Projects you archive will be kept here and hidden from visitors." : "Published projects will appear here and on your public portfolio."}</p>
              </div>
            ) : (
              <div className="library-list">
                {visibleProjects.map((project) => (
                  <article className="library-item" key={project.id}>
                    <div className="library-thumb">
                      {project.externalUrl
                        ? <span className="library-external-thumb">LINK</span>
                        : project.fileType.startsWith("video/")
                          ? <video src={project.mediaUrl} poster={project.posterUrl || undefined} />
                          : <img src={project.mediaUrl} alt="" />}
                    </div>
                    <div className="library-info"><span>{project.category} · {project.year}</span><h3>{project.title}</h3><p>{project.client || project.description || "No details added"}</p></div>
                    <div className="project-item-actions">
                      <button
                        className="archive-button"
                        onClick={() => handleArchiveToggle(project)}
                        type="button"
                      >{project.archived ? "Restore" : "Archive"}</button>
                      <button className="delete-button" onClick={() => handleDelete(project)} type="button" aria-label={`Delete ${project.title}`}>×</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : activeTab === "socials" ? (
        <section className="studio-layout">
          <form className="upload-panel" onSubmit={handleSocialSubmit}>
            <div className="panel-title">
              <span>01</span>
              <h2>{socialForm.id ? "Edit social link" : "Add social link"}</h2>
            </div>

            <label className="field-label" htmlFor="social-name">Platform name <span>*</span></label>
            <input
              id="social-name"
              required
              maxLength="40"
              placeholder="e.g. Instagram, YouTube, Discord"
              value={socialForm.name}
              onChange={(event) => setSocialForm({ ...socialForm, name: event.target.value })}
            />

            <label className="field-label" htmlFor="social-handle">Handle or display label <span className="optional">OPTIONAL</span></label>
            <input
              id="social-handle"
              maxLength="80"
              placeholder="e.g. @xairo.studio"
              value={socialForm.handle}
              onChange={(event) => setSocialForm({ ...socialForm, handle: event.target.value })}
            />

            <label className="field-label" htmlFor="social-url">Link directory (URL) <span>*</span></label>
            <input
              id="social-url"
              required
              maxLength="240"
              placeholder="https://instagram.com/xairo or mailto:hello@xairo.studio"
              value={socialForm.url}
              onChange={(event) => setSocialForm({ ...socialForm, url: event.target.value })}
            />

            <div className="field-label">Logo icon <span className="optional">PRESET OR CUSTOM</span></div>
            <div className="logo-preview-bar">
              <SocialLogo social={socialForm} />
              <div className="logo-preview-meta">
                <strong>{socialForm.logoUrl ? "Custom uploaded logo" : `Preset: ${SOCIAL_PRESETS.find((p) => p.id === socialForm.logoPreset)?.label || "Website"}`}</strong>
                <span>Shown next to this link in the public popup</span>
              </div>
              {socialForm.logoUrl && (
                <button type="button" className="mini-action" onClick={handleClearCustomLogo}>
                  Use preset
                </button>
              )}
            </div>

            <div className="preset-grid" role="group" aria-label="Preset social logos">
              {SOCIAL_PRESETS.map((preset) => {
                const isSelected = !socialForm.logoUrl && socialForm.logoPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={isSelected ? "preset-button active" : "preset-button"}
                    onClick={() => {
                      if (logoInputRef.current) logoInputRef.current.value = "";
                      setSocialForm((current) => ({
                        ...current,
                        logoPreset: preset.id,
                        logoBlob: null,
                        logoUrl: "",
                        logoPath: "",
                      }));
                    }}
                    title={preset.label}
                  >
                    <SocialPresetIcon preset={preset.id} />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="field-label poster-label" htmlFor="social-custom-logo">
              Or upload custom logo <span className="optional">OPTIONAL</span>
            </label>
            <input
              ref={logoInputRef}
              id="social-custom-logo"
              className="poster-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              onChange={handleLogoUpload}
            />

            <div className="form-actions">
              <button className="publish-button" type="submit" disabled={socialSaving}>
                {socialSaving ? "Saving…" : socialForm.id ? "Save changes" : "Add social link"} <Arrow />
              </button>
              {socialForm.id && (
                <button type="button" className="cancel-button" onClick={resetSocialEditor}>
                  Cancel edit
                </button>
              )}
            </div>

            {socialError && <p className="form-message error" role="alert">{socialError}</p>}
            {socialSuccess && <p className="form-message success" role="status">{socialSuccess}</p>}
            <p className="storage-note">Changes are saved to the shared portfolio and shown in the public social popup.</p>
          </form>

          <div className="library-panel">
            <div className="panel-title">
              <span>02</span>
              <h2>Public social links</h2>
              <button type="button" className="reset-socials-button" onClick={handleResetSocials}>
                Reset defaults
              </button>
              <span className="library-count">{String(socials.length).padStart(2, "0")}</span>
            </div>

            {socials.length === 0 ? (
              <div className="library-empty">
                <span>✳</span>
                <h3>No social links<br />published yet.</h3>
                <p>Add your links on the left or restore the starter links above.</p>
              </div>
            ) : (
              <div className="library-list">
                {socials.map((social, index) => (
                  <article className="social-manage-item" key={social.id}>
                    <SocialLogo social={social} />
                    <div className="library-info">
                      <span>{social.handle || "Direct link"}</span>
                      <h3>{social.name}</h3>
                      <p>{social.url}</p>
                    </div>
                    <div className="social-item-actions">
                      <button
                        type="button"
                        className="order-button"
                        onClick={() => handleMoveSocial(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${social.name} up`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="order-button"
                        onClick={() => handleMoveSocial(index, 1)}
                        disabled={index === socials.length - 1}
                        aria-label={`Move ${social.name} down`}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="edit-social-button"
                        onClick={() => handleEditSocial(social)}
                        aria-label={`Edit ${social.name}`}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteSocial(social)}
                        type="button"
                        aria-label={`Delete ${social.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="studio-layout groups-layout">
          <form className="upload-panel" onSubmit={handleAddGroup}>
            <div className="panel-title"><span>01</span><h2>Add a portfolio group</h2></div>
            <label className="field-label" htmlFor="new-group-name">Group name <span>*</span></label>
            <input
              id="new-group-name"
              required
              maxLength="40"
              placeholder="e.g. Music videos"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
            />
            <p className="field-help">New groups become available in the upload form and as filters on your public portfolio.</p>
            <button className="publish-button" type="submit"><span>Add group</span><Arrow /></button>
            {groupError && <p className="form-message error" role="alert">{groupError}</p>}
            {groupSuccess && <p className="form-message success" role="status">{groupSuccess}</p>}
          </form>

          <div className="library-panel">
            <div className="panel-title">
              <span>02</span>
              <h2>Manage groups</h2>
              <span className="library-count">{String(groups.length).padStart(2, "0")}</span>
            </div>
            <p className="group-manager-note">Removing a group moves its uploaded projects to another group you choose.</p>
            {groups.length <= 1 && <p className="group-manager-note">At least one group must remain.</p>}
            {groups.length === 0 ? (
              <div className="library-empty">
                <span>✳</span>
                <h3>No groups<br />created yet.</h3>
                <p>Add a group to keep organizing your work.</p>
              </div>
            ) : (
              <div className="group-list">
                {groups.map((group) => {
                  const assignedCount = projects.filter((project) => project.category === group).length;
                  const destination = groupDeleteTargets[group] || groups.find((item) => item !== group) || "";

                  return (
                    <article className="group-manage-item" key={group}>
                      <div className="group-manage-info">
                        <h3>{group}</h3>
                        <span>{assignedCount} uploaded</span>
                      </div>
                      {assignedCount > 0 && (
                        <label className="group-move-field">
                          <span>Move uploaded projects to</span>
                          <select
                            value={destination}
                            onChange={(event) => setGroupDeleteTargets((current) => ({
                              ...current,
                              [group]: event.target.value,
                            }))}
                          >
                            {groups.filter((item) => item !== group).map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        className="delete-button group-remove-button"
                        onClick={() => handleDeleteGroup(group)}
                        type="button"
                        disabled={groups.length <= 1}
                        aria-label={`Remove ${group} group`}
                        title="Remove group"
                      >×</button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="studio-footer"><span>XAIRO STUDIO</span><span>SHARED PORTFOLIO CONTENT</span></footer>
    </main>
  );
}

function App() {
  const isStudio = window.location.pathname.replace(/\/+$/, "") === "/studio";

  useEffect(() => {
    document.title = isStudio ? "Xairo.Studio" : "Xairo.Creatives";
  }, [isStudio]);

  return isStudio ? <Studio /> : <PublicPortfolio />;
}

createRoot(document.getElementById("root")).render(<App />);
