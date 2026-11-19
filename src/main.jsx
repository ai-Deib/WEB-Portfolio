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
import "./styles.css";

const demoProjects = [
  {
    id: "demo-01",
    number: "01",
    title: "A little more human",
    category: "Brand film",
    description: "A portrait of the people and small moments behind a modern coffee ritual.",
    image: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1400&q=85",
    client: "Sunday Supply",
    year: "2025",
    demo: true,
  },
  {
    id: "demo-02",
    number: "02",
    title: "Color in motion",
    category: "Motion design",
    description: "Shape, rhythm and a little electricity. A visual identity made to move.",
    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1400&q=85",
    client: "Studio Practice",
    year: "2025",
    demo: true,
  },
  {
    id: "demo-03",
    number: "03",
    title: "After the noise",
    category: "Documentary",
    description: "An intimate short about finding stillness in a city that never switches off.",
    image: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=85",
    client: "Independent",
    year: "2024",
    demo: true,
  },
];

const ALL_WORK = "All work";
const LEGACY_MIGRATION_KEY = "xairo-legacy-import-complete";

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
  const groupsChanged = legacyGroups.length > 0 &&
    (legacyGroups.length !== DEFAULT_GROUPS.length ||
      legacyGroups.some((name, index) => name !== DEFAULT_GROUPS[index]));
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
  const [uploaded, setUploaded] = useState([]);
  const [groups, setGroups] = useState([]);
  const [socials, setSocials] = useState([]);
  const [filter, setFilter] = useState(ALL_WORK);
  const [loadError, setLoadError] = useState("");
  const [socialsOpen, setSocialsOpen] = useState(false);

  useEffect(() => {
    let active = true;

    function loadPortfolio() {
      getPublicPortfolio()
        .then(({ projects: nextProjects, groups: nextGroups, socials: nextSocials }) => {
          if (!active) return;
          setUploaded(nextProjects);
          setGroups(nextGroups);
          setSocials(nextSocials);
          setFilter((current) => current === ALL_WORK || nextGroups.includes(current) ? current : ALL_WORK);
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
    const visibleDemoProjects = demoProjects.filter((project) => groups.includes(project.category));
    const allProjects = [...uploaded.filter((project) => !project.archived), ...visibleDemoProjects];
    return filter === ALL_WORK
      ? allProjects
      : allProjects.filter((project) => project.category === filter);
  }, [filter, groups, uploaded]);

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Xairo home">XAIRO<span>®</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#work">Selected work</a>
          <a href="#about">About</a>
          <a href="#contact">Contact <Arrow diagonal /></a>
        </nav>
        <a className="availability" href="#contact"><span /> Available for projects</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker"><span>INDEPENDENT CREATIVE</span><span>BASED ANYWHERE · WORKING EVERYWHERE</span></div>
        <h1>Making<br />good things <span className="hero-accent">move.</span></h1>
        <div className="hero-bottom">
          <p>Creative direction, films &amp; images<br />for people with something to say.</p>
          <a href="#work" className="round-link" aria-label="Scroll to selected work"><Arrow /></a>
          <span className="hero-index">SCROLL TO EXPLORE&nbsp; ↓</span>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span>X</span></div>
      </section>

      <section className="work-section section-wrap" id="work">
        <div className="section-heading">
          <div><p className="eyebrow">A FEW RECENT FAVORITES</p><h2>Selected work<span className="green-dot">.</span></h2></div>
          <p className="work-count">{String(projects.length).padStart(2, "0")} <span>PROJECTS</span></p>
        </div>
        <div className="filters" aria-label="Filter projects">
          {[ALL_WORK, ...groups].map((category) => (
            <button
              className={filter === category ? "filter active" : "filter"}
              key={category}
              onClick={() => setFilter(category)}
              type="button"
            >{category}</button>
          ))}
        </div>
        {loadError && <p className="notice" role="status">{loadError}</p>}
        <div className="project-grid">
          {projects.map((project, index) => (
            <article className={`project-card ${index === 0 ? "project-featured" : ""}`} key={project.id}>
              <div className="project-media">
                {project.fileType?.startsWith("video/") ? (
                  <video controls playsInline preload="metadata" src={project.mediaUrl} poster={project.posterUrl || undefined} />
                ) : (
                  <img src={project.image || project.mediaUrl} alt={project.title} loading="lazy" />
                )}
                <span className="project-number">{String(index + 1).padStart(2, "0")}</span>
                {!project.fileType?.startsWith("video/") && <span className="media-mark" aria-hidden="true"><Arrow diagonal /></span>}
              </div>
              <div className="project-meta"><span>{project.category}</span><span>{project.year || "2025"}</span></div>
              <h3>{project.title}</h3>
              <p className="project-description">{project.description || project.client || "Selected creative work."}</p>
              {project.client && <span className="project-client">WITH {project.client.toUpperCase()}</span>}
            </article>
          ))}
          {projects.length === 0 && <p className="empty-work">Nothing in this category just yet. Check back soon.</p>}
        </div>
      </section>

      <section className="about-section section-wrap" id="about">
        <div className="about-label"><p className="eyebrow">A BIT ABOUT ME</p><span>01 — 03</span></div>
        <div className="about-copy">
          <h2><span className="about-quote">“</span>Curious by nature.<br /><span className="about-highlight">Intentional by design.</span><span className="about-quote">”</span></h2>
          <p>I’m a Filipino motion graphics editor based in the Philippines, specializing in motion editing, AI asset prompting, and visual composition. I shape ideas into engaging edits and cohesive imagery, balancing thoughtful pacing, clear visual hierarchy, and attention to detail. From refining the rhythm of a video to developing AI-assisted assets and composing each frame, I bring curiosity and care to every project. I enjoy collaborating with creators and brands to make work that feels purposeful and memorable.</p>
          <a className="text-link" href="#contact">A little more about me <Arrow diagonal /></a>
        </div>
        <div className="about-stamp" aria-hidden="true">GOOD<br />WORK<br /><span>ONLY</span></div>
      </section>

      <section className="contact-section" id="contact">
        <p className="eyebrow">HAVE A GOOD ONE IN MIND?</p>
        <h2>Let’s make<br />it <span>happen.</span></h2>
        <button
          className="contact-link contact-trigger"
          type="button"
          onClick={() => setSocialsOpen(true)}
        >
          hello@xairo.studio <Arrow diagonal />
        </button>
        <footer className="site-footer">
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
  const [form, setForm] = useState({ title: "", category: "Brand film", description: "", client: "" });

  const [socials, setSocials] = useState([]);
  const [socialForm, setSocialForm] = useState(emptySocialForm);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [socialSuccess, setSocialSuccess] = useState("");
  const logoInputRef = useRef(null);
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
          const mediaPath = await uploadMediaFile(project.mediaBlob, "project");
          uploadedPaths.push(mediaPath);
          let posterPath = "";
          if (project.posterBlob instanceof Blob && project.posterBlob.size > 0) {
            posterPath = await uploadMediaFile(project.posterBlob, "poster");
            uploadedPaths.push(posterPath);
          }
          const saved = await saveProject({
            id: project.id,
            title: project.title,
            category: knownGroups.includes(project.category) ? project.category : knownGroups[0],
            description: project.description || "",
            client: project.client || "",
            year: project.year || String(new Date().getFullYear()),
            fileType: project.fileType,
            mediaPath,
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
            uploadedLogoPath = await uploadMediaFile(social.logoBlob, "social-logo");
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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const file = data.get("media");
    const poster = data.get("poster");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a video or photo to upload.");
      return;
    }
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      setError("Choose a supported video or image file.");
      return;
    }

    const uploadedPaths = [];
    setSaving(true);
    try {
      const mediaPath = await uploadMediaFile(file, "project");
      uploadedPaths.push(mediaPath);
      let posterPath = "";
      if (poster instanceof File && poster.size > 0) {
        posterPath = await uploadMediaFile(poster, "poster");
        uploadedPaths.push(posterPath);
      }

      const project = await saveProject({
        id: crypto.randomUUID(),
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        client: form.client.trim(),
        year: String(new Date().getFullYear()),
        fileType: file.type,
        mediaPath,
        posterPath,
        createdAt: Date.now(),
      });
      setProjects((current) => [project, ...current]);
      setForm({ title: "", category: "Brand film", description: "", client: "" });
      formElement.reset();
      setSuccess("Project published to your portfolio.");
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

    const sampleCount = demoProjects.filter((project) => project.category === name).length;
    const effects = [];
    if (assignedCount > 0) {
      effects.push(`${assignedCount} uploaded project(s) will move to “${destination}”`);
    }
    if (sampleCount > 0) {
      effects.push(`${sampleCount} sample project(s) will be hidden from the public page`);
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
        uploadedLogoPath = await uploadMediaFile(socialForm.logoBlob, "social-logo");
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

            <label className="field-label" htmlFor="project-description">A few words <span className="optional">OPTIONAL</span></label>
            <textarea id="project-description" maxLength="240" rows="3" placeholder="What makes this one special?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />

            <label className="field-label" htmlFor="project-client">Client / credit <span className="optional">OPTIONAL</span></label>
            <input id="project-client" maxLength="60" placeholder="Who was it for?" value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} />

            <label className="field-label" htmlFor="project-media">Video or photo <span>*</span></label>
            <label className="file-drop" htmlFor="project-media">
              <span className="file-icon">↥</span><strong>Choose a file</strong>              <span>MP4, WebM, MOV, JPG, PNG, WebP, GIF · Max 50 MB</span>
            </label>
            <input className="visually-hidden" id="project-media" name="media" type="file" accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif,image/avif" required />
            <label className="field-label poster-label" htmlFor="project-poster">Video cover image <span className="optional">OPTIONAL</span></label>
            <input className="poster-input" id="project-poster" name="poster" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
            <button className="publish-button" type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish project"} <Arrow /></button>
            {error && <p className="form-message error" role="alert">{error}</p>}
            {success && <p className="form-message success" role="status">{success}</p>}
            <p className="storage-note">Uploads are stored in Supabase and are publicly visible after publishing. Maximum file size is 50 MB.</p>
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
                      {project.fileType.startsWith("video/") ? <video src={project.mediaUrl} poster={project.posterUrl || undefined} /> : <img src={project.mediaUrl} alt="" />}
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
            <p className="group-manager-note">Removing a group moves its uploaded projects to another group you choose. Sample projects in that group are hidden from the public page.</p>
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
                  const sampleCount = demoProjects.filter((project) => project.category === group).length;
                  const destination = groupDeleteTargets[group] || groups.find((item) => item !== group) || "";

                  return (
                    <article className="group-manage-item" key={group}>
                      <div className="group-manage-info">
                        <h3>{group}</h3>
                        <span>{assignedCount} uploaded · {sampleCount} sample</span>
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
  return window.location.pathname.replace(/\/+$/, "") === "/studio" ? <Studio /> : <PublicPortfolio />;
}

createRoot(document.getElementById("root")).render(<App />);
