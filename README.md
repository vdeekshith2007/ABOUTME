# github-portfolio
Git-portfolio of mine
# Deekshith Vataparthi — Portfolio

A dark-themed, animated personal portfolio for an AI/ML, Generative AI and Full Stack Developer. Built with plain HTML, CSS and vanilla JavaScript — no build step, no framework required.

## File structure

```
portfolio/
├── index.html          Page markup (all sections)
├── style.css            All styling, layout, and CSS animations
├── script.js             All interactivity (typing effect, particle
│                          background, scroll reveals, counters, tilt,
│                          theme toggle, mobile menu, etc.)
└── assets/
    └── images/          Put your photo(s) here, e.g. images/profile.jpg
```

## Adding your photo

Open `index.html` and find the two `.avatar` blocks (search for `avatar-hero` and `avatar-about`). Replace:

```html
<span class="avatar-initials">DV</span>
```

with:

```html
<img src="assets/images/profile.jpg" alt="Deekshith Vataparthi">
```

## Adding your resume

Place your resume PDF in `assets/` (e.g. `assets/resume.pdf`), then in `index.html` update the "Download Resume" button:

```html
<a href="assets/resume.pdf" download class="btn btn-outline">Download Resume</a>
```

and remove the placeholder click handler for `#resumeBtn` in `script.js`.

## Running locally

No build tools needed. Either:

- Double-click `index.html` to open it directly in a browser, or
- Serve it locally (recommended, avoids any file:// quirks):
  ```bash
  python3 -m http.server 5500
  ```
  then open `http://localhost:5500`.

## Deploying to Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Framework preset: **Other** (static site) — no build command needed, output directory is the project root.
4. Deploy. Vercel will serve `index.html` at your project's root URL.

You can also drag-and-drop the folder directly onto [vercel.com/new](https://vercel.com/new) without using GitHub.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. Repo → Settings → Pages → Source: deploy from the `main` branch, root folder.
3. Your site will be live at `https://<username>.github.io/<repo-name>/`.

## Customizing

- Colors, fonts and spacing: edit the CSS variables at the top of `style.css` (`:root { --bg: ...; --accent: ...; }`).
- Section content (projects, skills, experience): edit the corresponding `<section>` in `index.html`.
- Animation behavior (typing speed, particle count, tilt intensity): edit the relevant function in `script.js`.

